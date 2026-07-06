define(["/test/js/specs/shared/clean-state.js", "common/UrlUtilities"], (
  cleanState,
  UrlUtilities,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("UrlUtilities", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      return { sandbox };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
    });

    it("normalizes slash modes and falls back for invalid values", () => {
      UrlUtilities.normalizeSlashMode("ensure").should.equal("ensure");
      UrlUtilities.normalizeSlashMode("nope").should.equal("preserve");
      UrlUtilities.normalizeSlashMode("nope", "remove").should.equal("remove");
    });

    it("coerces supported URL-like inputs into strings", () => {
      UrlUtilities.urlLikeToString(
        new String(" https://example.org/path "),
      ).should.equal(" https://example.org/path ");
      UrlUtilities.urlLikeToString(
        new URL("https://example.org/path"),
      ).should.equal("https://example.org/path");
      expect(
        UrlUtilities.urlLikeToString({ href: "https://example.org" }),
      ).to.equal(null);
    });

    it("splits url suffixes and absolute urls into their component parts", () => {
      UrlUtilities.splitUrlSuffix(
        "https://example.org/path?x=1#frag",
      ).should.deep.equal({
        base: "https://example.org/path",
        suffix: "?x=1#frag",
      });
      UrlUtilities.splitAbsoluteUrl(
        "https://example.org/path/to/object",
      ).should.deep.equal({
        prefix: "https://example.org",
        path: "/path/to/object",
      });
      UrlUtilities.splitAbsoluteUrl("path/to/object").should.deep.equal({
        prefix: "",
        path: "path/to/object",
      });
    });

    it("encodes individual path segments without double-encoding", () => {
      UrlUtilities.encodePathSegment("pid:abc%2F123").should.equal(
        "pid%3Aabc%2F123",
      );
      UrlUtilities.encodePathSegment("doi:10.5063/abc").should.equal(
        "doi%3A10.5063%2Fabc",
      );
      UrlUtilities.encodePathSegment("file name.txt").should.equal(
        "file%20name.txt",
      );
    });

    it("encodes RFC3986 path segments with the full pchar safe set", () => {
      UrlUtilities.encodeRFC3986PathSegment("doi:10.5063/abc").should.equal(
        "doi:10.5063%2Fabc",
      );
      UrlUtilities.encodeRFC3986PathSegment("urn:uuid:member.1").should.equal(
        "urn:uuid:member.1",
      );
      UrlUtilities.encodeRFC3986PathSegment(
        "pid+with plus/segment~",
      ).should.equal("pid+with%20plus%2Fsegment~");
    });

    it("encodes DataONE PID path segments using RFC3986 path-segment rules plus plus-sign escaping", () => {
      UrlUtilities.encodeDataONEPidForPath("doi:10.5063/abc").should.equal(
        "doi:10.5063%2Fabc",
      );
      UrlUtilities.encodeDataONEPidForPath("urn:uuid:member.1").should.equal(
        "urn:uuid:member.1",
      );
      UrlUtilities.encodeDataONEPidForPath(
        "pid+with plus/segment~",
      ).should.equal("pid%2Bwith%20plus%2Fsegment~");
    });

    it("decodes RFC3986 path segments and preserves DataONE plus-sign handling", () => {
      UrlUtilities.decodeRFC3986PathSegment(
        "pid+with%20plus%2Fsegment~",
      ).should.equal("pid+with plus/segment~");
      UrlUtilities.decodeDataONEPidFromPath(
        "pid+with%20plus%2Fsegment~",
      ).should.equal("pid+with plus/segment~");
      UrlUtilities.decodeDataONEPidFromPath(
        "pid%2Bwith%20plus%2Fsegment~",
      ).should.equal("pid+with plus/segment~");
    });

    it("decodes over-escaped encodeURIComponent output for DataONE PIDs", () => {
      UrlUtilities.decodeDataONEPidFromPath("doi%3A10.5063%2Fabc").should.equal(
        "doi:10.5063/abc",
      );
      UrlUtilities.decodeDataONEPidFromPath(
        "urn%3Auuid%3Amember.1",
      ).should.equal("urn:uuid:member.1");
    });

    it("encodes individual path segments", () => {
      const encoded = UrlUtilities.encodePathSegments("pid:abc/123");
      encoded.should.equal("pid%3Aabc/123");
    });

    it("encodes path segments without double-encoding", () => {
      const encoded = UrlUtilities.encodePathSegments("/object/pid:abc%2F123");
      encoded.should.equal("/object/pid%3Aabc%2F123");
    });

    it("should not change already encoded paths", () => {
      const encoded = UrlUtilities.encodePathSegments(
        "/object/pid%3Aabc%2F123",
      );
      encoded.should.equal("/object/pid%3Aabc%2F123");
    });

    it("should not double-encode encoded characters", () => {
      const encodedPath = "object/pid%3Aabc%252F123";
      const encoded = UrlUtilities.encodePathSegments(encodedPath);
      encoded.should.equal(encodedPath);
    });

    it("encodes invalid percent sequences without throwing", () => {
      const encoded = UrlUtilities.encodePathSegments("object/%E0%A4%A");
      encoded.should.equal("object/%25E0%25A4%25A");
    });

    it("should handle mixed encoded and unencoded segments", () => {
      const encoded = UrlUtilities.encodePathSegments(
        "/data/pid:abc%2F123/file name.txt",
      );
      encoded.should.equal("/data/pid%3Aabc%2F123/file%20name.txt");
    });

    it("should handle mixed encoding in the same segment", () => {
      const encoded = UrlUtilities.encodePathSegments(
        "object/pid:abc%2F123%3A456",
      );
      encoded.should.equal("object/pid%3Aabc%2F123%3A456");
    });

    it("should handle unicode characters", () => {
      const encoded = UrlUtilities.encodePathSegments("/data/\u6587\u4ef6.txt");
      encoded.should.equal("/data/%E6%96%87%E4%BB%B6.txt");
    });

    it("should throw an error for paths with query strings", () => {
      expect(() =>
        UrlUtilities.encodePathSegments("/data/pid:12345?version=1"),
      ).to.throw("encodePathSegments does not support query strings or hashes");
    });

    it("should throw an error for paths with hashes", () => {
      expect(() =>
        UrlUtilities.encodePathSegments("/data/pid:12345#section2"),
      ).to.throw("encodePathSegments does not support query strings or hashes");
    });

    it("normalizes path boundaries with explicit slash modes", () => {
      UrlUtilities.normalizePathBoundaries("/foo/bar", {
        leadingSlash: "remove",
        trailingSlash: "remove",
      }).should.equal("foo/bar");
    });

    it("can ensure both leading and trailing slashes", () => {
      UrlUtilities.normalizePathBoundaries("/foo/bar/", {
        leadingSlash: "ensure",
        trailingSlash: "ensure",
      }).should.equal("/foo/bar/");
    });

    it("can remove only the trailing slash while preserving the original leading slashes", () => {
      UrlUtilities.normalizePathBoundaries("///foo/bar//", {
        leadingSlash: "preserve",
        trailingSlash: "remove",
      }).should.equal("///foo/bar");
    });

    it("preserves query strings and hashes when normalizing path boundaries", () => {
      UrlUtilities.normalizePathBoundaries("/foo/bar//?x=1#frag", {
        leadingSlash: "ensure",
        trailingSlash: "remove",
      }).should.equal("/foo/bar?x=1#frag");
    });

    it("ignores leading-slash options for absolute URLs and can ensure a root slash", () => {
      UrlUtilities.normalizePathBoundaries("https://example.org?x=1#frag", {
        leadingSlash: "remove",
        trailingSlash: "ensure",
      }).should.equal("https://example.org/?x=1#frag");
    });

    it("handles root-only path values across slash modes", () => {
      UrlUtilities.normalizePathBoundaries("///", {
        leadingSlash: "preserve",
        trailingSlash: "preserve",
      }).should.equal("///");
      UrlUtilities.normalizePathBoundaries("///", {
        leadingSlash: "remove",
        trailingSlash: "remove",
      }).should.equal("");
      UrlUtilities.normalizePathBoundaries("///?x=1", {
        leadingSlash: "remove",
        trailingSlash: "ensure",
      }).should.equal("/?x=1");
    });

    it("builds URLs with encoded paths", () => {
      const url = UrlUtilities.buildUrl(
        "https://example.org",
        "object/pid:abc 123",
        { encodePath: true },
      );
      url.should.equal("https://example.org/object/pid%3Aabc%20123");
    });

    it("builds URLs for minimally encoded relative paths that begin with a scheme-like prefix", () => {
      UrlUtilities.buildUrl(
        "https://example.org/object/read",
        "doi:10.5063%2Fabc",
        { encodePath: false },
      ).should.equal("https://example.org/object/read/doi:10.5063%2Fabc");
    });

    it("maintains the full url when baseUrl includes path", () => {
      const url = UrlUtilities.buildUrl(
        "https://example.org/api/v1",
        "object/pid:abc 123",
        { encodePath: true },
      );
      url.should.equal("https://example.org/api/v1/object/pid%3Aabc%20123");
    });

    it("builds URLs with unencoded paths", () => {
      const url = UrlUtilities.buildUrl(
        "https://example.org",
        "object/pid:abc 123",
        { encodePath: false },
      );
      // The space is still encoded because JS's URL normalizes URLs to encode
      // characters that are not allowed in URLs
      url.should.equal("https://example.org/object/pid:abc%20123");
    });

    it("builds URLs with empty paths", () => {
      const url = UrlUtilities.buildUrl("https://example.org", "", {
        encodePath: true,
      });
      url.should.equal("https://example.org");
    });

    it("can build URLs from a fallback origin and throws when no base URL is available", () => {
      UrlUtilities.buildUrl("", "object/pid:abc 123", {
        fallbackOrigin: "https://fallback.example.org",
      }).should.equal("https://fallback.example.org/object/pid%3Aabc%20123");

      expect(() =>
        UrlUtilities.buildUrl("", "object/pid:abc 123", {
          fallbackOrigin: "",
        }),
      ).to.throw("UrlUtilities.buildUrl requires a baseUrl");
    });

    it("normalizes URLs and can preserve a trailing slash", () => {
      UrlUtilities.normalizeUrl(" https://example.org/path/// ").should.equal(
        "https://example.org/path",
      );
      UrlUtilities.normalizeUrl("https://example.org/path", "", {
        trailingSlash: "ensure",
      }).should.equal("https://example.org/path/");
    });

    it("returns an empty string for empty or null input", () => {
      UrlUtilities.normalizeUrl("").should.equal("");
      UrlUtilities.normalizeUrl(null).should.equal("");
    });

    it("uses a normalized fallback when the url is empty", () => {
      UrlUtilities.normalizeUrl("", "https://example.org/base/").should.equal(
        "https://example.org/base",
      );
    });

    it("can preserve trailing slashes when requested", () => {
      UrlUtilities.normalizeUrl("https://example.org/path///", "", {
        trailingSlash: "preserve",
      }).should.equal("https://example.org/path///");
    });

    it("can normalize path-like values with leading/trailing slash modes", () => {
      UrlUtilities.normalizeUrl("foo/bar", "", {
        leadingSlash: "ensure",
        trailingSlash: "ensure",
      }).should.equal("/foo/bar/");
    });

    it("normalizes explicit URL-like objects", () => {
      UrlUtilities.normalizeUrl(
        new URL("https://example.org/path///?x=1#frag"),
      ).should.equal("https://example.org/path?x=1#frag");
      UrlUtilities.normalizeUrl(
        new String(" https://example.org/path/// "),
      ).should.equal("https://example.org/path");
    });

    it("does not coerce non-url-like values such as numbers", () => {
      UrlUtilities.normalizeUrl(
        12345,
        "https://fallback.example/",
      ).should.equal("https://fallback.example");
      UrlUtilities.normalizeUrl(12345).should.equal("");
    });

    it("uses the fallback when normalization removes the original value", () => {
      UrlUtilities.normalizeUrl("/", "/fallback/", {
        leadingSlash: "remove",
        trailingSlash: "remove",
      }).should.equal("fallback");
    });

    it("can ensure a trailing slash without disturbing query strings or hashes", () => {
      UrlUtilities.normalizeUrl("https://example.org/path?x=1#frag", "", {
        trailingSlash: "ensure",
      }).should.equal("https://example.org/path/?x=1#frag");
    });

    it("normalizes trailing slashes consistently", () => {
      const url = "https://example.org/path///?x=1#frag";
      UrlUtilities.normalizeUrl(url, "", {
        trailingSlash: "ensure",
      }).should.equal("https://example.org/path/?x=1#frag");
    });

    it("preserves query parameters and hashes during default normalization", () => {
      UrlUtilities.normalizeUrl(
        "  https://example.org/path/?query=1#section  ",
      ).should.equal("https://example.org/path?query=1#section");
    });

    it("strips fragments and returns the last path segment", () => {
      UrlUtilities.stripFragment(
        "https://example.org/object/pid#frag",
      ).should.equal("https://example.org/object/pid");
      UrlUtilities.getLastPathSegment(
        "https://example.org/object/pid%3Aabc?x=1#frag",
      ).should.equal("pid%3Aabc");
      UrlUtilities.getLastPathSegment("https://example.org").should.equal("");
      UrlUtilities.getLastPathSegment("pid:abc").should.equal("pid:abc");
    });

    it("builds object download URLs from an explicit base URL", () => {
      UrlUtilities.getObjectDownloadUrl("doi:10.5063/F1/2", {
        baseUrl: "https://repo.example/object",
      }).should.equal("https://repo.example/object/doi%3A10.5063%2FF1%2F2");
    });

    it("defaults object download URLs to resolve before object service", () => {
      const originalMetacatUI = globalThis.MetacatUI;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: state.sandbox.stub().callsFake((key) => {
            if (key === "resolveServiceUrl") {
              return "https://repo.example/resolve/";
            }
            if (key === "objectServiceUrl") {
              return "https://repo.example/object/";
            }
            return "";
          }),
        },
      };

      try {
        UrlUtilities.getObjectDownloadUrl("data 1").should.equal(
          "https://repo.example/resolve/data%201",
        );
      } finally {
        globalThis.MetacatUI = originalMetacatUI;
      }
    });

    it("treats an explicit empty object download base as unavailable", () => {
      UrlUtilities.getObjectDownloadUrl("data.1", { baseUrl: "" }).should.equal(
        "",
      );
    });

    it("extracts base URLs with optional required path segments", () => {
      UrlUtilities.extractBaseUrl(
        "https://cn.dataone.org/cn/v2/resolve/pid%3Aabc#aggregation",
        {
          requiredPathSegment: "/resolve/",
        },
      ).should.equal("https://cn.dataone.org/cn/v2/resolve/");

      UrlUtilities.extractBaseUrl(
        "https://cn.dataone.org/cn/v2/object/pid%3Aabc",
        {
          requiredPathSegment: "/resolve/",
        },
      ).should.equal("");

      UrlUtilities.extractBaseUrl(
        "https://cn.dataone.org/cn/v2/resolve/pid%3Aabc?x=1",
        {
          trailingSlash: "remove",
        },
      ).should.equal("https://cn.dataone.org/cn/v2/resolve");

      UrlUtilities.extractBaseUrl("https://cn.dataone.org").should.equal("");
    });
  });
});
