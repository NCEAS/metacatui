define(["models/sysmeta/SysMetaSchema"], (SysMetaSchema) => {
  const expect = chai.expect;

  describe("SysMetaSchema", () => {
    describe("constants", () => {
      it("exposes the expected schema constants", () => {
        expect(SysMetaSchema.XML_NS_V1).to.equal(
          "http://ns.dataone.org/service/types/v1",
        );
        expect(SysMetaSchema.XML_NS_V2).to.equal(
          "http://ns.dataone.org/service/types/v2.0",
        );
        expect(SysMetaSchema.NAMESPACE_BY_VERSION).to.deep.equal({
          v1: "http://ns.dataone.org/service/types/v1",
          v2: "http://ns.dataone.org/service/types/v2.0",
        });
        expect(SysMetaSchema.PERMISSIONS).to.deep.equal([
          "read",
          "write",
          "changePermission",
        ]);
        expect(SysMetaSchema.REPLICATION_STATUSES).to.deep.equal([
          "queued",
          "requested",
          "completed",
          "failed",
          "invalidated",
        ]);
        expect(SysMetaSchema.NODE_ORDER).to.deep.equal([
          "serialVersion",
          "identifier",
          "formatId",
          "size",
          "checksum",
          "submitter",
          "rightsHolder",
          "accessPolicy",
          "replicationPolicy",
          "obsoletes",
          "obsoletedBy",
          "archived",
          "dateUploaded",
          "dateSysMetadataModified",
          "originMemberNode",
          "authoritativeMemberNode",
          "replica",
          "seriesId",
          "mediaType",
          "fileName",
        ]);
        expect(SysMetaSchema.REQUIRED_NON_EMPTY_FIELDS).to.deep.equal([
          "identifier",
          "formatId",
          "rightsHolder",
          "checksum",
          "checksumAlgorithm",
        ]);
        expect(SysMetaSchema.DATE_FIELDS).to.deep.equal([
          "dateUploaded",
          "dateSysMetadataModified",
        ]);
        expect(SysMetaSchema.OPTIONAL_NON_EMPTY_TEXT_FIELDS).to.deep.equal([
          "submitter",
          "obsoletes",
          "obsoletedBy",
          "originMemberNode",
          "authoritativeMemberNode",
          "seriesId",
          "fileName",
        ]);
        expect(SysMetaSchema.V2_ONLY_FIELDS).to.deep.equal([
          "seriesId",
          "mediaType",
          "fileName",
        ]);
        expect(SysMetaSchema.SIMPLE_FIELD_DEFINITIONS[0]).to.deep.equal({
          field: "serialVersion",
          type: "integer",
          defaultValue: null,
          minOccurs: 0,
          maxOccurs: 1,
        });
        expect(
          SysMetaSchema.SIMPLE_FIELD_DEFINITIONS.find(
            ({ field }) => field === "identifier",
          ),
        ).to.deep.equal({
          field: "identifier",
          type: "text",
          defaultValue: null,
          requiredNonEmpty: true,
          minOccurs: 1,
          maxOccurs: 1,
        });
        expect(
          SysMetaSchema.FIELD_DEFINITIONS.find(
            ({ field }) => field === "replica",
          ),
        ).to.deep.include({
          field: "replica",
          type: "complex",
          minOccurs: 0,
        });
        expect(
          SysMetaSchema.FIELD_DEFINITIONS.find(
            ({ field }) => field === "replica",
          ).maxOccurs,
        ).to.equal(Infinity);
        expect(SysMetaSchema.DEFAULT_SIMPLE_FIELD_VALUES).to.deep.equal({
          serialVersion: null,
          identifier: null,
          formatId: null,
          size: null,
          checksum: null,
          submitter: null,
          rightsHolder: null,
          obsoletes: null,
          obsoletedBy: null,
          archived: null,
          dateUploaded: null,
          dateSysMetadataModified: null,
          originMemberNode: null,
          authoritativeMemberNode: null,
          seriesId: null,
          fileName: null,
          checksumAlgorithm: null,
        });
      });
    });

    describe("version helpers", () => {
      it("maps namespace URIs to sysmeta versions", () => {
        expect(
          SysMetaSchema.getSysMetaVersion(
            "http://ns.dataone.org/service/types/v1",
          ),
        ).to.equal("v1");
        expect(
          SysMetaSchema.getSysMetaVersion(
            "http://ns.dataone.org/service/types/v2.0",
          ),
        ).to.equal("v2");
        expect(SysMetaSchema.getSysMetaVersion("urn:test")).to.equal(null);
      });

      it("returns the expected field sets for each version", () => {
        const v1Fields = SysMetaSchema.getFieldDefinitionsForVersion("v1").map(
          ({ field }) => field,
        );
        const v2Fields = SysMetaSchema.getFieldDefinitionsForVersion("v2").map(
          ({ field }) => field,
        );

        expect(v1Fields).to.not.include("seriesId");
        expect(v1Fields).to.not.include("mediaType");
        expect(v1Fields).to.not.include("fileName");
        expect(v2Fields.slice(-3)).to.deep.equal([
          "seriesId",
          "mediaType",
          "fileName",
        ]);
      });
    });

    describe("normalizePermission()", () => {
      it("normalizes canonical permission values and preserves unknown values", () => {
        expect(SysMetaSchema.normalizePermission(" READ ")).to.equal("read");
        expect(SysMetaSchema.normalizePermission("Write")).to.equal("write");
        expect(SysMetaSchema.normalizePermission("changepermission")).to.equal(
          "changePermission",
        );
        expect(SysMetaSchema.normalizePermission("custom")).to.equal("custom");
        expect(SysMetaSchema.normalizePermission("")).to.equal("");
        expect(SysMetaSchema.normalizePermission(null)).to.equal(null);
      });
    });

    describe("normalizeReplicationStatus()", () => {
      it("normalizes known statuses and preserves unknown values", () => {
        expect(
          SysMetaSchema.normalizeReplicationStatus(" COMPLETED "),
        ).to.equal("completed");
        expect(SysMetaSchema.normalizeReplicationStatus("requested")).to.equal(
          "requested",
        );
        expect(SysMetaSchema.normalizeReplicationStatus("custom")).to.equal(
          "custom",
        );
        expect(SysMetaSchema.normalizeReplicationStatus("")).to.equal("");
        expect(SysMetaSchema.normalizeReplicationStatus(undefined)).to.equal(
          null,
        );
      });
    });
  });
});
