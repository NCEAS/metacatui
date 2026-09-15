define([
  "backbone",
  "models/dataONEServices/ObjectLocationResolver",
  "models/sysmeta/SystemMetadata",
], (Backbone, ObjectLocationResolver, SystemMetadata) => {
  chai.should();
  const { expect } = chai;

  describe("ObjectLocationResolver", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("returns the authoritative MN before completed registered replicas", async () => {
      const sysMetaService = {
        download: sandbox.stub().resolves(
          new SystemMetadata({
            identifier: "private.1",
            authoritativeMemberNode: "urn:node:AUTH",
            accessPolicy: [{ subjects: ["uid=test"], permissions: ["read"] }],
            replicas: [
              {
                replicaMemberNode: "urn:node:FAILED",
                replicationStatus: "failed",
                replicaVerified: "2026-09-15T12:00:00Z",
              },
              {
                replicaMemberNode: "urn:node:REPLICA",
                replicationStatus: "completed",
                replicaVerified: "2026-09-15T12:00:00Z",
              },
              {
                replicaMemberNode: "urn:node:AUTH",
                replicationStatus: "completed",
                replicaVerified: "2026-09-15T12:00:00Z",
              },
            ],
          }),
        ),
      };
      const members = {
        "urn:node:AUTH": {
          identifier: "urn:node:AUTH",
          readv2: 1,
          baseURL: "https://auth.example.org/metacat/d1/mn",
        },
        "urn:node:REPLICA": {
          identifier: "urn:node:REPLICA",
          readv2: 1,
          baseURL: "https://replica.example.org/metacat/d1/mn",
        },
      };
      const nodeModel = new Backbone.Model({ checked: true, error: false });
      nodeModel.getMember = (id) => members[id] || false;
      const resolver = new ObjectLocationResolver({
        sysMetaService,
        getNodeModel: async () => nodeModel,
        getMemberNodeApis: (baseURL) => ({
          objectServiceUrl: `${baseURL}/v2/object/`,
        }),
      });

      const result = await resolver.locate("private.1");

      result.should.deep.equal({
        objectServiceUrls: [
          "https://auth.example.org/metacat/d1/mn/v2/object",
          "https://replica.example.org/metacat/d1/mn/v2/object",
        ],
        isPublic: false,
      });
      sinon.assert.calledOnceWithExactly(sysMetaService.download, "private.1", {
        signal: undefined,
      });
    });

    it("does not return unregistered, unreadable, or failed replica URLs", async () => {
      const sysMetaService = {
        download: sandbox.stub().resolves(
          new SystemMetadata({
            identifier: "public.1",
            authoritativeMemberNode: "urn:node:UNREGISTERED",
            accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
            replicas: [
              {
                replicaMemberNode: "urn:node:V1",
                replicationStatus: "completed",
                replicaVerified: "2026-09-15T12:00:00Z",
              },
            ],
          }),
        ),
      };
      const nodeModel = new Backbone.Model({ checked: true, error: false });
      nodeModel.getMember = (id) =>
        id === "urn:node:V1"
          ? {
              identifier: id,
              readv2: 0,
              baseURL: "https://v1.example.org/metacat/d1/mn",
            }
          : false;
      const resolver = new ObjectLocationResolver({
        sysMetaService,
        getNodeModel: async () => nodeModel,
        getMemberNodeApis: sandbox.stub(),
      });

      const result = await resolver.locate("public.1");

      result.should.deep.equal({ objectServiceUrls: [], isPublic: true });
      sinon.assert.notCalled(resolver.getMemberNodeApis);
    });

    it("waits for the node registry before mapping locations", async () => {
      const nodeModel = new Backbone.Model({ checked: false, error: false });
      nodeModel.getMember = () => ({
        readv2: 1,
        baseURL: "https://mn.example.org/metacat/d1/mn",
      });
      const resolver = new ObjectLocationResolver({
        sysMetaService: {
          download: sandbox.stub().resolves(
            new SystemMetadata({
              identifier: "private.1",
              authoritativeMemberNode: "urn:node:MN",
            }),
          ),
        },
        getNodeModel: async () => nodeModel,
        getMemberNodeApis: () => ({
          objectServiceUrl: "https://mn.example.org/metacat/d1/mn/v2/object/",
        }),
      });

      const pending = resolver.locate("private.1");
      await Promise.resolve();
      await Promise.resolve();
      nodeModel.set("checked", true);

      const result = await pending;
      result.objectServiceUrls.should.deep.equal([
        "https://mn.example.org/metacat/d1/mn/v2/object",
      ]);
    });

    it("stops waiting when location lookup is aborted", async () => {
      const nodeModel = new Backbone.Model({ checked: false, error: false });
      const controller = new AbortController();
      const resolver = new ObjectLocationResolver({
        sysMetaService: {
          download: sandbox.stub().resolves(
            new SystemMetadata({
              identifier: "private.1",
              authoritativeMemberNode: "urn:node:MN",
            }),
          ),
        },
        getNodeModel: async () => nodeModel,
      });

      const pending = resolver.locate("private.1", {
        signal: controller.signal,
      });
      await Promise.resolve();
      await Promise.resolve();
      controller.abort("cancelled");

      const error = await pending.then(
        () => new Error("expected rejection"),
        (reason) => reason,
      );
      error.name.should.equal("AbortError");
    });

    it("stops waiting when the node registry load is aborted", async () => {
      let resolveNodeModel;
      const nodeModelPromise = new Promise((resolve) => {
        resolveNodeModel = resolve;
      });
      const nodeModel = new Backbone.Model({ checked: false, error: false });
      const controller = new AbortController();
      const resolver = new ObjectLocationResolver({
        sysMetaService: {
          download: sandbox.stub().resolves(
            new SystemMetadata({
              identifier: "private.1",
              authoritativeMemberNode: "urn:node:MN",
            }),
          ),
        },
        getNodeModel: () => nodeModelPromise,
      });

      const pending = resolver.locate("private.1", {
        signal: controller.signal,
      });
      await Promise.resolve();
      controller.abort("cancelled");
      resolveNodeModel(nodeModel);

      const error = await Promise.race([
        pending.then(
          () => new Error("expected rejection"),
          (reason) => reason,
        ),
        new Promise((resolve) =>
          setTimeout(
            () => resolve(new Error("timed out waiting for abort")),
            50,
          ),
        ),
      ]);
      nodeModel.set("checked", true);
      error.name.should.equal("AbortError");
    });
  });
});
