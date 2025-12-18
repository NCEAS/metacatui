define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/UrlBuilder",
], (cleanState, UrlBuilder) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("UrlBuilder", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      return { sandbox };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
    });

    it("encodes individual path segments", () => {
      const encoded = UrlBuilder.encodePathSegments("pid:abc/123");
      encoded.should.equal("pid%3Aabc/123");
    });

    it("encodes path segments without double-encoding", () => {
      const encoded = UrlBuilder.encodePathSegments("/object/pid:abc%2F123");
      encoded.should.equal("/object/pid%3Aabc%2F123");
    });

    it("should not change already encoded paths", () => {
      const encoded = UrlBuilder.encodePathSegments("/object/pid%3Aabc%2F123");
      encoded.should.equal("/object/pid%3Aabc%2F123");
    });

    it("should not double-encode encoded characters", () => {
      const encodedPath = "object/pid%3Aabc%252F123";
      const encoded = UrlBuilder.encodePathSegments(encodedPath);
      encoded.should.equal(encodedPath);
    });

    it("should handle mixed encoded and unencoded segments", () => {
      const encoded = UrlBuilder.encodePathSegments(
        "/data/pid:abc%2F123/file name.txt",
      );
      encoded.should.equal("/data/pid%3Aabc%2F123/file%20name.txt");
    });

    it("should handle mixed encoding in the same segment", () => {
      const encoded = UrlBuilder.encodePathSegments(
        "object/pid:abc%2F123%3A456",
      );
      encoded.should.equal("object/pid%3Aabc%2F123%3A456");
    });

    it("should handle unicode characters", () => {
      const encoded = UrlBuilder.encodePathSegments("/data/文件.txt");
      encoded.should.equal("/data/%E6%96%87%E4%BB%B6.txt");
    });

    it("should throw an error for paths with query strings", () => {
      expect(() =>
        UrlBuilder.encodePathSegments("/data/pid:12345?version=1"),
      ).to.throw("encodePathSegments does not support query strings or hashes");
    });

    it("should throw an error for paths with hashes", () => {
      expect(() =>
        UrlBuilder.encodePathSegments("/data/pid:12345#section2"),
      ).to.throw("encodePathSegments does not support query strings or hashes");
    });

    it("removes leaading and trailing slashes", () => {
      const corrected = UrlBuilder.correctSlashes("/foo/bar", false, false);
      corrected.should.equal("foo/bar");
    });

    it("keeps leading slash and trailing slashes", () => {
      const corrected = UrlBuilder.correctSlashes("/foo/bar/", true, true);
      corrected.should.equal("/foo/bar/");
    });

    it("corrects multiple leading and trailing slashes", () => {
      const corrected = UrlBuilder.correctSlashes("///foo/bar//", true, false);
      corrected.should.equal("/foo/bar");
    });

    it("builds URLs with encoded paths", () => {
      const url = UrlBuilder.buildUrl(
        "https://example.org",
        "object/pid:abc 123",
        true,
      );
      url.should.equal("https://example.org/object/pid%3Aabc%20123/");
    });

    it("maintains the full url when baseUrl includes path", () => {
      const url = UrlBuilder.buildUrl(
        "https://example.org/api/v1",
        "object/pid:abc 123",
        true,
      );
      url.should.equal("https://example.org/api/v1/object/pid%3Aabc%20123/");
    });

    it("builds URLs with unencoded paths", () => {
      const url = UrlBuilder.buildUrl(
        "https://example.org",
        "object/pid:abc 123",
        false,
      );
      // The space is still encoded because JS's URL normalizes URLs to encode
      // characters that are not allowed in URLs
      url.should.equal("https://example.org/object/pid:abc%20123/");
    });

    it("builds URLs with empty paths", () => {
      const url = UrlBuilder.buildUrl("https://example.org", "", true);
      url.should.equal("https://example.org/");
    });
  });
});
