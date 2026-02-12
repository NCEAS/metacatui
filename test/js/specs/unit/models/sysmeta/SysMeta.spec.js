define(["/test/js/specs/shared/clean-state.js", "models/sysmeta/SysMeta"], (
  cleanState,
  SysMeta,
) => {
  const should = chai.should();
  const expect = chai.expect;

  const SAMPLE_XML = `
    <systemMetadata>
      <identifier>sample.1</identifier>
      <formatId>text/plain</formatId>
      <size>12345</size>
      <checksum algorithm="SHA-256">abcdef</checksum>
      <submitter>userA</submitter>
      <rightsHolder>userB</rightsHolder>
      <archived>false</archived>
      <obsoletes>old.1</obsoletes>
      <obsoletedBy>new.1</obsoletedBy>
      <dateUploaded>2025-06-24T00:00:00Z</dateUploaded>
      <dateSysMetadataModified>2025-06-24T12:00:00Z</dateSysMetadataModified>
    </systemMetadata>
  `;
  const MINIMAL_XML = `
    <systemMetadata>
      <identifier>minimal.1</identifier>
      <archived>TRUE</archived>
      <serialVersion>7</serialVersion>
    </systemMetadata>
  `;
  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;
  const ERROR_XML_NO_DESC = `
    <error errorCode="500"></error>
  `;
  const ERROR_XML_NO_CODE = `
    <error><description>Oops</description></error>
  `;
  const XML_NO_ERROR = `
    <systemMetadata><identifier>ok</identifier></systemMetadata>
  `;
  const INVALID_XML = "<systemMetadata><identifier>bad</identifier>";

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

    describe("Instantiation & URL building", () => {
      it("initialises data with the defaults", () => {
        const s = new SysMeta({ identifier: "" });
        s.data.should.have.property("identifier", "");
        // a couple of representative defaults
        s.data.should.have.property("formatId", null);
        s.data.should.have.property("archived", false);
        s.data.should.have.property("preferredNodes").that.is.an("array");
      });

      it("creates independent default arrays per instance", () => {
        const a = new SysMeta();
        const b = new SysMeta();

        a.data.preferredNodes.push("node1");

        a.data.preferredNodes.should.have.length(1);
        b.data.preferredNodes.should.have.length(0);
        a.data.preferredNodes.should.not.equal(b.data.preferredNodes);
      });

      it("merges provided data over defaults", () => {
        const s = new SysMeta({
          identifier: "custom.1",
          archived: true,
          preferredNodes: ["nodeA"],
        });

        s.data.identifier.should.equal("custom.1");
        s.data.archived.should.equal(true);
        s.data.preferredNodes.should.deep.equal(["nodeA"]);
      });
    });

    describe("parse()", () => {
      it("parses simple text/number/boolean/date fields and checksum attrs", () => {
        const s = new SysMeta({ identifier: "sample.1" });
        const parsed = s.parse(SAMPLE_XML);

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
        s.parsed.should.be.true;
      });

      it("parses minimal XML and preserves defaults", () => {
        const s = new SysMeta();
        const parsed = s.parse(MINIMAL_XML);

        parsed.identifier.should.equal("minimal.1");
        parsed.serialVersion.should.equal(7);
        parsed.archived.should.equal(true);
        expect(parsed.size).to.equal(null);
        expect(parsed.checksum).to.equal(null);
        expect(parsed.checksumAlgorithm).to.equal(null);
        expect(parsed.dateUploaded).to.equal(null);

        s.parsed.should.be.true;
        s.parseError.should.be.false;
        s.fetchedXmlString.should.equal(MINIMAL_XML);
        parsed.should.equal(s.data);
      });

      it("creates independent arrays per parse", () => {
        const a = new SysMeta();
        const b = new SysMeta();

        a.parse(SAMPLE_XML);
        b.parse(SAMPLE_XML);

        a.data.accessPolicy.should.not.equal(b.data.accessPolicy);
        a.data.preferredNodes.should.not.equal(b.data.preferredNodes);
      });

      it("throws on invalid XML and sets parseError", () => {
        const s = new SysMeta();
        let caught;
        try {
          s.parse(INVALID_XML);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/Invalid SystemMetadata XML/);
        s.parseError.should.be.true;
        s.parsed.should.be.false;
        s.fetchedXmlString.should.equal(INVALID_XML);
      });
    });

    describe("parseError()", () => {
      it("returns null for empty input or no error element", () => {
        expect(SysMeta.parseError("")).to.equal(null);
        expect(SysMeta.parseError(null)).to.equal(null);
        expect(SysMeta.parseError(XML_NO_ERROR)).to.equal(null);
      });

      it("parses error details from an error response", () => {
        const err = SysMeta.parseError(ERROR_XML);
        expect(err).to.be.instanceof(Error);
        expect(err.name).to.equal("SysMetaError");
        expect(err.message).to.equal("READ not allowed");
        expect(err.status).to.equal("401");
      });

      it("uses fallback values when error fields are missing", () => {
        const errNoDesc = SysMeta.parseError(ERROR_XML_NO_DESC);
        expect(errNoDesc.message).to.equal("Unknown error");
        expect(errNoDesc.status).to.equal("500");

        const errNoCode = SysMeta.parseError(ERROR_XML_NO_CODE);
        expect(errNoCode.message).to.equal("Oops");
        expect(errNoCode.status).to.equal("unknown");
      });
    });

    describe("fromXml()", () => {
      it("returns a SysMeta instance with parsed data", () => {
        const sysMeta = SysMeta.fromXml(SAMPLE_XML);
        sysMeta.should.be.instanceof(SysMeta);
        sysMeta.parsed.should.be.true;
        sysMeta.data.identifier.should.equal("sample.1");
        sysMeta.data.checksumAlgorithm.should.equal("SHA-256");
      });
    });

    describe("toJSON()", () => {
      it("includes errors when parseError is true", () => {
        const s = new SysMeta();
        try {
          s.parse(INVALID_XML);
        } catch (e) {
          // expected
        }

        const json = s.toJSON(true);
        json.errors.should.be.an("array");
        json.errors[0].message.should.equal("Failed to parse SystemMetadata XML");
      });

      it("omits errors when includeErrors is false", () => {
        const s = new SysMeta();
        const json = s.toJSON(false);
        expect(json.errors).to.equal(undefined);
      });

      it("includes extra fields when requested", () => {
        const s = new SysMeta({ identifier: "pid.1" });
        s.versionHistory = { "pid.1": 0 };

        const json = s.toJSON(true, ["versionHistory"]);
        json.versionHistory.should.deep.equal({ "pid.1": 0 });
      });
    });
  });
});
