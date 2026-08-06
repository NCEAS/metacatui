"use strict";

/**
 * Integration test for DataPackage editing at the editor's default ~700-member
 * limit. Through the public API, the suite checks that:
 *
 * - a metadata only save writes and clears a recovery record containing the
 *   exact ResourceMap;
 * - linking staged files up to that limit preserves their folder locations;
 *   and
 * - removing every data member leaves only the metadata member and its
 *   self-documentation link, with no dangling provenance.
 *
 * DataONE calls and recovery persistence use fakes. Package orchestration,
 * ResourceMap parsing and serialization, membership and provenance mutations,
 * and recovery-record construction run for real.
 *
 * The generous timeouts detect hangs and severe regressions at this package
 * size (they are not performance benchmarks).
 */
define([
  "models/dataPackage/DataPackage",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapResolver",
  "models/sysmeta/SystemMetadata",
  "models/dataONEServices/ObjectService",
  "models/dataONEServices/SysMetaService",
  "common/QueryService",
], (
  DataPackage,
  ResourceMap,
  ResourceMapResolver,
  SystemMetadata,
  ObjectService,
  SysMetaService,
  QueryService,
) => {
  const should = chai.should();

  const RESOURCE_MAP_FORMAT_ID = "http://www.openarchives.org/ore/terms";
  const EML_FORMAT_ID = "https://eml.ecoinformatics.org/eml-2.2.0";
  const RESOLVE_BASE = "https://cn.test.dataone.org/cn/v2/resolve";

  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  afterEach(() => sandbox.restore());

  function systemMetadata(pid, formatId = "text/csv") {
    return new SystemMetadata({
      identifier: pid,
      formatId,
      size: 4,
      checksum: "checksum",
      checksumAlgorithm: "MD5",
      submitter: "uid=test",
      rightsHolder: "uid=test",
      accessPolicy: [],
    });
  }

  /**
   * Load a large existing package (1 metadata + N-1 data members) through the
   * public load path with external services faked, then return it ready to edit.
   * @param {number} memberCount Total member count including the metadata doc
   * @returns {Promise<object>} The package and in-memory recovery state
   */
  async function loadLargePackage(memberCount) {
    const metadataPid = "meta.1";
    const rmPid = "resource_map_1";
    const dataPids = [];
    for (let i = 0; i < memberCount - 1; i += 1) {
      dataPids.push(`data.${String(i).padStart(5, "0")}`);
    }
    const memberPids = [metadataPid, ...dataPids];
    const links = [
      { metadataPid, dataPid: metadataPid },
      ...dataPids.map((dataPid) => ({ metadataPid, dataPid })),
    ];
    const rmXml = ResourceMap.create({
      resourceMapPid: rmPid,
      resolveServiceUrl: RESOLVE_BASE,
      memberPids,
      documentationLinks: links,
    }).serialize({ validate: false });

    sandbox.stub(ResourceMapResolver.prototype, "resolve").resolves({
      success: true,
      pid: metadataPid,
      rm: rmPid,
      meta: {
        formatType: "METADATA",
        isMetadata: true,
        isData: false,
        isResourceMap: false,
        indexMatch: {
          id: metadataPid,
          formatId: EML_FORMAT_ID,
          formatType: "METADATA",
        },
      },
    });
    sandbox.stub(ResourceMapResolver.prototype, "getSysMeta").resolves(null);
    sandbox
      .stub(ObjectService.prototype, "download")
      .callsFake(async (pid) =>
        pid === rmPid
          ? new Blob([rmXml], { type: "application/xml" })
          : Promise.reject(Object.assign(new Error("404"), { status: 404 })),
      );
    sandbox
      .stub(SysMetaService.prototype, "download")
      .callsFake(async (pid) =>
        systemMetadata(
          pid,
          pid === rmPid
            ? RESOURCE_MAP_FORMAT_ID
            : pid === metadataPid
              ? EML_FORMAT_ID
              : "text/csv",
        ),
      );
    sandbox.stub(QueryService, "queryWithFetch").resolves({
      response: {
        numFound: memberPids.length,
        docs: [
          { id: metadataPid, formatId: EML_FORMAT_ID, formatType: "METADATA" },
          ...dataPids.map((pid) => ({
            id: pid,
            formatId: "text/csv",
            formatType: "DATA",
          })),
        ],
      },
    });

    const recoveryRecords = new Map();
    const savedRecords = [];
    let idCounter = 0;
    const pkg = new DataPackage({
      objectService: {
        create: async ({ pid }) => ({ data: { identifier: pid } }),
        update: async ({ newPid }) => ({ data: { identifier: newPid } }),
      },
      sysMetaService: {
        update: async () => ({ data: "" }),
        invalidate: async () => {},
        download: async (pid) =>
          systemMetadata(
            pid,
            pid === rmPid
              ? RESOURCE_MAP_FORMAT_ID
              : pid === metadataPid
                ? EML_FORMAT_ID
                : "text/csv",
          ),
      },
      versionTracker: {
        getSysMeta: async (pid) =>
          systemMetadata(
            pid,
            pid === rmPid
              ? RESOURCE_MAP_FORMAT_ID
              : pid === metadataPid
                ? EML_FORMAT_ID
                : "text/csv",
          ),
      },
      authorizationService: {
        checkAll: async (pids) =>
          Object.fromEntries(pids.map((pid) => [pid, true])),
      },
      identifierService: {
        generateIdentifier: async () => {
          idCounter += 1;
          return { data: { identifier: `urn:uuid:gen.${idCounter}` } };
        },
        reserveIdentifier: async (pid) => ({ data: { identifier: pid } }),
      },
      uploadRecoveryStore: {
        save: async (pid, record) => {
          recoveryRecords.set(pid, record);
          savedRecords.push(record);
        },
        get: async (pid) => recoveryRecords.get(pid) || null,
        remove: async (pid) => {
          recoveryRecords.delete(pid);
        },
      },
    });
    await pkg.loadEditablePackage(metadataPid);
    // The editor attaches a serializable metadata model; keep the tiny fixture
    // shape aligned with the real save path.
    pkg.getMember(metadataPid).objectModel = {
      id: metadataPid,
      set(key, value) {
        if (key === "id") this.id = value;
      },
      serialize: () => "<eml/>",
    };
    return { pkg, recoveryRecords, savedRecords, memberCount };
  }

  describe("DataPackage workflows: large-package scale", () => {
    // One run at the 700-member editor limit; smaller sizes exercise the same
    // code path and add runtime without coverage.
    const memberCount = 700;

    it(`saves a metadata-only edit to a ${memberCount}-member package`, async function scaleTest() {
      this.timeout(20000);
      const { pkg, recoveryRecords, savedRecords } =
        await loadLargePackage(memberCount);

      await pkg.markMemberContentDirty("meta.1");
      const newMetadataPid = pkg.getPrimaryMetadataMember().pid;
      newMetadataPid.should.not.equal("meta.1");

      const result = await pkg.upload();

      result.outcome.should.equal("success");
      pkg.hasUnsavedChanges().should.equal(false);

      // One recovery record was written before the writes and cleared after
      // success.
      savedRecords.should.have.lengthOf(1);
      recoveryRecords.size.should.equal(0);

      // It carried the exact ResourceMap bytes (not a summary), aggregating
      // every member including the new metadata version.
      const [record] = savedRecords;
      record.should.not.have.property("members");
      record.rmXml.should.be.a("string");
      const recordMembers = ResourceMap.fromXml(record.rmPid, record.rmXml, {
        resolveServiceUrl: RESOLVE_BASE,
      }).getMemberPids();
      recordMembers.should.have.lengthOf(memberCount);
      recordMembers.should.include(newMetadataPid);
    });

    it(`links foldered staged files up to ${memberCount} total members`, async function scaleTest() {
      this.timeout(30000);
      const { pkg } = await loadLargePackage(1);
      const filesToAdd = memberCount - 1;
      const files = Array.from({ length: filesToAdd }, (_, index) => {
        const fileName = `file-${String(index).padStart(3, "0")}.csv`;
        return new File(["data"], fileName, { type: "text/csv" });
      });

      const staged = await pkg.stageLocalFiles(files);
      await pkg.linkStagedFiles(staged, { atLocation: "folder/data" });

      const resourceMap = pkg.getResourceMapModel();
      resourceMap.getMemberPids().should.have.lengthOf(memberCount);
      resourceMap.graphState
        .getMember(staged[0].pid)
        .atLocations.should.deep.equal(["folder/data/file-000.csv"]);
      resourceMap.graphState
        .getMember(staged[filesToAdd - 1].pid)
        .atLocations.should.deep.equal([
          `folder/data/file-${String(filesToAdd - 1).padStart(3, "0")}.csv`,
        ]);
    });

    it(`removes many members from a ${memberCount}-member package`, async function scaleTest() {
      this.timeout(30000);
      const { pkg } = await loadLargePackage(memberCount);
      const resourceMap = pkg.getResourceMapModel();
      const dataPids = resourceMap.graphState
        .getMemberPids()
        .filter((pid) => pid !== "meta.1");
      resourceMap.provenance.addGeneratedByProgram(dataPids[0], dataPids[1]);
      resourceMap.provenance.addUsedByProgram(dataPids[2], dataPids[1]);

      await pkg.removeMembers(dataPids);

      resourceMap.getMemberPids().should.deep.equal(["meta.1"]);
      resourceMap
        .getDocumentationLinks()
        .should.deep.equal([{ metadataPid: "meta.1", dataPid: "meta.1" }]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.validate().should.deep.equal([]);
    });
  });
});
