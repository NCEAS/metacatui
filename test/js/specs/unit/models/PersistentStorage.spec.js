define([
  "/test/js/specs/shared/clean-state.js",
  "models/PersistentStorage",
  "localforage",
], (cleanState, PersistentStorage, localforage) => {
  const should = chai.should();
  const expect = chai.expect;

  const createStoreStub = (sandbox) => {
    // map represents the cached key-value pairs for our fake localforage, so
    // we can easily manipulate stored values and test interactions with the
    // store.
    const map = new Map();
    const store = {
      _config: null,
      getItem: sandbox
        .stub()
        .callsFake(async (key) => (map.has(key) ? map.get(key) : null)),
      setItem: sandbox.stub().callsFake(async (key, value) => {
        map.set(key, value);
        return value;
      }),
      removeItem: sandbox.stub().callsFake(async (key) => {
        map.delete(key);
      }),
      clear: sandbox.stub().callsFake(async () => {
        map.clear();
      }),
      iterate: sandbox.stub().callsFake(async (iter) => {
        for (const [key, value] of map.entries()) {
          await iter(value, key);
        }
      }),
      keys: sandbox.stub().callsFake(async () => Array.from(map.keys())),
      length: sandbox.stub().callsFake(async () => map.size),
    };

    sandbox.stub(localforage, "createInstance").callsFake((config) => {
      store._config = config;
      return store;
    });

    return { store, map };
  };

  describe("PersistentStorage", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const { store, map } = createStoreStub(sandbox);
        return { sandbox, store, map };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
      PersistentStorage.instances = new Map();
    });

    describe("static helpers", () => {
      it("normalizes options and instance keys", () => {
        const normalized = PersistentStorage.normalizeOptions({
          instanceKeys: ["https://Example.org/", "My App"],
          ttlMs: 5000,
          schemaVersion: 2,
          memory: 0,
          localforageConfig: { driver: "someDriver" },
        });

        normalized.ttlMs.should.equal(5000);
        normalized.schemaVersion.should.equal(2);
        normalized.memory.should.equal(false);
        normalized.localforageConfig.should.deep.equal({
          driver: "someDriver",
        });
        normalized.instanceKeySuffix.should.equal("example_org|my_app");
      });

      it("disables ttl when ttlMs is falsy but not undefined", () => {
        const normalized = PersistentStorage.normalizeOptions({
          instanceKeys: ["ttl-null"],
          ttlMs: 0,
        });

        should.equal(normalized.ttlMs, null);

        const normalized3 = PersistentStorage.normalizeOptions({
          instanceKeys: ["ttl-false"],
          ttlMs: false,
        });

        should.equal(normalized3.ttlMs, null);
      });

      it("uses default ttl when ttlMs is undefined", () => {
        const normalized = PersistentStorage.normalizeOptions({
          instanceKeys: ["ttl-undef"],
          ttlMs: undefined,
        });

        normalized.ttlMs.should.equal(PersistentStorage.DEFAULT_TTL_MS);
      });

      it("throws an error when ttlMs is invalid", () => {
        let caught;
        try {
          PersistentStorage.normalizeOptions({
            instanceKeys: ["ttl-invalid"],
            ttlMs: -10,
          });
        } catch (err) {
          caught = err;
        }
        expect(caught).to.be.instanceof(Error);
      });

      it("skips empty instance key parts", () => {
        const normalized = PersistentStorage.normalizeOptions({
          instanceKeys: ["", "  ", null, "One", undefined, "Two", false],
        });

        normalized.instanceKeySuffix.should.equal("one|two|false");
      });

      it("sanitizes namespace parts", () => {
        const part = PersistentStorage.sanitizeNamespacePart(
          "https://www.Example.org/path/",
        );
        part.should.equal("example_org_path");
      });

      it("builds instance keys deterministically", () => {
        const key = PersistentStorage.buildInstanceKey({
          ttlMs: 2000,
          schemaVersion: 3,
          memory: false,
          instanceKeys: ["App", "User"],
          localforageConfig: { storeName: "myStore", name: "myDb" },
        });

        const keyAlt = PersistentStorage.buildInstanceKey({
          instanceKeys: ["App", "User"],
          ttlMs: 2000,
          schemaVersion: 3,
          memory: false,
          localforageConfig: { name: "myDb", storeName: "myStore" },
        });
        key.should.be.a("string");
        key.should.not.equal("");
        keyAlt.should.equal(key);
      });

      it("includes ttl and instance keys in instance keys", () => {
        const key = PersistentStorage.buildInstanceKey({
          ttlMs: 1000,
          instanceKeys: ["App"],
        });
        const keyAlt = PersistentStorage.buildInstanceKey({
          ttlMs: 2000,
          instanceKeys: ["App"],
        });
        const keyAlt2 = PersistentStorage.buildInstanceKey({
          ttlMs: 1000,
          instanceKeys: ["Other"],
        });

        key.should.not.equal(keyAlt);
        key.should.not.equal(keyAlt2);
      });

      it("returns singletons per instance key", () => {
        PersistentStorage.instances = new Map();
        const a = PersistentStorage.get({ instanceKeys: ["a"] });
        const b = PersistentStorage.get({ instanceKeys: ["a"] });
        const c = PersistentStorage.get({ instanceKeys: ["b"] });

        a.should.equal(b);
        a.should.not.equal(c);
        PersistentStorage.instances.size.should.equal(2);
      });

      it("detects quota errors", () => {
        PersistentStorage.isQuotaError("QuotaExceededError").should.equal(true);
        PersistentStorage.isQuotaError(
          new Error("quota exceeded"),
        ).should.equal(true);
        PersistentStorage.isQuotaError("other").should.equal(false);
      });

      it("decodes records that are objects or raw values", () => {
        const record = PersistentStorage.decodeRecord({
          value: null,
          expiresAt: 10,
        });
        record.should.deep.equal({ value: null, expiresAt: 10 });

        const raw = PersistentStorage.decodeRecord("value");
        raw.should.deep.equal({ value: "value", expiresAt: null });
      });

      it("encodes records with ttl and timestamps", () => {
        const clock = state.sandbox.useFakeTimers({ now: 1234 });
        const record = PersistentStorage.encodeRecord("value", 100);
        record.should.deep.equal({
          value: "value",
          expiresAt: 1334,
        });
        clock.restore();
      });
    });

    describe("constructor", () => {
      it("initializes localforage with computed instance keys", () => {
        const options = { instanceKeys: ["demo"], schemaVersion: 3 };
        const expectedKey = PersistentStorage.buildInstanceKey(options);
        const s = new PersistentStorage(options);

        s.lf.should.equal(state.store);
        state.store._config.name.should.equal(expectedKey);
        state.store._config.storeName.should.equal(expectedKey);
        state.store._config.version.should.equal(3);
      });

      it("allows localforageConfig to override store identifiers", () => {
        const s = new PersistentStorage({
          instanceKeys: ["override"],
          schemaVersion: 1,
          localforageConfig: {
            name: "custom-db",
            storeName: "custom-store",
            version: 9,
          },
        });

        s.lf.should.equal(state.store);
        state.store._config.name.should.equal("custom-db");
        state.store._config.storeName.should.equal("custom-store");
        state.store._config.version.should.equal(9);
      });
    });

    describe("locks", () => {
      it("serializes operations for the same key", async () => {
        const s = new PersistentStorage({ instanceKeys: ["locks"] });
        const order = [];
        let resolveFirst;
        const firstDone = new Promise((resolve) => {
          resolveFirst = resolve;
        });

        const first = s.withLock("k", async () => {
          await firstDone;
          order.push("first");
        });

        const second = s.withLock("k", async () => {
          order.push("second");
        });

        resolveFirst();
        await Promise.all([first, second]);

        order.should.deep.equal(["first", "second"]);
        s.locks.size.should.equal(0);
      });

      it("notifies onPreviousError when prior jobs fail", async () => {
        const s = new PersistentStorage({ instanceKeys: [] });
        const err = new Error("boom");
        const onPreviousError = state.sandbox.spy();

        s.withLock("k", async () => {
          setTimeout(() => {}, 5);
          throw err;
        });

        const result = await s.withLock(
          "k",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return "ok";
          },
          onPreviousError,
        );
        await result.should.equal("ok");
        onPreviousError.calledOnceWith(err).should.be.true;
      });
    });

    describe("TTLs", () => {
      it("uses expiresAt when provided", () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({ instanceKeys: ["ttl"] });
        const record = { expiresAt: 10 };
        s.isExpired(record).should.equal(true);
        clock.restore();
      });

      it("treats missing expiresAt as never expiring", () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({ instanceKeys: ["ttl"], ttlMs: 40 });
        const record = { value: "x" };
        s.isExpired(record).should.equal(false);
        clock.restore();
      });

      it("treats expiresAt:null as disabling expiration", () => {
        const dayMs = 24 * 60 * 60 * 1000;
        const clock = state.sandbox.useFakeTimers({ now: dayMs * 2 });
        const s = new PersistentStorage({
          instanceKeys: ["no-ttl"],
          ttlMs: null,
        });
        const record = { expiresAt: null };
        s.isExpired(record).should.equal(false);
        clock.restore();
      });

      it("treats invalid expiresAt as expired", () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({ instanceKeys: ["ttl"] });
        const record = { expiresAt: "invalid" };
        s.isExpired(record).should.equal(true);
        clock.restore();

        const record2 = { expiresAt: -50 };
        s.isExpired(record2).should.equal(true);

        const record3 = { expiresAt: Number.NaN };
        s.isExpired(record3).should.equal(true);
      });
    });

    describe("getRecord/getItem", () => {
      it("requires a key", async () => {
        const s = new PersistentStorage({ instanceKeys: ["get"] });
        let caught;
        try {
          await s.getRecord();
        } catch (err) {
          caught = err;
        }
        expect(caught).to.be.instanceof(Error);
      });

      it("returns cached record from memory when valid", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({
          instanceKeys: ["memory"],
          ttlMs: 1000,
        });
        const record = { value: "x", expiresAt: 200 };
        s.memoryCache.set("k", record);

        const loaded = await s.getRecord("k");
        loaded.should.equal(record);
        clock.restore();
      });

      it("refreshes expired memory entries from storage", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({
          instanceKeys: ["memory-expired"],
          ttlMs: 10,
        });
        const expired = { value: "old", expiresAt: 0 };
        const fresh = { value: "fresh", expiresAt: 200 };

        s.memoryCache.set("k", expired);
        state.map.set("k", fresh);

        const loaded = await s.getRecord("k");
        loaded.should.deep.equal(fresh);

        const inMemory = s.memoryCache.get("k");
        inMemory.should.deep.equal(fresh);

        clock.restore();
      });

      it("clears expired memory entries on load", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({
          instanceKeys: ["memory-miss"],
          ttlMs: 10,
        });
        const expired = { value: "old", expiresAt: 0 };
        s.memoryCache.set("k", expired);

        const loaded = await s.getRecord("k");
        expect(loaded).to.equal(null);
        s.memoryCache.has("k").should.equal(false);

        clock.restore();
      });

      it("loads from storage when memory cache is disabled", async () => {
        const s = new PersistentStorage({
          instanceKeys: ["no-memory-read"],
          memory: false,
        });
        state.map.set("k", PersistentStorage.encodeRecord("y", null));

        const loaded = await s.getRecord("k");

        loaded.value.should.equal("y");
        expect(s.memoryCache).to.equal(null);
      });

      it("removes expired records and returns null", async () => {
        const s = new PersistentStorage({
          instanceKeys: ["expired"],
          ttlMs: 1,
        });
        const record = { value: "x", expiresAt: Date.now() - 100 };
        state.map.set("k", record);

        const loaded = await s.getRecord("k");
        expect(loaded).to.equal(null);
        state.store.removeItem.calledOnceWith("k").should.be.true;
      });

      it("returns stored values via getItem", async () => {
        const s = new PersistentStorage({ instanceKeys: ["get-item"] });
        state.map.set("k", PersistentStorage.encodeRecord("y", null));

        const value = await s.getItem("k");
        value.should.equal("y");
      });

      it("returns null for missing keys", async () => {
        const s = new PersistentStorage({ instanceKeys: ["missing"] });
        const value = await s.getItem("missing");
        expect(value).to.equal(null);
      });

      it("waits for existing lock jobs before reading", async () => {
        const s = new PersistentStorage({ instanceKeys: ["get-lock-clear"] });

        let startFirst;
        const firstStarted = new Promise((resolve) => {
          startFirst = resolve;
        });

        let releaseFirst;
        const firstCanFinish = new Promise((resolve) => {
          releaseFirst = resolve;
        });

        const first = s.withLock("k", async () => {
          startFirst();
          // This job won't complete until we explicitly call releaseFirst, so
          // we can test that second waits for it to finish before calling
          // getItem.
          await firstCanFinish;
        });

        // Start first job but don't let it finish yet.
        await firstStarted;

        // Get record uses withLock, so should wait for first job to finish
        // before calling getItem.
        const second = s.getRecord("k");

        // Should not call getItem until first job releases lock.
        state.store.getItem.called.should.equal(false);

        // Now release first job and allow second to proceed, which should call getItem.
        releaseFirst();
        await Promise.all([first, second]);

        state.store.getItem.calledOnceWith("k").should.be.true;
      });

      it("does not block reads for a different key", async () => {
        const s = new PersistentStorage({
          instanceKeys: ["get-lock-other-key"],
        });

        let releaseFirst;
        const firstCanFinish = new Promise((resolve) => {
          releaseFirst = resolve;
        });

        const first = s.withLock("k1", async () => {
          await firstCanFinish;
        });

        // Different key should not wait on k1 lock.
        const second = s.getRecord("k2");
        await second;

        state.store.getItem.calledOnceWith("k2").should.be.true;

        releaseFirst();
        await first;
      });
    });

    describe("setItem", () => {
      it("stores values and updates memory and localforage storage", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({ instanceKeys: ["set-item"] });

        await s.setItem("k", "value", { ttlMs: 50 });
        state.store.setItem.calledOnce.should.be.true;
        s.memoryCache.get("k").should.deep.equal({
          value: "value",
          expiresAt: 150,
        });
        // map is our fake localforage
        state.map.get("k").should.deep.equal({
          value: "value",
          expiresAt: 150,
        });
        clock.restore();
      });

      it("throws when key is missing", async () => {
        const s = new PersistentStorage({ instanceKeys: ["set-missing"] });
        let caught;
        try {
          await s.setItem("", "value");
        } catch (err) {
          caught = err;
        }
        expect(caught).to.be.instanceof(Error);
      });

      it("clears and retries on quota errors", async () => {
        const s = new PersistentStorage({ instanceKeys: ["quota"] });
        const err = new Error("QuotaExceededError");
        state.store.setItem.onCall(0).rejects(err);
        state.store.setItem.onCall(1).resolves();
        state.sandbox.stub(s, "clear").resolves();

        await s.setItem("k", "value");

        s.clear.calledOnce.should.be.true;
        state.store.setItem.callCount.should.equal(2);
      });

      it("rethrows non-quota errors", async () => {
        const s = new PersistentStorage({ instanceKeys: ["errors"] });
        const err = new Error("boom");
        state.store.setItem.rejects(err);

        let caught;
        try {
          await s.setItem("k", "value");
        } catch (e) {
          caught = e;
        }
        caught.should.equal(err);
      });

      it("does not write to memory when disabled", async () => {
        const s = new PersistentStorage({
          instanceKeys: ["no-memory"],
          memory: false,
        });

        await s.setItem("k", "value");
        expect(s.memoryCache).to.equal(null);
      });

      it("stores default expiresAt when no per-item override is provided", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({
          instanceKeys: ["set-default-ttl"],
          ttlMs: 50,
        });

        await s.setItem("k", "value");

        const record = s.memoryCache.get("k");
        should.equal(record.expiresAt, 150);

        clock.tick(100);
        s.isExpired(record).should.equal(true);

        clock.restore();
      });

      it("uses store default ttl when ttlMs override is undefined", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({
          instanceKeys: ["set-undefined-ttl"],
          ttlMs: 50,
        });

        await s.setItem("k", "value", { ttlMs: undefined });

        const record = s.memoryCache.get("k");
        should.equal(record.expiresAt, 150);

        clock.restore();
      });
    });

    describe("removeItem", () => {
      it("does not call removeItem for missing keys", async () => {
        const s = new PersistentStorage({ instanceKeys: ["remove"] });
        await s.removeItem("");
        state.store.removeItem.called.should.be.false;
      });

      it("throws an error on removeItem failures", async () => {
        const s = new PersistentStorage({ instanceKeys: ["remove"] });
        state.store.removeItem.rejects(new Error("fail"));
        let caught;
        try {
          await s.removeItem("k");
        } catch (err) {
          caught = err;
        }
        expect(caught).to.be.instanceof(Error);
      });
    });

    describe("clear/clearExpired", () => {
      it("clears cache, locks, and storage", async () => {
        const s = new PersistentStorage({ instanceKeys: ["clear"] });
        s.memoryCache.set("k", { value: "v" });
        s.locks.set("k", Promise.resolve());

        await s.clear();
        s.memoryCache.size.should.equal(0);
        s.locks.size.should.equal(0);
        state.store.clear.calledOnce.should.be.true;
      });

      it("waits for in-flight locks before clearing", async () => {
        const s = new PersistentStorage({ instanceKeys: ["clear-wait"] });
        const order = [];
        let markLockStarted;
        const lockStarted = new Promise((resolve) => {
          markLockStarted = resolve;
        });
        let resolveLock;
        const lockDone = new Promise((resolve) => {
          resolveLock = resolve;
        });

        const locked = s.withLock("k", async () => {
          order.push("lock-start");
          markLockStarted();
          await lockDone;
          order.push("lock-end");
        });

        await lockStarted;
        order.should.deep.equal(["lock-start"]);

        const clearing = s.clear().then(() => {
          order.push("cleared");
        });

        resolveLock();
        await Promise.all([locked, clearing]);
        order.should.deep.equal(["lock-start", "lock-end", "cleared"]);
      });

      it("preserves active locks when clear skips waiting", async () => {
        const s = new PersistentStorage({
          instanceKeys: ["clear-no-wait-preserve-locks"],
        });

        // Control timing of lock and clear operations and track their order of
        // operations.
        const order = [];
        let markLockStarted;
        const lockStarted = new Promise((resolve) => {
          markLockStarted = resolve;
        });
        let resolveLock;
        const lockDone = new Promise((resolve) => {
          resolveLock = resolve;
        });

        state.store.clear.callsFake(async () => {
          order.push("cleared-storage");
          // Empty our fake localforage storage to simulate clear
          state.map.clear();
        });

        const first = s.withLock("k", async () => {
          order.push("lock-start");
          markLockStarted();
          // when we call resolveLock, this will finish and release the lock, allowing the second job to proceed
          await lockDone;
          order.push("lock-end");
        });

        await lockStarted;
        const clearing = s.clear({ awaitLocks: false });
        const second = s.withLock("k", async () => {
          order.push("second");
        });

        await clearing;
        order.should.deep.equal(["lock-start", "cleared-storage"]);

        resolveLock();
        await Promise.all([first, second]);
        order.should.deep.equal([
          "lock-start",
          "cleared-storage",
          "lock-end",
          "second",
        ]);
      });

      it("removes expired entries", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 100 });
        const s = new PersistentStorage({
          instanceKeys: ["clear-expired"],
          ttlMs: 5,
        });
        state.map.set("fresh", { value: "ok", expiresAt: 200 });
        state.map.set("stale", { value: "old", expiresAt: 80 });

        const removed = await s.clearExpired();
        removed.should.deep.equal(["stale"]);
        state.map.has("stale").should.equal(false);
        clock.restore();
      });
    });

    describe("key helpers", () => {
      it("hasRecord returns true when a key exists", async () => {
        const s = new PersistentStorage({ instanceKeys: ["has-key"] });
        state.map.set("k", PersistentStorage.encodeRecord("v", null));

        const exists = await s.hasRecord("k");
        exists.should.equal(true);
      });

      it("hasRecord returns true when value is null", async () => {
        const s = new PersistentStorage({ instanceKeys: ["has-key-null"] });
        state.map.set("k", PersistentStorage.encodeRecord(null, null));

        const exists = await s.hasRecord("k");
        exists.should.equal(true);
      });

      it("hasRecord returns true when value is undefined", async () => {
        const s = new PersistentStorage({
          instanceKeys: ["has-key-undefined"],
        });
        state.map.set("k", PersistentStorage.encodeRecord(undefined, null));

        const exists = await s.hasRecord("k");
        exists.should.equal(true);
      });

      it("hasRecord returns false for expired entries", async () => {
        const s = new PersistentStorage({ instanceKeys: ["has-key-expired"] });
        state.map.set("k", PersistentStorage.encodeRecord("v", 1));
        state.map.get("k").expiresAt = Date.now() - 100;

        const exists = await s.hasRecord("k");
        exists.should.equal(false);
      });

      it("returns keys and length", async () => {
        const s = new PersistentStorage({ instanceKeys: ["keys"] });
        state.map.set("a", PersistentStorage.encodeRecord("1", null));
        state.map.set("b", PersistentStorage.encodeRecord("2", null));

        const keys = await s.keys();
        const length = await s.length();

        keys.should.deep.equal(["a", "b"]);
        length.should.equal(2);
      });
    });
  });
});
