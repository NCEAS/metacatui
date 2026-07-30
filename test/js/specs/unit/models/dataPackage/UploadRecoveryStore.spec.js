define([
  "/test/js/specs/shared/clean-state.js",
  "models/PersistentStorage",
  "models/dataPackage/UploadRecoveryStore",
], (cleanState, PersistentStorage, UploadRecoveryStore) => {
  const should = chai.should();

  const state = cleanState(() => {
    const sandbox = sinon.createSandbox();
    const storage = {
      setItem: sandbox.stub().resolves(),
      getItem: sandbox.stub().resolves(null),
      removeItem: sandbox.stub().resolves(),
    };
    return { sandbox, storage };
  }, beforeEach);

  afterEach(() => state.sandbox.restore());

  describe("UploadRecoveryStore", () => {
    it("uses PersistentStorage with IndexedDB-only recovery settings", () => {
      const getStorage = state.sandbox
        .stub(PersistentStorage, "get")
        .returns(state.storage);

      new UploadRecoveryStore({ baseUrl: "https://example.org/metacat/" });

      getStorage.calledOnce.should.equal(true);
      const options = getStorage.firstCall.args[0];
      should.equal(options.ttlMs, null);
      options.memory.should.equal(false);
      options.localforageConfig.should.deep.equal({
        driver: "asyncStorage",
      });
    });

    it("stores the record without adding version metadata", async () => {
      const store = new UploadRecoveryStore({ storage: state.storage });

      await store.save("meta.1", { rmPid: "rm.1" });

      state.storage.setItem.calledOnce.should.equal(true);
      const [key, stored, options] = state.storage.setItem.firstCall.args;
      key.should.equal("meta.1");
      stored.should.deep.equal({ metadataPid: "meta.1", rmPid: "rm.1" });
      should.equal(options.ttlMs, null);
    });

    it("retries a failed record read once", async () => {
      const record = { metadataPid: "meta.1", rmPid: "rm.1" };
      state.storage.getItem.onFirstCall().rejects(new Error("unavailable"));
      state.storage.getItem.onSecondCall().resolves(record);
      const store = new UploadRecoveryStore({ storage: state.storage });

      const result = await store.get("meta.1");

      result.should.deep.equal(record);
      state.storage.getItem.calledTwice.should.equal(true);
    });

    it("returns null when both record reads fail", async () => {
      state.storage.getItem.rejects(new Error("unavailable"));
      const store = new UploadRecoveryStore({ storage: state.storage });

      const result = await store.get("meta.1");

      should.equal(result, null);
      state.storage.getItem.calledTwice.should.equal(true);
    });
  });
});
