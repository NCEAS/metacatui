define(["/test/js/specs/shared/clean-state.js", "models/sysmeta/SysMeta"], (
  cleanState,
  SysMeta,
) => {
  const should = chai.should();
  const expect = chai.expect;
  const XML_NS_V1 = "http://ns.dataone.org/service/types/v1";
  const XML_NS_V2 = "http://ns.dataone.org/service/types/v2.0";
  const wrapSysMeta = (innerXml, namespaceUri = XML_NS_V2, prefix = "d1") => `
    <${prefix}:systemMetadata xmlns:${prefix}="${namespaceUri}">
      ${innerXml}
    </${prefix}:systemMetadata>
  `;

  const SAMPLE_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <submitter>userA</submitter>
      <rightsHolder>userB</rightsHolder>
      <obsoletes>old.1</obsoletes>
      <obsoletedBy>new.1</obsoletedBy>
      <archived>false</archived>
      <dateUploaded>2025-06-24T00:00:00Z</dateUploaded>
      <dateSysMetadataModified>2025-06-24T12:00:00Z</dateSysMetadataModified>
    `);

  const FULL_XML = `
    <d1:systemMetadata
      xmlns:d1v1="http://ns.dataone.org/service/types/v1"
      xmlns:d1="http://ns.dataone.org/service/types/v2.0">
      <serialVersion>7</serialVersion>
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <submitter>userA</submitter>
      <rightsHolder>userB</rightsHolder>
      <accessPolicy>
        <allow>
          <subject>public</subject>
          <permission>read</permission>
        </allow>
        <allow>
          <subject>userB</subject>
          <subject>CN=editors,DC=dataone,DC=org</subject>
          <permission>write</permission>
          <permission>changePermission</permission>
        </allow>
      </accessPolicy>
      <replicationPolicy replicationAllowed="true" numberReplicas="2">
        <preferredMemberNode>urn:node:mnA</preferredMemberNode>
        <preferredMemberNode>urn:node:mnB</preferredMemberNode>
        <blockedMemberNode>urn:node:mnZ</blockedMemberNode>
      </replicationPolicy>
      <obsoletes>old.1</obsoletes>
      <obsoletedBy>new.1</obsoletedBy>
      <archived>false</archived>
      <dateUploaded>2025-06-24T00:00:00Z</dateUploaded>
      <dateSysMetadataModified>2025-06-24T12:00:00Z</dateSysMetadataModified>
      <originMemberNode>urn:node:mnOrigin</originMemberNode>
      <authoritativeMemberNode>urn:node:mnAuth</authoritativeMemberNode>
      <replica>
        <replicaMemberNode>urn:node:mnReplica</replicaMemberNode>
        <replicationStatus>completed</replicationStatus>
        <replicaVerified>2025-06-25T00:00:00Z</replicaVerified>
      </replica>
      <seriesId>series.1</seriesId>
      <mediaType name="text/csv">
        <property name="charset">utf-8</property>
      </mediaType>
      <fileName>data.csv</fileName>
    </d1:systemMetadata>
  `;

  const ROUND_TRIP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ns3:systemMetadata xmlns:ns2="http://ns.dataone.org/service/types/v1" xmlns:ns3="http://ns.dataone.org/service/types/v2.0">
  <serialVersion>1</serialVersion>
  <identifier>resource_map_doi:10.18739/A2CJ87N8D</identifier>
  <formatId>http://www.openarchives.org/ore/terms</formatId>
  <size>4508</size>
  <checksum algorithm="SHA-256">7b9486eb5bf56bqb581cdfb1a7e4e7dcf2cb7d2d63c69256g5df4b18e1f56be7</checksum>
  <submitter>http://orcid.org/0000-0003-3926-7039</submitter>
  <rightsHolder>http://orcid.org/0000-0001-5375-4840</rightsHolder>
  <accessPolicy>
    <allow>
      <subject>public</subject>
      <permission>read</permission>
    </allow>
  </accessPolicy>
  <replicationPolicy replicationAllowed="true" numberReplicas="3"/>
  <archived>false</archived>
  <dateUploaded>2026-03-16T21:28:28.738+00:00</dateUploaded>
  <dateSysMetadataModified>2026-03-16T21:28:28.765+00:00</dateSysMetadataModified>
  <originMemberNode>urn:node:ARCTIC</originMemberNode>
  <authoritativeMemberNode>urn:node:ARCTIC</authoritativeMemberNode>
  <fileName>resource_map_doi:10.18739_A2CJ87N8D.rdf</fileName>
</ns3:systemMetadata>`;

  const MINIMAL_XML = wrapSysMeta(`
      <serialVersion>7</serialVersion>
      <identifier>minimal.1</identifier>
      <formatId>text/plain</formatId>
      <size>1</size>
      <checksum algorithm="SHA-256">abc</checksum>
      <rightsHolder>userA</rightsHolder>
      <archived>TRUE</archived>
    `);

  const V1_XML = wrapSysMeta(
    `
      <serialVersion>7</serialVersion>
      <identifier>minimal.1</identifier>
      <formatId>text/plain</formatId>
      <size>1</size>
      <checksum algorithm="SHA-256">abc</checksum>
      <rightsHolder>userA</rightsHolder>
    `,
    XML_NS_V1,
  );

  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;

  const WRAPPED_XML = `
    <response>
      <d1:systemMetadata xmlns:d1="${XML_NS_V2}">
        <identifier>wrapped.1</identifier>
        <formatId>text/plain</formatId>
        <size>1</size>
        <checksum algorithm="SHA-256">abc</checksum>
        <rightsHolder>userA</rightsHolder>
      </d1:systemMetadata>
    </response>
  `;
  const EMPTY_XML = "   ";

  const INVALID_XML = `<d1:systemMetadata xmlns:d1="${XML_NS_V2}"><identifier>bad</identifier>`;
  const NO_NAMESPACE_XML = `
    <systemMetadata>
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
    </systemMetadata>
  `;
  const DUPLICATE_IDENTIFIER_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <identifier>sample.2</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
    `);
  const UNKNOWN_CHILD_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
      <mystery>nope</mystery>
    `);
  const OUT_OF_ORDER_XML = wrapSysMeta(`
      <formatId>text/plain</formatId>
      <identifier>sample.1</identifier>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
    `);
  const MISSING_CHECKSUM_ALGORITHM_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum>abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
    `);
  const V1_WITH_V2_FIELD_XML = wrapSysMeta(
    `
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
      <seriesId>series.1</seriesId>
    `,
    XML_NS_V1,
  );
  const INVALID_REPLICA_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
      <replica>
        <replicaMemberNode>urn:node:mnReplica</replicaMemberNode>
        <replicationStatus>bogus</replicationStatus>
        <replicaVerified>not-a-date</replicaVerified>
      </replica>
    `);

  describe("SysMeta Test Suite", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        return { sandbox };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
      if (globalThis.fetch && globalThis.fetch.restore) {
        globalThis.fetch.restore();
      }
    });

    describe("Instantiation & defaults", () => {
      it("initialises data with independent defaults", () => {
        const a = new SysMeta({ identifier: "" });
        const b = new SysMeta();

        a.data.should.have.property("identifier", "");
        a.data.should.have.property("formatId", null);
        a.data.should.have.property("archived", false);
        a.data.should.have.property("accessPolicy").that.is.an("array");
        a.data.should.have.property("replica").that.is.an("array");

        a.data.accessPolicy.push({
          subjects: ["public"],
          permissions: ["read"],
        });
        a.data.replica.push({
          replicaMemberNode: "urn:node:mnA",
          replicationStatus: "completed",
          replicaVerified: "2025-06-25T00:00:00Z",
        });

        a.data.accessPolicy.should.not.equal(b.data.accessPolicy);
        a.data.replica.should.not.equal(b.data.replica);
      });

      it("merges provided data over defaults and normalizes nested types", () => {
        const sysMeta = new SysMeta({
          identifier: "custom.1",
          archived: true,
          serialVersion: "3",
          accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
          replicationPolicy: {
            replicationAllowed: "true",
            numberReplicas: "2",
            preferredNodes: ["urn:node:mnA"],
          },
          replica: [
            {
              replicaMemberNode: "urn:node:mnReplica",
              replicationStatus: "COMPLETED",
              replicaVerified: "2025-06-25T00:00:00Z",
            },
          ],
          mediaType: {
            name: "text/csv",
            properties: [{ name: "charset", value: "utf-8" }],
          },
          fileName: "data.csv",
        });

        sysMeta.data.identifier.should.equal("custom.1");
        sysMeta.data.archived.should.equal(true);
        sysMeta.data.serialVersion.should.equal(3);
        sysMeta.data.accessPolicy.should.be.instanceof(SysMeta.AccessPolicy);
        sysMeta.data.accessPolicy.should.have.length(1);
        sysMeta.data.accessPolicy[0].should.be.instanceof(SysMeta.AccessRule);
        sysMeta.data.accessPolicy[0].permissions.should.deep.equal(["read"]);
        sysMeta.data.replicationPolicy.should.be.instanceof(
          SysMeta.ReplicationPolicy,
        );
        sysMeta.data.replicationPolicy.replicationAllowed.should.equal(true);
        sysMeta.data.replicationPolicy.numberReplicas.should.equal(2);
        sysMeta.data.replicationPolicy.preferredNodes.should.deep.equal([
          "urn:node:mnA",
        ]);
        sysMeta.data.replica.should.be.instanceof(SysMeta.ReplicaList);
        sysMeta.data.replica[0].should.be.instanceof(SysMeta.Replica);
        sysMeta.data.replica[0].replicationStatus.should.equal("completed");
        sysMeta.data.mediaType.should.be.instanceof(SysMeta.MediaType);
        sysMeta.data.mediaType.name.should.equal("text/csv");
        sysMeta.data.mediaType.properties[0].should.be.instanceof(
          SysMeta.MediaTypeProperty,
        );
        sysMeta.data.fileName.should.equal("data.csv");
      });
    });

    describe("parse()", () => {
      it("parses simple text/number/boolean/date fields and checksum attrs", () => {
        const sysMeta = new SysMeta({ identifier: "sample.1" });
        const parsed = sysMeta.parse(SAMPLE_XML);

        parsed.should.include({
          identifier: "sample.1",
          formatId: "text/plain",
          submitter: "userA",
          rightsHolder: "userB",
          obsoletes: "old.1",
          obsoletedBy: "new.1",
          checksum: "abcdef",
          checksumAlgorithm: "SHA-256",
          archived: false,
        });
        parsed.size.should.equal(12345);
        parsed.dateUploaded.should.be.instanceof(Date);
        parsed.dateSysMetadataModified.should.be.instanceof(Date);
        sysMeta.parsed.should.be.true;
      });

      it("parses the full v1 and v2 system metadata shape", () => {
        const sysMeta = new SysMeta();
        const parsed = sysMeta.parse(FULL_XML);

        parsed.serialVersion.should.equal(7);
        parsed.accessPolicy.should.be.instanceof(SysMeta.AccessPolicy);
        parsed.accessPolicy.should.have.length(2);
        parsed.accessPolicy[0].should.be.instanceof(SysMeta.AccessRule);
        parsed.accessPolicy[0].subject.should.equal("public");
        parsed.accessPolicy[0].read.should.equal(true);
        parsed.accessPolicy[1].subjects.should.deep.equal([
          "userB",
          "CN=editors,DC=dataone,DC=org",
        ]);
        parsed.accessPolicy[1].permissions.should.deep.equal([
          "write",
          "changePermission",
        ]);

        parsed.replicationPolicy.should.be.instanceof(
          SysMeta.ReplicationPolicy,
        );
        parsed.replicationPolicy.replicationAllowed.should.equal(true);
        parsed.replicationPolicy.numberReplicas.should.equal(2);
        parsed.replicationPolicy.preferredNodes.should.deep.equal([
          "urn:node:mnA",
          "urn:node:mnB",
        ]);
        parsed.replicationPolicy.blockedNodes.should.deep.equal([
          "urn:node:mnZ",
        ]);

        parsed.replica.should.be.instanceof(SysMeta.ReplicaList);
        parsed.replica.should.have.length(1);
        parsed.replica[0].should.be.instanceof(SysMeta.Replica);
        parsed.replica[0].replicaMemberNode.should.equal("urn:node:mnReplica");
        parsed.replica[0].replicationStatus.should.equal("completed");
        parsed.replica[0].replicaVerified.should.be.instanceof(Date);

        parsed.seriesId.should.equal("series.1");
        parsed.mediaType.should.be.instanceof(SysMeta.MediaType);
        parsed.mediaType.name.should.equal("text/csv");
        parsed.mediaType.properties.should.have.length(1);
        parsed.mediaType.properties[0].should.be.instanceof(
          SysMeta.MediaTypeProperty,
        );
        parsed.mediaType.properties[0].name.should.equal("charset");
        parsed.mediaType.properties[0].value.should.equal("utf-8");
        parsed.fileName.should.equal("data.csv");
      });

      it("parses minimal XML and preserves defaults", () => {
        const sysMeta = new SysMeta();
        const parsed = sysMeta.parse(MINIMAL_XML);

        parsed.identifier.should.equal("minimal.1");
        parsed.serialVersion.should.equal(7);
        parsed.archived.should.equal(true);
        expect(parsed.size).to.equal(1);
        expect(parsed.checksum).to.equal("abc");
        expect(parsed.checksumAlgorithm).to.equal("SHA-256");
        expect(parsed.dateUploaded).to.equal(null);

        sysMeta.parsed.should.be.true;
        sysMeta.hasParseError.should.be.false;
        sysMeta.fetchedXmlString.should.equal(MINIMAL_XML);
        parsed.should.equal(sysMeta.data);
      });

      it("creates independent nested collections per parse", () => {
        const a = new SysMeta();
        const b = new SysMeta();

        a.parse(FULL_XML);
        b.parse(FULL_XML);

        a.data.accessPolicy.should.not.equal(b.data.accessPolicy);
        a.data.replica.should.not.equal(b.data.replica);
        a.data.replicationPolicy.should.not.equal(b.data.replicationPolicy);
      });

      it("throws on invalid XML and sets hasParseError", () => {
        const sysMeta = new SysMeta();
        let caught;
        try {
          sysMeta.parse(INVALID_XML);
        } catch (err) {
          caught = err;
        }
        expect(caught).to.be.instanceof(Error);
        sysMeta.hasParseError.should.be.true;
        sysMeta.parsed.should.be.false;
        sysMeta.fetchedXmlString.should.equal(INVALID_XML);
        sysMeta.errors.should.have.length(1);
      });

      it("rejects empty XML and records a parse failure", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(EMPTY_XML)).to.throw(/non-empty XML/i);
        sysMeta.hasParseError.should.equal(true);
        sysMeta.parsed.should.equal(false);
        sysMeta.errors.should.have.length(1);
      });

      it("requires systemMetadata to be the document root", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(WRAPPED_XML)).to.throw(
          /expected root <systemMetadata>/i,
        );
        sysMeta.hasParseError.should.equal(true);
      });

      it("requires a supported systemMetadata namespace", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(NO_NAMESPACE_XML)).to.throw(
          /supported namespace uris/i,
        );
        expect(sysMeta.hasParseError).to.equal(true);
      });

      it("rejects duplicate singular child elements", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(DUPLICATE_IDENTIFIER_XML)).to.throw(
          /at most 1 time/i,
        );
      });

      it("rejects unexpected child elements", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(UNKNOWN_CHILD_XML)).to.throw(
          /unexpected <mystery>/i,
        );
      });

      it("rejects out-of-order child elements", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(OUT_OF_ORDER_XML)).to.throw(
          /out of order/i,
        );
      });

      it("requires the checksum algorithm attribute", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(MISSING_CHECKSUM_ALGORITHM_XML)).to.throw(
          /required "algorithm" attribute/i,
        );
      });

      it("rejects v2-only fields inside v1 system metadata", () => {
        const sysMeta = new SysMeta();

        expect(() => sysMeta.parse(V1_WITH_V2_FIELD_XML)).to.throw(
          /unexpected <seriesId>/i,
        );
      });

      it("treats schema-invalid nested values as parse failures", () => {
        const sysMeta = new SysMeta();
        let caught = null;

        try {
          sysMeta.parse(INVALID_REPLICA_XML);
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.equal("SystemMetadata XML failed validation");
        expect(caught.validationErrors).to.be.an("array");
        expect(caught.validationErrors.map((error) => error.field)).to.include(
          "replica[0].replicationStatus",
        );
        expect(sysMeta.hasParseError).to.equal(true);
        expect(sysMeta.validationErrors.map((error) => error.field)).to.include(
          "replica[0].replicationStatus",
        );
      });

      it("records DataONE error XML as a parse failure", () => {
        const sysMeta = new SysMeta();
        let caught = null;

        try {
          sysMeta.parse(ERROR_XML);
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.equal("READ not allowed");
        expect(caught.status).to.equal("401");
        sysMeta.hasParseError.should.equal(true);
        sysMeta.errors.should.have.length(1);
        sysMeta.errors[0].status.should.equal("401");
      });

      it("clears stale data when a later parse fails", () => {
        const sysMeta = SysMeta.fromXml(FULL_XML);

        expect(sysMeta.data.identifier).to.equal("sample.1");

        expect(() => sysMeta.parse(INVALID_XML)).to.throw(Error);
        expect(sysMeta.data.identifier).to.equal(null);
        expect(sysMeta.parsed).to.equal(false);
        expect(sysMeta.hasParseError).to.equal(true);
      });
    });

    describe("fromXml()", () => {
      it("returns a SysMeta instance with parsed data", () => {
        const sysMeta = SysMeta.fromXml(FULL_XML);
        sysMeta.should.be.instanceof(SysMeta);
        sysMeta.parsed.should.be.true;
        sysMeta.data.identifier.should.equal("sample.1");
        sysMeta.data.checksumAlgorithm.should.equal("SHA-256");
        sysMeta.data.seriesId.should.equal("series.1");
      });
    });

    describe("serialize()", () => {
      it("round-trips a parsed system metadata document with validation enabled by default", () => {
        const sysMeta = SysMeta.fromXml(FULL_XML);
        const xml = sysMeta.serialize();
        const reparsed = SysMeta.fromXml(xml);
        const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

        xml.should.contain(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        );
        xml.should.contain('replicationPolicy replicationAllowed="true"');
        xml.should.contain('<mediaType name="text/csv">');
        xml.should.contain("<fileName>data.csv</fileName>");
        expect(xmlDoc.documentElement.namespaceURI).to.equal(XML_NS_V2);
        expect(xmlDoc.documentElement.localName).to.equal("systemMetadata");

        reparsed.toJSON(false).should.deep.equal(sysMeta.toJSON(false));
      });

      it("uses ns2/ns3 prefixes and an XML declaration for new sysmeta documents", () => {
        const sysMeta = new SysMeta({
          identifier: "pid.1",
          formatId: "text/plain",
          size: 1,
          checksum: "abc",
          checksumAlgorithm: "MD5",
          rightsHolder: "userA",
        });

        const xml = sysMeta.serialize();
        const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

        xml.should.contain(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        );
        expect(xmlDoc.documentElement.namespaceURI).to.equal(XML_NS_V2);
        expect(xmlDoc.documentElement.localName).to.equal("systemMetadata");
        expect(xmlDoc.documentElement.getAttribute("xmlns:ns2")).to.equal(
          XML_NS_V1,
        );
        expect(xmlDoc.documentElement.getAttribute("xmlns:ns3")).to.equal(
          XML_NS_V2,
        );
      });

      it("preserves the source declaration and namespace aliases when round-tripping parsed XML", () => {
        const sysMeta = SysMeta.fromXml(ROUND_TRIP_XML);
        const xml = sysMeta.serialize();
        const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

        xml.should.contain(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        );
        expect(xmlDoc.documentElement.tagName).to.equal("ns3:systemMetadata");
        expect(xmlDoc.documentElement.getAttribute("xmlns:ns2")).to.equal(
          XML_NS_V1,
        );
        expect(xmlDoc.documentElement.getAttribute("xmlns:ns3")).to.equal(
          XML_NS_V2,
        );
      });

      it("preserves v1 root namespaces when no v2-only values are present", () => {
        const sysMeta = SysMeta.fromXml(V1_XML);
        const xml = sysMeta.serialize();
        const reparsed = new DOMParser().parseFromString(xml, "application/xml");
        expect(reparsed.documentElement.namespaceURI).to.equal(XML_NS_V1);
        expect(reparsed.documentElement.tagName).to.equal("d1:systemMetadata");
        expect(reparsed.documentElement.getAttribute("xmlns:d1")).to.equal(
          XML_NS_V1,
        );
      });

      it("upgrades serialization to the v2 namespace when v2-only values are present", () => {
        const sysMeta = SysMeta.fromXml(V1_XML);
        sysMeta.data.fileName = "data.csv";

        const xml = sysMeta.serialize();
        const reparsed = new DOMParser().parseFromString(xml, "application/xml");

        expect(reparsed.documentElement.namespaceURI).to.equal(XML_NS_V2);
        xml.should.contain("<fileName>data.csv</fileName>");
      });

      it("serializes dates in canonical DataONE XML format", () => {
        const sysMeta = SysMeta.fromXml(FULL_XML);
        const xml = sysMeta.serialize();

        xml.should.contain(
          "<dateUploaded>2025-06-24T00:00:00.000+00:00</dateUploaded>",
        );
        xml.should.contain(
          "<dateSysMetadataModified>2025-06-24T12:00:00.000+00:00</dateSysMetadataModified>",
        );
      });

      it("throws by default and attaches cloned validation errors when the sysmeta is invalid", () => {
        const sysMeta = new SysMeta({
          identifier: "pid.1",
          checksum: "abc",
          rightsHolder: "userA",
        });

        let thrown = null;
        try {
          sysMeta.serialize();
        } catch (error) {
          thrown = error;
        }

        expect(thrown).to.be.instanceof(Error);
        expect(thrown.message).to.equal("SystemMetadata validation failed");
        expect(thrown.validationErrors).to.be.an("array");
        expect(thrown.validationErrors.map((error) => error.field)).to.include(
          "formatId",
        );
        expect(thrown.validationErrors[0]).to.not.equal(
          sysMeta.validationErrors[0],
        );
      });

      it("skips validation when validate=false", () => {
        const sysMeta = new SysMeta({
          identifier: "pid.1",
          checksum: "abc",
          rightsHolder: "userA",
          dateUploaded: "not-a-date",
        });

        const xml = sysMeta.serialize({ validate: false });

        xml.should.contain("<identifier>pid.1</identifier>");
        xml.should.not.contain("Invalid Date");
      });

      it("reports invalid dates when serialization validation is enabled", () => {
        const sysMeta = new SysMeta({
          identifier: "pid.1",
          formatId: "text/plain",
          size: 1,
          checksum: "abc",
          checksumAlgorithm: "SHA-256",
          rightsHolder: "userA",
          dateUploaded: "not-a-date",
        });

        let thrown = null;
        try {
          sysMeta.serialize();
        } catch (error) {
          thrown = error;
        }

        expect(thrown).to.be.instanceof(Error);
        expect(thrown.validationErrors.map((error) => error.field)).to.include(
          "dateUploaded",
        );
      });
    });

    describe("validate()", () => {
      it("returns no validation errors for a complete document", () => {
        const sysMeta = SysMeta.fromXml(FULL_XML);
        sysMeta.validate().should.deep.equal([]);
      });

      it("reports required and nested validation errors", () => {
        const sysMeta = new SysMeta({
          identifier: "pid.1",
          formatId: "",
          size: -1,
          checksum: "abc",
          checksumAlgorithm: "",
          rightsHolder: "",
          seriesId: "pid.1",
          accessPolicy: [{ subjects: [""], permissions: ["badPermission"] }],
          replica: [
            {
              replicaMemberNode: "",
              replicationStatus: "bogus",
              replicaVerified: "not-a-date",
            },
          ],
          mediaType: {
            name: "",
            properties: [{ name: "", value: "utf-8" }],
          },
        });

        const errors = sysMeta.validate();
        const fields = errors.map((error) => error.field);

        fields.should.include("formatId");
        fields.should.include("size");
        fields.should.include("checksumAlgorithm");
        fields.should.include("rightsHolder");
        fields.should.include("seriesId");
        fields.should.include("accessPolicy[0].subjects[0]");
        fields.should.include("accessPolicy[0].permissions[0]");
        fields.should.include("replica[0].replicaMemberNode");
        fields.should.include("replica[0].replicationStatus");
        fields.should.include("replica[0].replicaVerified");
        fields.should.include("mediaType.name");
        fields.should.include("mediaType.property[0].name");
      });

      it("re-normalizes mutated plain-object nested values before validating", () => {
        const sysMeta = SysMeta.fromXml(FULL_XML);

        sysMeta.data.accessPolicy = {
          subjects: ["public"],
          permissions: ["read"],
        };
        sysMeta.data.replica = {
          replicaMemberNode: "urn:node:mnReplica",
          replicationStatus: "COMPLETED",
          replicaVerified: "2025-06-25T00:00:00Z",
        };
        sysMeta.data.mediaType = {
          name: "text/csv",
          properties: [{ name: "charset", value: "utf-8" }],
        };
        sysMeta.data.archived = "TRUE";
        sysMeta.data.size = "12345";

        sysMeta.validate().should.deep.equal([]);
        sysMeta.data.accessPolicy.should.be.instanceof(SysMeta.AccessPolicy);
        sysMeta.data.replica.should.be.instanceof(SysMeta.ReplicaList);
        sysMeta.data.mediaType.should.be.instanceof(SysMeta.MediaType);
        sysMeta.data.archived.should.equal(true);
        sysMeta.data.size.should.equal(12345);
      });

      it("does not silently drop invalid singleton accessPolicy and replica values", () => {
        const sysMeta = new SysMeta({
          identifier: "pid.1",
          formatId: "text/plain",
          size: 1,
          checksum: "abc",
          checksumAlgorithm: "SHA-256",
          rightsHolder: "userA",
          accessPolicy: {},
          replica: {},
        });

        const fields = sysMeta.validate().map((error) => error.field);

        fields.should.include("accessPolicy[0].subjects");
        fields.should.include("accessPolicy[0].permissions");
        fields.should.include("replica[0].replicaMemberNode");
        fields.should.include("replica[0].replicationStatus");
        fields.should.include("replica[0].replicaVerified");
      });
    });

    describe("toJSON()", () => {
      it("includes JSON-safe errors when hasParseError is true", () => {
        const sysMeta = new SysMeta();
        try {
          sysMeta.parse(INVALID_XML);
        } catch (e) {
          // expected
        }

        const json = sysMeta.toJSON(true);
        json.errors.should.be.an("array");
        json.errors[0].should.not.be.instanceof(Error);
        json.errors[0].name.should.equal("ParseError");
      });

      it("includes validation errors when present", () => {
        const sysMeta = new SysMeta({ identifier: "pid.1" });
        sysMeta.validate();

        const json = sysMeta.toJSON(true);
        json.validationErrors.should.be.an("array");
        json.validationErrors[0].field.should.equal("formatId");
      });

      it("omits errors when includeErrors is false", () => {
        const sysMeta = new SysMeta();
        const json = sysMeta.toJSON(false);
        expect(json.errors).to.equal(undefined);
        expect(json.validationErrors).to.equal(undefined);
      });

      it("includes extra fields when requested", () => {
        const sysMeta = new SysMeta({ identifier: "pid.1" });
        sysMeta.versionHistory = { "pid.1": 0 };

        const json = sysMeta.toJSON(true, ["versionHistory"]);
        json.versionHistory.should.deep.equal({ "pid.1": 0 });
      });

      it("exports canonical nested JSON shapes", () => {
        const json = SysMeta.fromXml(FULL_XML).toJSON(false);

        json.should.not.have.property("preferredNodes");
        json.dateUploaded.should.equal("2025-06-24T00:00:00.000Z");
        json.dateSysMetadataModified.should.equal("2025-06-24T12:00:00.000Z");
        json.accessPolicy[0].should.deep.equal({
          subjects: ["public"],
          permissions: ["read"],
        });
        json.replicationPolicy.should.deep.equal({
          replicationAllowed: true,
          numberReplicas: 2,
          preferredNodes: ["urn:node:mnA", "urn:node:mnB"],
          blockedNodes: ["urn:node:mnZ"],
        });
        json.mediaType.should.deep.equal({
          name: "text/csv",
          properties: [{ name: "charset", value: "utf-8" }],
        });
        json.replica[0].replicaVerified.should.equal("2025-06-25T00:00:00.000Z");
      });
    });
  });
});
