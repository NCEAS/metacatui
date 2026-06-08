define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/DataONEHttpError",
], (cleanState, DataONEHttpError) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("DataONEHttpError", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      return { sandbox };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
    });

    it("truncates body text using the static helper", () => {
      const longText = "x".repeat(DataONEHttpError.DEFAULT_MAX_ERROR_BODY + 5);
      const truncated = DataONEHttpError.truncateBody(longText);
      truncated.length.should.equal(DataONEHttpError.DEFAULT_MAX_ERROR_BODY);
      should.equal(DataONEHttpError.truncateBody(42), null);
    });

    it("derives status, message, url, headers, and body from a response", () => {
      const response = {
        status: "500",
        url: "https://example.org/1",
        headers: { foo: "bar" },
        data: "oops",
      };

      const err = new DataONEHttpError({ response, attempt: 2 });
      expect(err.status).to.equal(500);
      err.message.should.equal("Request failed with status 500");
      err.url.should.equal("https://example.org/1");
      err.headers.should.equal(response.headers);
      err.bodyText.should.equal("oops");
      err.attempt.should.equal(2);
      err.networkError.should.be.false;
    });

    it("infers network errors from TypeError when no status", () => {
      const original = new TypeError("Network down");
      const err = new DataONEHttpError({ error: original, attempt: 3 });
      err.networkError.should.be.true;
      expect(err.status).to.equal(null);
      err.message.should.equal(original.message);
      err.attempt.should.equal(3);
    });

    it("honors explicit networkError override", () => {
      const err = new DataONEHttpError({
        status: 0,
        networkError: true,
        message: "",
      });
      err.networkError.should.be.true;
      err.message.should.equal("Network error");
    });

    it("prefers provided message over defaults", () => {
      const err = new DataONEHttpError({
        message: "Custom",
        status: 404,
      });
      err.message.should.equal("Custom");
      err.status.should.equal(404);
    });

    it("normalizes attempts to positive integers", () => {
      const err1 = new DataONEHttpError({ attempt: 0 });
      err1.attempt.should.equal(1);
      const err2 = new DataONEHttpError({ attempt: 2.7 });
      err2.attempt.should.equal(2);
    });
  });
});
