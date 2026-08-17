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

    it("retries a failed record read once", async () => {
      const record = {
        metadataPid: "meta.1",
        rmPid: "rm.1",
        rmXml: "<rdf:RDF></rdf:RDF>",
        rmSysMetaXml: "<d1:systemMetadata></d1:systemMetadata>",
      };
      state.storage.getItem.onFirstCall().rejects(new Error("unavailable"));
      state.storage.getItem.onSecondCall().resolves(record);
      const store = new UploadRecoveryStore({ storage: state.storage });

      const result = await store.get("meta.1");

      result.should.deep.equal(record);
      state.storage.getItem.calledTwice.should.equal(true);
    });

    it("returns no record after the retry also fails", async () => {
      state.storage.getItem.onFirstCall().rejects(new Error("first failure"));
      state.storage.getItem.onSecondCall().rejects(new Error("second failure"));
      const store = new UploadRecoveryStore({ storage: state.storage });

      const result = await store.get("meta.1");

      should.equal(result, null);
      state.storage.getItem.calledTwice.should.equal(true);
    });
  });
});
