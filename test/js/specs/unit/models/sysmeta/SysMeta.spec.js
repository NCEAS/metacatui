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
      it("throws if no identifier is supplied", () => {
        expect(() => new SysMeta()).to.throw("identifier is required");
      });

      it("uses the default metaServiceUrl when none is supplied", () => {
        const s = new SysMeta({ identifier: "foo" });
        s.metaServiceUrl.should.equal(
          SysMeta.DEFAULT_META_SERVICE_URL.endsWith("/")
            ? SysMeta.DEFAULT_META_SERVICE_URL
            : `${SysMeta.DEFAULT_META_SERVICE_URL}/`,
        );
      });

      it("always stores metaServiceUrl with a trailing slash", () => {
        const s = new SysMeta({
          identifier: "abc",
          metaServiceUrl: "https://mynode.org/sysmeta",
        });
        s.metaServiceUrl.should.equal("https://mynode.org/sysmeta/");
      });

      it("builds a correct URL using encodeURIComponent", () => {
        const s = new SysMeta({
          identifier: "weird id/with#chars",
          metaServiceUrl: "https://x/",
        });
        s.url.should.equal(
          `https://x/${encodeURIComponent("weird id/with#chars")}`,
        );
      });

      it("throws if url() is accessed with an empty/invalid identifier", () => {
        const s = new SysMeta({
          identifier: "good",
          metaServiceUrl: "https://x/",
        });
        // Manually blank-out identifier so we can test the guard
        s.data.identifier = "";
        expect(() => s.url).to.throw("identifier must be a non-empty string");
      });

      it("initialises data with the defaults plus identifier", () => {
        const s = new SysMeta({ identifier: "id.1" });
        s.data.should.have.property("identifier", "id.1");
        // a couple of representative defaults
        s.data.should.have.property("formatId", null);
        s.data.should.have.property("archived", false);
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
    });

    describe("fetch()", () => {
      it("successfully fetches, parses and populates data", async () => {
        // Stub global fetch so we don't hit the network
        state.sandbox.stub(globalThis, "fetch").resolves({
          ok: true,
          text: () => Promise.resolve(SAMPLE_XML),
        });

        const s = new SysMeta({
          identifier: "sample.1",
          metaServiceUrl: "https://example.org/sysmeta/",
        });

        const data = await s.fetch();
        // Basic expectations
        data.identifier.should.equal("sample.1");
        s.fetched.should.be.true;
        s.fetchedWithError.should.be.false;
        s.parsed.should.be.true;
      });

      it("adds an Authorization header when a token is supplied", async () => {
        const TOKEN = "abc123token";
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .callsFake((url, opts = {}) => {
            opts.should.have.nested.property(
              "headers.Authorization",
              `Bearer ${TOKEN}`,
            );
            return Promise.resolve({
              ok: true,
              text: () => Promise.resolve(SAMPLE_XML),
            });
          });

        const s = new SysMeta({ identifier: "sample.1" });
        await s.fetch(TOKEN);
        fetchStub.calledOnce.should.be.true;
      });

      it("records an error when the response is not ok", async () => {
        state.sandbox.stub(globalThis, "fetch").resolves({
          ok: false,
          status: 500,
          statusText: "Server error",
          text: () => Promise.resolve(""),
        });

        const s = new SysMeta({
          identifier: "err.1",
          metaServiceUrl: "https://x/",
        });

        const result = await s.fetch();
        should.not.exist(result);
        s.fetched.should.be.false;
        s.fetchedWithError.should.be.true;
        s.errors.should.be.an("array").with.lengthOf(1);
        s.errors[0].status.should.equal(500);
      });

      it("handles network-level fetch rejections", async () => {
        state.sandbox
          .stub(globalThis, "fetch")
          .rejects(new Error("Network down"));

        const s = new SysMeta({ identifier: "net.1" });
        const result = await s.fetch();
        should.not.exist(result);
        s.fetched.should.be.false;
        s.fetchedWithError.should.be.true;
        s.errors[0].message.should.equal("Network down");
      });
    });
  });
});
