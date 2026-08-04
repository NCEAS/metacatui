define([
  "/test/js/specs/shared/concurrency-tracker.js",
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageMember",
  "models/dataPackage/DataPackageMembers",
  "models/dataONEServices/PublishService",
  "models/dataONEServices/SysMetaService",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapResolver",
  "models/sysmeta/SystemMetadata",
  "common/QueryService",
  "common/Utilities",
], (
  trackConcurrency,
  DataPackage,
  DataPackageMember,
  DataPackageMembers,
  PublishService,
  SysMetaService,
  ResourceMap,
  ResourceMapResolver,
  SystemMetadata,
  QueryService,
  Utilities,
) => {
  const should = chai.should();
  const { expect } = chai;

  const RESOURCE_MAP_FORMAT_ID = "http://www.openarchives.org/ore/terms";

  /**
   * Build a DataPackage seeded with the given member infos and a known root
   * resource map PID.
   * @param {object[]} members Member info objects
   * @param {string} [rootResourceMapPid] Root resource map PID
   * @returns {DataPackage} Seeded package
   */
  function buildPackage(members, rootResourceMapPid) {
    const pkg = new DataPackage({ members });
    if (rootResourceMapPid) pkg.rootResourceMapPid = rootResourceMapPid;
    return pkg;
  }

  function deferred() {
    let resolve;
    const promise = new Promise((settle) => {
      resolve = settle;
    });
    return { promise, resolve };
  }

  function buildEditablePackage({ metadataObjectModel } = {}) {
    const resourceMap = ResourceMap.create({
      resourceMapPid: "resource_map_1",
      resolveServiceUrl: "https://cn.test.dataone.org/cn/v2/resolve",
      memberPids: ["meta.1", "data.1"],
      documentationLinks: [{ metadataPid: "meta.1", dataPid: "data.1" }],
    });
    const pkg = buildPackage(
      [
        {
          pid: "resource_map_1",
          formatType: "RESOURCE",
          formatId: RESOURCE_MAP_FORMAT_ID,
          objectModel: resourceMap,
        },
        {
          pid: "meta.1",
          formatType: "METADATA",
          formatId: "https://eml.ecoinformatics.org/eml-2.2.0",
          documents: ["data.1"],
          objectModel: metadataObjectModel,
        },
        {
          pid: "data.1",
          formatType: "DATA",
          formatId: "text/csv",
          isDocumentedBy: ["meta.1"],
        },
      ],
      "resource_map_1",
    );
    pkg.members.toArray().forEach((member) => {
      member.initializeEditableState({
        remotePid: member.pid,
        aggregatedPid: member.pid,
      });
    });
    pkg.sysMetaService = {
      download: async (pid) => {
        const member = pkg.getMember(pid);
        return new SystemMetadata({
          identifier: pid,
          formatId: member?.formatId || "text/csv",
          size: 4,
          checksum: "checksum",
          checksumAlgorithm: "MD5",
          submitter: "uid=test",
          rightsHolder: "uid=test",
        });
      },
    };
    return { pkg, resourceMap };
  }

  function addNestedResourceMap(pkg, resourceMap, pid = "nested.package.1") {
    resourceMap.setPackageStructure(
      [...resourceMap.getMemberPids(), pid],
      resourceMap.getDocumentationLinks(),
    );
    pkg.members.add({
      pid,
      formatType: "RESOURCE",
      formatId: RESOURCE_MAP_FORMAT_ID,
    });
    const member = pkg.requireMember(pid);
    member.initializeEditableState({
      remotePid: pid,
      aggregatedPid: pid,
    });
    member.setSystemMetadata(
      new SystemMetadata({
        identifier: pid,
        formatId: RESOURCE_MAP_FORMAT_ID,
        size: 4,
        checksum: "checksum",
        checksumAlgorithm: "MD5",
        submitter: "uid=test",
        rightsHolder: "uid=test",
      }),
      { markDirty: false },
    );
    return member;
  }

  function assertGraphFieldsMatchMember(pkg, resourceMap, pid) {
    const member = pkg.requireMember(pid);
    const graphMember = resourceMap.graphState.getMember(pid) || {};
    ["documents", "isDocumentedBy", "atLocations"].forEach((field) => {
      member[field].should.deep.equal(graphMember[field] || []);
    });
  }

  /**
   * Build a viewer package whose members resolve SysMeta through a shared
   * concurrency tracker, so a test can assert the fetch honours its limit.
   * @param {string[]} [pids] Data member PIDs
   * @returns {{ pkg: DataPackage, concurrency: object }} Package and tracker
   */
  function trackedSysMetaPackage(
    pids = ["data.1", "data.2", "data.3", "data.4"],
  ) {
    const pkg = buildPackage(pids.map((pid) => ({ pid, formatType: "DATA" })));
    const concurrency = trackConcurrency();
    pkg.members.toArray().forEach((member) => {
      member.fetchSysMeta = concurrency.track(() => {
        member.sysMeta = { identifier: member.pid };
      });
    });
    return { pkg, concurrency };
  }

  describe("DataPackage", () => {
    describe("explicit member getters", () => {
      it("returns the primary metadata and root resource map members", () => {
        const pkg = buildPackage(
          [
            { pid: "meta.1", formatType: "METADATA" },
            { pid: "data.1", formatType: "DATA" },
            {
              pid: "resource_map_1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
          ],
          "resource_map_1",
        );

        pkg.getPrimaryMetadataMember().pid.should.equal("meta.1");
        pkg
          .getMetadataMembers()
          .map((m) => m.pid)
          .should.deep.equal(["meta.1"]);
        pkg.getRootResourceMapMember().pid.should.equal("resource_map_1");
        pkg
          .getData()
          .map((m) => m.pid)
          .should.deep.equal(["data.1"]);
        pkg.getMember("data.1").pid.should.equal("data.1");
      });

      it("uses explicit primary metadata and root resource map PIDs", () => {
        const pkg = buildPackage([
          { pid: "meta.1", formatType: "METADATA" },
          { pid: "meta.2", formatType: "METADATA" },
          { pid: "resource_map_1", formatType: "RESOURCE" },
          { pid: "resource_map_2", formatType: "RESOURCE" },
        ]);
        pkg.primaryMetadataPid = "meta.2";
        pkg.rootResourceMapPid = "resource_map_2";

        pkg.getPrimaryMetadataMember().pid.should.equal("meta.2");
        pkg.getRootResourceMapMember().pid.should.equal("resource_map_2");
      });

      it("does not guess when multiple metadata or resource maps are present", () => {
        const pkg = buildPackage([
          { pid: "meta.1", formatType: "METADATA" },
          { pid: "meta.2", formatType: "METADATA" },
          { pid: "resource_map_1", formatType: "RESOURCE" },
          { pid: "resource_map_2", formatType: "RESOURCE" },
        ]);

        expect(pkg.getPrimaryMetadataMember()).to.equal(null);
        expect(pkg.getRootResourceMapMember()).to.equal(null);
      });

      it("falls back to the only resource map when no root PID is set", () => {
        const pkg = buildPackage([
          { pid: "resource_map_1", formatType: "RESOURCE" },
        ]);
        pkg.getRootResourceMapMember().pid.should.equal("resource_map_1");
      });

      it("returns null when no metadata or resource map exists", () => {
        const pkg = buildPackage([{ pid: "data.1", formatType: "DATA" }]);
        expect(pkg.getPrimaryMetadataMember()).to.equal(null);
        expect(pkg.getRootResourceMapMember()).to.equal(null);
        pkg.getMetadataMembers().should.deep.equal([]);
      });

      it("returns the parsed resource map model only when fetched", () => {
        const pkg = buildPackage(
          [{ pid: "resource_map_1", formatType: "RESOURCE" }],
          "resource_map_1",
        );
        const parsedModel = { serialize: () => "<rdf/>" };

        expect(pkg.getResourceMapModel()).to.equal(null);
        pkg.getMember("resource_map_1").objectModel = parsedModel;
        pkg.getResourceMapModel().should.equal(parsedModel);
        expect(pkg.getResourceMapModel("not.a.member")).to.equal(null);
      });
    });

    describe("load progress", () => {
      it("publishes typed phases without view text", async () => {
        const pkg = new DataPackage();
        const progress = [];
        pkg.events.on("load:progress", (event) => progress.push(event));

        await pkg.reportLoadProgress(
          DataPackage.LoadPhases.RESOURCE_MAP_DOWNLOAD,
          { rootResourceMapPid: "resource_map_1" },
        );

        progress.should.deep.equal([
          {
            rootResourceMapPid: "resource_map_1",
            phase: DataPackage.LoadPhases.RESOURCE_MAP_DOWNLOAD,
          },
        ]);
      });
    });

    describe("DataPackageMembers onlyExisting enrichment", () => {
      it("merges into existing members but never creates new ones", () => {
        const members = new DataPackageMembers();
        members.add({ pid: "meta.1", formatType: "METADATA" });

        members.add(
          [
            { pid: "meta.1", title: "Seeded Title" },
            { pid: "index.only.1", formatType: "DATA" },
          ],
          { merge: true, onlyExisting: true },
        );

        members
          .toArray()
          .map((member) => member.pid)
          .should.deep.equal(["meta.1"]);
        members.get("meta.1").title.should.equal("Seeded Title");
        expect(members.get("index.only.1")).to.equal(null);
      });
    });

    describe("addViewServiceEntities()", () => {
      it("merges entity summaries into matching members and ignores the rest", () => {
        const pkg = buildPackage([{ pid: "data.1", formatType: "DATA" }]);

        pkg.addViewServiceEntities([
          { pid: "data.1", entityName: "Entity One", objectName: "one.csv" },
          { pid: "data.missing", entityName: "Ghost" },
        ]);

        pkg.getMember("data.1").fileName.should.equal("one.csv");
        pkg
          .getMember("data.1")
          .viewServiceEntity.entityName.should.equal("Entity One");
        expect(pkg.getMember("data.missing")).to.equal(null);
      });
    });

    describe("getTotalSize()", () => {
      it("uses numeric member and SysMeta sizes that are already loaded", () => {
        const pkg = buildPackage([
          { pid: "data.1", formatType: "DATA", size: "10" },
          {
            pid: "data.2",
            formatType: "DATA",
            sysMeta: new SystemMetadata({
              identifier: "data.2",
              formatId: "text/csv",
              size: 5,
              checksum: "checksum",
              checksumAlgorithm: "MD5",
              submitter: "uid=test",
              rightsHolder: "uid=test",
            }),
          },
        ]);

        pkg.getTotalSize().should.equal(15);
      });

      it("rejects totals with missing or nonnumeric sizes", () => {
        const pkg = buildPackage([
          { pid: "data.1", formatType: "DATA", size: "10" },
          { pid: "data.2", formatType: "DATA", size: "unknown" },
        ]);

        expect(() => pkg.getTotalSize()).to.throw("missing size information");
      });
    });

    describe("hasPrivateMembers()", () => {
      it("fails closed until both manifests and the index total are available", () => {
        const pkg = buildPackage(
          [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
          ],
          "rm.1",
        );

        pkg.hasPrivateMembers().should.equal(true);
        pkg.resourceManifestIsFetched = true;
        pkg.hasPrivateMembers().should.equal(true);
        pkg.indexManifestFetched = true;
        pkg.hasPrivateMembers().should.equal(true);
      });

      it("compares the full index match count with ResourceMap membership", () => {
        const pkg = buildPackage(
          [
            { pid: "data.1", formatType: "DATA" },
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
          ],
          "rm.1",
        );
        pkg.members.add(pkg.toArray(), {
          merge: true,
          sources: ["resourceMap"],
        });
        pkg.members.add({ pid: "rm.1" }, { merge: true, sources: ["index"] });
        pkg.resourceManifestIsFetched = true;
        pkg.indexManifestFetched = true;

        pkg.indexManifestTotal = 2;
        pkg.hasPrivateMembers().should.equal(false);
        pkg.indexManifestTotal = 1;
        pkg.hasPrivateMembers().should.equal(true);
      });
    });

    describe("getManifestFromIndex()", () => {
      it("retains the full match count when Solr returns only one page", async () => {
        const sandbox = sinon.createSandbox();
        const pkg = buildPackage(
          [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
          ],
          "rm.1",
        );
        const query = sandbox.stub(QueryService, "queryWithFetch").resolves({
          response: {
            numFound: 1501,
            docs: [{ id: "rm.1" }, { id: "data.1" }],
          },
        });

        try {
          const result = await pkg.getManifestFromIndex({ rows: 2 });

          result.details.count.should.equal(2);
          result.details.total.should.equal(1501);
          pkg.indexManifestTotal.should.equal(1501);
        } finally {
          sandbox.restore();
        }
      });
    });

    describe("loadNestedPackageTitles()", () => {
      it("loads missing nested ResourceMap titles from indexed metadata", async () => {
        const sandbox = sinon.createSandbox();
        const controller = new AbortController();
        const pkg = buildPackage(
          [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "nested.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "nested.titled",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
              title: "Existing title",
            },
          ],
          "rm.1",
        );
        const query = sandbox.stub(QueryService, "queryWithFetch").resolves({
          response: {
            docs: [
              {
                id: "nested.meta.1",
                resourceMap: ["nested.1"],
                title: "Nested dataset",
              },
            ],
          },
        });

        try {
          const changed = await pkg.loadNestedPackageTitles({
            signal: controller.signal,
          });

          changed.should.equal(true);
          pkg.getMember("nested.1").title.should.equal("Nested dataset");
          pkg.getMember("nested.titled").title.should.equal("Existing title");
          sinon.assert.calledOnceWithExactly(query, {
            q: 'formatType:"METADATA" AND (resourceMap:"nested.1")',
            fields: ["id", "resourceMap", "title"],
            rows: 1000,
            archived: true,
            usePost: true,
            signal: controller.signal,
          });
        } finally {
          sandbox.restore();
        }
      });

      it("skips the index when nested ResourceMaps already have titles", async () => {
        const sandbox = sinon.createSandbox();
        const pkg = buildPackage(
          [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "nested.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
              title: "Nested dataset",
            },
          ],
          "rm.1",
        );
        const query = sandbox.stub(QueryService, "queryWithFetch");

        try {
          (await pkg.loadNestedPackageTitles()).should.equal(false);
          sinon.assert.notCalled(query);
        } finally {
          sandbox.restore();
        }
      });
    });

    describe("fetchSysMeta()", () => {
      it("uses the package SysMeta service for member fetches", async () => {
        const sandbox = sinon.createSandbox();
        const packageSysMeta = new SystemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=package",
        });
        const defaultSysMeta = new SystemMetadata({
          identifier: "data.1",
          rightsHolder: "uid=default",
        });
        const packageService = {
          download: sandbox.stub().resolves(packageSysMeta),
        };
        const pkg = new DataPackage({
          members: [{ pid: "data.1", formatType: "DATA" }],
          sysMetaService: packageService,
        });
        const defaultDownload = sandbox
          .stub(SysMetaService.prototype, "download")
          .resolves(defaultSysMeta);

        try {
          const failures = await pkg.fetchSysMeta(["data.1"], {
            cacheKey: "package-cache",
          });

          failures.should.deep.equal([]);
          pkg
            .getMember("data.1")
            .sysMeta.rightsHolder.should.equal("uid=package");
          sinon.assert.calledOnceWithExactly(
            packageService.download,
            "data.1",
            { cacheKey: "package-cache" },
          );
          sinon.assert.notCalled(defaultDownload);
        } finally {
          sandbox.restore();
        }
      });

      it("prefers a per-call SysMeta service over the package service", async () => {
        const sandbox = sinon.createSandbox();
        const packageService = {
          download: sandbox.stub().resolves(
            new SystemMetadata({
              identifier: "data.1",
              rightsHolder: "uid=package",
            }),
          ),
        };
        const overrideService = {
          download: sandbox.stub().resolves(
            new SystemMetadata({
              identifier: "data.1",
              rightsHolder: "uid=override",
            }),
          ),
        };
        const pkg = new DataPackage({
          members: [{ pid: "data.1", formatType: "DATA" }],
          sysMetaService: packageService,
        });

        try {
          const failures = await pkg.fetchSysMeta(["data.1"], {
            sysMetaService: overrideService,
          });

          failures.should.deep.equal([]);
          pkg
            .getMember("data.1")
            .sysMeta.rightsHolder.should.equal("uid=override");
          sinon.assert.calledOnce(overrideService.download);
          sinon.assert.notCalled(packageService.download);
        } finally {
          sandbox.restore();
        }
      });

      it("limits concurrent member sysmeta fetches", async () => {
        const { pkg, concurrency } = trackedSysMetaPackage();

        const failures = await pkg.fetchSysMeta(null, { maxConcurrent: 2 });

        failures.should.deep.equal([]);
        concurrency.max.should.equal(2);
      });

      it("uses batchSizeFetch as the default SysMeta fetch concurrency", async () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: (key) =>
              key === "batchSizeFetch"
                ? "2"
                : originalMetacatUI?.appModel?.get?.(key),
          },
        };

        try {
          const { pkg, concurrency } = trackedSysMetaPackage();
          const failures = await pkg.fetchSysMeta();

          failures.should.deep.equal([]);
          concurrency.max.should.equal(2);
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });

      it("returns failures for unique requested PIDs absent from the package", async () => {
        const pkg = buildPackage([{ pid: "data.1", formatType: "DATA" }]);
        pkg.getMember("data.1").sysMeta = { identifier: "data.1" };

        const failures = await pkg.fetchSysMeta([
          "data.1",
          "data.1",
          "missing.1",
        ]);

        failures.should.have.lengthOf(1);
        failures[0].pid.should.equal("missing.1");
        failures[0].error.code.should.equal("member_not_found");
      });

      it("returns member fetch failures without logging them", async () => {
        const sandbox = sinon.createSandbox();
        const fetchError = new Error("offline");
        const pkg = buildPackage([{ pid: "data.1", formatType: "DATA" }]);
        sandbox
          .stub(pkg.getMember("data.1"), "fetchSysMeta")
          .rejects(fetchError);
        const logError = sandbox.stub(console, "error");

        try {
          const failures = await pkg.fetchSysMeta(["data.1"]);

          failures.should.have.lengthOf(1);
          failures[0].pid.should.equal("data.1");
          failures[0].error.should.equal(fetchError);
          sinon.assert.notCalled(logError);
        } finally {
          sandbox.restore();
        }
      });
    });

    describe("getManifestFromResourceMap() edit gate", () => {
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });

      afterEach(() => {
        sandbox.restore();
      });

      function packageWithResourceMapModel(resourceMap) {
        const pkg = buildPackage(
          [
            {
              pid: "resource_map_1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
              objectModel: resourceMap,
            },
          ],
          "resource_map_1",
        );
        sandbox.stub(pkg, "ensureObjectFormats").resolves();
        return pkg;
      }

      it("checks edit blockers before projecting or merging a summary", async () => {
        const issues = [
          {
            code: "memberIdentifierMismatch",
            severity: "error",
            message: "Member identity is contradictory",
          },
        ];
        const getSummary = sandbox.stub();
        const pkg = packageWithResourceMapModel({
          getEditBlockers: sandbox.stub().returns(issues),
          getSummary,
        });

        let caught;
        try {
          await pkg.getManifestFromResourceMap({ requireEditable: true });
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("resource_map_not_editable");
        caught.rootResourceMapPid.should.equal("resource_map_1");
        caught.issues.should.deep.equal(issues);
        sinon.assert.notCalled(getSummary);
        expect(pkg.resourceManifestIsFetched).to.not.equal(true);
      });

      it("keeps read-only manifest loading available when edit blockers exist", async () => {
        const getSummary = sandbox.stub().returns({
          resourceMapPid: "resource_map_1",
          resourceMapUri: "https://cn.example/resolve/resource_map_1",
          members: [],
          modified: null,
          creatorName: null,
        });
        const pkg = packageWithResourceMapModel({
          getEditBlockers: sandbox
            .stub()
            .returns([{ code: "unsafeCito", severity: "error" }]),
          getSummary,
          graphState: { getMember: sandbox.stub() },
        });

        const result = await pkg.getManifestFromResourceMap();

        result.ok.should.equal(true);
        sinon.assert.calledOnce(getSummary);
        pkg.resourceManifestIsFetched.should.equal(true);
      });

      it("preserves structured ownership issues when parsing fails", async () => {
        const issues = [
          {
            code: "ambiguousResourceMapRoot",
            severity: "error",
            message: "Multiple Resource Map owners were asserted",
          },
        ];
        const pkg = packageWithResourceMapModel(null);
        const ownershipError = Object.assign(new Error("ambiguous owner"), {
          issues,
        });
        sandbox
          .stub(pkg.getRootResourceMapMember(), "fetchObject")
          .rejects(ownershipError);

        let caught;
        try {
          await pkg.getManifestFromResourceMap({ requireEditable: true });
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("resource_map_not_editable");
        caught.issues.should.deep.equal(issues);
        caught.cause.should.equal(ownershipError);
      });

      it("classifies a 404 response as a missing resource map", async () => {
        const pkg = packageWithResourceMapModel(null);
        const missingError = Object.assign(new Error("not found"), {
          status: 404,
        });
        sandbox
          .stub(pkg.getRootResourceMapMember(), "fetchObject")
          .rejects(missingError);
        const warn = sandbox.stub(console, "warn");

        const result = await pkg.getManifestFromResourceMap();

        result.ok.should.equal(false);
        result.reason.should.equal("missing");
        result.httpStatus.should.equal(404);
        result.error.should.equal(missingError);
        sinon.assert.notCalled(warn);
      });
    });

    describe("loadEditablePackage()", () => {
      let sandbox;
      beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(Utilities, "awaitObjectFormats").resolves([]);
      });
      afterEach(() => {
        sandbox.restore();
      });

      /**
       * Stub resolveFromPid to seed a resolved root resource map member.
       * @param {DataPackage} pkg Package under test
       * @returns {object} The sinon stub
       */
      const stubResolveWithResourceMap = (pkg) =>
        sandbox.stub(pkg, "resolveFromPid").callsFake(async () => {
          pkg.rootResourceMapPid = "resource_map_1";
          pkg.members.add({
            pid: "resource_map_1",
            formatType: "RESOURCE",
          });
          pkg.resolutionResult = {};
          return pkg.resolutionResult;
        });

      const stubSuccessfulBaselineFetch = (pkg) =>
        sandbox.stub(pkg, "fetchSysMeta").callsFake(async (pids) => {
          pids.forEach((pid) => {
            pkg.getMember(pid).sysMeta = new SystemMetadata({
              identifier: pid,
              formatId:
                pid === "resource_map_1"
                  ? RESOURCE_MAP_FORMAT_ID
                  : "https://eml.ecoinformatics.org/eml-2.2.0",
            });
          });
          return [];
        });

      it("throws resource_map_unavailable when no resource map resolves", async () => {
        const pkg = new DataPackage();
        sandbox.stub(pkg, "resolveFromPid").callsFake(async () => {
          pkg.resolutionResult = { notFound: true };
          return pkg.resolutionResult;
        });

        let caught = null;
        try {
          await pkg.loadEditablePackage("missing.1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceOf(Error);
        caught.code.should.equal("resource_map_unavailable");
        caught.reason.should.equal("missing");
      });

      it("throws resource_map_unavailable when the resource map cannot be parsed", async () => {
        const pkg = new DataPackage();
        const parseError = new Error("malformed RDF");
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").rejects(parseError);
        const indexStub = sandbox.stub(pkg, "getManifestFromIndex");
        const sysMetaStub = sandbox.stub(pkg, "fetchSysMeta");

        let caught = null;
        try {
          await pkg.loadEditablePackage("resource_map_1");
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("resource_map_unavailable");
        caught.reason.should.equal("error");
        caught.cause.should.equal(parseError);
        // Never enrich or fetch sysmeta when the authoritative RM failed.
        indexStub.called.should.equal(false);
        sysMetaStub.called.should.equal(false);
      });

      it("preserves abort errors while loading editable resource map membership", async () => {
        const pkg = new DataPackage();
        const abortError = Object.assign(new Error("cancelled"), {
          name: "AbortError",
        });
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").rejects(abortError);

        let caught = null;
        try {
          await pkg.loadEditablePackage("resource_map_1");
        } catch (error) {
          caught = error;
        }

        caught.should.equal(abortError);
        expect(caught.code).to.equal(undefined);
      });

      it("preserves resource_map_not_editable from manifest loading", async () => {
        const pkg = new DataPackage();
        const issues = [{ code: "ambiguousMemberPid", severity: "error" }];
        const notEditable = Object.assign(new Error("not editable"), {
          code: "resource_map_not_editable",
          issues,
        });
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").rejects(notEditable);
        const indexStub = sandbox.stub(pkg, "getManifestFromIndex");

        let caught;
        try {
          await pkg.loadEditablePackage("resource_map_1");
        } catch (error) {
          caught = error;
        }

        caught.should.equal(notEditable);
        caught.issues.should.equal(issues);
        sinon.assert.notCalled(indexStub);
      });

      it("converts structured resolver ownership conflicts to not editable", async () => {
        const pkg = new DataPackage();
        const issues = [
          {
            code: "ambiguousResourceMapRoot",
            severity: "error",
            reason: "ambiguous",
          },
        ];
        const conflict = Object.assign(new Error("ambiguous owner"), {
          details: { resourceMapPid: "resource_map_1" },
          issues,
        });
        sandbox.stub(pkg, "resolveFromPid").rejects(conflict);
        const manifestStub = sandbox.stub(pkg, "getManifestFromResourceMap");

        let caught = null;
        try {
          await pkg.loadEditablePackage("meta.1");
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("resource_map_not_editable");
        caught.rootResourceMapPid.should.equal("resource_map_1");
        caught.issues.should.deep.equal(issues);
        caught.cause.should.equal(conflict);
        sinon.assert.notCalled(manifestStub);
      });

      it("throws resource_map_unavailable when the resource map is private", async () => {
        const pkg = new DataPackage();
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").resolves({
          ok: false,
          reason: "unauthorized",
          httpStatus: 401,
        });

        let caught = null;
        try {
          await pkg.loadEditablePackage("resource_map_1");
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("resource_map_unavailable");
        caught.reason.should.equal("unauthorized");
        caught.httpStatus.should.equal(401);
      });

      it("seeds membership from the resource map, enriches only existing members, and loads baseline sysmeta", async () => {
        const pkg = new DataPackage();
        stubResolveWithResourceMap(pkg);
        pkg.members.add({ pid: "resolver.only", formatType: "DATA" });
        const getManifestFromResourceMap = sandbox
          .stub(pkg, "getManifestFromResourceMap")
          .callsFake(async () => {
            pkg.members.add(
              [
                {
                  pid: "resource_map_1",
                  formatType: "RESOURCE",
                },
                { pid: "meta.1", formatType: "METADATA" },
                { pid: "data.1", formatType: "DATA" },
              ],
              { sources: ["resourceMap"] },
            );
            return { ok: true };
          });
        const indexStub = sandbox
          .stub(pkg, "getManifestFromIndex")
          .resolves({ ok: true });
        const sysMetaStub = stubSuccessfulBaselineFetch(pkg);

        const result = await pkg.loadEditablePackage("resource_map_1");

        result.should.equal(pkg);
        getManifestFromResourceMap.firstCall.args[0].requireEditable.should.equal(
          true,
        );
        // Index enrichment must be restricted to already-aggregated members.
        indexStub.calledOnce.should.equal(true);
        indexStub.firstCall.args[0].should.deep.include({
          merge: true,
          onlyExisting: true,
        });
        // Only the root RM and primary metadata sysmeta are fetched up front.
        sysMetaStub.calledOnce.should.equal(true);
        sysMetaStub.firstCall.args[0].should.deep.equal([
          "resource_map_1",
          "meta.1",
        ]);
        expect(pkg.getMember("resolver.only")).to.equal(null);
        pkg.members
          .toArray()
          .map((member) => member.pid)
          .should.deep.equal(["resource_map_1", "meta.1", "data.1"]);
        pkg.members.toArray().forEach((member) => {
          member.remotePid.should.equal(member.pid);
          member.aggregatedPid.should.equal(member.pid);
        });
        pkg.draftRevision.should.equal(0);
      });

      it("passes the caller signal through editable package loading", async () => {
        const pkg = new DataPackage();
        const controller = new AbortController();
        sandbox.stub(pkg, "resolveFromPid").callsFake(async (_pid, options) => {
          options.signal.should.equal(controller.signal);
          pkg.rootResourceMapPid = "resource_map_1";
          pkg.members.add({
            pid: "resource_map_1",
            formatType: "RESOURCE",
          });
          pkg.resolutionResult = {};
          return pkg.resolutionResult;
        });
        sandbox
          .stub(pkg, "getManifestFromResourceMap")
          .callsFake(async (options) => {
            options.signal.should.equal(controller.signal);
            pkg.members.add(
              [
                { pid: "resource_map_1", formatType: "RESOURCE" },
                { pid: "meta.1", formatType: "METADATA" },
              ],
              { sources: ["resourceMap"] },
            );
            return { ok: true };
          });
        sandbox.stub(pkg, "getManifestFromIndex").callsFake(async (options) => {
          options.signal.should.equal(controller.signal);
          return { ok: true };
        });
        sandbox.stub(pkg, "fetchSysMeta").callsFake(async (pids, options) => {
          options.signal.should.equal(controller.signal);
          pids.forEach((pid) => {
            pkg.getMember(pid).sysMeta = new SystemMetadata({
              identifier: pid,
              formatId:
                pid === "resource_map_1"
                  ? RESOURCE_MAP_FORMAT_ID
                  : "https://eml.ecoinformatics.org/eml-2.2.0",
            });
          });
          return [];
        });
        const fetchObject = sandbox
          .stub(DataPackageMember.prototype, "fetchObject")
          .callsFake(async function (options) {
            options.signal.should.equal(controller.signal);
            this.objectModel = {};
            return this.objectModel;
          });

        await pkg.loadEditablePackage("resource_map_1", {
          fetchPrimaryMetadata: true,
          signal: controller.signal,
        });

        sinon.assert.calledOnce(fetchObject);
      });

      it("stops editable loading before index enrichment when the member limit is exceeded", async () => {
        const pkg = new DataPackage();
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").callsFake(async () => {
          pkg.members.add(
            [
              { pid: "resource_map_1", formatType: "RESOURCE" },
              { pid: "meta.1", formatType: "METADATA" },
              { pid: "data.1", formatType: "DATA" },
            ],
            { sources: ["resourceMap"] },
          );
          return { ok: true };
        });
        const indexStub = sandbox.stub(pkg, "getManifestFromIndex");
        const sysMetaStub = sandbox.stub(pkg, "fetchSysMeta");

        let caught;
        try {
          await pkg.loadEditablePackage("resource_map_1", { maxMembers: 2 });
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("package_member_limit_exceeded");
        caught.memberCount.should.equal(3);
        caught.maxMembers.should.equal(2);
        caught.rootResourceMapPid.should.equal("resource_map_1");
        sinon.assert.notCalled(indexStub);
        sinon.assert.notCalled(sysMetaStub);
      });

      it("requests index rows for the configured editable member limit", async () => {
        const pkg = new DataPackage();
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").callsFake(async () => {
          pkg.members.add(
            [
              { pid: "resource_map_1", formatType: "RESOURCE" },
              { pid: "meta.1", formatType: "METADATA" },
            ],
            { sources: ["resourceMap"] },
          );
          return { ok: true };
        });
        const indexStub = sandbox
          .stub(pkg, "getManifestFromIndex")
          .resolves({ ok: true });
        stubSuccessfulBaselineFetch(pkg);

        await pkg.loadEditablePackage("resource_map_1", { maxMembers: 701 });

        indexStub.firstCall.args[0].should.deep.include({
          merge: true,
          onlyExisting: true,
          rows: 701,
        });
      });

      it("classifies and retains a non-prefixed nested ResourceMap from sysmeta", async () => {
        const pkg = new DataPackage();
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").callsFake(async () => {
          pkg.members.add(
            [
              { pid: "resource_map_1", formatType: "RESOURCE" },
              {
                pid: "meta.1",
                formatType: "METADATA",
                documents: ["nested.package.1"],
              },
              { pid: "nested.package.1" },
            ],
            { sources: ["resourceMap"] },
          );
          return { ok: true };
        });
        sandbox.stub(pkg, "getManifestFromIndex").resolves({ ok: true });
        const fetchSysMeta = sandbox
          .stub(pkg, "fetchSysMeta")
          .callsFake(async (pids) => {
            pids.forEach((pid) => {
              const formatId =
                pid === "resource_map_1" || pid === "nested.package.1"
                  ? RESOURCE_MAP_FORMAT_ID
                  : "https://eml.ecoinformatics.org/eml-2.2.0";
              pkg.getMember(pid).sysMeta = new SystemMetadata({
                identifier: pid,
                formatId,
              });
            });
            return [];
          });

        await pkg.loadEditablePackage("resource_map_1");

        fetchSysMeta.firstCall.args[0].should.deep.equal(["nested.package.1"]);
        fetchSysMeta.secondCall.args[0].should.deep.equal([
          "resource_map_1",
          "meta.1",
        ]);
        pkg
          .getNestedResourceMapMembers()
          .map((member) => member.pid)
          .should.deep.equal(["nested.package.1"]);
      });

      it("rethrows collected aborts from unclassified sysmeta loading", async () => {
        const pkg = new DataPackage();
        const abortError = Object.assign(new Error("cancelled"), {
          name: "AbortError",
        });
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").callsFake(async () => {
          pkg.members.add(
            [
              { pid: "resource_map_1", formatType: "RESOURCE" },
              { pid: "meta.1", formatType: "METADATA" },
              { pid: "nested.package.1" },
            ],
            { sources: ["resourceMap"] },
          );
          return { ok: true };
        });
        sandbox.stub(pkg, "getManifestFromIndex").resolves({ ok: true });
        sandbox.stub(pkg, "fetchSysMeta").callsFake(async (pids) => {
          if (pids.includes("nested.package.1")) {
            return [{ pid: "nested.package.1", error: abortError }];
          }
          pids.forEach((pid) => {
            pkg.getMember(pid).sysMeta = new SystemMetadata({
              identifier: pid,
              formatId:
                pid === "resource_map_1"
                  ? RESOURCE_MAP_FORMAT_ID
                  : "https://eml.ecoinformatics.org/eml-2.2.0",
            });
          });
          return [];
        });

        let caught;
        try {
          await pkg.loadEditablePackage("resource_map_1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.equal(abortError);
      });

      it("preserves signal cancellation after editable baseline sysmeta loading", async () => {
        const pkg = new DataPackage();
        const controller = new AbortController();
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").callsFake(async () => {
          pkg.members.add(
            [
              { pid: "resource_map_1", formatType: "RESOURCE" },
              { pid: "meta.1", formatType: "METADATA" },
            ],
            { sources: ["resourceMap"] },
          );
          return { ok: true };
        });
        sandbox.stub(pkg, "getManifestFromIndex").resolves({ ok: true });
        sandbox.stub(pkg, "fetchSysMeta").callsFake(async () => {
          controller.abort("cancelled");
          return [];
        });

        let caught;
        try {
          await pkg.loadEditablePackage("resource_map_1", {
            signal: controller.signal,
          });
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceOf(Error);
        caught.name.should.equal("AbortError");
        expect(caught.code).to.equal(undefined);
      });

      ["resource_map_1", "meta.1"].forEach((failedPid) => {
        it(`blocks editable loading when ${failedPid} sysmeta fails`, async () => {
          const pkg = new DataPackage();
          stubResolveWithResourceMap(pkg);
          sandbox
            .stub(pkg, "getManifestFromResourceMap")
            .callsFake(async () => {
              pkg.members.add(
                [
                  { pid: "resource_map_1", formatType: "RESOURCE" },
                  { pid: "meta.1", formatType: "METADATA" },
                ],
                { sources: ["resourceMap"] },
              );
              return { ok: true };
            });
          sandbox.stub(pkg, "getManifestFromIndex").resolves({ ok: true });
          const cause = new Error("sysmeta unavailable");
          sandbox.stub(pkg, "fetchSysMeta").callsFake(async () => {
            const successfulPid =
              failedPid === "resource_map_1" ? "meta.1" : "resource_map_1";
            pkg.getMember(successfulPid).sysMeta = new SystemMetadata({
              identifier: successfulPid,
              formatId:
                successfulPid === "resource_map_1"
                  ? RESOURCE_MAP_FORMAT_ID
                  : "https://eml.ecoinformatics.org/eml-2.2.0",
            });
            return [{ pid: failedPid, error: cause }];
          });

          let caught;
          try {
            await pkg.loadEditablePackage("meta.1");
          } catch (error) {
            caught = error;
          }

          caught.code.should.equal("editable_baseline_unavailable");
          caught.failedPids.should.deep.equal([failedPid]);
          caught.causes.should.deep.equal([cause]);
          expect(pkg.getMember("resource_map_1").remotePid).to.equal(null);
          expect(pkg.getMember("meta.1").remotePid).to.equal(null);
        });
      });

      it("blocks editable loading when primary metadata is missing", async () => {
        const pkg = new DataPackage();
        stubResolveWithResourceMap(pkg);
        sandbox.stub(pkg, "getManifestFromResourceMap").callsFake(async () => {
          pkg.members.add(
            { pid: "resource_map_1", formatType: "RESOURCE" },
            { sources: ["resourceMap"] },
          );
          return { ok: true };
        });
        sandbox.stub(pkg, "getManifestFromIndex").resolves({ ok: true });
        const sysMetaStub = sandbox.stub(pkg, "fetchSysMeta");

        let caught;
        try {
          await pkg.loadEditablePackage("resource_map_1");
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("editable_baseline_unavailable");
        caught.missingMembers.should.deep.equal(["primaryMetadata"]);
        caught.failedPids.should.deep.equal([]);
        sysMetaStub.called.should.equal(false);
      });

      it("does not return before resource map parsing completes", async () => {
        const pkg = new DataPackage();
        stubResolveWithResourceMap(pkg);
        let resourceMapParsed = false;
        sandbox.stub(pkg, "getManifestFromResourceMap").callsFake(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resourceMapParsed = true;
                pkg.members.add(
                  [
                    { pid: "resource_map_1", formatType: "RESOURCE" },
                    { pid: "meta.1", formatType: "METADATA" },
                  ],
                  { sources: ["resourceMap"] },
                );
                resolve({ ok: true });
              }, 0);
            }),
        );
        sandbox.stub(pkg, "getManifestFromIndex").resolves({ ok: true });
        stubSuccessfulBaselineFetch(pkg);

        await pkg.loadEditablePackage("resource_map_1");

        resourceMapParsed.should.equal(true);
      });
    });

    describe("initializeLoadedMembersForEditing()", () => {
      it("initializes members loaded through the read-only path", () => {
        const pkg = buildPackage(
          [
            { pid: "meta.1", formatType: "METADATA" },
            { pid: "data.1", formatType: "DATA" },
            {
              pid: "resource_map_1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
          ],
          "resource_map_1",
        );

        // A read-only manifest load leaves members without editable state.
        expect(pkg.getMember("data.1").remotePid).to.equal(null);

        pkg.initializeLoadedMembersForEditing();

        pkg.members.toArray().forEach((member) => {
          member.remotePid.should.equal(member.pid);
        });
      });

      it("preserves sysMeta and existing editable state", () => {
        const pkg = buildPackage([{ pid: "data.1", formatType: "DATA" }]);
        const member = pkg.getMember("data.1");
        member.initializeEditableState({
          remotePid: "data.1",
          aggregatedPid: "data.1",
          contentDirty: true,
        });

        pkg.initializeLoadedMembersForEditing();

        // The already-initialized member's pending edit is left intact.
        member.contentDirty.should.equal(true);
      });
    });

    describe("draft revision", () => {
      it("increments only when a public user edit records one revision", () => {
        const pkg = new DataPackage();

        pkg.draftRevision.should.equal(0);
        pkg.recordUserEdit("metadata:changed", {});
        pkg.draftRevision.should.equal(1);
        pkg.hasMetadataContentEdits().should.equal(true);
      });

      it("uses revision, member, graph, and compatibility dirty state", () => {
        const pkg = buildPackage([
          { pid: "data.1", formatType: "DATA" },
          {
            pid: "resource_map_1",
            formatType: "RESOURCE",
            objectModel: { hasUnsavedChanges: () => false },
          },
        ]);
        pkg.rootResourceMapPid = "resource_map_1";

        pkg.hasUnsavedChanges().should.equal(false);
        pkg.getMember("data.1").contentDirty = true;
        pkg.hasUnsavedChanges().should.equal(true);
        pkg.getMember("data.1").contentDirty = false;
        pkg.getResourceMapModel().hasUnsavedChanges = () => true;
        pkg.hasUnsavedChanges().should.equal(true);
        pkg.getResourceMapModel().hasUnsavedChanges = () => false;
        pkg.recordUserEdit("metadata:changed", {});
        pkg.savedRevision = pkg.draftRevision;
        pkg.hasUnsavedChanges().should.equal(true);
        pkg.primaryMetadataPid = "meta.1";
        pkg.toJSON().primaryMetadataPid.should.equal("meta.1");
        pkg.toJSON().savedRevision.should.equal(pkg.savedRevision);
      });

      it("rejects package mutations while a save is active", async () => {
        const { pkg } = buildEditablePackage();
        pkg.activeUpload = {};
        const initialRevision = pkg.draftRevision;
        const initialLinks = pkg.getResourceMapModel().getDocumentationLinks();

        let relationshipError;
        try {
          pkg.linkDocumentation("meta.1", "data.1");
        } catch (error) {
          relationshipError = error;
        }
        let memberError;
        try {
          await pkg.markMemberContentDirty("data.1");
        } catch (error) {
          memberError = error;
        }
        let provenanceError;
        try {
          pkg.addWasDerivedFrom("data.1", "external.source");
        } catch (error) {
          provenanceError = error;
        }

        relationshipError.code.should.equal("upload_in_progress");
        memberError.code.should.equal("upload_in_progress");
        provenanceError.code.should.equal("upload_in_progress");
        pkg.draftRevision.should.equal(initialRevision);
        pkg
          .getResourceMapModel()
          .getDocumentationLinks()
          .should.deep.equal(initialLinks);
        pkg
          .getResourceMapModel()
          .provenance.getWasDerivedFromLinks()
          .some(
            ({ generatedPid, sourcePid }) =>
              generatedPid === "data.1" && sourcePid === "external.source",
          )
          .should.equal(false);
      });

      it("rejects metadata content edits while a save is active", () => {
        const pkg = new DataPackage();
        pkg.activeUpload = {};

        let caught;
        try {
          pkg.recordUserEdit("metadata:changed", {});
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        pkg.hasMetadataContentEdits().should.equal(false);
        pkg.draftRevision.should.equal(0);
      });

      it("does not lock editing for background eager uploads", () => {
        const pkg = new DataPackage();
        pkg.eagerUploads.set("data.1", { promise: Promise.resolve() });

        pkg.isEditLocked().should.equal(false);
        pkg.recordUserEdit("metadata:changed", {});
        pkg.draftRevision.should.equal(1);
      });

      it("locks edits to a member while its eager upload is pending", async () => {
        const { pkg } = buildEditablePackage();
        pkg.eagerUploads.set("data.1", { promise: Promise.resolve() });
        const edits = [
          () => pkg.replaceFile("data.1", new Blob(["replacement"])),
          () => pkg.discardFileReplacement("data.1"),
          () => pkg.removeMembers("data.1"),
          () => pkg.setMemberLocation("data.1", "new/location.csv"),
          () => pkg.renameMemberFile("data.1", "renamed.csv"),
          () => pkg.markMemberContentDirty("data.1"),
          () => pkg.setMemberAccessPolicy("data.1", []),
          () => pkg.setPackageAccessPolicy([], { propagate: true }),
        ];

        for (const edit of edits) {
          let caught;
          try {
            await edit();
          } catch (error) {
            caught = error;
          }
          caught.code.should.equal("upload_in_progress");
        }
      });

      it("rejects file staging when a save starts during PID allocation", async () => {
        const { pkg } = buildEditablePackage();
        const allocation = deferred();
        sinon.stub(pkg, "allocatePid").returns(allocation.promise);
        const initialPids = pkg.members.toArray().map((member) => member.pid);

        const edit = pkg.stageLocalFiles([new Blob(["new data"])]);
        pkg.activeUpload = {};
        allocation.resolve("data.new");

        let caught;
        try {
          await edit;
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        pkg.members
          .toArray()
          .map((member) => member.pid)
          .should.deep.equal(initialPids);
        pkg.draftRevision.should.equal(0);
      });

      it("rejects replacement when affected metadata starts uploading during final PID allocation", async () => {
        const replaceMemberPid = sinon.stub().returns(1);
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel: {
            replaceMemberPid,
            set() {},
          },
        });
        sinon.stub(pkg, "_ensureSystemMetadata").resolves();
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
        const metadataAllocationStarted = deferred();
        const metadataAllocation = deferred();
        const allocatePid = sinon.stub(pkg, "allocatePid");
        allocatePid.onFirstCall().resolves("data.2");
        allocatePid.onSecondCall().callsFake(() => {
          metadataAllocationStarted.resolve();
          return metadataAllocation.promise;
        });
        const member = pkg.requireMember("data.1");
        const metadata = pkg.requireMember("meta.1");
        const initialUploadFile = member.uploadFile;
        const initialLinks = resourceMap.getDocumentationLinks();

        const edit = pkg.replaceFile("data.1", new Blob(["replacement"]));
        await metadataAllocationStarted.promise;
        pkg.eagerUploads.set("meta.1", { promise: Promise.resolve() });
        metadataAllocation.resolve("meta.2");

        let caught;
        try {
          await edit;
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        member.pid.should.equal("data.1");
        metadata.pid.should.equal("meta.1");
        should.equal(member.uploadFile, initialUploadFile);
        sinon.assert.notCalled(replaceMemberPid);
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        resourceMap.getDocumentationLinks().should.deep.equal(initialLinks);
        pkg.draftRevision.should.equal(0);
      });

      it("rejects removal when affected metadata starts uploading during final PID allocation", async () => {
        const entity = { id: "entity.1" };
        const removeEntity = sinon.stub();
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel: {
            getEntity: () => entity,
            removeEntity,
            addEntity() {},
            set() {},
          },
        });
        pkg.primaryMetadataPid = "meta.1";
        const allocation = deferred();
        sinon.stub(pkg, "allocatePid").returns(allocation.promise);
        const member = pkg.requireMember("data.1");
        const metadata = pkg.requireMember("meta.1");

        const edit = pkg.removeMembers("data.1");
        pkg.eagerUploads.set("meta.1", { promise: Promise.resolve() });
        allocation.resolve("meta.2");

        let caught;
        try {
          await edit;
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        member.removed.should.equal(false);
        metadata.pid.should.equal("meta.1");
        sinon.assert.notCalled(removeEntity);
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        pkg.primaryMetadataPid.should.equal("meta.1");
        pkg.draftRevision.should.equal(0);
      });

      it("rejects rename when its member starts uploading during preparation", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const preparation = deferred();
        sinon.stub(pkg, "_ensureSystemMetadata").returns(preparation.promise);
        const member = pkg.requireMember("data.1");
        member.fileName = "old.csv";
        member.atLocations = ["old.csv"];
        resourceMap.setLocation("data.1", "old.csv");

        const edit = pkg.renameMemberFile("data.1", "new.csv");
        pkg.eagerUploads.set("data.1", { promise: Promise.resolve() });
        preparation.resolve();

        let caught;
        try {
          await edit;
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        member.fileName.should.equal("old.csv");
        member.atLocations.should.deep.equal(["old.csv"]);
        resourceMap.graphState
          .getMember("data.1")
          .atLocations.should.deep.equal(["old.csv"]);
        pkg.draftRevision.should.equal(0);
      });

      it("rejects dirtying content when its member starts uploading during preparation", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        sinon.stub(pkg, "_ensureSystemMetadata").resolves();
        const allocationStarted = deferred();
        const allocation = deferred();
        sinon.stub(pkg, "allocatePid").callsFake(() => {
          allocationStarted.resolve();
          return allocation.promise;
        });
        const member = pkg.requireMember("data.1");

        const edit = pkg.markMemberContentDirty("data.1");
        await allocationStarted.promise;
        pkg.eagerUploads.set("data.1", { promise: Promise.resolve() });
        allocation.resolve("data.2");

        let caught;
        try {
          await edit;
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        member.pid.should.equal("data.1");
        member.contentDirty.should.equal(false);
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        pkg.draftRevision.should.equal(0);
      });

      it("rejects member policy edits when eager upload starts during preparation", async () => {
        const { pkg } = buildEditablePackage();
        const preparation = deferred();
        sinon.stub(pkg, "_ensureSystemMetadata").returns(preparation.promise);
        const member = pkg.requireMember("data.1");

        const edit = pkg.setMemberAccessPolicy("data.1", []);
        pkg.eagerUploads.set("data.1", { promise: Promise.resolve() });
        preparation.resolve();

        let caught;
        try {
          await edit;
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        should.equal(member.sysMeta, null);
        member.sysMetaDirty.should.equal(false);
        member.accessPolicyDirty.should.equal(false);
        pkg.draftRevision.should.equal(0);
      });

      it("rejects package policy edits when a target starts uploading during preparation", async () => {
        const { pkg } = buildEditablePackage();
        const preparation = deferred();
        sinon.stub(pkg, "_ensureSystemMetadata").returns(preparation.promise);

        const edit = pkg.setPackageAccessPolicy([], { propagate: true });
        pkg.eagerUploads.set("data.1", { promise: Promise.resolve() });
        preparation.resolve();

        let caught;
        try {
          await edit;
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("upload_in_progress");
        pkg.members.toArray().forEach((member) => {
          should.equal(member.sysMeta, null);
          member.sysMetaDirty.should.equal(false);
          member.accessPolicyDirty.should.equal(false);
        });
        pkg.draftRevision.should.equal(0);
      });
    });

    describe("system metadata defaults", () => {
      it("includes an access policy so new objects are never policy-less", () => {
        const defaults = new DataPackage()._uploader.buildSysMetaDefaults();
        // AccessPolicy is an Array subclass with a toJSON(); confirm the
        // default policy is wired into the upload defaults.
        Array.isArray(defaults.accessPolicy).should.equal(true);
        defaults.accessPolicy.toJSON.should.be.a("function");
      });
    });

    describe("access policy edits", () => {
      it("stages rightsHolder changes with member access-policy edits", async () => {
        const { pkg } = buildEditablePackage();

        const member = await pkg.setMemberAccessPolicy("data.1", [], {
          rightsHolder: "uid=new-owner",
        });

        member.sysMeta.rightsHolder.should.equal("uid=new-owner");
        member.sysMeta.accessPolicy.length.should.equal(0);
        member.accessPolicyDirty.should.equal(true);
        member.remoteState.should.equal(DataPackageMember.RemoteState.UPLOADED);
      });

      it("stages rightsHolder changes with package access-policy edits", async () => {
        const { pkg } = buildEditablePackage();

        const members = await pkg.setPackageAccessPolicy([], {
          rightsHolder: "uid=new-owner",
        });

        members
          .map((member) => member.pid)
          .should.deep.equal(["resource_map_1", "meta.1"]);
        members.forEach((member) => {
          member.sysMeta.rightsHolder.should.equal("uid=new-owner");
          member.sysMeta.accessPolicy.length.should.equal(0);
          member.remoteState.should.equal(
            DataPackageMember.RemoteState.UPLOADED,
          );
        });
      });

      it("refreshes every propagated member before staging its policy", async () => {
        const { pkg } = buildEditablePackage();
        pkg.members.toArray().forEach((member) => {
          member.setSystemMetadata(
            new SystemMetadata({
              identifier: member.pid,
              formatId: member.formatId,
              size: 4,
              checksum: "stale-checksum",
              checksumAlgorithm: "MD5",
              submitter: "uid=test",
              rightsHolder: "uid=test",
              fileName: `stale-${member.pid}`,
            }),
            { markDirty: false },
          );
        });
        pkg.sysMetaService.download = sinon.stub().callsFake(
          async (pid, { useCache } = {}) =>
            new SystemMetadata({
              identifier: pid,
              formatId: pkg.requireMember(pid).formatId,
              size: 4,
              checksum:
                useCache === false ? "fresh-checksum" : "stale-checksum",
              checksumAlgorithm: "MD5",
              submitter: "uid=test",
              rightsHolder: "uid=test",
              fileName: useCache === false ? `fresh-${pid}` : `stale-${pid}`,
            }),
        );

        const members = await pkg.setPackageAccessPolicy([], {
          propagate: true,
        });

        members.should.have.lengthOf(3);
        members.forEach((member) => {
          member.remoteSysMeta.fileName.should.equal(`fresh-${member.pid}`);
          member.sysMeta.fileName.should.equal(`fresh-${member.pid}`);
          member.sysMeta.accessPolicy.should.have.lengthOf(0);
        });
      });

      it("uses batchSizeFetch for package access-policy SysMeta fetches", async () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: (key) => (key === "batchSizeFetch" ? 2 : null),
          },
        };

        try {
          const { pkg } = buildEditablePackage();
          const concurrency = trackConcurrency();
          const progress = [];
          pkg.sysMetaService.download = concurrency.track((pid) => {
            const member = pkg.requireMember(pid);
            return new SystemMetadata({
              identifier: pid,
              formatId: member.formatId,
              size: 4,
              checksum: "checksum",
              checksumAlgorithm: "MD5",
              submitter: "uid=test",
              rightsHolder: "uid=test",
            });
          });

          await pkg.setPackageAccessPolicy([], {
            propagate: true,
            onProgress: (event) => progress.push(event),
          });

          concurrency.max.should.equal(2);
          progress
            .map((event) => event.completed)
            .should.deep.equal([0, 1, 2, 3]);
          progress[0].total.should.equal(3);
          progress[progress.length - 1].total.should.equal(3);
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });
    });

    describe("identifier assignment", () => {
      it("keeps an assigned replacement PID stable across retries", async () => {
        const identifierService = {
          generateIdentifier: sinon
            .stub()
            .resolves({ data: { identifier: "data.2" } }),
        };
        const member = new DataPackageMember({ pid: "data.1" });
        member.initializeEditableState({ remotePid: "data.1" });
        const pkg = new DataPackage({ identifierService });
        pkg.members.add(member);

        await pkg.assignReplacementPid(member);
        const assignedPid = member.pid;
        await pkg.assignReplacementPid(member);

        member.pid.should.match(/^urn:uuid:/);
        member.pid.should.equal(assignedPid);
        member.pid.should.not.equal("data.1");
        identifierService.generateIdentifier.called.should.equal(false);
      });

      it("uses a local UUID without calling the identifier service", async () => {
        const generateIdentifier = sinon.stub().rejects(new Error("unused"));
        const pkg = new DataPackage({
          identifierService: {
            generateIdentifier,
          },
        });

        const pid = await pkg.allocatePid();

        pid.should.match(/^urn:uuid:/);
        generateIdentifier.called.should.equal(false);
      });

      it("requires a successful reservation for a custom PID", async () => {
        const pkg = new DataPackage({
          identifierService: {
            reserveIdentifier: sinon
              .stub()
              .rejects(new Error("reservation failed")),
          },
        });

        let caught = null;
        try {
          await pkg.allocatePid({ requestedPid: "custom.1" });
        } catch (error) {
          caught = error;
        }

        caught.message.should.equal("reservation failed");
      });
    });

    describe("domain edits", () => {
      it("adds and removes files with ResourceMap as relationship source", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const setPackageStructure = sinon.spy(
          resourceMap,
          "setPackageStructure",
        );
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);

        const staged = await pkg.stageLocalFiles([new Blob(["new data"])]);
        const [added] = await pkg.linkStagedFiles(staged);

        added.pid.should.match(/^urn:uuid:/);
        resourceMap.graphState.hasMember(added.pid).should.equal(true);
        resourceMap
          .getDocumentationLinks()
          .should.deep.include({ metadataPid: "meta.1", dataPid: added.pid });
        setPackageStructure.calledOnce.should.equal(true);
        assertGraphFieldsMatchMember(pkg, resourceMap, "meta.1");
        assertGraphFieldsMatchMember(pkg, resourceMap, added.pid);
        pkg._uploader.uploadAddedMembers.calledOnce.should.equal(true);
        pkg.draftRevision.should.equal(1);

        await pkg.removeMembers(added.pid);
        resourceMap.graphState.hasMember(added.pid).should.equal(false);
        pkg.getMember("meta.1").documents.should.not.include(added.pid);
        assertGraphFieldsMatchMember(pkg, resourceMap, "meta.1");
        pkg.draftRevision.should.equal(2);
      });

      it("stages local files before ResourceMap linking", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        resourceMap.markSaved();
        const setPackageStructure = sinon.spy(
          resourceMap,
          "setPackageStructure",
        );
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
        const file = new Blob(["new data"], { type: "text/plain" });
        file.name = "new.txt";

        const [staged] = await pkg.stageLocalFiles([file]);

        staged.pid.should.match(/^urn:uuid:/);
        staged.fileName.should.equal("new.txt");
        staged.formatId.should.equal("text/plain");
        staged.remoteState.should.equal(DataPackageMember.RemoteState.PENDING);
        pkg.getMember(staged.pid).should.equal(staged);
        resourceMap.graphState.hasMember(staged.pid).should.equal(false);
        setPackageStructure.called.should.equal(false);
        pkg._uploader.uploadAddedMembers.called.should.equal(false);
        pkg.hasUnsavedChanges().should.equal(true);
        pkg.draftRevision.should.equal(0);
      });

      it("links staged files into the ResourceMap and starts eager upload", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        resourceMap.markSaved();
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
        const file = new Blob(["new data"], { type: "text/csv" });
        file.name = "new.csv";
        const [staged] = await pkg.stageLocalFiles([file]);

        const linked = await pkg.linkStagedFiles([staged], {
          metadataPid: "meta.1",
          atLocation: "data/raw",
        });

        linked.should.deep.equal([staged]);
        resourceMap.graphState.hasMember(staged.pid).should.equal(true);
        resourceMap
          .getDocumentationLinks()
          .should.deep.include({ metadataPid: "meta.1", dataPid: staged.pid });
        staged.atLocations.should.deep.equal(["data/raw/new.csv"]);
        assertGraphFieldsMatchMember(pkg, resourceMap, "meta.1");
        assertGraphFieldsMatchMember(pkg, resourceMap, staged.pid);
        pkg._uploader.uploadAddedMembers.calledOnce.should.equal(true);
        pkg._uploader.uploadAddedMembers.firstCall.args[0].should.deep.equal([
          staged,
        ]);
        pkg.draftRevision.should.equal(1);
      });

      it("removes staged files when ResourceMap linking fails", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        resourceMap.markSaved();
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
        sinon
          .stub(resourceMap, "setMemberLocations")
          .throws(new Error("location failed"));
        const file = new Blob(["new data"]);
        file.name = "new.csv";
        const [staged] = await pkg.stageLocalFiles([file]);

        let caught = null;
        try {
          await pkg.linkStagedFiles([staged], {
            metadataPid: "meta.1",
            atLocation: "data/raw",
          });
        } catch (error) {
          caught = error;
        }

        caught.message.should.equal("location failed");
        expect(pkg.getMember(staged.pid)).to.equal(null);
        resourceMap.graphState.hasMember(staged.pid).should.equal(false);
        resourceMap.getDocumentationLinks().should.not.deep.include({
          metadataPid: "meta.1",
          dataPid: staged.pid,
        });
        assertGraphFieldsMatchMember(pkg, resourceMap, "meta.1");
        pkg._uploader.uploadAddedMembers.called.should.equal(false);
        pkg.hasUnsavedChanges().should.equal(false);
        pkg.draftRevision.should.equal(0);
      });

      it("preserves original and rollback errors when ResourceMap restoration fails", async () => {
        const sandbox = sinon.createSandbox();
        const { pkg, resourceMap } = buildEditablePackage();
        const mutationError = new Error("location failed");
        const rollbackError = new Error("rollback failed");
        const setPackageStructure =
          resourceMap.setPackageStructure.bind(resourceMap);
        const setPackageStructureStub = sandbox.stub(
          resourceMap,
          "setPackageStructure",
        );
        setPackageStructureStub.onFirstCall().callsFake(setPackageStructure);
        setPackageStructureStub.onSecondCall().throws(rollbackError);
        sandbox.stub(resourceMap, "setMemberLocations").throws(mutationError);
        sandbox.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
        const file = new Blob(["new data"]);
        file.name = "new.csv";
        const [staged] = await pkg.stageLocalFiles([file]);

        let caught;
        try {
          await pkg.linkStagedFiles([staged], {
            metadataPid: "meta.1",
            atLocation: "data/raw",
          });
        } catch (error) {
          caught = error;
        } finally {
          sandbox.restore();
        }

        expect(caught).to.equal(mutationError);
        expect(caught.rollbackError).to.equal(rollbackError);
      });

      it("refreshes member caches after documentation and location edits", () => {
        const { pkg, resourceMap } = buildEditablePackage();
        resourceMap.setPackageStructure(
          [...resourceMap.getMemberPids(), "data.2"],
          resourceMap.getDocumentationLinks(),
        );
        pkg.members.add({
          pid: "data.2",
          formatType: "DATA",
          formatId: "text/csv",
          documents: ["stale.data"],
          isDocumentedBy: ["stale.meta"],
          atLocations: ["stale/location.csv"],
        });

        pkg.linkDocumentation("meta.1", "data.2");
        pkg.setMemberLocation("data.2", "data/clean.csv");

        resourceMap
          .getDocumentationLinks()
          .should.deep.include({ metadataPid: "meta.1", dataPid: "data.2" });
        assertGraphFieldsMatchMember(pkg, resourceMap, "meta.1");
        assertGraphFieldsMatchMember(pkg, resourceMap, "data.2");
        pkg
          .getMember("data.2")
          .atLocations.should.deep.equal(["data/clean.csv"]);

        pkg.unlinkDocumentation("meta.1", "data.2");

        resourceMap.getDocumentationLinks().should.not.deep.include({
          metadataPid: "meta.1",
          dataPid: "data.2",
        });
        assertGraphFieldsMatchMember(pkg, resourceMap, "meta.1");
        assertGraphFieldsMatchMember(pkg, resourceMap, "data.2");
      });

      it("inherits metadata access policy for newly added files", async () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: (key) => {
              if (key === "inheritAccessPolicy") return true;
              if (key === "defaultAccessPolicy") {
                return [{ subject: "public", read: true }];
              }
              return null;
            },
          },
          appUserModel: {
            get: (key) => (key === "username" ? "uid=test" : null),
          },
        };

        try {
          const { pkg } = buildEditablePackage();
          sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
          pkg.getMember("meta.1").setSystemMetadata(
            new SystemMetadata({
              identifier: "meta.1",
              formatId: "https://eml.ecoinformatics.org/eml-2.2.0",
              size: 4,
              checksum: "checksum",
              checksumAlgorithm: "MD5",
              submitter: "uid=test",
              rightsHolder: "uid=test",
              accessPolicy: [],
            }),
            { markDirty: false },
          );

          const staged = await pkg.stageLocalFiles([new Blob(["new data"])]);
          const [added] = await pkg.linkStagedFiles(staged);
          const sysMeta = await added.buildObjectSystemMetadata(
            pkg._uploader.buildSysMetaDefaults(),
          );

          sysMeta.accessPolicy.length.should.equal(0);
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });

      it("uses the default access policy when inheritance is disabled", async () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: (key) => {
              if (key === "inheritAccessPolicy") return false;
              if (key === "defaultAccessPolicy") {
                return [{ subject: "public", read: true }];
              }
              return null;
            },
          },
          appUserModel: {
            get: (key) => (key === "username" ? "uid=test" : null),
          },
        };

        try {
          const { pkg } = buildEditablePackage();
          sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
          pkg.getMember("meta.1").setSystemMetadata(
            new SystemMetadata({
              identifier: "meta.1",
              formatId: "https://eml.ecoinformatics.org/eml-2.2.0",
              size: 4,
              checksum: "checksum",
              checksumAlgorithm: "MD5",
              submitter: "uid=test",
              rightsHolder: "uid=test",
              accessPolicy: [],
            }),
            { markDirty: false },
          );

          const staged = await pkg.stageLocalFiles([new Blob(["new data"])]);
          const [added] = await pkg.linkStagedFiles(staged);
          const sysMeta = await added.buildObjectSystemMetadata(
            pkg._uploader.buildSysMetaDefaults(),
          );

          sysMeta.accessPolicy
            .toJSON()
            .should.deep.equal([
              { subjects: ["public"], permissions: ["read"] },
            ]);
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });

      it("renames a member in its sysmeta and ResourceMap location", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const member = pkg.getMember("data.1");
        member.fileName = "old.csv";
        member.atLocations = ["data/raw/old.csv"];
        member.setSystemMetadata(
          new SystemMetadata({
            identifier: "data.1",
            formatId: "text/csv",
            size: 4,
            checksum: "checksum",
            checksumAlgorithm: "MD5",
            submitter: "uid=test",
            rightsHolder: "uid=test",
            fileName: "old.csv",
          }),
          { markDirty: false },
        );
        resourceMap.setLocation("data.1", "data/raw/old.csv");

        await pkg.renameMemberFile("data.1", "new.csv");

        member.fileName.should.equal("new.csv");
        member.sysMeta.fileName.should.equal("new.csv");
        member.sysMetaDirty.should.equal(true);
        member
          .getRequiredOperation()
          .should.equal(
            DataPackageMember.RequiredOperation.UPDATE_SYSTEM_METADATA,
          );
        member.atLocations.should.deep.equal(["data/raw/new.csv"]);
        resourceMap.graphState
          .getMember("data.1")
          .atLocations.should.deep.equal(["data/raw/new.csv"]);
        assertGraphFieldsMatchMember(pkg, resourceMap, "data.1");
      });

      it("renames matching file name suffixes without changing other locations", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const member = pkg.getMember("data.1");
        member.fileName = "old.csv";
        member.atLocations = [
          "./measurements/../qc/file-062.json",
          "/analysis/old.csv",
          "ark:/12345/abc",
          "https://example.org/data/old.csv",
          "s3://bucket/archive/old.csv",
        ];
        member.setSystemMetadata(
          new SystemMetadata({
            identifier: "data.1",
            formatId: "text/plain",
            size: 4,
            checksum: "checksum",
            checksumAlgorithm: "MD5",
            submitter: "uid=test",
            rightsHolder: "uid=test",
            fileName: "old.csv",
          }),
          { markDirty: false },
        );
        resourceMap.setMemberLocations([
          { pid: "data.1", atLocations: member.atLocations },
        ]);

        await pkg.renameMemberFile("data.1", "new.csv");

        member.fileName.should.equal("new.csv");
        member.atLocations.should.deep.equal([
          "./measurements/../qc/file-062.json",
          "/analysis/new.csv",
          "ark:/12345/abc",
          "https://example.org/data/new.csv",
          "s3://bucket/archive/new.csv",
        ]);
        resourceMap.graphState
          .getMember("data.1")
          .atLocations.should.deep.equal([
            "./measurements/../qc/file-062.json",
            "/analysis/new.csv",
            "ark:/12345/abc",
            "https://example.org/data/new.csv",
            "s3://bucket/archive/new.csv",
          ]);
        assertGraphFieldsMatchMember(pkg, resourceMap, "data.1");
      });

      it("renames a member with a root-level ResourceMap location", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const member = pkg.getMember("data.1");
        member.fileName = "old.csv";
        member.atLocations = ["old.csv"];
        member.setSystemMetadata(
          new SystemMetadata({
            identifier: "data.1",
            formatId: "text/csv",
            size: 4,
            checksum: "checksum",
            checksumAlgorithm: "MD5",
            submitter: "uid=test",
            rightsHolder: "uid=test",
            fileName: "old.csv",
          }),
          { markDirty: false },
        );
        resourceMap.setLocation("data.1", "old.csv");

        await pkg.renameMemberFile("data.1", "new.csv");

        member.fileName.should.equal("new.csv");
        member.atLocations.should.deep.equal(["new.csv"]);
        resourceMap.graphState
          .getMember("data.1")
          .atLocations.should.deep.equal(["new.csv"]);
        assertGraphFieldsMatchMember(pkg, resourceMap, "data.1");
      });

      it("removes matching EML entities when members are removed", async () => {
        const entity = { id: "entity.1" };
        const removedEntities = [];
        const metadataObjectModel = {
          id: "meta.1",
          set(key, value) {
            this[key] = value;
          },
          getEntity(member) {
            return member.pid === "data.1" ? entity : null;
          },
          removeEntity(removedEntity) {
            removedEntities.push(removedEntity);
          },
          addEntity() {},
        };
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel,
        });

        await pkg.removeMembers("data.1");

        const metadataMember = pkg.getMetadataMembers()[0];
        removedEntities.should.deep.equal([entity]);
        metadataMember.pid.should.match(/^urn:uuid:/);
        metadataMember.contentDirty.should.equal(true);
        metadataObjectModel.id.should.equal(metadataMember.pid);
        resourceMap.graphState.hasMember("data.1").should.equal(false);
        resourceMap.graphState.hasMember(metadataMember.pid).should.equal(true);
        assertGraphFieldsMatchMember(pkg, resourceMap, metadataMember.pid);
      });

      it("restores primary metadata PID when member removal rolls back", async () => {
        const setError = new Error("metadata id update failed");
        const metadataObjectModel = {
          id: "meta.1",
          set(key, value) {
            if (value !== "meta.1") throw setError;
            this[key] = value;
          },
          getEntity(member) {
            return member.pid === "data.1" ? { id: "entity.1" } : null;
          },
          removeEntity() {},
          addEntity() {},
        };
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel,
        });
        pkg.primaryMetadataPid = "meta.1";

        let caught = null;
        try {
          await pkg.removeMembers("data.1");
        } catch (error) {
          caught = error;
        }

        caught.should.equal(setError);
        pkg.primaryMetadataPid.should.equal("meta.1");
        pkg.getMember("meta.1").pid.should.equal("meta.1");
        pkg.getMember("data.1").removed.should.equal(false);
        resourceMap.getMemberPids().should.have.members(["meta.1", "data.1"]);
      });

      it("replaces data and updates metadata references without a view", async () => {
        const references = ["data.1"];
        const metadataObjectModel = {
          id: "meta.1",
          set(key, value) {
            this[key] = value;
          },
          replaceMemberPid(oldPid, newPid) {
            const index = references.indexOf(oldPid);
            if (index < 0) return 0;
            references[index] = newPid;
            return 1;
          },
        };
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel,
        });
        const uploadAddedMembers = sinon
          .stub(pkg._uploader, "uploadAddedMembers")
          .resolves([]);

        const member = await pkg.replaceFile(
          "data.1",
          new Blob(["replacement"]),
        );
        const metadataMember = pkg.getMetadataMembers()[0];

        member.pid.should.match(/^urn:uuid:/);
        references.should.deep.equal([member.pid]);
        resourceMap.graphState.hasMember("data.1").should.equal(false);
        resourceMap.graphState.hasMember(member.pid).should.equal(true);
        resourceMap.graphState.hasMember(metadataMember.pid).should.equal(true);
        assertGraphFieldsMatchMember(pkg, resourceMap, member.pid);
        assertGraphFieldsMatchMember(pkg, resourceMap, metadataMember.pid);
        metadataMember.contentDirty.should.equal(true);
        metadataObjectModel.id.should.equal(metadataMember.pid);
        pkg.draftRevision.should.equal(1);
        // The replaced content is uploaded eagerly so the file table can show
        // progress instead of leaving the member PENDING until the next save.
        uploadAddedMembers.calledOnce.should.equal(true);
        uploadAddedMembers.firstCall.args[0].should.deep.equal([member]);
      });

      it("retargets replacement upload source without switching the package row", async () => {
        const references = ["data.1"];
        const metadataObjectModel = {
          id: "meta.1",
          set(key, value) {
            this[key] = value;
          },
          replaceMemberPid(oldPid, newPid) {
            const index = references.indexOf(oldPid);
            if (index < 0) return 0;
            references[index] = newPid;
            return 1;
          },
        };
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel,
        });
        pkg.sysMetaService.download = sinon.stub().callsFake(
          async (pid) =>
            new SystemMetadata({
              identifier: pid,
              formatId: "text/csv",
              size: 4,
              checksum: "checksum",
              checksumAlgorithm: "MD5",
              submitter: "uid=test",
              rightsHolder: "uid=test",
            }),
        );
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);

        const member = await pkg.replaceFile(
          "data.1",
          new Blob(["replacement"]),
          { replacementSourcePid: "data.2" },
        );

        member.pid.should.match(/^urn:uuid:/);
        member.remotePid.should.equal("data.1");
        member._replacementSourcePid.should.equal("data.2");
        member._replacementSourceSysMeta.identifier.should.equal("data.2");
        references.should.deep.equal([member.pid]);
        resourceMap.graphState.hasMember("data.1").should.equal(false);
        resourceMap.graphState.hasMember(member.pid).should.equal(true);
        sinon.assert.calledWith(pkg.sysMetaService.download, "data.2");
      });

      it("discards a failed file replacement back to its remote PID", async () => {
        const references = ["data.1"];
        const metadataObjectModel = {
          set(key, value) {
            this[key] = value;
          },
          replaceMemberPid(oldPid, newPid) {
            const index = references.indexOf(oldPid);
            if (index < 0) return 0;
            references[index] = newPid;
            return 1;
          },
        };
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel,
        });
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);
        const originalMember = pkg.requireMember("data.1");
        originalMember.fileName = "original.csv";
        originalMember.title = "Original title";

        const member = await pkg.replaceFile(
          "data.1",
          new File(["replacement"], "replacement.csv", { type: "text/csv" }),
        );
        const replacementPid = member.pid;
        member.fileName.should.equal("replacement.csv");
        member._replacementDisplay.pid.should.equal("data.1");
        member._replacementDisplay.fileName.should.equal("original.csv");
        member._replacementDisplay.title.should.equal("Original title");
        member.markRemoteFailure(new Error("already obsolete"));

        const restored = pkg.discardFileReplacement(replacementPid);

        restored.should.equal(member);
        member.pid.should.equal("data.1");
        member.remotePid.should.equal("data.1");
        member.remoteState.should.equal(DataPackageMember.RemoteState.UPLOADED);
        member.contentDirty.should.equal(false);
        should.equal(member.lastUploadError, null);
        should.equal(member.uploadFile, null);
        should.equal(member._replacementDisplay, null);
        should.equal(pkg.getMember(replacementPid), null);
        pkg.getMember("data.1").should.equal(member);
        references.should.deep.equal(["data.1"]);
        resourceMap.graphState.hasMember(replacementPid).should.equal(false);
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        assertGraphFieldsMatchMember(pkg, resourceMap, "data.1");
      });

      it("clears retargeted replacement state when discarding a failed replacement", async () => {
        const { pkg } = buildEditablePackage();
        sinon.stub(pkg._uploader, "uploadAddedMembers").resolves([]);

        const member = await pkg.replaceFile(
          "data.1",
          new Blob(["replacement"]),
          { replacementSourcePid: "data.2" },
        );
        const replacementPid = member.pid;
        member._replacementSourcePid.should.equal("data.2");
        member._replacementSourceSysMeta.identifier.should.equal("data.2");
        member.markRemoteFailure(new Error("already obsolete"));

        pkg.discardFileReplacement(replacementPid);

        member.pid.should.equal("data.1");
        member.remotePid.should.equal("data.1");
        should.equal(member._replacementSourcePid, null);
        should.equal(member._replacementSourceSysMeta, null);
      });

      it("loads remote sysmeta before allocating replacement PIDs", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const baselineError = new Error("sysmeta unavailable");
        pkg.sysMetaService.download = sinon.stub().rejects(baselineError);
        pkg.identifierService = {
          generateIdentifier: sinon.stub().resolves({
            data: { identifier: "data.2" },
          }),
        };

        let caught;
        try {
          await pkg.replaceFile("data.1", new Blob(["replacement"]));
        } catch (error) {
          caught = error;
        }

        caught.should.equal(baselineError);
        pkg.identifierService.generateIdentifier.called.should.equal(false);
        pkg.getMember("data.1").pid.should.equal("data.1");
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        pkg.draftRevision.should.equal(0);
      });

      it("rolls back replacement when metadata-reference updating fails", async () => {
        const metadataObjectModel = {
          replaceMemberPid() {
            throw new Error("metadata update failed");
          },
        };
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel,
        });

        let caught = null;
        try {
          await pkg.replaceFile("data.1", new Blob(["replacement"]));
        } catch (error) {
          caught = error;
        }

        caught.message.should.equal("metadata update failed");
        pkg.getMember("data.1").pid.should.equal("data.1");
        pkg.getMember("meta.1").pid.should.equal("meta.1");
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        resourceMap.getMemberPids().should.have.members(["meta.1", "data.1"]);
        pkg.draftRevision.should.equal(0);
      });

      it("restores primary metadata PID when marking metadata dirty rolls back", async () => {
        const setError = new Error("metadata id update failed");
        const metadataObjectModel = {
          id: "meta.1",
          set(key, value) {
            if (value !== "meta.1") throw setError;
            this[key] = value;
          },
        };
        const { pkg, resourceMap } = buildEditablePackage({
          metadataObjectModel,
        });
        pkg.primaryMetadataPid = "meta.1";

        let caught = null;
        try {
          await pkg.markMemberContentDirty("meta.1");
        } catch (error) {
          caught = error;
        }

        caught.should.equal(setError);
        pkg.primaryMetadataPid.should.equal("meta.1");
        pkg.getMember("meta.1").pid.should.equal("meta.1");
        resourceMap.graphState.hasMember("meta.1").should.equal(true);
        pkg.draftRevision.should.equal(0);
      });

      it("refreshes stale member relationships from ResourceMap before upload prep", async () => {
        const sandbox = sinon.createSandbox();
        try {
          const { pkg, resourceMap } = buildEditablePackage();
          pkg.getMember("meta.1").documents = ["stale.data"];
          pkg.getMember("data.1").isDocumentedBy = ["stale.meta"];
          const setPackageStructure = sandbox.spy(
            resourceMap,
            "setPackageStructure",
          );
          sandbox.stub(pkg._uploader, "assertSourcesAreLatest").resolves();
          sandbox.stub(pkg._uploader, "allocateUploadPids").resolves();
          sandbox.stub(pkg._uploader, "buildUploadActions").resolves([]);
          sandbox
            .stub(pkg._uploader, "prepareResourceMapAction")
            .callsFake(async () => {
              resourceMap
                .getDocumentationLinks()
                .should.deep.equal([
                  { metadataPid: "meta.1", dataPid: "data.1" },
                ]);
              return null;
            });
          sandbox.stub(pkg._uploader, "assertWritePermissions").resolves();

          await pkg._uploader._prepareUploadActions();

          sinon.assert.notCalled(setPackageStructure);
          assertGraphFieldsMatchMember(pkg, resourceMap, "meta.1");
          assertGraphFieldsMatchMember(pkg, resourceMap, "data.1");
          pkg.getMember("meta.1").documents.should.not.include("stale.data");
          pkg
            .getMember("data.1")
            .isDocumentedBy.should.not.include("stale.meta");
        } finally {
          sandbox.restore();
        }
      });

      it("clears graph projection caches without changing parent ResourceMap metadata", () => {
        const sandbox = sinon.createSandbox();
        try {
          const { pkg, resourceMap } = buildEditablePackage();
          const member = pkg.getMember("data.1");
          member.documents = ["stale.data"];
          member.isDocumentedBy = ["stale.meta"];
          member.atLocations = ["stale/location.csv"];
          member.resourceMap = ["indexed.parent"];
          resourceMap.removeMembers(["data.1"]);
          const getSummary = sandbox
            .stub(resourceMap, "getSummary")
            .throws(new Error("summary should not be cloned"));

          pkg.refreshMemberGraphFields(resourceMap);

          sinon.assert.notCalled(getSummary);
          member.documents.should.deep.equal([]);
          member.isDocumentedBy.should.deep.equal([]);
          member.atLocations.should.deep.equal([]);
          member.resourceMap.should.deep.equal(["indexed.parent"]);
        } finally {
          sandbox.restore();
        }
      });

      [
        ["replaceFile", (pkg, pid) => pkg.replaceFile(pid, new Blob(["new"]))],
        [
          "renameMemberFile",
          (pkg, pid) => pkg.renameMemberFile(pid, "new.xml"),
        ],
        [
          "markMemberContentDirty",
          (pkg, pid) => pkg.markMemberContentDirty(pid),
        ],
        [
          "setMemberAccessPolicy",
          (pkg, pid) => pkg.setMemberAccessPolicy(pid, []),
        ],
        [
          "ensureResourceMapUploadPid",
          (pkg, pid) => pkg.ensureResourceMapUploadPid(pkg.requireMember(pid)),
        ],
      ].forEach(([method, edit]) => {
        it(`rejects ${method} for a nested ResourceMap`, async () => {
          const { pkg, resourceMap } = buildEditablePackage();
          const nested = addNestedResourceMap(pkg, resourceMap);
          let caught;

          try {
            await edit(pkg, nested.pid);
          } catch (error) {
            caught = error;
          }

          caught.code.should.equal("nested_resource_map_edit_unsupported");
          nested.pid.should.equal("nested.package.1");
          nested.contentDirty.should.equal(false);
          nested.sysMetaDirty.should.equal(false);
          pkg.draftRevision.should.equal(0);
        });
      });

      it("rejects propagated sharing before staging nested ResourceMap changes", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const nested = addNestedResourceMap(pkg, resourceMap);
        let caught;

        try {
          await pkg.setPackageAccessPolicy([], { propagate: true });
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("nested_resource_map_edit_unsupported");
        nested.sysMetaDirty.should.equal(false);
        pkg.members
          .toArray()
          .some((member) => member.sysMetaDirty)
          .should.equal(false);
        pkg.draftRevision.should.equal(0);
      });

      it("rejects root ResourceMap removal before changing any member", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const root = pkg.getRootResourceMapMember();
        let caught;

        try {
          await pkg.removeMembers([root.pid, "data.1"]);
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("root_resource_map_removal_unsupported");
        root.removed.should.equal(false);
        pkg.requireMember("data.1").removed.should.equal(false);
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        pkg.draftRevision.should.equal(0);
      });

      it("rejects primary metadata removal before changing any package state", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        pkg.primaryMetadataPid = "meta.1";
        const primary = pkg.getPrimaryMetadataMember();
        const initialPids = resourceMap.getMemberPids();
        const initialLinks = resourceMap.getDocumentationLinks();
        const allocatePid = sinon.spy(pkg, "allocatePid");

        let caught;
        try {
          await pkg.removeMembers([primary.pid, "data.1"]);
        } catch (error) {
          caught = error;
        }

        caught.code.should.equal("primary_metadata_removal_unsupported");
        primary.removed.should.equal(false);
        pkg.requireMember("data.1").removed.should.equal(false);
        resourceMap.getMemberPids().should.deep.equal(initialPids);
        resourceMap.getDocumentationLinks().should.deep.equal(initialLinks);
        pkg.primaryMetadataPid.should.equal("meta.1");
        pkg.draftRevision.should.equal(0);
        sinon.assert.notCalled(allocatePid);
      });

      it("allows nested ResourceMap removal as de-aggregation", async () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const nested = addNestedResourceMap(pkg, resourceMap);

        await pkg.removeMembers(nested.pid);

        nested.removed.should.equal(true);
        resourceMap.graphState.hasMember(nested.pid).should.equal(false);
        pkg.getRootResourceMapMember().pid.should.equal("resource_map_1");
        pkg.draftRevision.should.equal(1);
      });

      it("records provenance edits through one package event", () => {
        const { pkg, resourceMap } = buildEditablePackage();
        const changed = sinon.spy();
        pkg.events.on("provenance:changed", changed);

        pkg.addWasDerivedFrom("data.1", "external.source");

        resourceMap.provenance
          .getWasDerivedFromLinks()
          .should.deep.equal([
            { derivedPid: "data.1", sourcePid: "external.source" },
          ]);
        changed.calledOnce.should.equal(true);
        changed.firstCall.args[0].operation.should.equal("addWasDerivedFrom");
        pkg.draftRevision.should.equal(1);
      });
    });

    describe("getLatestVersionPid()", () => {
      it("uses the injected version tracker to resolve the newest metadata PID", async () => {
        const getLatestVersion = sinon.stub().resolves("meta.2");
        const pkg = buildPackage(
          [
            { pid: "meta.1", formatType: "METADATA" },
            { pid: "resource_map_1", formatType: "RESOURCE" },
          ],
          "resource_map_1",
        );
        pkg.versionTracker = { getLatestVersion };

        const latest = await pkg.getLatestVersionPid();

        latest.should.equal("meta.2");
        getLatestVersion.calledOnceWith("meta.1").should.equal(true);
      });

      it("propagates metadata latest-version lookup failures", async () => {
        const lookupError = new Error("offline");
        const getLatestVersion = sinon.stub().rejects(lookupError);
        const pkg = buildPackage(
          [
            { pid: "meta.1", formatType: "METADATA" },
            { pid: "resource_map_1", formatType: "RESOURCE" },
          ],
          "resource_map_1",
        );
        pkg.versionTracker = { getLatestVersion };

        let caught;
        try {
          await pkg.getLatestVersionPid();
        } catch (error) {
          caught = error;
        }

        expect(caught).to.equal(lookupError);
      });

      it("propagates resource map latest-version lookup failures", async () => {
        const lookupError = new Error("offline");
        const getLatestVersion = sinon.stub().rejects(lookupError);
        const pkg = buildPackage(
          [{ pid: "resource_map_1", formatType: "RESOURCE" }],
          "resource_map_1",
        );
        sinon.stub(pkg, "getManifestFromResourceMap").resolves({ ok: true });
        pkg.versionTracker = { getLatestVersion };

        let caught;
        try {
          await pkg.getLatestVersionPid();
        } catch (error) {
          caught = error;
        }

        expect(caught).to.equal(lookupError);
      });
    });

    describe("resolveFromPid() field assignment", () => {
      let sandbox;
      let awaitObjectFormats;
      let trackMissingResourceMap;
      beforeEach(() => {
        sandbox = sinon.createSandbox();
        awaitObjectFormats = sandbox
          .stub(Utilities, "awaitObjectFormats")
          .resolves([]);
        trackMissingResourceMap = sandbox.stub(
          ResourceMapResolver.prototype,
          "trackMissingResourceMap",
        );
      });
      afterEach(() => {
        sandbox.restore();
      });

      it("persists inputId, rootResourceMapPid, and resolutionResult", async () => {
        const pkg = new DataPackage();
        // Stub the resolver so resolveFromPid takes the resource-map-found
        // path without any network access or sysmeta fallback.
        sandbox.stub(ResourceMapResolver.prototype, "resolve").resolves({
          pid: "input.1",
          rm: "resource_map_1",
          meta: {},
        });

        const result = await pkg.resolveFromPid("input.1", {
          resolverOptions: { metaServiceUrl: "https://example.org/sysmeta" },
        });

        pkg.inputId.should.equal("input.1");
        pkg.rootResourceMapPid.should.equal("resource_map_1");
        pkg.resolutionResult.should.equal(result);
        result.success.should.equal(true);
      });

      it("persists primaryMetadataPid when resolution identifies metadata", async () => {
        const pkg = new DataPackage();
        sandbox.stub(ResourceMapResolver.prototype, "resolve").resolves({
          pid: "meta.1",
          rm: "resource_map_1",
          meta: {
            formatType: "METADATA",
            isMetadata: true,
            indexMatch: {
              id: "meta.1",
              formatType: "METADATA",
            },
          },
        });

        await pkg.resolveFromPid("meta.1");

        pkg.primaryMetadataPid.should.equal("meta.1");
        pkg.getPrimaryMetadataMember().pid.should.equal("meta.1");
      });

      it("preserves multiple-ResourceMap resolver details", async () => {
        const pkg = new DataPackage();
        sandbox.stub(ResourceMapResolver.prototype, "resolve").resolves({
          pid: "meta.1",
          rm: null,
          meta: {
            rms: ["resource_map_1", "resource_map_2"],
            metadataCandidates: ["meta.1", "meta.2"],
          },
          multipleRMs: true,
        });
        sandbox
          .stub(ResourceMapResolver.prototype, "getSysMeta")
          .resolves(null);

        const result = await pkg.resolveFromPid("meta.1");

        result.multipleRMs.should.equal(true);
        // Candidates are surfaced so the view can link to each ambiguous
        // dataset instead of guessing one.
        result.candidateResourceMapPids.should.deep.equal([
          "resource_map_1",
          "resource_map_2",
        ]);
        result.candidateMetadataPids.should.deep.equal(["meta.1", "meta.2"]);
        pkg.resolutionResult.should.equal(result);
        sinon.assert.calledOnceWithExactly(trackMissingResourceMap, "meta.1");
      });

      it("recognizes an unindexed resource map from its system metadata", async () => {
        const pkg = new DataPackage();
        sandbox.stub(ResourceMapResolver.prototype, "resolve").resolves({
          pid: "resource_map_1",
          rm: null,
          meta: {},
        });
        sandbox.stub(ResourceMapResolver.prototype, "getSysMeta").resolves(
          new SystemMetadata({
            identifier: "resource_map_1",
            formatId: RESOURCE_MAP_FORMAT_ID,
          }),
        );

        const result = await pkg.resolveFromPid("resource_map_1");

        result.success.should.equal(true);
        result.isResourceMap.should.equal(true);
        pkg.rootResourceMapPid.should.equal("resource_map_1");
        sinon.assert.notCalled(trackMissingResourceMap);
      });

      it("does not recognize an unindexed non-ORE resource as a resource map", async () => {
        const formatId =
          "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html";
        const pkg = new DataPackage();
        sandbox.stub(ResourceMapResolver.prototype, "resolve").resolves({
          pid: "annotation.1",
          rm: null,
          meta: {},
        });
        sandbox.stub(ResourceMapResolver.prototype, "getSysMeta").resolves(
          new SystemMetadata({
            identifier: "annotation.1",
            formatId,
          }),
        );
        awaitObjectFormats.resolves([{ formatId, formatType: "RESOURCE" }]);

        const result = await pkg.resolveFromPid("annotation.1");

        result.success.should.equal(false);
        result.isResourceMap.should.equal(false);
        result.type.should.equal("RESOURCE");
        expect(pkg.rootResourceMapPid).to.equal(null);
        sinon.assert.calledOnceWithExactly(
          trackMissingResourceMap,
          "annotation.1",
        );
      });

      [
        {
          label: "metadata",
          formatId: "https://eml.ecoinformatics.org/eml-2.2.0",
          formatType: "METADATA",
          resultField: "isMetadata",
        },
        {
          label: "data",
          formatId: "text/csv",
          formatType: "DATA",
          resultField: "isData",
        },
      ].forEach(({ label, formatId, formatType, resultField }) => {
        it(`classifies unindexed ${label} from its format ID`, async () => {
          const pkg = new DataPackage();
          sandbox.stub(ResourceMapResolver.prototype, "resolve").resolves({
            pid: `${label}.1`,
            rm: null,
            meta: {},
          });
          sandbox.stub(ResourceMapResolver.prototype, "getSysMeta").resolves(
            new SystemMetadata({
              identifier: `${label}.1`,
              formatId,
            }),
          );
          awaitObjectFormats.resolves([{ formatId, formatType }]);

          const result = await pkg.resolveFromPid(`${label}.1`);

          result[resultField].should.equal(true);
          result.type.should.equal(formatType);
          pkg.getMember(`${label}.1`).formatType.should.equal(formatType);
          if (label === "metadata") {
            pkg.primaryMetadataPid.should.equal("metadata.1");
          }
        });
      });
    });

    describe("checkResourceMapWritePermission()", () => {
      let sandbox;
      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });
      afterEach(() => {
        sandbox.restore();
      });

      it("returns false when no resource map is resolved", async () => {
        const pkg = new DataPackage();
        (await pkg.checkResourceMapWritePermission()).should.equal(false);
      });

      it("reflects the root resource map member's write permission", async () => {
        const pkg = new DataPackage();
        pkg.rootResourceMapPid = "resource_map_1";
        pkg.members.add({ pid: "resource_map_1", formatType: "RESOURCE" });
        const stub = sandbox
          .stub(pkg.getRootResourceMapMember(), "checkWritePermission")
          .resolves(true);

        (await pkg.checkResourceMapWritePermission(true)).should.equal(true);
        stub.calledWith(true).should.equal(true);
      });

      it("does not require metadata write permission", async () => {
        const pkg = new DataPackage();
        pkg.rootResourceMapPid = "resource_map_1";
        pkg.members.add({ pid: "resource_map_1", formatType: "RESOURCE" });
        pkg.members.add({ pid: "meta.1", formatType: "METADATA" });
        sandbox
          .stub(pkg.getRootResourceMapMember(), "checkWritePermission")
          .resolves(true);
        const metaStub = sandbox.stub(
          pkg.getPrimaryMetadataMember(),
          "checkWritePermission",
        );

        (await pkg.checkResourceMapWritePermission()).should.equal(true);
        metaStub.called.should.equal(false);
      });
    });

    describe("publish()", () => {
      let sandbox;
      let originalMetacatUI;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
        originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: (key) =>
              key === "publishServiceUrl"
                ? "https://example.org/publish"
                : originalMetacatUI?.appModel?.get?.(key),
          },
        };
      });

      afterEach(() => {
        sandbox.restore();
        globalThis.MetacatUI = originalMetacatUI;
      });

      function buildPublishPackage(sysMetaService) {
        return new DataPackage({
          members: [{ pid: "source.1", formatType: "METADATA" }],
          sysMetaService,
        });
      }

      it("returns the published outcome on normal success", async () => {
        const publish = sandbox
          .stub(PublishService.prototype, "publish")
          .resolves("published.1");
        const pkg = buildPublishPackage();

        const result = await pkg.publish();

        result.should.deep.equal({
          pid: "published.1",
          resourceMapPending: false,
        });
        sinon.assert.calledOnceWithExactly(publish, "source.1");
      });

      it("marks the resource map pending after a timed-out publish", async () => {
        const timeout = Object.assign(new Error("timeout"), {
          name: "TimeoutError",
        });
        sandbox.stub(PublishService.prototype, "publish").rejects(timeout);
        const download = sandbox.stub();
        download.withArgs("source.1", { useCache: false }).resolves(
          new SystemMetadata({
            identifier: "source.1",
            obsoletedBy: "published.1",
          }),
        );
        download.withArgs("published.1", { useCache: false }).resolves(
          new SystemMetadata({
            identifier: "published.1",
            obsoletes: "source.1",
          }),
        );
        sandbox
          .stub(ResourceMapResolver.prototype, "resolve")
          .resolves({ rm: null });
        const pkg = buildPublishPackage({ download });

        const result = await pkg.publish();

        result.should.deep.equal({
          pid: "published.1",
          resourceMapPending: true,
        });
        sinon.assert.calledTwice(download);
      });

      it("confirms the resource map after recovering a timed-out publish", async () => {
        const timeout = Object.assign(new Error("timeout"), {
          name: "TimeoutError",
        });
        sandbox.stub(PublishService.prototype, "publish").rejects(timeout);
        const download = sandbox.stub();
        download.withArgs("source.1", { useCache: false }).resolves(
          new SystemMetadata({
            identifier: "source.1",
            obsoletedBy: "published.1",
          }),
        );
        download.withArgs("published.1", { useCache: false }).resolves(
          new SystemMetadata({
            identifier: "published.1",
            obsoletes: "source.1",
          }),
        );
        sandbox
          .stub(ResourceMapResolver.prototype, "resolve")
          .withArgs("published.1")
          .resolves({ rm: "resource_map.2" });
        const pkg = buildPublishPackage({ download });

        const result = await pkg.publish();

        result.should.deep.equal({
          pid: "published.1",
          resourceMapPending: false,
        });
      });

      it("rethrows the original ambiguous error when recovery is unconfirmed", async () => {
        const timeout = Object.assign(new Error("timeout"), {
          name: "TimeoutError",
        });
        sandbox.stub(PublishService.prototype, "publish").rejects(timeout);
        const download = sandbox.stub();
        download.withArgs("source.1", { useCache: false }).resolves(
          new SystemMetadata({
            identifier: "source.1",
            obsoletedBy: "published.1",
          }),
        );
        download.withArgs("published.1", { useCache: false }).resolves(
          new SystemMetadata({
            identifier: "published.1",
            obsoletes: "someone.else",
          }),
        );
        const pkg = buildPublishPackage({ download });

        let caught;
        try {
          await pkg.publish();
        } catch (error) {
          caught = error;
        }

        caught.should.equal(timeout);
        sinon.assert.calledTwice(download);
      });

      it("does not perform recovery lookup for non-ambiguous publish errors", async () => {
        const rejected = Object.assign(new Error("forbidden"), {
          status: 403,
        });
        sandbox.stub(PublishService.prototype, "publish").rejects(rejected);
        const download = sandbox.stub();
        const pkg = buildPublishPackage({ download });

        let caught;
        try {
          await pkg.publish();
        } catch (error) {
          caught = error;
        }

        caught.should.equal(rejected);
        sinon.assert.notCalled(download);
      });
    });
  });
});
