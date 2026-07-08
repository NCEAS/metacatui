define(["common/Utilities"], function (EntityUtils) {
  var expect = chai.expect;

  describe("EntityUtils", function () {
    describe("tryParseCSVHeader", function () {
      var parse = EntityUtils.tryParseCSVHeader;

      it("should handle various newlines", function () {
        expect(parse("a,b\n1,2\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n1,2")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n1,2\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n1,2")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n\n1,2\n\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n\n1,2")).to.deep.equal(["a", "b"]);
      });

      it("should handle single quotes", function () {
        expect(parse("'a','b'\n1,2\n")).to.deep.equal(["a", "b"]);
      });

      it("should handle double quotes", function () {
        expect(parse('"a","b"\n1,2\n')).to.deep.equal(["a", "b"]);
      });

      it("should handle a mix of unquoted and quoted", function () {
        expect(parse('a,"b"\n1,2\n')).to.deep.equal(["a", "b"]);
      });
    });

    describe("formatNumber", () => {
      it("rounds number if the range is between 0.0001 and 100000", () => {
        expect(EntityUtils.formatNumber(0.000099999, 0.0001)).to.equal(
          "0.00010",
        );
        expect(EntityUtils.formatNumber(1.9, 100000)).to.equal("2");
      });

      it("uses scientific notation if the range is outside of 0.0001 and 100000", () => {
        expect(EntityUtils.formatNumber(0.000099999, 0.000099999)).to.equal(
          "1.00e-4",
        );
        expect(EntityUtils.formatNumber(1.9, 100001)).to.equal("1.90e+0");
      });

      it("returns empty string if input value isn't a number", () => {
        expect(EntityUtils.formatNumber("1.0", 0.000099999)).to.equal("");
      });

      it("returns value as is if range isn't a number", () => {
        expect(EntityUtils.formatNumber(1.9, "invalid range")).to.equal("1.9");
      });
    });

    describe("formatFixedNumber", () => {
      it("formats finite numbers using fixed decimal places", () => {
        expect(EntityUtils.formatFixedNumber(1.2345, 2)).to.equal("1.23");
        expect(EntityUtils.formatFixedNumber(1.2345, 0)).to.equal("1");
      });

      it("returns the fallback for non-finite values", () => {
        expect(EntityUtils.formatFixedNumber(Number.NaN, 2, "n/a")).to.equal(
          "n/a",
        );
        expect(EntityUtils.formatFixedNumber(Infinity, 2, "n/a")).to.equal(
          "n/a",
        );
      });
    });

    describe("deepEqual", () => {
      it("should return true if two objects are deeply equal", () => {
        const a = { a: 1, b: { c: 2 } };
        const b = { a: 1, b: { c: 2 } };
        expect(EntityUtils.deepEqual(a, b)).to.equal(true);
      });

      it("should return false if two objects are not deeply equal", () => {
        const a = { a: 1, b: { c: 2 } };
        const b = { a: 1, b: { c: 3 } };
        expect(EntityUtils.deepEqual(a, b)).to.equal(false);
      });

      it("should return true if two arrays are deeply equal", () => {
        const a = [1, 2, [3, 4]];
        const b = [1, 2, [3, 4]];
        expect(EntityUtils.deepEqual(a, b)).to.equal(true);
      });

      it("should return false if two arrays are not deeply equal", () => {
        const a = [1, 2, [3, 4]];
        const b = [1, 2, [3, 5]];
        expect(EntityUtils.deepEqual(a, b)).to.equal(false);
      });
    });

    describe("stableStringify", () => {
      it("returns identical strings for objects with different key order", () => {
        const a = { b: 2, a: 1, nested: { z: 3, a: 0 } };
        const b = { a: 1, nested: { a: 0, z: 3 }, b: 2 };

        const s1 = EntityUtils.stableStringify(a);
        const s2 = EntityUtils.stableStringify(b);

        expect(s1).to.equal(s2);
      });

      it("sorts arrays to make ordering irrelevant", () => {
        const a = { list: [2, 1] };
        const b = { list: [1, 2] };

        const s1 = EntityUtils.stableStringify(a);
        const s2 = EntityUtils.stableStringify(b);

        expect(s1).to.equal(s2);
      });

      it("preserves array order when orderMatters is true", () => {
        const a = [2, 1];
        const b = [1, 2];

        const s1 = EntityUtils.stableStringify(a, { orderMatters: true });
        const s2 = EntityUtils.stableStringify(b, { orderMatters: true });

        expect(s1).to.equal('["number:2","number:1"]');
        expect(s2).to.equal('["number:1","number:2"]');
        expect(s1).to.not.equal(s2);
      });

      it("throws on circular references", () => {
        const a = { name: "circular" };
        a.self = a;

        expect(() => EntityUtils.stableStringify(a)).to.throw(/circular/);
      });

      it("allows shared references that are not circular", () => {
        const shared = { value: 1 };
        const obj = { a: shared, b: shared };

        expect(() => EntityUtils.stableStringify(obj)).to.not.throw();
      });

      it("normalizes string case when ignoreCase is true", () => {
        const a = { name: "Alpha" };
        const b = { name: "alpha" };

        const s1 = EntityUtils.stableStringify(a, { ignoreCase: true });
        const s2 = EntityUtils.stableStringify(b, { ignoreCase: true });

        expect(s1).to.equal(s2);
      });

      it("respects ignoreCase when false", () => {
        const a = "  AbC  ";
        const s1 = EntityUtils.stableStringify(a, { ignoreCase: false });
        const s2 = EntityUtils.stableStringify(a, { ignoreCase: true });

        expect(s1).to.equal("AbC");
        expect(s2).to.equal("abc");
      });

      it("does not modify original objects", () => {
        const a = { name: "Alpha" };
        const b = { name: "alpha" };

        EntityUtils.stableStringify(a, { ignoreCase: true });
        EntityUtils.stableStringify(b, { ignoreCase: true });

        expect(a.name).to.equal("Alpha");
        expect(b.name).to.equal("alpha");
      });

      it("handles null and undefined values", () => {
        const a = { value: null };
        const b = { value: undefined };

        const s1 = EntityUtils.stableStringify(a);
        const s2 = EntityUtils.stableStringify(b);

        expect(s1).to.equal(s2);
      });

      it("stringifies null and undefined at the top level", () => {
        expect(EntityUtils.stableStringify(null)).to.equal("null");
        expect(EntityUtils.stableStringify(undefined)).to.equal("null");
      });

      it("adds type prefixes for non-string primitives", () => {
        expect(EntityUtils.stableStringify(42)).to.equal("number:42");
        expect(EntityUtils.stableStringify(true)).to.equal("boolean:true");
        expect(EntityUtils.stableStringify(42n)).to.equal("bigint:42");
        expect(EntityUtils.stableStringify("42")).to.equal("42");
      });

      it("handles non-object primitive values", () => {
        const url = new URL("https://Example.com/Path");
        const err = new Error("Boom");
        const a = {
          num: 42,
          date: new Date("2024-01-01T00:00:00Z"),
          regex: /test/i,
          url,
          err,
          func: function () {
            return "test";
          },
        };

        const s1 = EntityUtils.stableStringify(a);
        console.log(s1);
        const parsed = JSON.parse(s1);

        expect(parsed.num).to.equal("number:42");
        expect(parsed.date).to.equal("date:2024-01-01t00:00:00.000z");
        expect(parsed.regex).to.equal("regexp:/test/i");
        expect(parsed.url).to.equal(`url:${url.toString()}`.toLowerCase());
        expect(parsed.err).to.equal(`error:boom`.toLowerCase());
        expect(parsed.func).to.match(/^function:[a-f0-9]{32}$/);
      });

      it("handles symbols with global and local keys", () => {
        const globalSym = Symbol.for("Token");
        const localSym = Symbol("Token");

        expect(EntityUtils.stableStringify(globalSym)).to.equal(
          "symbol:global:token",
        );
        expect(EntityUtils.stableStringify(localSym)).to.equal(
          "symbol:local:token",
        );
        expect(
          EntityUtils.stableStringify(globalSym, { ignoreCase: false }),
        ).to.equal("symbol:global:Token");
      });

      it("serializes Map entries without collapsing keys", () => {
        const map = new Map();
        map.set({ a: 1 }, "first");
        map.set({ b: 2 }, "second");

        const parsed = JSON.parse(EntityUtils.stableStringify(map));
        expect(parsed.type).to.equal("Map");
        expect(parsed.entries).to.have.length(2);
        const keys = parsed.entries.map((entry) => entry[0]);
        expect(keys).to.include('{"a":"number:1"}');
        expect(keys).to.include('{"b":"number:2"}');
      });

      it("throws on circular references in Map and Set", () => {
        const map = new Map();
        map.set("self", map);
        expect(() => EntityUtils.stableStringify(map)).to.throw(/circular/);

        const set = new Set();
        set.add(set);
        expect(() => EntityUtils.stableStringify(set)).to.throw(/circular/);
      });

      it("throws on circular references in objects with shared references", () => {
        const shared = { value: 1 };
        const a = { name: "A", shared };
        const b = { name: "B", shared };
        a.self = a;
        b.self = b;

        expect(() => EntityUtils.stableStringify(a)).to.throw(/circular/);
        expect(() => EntityUtils.stableStringify(b)).to.throw(/circular/);
      });
    });

    describe("normalizeUrl", () => {
      it("trims whitespace and removes trailing slashes", () => {
        const url = "  https://example.org/path///  ";
        expect(EntityUtils.normalizeUrl(url)).to.equal(
          "https://example.org/path",
        );
      });

      it("returns empty string for empty input", () => {
        expect(EntityUtils.normalizeUrl("")).to.equal("");
        expect(EntityUtils.normalizeUrl(null)).to.equal("");
      });

      it("uses fallback when url is empty", () => {
        const fallback = "https://example.org/base/";
        expect(EntityUtils.normalizeUrl("", fallback)).to.equal(
          "https://example.org/base",
        );
      });

      it("coerces non-string input to string", () => {
        expect(EntityUtils.normalizeUrl(12345)).to.equal("12345");
      });

      it("handles URLs with query parameters and hashes", () => {
        const url = "  https://example.org/path/?query=1#section  ";
        const normal = EntityUtils.normalizeUrl(url);
        console.log(normal, url);
        // Trailing slash should be removed but query and hash should be preserved
        expect(normal).to.equal("https://example.org/path?query=1#section");
      });

      it("handles URLs that are just slashes", () => {
        expect(EntityUtils.normalizeUrl("///")).to.equal("");
      });

      it("handles URLs that are just whitespace", () => {
        expect(EntityUtils.normalizeUrl("   ")).to.equal("");
      });

      it("handles URLs that are just whitespace with fallback", () => {
        const fallback = "https://example.org/base/";
        expect(EntityUtils.normalizeUrl("   ", fallback)).to.equal(
          "https://example.org/base",
        );
      });
    });

    describe("buildInstanceKey", () => {
      it("builds a raw key when encode is false", () => {
        const options = { baseUrl: " https://example.org/ ", ttlMs: 1000 };
        const key = EntityUtils.buildInstanceKey(
          options,
          ["baseUrl", "ttlMs"],
          {
            baseUrl: EntityUtils.normalizeUrl,
          },
          "|",
          false,
        );
        expect(key).to.equal("baseUrl:https://example.org|ttlMs:1000");
      });

      it("skips null and undefined fields", () => {
        const options = { a: "x", b: null, c: undefined };
        const key = EntityUtils.buildInstanceKey(
          options,
          ["a", "b", "c"],
          {},
          "|",
          false,
        );
        expect(key).to.equal("a:x");
      });

      it("applies field normalizers", () => {
        const options = { name: "  Mixed  " };
        const key = EntityUtils.buildInstanceKey(
          options,
          ["name"],
          {
            name: (value) => value.trim().toLowerCase(),
          },
          "|",
          false,
        );
        expect(key).to.equal("name:mixed");
      });

      it("returns a hash when encode is true", () => {
        const options = { a: "x" };
        const key = EntityUtils.buildInstanceKey(options, ["a"]);
        expect(key).to.match(/^[a-f0-9]{32}$/);
      });

      it("throws when keys array is empty", () => {
        expect(() => EntityUtils.buildInstanceKey({}, [])).to.throw(/keys/);
      });
    });

    describe("awaitMetacatUI", () => {
      let originalMetacatUI;

      beforeEach(() => {
        originalMetacatUI = window.MetacatUI;
      });

      afterEach(() => {
        if (typeof originalMetacatUI === "undefined") {
          delete window.MetacatUI;
        } else {
          window.MetacatUI = originalMetacatUI;
        }
      });

      it("resolves the requested MetacatUI property when available", async () => {
        const appUserModel = { id: "user" };
        window.MetacatUI = { appUserModel };

        const result = await EntityUtils.awaitMetacatUI({
          property: "appUserModel",
          maxAttempts: 1,
          delay: 0,
        });

        expect(result).to.equal(appUserModel);
      });
    });

    describe("toJSONWithoutDefaults", () => {
      it("should remove default values from a model's JSON representation", () => {
        const model = new Backbone.Model({
          a: 1,
          b: 200,
          c: 3,
        });

        model.defaults = () => ({
          a: 1,
          b: 2,
        });

        const json = EntityUtils.toJSONWithoutDefaults(model);

        expect(json).to.deep.equal({ b: 200, c: 3 });
      });

      it("should remove additional properties from a model's JSON representation", () => {
        const model = new Backbone.Model({
          a: 100,
          b: 200,
          c: 3,
          d: 4,
        });

        model.defaults = () => ({
          a: 1,
          b: 2,
          c: 3,
          d: 4,
        });

        const json = EntityUtils.toJSONWithoutDefaults(model, ["b"]);
        expect(json).to.deep.equal({ a: 100 });
      });
    });
  });

  describe("Converting bytes to human-readable size", function () {
    it("should handle undefined bytes", function () {
      const result = EntityUtils.bytesToSize(undefined, 2);
      expect(result).to.equal("0 B");
    });

    it("should handle bytes less than 1 KiB", function () {
      const result = EntityUtils.bytesToSize(512, 2);
      expect(result).to.equal("512 B");
    });

    it("should convert bytes to KiB with precision", function () {
      const result = EntityUtils.bytesToSize(2048, 2);
      expect(result).to.equal("2.00 KiB");
    });

    it("should convert bytes to MiB with precision", function () {
      const result = EntityUtils.bytesToSize(2 * 1024 * 1024, 3);
      expect(result).to.equal("2.000 MiB");
    });

    it("should convert bytes to GiB with precision", function () {
      const result = EntityUtils.bytesToSize(2 * 1024 * 1024 * 1024, 4);
      expect(result).to.equal("2.0000 GiB");
    });

    it("should convert bytes to TiB with precision", function () {
      const result = EntityUtils.bytesToSize(2 * 1024 * 1024 * 1024 * 1024, 5);
      expect(result).to.equal("2.00000 TiB");
    });

    it("should handle very large bytes", function () {
      const result = EntityUtils.bytesToSize(
        2 * 1024 * 1024 * 1024 * 1024 * 1024,
        2,
      );
      expect(result).to.equal("2048.00 TiB");
    });
  });
});
