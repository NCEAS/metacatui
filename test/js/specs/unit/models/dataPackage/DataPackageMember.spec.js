define([
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageMember",
  "models/sysmeta/SystemMetadata",
  "models/dataONEServices/AuthorizationService",
  "models/metadata/eml211/EML211",
  "models/metadata/ScienceMetadata",
  "models/dataONEServices/ObjectService",
  "models/resourceMap/ResourceMap",
  "collections/ObjectFormats",
], (
  DataPackage,
  DataPackageMember,
  SystemMetadata,
  AuthorizationService,
  EML211,
  ScienceMetadata,
  ObjectService,
  ResourceMap,
  ObjectFormats,
) => {
  // Self-install should() so this spec also passes in isolated --spec runs.
  chai.should();
  const { expect } = chai;
  const { RemoteState, RequiredOperation } = DataPackageMember;

  describe("DataPackageMember", () => {
    const SYSTEM_METADATA_DEFAULTS = {
      formatId: "text/csv",
      submitter: "uid=test",
      rightsHolder: "uid=test",
      authoritativeMemberNode: "urn:node:test",
      accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
    };

    it("tracks a new local file as a pending create", () => {
      const member = new DataPackageMember({ pid: "data.new" });

      member.setLocalFile(new Blob(["data"]));

      member.contentDirty.should.equal(true);
      member.remoteState.should.equal(RemoteState.PENDING);
      member.getRequiredOperation().should.equal(RequiredOperation.CREATE);
      expect(member.remotePid).to.equal(null);
      expect(member.aggregatedPid).to.equal(null);
    });

    it("rejects empty files", () => {
      const member = new DataPackageMember({ pid: "data.new" });

      expect(() => member.setLocalFile(new Blob([]))).to.throw("empty file");
    });

    it("clears a stale desired checksum when local content changes", () => {
      const remoteSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
        size: 3,
        checksum: "old-checksum",
        checksumAlgorithm: "MD5",
      });
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
        sysMeta: remoteSysMeta,
        remoteSysMeta,
      });

      member.setLocalFile(new Blob(["replacement"]));

      member.sysMeta.checksum.isEmpty().should.equal(true);
      member.remoteSysMeta.checksum.value.should.equal("old-checksum");
    });

    it("preserves the original remote and aggregated PIDs when replaced twice", () => {
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
      });

      member.setDesiredPid("data.2");
      member.setLocalFile(new Blob(["replacement 1"]));
      member.setDesiredPid("data.3");
      member.setLocalFile(new Blob(["replacement 2"]));

      member.pid.should.equal("data.3");
      member.remotePid.should.equal("data.1");
      member.aggregatedPid.should.equal("data.1");
      member.getRequiredOperation().should.equal(RequiredOperation.UPDATE);
    });

    it("records eager-upload success without promoting aggregation", () => {
      const member = new DataPackageMember({ pid: "data.new" });
      member.setLocalFile(new Blob(["data"]));

      member.markRemoteUploading();
      member.markRemoteSuccess({ pid: "data.new" });

      member.remoteState.should.equal(RemoteState.UPLOADED);
      member.remotePid.should.equal("data.new");
      expect(member.aggregatedPid).to.equal(null);
      member.getRequiredOperation().should.equal(RequiredOperation.NONE);
    });

    it("rejects an unexpected upload response identifier", () => {
      const member = new DataPackageMember({ pid: "data.expected" });

      expect(() =>
        member.markRemoteSuccess({
          response: {
            data: { identifier: "data.unexpected" },
          },
        }),
      ).to.throw("does not match");
    });

    it("normalizes format properties with sysmeta precedence", () => {
      const member = new DataPackageMember({
        formatType: " DATA ",
        formatId: " member-format ",
        mediaType: { name: " member/type " },
        fileName: " data.csv ",
        sysMeta: {
          formatId: " sysmeta-format ",
          mediaType: { name: " sysmeta/type " },
        },
      });

      member.getFormatProperties().should.deep.equal({
        formatType: "DATA",
        formatId: "sysmeta-format",
        mediaType: "sysmeta/type",
        filename: "data.csv",
      });
    });

    it("preserves partial-success state until ResourceMap promotion", () => {
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
      });
      member.setDesiredPid("data.2");
      member.setLocalFile(new Blob(["replacement"]));

      member.markRemoteSuccess({ pid: "data.2" });

      member.remotePid.should.equal("data.2");
      member.aggregatedPid.should.equal("data.1");
      member.getRequiredOperation().should.equal(RequiredOperation.NONE);

      member.promoteAggregatedState();
      member.aggregatedPid.should.equal("data.2");
    });

    it("tracks removed and ambiguous-failure states", () => {
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
      });
      member.setDesiredPid("data.2");
      member.setLocalFile(new Blob(["replacement"]));
      const error = new Error("request timed out");

      member.markRemoteFailure(error, { ambiguous: true });
      member.remoteState.should.equal(RemoteState.AMBIGUOUS);
      member.lastUploadError.should.equal(error);
      member.getRequiredOperation().should.equal(RequiredOperation.UPDATE);

      member.markRemoved();
      member.getRequiredOperation().should.equal(RequiredOperation.REMOVE);
      member.promoteAggregatedState();
      expect(member.aggregatedPid).to.equal(null);
    });

    it("preserves ambiguous writes until verification resolves them", () => {
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
      });
      member.setDesiredPid("data.2");
      member.setLocalFile(new Blob(["replacement"]));
      member.markRemoteFailure(new Error("request timed out"), {
        ambiguous: true,
      });

      expect(() => member.setDesiredPid("data.3")).to.throw("ambiguous");
      expect(() => member.setLocalFile(new Blob(["new replacement"]))).to.throw(
        "ambiguous",
      );
      expect(() => member.setSystemMetadata({ identifier: "data.2" })).to.throw(
        "ambiguous",
      );

      member.markRemoved();
      member.remoteState.should.equal(RemoteState.AMBIGUOUS);
      member.getRequiredOperation().should.equal(RequiredOperation.REMOVE);
    });

    it("tracks system-metadata-only edits", () => {
      const sysMeta = new SystemMetadata({
        identifier: "data.1",
        formatId: "text/csv",
        size: 1,
        rightsHolder: "uid=test",
      });
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
        sysMeta,
        remoteSysMeta: sysMeta,
      });

      member.setSystemMetadata(sysMeta);

      member.sysMetaDirty.should.equal(true);
      member.remoteState.should.equal(RemoteState.UPLOADED);
      member
        .getRequiredOperation()
        .should.equal(RequiredOperation.UPDATE_SYSTEM_METADATA);
    });

    it("builds valid System Metadata for a new object", async () => {
      const member = new DataPackageMember({ pid: "data.new" });
      member.setLocalFile(new Blob(["hello"]));

      const sysMeta = await member.buildObjectSystemMetadata(
        SYSTEM_METADATA_DEFAULTS,
      );

      sysMeta.identifier.should.equal("data.new");
      sysMeta.size.should.equal(5);
      sysMeta.checksum.value.should.equal("5d41402abc4b2a76b9719d911017c592");
      expect(sysMeta.obsoletes).to.equal(null);
      member
        .serializeSystemMetadata()
        .should.contain("<identifier>data.new</identifier>");
    });

    it("preserves remote sysmeta when replacing existing content", async () => {
      const remoteSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
        size: 3,
        checksum: "old-checksum",
        checksumAlgorithm: "MD5",
        submitter: "uid=submitter",
        rightsHolder: "uid=owner",
        seriesId: "data.series",
      });
      const member = new DataPackageMember({
        pid: "data.2",
        formatId: "text/csv",
      });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
        remoteSysMeta,
      });
      member.setLocalFile(new Blob(["replacement"]));

      const sysMeta = await member.buildObjectSystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        submitter: "uid=default",
        rightsHolder: "uid=default",
      });

      sysMeta.identifier.should.equal("data.2");
      sysMeta.obsoletes.should.equal("data.1");
      sysMeta.submitter.should.equal("uid=submitter");
      sysMeta.rightsHolder.should.equal("uid=owner");
      sysMeta.seriesId.should.equal("data.series");
      sysMeta.accessPolicy.isPublic().should.equal(true);
    });

    it("uses replacement source sysmeta when replacing a newer remote version", async () => {
      const replacementSourceSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.2",
        size: 3,
        checksum: "newer-checksum",
        checksumAlgorithm: "MD5",
        submitter: "uid=submitter",
        rightsHolder: "uid=new-owner",
        seriesId: "data.series",
      });
      const member = new DataPackageMember({
        pid: "data.3",
        formatId: "text/csv",
      });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
      });
      member._replacementSourcePid = "data.2";
      member._replacementSourceSysMeta = replacementSourceSysMeta;
      member.setLocalFile(new Blob(["replacement"]));

      const sysMeta = await member.buildObjectSystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        submitter: "uid=default",
        rightsHolder: "uid=default",
      });

      sysMeta.identifier.should.equal("data.3");
      sysMeta.obsoletes.should.equal("data.2");
      sysMeta.submitter.should.equal("uid=submitter");
      sysMeta.rightsHolder.should.equal("uid=new-owner");
      sysMeta.seriesId.should.equal("data.series");
    });

    it("uses an injected SysMeta service when fetching system metadata", async () => {
      const sysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
      });
      const sysMetaService = {
        download: sinon.stub().resolves(sysMeta),
      };
      const member = new DataPackageMember({ pid: "data.1" });

      const fetched = await member.fetchSysMeta({
        sysMetaService,
        cacheKey: "data.1-cache",
      });

      fetched.identifier.should.equal("data.1");
      member.sysMeta.identifier.should.equal("data.1");
      sinon.assert.calledOnceWithExactly(sysMetaService.download, "data.1", {
        cacheKey: "data.1-cache",
      });
    });

    it("rebases pending policy edits when refreshing system metadata", async () => {
      const remoteSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
        rightsHolder: "uid=old-owner",
        fileName: "old-name.csv",
      });
      const desiredSysMeta = remoteSysMeta.clone();
      desiredSysMeta.accessPolicy.clear();
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
        sysMeta: desiredSysMeta,
        remoteSysMeta,
        sysMetaDirty: true,
        accessPolicyDirty: true,
      });
      const freshSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
        rightsHolder: "uid=fresh-owner",
        fileName: "fresh-name.csv",
      });

      await member.fetchSysMeta({
        sysMetaService: {
          download: sinon.stub().resolves(freshSysMeta),
        },
        useCache: false,
      });

      member.remoteSysMeta.rightsHolder.should.equal("uid=fresh-owner");
      member.sysMeta.rightsHolder.should.equal("uid=fresh-owner");
      member.sysMeta.fileName.should.equal("fresh-name.csv");
      member.sysMeta.accessPolicy.should.have.lengthOf(0);
    });

    it("distinguishes private from unknown public status fetch failures", async () => {
      const member = new DataPackageMember({ pid: "private.1" });
      const errorStub = sinon.stub(console, "error");
      try {
        member.fetchSysMeta = sinon
          .stub()
          .rejects(Object.assign(new Error("private"), { status: 403 }));

        expect(await member.isPublic()).to.equal(false);

        member.fetchSysMeta = sinon
          .stub()
          .rejects(Object.assign(new Error("timeout"), { status: 500 }));

        expect(await member.isPublic()).to.equal(null);
      } finally {
        errorStub.restore();
      }
    });

    it("does not let indexed public status shadow the live policy method", async () => {
      const privateSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
        accessPolicy: [],
      });
      const member = new DataPackageMember({
        pid: "data.1",
        sysMeta: privateSysMeta,
      });

      member.merge({ id: "data.1", isPublic: true, sources: ["index"] });

      expect(Object.prototype.hasOwnProperty.call(member, "isPublic")).to.equal(
        false,
      );
      expect(member.isPublic).to.be.a("function");
      expect(await member.isPublic()).to.equal(false);
    });

    it("applies the default access policy when the member has none", async () => {
      const member = new DataPackageMember({ pid: "data.new" });
      member.setLocalFile(new Blob(["hello"]));

      const sysMeta = await member.buildObjectSystemMetadata(
        SYSTEM_METADATA_DEFAULTS,
      );

      // The default access policy from the upload defaults is written so new
      // objects are never created without one.
      sysMeta.accessPolicy
        .toJSON()
        .should.deep.equal([{ subjects: ["public"], permissions: ["read"] }]);
      member.serializeSystemMetadata().should.contain("<accessPolicy>");
    });

    it("preserves an explicit private policy when content is versioned", async () => {
      const remoteSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
        size: 3,
        checksum: "old-checksum",
        checksumAlgorithm: "MD5",
      });
      const privateSysMeta = remoteSysMeta.clone();
      privateSysMeta.accessPolicy.clear();
      const member = new DataPackageMember({
        pid: "data.2",
        formatId: "text/csv",
      });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
        sysMeta: privateSysMeta,
        remoteSysMeta,
        accessPolicyDirty: true,
      });
      member.setLocalFile(new Blob(["replacement"]));

      const sysMeta = await member.buildObjectSystemMetadata(
        SYSTEM_METADATA_DEFAULTS,
      );

      sysMeta.accessPolicy.length.should.equal(0);
      member
        .serializeSystemMetadata()
        .should.not.contain("<subject>public</subject>");
    });

    it("re-serializes model-backed bytes after remote success", async () => {
      let content = "v1";
      const objectModel = {
        serialize: ({ packageId }) => `<eml id="${packageId}">${content}</eml>`,
      };
      const member = new DataPackageMember({
        pid: "metadata.1",
        formatId: "eml://ecoinformatics.org/eml-2.1.1",
        objectModel,
      });

      await member.buildObjectSystemMetadata(SYSTEM_METADATA_DEFAULTS);
      const firstUpload = await member.uploadFile.text();
      member.markRemoteSuccess({ pid: "metadata.1" });
      content = "v2";
      member.setDesiredPid("metadata.2");

      await member.buildObjectSystemMetadata(SYSTEM_METADATA_DEFAULTS);

      expect(member.uploadFile).to.be.instanceof(Blob);
      const secondUpload = await member.uploadFile.text();
      expect(secondUpload).to.equal('<eml id="metadata.2">v2</eml>');
      expect(firstUpload).to.not.equal(secondUpload);
    });

    it("recognizes the ORE format ID as a resource map", () => {
      const member = new DataPackageMember({
        pid: "resource_map_1",
        formatId: "http://www.openarchives.org/ore/terms",
      });

      member.isResourceMap().should.equal(true);
    });

    it("uses the ORE format ID instead of an inferred format type", () => {
      const member = new DataPackageMember({
        pid: "nested.package.1",
        formatType: "METADATA",
        formatId: "http://www.openarchives.org/ore/terms",
      });

      member.isResourceMap().should.equal(true);
    });

    it("does not classify a non-ORE resource format as a resource map", () => {
      const member = new DataPackageMember({
        pid: "annotation.1",
        formatType: "RESOURCE",
        formatId:
          "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html",
      });

      member.isResourceMap().should.equal(false);
    });

    it("builds content-update System Metadata without server-managed fields", async () => {
      const member = new DataPackageMember({
        pid: "data.2",
        formatId: "text/csv",
      });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
      });
      member.setLocalFile(new Blob(["replacement"]));

      const sysMeta = await member.buildObjectSystemMetadata(
        SYSTEM_METADATA_DEFAULTS,
      );

      sysMeta.obsoletes.should.equal("data.1");
      expect(sysMeta.obsoletedBy).to.equal(null);
      expect(sysMeta.serialVersion).to.equal(null);
      expect(sysMeta.dateUploaded).to.equal(null);
      expect(sysMeta.originMemberNode).to.equal(null);
      sysMeta.replicas.length.should.equal(0);
    });

    it("builds sysmeta-only updates from the confirmed remote baseline", () => {
      const remoteSysMeta = new SystemMetadata({
        ...SYSTEM_METADATA_DEFAULTS,
        identifier: "data.1",
        size: 3,
        checksum: "old-checksum",
        checksumAlgorithm: "MD5",
        serialVersion: 7,
        originMemberNode: "urn:node:origin",
        rightsHolder: "uid=old",
        fileName: "old.csv",
      });
      const desiredSysMeta = remoteSysMeta.clone();
      desiredSysMeta.rightsHolder = "uid=new";
      desiredSysMeta.fileName = "new.csv";
      desiredSysMeta.accessPolicy.clear();
      const member = new DataPackageMember({ pid: "data.1" });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
        sysMeta: desiredSysMeta,
        remoteSysMeta,
      });

      const update = member.buildSystemMetadataUpdate();

      update.rightsHolder.should.equal("uid=new");
      update.fileName.should.equal("new.csv");
      update.accessPolicy.length.should.equal(0);
      update.identifier.should.equal("data.1");
      update.checksum.value.should.equal("old-checksum");
      update.serialVersion.should.equal(7);
      update.originMemberNode.should.equal("urn:node:origin");
      member
        .serializeSystemMetadata()
        .should.contain("<rightsHolder>uid=new</rightsHolder>");
      member
        .serializeSystemMetadata()
        .should.contain("<fileName>new.csv</fileName>");
    });

    it("returns identifier and checksum fields to verify an ambiguous write", async () => {
      const member = new DataPackageMember({ pid: "data.2" });
      member.initializeEditableState({ remotePid: "data.1" });
      member.setLocalFile(new Blob(["hello"]));
      await member.buildObjectSystemMetadata(SYSTEM_METADATA_DEFAULTS);

      member.getSystemMetadataVerificationFields().should.deep.equal({
        identifier: "data.2",
        checksum: {
          value: "5d41402abc4b2a76b9719d911017c592",
          algorithm: "MD5",
        },
      });
    });

    it("does not allow enrichment to overwrite lifecycle or ResourceMap relationships", () => {
      const member = new DataPackageMember({
        pid: "data.1",
        sources: ["resourceMap"],
        documents: ["data.original"],
        isDocumentedBy: ["meta.1"],
        atLocations: ["data/original.csv"],
        resourceMap: ["resource_map_1"],
      });
      member.initializeEditableState({
        remotePid: "data.1",
        aggregatedPid: "data.1",
        contentDirty: true,
        remoteState: RemoteState.PENDING,
      });

      member.merge({
        pid: "data.1",
        sources: ["index"],
        contentDirty: false,
        remoteState: RemoteState.UPLOADED,
        documents: ["stale.data"],
        isDocumentedBy: ["stale.meta"],
        atLocations: ["stale/location.csv"],
        resourceMap: ["stale.resource_map"],
        title: "Index title",
      });

      member.contentDirty.should.equal(true);
      member.remoteState.should.equal(RemoteState.PENDING);
      member.documents.should.deep.equal(["data.original"]);
      member.isDocumentedBy.should.deep.equal(["meta.1"]);
      member.atLocations.should.deep.equal(["data/original.csv"]);
      member.resourceMap.should.deep.equal(["resource_map_1"]);
      member.title.should.equal("Index title");

      member.merge({
        pid: "data.1",
        sources: ["resourceMap"],
        documents: ["data.updated"],
        isDocumentedBy: ["meta.2"],
        atLocations: ["data/updated.csv"],
        resourceMap: ["resource_map_2"],
      });
      member.documents.should.deep.equal(["data.updated"]);
      member.isDocumentedBy.should.deep.equal(["meta.2"]);
      member.atLocations.should.deep.equal(["data/updated.csv"]);
      member.resourceMap.should.deep.equal(["resource_map_2"]);
    });

    it("returns a JSON-safe summary without runtime content objects", () => {
      const member = new DataPackageMember({
        pid: "data.1",
        dateUploaded: new Date("2026-01-01T00:00:00.000Z"),
        objectModel: { serialize: () => "data" },
        rawData: "runtime content",
        size: 123,
      });
      member.setLocalFile(new Blob(["data"]));

      const summary = member.toJSON();

      summary.pid.should.equal("data.1");
      summary.dateUploaded.should.equal("2026-01-01T00:00:00.000Z");
      summary.size.should.equal(4);
      expect(summary.id).to.equal(undefined);
      expect(summary.uploadFile).to.equal(undefined);
      expect(summary.objectModel).to.equal(undefined);
      expect(summary.rawData).to.equal(undefined);
    });

    it("includes member summary fields derived from System Metadata", () => {
      const member = new DataPackageMember({
        pid: "data.1",
        formatId: "application/octet-stream",
        checksum: "",
        checksumAlgorithm: "",
        sysMeta: {
          ...SYSTEM_METADATA_DEFAULTS,
          identifier: "data.1",
          fileName: "measurements.csv",
          formatId: "text/csv",
          checksum: "abc123",
          checksumAlgorithm: "MD5",
        },
      });

      const summary = member.toJSON();

      summary.fileName.should.equal("measurements.csv");
      summary.formatId.should.equal("text/csv");
      summary.checksum.should.equal("abc123");
      summary.checksumAlgorithm.should.equal("MD5");
      expect(summary.id).to.equal(undefined);
    });

    describe("rendered-metadata enrichment", () => {
      it("normalizes a dashed identifier so the summary matches the member", () => {
        const member = new DataPackageMember({
          pid: "urn:uuid:abc",
          title: "Existing title",
        });

        member.addViewInfo({
          pid: "urn-uuid-abc",
          entityName: "My Entity",
          objectName: "data.csv",
          objectUrl: "https://example.org/object",
        });

        member.fileName.should.equal("data.csv");
        member.viewServiceEntity.objectUrl.should.equal(
          "https://example.org/object",
        );
        // Existing values take precedence over enrichment.
        member.title.should.equal("Existing title");
      });

      it("rejects view info for a different member PID", () => {
        const member = new DataPackageMember({ pid: "data.1" });
        expect(() => member.addViewInfo({ pid: "data.2" })).to.throw(
          "different member PID",
        );
      });

      it("normalizeViewInfo yields a null pid when no identifier is present", () => {
        const info = DataPackageMember.normalizeViewInfo({
          entityName: "Nameless",
        });
        expect(info.pid).to.equal(null);
        expect(info.entityName).to.equal("Nameless");
      });
    });

    describe("permission checks", () => {
      let sandbox;
      beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox
          .stub(AuthorizationService, "getCurrentUserKey")
          .resolves("uid=test");
      });
      afterEach(() => sandbox.restore());

      it("caches a result and a boolean refresh bypasses the cache", async () => {
        const check = sandbox
          .stub(AuthorizationService.prototype, "check")
          .resolves(true);
        const member = new DataPackageMember({ pid: "data.1" });

        (await member.checkWritePermission()).should.equal(true);
        (await member.checkWritePermission()).should.equal(true);
        check.calledOnce.should.equal(true);

        check.resolves(false);
        (await member.checkWritePermission(true)).should.equal(false);
        check.calledTwice.should.equal(true);
      });

      it("returns false when the authorization check throws", async () => {
        sandbox
          .stub(AuthorizationService.prototype, "check")
          .rejects(new Error("network down"));
        const member = new DataPackageMember({ pid: "data.1" });

        (await member.checkWritePermission()).should.equal(false);
      });
    });

    describe("fetchObject", () => {
      let sandbox;
      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });
      afterEach(() => sandbox.restore());

      // A metadata member wired with an (empty) ObjectFormats so its
      // synchronous classifiers resolve without the MetacatUI global.
      const metadataMember = (formatId) =>
        new DataPackageMember({
          pid: "meta.1",
          formatType: "METADATA",
          formatId,
          objectFormats: new ObjectFormats(),
        });

      it("builds and returns an EML211 object model for an EML member", async () => {
        sandbox.stub(EML211.prototype, "fetch").callsFake(function fakeFetch() {
          this.set("objectXML", "<eml>doc</eml>");
          this.trigger("sync", this);
        });
        const member = metadataMember(
          "https://eml.ecoinformatics.org/eml-2.2.0",
        );

        const model = await member.fetchObject();

        model.should.be.instanceof(EML211);
        member.objectModel.should.equal(model);
        member.rawData.should.equal("<eml>doc</eml>");
        // The model flips `synced` to true on its own "sync" event.
        model.get("synced").should.equal(true);
      });

      it("builds an EML211 model from an EML format ID without ObjectFormats", async () => {
        sandbox.stub(EML211.prototype, "fetch").callsFake(function fakeFetch() {
          this.trigger("sync", this);
        });
        const member = new DataPackageMember({
          pid: "meta.1",
          formatId: "eml://ecoinformatics.org/eml-2.1.1",
        });

        const model = await member.fetchObject();

        model.should.be.instanceof(EML211);
        member.objectModel.should.equal(model);
      });

      it("passes fetch options through to metadata model fetch", async () => {
        const controller = new AbortController();
        const fetchStub = sandbox
          .stub(EML211.prototype, "fetch")
          .callsFake(function fakeFetch(options = {}) {
            options.signal.should.equal(controller.signal);
            this.trigger("sync", this);
          });
        const member = metadataMember(
          "https://eml.ecoinformatics.org/eml-2.2.0",
        );

        await member.fetchObject({ signal: controller.signal });

        sinon.assert.calledOnce(fetchStub);
      });

      it("builds a ScienceMetadata model for non-EML metadata", async () => {
        sandbox
          .stub(ScienceMetadata.prototype, "fetch")
          .callsFake(function fakeFetch() {
            this.trigger("sync", this);
          });
        const member = new DataPackageMember({
          pid: "meta.1",
          formatType: "METADATA",
          formatId: "FGDC-STD-001-1998",
        });

        const model = await member.fetchObject();

        model.should.be.instanceof(ScienceMetadata);
        member.objectModel.should.equal(model);
      });

      it("queues non-EML metadata from its owning package event", async () => {
        sandbox
          .stub(ScienceMetadata.prototype, "fetch")
          .callsFake(function fakeFetch() {
            this.trigger("sync", this);
          });
        const previousRootDataPackage = globalThis.MetacatUI.rootDataPackage;
        globalThis.MetacatUI.rootDataPackage = null;

        try {
          const pkg = new DataPackage({
            members: [
              {
                pid: "meta.1",
                formatType: "METADATA",
                formatId: "FGDC-STD-001-1998",
              },
            ],
          });
          const model = await pkg.getMember("meta.1").fetchObject();

          pkg.recordUserEdit("metadata:changed", {});

          expect(model.get("uploadStatus")).to.equal("q");
        } finally {
          globalThis.MetacatUI.rootDataPackage = previousRootDataPackage;
        }
      });

      it("rejects when the metadata object fails to load", async () => {
        sandbox.stub(EML211.prototype, "fetch").callsFake(function fakeFetch() {
          this.trigger("error", this, new Error("boom"));
        });
        const member = metadataMember(
          "https://eml.ecoinformatics.org/eml-2.2.0",
        );

        let error = null;
        try {
          await member.fetchObject();
        } catch (e) {
          error = e;
        }
        expect(error).to.be.instanceof(Error);
        error.message.should.equal("boom");
      });

      it("passes configured services when parsing a downloaded Resource Map", async () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get(key) {
              if (key === "resolveServiceUrl") {
                return "https://cn.example/cn/v2/resolve";
              }
              if (key === "objectServiceUrl") {
                return "https://mn.example/mn/v2/object";
              }
              return null;
            },
          },
        };
        const download = sandbox
          .stub(ObjectService.prototype, "download")
          .callsFake(function fakeDownload() {
            this.readBaseUrl.should.equal("https://mn.example/mn/v2/object");
            return new Blob(["<rdf:RDF/>"]);
          });
        const parsedModel = { resourceMapPid: "resource_map_1" };
        const fromXml = sandbox
          .stub(ResourceMap, "fromXml")
          .returns(parsedModel);
        const member = new DataPackageMember({
          pid: "resource_map_1",
          formatType: "RESOURCE",
        });

        try {
          const model = await member.fetchObject();

          model.should.equal(parsedModel);
          sinon.assert.calledOnce(download);
          sinon.assert.calledOnceWithExactly(
            fromXml,
            "resource_map_1",
            "<rdf:RDF/>",
            {
              resolveServiceUrl: "https://cn.example/cn/v2/resolve",
              objectServiceUrl: "https://mn.example/mn/v2/object",
            },
          );
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });

      it("returns null for a data member without building a model", async () => {
        const member = new DataPackageMember({
          pid: "data.1",
          formatType: "DATA",
          objectFormats: new ObjectFormats(),
        });

        const result = await member.fetchObject();

        expect(result).to.equal(null);
        expect(member.objectModel).to.equal(undefined);
      });

      it("returns null for an unknown member without logging", async () => {
        const warn = sandbox.stub(console, "warn");
        const member = new DataPackageMember({ pid: "unknown.1" });

        const result = await member.fetchObject();

        expect(result).to.equal(null);
        sinon.assert.notCalled(warn);
      });
    });
  });
});
