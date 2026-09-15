define(["models/sysmeta/SystemMetadata"], (SystemMetadata) => {
  const expect = chai.expect;
  const XML_NS_V1 = "http://ns.dataone.org/service/types/v1";
  const XML_NS_V2 = "http://ns.dataone.org/service/types/v2.0";

  const wrapSysMeta = (innerXml, namespaceUri = XML_NS_V2, prefix = "d1") => `
    <${prefix}:systemMetadata xmlns:${prefix}="${namespaceUri}">
      ${innerXml}
    </${prefix}:systemMetadata>
  `;

  const FULL_XML = `
    <d1:systemMetadata
      xmlns:d1v1="${XML_NS_V1}"
      xmlns:d1="${XML_NS_V2}">
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

  const INVALID_REQUIRED_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>not-a-number</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
    `);

  const INVALID_NESTED_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
      <accessPolicy>
        <allow>
          <subject>public</subject>
          <permission>read</permission>
        </allow>
        <allow>
          <subject></subject>
          <permission>bogus</permission>
        </allow>
      </accessPolicy>
      <replica>
        <replicaMemberNode>urn:node:mnReplica</replicaMemberNode>
        <replicationStatus>completed</replicationStatus>
        <replicaVerified>2025-06-25T00:00:00Z</replicaVerified>
      </replica>
      <replica>
        <replicaMemberNode></replicaMemberNode>
        <replicationStatus>bogus</replicationStatus>
        <replicaVerified>not-a-date</replicaVerified>
      </replica>
    `);

  const INVALID_OPTIONAL_XML = wrapSysMeta(`
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <rightsHolder>userB</rightsHolder>
      <replicationPolicy replicationAllowed="true" numberReplicas="bogus">
        <preferredMemberNode>urn:node:mnA</preferredMemberNode>
      </replicationPolicy>
      <mediaType name="text/csv">
        <property name="charset">utf-8</property>
        <property>ignored</property>
      </mediaType>
    `);

  const INVALID_XML = `<d1:systemMetadata xmlns:d1="${XML_NS_V2}"><identifier>bad</identifier>`;
  const EMPTY_XML = "   ";

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

  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;

  describe("SystemMetadata Test Suite", () => {
    describe("construction", () => {
      it("uses direct root properties, stable child domains, and no .data bag", () => {
        const a = new SystemMetadata({ identifier: "" });
        const b = new SystemMetadata();

        expect(a.data).to.equal(undefined);
        expect(a.identifier).to.equal("");
        expect(a.formatId).to.equal(null);
        expect(a.archived).to.equal(null);
        expect(a.accessPolicy).to.be.an("array").with.length(0);
        expect(a.replicas).to.be.an("array").with.length(0);
        expect(a.checksum.isEmpty()).to.equal(true);
        expect(a.parseWarnings).to.deep.equal([]);

        a.accessPolicy.add({ subjects: ["public"], permissions: ["read"] });
        a.replicas.add({
          replicaMemberNode: "urn:node:mnA",
          replicationStatus: "completed",
          replicaVerified: "2025-06-25T00:00:00Z",
        });

        expect(a.accessPolicy).to.not.equal(b.accessPolicy);
        expect(a.replicas).to.not.equal(b.replicas);
      });

      it("normalizes domain-shaped constructor input", () => {
        const sysMeta = new SystemMetadata({
          identifier: "custom.1",
          archived: "true",
          serialVersion: "3",
          checksum: "abc",
          checksumAlgorithm: "SHA-256",
          accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
          replicationPolicy: {
            replicationAllowed: "true",
            numberReplicas: "2",
            preferredNodes: ["urn:node:mnA"],
          },
          replicas: [
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

        expect(sysMeta.identifier).to.equal("custom.1");
        expect(sysMeta.archived).to.equal(true);
        expect(sysMeta.serialVersion).to.equal(3);
        expect(sysMeta.checksum.toJSON()).to.deep.equal({
          value: "abc",
          algorithm: "SHA-256",
        });
        expect(sysMeta.accessPolicy).to.have.length(1);
        expect(sysMeta.replicationPolicy.numberReplicas).to.equal(2);
        expect(sysMeta.replicas).to.have.length(1);
        expect(sysMeta.replicas[0].replicationStatus).to.equal("completed");
        expect(sysMeta.mediaType.name).to.equal("text/csv");
        expect(sysMeta.fileName).to.equal("data.csv");
      });
    });

    describe("parse()", () => {
      it("parses the full v2 system metadata shape without warnings", () => {
        const sysMeta = SystemMetadata.fromXml(FULL_XML);

        expect(sysMeta.serialVersion).to.equal(7);
        expect(sysMeta.checksum.toJSON()).to.deep.equal({
          value: "abcdef",
          algorithm: "SHA-256",
        });
        expect(sysMeta.accessPolicy).to.have.length(2);
        expect(sysMeta.accessPolicy[0].subject).to.equal("public");
        expect(sysMeta.accessPolicy[1].permissions).to.deep.equal([
          "write",
          "changePermission",
        ]);
        expect(sysMeta.replicationPolicy.replicationAllowed).to.equal(true);
        expect(sysMeta.replicationPolicy.numberReplicas).to.equal(2);
        expect(sysMeta.replicationPolicy.preferredNodes).to.deep.equal([
          "urn:node:mnA",
          "urn:node:mnB",
        ]);
        expect(sysMeta.replicas).to.have.length(1);
        expect(sysMeta.replicas[0].replicationStatus).to.equal("completed");
        expect(sysMeta.replicas[0].replicaVerified).to.be.instanceof(Date);
        expect(sysMeta.seriesId).to.equal("series.1");
        expect(sysMeta.mediaType.name).to.equal("text/csv");
        expect(sysMeta.mediaType.properties[0].name).to.equal("charset");
        expect(sysMeta.fileName).to.equal("data.csv");
        expect(sysMeta.parseWarnings).to.deep.equal([]);
      });

      it("parses minimal XML and preserves defaults", () => {
        const sysMeta = SystemMetadata.fromXml(MINIMAL_XML);

        expect(sysMeta.identifier).to.equal("minimal.1");
        expect(sysMeta.serialVersion).to.equal(7);
        expect(sysMeta.archived).to.equal(true);
        expect(sysMeta.size).to.equal(1);
        expect(sysMeta.checksum.toJSON()).to.deep.equal({
          value: "abc",
          algorithm: "SHA-256",
        });
        expect(sysMeta.dateUploaded).to.equal(null);
        expect(sysMeta.replicationPolicy.hasValues()).to.equal(false);
        expect(sysMeta.mediaType.isEmpty()).to.equal(true);
      });

      it("silently repairs harmless XML shape problems", () => {
        expect(SystemMetadata.fromXml(NO_NAMESPACE_XML).identifier).to.equal(
          "sample.1",
        );
        expect(
          SystemMetadata.fromXml(DUPLICATE_IDENTIFIER_XML).identifier,
        ).to.equal("sample.2");
        expect(SystemMetadata.fromXml(UNKNOWN_CHILD_XML).identifier).to.equal(
          "sample.1",
        );

        const outOfOrder = SystemMetadata.fromXml(OUT_OF_ORDER_XML);
        expect(outOfOrder.identifier).to.equal("sample.1");
        expect(outOfOrder.formatId).to.equal("text/plain");

        const recoveredV2 = SystemMetadata.fromXml(V1_WITH_V2_FIELD_XML);
        expect(recoveredV2.seriesId).to.equal("series.1");
        expect(recoveredV2.parseWarnings).to.deep.equal([]);
      });

      it("drops invalid nested rules and replicas while keeping valid siblings", () => {
        const sysMeta = SystemMetadata.fromXml(INVALID_NESTED_XML);

        expect(sysMeta.accessPolicy).to.have.length(1);
        expect(sysMeta.accessPolicy[0].subject).to.equal("public");
        expect(sysMeta.replicas).to.have.length(1);
        expect(sysMeta.replicas[0].replicationStatus).to.equal("completed");
        expect(sysMeta.parseWarnings.map((issue) => issue.field)).to.include(
          "accessPolicy[1]",
        );
        expect(sysMeta.parseWarnings.map((issue) => issue.field)).to.include(
          "replicas[1]",
        );
      });

      it("drops invalid optional nested content while keeping valid siblings", () => {
        const sysMeta = SystemMetadata.fromXml(INVALID_OPTIONAL_XML);

        expect(sysMeta.replicationPolicy.hasValues()).to.equal(false);
        expect(sysMeta.mediaType.isEmpty()).to.equal(false);
        expect(sysMeta.mediaType.properties).to.have.length(1);
        expect(sysMeta.mediaType.properties[0].name).to.equal("charset");
        expect(sysMeta.parseWarnings.map((issue) => issue.field)).to.include(
          "replicationPolicy",
        );
        expect(sysMeta.parseWarnings.map((issue) => issue.field)).to.include(
          "mediaType.properties[1]",
        );
      });

      it("throws on malformed XML and resets the instance state", () => {
        const sysMeta = SystemMetadata.fromXml(FULL_XML);

        expect(() => sysMeta.parse(INVALID_XML)).to.throw(Error);
        expect(sysMeta.identifier).to.equal(null);
        expect(sysMeta.checksum.isEmpty()).to.equal(true);
        expect(sysMeta.parseWarnings).to.deep.equal([]);
      });

      it("rejects empty XML", () => {
        const sysMeta = new SystemMetadata();

        expect(() => sysMeta.parse(EMPTY_XML)).to.throw(/non-empty XML/i);
        expect(sysMeta.identifier).to.equal(null);
      });

      it("requires systemMetadata to be the document root", () => {
        expect(() => new SystemMetadata().parse(WRAPPED_XML)).to.throw(
          /expected root <systemMetadata>/i,
        );
      });

      it("requires the checksum algorithm attribute", () => {
        expect(() =>
          new SystemMetadata().parse(MISSING_CHECKSUM_ALGORITHM_XML),
        ).to.throw(/required "algorithm" attribute/i);
      });

      it("throws when required core scalar content cannot be recovered", () => {
        let thrown = null;

        try {
          new SystemMetadata().parse(INVALID_REQUIRED_XML);
        } catch (error) {
          thrown = error;
        }

        expect(thrown).to.be.instanceof(Error);
        expect(thrown.message).to.equal("SystemMetadata XML failed validation");
        expect(thrown.validationErrors.map((issue) => issue.field)).to.include(
          "size",
        );
      });

      it("records DataONE error XML as a parse failure", () => {
        let thrown = null;

        try {
          new SystemMetadata().parse(ERROR_XML);
        } catch (error) {
          thrown = error;
        }

        expect(thrown).to.be.instanceof(Error);
        expect(thrown.message).to.equal("READ not allowed");
        expect(thrown.status).to.equal("401");
      });
    });

    describe("serialize()", () => {
      it("round-trips parsed data through canonical v2 XML", () => {
        const sysMeta = SystemMetadata.fromXml(FULL_XML);
        const xml = sysMeta.serialize();
        const reparsed = SystemMetadata.fromXml(xml);
        const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

        expect(xml).to.contain(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        );
        expect(xmlDoc.documentElement.namespaceURI).to.equal(XML_NS_V2);
        expect(xmlDoc.documentElement.tagName).to.equal(
          "d1_v2.0:systemMetadata",
        );
        expect(xmlDoc.documentElement.getAttribute("xmlns:d1")).to.equal(
          XML_NS_V1,
        );
        expect(xmlDoc.documentElement.getAttribute("xmlns:d1_v2.0")).to.equal(
          XML_NS_V2,
        );
        expect(reparsed.toJSON()).to.deep.equal(sysMeta.toJSON());
      });

      it("serializes v1 input as canonical v2 XML", () => {
        const xml = SystemMetadata.fromXml(V1_XML).serialize();
        const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");

        expect(xmlDoc.documentElement.namespaceURI).to.equal(XML_NS_V2);
        expect(xmlDoc.documentElement.tagName).to.equal(
          "d1_v2.0:systemMetadata",
        );
      });

      it("serializes dates in canonical DataONE XML format", () => {
        const xml = SystemMetadata.fromXml(FULL_XML).serialize();

        expect(xml).to.contain(
          "<dateUploaded>2025-06-24T00:00:00.000+00:00</dateUploaded>",
        );
        expect(xml).to.contain(
          "<dateSysMetadataModified>2025-06-24T12:00:00.000+00:00</dateSysMetadataModified>",
        );
      });

      it("throws validation errors by default when the model is invalid", () => {
        const sysMeta = new SystemMetadata({
          identifier: "pid.1",
          checksum: "abc",
          checksumAlgorithm: "SHA-256",
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
        expect(thrown.validationErrors.map((issue) => issue.field)).to.include(
          "formatId",
        );
      });

      it("skips validation when validate=false", () => {
        const sysMeta = new SystemMetadata({
          identifier: "pid.1",
          checksum: "abc",
          checksumAlgorithm: "SHA-256",
          rightsHolder: "userA",
          dateUploaded: "not-a-date",
        });

        const xml = sysMeta.serialize({ validate: false });

        expect(xml).to.contain("<identifier>pid.1</identifier>");
        expect(xml).to.not.contain("Invalid Date");
      });
    });

    describe("validate()", () => {
      it("returns no validation errors for a complete document", () => {
        expect(SystemMetadata.fromXml(FULL_XML).validate()).to.deep.equal([]);
      });

      it("reports required and nested validation errors", () => {
        const sysMeta = new SystemMetadata({
          identifier: "pid.1",
          formatId: "",
          size: -1,
          checksum: "abc",
          checksumAlgorithm: "",
          rightsHolder: "",
          seriesId: "pid.1",
          accessPolicy: [{ subjects: [""], permissions: ["badPermission"] }],
          replicas: [
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

        const fields = sysMeta.validate().map((issue) => issue.field);

        expect(fields).to.include("formatId");
        expect(fields).to.include("size");
        expect(fields).to.include("checksum.algorithm");
        expect(fields).to.include("rightsHolder");
        expect(fields).to.include("seriesId");
        expect(fields).to.include("accessPolicy[0].subjects[0]");
        expect(fields).to.include("accessPolicy[0].permissions[0]");
        expect(fields).to.include("replicas[0].replicaMemberNode");
        expect(fields).to.include("replicas[0].replicationStatus");
        expect(fields).to.include("replicas[0].replicaVerified");
        expect(fields).to.include("mediaType.name");
        expect(fields).to.include("mediaType.property[0].name");
      });

      it("does not store validation state on the instance", () => {
        const sysMeta = new SystemMetadata({ identifier: "pid.1" });
        const issues = sysMeta.validate();

        expect(issues).to.be.an("array").and.not.be.empty;
        expect(sysMeta.validationErrors).to.equal(undefined);
      });
    });

    describe("owned child APIs", () => {
      it("edits root values and child domains through direct properties and standard mutators", () => {
        const sysMeta = new SystemMetadata();

        sysMeta.identifier = "pid.2";
        sysMeta.formatId = "text/csv";
        sysMeta.size = "42";
        sysMeta.rightsHolder = "userA";
        sysMeta.archived = "TRUE";
        sysMeta.fileName = "data.csv";
        sysMeta.checksum.set("abc", "SHA-256");
        sysMeta.accessPolicy
          .add({ subjects: ["public"], permissions: ["read"] })
          .add({ subjects: ["userA"], permissions: ["write"] })
          .replace(1, {
            subjects: ["userB"],
            permissions: ["changePermission"],
          })
          .remove(0);
        sysMeta.replicas
          .add({
            replicaMemberNode: "urn:node:mnA",
            replicationStatus: "requested",
            replicaVerified: "2025-06-25T00:00:00Z",
          })
          .replace(0, {
            replicaMemberNode: "urn:node:mnB",
            replicationStatus: "completed",
            replicaVerified: "2025-06-26T00:00:00Z",
          });
        sysMeta.replicationPolicy.replicationAllowed = true;
        sysMeta.replicationPolicy.numberReplicas = 2;
        sysMeta.replicationPolicy
          .add("urn:node:mnA", "preferred")
          .add("urn:node:mnZ", "blocked")
          .replace(0, "urn:node:mnB", "preferred");
        sysMeta.mediaType.name = "text/plain";
        sysMeta.mediaType
          .add({ name: "charset", value: "utf-8" })
          .replace(0, { name: "profile", value: "tabular" });

        expect(sysMeta.identifier).to.equal("pid.2");
        expect(sysMeta.size).to.equal("42");
        expect(sysMeta.accessPolicy).to.have.length(1);
        expect(sysMeta.accessPolicy[0].subjects).to.deep.equal(["userB"]);
        expect(sysMeta.replicas).to.have.length(1);
        expect(sysMeta.replicas[0].replicaMemberNode).to.equal("urn:node:mnB");
        expect(sysMeta.replicationPolicy.preferredNodes).to.deep.equal([
          "urn:node:mnB",
        ]);
        expect(sysMeta.replicationPolicy.blockedNodes).to.deep.equal([
          "urn:node:mnZ",
        ]);
        expect(sysMeta.mediaType.properties[0].toJSON()).to.deep.equal({
          name: "profile",
          value: "tabular",
        });
      });

      it("clears checksum, access rules, replicas, media type properties, and replication scopes", () => {
        const sysMeta = new SystemMetadata({
          checksum: "abc",
          checksumAlgorithm: "SHA-256",
          accessPolicy: [{ subjects: ["public"], permissions: ["read"] }],
          replicas: [
            {
              replicaMemberNode: "urn:node:mnA",
              replicationStatus: "completed",
              replicaVerified: "2025-06-25T00:00:00Z",
            },
          ],
          replicationPolicy: {
            replicationAllowed: true,
            numberReplicas: 2,
            preferredNodes: ["urn:node:mnA"],
            blockedNodes: ["urn:node:mnZ"],
          },
          mediaType: {
            name: "text/csv",
            properties: [{ name: "charset", value: "utf-8" }],
          },
        });

        sysMeta.mediaType.clear("properties");
        sysMeta.replicationPolicy.clear("preferred");
        sysMeta.checksum.clear();
        sysMeta.replicas.clear();
        sysMeta.accessPolicy.clear();

        expect(sysMeta.mediaType.name).to.equal("text/csv");
        expect(sysMeta.mediaType.properties).to.have.length(0);
        expect(sysMeta.replicationPolicy.preferredNodes).to.deep.equal([]);
        expect(sysMeta.replicationPolicy.blockedNodes).to.deep.equal([
          "urn:node:mnZ",
        ]);
        expect(sysMeta.checksum.isEmpty()).to.equal(true);
        expect(sysMeta.replicas).to.have.length(0);
        expect(sysMeta.accessPolicy).to.have.length(0);

        sysMeta.replicationPolicy.clear();
        sysMeta.mediaType.clear();

        expect(sysMeta.replicationPolicy.hasValues()).to.equal(false);
        expect(sysMeta.mediaType.isEmpty()).to.equal(true);
      });

      it("throws for unsupported child mutations", () => {
        const sysMeta = new SystemMetadata();

        expect(() => sysMeta.accessPolicy.replace(0, {})).to.throw(
          /could not find rule at index 0/i,
        );
        expect(() => sysMeta.replicas.remove(1)).to.throw(
          /could not find replica at index 1/i,
        );
        expect(() => sysMeta.mediaType.clear("name")).to.throw(
          /only supports scope "properties"/i,
        );
        expect(() =>
          sysMeta.replicationPolicy.add("urn:node:mnA", "weird"),
        ).to.throw(/must be "preferred" or "blocked"/i);
      });
    });

    describe("toJSON()", () => {
      it("returns the new domain-shaped JSON without parse warnings or .data", () => {
        const json = SystemMetadata.fromXml(FULL_XML).toJSON();

        expect(json.identifier).to.equal("sample.1");
        expect(json.checksum).to.equal("abcdef");
        expect(json.checksumAlgorithm).to.equal("SHA-256");
        expect(json.accessPolicy[0]).to.deep.equal({
          subjects: ["public"],
          permissions: ["read"],
        });
        expect(json.replicationPolicy).to.deep.equal({
          replicationAllowed: true,
          numberReplicas: 2,
          preferredNodes: ["urn:node:mnA", "urn:node:mnB"],
          blockedNodes: ["urn:node:mnZ"],
        });
        expect(json.replicas[0].replicaVerified).to.equal(
          "2025-06-25T00:00:00.000Z",
        );
        expect(json.mediaType).to.deep.equal({
          name: "text/csv",
          properties: [{ name: "charset", value: "utf-8" }],
        });
        expect(json.parseWarnings).to.equal(undefined);
        expect(json.data).to.equal(undefined);
        expect(json.replica).to.equal(undefined);
      });
    });

    describe("clone()", () => {
      it("returns an independent SystemMetadata copy", () => {
        const source = SystemMetadata.fromXml(FULL_XML);
        const clone = source.clone();

        expect(clone).to.be.instanceOf(SystemMetadata);
        expect(clone).to.not.equal(source);
        expect(clone.toJSON()).to.deep.equal(source.toJSON());

        clone.identifier = "changed.1";
        clone.checksum.clear();
        clone.accessPolicy.clear();
        expect(source.identifier).to.equal("sample.1");
        expect(source.checksum.value).to.not.equal(null);
        expect(source.accessPolicy.length).to.be.greaterThan(0);
      });
    });
  });
});
