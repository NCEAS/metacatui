define([
  "/test/js/specs/shared/clean-state.js",
  "models/PersistentStorage",
  "localforage",
], (cleanState, PersistentStorage, localforage) => {
  const should = chai.should();
  const expect = chai.expect;

  const createStoreStub = (sandbox) => {
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
      it("creates a valid store name", () => {
        const name = PersistentStorage.createStoreName("my store", 2);
        name.should.equal("my_store_v2");
      });

      it("sanitizes namespace parts", () => {
        const part = PersistentStorage.sanitizeNamespacePart(
          "https://www.Example.org/path",
        );
        part.should.equal("Example_org_path");
      });

      it("builds namespaces with defaults", () => {
        const ns = PersistentStorage.buildNamespace({
          domain: "dataone",
          endpoint: "sysmeta",
          scope: "public",
          baseUrl: "https://example.org/api",
        });
        ns.should.equal("metacatui__dataone__sysmeta__public__example_org_api");
      });

      it("throws when domain or endpoint is missing", () => {
        expect(() =>
          PersistentStorage.buildNamespace({ endpoint: "x" }),
        ).to.throw();
        expect(() =>
          PersistentStorage.buildNamespace({ domain: "x" }),
        ).to.throw();
      });

      it("detects quota errors", () => {
        PersistentStorage.isQuotaError("QuotaExceededError").should.equal(true);
        PersistentStorage.isQuotaError(
          new Error("quota exceeded"),
        ).should.equal(true);
        PersistentStorage.isQuotaError("other").should.equal(false);
      });

      it("decodes records with null values", () => {
        const record = PersistentStorage.decodeRecord({
          value: null,
          updatedAt: 10,
          ttlMs: 20,
        });
        record.should.deep.equal({ value: null, updatedAt: 10, ttlMs: 20 });
      });

      it("encodes records with ttl", () => {
        const record = PersistentStorage.encodeRecord("value", 100);
        record.value.should.equal("value");
        record.ttlMs.should.equal(100);
        record.updatedAt.should.be.a("number");
      });

      it("returns a singleton instance per namespace", () => {
        // Clear all existing instances
        PersistentStorage.instances = new Map();
        const a = PersistentStorage.get({ namespace: "a" });
        PersistentStorage.instances.size.should.equal(1);
        const b = PersistentStorage.get({ namespace: "a" });
        PersistentStorage.instances.size.should.equal(1);
        a.should.equal(b);
        PersistentStorage.instances = new Map();
      });

      it("throws on conflicting ttlMs or memory settings", () => {
        PersistentStorage.instances = new Map();
        PersistentStorage.get({ namespace: "conflict", ttlMs: 10 });
        expect(() =>
          PersistentStorage.get({ namespace: "conflict", ttlMs: 20 }),
        ).to.throw(`Conflicting ttlMs`);

        expect(() =>
          PersistentStorage.get({
            namespace: "conflict",
            ttlMs: 10,
            memory: false,
          }),
        ).to.throw(`Conflicting memory`);
      });
    });

    describe("constructor", () => {
      it("requires a namespace", () => {
        expect(() => new PersistentStorage()).to.throw(/namespace/);
      });

      it("initializes localforage with computed storeName", () => {
        const s = new PersistentStorage({
          namespace: "demo",
          schemaVersion: 3,
        });
        s.lf.should.equal(state.store);
        state.store._config.storeName.should.equal("demo_v3");
      });
    });

    describe("locks and TTLs", () => {
      it("serializes operations for the same key", async () => {
        const s = new PersistentStorage({ namespace: "locks" });
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

      it("detects expired records", () => {
        const s = new PersistentStorage({ namespace: "ttl", ttlMs: 10 });
        const record = { updatedAt: Date.now() - 20, ttlMs: 10 };
        s.isExpired(record).should.equal(true);
      });
    });

    describe("getRecord/getItem", () => {
      it("returns cached record from memory when valid", async () => {
        const s = new PersistentStorage({ namespace: "memory", ttlMs: 1000 });
        const record = { value: "x", updatedAt: Date.now(), ttlMs: 1000 };
        s.memoryCache.set("k", record);

        const loaded = await s.getRecord("k");
        loaded.should.equal(record);
      });

      it("removes expired records and returns null", async () => {
        const s = new PersistentStorage({ namespace: "expired", ttlMs: 1 });
        const record = { value: "x", updatedAt: Date.now() - 100, ttlMs: 1 };
        state.map.set("k", record);
        state.sandbox.stub(s, "removeItem").resolves();

        const loaded = await s.getRecord("k");
        expect(loaded).to.equal(null);
        s.removeItem.calledOnceWith("k").should.be.true;
      });

      it("returns stored values via getItem", async () => {
        const s = new PersistentStorage({ namespace: "get-item" });
        state.map.set("k", PersistentStorage.encodeRecord("y", null));

        const value = await s.getItem("k");
        value.should.equal("y");
      });
    });

    describe("setItem/removeItem", () => {
      it("stores values and updates memory", async () => {
        const s = new PersistentStorage({ namespace: "set-item" });

        await s.setItem("k", "value");
        state.store.setItem.calledOnce.should.be.true;
        s.memoryCache.get("k").value.should.equal("value");
      });

      it("clears and retries on quota errors", async () => {
        const s = new PersistentStorage({ namespace: "quota" });
        const err = new Error("QuotaExceededError");
        state.store.setItem.onCall(0).rejects(err);
        state.store.setItem.onCall(1).resolves();
        state.sandbox.stub(s, "clear").resolves();

        await s.setItem("k", "value");

        s.clear.calledOnce.should.be.true;
        state.store.setItem.callCount.should.equal(2);
      });

      it("does not throw on removeItem failures", async () => {
        const s = new PersistentStorage({ namespace: "remove" });
        state.store.removeItem.rejects(new Error("fail"));

        await s.removeItem("k");
        state.store.removeItem.calledOnce.should.be.true;
      });
    });

    describe("clear/clearExpired", () => {
      it("clears cache, locks, and storage", async () => {
        const s = new PersistentStorage({ namespace: "clear" });
        s.memoryCache.set("k", { value: "v" });
        s.locks.set("k", Promise.resolve());

        await s.clear();
        s.memoryCache.size.should.equal(0);
        s.locks.size.should.equal(0);
        state.store.clear.calledOnce.should.be.true;
      });

      it("removes expired entries", async () => {
        const s = new PersistentStorage({
          namespace: "clear-expired",
          ttlMs: 5,
        });
        const now = Date.now();
        state.map.set("fresh", PersistentStorage.encodeRecord("ok", null));
        state.map.set("stale", PersistentStorage.encodeRecord("old", 5));
        state.map.get("fresh").updatedAt = now;
        state.map.get("stale").updatedAt = now - 10;

        const removed = await s.clearExpired();
        removed.should.deep.equal(["stale"]);
        state.map.has("stale").should.equal(false);
      });
    });

    describe("key helpers", () => {
      it("hasKey returns true when a key exists", async () => {
        const s = new PersistentStorage({ namespace: "has-key" });
        state.map.set("k", PersistentStorage.encodeRecord("v", null));

        const exists = await s.hasKey("k");
        exists.should.equal(true);
      });

      it("returns keys and length", async () => {
        const s = new PersistentStorage({ namespace: "keys" });
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
