define([
  "/test/js/specs/shared/clean-state.js",
  "models/sysmeta/VersionStorage",
  "localforage",
], (cleanState, VersionStorage, localforage) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("VersionStorage Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const cnId = `cn-${Math.random().toString(36).slice(2)}`;
      const vs = new VersionStorage({
        cnId,
        ttlMs: 1000,
      });
      return { sandbox, vs, cnId };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      // Clear the singleton instance map to ensure fresh state for other tests
      VersionStorage.instances.clear();
      return localforage.clear();
    });

    describe("Instantiation", () => {
      it("throws when cnId is missing", () => {
        expect(() => {
          new VersionStorage();
        }).to.throw("Coordinating node ID is required");
      });

      it("creates a store name derived from cnId and schemaVersion", () => {
        const vs = new VersionStorage({ cnId: "CN-TEST", schemaVersion: 2 });
        vs.lf._config.storeName.should.equal(
          VersionStorage.createStoreName("CN-TEST", 2),
        );
      });

      it("implements singleton pattern via get()", () => {
        const opts = { cnId: "singleton-test" };
        const instance1 = VersionStorage.get(opts);
        const instance2 = VersionStorage.get(opts);
        const instance3 = VersionStorage.get({ cnId: "other-cn" });

        instance1.should.equal(instance2);
        instance1.should.not.equal(instance3);
      });
    });

    describe("Record lifecycle", () => {
      it("stamps updatedAt on save", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 1234 });
        const saved = await state.vs.saveRecord("pid1", { prev: "old" });
        saved.updatedAt.should.equal(1234);

        const fetched = await state.vs.getRecord("pid1");
        fetched.updatedAt.should.equal(1234);
        fetched.id.should.equal("pid1");

        clock.restore();
      });

      it("expires records after TTL and removes them", async () => {
        const clock = state.sandbox.useFakeTimers({ now: 0 });
        await state.vs.saveRecord("expire-me", { prev: "x" });

        // Advance time past TTL (1000ms)
        clock.tick(1001);

        const rec = await state.vs.getRecord("expire-me");
        should.not.exist(rec);

        // Verify it was removed from storage
        const raw = await state.vs.lf.getItem("expire-me");
        should.not.exist(raw);

        clock.restore();
      });

      it("merges fields safely when upserting concurrently", async () => {
        const id = "merge-test";
        // Simulate concurrent upserts
        await Promise.all([
          state.vs.upsertRecord(id, { prev: "older" }),
          state.vs.upsertRecord(id, { next: "newer" }),
        ]);

        const rec = await state.vs.getRecord(id);
        rec.prev.should.equal("older");
        rec.next.should.equal("newer");

        // Verify lock cleanup
        state.vs.locks.has(id).should.be.false;
      });

      it("handles quota errors by clearing and retrying", async () => {
        const id = "quota-test";
        const record = { foo: "bar" };

        // Spy on clearAll
        await state.vs.lf.ready();
        const clearSpy = state.sandbox.spy(state.vs, "clearAll");

        // Stub setItem to fail once with quota error, then succeed
        const setItemStub = state.sandbox.stub(state.vs.lf, "setItem");
        setItemStub.onFirstCall().rejects(new Error("QuotaExceededError"));
        setItemStub.onSecondCall().resolves("ok!");

        await state.vs.saveRecord(id, record);

        clearSpy.calledOnce.should.be.true;
        setItemStub.calledTwice.should.be.true;
      });
    });

    describe("Chain Management", () => {
      it("addVersions updates neighbors and returns saved records", async () => {
        const results = await state.vs.addVersions({
          id: "center",
          prev: "older",
          next: "newer",
        });

        results.should.have.length(3);

        const center = await state.vs.getRecord("center");
        center.prev.should.equal("older");
        center.next.should.equal("newer");

        const older = await state.vs.getRecord("older");
        older.next.should.equal("center");

        const newer = await state.vs.getRecord("newer");
        newer.prev.should.equal("center");
      });

      it("getAllNeighbours walks the chain in either direction", async () => {
        // Chain: a -> b -> c
        await state.vs.saveRecord("a", { next: "b" });
        await state.vs.saveRecord("b", { prev: "a", next: "c" });
        await state.vs.saveRecord("c", { prev: "b" });

        const next = await state.vs.getAllNeighbours("a", "next");
        next.should.deep.equal(["b", "c"]);

        const prev = await state.vs.getAllNeighbours("c", "prev");
        prev.should.deep.equal(["b", "a"]);
      });

      it("getChain assembles the full version chain", async () => {
        // Chain: v1 -> v2 -> v3 (start) -> v4 -> v5
        await state.vs.addVersions({ id: "v2", prev: "v1", next: "v3" });
        await state.vs.addVersions({ id: "v3", prev: "v2", next: "v4" });
        await state.vs.addVersions({ id: "v4", prev: "v3", next: "v5" });

        // Ensure v1 and v5 exist as endpoints
        await state.vs.upsertRecord("v1", { next: "v2" });
        await state.vs.upsertRecord("v5", { prev: "v4" });

        const chain = await state.vs.getChain("v3");

        chain.id.should.equal("v3");
        chain.prev.should.deep.equal(["v2", "v1"]);
        chain.next.should.deep.equal(["v4", "v5"]);
        chain.head.should.equal("v5");
        chain.tail.should.equal("v1");
      });

      it("getChain handles single node chains", async () => {
        await state.vs.saveRecord("solo", {});
        const chain = await state.vs.getChain("solo");
        console.log(chain);

        chain.id.should.equal("solo");
        chain.prev.should.be.empty;
        chain.next.should.be.empty;
        chain.head.should.equal("solo");
        chain.tail.should.equal("solo");
      });
    });

    describe("Helpers", () => {
      it("detects quota errors case-insensitively", () => {
        VersionStorage.isQuotaError("QuotaExceededError").should.be.true;
        VersionStorage.isQuotaError("quota exceeded somewhere").should.be.true;
        VersionStorage.isQuotaError("other error").should.be.false;
      });

      it("getNeighbour returns null for missing neighbour", async () => {
        await state.vs.saveRecord("lonely", {});
        const n = await state.vs.getNeighbour("lonely", "next");
        should.not.exist(n);
      });
    });
  });
});
