"use strict";

/**
 * End to end workflow tests for the DataPackage model and its "collaborators"
 * (ResourceMap, DataPackageMember, ResourceMapResolver, the DataONE services).
 *
 * Unlike the per method unit specs, these exercise whole user workflows through
 * the real public API, mocking only the network boundary:
 *
 *   - ResourceMapResolver.prototype.resolve / getSysMeta  (package resolution)
 *   - ObjectService.prototype.download                    (ResourceMap bytes)
 *   - SysMetaService.prototype.download                   (member sysmeta, load)
 *   - QueryService.queryWithFetch                         (index manifest)
 *   - injected objectService / sysMetaService / versionTracker /
 *     authorizationService / identifierService            (save path)
 *
 * Everything else (resolution dispatch, ResourceMap parsing + summary,
 * membership reconciliation, action preparation, phase execution, retry, and
 * draft/clean bookkeeping) runs for real. No live server is required.
 */
define([
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/shared/concurrency-tracker.js",
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageRecovery",
  "models/dataPackage/UploadRecoveryStore",
  "models/dataPackage/UploadResult",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapResolver",
  "models/sysmeta/SystemMetadata",
  "models/dataONEServices/ObjectService",
  "models/dataONEServices/SysMetaService",
  "common/QueryService",
], (
  cleanState,
  trackConcurrency,
  DataPackage,
  DataPackageRecovery,
  UploadRecoveryStore,
  UploadResult,
  RDFGraph,
  ResourceMap,
  ResourceMapResolver,
  SystemMetadata,
  ObjectService,
  SysMetaService,
  QueryService,
) => {
  const should = chai.should();
  const { expect } = chai;

  const RESOURCE_MAP_FORMAT_ID = "http://www.openarchives.org/ore/terms";
  const EML_FORMAT_ID = "https://eml.ecoinformatics.org/eml-2.2.0";
  const RESOLVE_BASE = "https://cn.test.dataone.org/cn/v2/resolve";
  const OBJECT_BASE = "https://mn.test.dataone.org/mn/v2/object";

  const state = cleanState(() => {
    const sandbox = sinon.createSandbox();
    return { sandbox, idCounter: 0 };
  }, beforeEach);

  afterEach(() => state.sandbox.restore());

  // --------------------------------------------------------------------------
  // Fixtures
  // --------------------------------------------------------------------------

  /**
   * Build an HTTP style error carrying a status code.
   * @param {number} status HTTP status
   * @param {string} [message] Error message
   * @returns {Error} Error with `status`
   */
  function httpError(status, message = "error") {
    return Object.assign(new Error(message), { status });
  }

  /**
   * Build a real ResourceMap with the given membership and documentation links.
   * @param {object} [options] ResourceMap options
   * @returns {ResourceMap} A parsed, in memory ResourceMap
   */
  function makeResourceMap({
    pid = "resource_map_1",
    memberPids = ["meta.1", "data.1"],
    links = [{ metadataPid: "meta.1", dataPid: "data.1" }],
  } = {}) {
    return ResourceMap.create({
      resourceMapPid: pid,
      resolveServiceUrl: RESOLVE_BASE,
      memberPids,
      documentationLinks: links,
    });
  }

  /**
   * Build recovery with the configured services required by ResourceMap import.
   * @param {object} options Recovery collaborators
   * @returns {DataPackageRecovery} Configured recovery service
   */
  function makeRecovery(options) {
    return new DataPackageRecovery({
      resolveServiceUrl: RESOLVE_BASE,
      objectServiceUrl: OBJECT_BASE,
      ...options,
    });
  }

  /**
   * Build a SystemMetadata model for a member PID.
   * @param {string} pid Member PID
   * @param {object} [values] Overrides
   * @returns {SystemMetadata} System metadata model
   */
  function systemMetadata(pid, { formatId = "text/csv", ...rest } = {}) {
    return new SystemMetadata({
      identifier: pid,
      formatId,
      size: 4,
      checksum: "checksum",
      checksumAlgorithm: "MD5",
      submitter: "uid=test",
      rightsHolder: "uid=test",
      accessPolicy: [],
      ...rest,
    });
  }

  /**
   * Wrap docs as a parseable Solr response envelope.
   * @param {object[]} docs Index documents
   * @returns {object} Solr response
   */
  function solrResponse(docs) {
    return { response: { numFound: docs.length, docs } };
  }

  /**
   * Build a resolver result of the shape resolveFromPid consumes.
   * @param {object} options Resolver result inputs
   * @returns {object} Resolver result
   */
  function resolverResult({ pid, rm, formatType, indexMatch, extra = {} }) {
    const meta = {
      formatType,
      isData: formatType === "DATA",
      isMetadata: formatType === "METADATA",
      isResourceMap: formatType === "RESOURCE",
    };
    if (indexMatch) meta.indexMatch = { id: pid, ...indexMatch };
    return {
      success: Boolean(rm),
      pid,
      ...(rm ? { rm } : {}),
      meta,
      ...extra,
    };
  }

  /**
   * Stub the viewer/load network boundary. Only the four real I/O calls are
   * replaced; resolution, ResourceMap parsing, and membership all run.
   * @param {object} options Network fixtures
   * @returns {object} The created stubs
   */
  function stubNetwork({
    resolve,
    getSysMeta = async () => null,
    resourceMapXmlByPid = {},
    sysMetaByPid = {},
    indexDocs = [],
  }) {
    const resolveStub = state.sandbox
      .stub(ResourceMapResolver.prototype, "resolve")
      .callsFake(async () => resolve);
    const getSysMetaStub = state.sandbox
      .stub(ResourceMapResolver.prototype, "getSysMeta")
      .callsFake(getSysMeta);
    const downloadStub = state.sandbox
      .stub(ObjectService.prototype, "download")
      .callsFake(async (pid) => {
        if (resourceMapXmlByPid[pid] != null) {
          return new Blob([resourceMapXmlByPid[pid]], {
            type: "application/xml",
          });
        }
        throw httpError(404, `no object for ${pid}`);
      });
    const sysMetaStub = state.sandbox
      .stub(SysMetaService.prototype, "download")
      .callsFake(async (pid) => {
        if (sysMetaByPid[pid]) return sysMetaByPid[pid];
        throw httpError(404, `no sysmeta for ${pid}`);
      });
    const indexStub = state.sandbox
      .stub(QueryService, "queryWithFetch")
      .resolves(solrResponse(indexDocs));
    return {
      resolveStub,
      getSysMetaStub,
      downloadStub,
      sysMetaStub,
      indexStub,
    };
  }

  /**
   * Build a fresh set of injected save path services backed by sinon stubs.
   * @param {object} [overrides] Service overrides
   * @returns {object} Service bag for the DataPackage constructor
   */
  function saveServices(overrides = {}) {
    return {
      objectService: overrides.objectService || {
        create: state.sandbox
          .stub()
          .callsFake(async ({ pid }) => ({ data: { identifier: pid } })),
        update: state.sandbox
          .stub()
          .callsFake(async ({ newPid }) => ({ data: { identifier: newPid } })),
      },
      sysMetaService: overrides.sysMetaService || {
        update: state.sandbox.stub().resolves({ data: "" }),
        invalidate: state.sandbox.stub().resolves(),
        download: state.sandbox.stub().callsFake(async (pid) =>
          systemMetadata(pid, {
            formatId:
              pid.startsWith("resource_map") || pid.startsWith("rm.")
                ? RESOURCE_MAP_FORMAT_ID
                : pid.startsWith("meta.")
                  ? EML_FORMAT_ID
                  : "text/csv",
          }),
        ),
      },
      versionTracker: overrides.versionTracker || {
        getSysMeta: state.sandbox.stub().callsFake(async (pid) =>
          systemMetadata(pid, {
            formatId:
              pid.startsWith("resource_map") || pid.startsWith("rm.")
                ? RESOURCE_MAP_FORMAT_ID
                : pid.startsWith("meta.")
                  ? EML_FORMAT_ID
                  : "text/csv",
          }),
        ),
      },
      authorizationService: overrides.authorizationService || {
        checkAll: state.sandbox
          .stub()
          .callsFake(async (pids) =>
            Object.fromEntries(pids.map((pid) => [pid, true])),
          ),
      },
      identifierService: overrides.identifierService || {
        generateIdentifier: state.sandbox.stub().callsFake(async () => {
          state.idCounter += 1;
          return { data: { identifier: `urn:uuid:gen.${state.idCounter}` } };
        }),
        reserveIdentifier: state.sandbox
          .stub()
          .callsFake(async (pid) => ({ data: { identifier: pid } })),
      },
    };
  }

  /**
   * Build a NEW (never uploaded) editable package: one metadata doc, one data
   * file, and a fresh ResourceMap, all pending creation.
   * @param {object} [options] Options
   * @returns {object} The package and its members
   */
  function newEditablePackage({ resourceMapPid = "resource_map_new" } = {}) {
    const rm = makeResourceMap({
      pid: resourceMapPid,
      memberPids: ["meta.new", "data.new"],
      links: [{ metadataPid: "meta.new", dataPid: "data.new" }],
    });
    const services = saveServices();
    const pkg = new DataPackage({
      members: [
        {
          pid: resourceMapPid,
          formatType: "RESOURCE",
          formatId: RESOURCE_MAP_FORMAT_ID,
          objectModel: rm,
        },
        {
          pid: "meta.new",
          formatType: "METADATA",
          formatId: EML_FORMAT_ID,
          fileName: "metadata.xml",
          documents: ["data.new"],
          contentDirty: true,
          objectModel: { serialize: () => "<eml/>" },
        },
        {
          pid: "data.new",
          formatType: "DATA",
          formatId: "text/csv",
          isDocumentedBy: ["meta.new"],
        },
      ],
      ...services,
    });
    pkg.rootResourceMapPid = resourceMapPid;
    pkg.uploadDefaults = { submitter: "uid=test", rightsHolder: "uid=test" };
    pkg.getMember("data.new").setLocalFile(new Blob(["bytes"]));
    return { pkg, rm, services };
  }

  /**
   * Load an existing package through the real loadEditablePackage workflow,
   * mocking only the network. The returned package has injected save services
   * so it can be edited and uploaded.
   * @param {object} [options] Options
   * @returns {Promise<object>} The package and the resolved fixtures
   */
  async function loadExistingPackage({
    memberPids = ["meta.1", "data.1"],
    // Real documenting metadata also documents itself; include the self-link so
    // ResourceMap-authored save preparation does not spuriously dirty the graph.
    links = [
      { metadataPid: "meta.1", dataPid: "meta.1" },
      { metadataPid: "meta.1", dataPid: "data.1" },
    ],
    extraIndexDocs = [],
  } = {}) {
    const rm = makeResourceMap({ memberPids, links });
    const network = stubNetwork({
      resolve: resolverResult({
        pid: "meta.1",
        rm: "resource_map_1",
        formatType: "METADATA",
        indexMatch: { formatId: EML_FORMAT_ID, formatType: "METADATA" },
      }),
      resourceMapXmlByPid: {
        resource_map_1: rm.serialize({ validate: false }),
      },
      sysMetaByPid: {
        resource_map_1: systemMetadata("resource_map_1", {
          formatId: RESOURCE_MAP_FORMAT_ID,
        }),
        "meta.1": systemMetadata("meta.1", { formatId: EML_FORMAT_ID }),
      },
      indexDocs: [
        { id: "meta.1", formatId: EML_FORMAT_ID, formatType: "METADATA" },
        { id: "data.1", formatId: "text/csv", formatType: "DATA" },
        ...extraIndexDocs,
      ],
    });
    const services = saveServices();
    const pkg = new DataPackage(services);
    await pkg.loadEditablePackage("meta.1");
    return { pkg, rm, services, network };
  }

  describe("DataPackage workflows: editable Resource Map preflight", () => {
    it("uses the configured MN endpoint to block contradictory member identity", async () => {
      const appModel = globalThis.MetacatUI?.appModel;
      const originalGet = appModel.get;
      state.sandbox.stub(appModel, "get").callsFake(function get(key) {
        if (key === "resolveServiceUrl") return RESOLVE_BASE;
        if (key === "objectServiceUrl") return OBJECT_BASE;
        return originalGet.call(this, key);
      });

      const rm = makeResourceMap({
        memberPids: ["meta.1"],
        links: [],
      });
      const configuredObjectUri = `${OBJECT_BASE}/different.1`;
      rm.mutateGraph(
        () =>
          rm.graph.replaceNodeValues(
            new Map([[rm.pidToUri("meta.1"), configuredObjectUri]]),
          ),
        { markDirty: false },
      );
      const xml = rm.serialize({ validate: false });

      // Without objectServiceUrl this is merely an arbitrary absolute URI.
      // The real loading path below must pass the configured MN service for
      // its contradictory endpoint claim to become visible.
      const withoutObjectService = ResourceMap.fromXml("resource_map_1", xml, {
        resolveServiceUrl: RESOLVE_BASE,
      });
      withoutObjectService
        .getEditBlockers()
        .map(({ code }) => code)
        .should.not.include("memberIdentifierMismatch");

      stubNetwork({
        resolve: resolverResult({
          pid: "meta.1",
          rm: "resource_map_1",
          formatType: "METADATA",
          indexMatch: { formatId: EML_FORMAT_ID, formatType: "METADATA" },
        }),
        resourceMapXmlByPid: { resource_map_1: xml },
      });
      const pkg = new DataPackage();

      let error = null;
      try {
        await pkg.loadEditablePackage("meta.1");
      } catch (caught) {
        error = caught;
      }

      should.exist(error);
      error.code.should.equal("resource_map_not_editable");
      error.issues
        .map(({ code }) => code)
        .should.include("memberIdentifierMismatch");
      pkg.members
        .getFromSource("resourceMap")
        .map(({ pid }) => pid)
        .should.not.include("meta.1");
    });
  });

  // --------------------------------------------------------------------------
  // Viewer workflows
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: viewer", () => {
    it("assembles a package from a metadata input", async () => {
      const rm = makeResourceMap();
      stubNetwork({
        resolve: resolverResult({
          pid: "meta.1",
          rm: "resource_map_1",
          formatType: "METADATA",
          indexMatch: {
            formatId: EML_FORMAT_ID,
            formatType: "METADATA",
            title: "Workflow dataset",
          },
        }),
        resourceMapXmlByPid: {
          resource_map_1: rm.serialize({ validate: false }),
        },
        indexDocs: [
          { id: "meta.1", formatId: EML_FORMAT_ID, formatType: "METADATA" },
          { id: "data.1", formatId: "text/csv", formatType: "DATA" },
        ],
      });
      const pkg = new DataPackage();

      const result = await pkg.resolveFromPid("meta.1");
      result.isMetadata.should.equal(true);
      const rmResult = await pkg.getManifestFromResourceMap({ merge: true });
      rmResult.ok.should.equal(true);
      await pkg.getManifestFromIndex({ merge: true });

      pkg.getRootResourceMapMember().pid.should.equal("resource_map_1");
      pkg.getPrimaryMetadataMember().pid.should.equal("meta.1");
      pkg
        .getData()
        .map((member) => member.pid)
        .should.deep.equal(["data.1"]);
      pkg
        .toArray()
        .map((member) => member.pid)
        .should.have.members(["resource_map_1", "meta.1", "data.1"]);
    });

    it("finds documenting metadata from a ResourceMap when the index is unavailable", async () => {
      const rm = makeResourceMap();
      const network = stubNetwork({
        resolve: resolverResult({
          pid: "data.1",
          rm: "resource_map_1",
          formatType: "DATA",
          indexMatch: {
            formatId: "text/csv",
            formatType: "DATA",
            isDocumentedBy: ["meta.1"],
          },
        }),
        resourceMapXmlByPid: {
          resource_map_1: rm.serialize({ validate: false }),
        },
      });
      network.indexStub.rejects(httpError(503, "index unavailable"));
      const pkg = new DataPackage();

      const result = await pkg.resolveFromPid("data.1");
      result.isData.should.equal(true);
      await pkg.getManifest({ index: false });

      sinon.assert.notCalled(network.indexStub);
      should.exist(pkg.getMember("data.1"));
      pkg.getPrimaryMetadataMember().pid.should.equal("meta.1");
      pkg.getRootResourceMapMember().pid.should.equal("resource_map_1");
    });

    it("resolves a ResourceMap input directly, even with an unprefixed PID", async () => {
      const bareRmPid = "urn:uuid:bare-resource-map";
      const rm = makeResourceMap({ pid: bareRmPid });
      stubNetwork({
        resolve: resolverResult({
          pid: bareRmPid,
          rm: bareRmPid,
          formatType: "RESOURCE",
          indexMatch: {
            formatId: RESOURCE_MAP_FORMAT_ID,
            formatType: "RESOURCE",
          },
        }),
        resourceMapXmlByPid: { [bareRmPid]: rm.serialize({ validate: false }) },
        indexDocs: [
          { id: "meta.1", formatId: EML_FORMAT_ID, formatType: "METADATA" },
          { id: "data.1", formatId: "text/csv", formatType: "DATA" },
        ],
      });
      const pkg = new DataPackage();

      const result = await pkg.resolveFromPid(bareRmPid);
      result.isResourceMap.should.equal(true);
      await pkg.getManifestFromResourceMap({ merge: true });
      await pkg.getManifestFromIndex({ merge: true });

      // The unprefixed PID is still recognized as the root ResourceMap by its
      // format ID, not by any naming convention.
      pkg.getRootResourceMapMember().pid.should.equal(bareRmPid);
      pkg.getPrimaryMetadataMember().pid.should.equal("meta.1");
    });

    it("preserves a nested ResourceMap member when assembling for viewing", async () => {
      const rm = makeResourceMap({
        memberPids: ["meta.1", "data.1", "nested.package.1"],
        links: [{ metadataPid: "meta.1", dataPid: "data.1" }],
      });
      stubNetwork({
        resolve: resolverResult({
          pid: "meta.1",
          rm: "resource_map_1",
          formatType: "METADATA",
          indexMatch: { formatId: EML_FORMAT_ID, formatType: "METADATA" },
        }),
        resourceMapXmlByPid: {
          resource_map_1: rm.serialize({ validate: false }),
        },
        indexDocs: [
          { id: "meta.1", formatId: EML_FORMAT_ID, formatType: "METADATA" },
          { id: "data.1", formatId: "text/csv", formatType: "DATA" },
          {
            id: "nested.package.1",
            formatId: RESOURCE_MAP_FORMAT_ID,
            formatType: "RESOURCE",
          },
        ],
      });
      const pkg = new DataPackage();

      await pkg.resolveFromPid("meta.1");
      await pkg.getManifestFromResourceMap({ merge: true });
      await pkg.getManifestFromIndex({ merge: true });

      pkg.getRootResourceMapMember().pid.should.equal("resource_map_1");
      pkg
        .getNestedResourceMapMembers()
        .map((member) => member.pid)
        .should.deep.equal(["nested.package.1"]);
    });

    it("surfaces a private input without leaking package members", async () => {
      stubNetwork({
        resolve: resolverResult({ pid: "private.1", formatType: undefined }),
        getSysMeta: async () => {
          throw httpError(401, "not authorized");
        },
      });
      const pkg = new DataPackage();

      const result = await pkg.resolveFromPid("private.1");

      result.isPrivate.should.equal(true);
      expect(pkg.getRootResourceMapMember()).to.equal(null);
      pkg.getData().should.deep.equal([]);
    });

    it("surfaces a missing input", async () => {
      stubNetwork({
        resolve: resolverResult({ pid: "missing.1", formatType: undefined }),
        getSysMeta: async () => null,
      });
      const pkg = new DataPackage();

      const result = await pkg.resolveFromPid("missing.1");

      result.notFound.should.equal(true);
      expect(pkg.getRootResourceMapMember()).to.equal(null);
    });

    it("uses the full index match count when only one page of members is returned", async () => {
      const memberPids = [
        "meta.1",
        ...Array.from({ length: 1000 }, (_, index) => `data.${index}`),
      ];
      const rm = makeResourceMap({ memberPids, links: [] });
      const network = stubNetwork({
        resolve: resolverResult({
          pid: "meta.1",
          rm: "resource_map_1",
          formatType: "METADATA",
          indexMatch: { formatId: EML_FORMAT_ID, formatType: "METADATA" },
        }),
        resourceMapXmlByPid: {
          resource_map_1: rm.serialize({ validate: false }),
        },
      });
      const broadDocs = [
        { id: "meta.1", formatId: EML_FORMAT_ID, formatType: "METADATA" },
        { id: "resource_map_1", formatType: "RESOURCE" },
        ...Array.from({ length: 998 }, (_, index) => ({
          id: `data.${index}`,
          formatType: "DATA",
        })),
      ];
      network.indexStub.resetBehavior();
      network.indexStub.resolves({
        response: { numFound: memberPids.length + 1, docs: broadDocs },
      });
      const pkg = new DataPackage();

      await pkg.resolveFromPid("meta.1");
      await pkg.getManifestFromResourceMap({ merge: true });
      await pkg.getManifestFromIndex({ merge: true, onlyExisting: true });

      pkg.members.getFromSource("index").should.have.length(1000);
      pkg.indexManifestTotal.should.equal(memberPids.length + 1);
      pkg.hasPrivateMembers().should.equal(false);
      network.indexStub.calledOnce.should.equal(true);
    });
  });

  // --------------------------------------------------------------------------
  // Existing editor: load -> edit -> save -> clean state
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: existing editor load/save", () => {
    it("loads an editable baseline from the network", async () => {
      const { pkg } = await loadExistingPackage();

      pkg.getRootResourceMapMember().pid.should.equal("resource_map_1");
      pkg.getPrimaryMetadataMember().pid.should.equal("meta.1");
      pkg
        .toArray()
        .map((member) => member.pid)
        .should.have.members(["resource_map_1", "meta.1", "data.1"]);
      // A freshly loaded package is clean and every member tracks its remote.
      pkg.draftRevision.should.equal(0);
      pkg.hasUnsavedChanges().should.equal(false);
      pkg.toArray().forEach((member) => {
        member.remotePid.should.equal(member.pid);
        member.aggregatedPid.should.equal(member.pid);
      });
      // Baseline sysmeta is loaded only for the root map and primary metadata;
      // data sysmeta stays on demand.
      should.exist(pkg.getMember("resource_map_1").remoteSysMeta);
      should.exist(pkg.getMember("meta.1").remoteSysMeta);
      expect(pkg.getMember("data.1").remoteSysMeta).to.equal(null);
    });

    it("replaces a data file and saves to a clean state, fetching the missing data sysmeta on demand", async () => {
      const { pkg, services } = await loadExistingPackage();

      // Editing a data member whose sysmeta was never loaded must lazily fetch
      // its baseline before staging the replacement.
      await pkg.replaceFile("data.1", new Blob(["updated bytes"]), {
        requestedPid: "data.2",
      });
      services.sysMetaService.download.calledWith("data.1").should.equal(true);
      pkg.hasUnsavedChanges().should.equal(true);
      pkg.draftRevision.should.equal(1);

      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      // The data object was versioned and the ResourceMap re-uploaded.
      services.objectService.update.called.should.equal(true);
      const data = pkg.getMember("data.2");
      data.remotePid.should.equal("data.2");
      data.aggregatedPid.should.equal("data.2");
      // A successful save returns the package to a clean state.
      pkg.hasUnsavedChanges().should.equal(false);
      pkg.savedRevision.should.equal(1);
    });

    it("uploads freshly serialized metadata bytes on a second save", async () => {
      const { pkg, services } = await loadExistingPackage();
      let content = "first";
      const metadataModel = {
        id: "meta.1",
        set(key, value) {
          if (key === "id") this.id = value;
        },
        serialize: ({ packageId }) =>
          `<eml packageId="${packageId}">${content}</eml>`,
        replaceMemberPid: () => 0,
      };
      pkg.getPrimaryMetadataMember().objectModel = metadataModel;

      await pkg.markMemberContentDirty("meta.1");
      const firstPid = pkg.getPrimaryMetadataMember().pid;
      await pkg.upload();
      content = "second";
      await pkg.markMemberContentDirty(firstPid);
      const secondPid = pkg.getPrimaryMetadataMember().pid;
      await pkg.upload();

      const uploadPayloads = await Promise.all(
        services.objectService.update
          .getCalls()
          .map((call) => call.args[0].object.text()),
      );
      const metadataPayloads = uploadPayloads.filter((text) =>
        text.startsWith("<eml"),
      );
      expect(metadataPayloads).to.deep.equal([
        `<eml packageId="${firstPid}">first</eml>`,
        `<eml packageId="${secondPid}">second</eml>`,
      ]);
    });

    it("rejects edits while an upload is in progress (concurrent-edit guard)", async () => {
      const { pkg } = await loadExistingPackage();
      // Simulate an in-flight upload holding the edit lock.
      pkg.activeUpload = { cancelled: false };

      pkg.isEditLocked().should.equal(true);
      let caught = null;
      try {
        await pkg.replaceFile("data.1", new Blob(["x"]), {
          requestedPid: "data.9",
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).to.be.instanceOf(Error);
      caught.message.should.match(/in progress|locked|active/i);
    });

    it("rejects a save when the user lacks write permission (authorization gap)", async () => {
      const { pkg, services } = await loadExistingPackage();
      services.authorizationService.checkAll.callsFake(async (pids) =>
        Object.fromEntries(pids.map((pid) => [pid, false])),
      );

      await pkg.replaceFile("data.1", new Blob(["updated"]), {
        requestedPid: "data.2",
      });

      let caught = null;
      try {
        await pkg.upload();
      } catch (error) {
        caught = error;
      }
      expect(caught).to.be.instanceOf(Error);
      // No object writes happen when authorization fails during preparation.
      services.objectService.create.called.should.equal(false);
      services.objectService.update.called.should.equal(false);
      pkg.hasUnsavedChanges().should.equal(true);
    });
  });

  // --------------------------------------------------------------------------
  // New editor: first save of a brand-new package
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: new editor save", () => {
    it("creates every member and the ResourceMap on first save", async () => {
      const { pkg, services } = newEditablePackage();

      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      // Metadata + data are created before the ResourceMap aggregates them.
      services.objectService.create.callCount.should.equal(3);
      pkg.toArray().forEach((member) => {
        should.exist(member.remotePid);
        member.aggregatedPid.should.equal(member.remotePid);
      });
      pkg.hasUnsavedChanges().should.equal(false);
    });

    it("allocates an unprefixed new ResourceMap PID from the identifier service", async () => {
      // Drop the local prefix fallback by letting the identifier service answer.
      const { pkg } = newEditablePackage({
        resourceMapPid: "resource_map_new",
      });

      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      // The created ResourceMap is still classified as the root map by format,
      // regardless of its PID shape.
      pkg
        .getRootResourceMapMember()
        .formatId.should.equal(RESOURCE_MAP_FORMAT_ID);
    });
  });

  // --------------------------------------------------------------------------
  // Partial member success -> ResourceMap failure -> retry
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: partial success then ResourceMap failure and retry", () => {
    it("commits members, exhausts ResourceMap retries, then retries without repeating committed writes", async () => {
      const rmFailure = httpError(502, "bad gateway");
      // The ResourceMap update fails transiently on every in-upload attempt
      // (3 = RESOURCE_MAP_WRITE_ATTEMPTS), exhausting the automatic verified
      // retry, then succeeds on the manual retryUpload (4th call).
      let rmUpdateCalls = 0;
      const services = saveServices({
        objectService: {
          create: state.sandbox
            .stub()
            .callsFake(async ({ pid }) => ({ data: { identifier: pid } })),
          update: state.sandbox.stub().callsFake(async ({ newPid }) => {
            rmUpdateCalls += 1;
            if (rmUpdateCalls <= 3) throw rmFailure;
            return { data: { identifier: newPid } };
          }),
        },
        // The 502 RM failure is ambiguous (it may have committed). Verification
        // returns 404, so the write did not commit and is safely re-attempted.
        sysMetaService: {
          update: state.sandbox.stub().resolves({ data: "" }),
          invalidate: state.sandbox.stub().resolves(),
          download: state.sandbox.stub().rejects(httpError(404, "missing")),
        },
      });
      const rm = makeResourceMap({
        pid: "resource_map_1",
        memberPids: ["meta.1", "data.new"],
        links: [
          { metadataPid: "meta.1", dataPid: "meta.1" },
          { metadataPid: "meta.1", dataPid: "data.new" },
        ],
      });
      // Existing metadata + ResourceMap (so the RM upload is an UPDATE that can
      // fail), plus one new data file that uploads successfully first.
      const pkg = new DataPackage({
        members: [
          {
            pid: "resource_map_1",
            remotePid: "resource_map_1",
            aggregatedPid: "resource_map_1",
            formatType: "RESOURCE",
            formatId: RESOURCE_MAP_FORMAT_ID,
            objectModel: rm,
          },
          {
            pid: "meta.1",
            remotePid: "meta.1",
            aggregatedPid: "meta.1",
            formatType: "METADATA",
            formatId: EML_FORMAT_ID,
            documents: ["data.new"],
          },
          {
            pid: "data.new",
            formatType: "DATA",
            formatId: "text/csv",
            isDocumentedBy: ["meta.1"],
          },
        ],
        ...services,
      });
      pkg.rootResourceMapPid = "resource_map_1";
      pkg.uploadDefaults = { submitter: "uid=test", rightsHolder: "uid=test" };
      pkg.getMember("data.new").setLocalFile(new Blob(["bytes"]));
      // Provide the existing RM's sysmeta baseline so preparation does not need
      // to download it; the only sysmeta download is the retry verification.
      pkg.getMember("resource_map_1").remoteSysMeta = systemMetadata(
        "resource_map_1",
        { formatId: RESOURCE_MAP_FORMAT_ID },
      );

      const first = await pkg.upload();
      first.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);
      // The data object committed but was never aggregated by the failed map.
      const data = pkg.getMember("data.new");
      should.exist(data.remotePid);

      const second = await pkg.retryUpload(first);

      second.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      // The committed data create is not repeated; only the ResourceMap retries
      // (3 exhausted in-upload attempts + 1 successful manual retry).
      services.objectService.create.calledOnce.should.equal(true);
      services.objectService.update.callCount.should.equal(4);
      // The successful write's sysmeta cache is invalidated.
      services.sysMetaService.invalidate.called.should.equal(true);
      pkg.hasUnsavedChanges().should.equal(false);
    });
  });

  // --------------------------------------------------------------------------
  // Durable upload recovery record (P1)
  // --------------------------------------------------------------------------

  /**
   * Build an injectable, in memory stand in for the durable recovery store,
   * with sinon stubbed methods so call order and payloads can be asserted.
   * @returns {object} Fake recovery store
   */
  function fakeRecoveryStore() {
    const records = new Map();
    return {
      save: state.sandbox.stub().callsFake(async (pid, record) => {
        records.set(pid, record);
      }),
      get: state.sandbox
        .stub()
        .callsFake(async (pid) => records.get(pid) || null),
      remove: state.sandbox.stub().callsFake(async (pid) => {
        records.delete(pid);
      }),
    };
  }

  describe("DataPackage workflows: durable upload recovery record", () => {
    it("persists a record before the first write and clears it on success", async () => {
      const { pkg, services } = newEditablePackage();
      const store = fakeRecoveryStore();
      pkg.uploadRecoveryStore = store;

      const result = await pkg.upload();
      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);

      // Written once, before any object is created...
      store.save.calledOnce.should.equal(true);
      store.save.calledBefore(services.objectService.create).should.equal(true);
      const [savedPid, savedRecord] = store.save.firstCall.args;
      savedPid.should.equal("meta.new");
      savedRecord.metadataPid.should.equal("meta.new");
      should.exist(savedRecord.rmPid);
      savedRecord.rmXml.should.be.a("string");
      savedRecord.rmXml.should.contain("meta.new");
      savedRecord.rmXml.should.contain("data.new");
      savedRecord.should.not.have.property("members");
      savedRecord.should.not.have.property("documentationLinks");
      savedRecord.should.not.have.property("provenance");
      savedRecord.should.not.have.property("rmBlob");
      savedRecord.rmSysMetaXml.should.be.a("string");
      SystemMetadata.fromXml(savedRecord.rmSysMetaXml).identifier.should.equal(
        savedRecord.rmPid,
      );
      savedRecord.should.not.have.property("verifications");
      savedRecord.should.not.have.property("version");
      // ...and cleared once the ResourceMap write is confirmed.
      store.remove.calledWith("meta.new").should.equal(true);
    });

    it("retains the record when the ResourceMap write fails", async () => {
      const { pkg, services } = newEditablePackage();
      const store = fakeRecoveryStore();
      pkg.uploadRecoveryStore = store;
      // Fail only the ResourceMap object write (its file name is the RDF/XML).
      services.objectService.create.callsFake(async ({ pid, fileName }) => {
        if (fileName && fileName.endsWith(".rdf.xml")) {
          throw httpError(400, "resource map rejected");
        }
        return { data: { identifier: pid } };
      });

      const result = await pkg.upload();
      result.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);

      // The metadata committed but the ResourceMap did not: the record must
      // survive so the orphan can be repaired later.
      store.save.calledOnce.should.equal(true);
      store.remove.called.should.equal(false);
    });
  });

  // --------------------------------------------------------------------------
  // ResourceMap write retry (P2)
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: ResourceMap write retry", () => {
    it("retries a transient ResourceMap failure once it verifies the map did not commit", async () => {
      const { pkg, services } = newEditablePackage();
      let rmAttempts = 0;
      // The ResourceMap object write (its file name is the RDF/XML) fails once
      // transiently, then succeeds; member writes always succeed.
      services.objectService.create.callsFake(async ({ pid, fileName }) => {
        if (fileName && fileName.endsWith(".rdf.xml")) {
          rmAttempts += 1;
          if (rmAttempts === 1) throw httpError(503, "temporarily unavailable");
        }
        return { data: { identifier: pid } };
      });
      // Verifying the ambiguous failure finds nothing committed (404), so the
      // retry is safe to proceed rather than duplicate a committed write.
      services.sysMetaService.download.callsFake(async () => {
        throw httpError(404, "not found");
      });

      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      rmAttempts.should.equal(2);
      pkg.hasUnsavedChanges().should.equal(false);
    });

    it("does not retry a transient member (non-ResourceMap) write", async () => {
      const { pkg, services } = newEditablePackage();
      let metaAttempts = 0;
      services.objectService.create.callsFake(async ({ pid, fileName }) => {
        if (fileName === "metadata.xml") {
          metaAttempts += 1;
          throw httpError(503, "temporarily unavailable");
        }
        return { data: { identifier: pid } };
      });
      services.sysMetaService.download.callsFake(async () => {
        throw httpError(404, "not found");
      });

      const result = await pkg.upload();

      // The metadata write is attempted once and the upload fails; only the
      // ResourceMap phase gets verified retries.
      result.outcome.should.equal(UploadResult.Outcomes.PARTIAL_FAILURE);
      metaAttempts.should.equal(1);
    });
  });

  // --------------------------------------------------------------------------
  // Orphaned metadata: crash reproduction + R1 recovery
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: orphaned metadata recovery", () => {
    it("reports resource_map_unavailable when a fresh load finds no resource map", async () => {
      // Post-crash server state: the metadata committed, but no resource map
      // exists and none can be resolved (index/storage/sysmeta/guess all miss).
      stubNetwork({
        resolve: resolverResult({
          pid: "meta.orphan",
          formatType: "METADATA",
          indexMatch: { formatId: EML_FORMAT_ID },
        }),
      });
      const pkg = new DataPackage();

      let error = null;
      try {
        await pkg.loadEditablePackage("meta.orphan");
      } catch (caught) {
        error = caught;
      }

      should.exist(error);
      error.code.should.equal("resource_map_unavailable");
    });

    it("replays the resource map from a durable record (R1), preserving the version chain", async () => {
      const concurrency = trackConcurrency();
      const rmXml = makeResourceMap({
        pid: "resource_map_2",
        memberPids: [
          "meta.orphan",
          "data.1",
          "data.2",
          "data.3",
          "data.4",
          "data.5",
        ],
        links: [{ metadataPid: "meta.orphan", dataPid: "data.1" }],
      }).serialize({ validate: false });
      const record = {
        metadataPid: "meta.orphan",
        rmPid: "resource_map_2",
        obsoletesRmPid: "resource_map_1",
        rmXml,
        rmSysMetaXml: systemMetadata("resource_map_2", {
          formatId: RESOURCE_MAP_FORMAT_ID,
          rightsHolder: "uid=resource-map-owner",
          accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
          obsoletes: "resource_map_1",
        }).serialize(),
        rmFileName: "resource_map_2.rdf.xml",
      };
      const recoveryStore = {
        get: state.sandbox.stub().resolves(record),
        remove: state.sandbox.stub().resolves(),
      };
      const objectService = {
        update: state.sandbox
          .stub()
          .resolves({ data: { identifier: "resource_map_2" } }),
        create: state.sandbox.stub().resolves({}),
      };
      const sysMetaService = {
        // Every referenced member is present on the server.
        download: state.sandbox.stub().callsFake(
          concurrency.track((pid) =>
            systemMetadata(pid, {
              rightsHolder:
                pid === "meta.orphan"
                  ? "uid=metadata-owner"
                  : "uid=member-owner",
              accessPolicy: [],
            }),
          ),
        ),
      };
      const resolver = { addToStorage: state.sandbox.stub().resolves() };
      const fromXml = state.sandbox.spy(ResourceMap, "fromXml");

      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        resolver,
        recoveryStore,
      });
      const result = await recovery.recover("meta.orphan", {
        maxConcurrent: 2,
      });

      result.recovered.should.equal(true);
      result.strategy.should.equal("replay");
      result.resourceMapPid.should.equal("resource_map_2");
      fromXml.firstCall.args[2].should.deep.equal({
        resolveServiceUrl: RESOLVE_BASE,
        objectServiceUrl: OBJECT_BASE,
      });
      // The prior map is obsoleted (chain preserved), not a standalone create.
      objectService.create.called.should.equal(false);
      objectService.update.calledOnce.should.equal(true);
      const writeArgs = objectService.update.firstCall.args[0];
      writeArgs.pid.should.equal("resource_map_1");
      writeArgs.newPid.should.equal("resource_map_2");
      writeArgs.object.should.be.instanceof(Blob);
      (await writeArgs.object.text()).should.equal(record.rmXml);
      writeArgs.sysMetaXml.should.equal(record.rmSysMetaXml);
      const replayedSysMeta = SystemMetadata.fromXml(writeArgs.sysMetaXml);
      replayedSysMeta.rightsHolder.should.equal("uid=resource-map-owner");
      replayedSysMeta.accessPolicy
        .toJSON()
        .should.deep.equal([{ subjects: ["public"], permissions: ["read"] }]);
      concurrency.max.should.equal(2);
      // The mapping is cached and the record cleared.
      resolver.addToStorage
        .calledWith("meta.orphan", "resource_map_2")
        .should.equal(true);
      recoveryStore.remove.calledWith("meta.orphan").should.equal(true);
    });

    it("treats an already-committed resource map as recovered (self-healing)", async () => {
      const rmXml = makeResourceMap({
        pid: "resource_map_2",
        memberPids: ["meta.orphan"],
        links: [],
      }).serialize({ validate: false });
      const record = {
        metadataPid: "meta.orphan",
        rmPid: "resource_map_2",
        obsoletesRmPid: "resource_map_1",
        rmXml,
        rmSysMetaXml: systemMetadata("resource_map_2", {
          formatId: RESOURCE_MAP_FORMAT_ID,
          obsoletes: "resource_map_1",
        }).serialize(),
        rmFileName: "resource_map_2.rdf.xml",
      };
      const recoveryStore = {
        get: state.sandbox.stub().resolves(record),
        remove: state.sandbox.stub().resolves(),
      };
      // The update is rejected because the map already committed on a prior
      // attempt; verification then matches its prepared identity.
      const objectService = {
        update: state.sandbox
          .stub()
          .rejects(httpError(400, "already obsolete")),
        create: state.sandbox.stub().resolves({}),
      };
      const sysMetaService = {
        download: state.sandbox.stub().callsFake(async (pid) => {
          if (pid === "resource_map_2") {
            return SystemMetadata.fromXml(
              objectService.update.firstCall.args[0].sysMetaXml,
            );
          }
          return systemMetadata(pid);
        }),
      };
      const resolver = { addToStorage: state.sandbox.stub().resolves() };

      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        resolver,
        recoveryStore,
      });
      const result = await recovery.recover("meta.orphan");

      result.recovered.should.equal(true);
      result.resourceMapPid.should.equal("resource_map_2");
      recoveryStore.remove.calledWith("meta.orphan").should.equal(true);
    });

    it("rejects unverified server-side ResourceMap candidates", async () => {
      const rmXml = makeResourceMap({
        pid: "resource_map_2",
        memberPids: ["meta.orphan"],
        links: [],
      }).serialize({ validate: false });
      const recoveryStore = {
        get: state.sandbox.stub().resolves({
          metadataPid: "meta.orphan",
          rmPid: "resource_map_2",
          obsoletesRmPid: "resource_map_1",
          rmXml,
          rmSysMetaXml: systemMetadata("resource_map_2", {
            formatId: RESOURCE_MAP_FORMAT_ID,
            obsoletes: "resource_map_1",
          }).serialize(),
        }),
        remove: state.sandbox.stub().resolves(),
      };
      const writeError = httpError(400, "already obsolete");
      const objectService = {
        update: state.sandbox.stub().rejects(writeError),
        create: state.sandbox.stub(),
      };
      const sysMetaService = {
        download: state.sandbox.stub().callsFake(async (pid) => {
          if (pid === "resource_map_2") {
            return systemMetadata(pid, {
              formatId: RESOURCE_MAP_FORMAT_ID,
              checksum: "different bytes",
              size: 1,
            });
          }
          if (pid === "resource_map_1") {
            return systemMetadata(pid, {
              formatId: RESOURCE_MAP_FORMAT_ID,
              obsoletedBy: "resource_map_other",
            });
          }
          if (pid === "resource_map_other") {
            return systemMetadata(pid, {
              formatId: RESOURCE_MAP_FORMAT_ID,
              obsoletes: "resource_map_1",
            });
          }
          return systemMetadata(pid);
        }),
      };
      const resolver = {
        verify: state.sandbox.stub().resolves(false),
        addToStorage: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        resolver,
        recoveryStore,
      });

      let error;
      try {
        await recovery.recover("meta.orphan");
      } catch (caught) {
        error = caught;
      }

      should.equal(error, writeError);
      resolver.verify
        .calledWith("resource_map_other", "meta.orphan")
        .should.equal(true);
      resolver.addToStorage.called.should.equal(false);
      recoveryStore.remove.called.should.equal(false);
    });

    it("reconstructs the resource map from the prior version when no record exists (R2)", async () => {
      const priorMap = makeResourceMap({
        pid: "resource_map_1",
        memberPids: ["meta.1", "data.1", "source.1"],
        links: [{ metadataPid: "meta.1", dataPid: "data.1" }],
      });
      priorMap.setLocation("data.1", "tables/data.csv");
      priorMap.provenance.addWasDerivedFrom("data.1", "source.1");
      const customPredicate = RDFGraph.createNamedNode(
        "https://example.org/vocab#recoveryNote",
      );
      const priorDataNode = RDFGraph.createNamedNode(
        priorMap.getNodeUriForPid("data.1"),
      );
      priorMap.mutateGraph(() => {
        priorMap.graph.addStatement({
          subject: priorDataNode,
          predicate: customPredicate,
          object: RDFGraph.createLiteral("preserve this statement"),
        });
      });
      const fromXml = state.sandbox.spy(ResourceMap, "fromXml");
      const serialize = state.sandbox.spy(ResourceMap.prototype, "serialize");
      const recoveryStore = {
        get: state.sandbox.stub().resolves(null),
        remove: state.sandbox.stub().resolves(),
      };
      const objectService = {
        update: state.sandbox.stub().resolves({ data: {} }),
        create: state.sandbox.stub().resolves({}),
      };
      const sysMetaService = {
        download: state.sandbox.stub().callsFake(async (pid) => {
          if (pid === "resource_map_1") {
            return systemMetadata(pid, {
              formatId: RESOURCE_MAP_FORMAT_ID,
              rightsHolder: "uid=resource-map-owner",
              accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
            });
          }
          // The orphan's sysmeta points back to the prior metadata version.
          return systemMetadata(pid, {
            formatId: EML_FORMAT_ID,
            rightsHolder: "uid=metadata-owner",
            accessPolicy: [],
            obsoletes: "meta.1",
          });
        }),
      };
      const versionTracker = {
        getLatestVersions: state.sandbox
          .stub()
          .callsFake(async (pids, options) => {
            pids.should.deep.equal(["data.1", "source.1"]);
            options.maxConcurrent.should.equal(2);
            return ["data.2", "source.1"];
          }),
      };
      const resolver = {
        resolve: state.sandbox.stub().resolves({ rm: "resource_map_1" }),
        fetchResourceMap: state.sandbox
          .stub()
          .resolves({ model: priorMap, status: 200 }),
        addToStorage: state.sandbox.stub().resolves(),
      };

      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        versionTracker,
        resolver,
        recoveryStore,
      });
      const result = await recovery.recover("meta.orphan", {
        allowReconstruct: true,
        maxConcurrent: 2,
      });

      result.recovered.should.equal(true);
      result.strategy.should.equal("reconstruct");
      fromXml.firstCall.args[2].should.deep.equal({
        resolveServiceUrl: RESOLVE_BASE,
        objectServiceUrl: OBJECT_BASE,
      });
      serialize
        .getCalls()
        .map(({ args }) => args[0]?.validate)
        .should.deep.equal([false, true]);
      objectService.update.calledOnce.should.equal(true);
      const writeArgs = objectService.update.firstCall.args[0];
      // The new map obsoletes the prior one (version chain preserved).
      writeArgs.pid.should.equal("resource_map_1");
      writeArgs.newPid.should.equal(result.resourceMapPid);
      const reconstructedSysMeta = SystemMetadata.fromXml(writeArgs.sysMetaXml);
      reconstructedSysMeta.rightsHolder.should.equal("uid=resource-map-owner");
      reconstructedSysMeta.accessPolicy
        .toJSON()
        .should.deep.equal([{ subjects: ["public"], permissions: ["read"] }]);
      const recoveredMap = ResourceMap.fromXml(
        result.resourceMapPid,
        await writeArgs.object.text(),
        {
          resolveServiceUrl: RESOLVE_BASE,
          objectServiceUrl: OBJECT_BASE,
        },
      );
      recoveredMap
        .getMemberPids()
        .should.have.members(["meta.orphan", "data.2", "source.1"]);
      recoveredMap
        .getDocumentationLinks()
        .should.deep.equal([{ metadataPid: "meta.orphan", dataPid: "data.2" }]);
      recoveredMap.graphState
        .getMember("data.2")
        .atLocations.should.deep.equal(["tables/data.csv"]);
      recoveredMap.provenance
        .getWasDerivedFromLinks()
        .should.deep.equal([{ derivedPid: "data.2", sourcePid: "source.1" }]);
      recoveredMap.graph
        .findStatements({
          subject: RDFGraph.createNamedNode(
            recoveredMap.getNodeUriForPid("data.2"),
          ),
          predicate: customPredicate,
          object: RDFGraph.createLiteral("preserve this statement"),
        })
        .should.have.length(1);
      // Recovery advances a copy; the resolver's cached prior map stays valid.
      priorMap.resourceMapPid.should.equal("resource_map_1");
      priorMap.getMemberPids().should.include("data.1");
      resolver.addToStorage
        .calledWith("meta.orphan", result.resourceMapPid)
        .should.equal(true);
    });

    it("does not publish R2 when latest member resolution is inconclusive", async () => {
      const unavailable = httpError(503, "unavailable");
      const recoveryStore = {
        get: state.sandbox.stub().resolves(null),
        remove: state.sandbox.stub().resolves(),
      };
      const objectService = {
        update: state.sandbox.stub(),
        create: state.sandbox.stub(),
      };
      const resolver = {
        resolve: state.sandbox.stub().resolves({ rm: "resource_map_1" }),
        fetchResourceMap: state.sandbox.stub().resolves({
          model: makeResourceMap(),
          status: 200,
        }),
        addToStorage: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService,
        sysMetaService: {
          download: state.sandbox.stub().resolves(
            systemMetadata("meta.orphan", {
              formatId: EML_FORMAT_ID,
              obsoletes: "meta.1",
            }),
          ),
        },
        versionTracker: {
          getLatestVersions: state.sandbox.stub().rejects(unavailable),
        },
        resolver,
        recoveryStore,
      });

      let error;
      try {
        await recovery.recover("meta.orphan", { allowReconstruct: true });
      } catch (caught) {
        error = caught;
      }

      should.equal(error, unavailable);
      objectService.update.called.should.equal(false);
      objectService.create.called.should.equal(false);
      resolver.addToStorage.called.should.equal(false);
      recoveryStore.remove.called.should.equal(false);
    });

    it("does not reconstruct after an indeterminate R1 member check", async () => {
      const rmXml = makeResourceMap({
        pid: "resource_map_2",
        memberPids: ["meta.orphan"],
        links: [],
      }).serialize({ validate: false });
      const recoveryStore = {
        get: state.sandbox.stub().resolves({
          rmPid: "resource_map_2",
          obsoletesRmPid: "resource_map_1",
          rmXml,
          rmSysMetaXml: systemMetadata("resource_map_2", {
            formatId: RESOURCE_MAP_FORMAT_ID,
            obsoletes: "resource_map_1",
          }).serialize(),
        }),
        remove: state.sandbox.stub().resolves(),
      };
      const objectService = {
        update: state.sandbox.stub(),
        create: state.sandbox.stub(),
      };
      const download = state.sandbox.stub();
      const unavailable = httpError(503, "unavailable");
      download.rejects(unavailable);
      const sysMetaService = {
        download,
      };
      const resolver = {
        resolve: state.sandbox.stub(),
        fetchResourceMap: state.sandbox.stub(),
        addToStorage: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        resolver,
        recoveryStore,
      });

      const result = await recovery.recover("meta.orphan", {
        allowReconstruct: true,
      });

      result.should.deep.equal({
        recovered: false,
        reason: "members_unverifiable",
      });
      download.calledOnce.should.equal(true);
      objectService.update.called.should.equal(false);
      objectService.create.called.should.equal(false);
      resolver.resolve.called.should.equal(false);
      resolver.fetchResourceMap.called.should.equal(false);
      resolver.addToStorage.called.should.equal(false);
      recoveryStore.remove.called.should.equal(false);
    });

    it("reconstructs after local recovery storage remains unavailable", async () => {
      const priorMap = makeResourceMap();
      const storage = {
        getItem: state.sandbox.stub().rejects(new Error("unavailable")),
        removeItem: state.sandbox.stub().resolves(),
      };
      const recoveryStore = new UploadRecoveryStore({ storage });
      const sysMetaService = {
        download: state.sandbox.stub().callsFake(async (pid) =>
          pid === "resource_map_1"
            ? systemMetadata(pid, { formatId: RESOURCE_MAP_FORMAT_ID })
            : systemMetadata(pid, {
                formatId: EML_FORMAT_ID,
                obsoletes: "meta.1",
              }),
        ),
      };
      const objectService = {
        update: state.sandbox.stub().resolves({ data: {} }),
        create: state.sandbox.stub(),
      };
      const resolver = {
        resolve: state.sandbox.stub().resolves({ rm: "resource_map_1" }),
        fetchResourceMap: state.sandbox
          .stub()
          .resolves({ model: priorMap, status: 200 }),
        addToStorage: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        versionTracker: {
          getLatestVersions: state.sandbox.stub().resolves(["data.1"]),
        },
        resolver,
        recoveryStore,
      });

      const result = await recovery.recover("meta.orphan", {
        allowReconstruct: true,
      });

      storage.getItem.calledTwice.should.equal(true);
      result.recovered.should.equal(true);
      result.strategy.should.equal("reconstruct");
    });

    it("does not reconstruct an incomplete recovery record", async () => {
      const storage = {
        getItem: state.sandbox.stub().resolves({
          metadataPid: "meta.orphan",
          rmPid: "resource_map_2",
        }),
        removeItem: state.sandbox.stub(),
      };
      const recoveryStore = new UploadRecoveryStore({ storage });
      const objectService = {
        update: state.sandbox.stub(),
        create: state.sandbox.stub(),
      };
      const sysMetaService = { download: state.sandbox.stub() };
      const resolver = {
        resolve: state.sandbox.stub(),
        fetchResourceMap: state.sandbox.stub(),
        addToStorage: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        resolver,
        recoveryStore,
      });

      const result = await recovery.recover("meta.orphan", {
        allowReconstruct: true,
      });

      result.should.deep.equal({
        recovered: false,
        reason: "record_unreadable",
      });
      sysMetaService.download.called.should.equal(false);
      objectService.update.called.should.equal(false);
      objectService.create.called.should.equal(false);
      resolver.resolve.called.should.equal(false);
      resolver.fetchResourceMap.called.should.equal(false);
      resolver.addToStorage.called.should.equal(false);
      storage.removeItem.called.should.equal(false);
    });

    it("does not reconstruct when exact-record members are missing", async () => {
      const rmXml = makeResourceMap({
        pid: "resource_map_2",
        memberPids: ["meta.orphan", "data.missing"],
        links: [{ metadataPid: "meta.orphan", dataPid: "data.missing" }],
      }).serialize({ validate: false });
      const recoveryStore = {
        get: state.sandbox.stub().resolves({
          metadataPid: "meta.orphan",
          rmPid: "resource_map_2",
          obsoletesRmPid: "resource_map_1",
          rmXml,
          rmSysMetaXml: systemMetadata("resource_map_2", {
            formatId: RESOURCE_MAP_FORMAT_ID,
            obsoletes: "resource_map_1",
          }).serialize(),
        }),
        remove: state.sandbox.stub().resolves(),
      };
      const objectService = {
        update: state.sandbox.stub(),
        create: state.sandbox.stub(),
      };
      const sysMetaService = {
        download: state.sandbox.stub().callsFake(async (pid) => {
          if (pid === "data.missing") throw httpError(404, "not found");
          return systemMetadata(pid, { formatId: EML_FORMAT_ID });
        }),
      };
      const resolver = {
        resolve: state.sandbox.stub(),
        fetchResourceMap: state.sandbox.stub(),
        addToStorage: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        resolver,
        recoveryStore,
      });

      const result = await recovery.recover("meta.orphan", {
        allowReconstruct: true,
      });

      result.should.deep.equal({ recovered: false, reason: "members_missing" });
      sysMetaService.download.calledTwice.should.equal(true);
      objectService.update.called.should.equal(false);
      objectService.create.called.should.equal(false);
      resolver.resolve.called.should.equal(false);
      resolver.fetchResourceMap.called.should.equal(false);
      resolver.addToStorage.called.should.equal(false);
      recoveryStore.remove.called.should.equal(false);
    });

    it("returns no record without reconstructing by default", async () => {
      const recoveryStore = {
        get: state.sandbox.stub().resolves(null),
        remove: state.sandbox.stub().resolves(),
      };
      const objectService = {
        update: state.sandbox.stub(),
        create: state.sandbox.stub(),
      };
      const sysMetaService = { download: state.sandbox.stub() };
      const resolver = {
        resolve: state.sandbox.stub(),
        fetchResourceMap: state.sandbox.stub(),
        addToStorage: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService,
        sysMetaService,
        resolver,
        recoveryStore,
      });

      const result = await recovery.recover("meta.orphan");

      result.should.deep.equal({ recovered: false, reason: "no_record" });
      sysMetaService.download.called.should.equal(false);
      objectService.update.called.should.equal(false);
      objectService.create.called.should.equal(false);
      resolver.resolve.called.should.equal(false);
      resolver.fetchResourceMap.called.should.equal(false);
      resolver.addToStorage.called.should.equal(false);
      recoveryStore.remove.called.should.equal(false);
    });

    it("does not recover when there is no record and no prior version", async () => {
      const recoveryStore = {
        get: state.sandbox.stub().resolves(null),
        remove: state.sandbox.stub().resolves(),
      };
      const recovery = makeRecovery({
        objectService: {
          update: state.sandbox.stub(),
          create: state.sandbox.stub(),
        },
        // A confirmed miss means there is no prior version to reconstruct.
        sysMetaService: {
          download: state.sandbox.stub().rejects(httpError(404, "not found")),
        },
        versionTracker: { getLatestVersions: state.sandbox.stub() },
        resolver: { addToStorage: state.sandbox.stub().resolves() },
        recoveryStore,
      });

      const result = await recovery.recover("meta.orphan", {
        allowReconstruct: true,
      });

      result.recovered.should.equal(false);
      result.reason.should.equal("no_prior_version");
    });
  });

  // --------------------------------------------------------------------------
  // Access-policy save
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: access-policy save", () => {
    it("stages a package access-policy change and persists it as a sysmeta-only update", async () => {
      const { pkg, services } = await loadExistingPackage();

      const targets = await pkg.setPackageAccessPolicy([
        { subjects: ["public"], permissions: ["read"] },
      ]);
      // Default (non-propagated) targets are the root map and primary metadata.
      targets
        .map((member) => member.pid)
        .should.have.members(["resource_map_1", "meta.1"]);
      pkg.hasUnsavedChanges().should.equal(true);

      const result = await pkg.upload();

      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);
      // A policy-only change writes system metadata, never object bytes.
      services.sysMetaService.update.called.should.equal(true);
      services.objectService.create.called.should.equal(false);
      services.objectService.update.called.should.equal(false);
      pkg.hasUnsavedChanges().should.equal(false);
    });
  });

  // --------------------------------------------------------------------------
  // Nested member preservation across an edit + save
  // --------------------------------------------------------------------------

  describe("DataPackage workflows: nested member preservation", () => {
    it("keeps a nested ResourceMap aggregated through an edit and save", async () => {
      const { pkg, rm, services } = await loadExistingPackage({
        memberPids: ["meta.1", "data.1", "nested.package.1"],
        links: [{ metadataPid: "meta.1", dataPid: "data.1" }],
        extraIndexDocs: [
          {
            id: "nested.package.1",
            formatId: RESOURCE_MAP_FORMAT_ID,
            formatType: "RESOURCE",
          },
        ],
      });

      pkg
        .getNestedResourceMapMembers()
        .map((member) => member.pid)
        .should.deep.equal(["nested.package.1"]);

      // Edit an unrelated data member and save.
      await pkg.replaceFile("data.1", new Blob(["updated"]), {
        requestedPid: "data.2",
      });
      const result = await pkg.upload();
      result.outcome.should.equal(UploadResult.Outcomes.SUCCESS);

      // The nested ResourceMap is still aggregated by the (re-uploaded) root
      // ResourceMap, never dropped by the edit.
      rm.getMemberPids().should.include("nested.package.1");
      pkg
        .getNestedResourceMapMembers()
        .map((member) => member.pid)
        .should.deep.equal(["nested.package.1"]);
    });
  });
});
