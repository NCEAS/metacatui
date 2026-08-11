define(["backbone", "collections/ObjectFormats", "common/Utilities"], function (
  Backbone,
  ObjectFormats,
  Utilities,
) {
  var expect = chai.expect;

  describe("Utilities", function () {
    let originalMetacatUI;

    beforeEach(function () {
      originalMetacatUI = window.MetacatUI;
    });

    afterEach(function () {
      if (typeof originalMetacatUI === "undefined") {
        delete window.MetacatUI;
      } else {
        window.MetacatUI = originalMetacatUI;
      }
    });

    describe("processConcurrently", function () {
      it("limits concurrent work and collects errors by input order", async function () {
        let active = 0;
        let maxActive = 0;
        const completed = [];

        const result = await Utilities.processConcurrently(
          [1, 2, 3],
          async (item) => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise((resolve) => {
              setTimeout(resolve, 0);
            });
            active -= 1;
            completed.push(item);
            if (item === 2) throw new Error("bad item");
          },
          { maxConcurrent: 2, stopOnError: false },
        );

        expect(maxActive).to.be.at.most(2);
        expect(completed).to.have.members([1, 2, 3]);
        expect(result.errors).to.have.length(1);
        expect(result.errors[0].item).to.equal(2);
        expect(result.errors[0].index).to.equal(1);
      });
    });

    describe("getMaxConcurrent", function () {
      it("uses only the supplied value or project default", function () {
        window.MetacatUI = {
          appModel: {
            get: () => 2,
          },
        };

        expect(Utilities.getMaxConcurrent()).to.equal(
          Utilities.DEFAULT_MAX_CONCURRENT,
        );
        expect(Utilities.getMaxConcurrent("3")).to.equal(3);
      });
    });

    describe("tryParseCSVHeader", function () {
      var parse = Utilities.tryParseCSVHeader;

      it("handles various newlines", function () {
        expect(parse("a,b\n1,2\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n1,2")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n\n1,2\n\n")).to.deep.equal(["a", "b"]);
        expect(parse("a,b\n\n1,2")).to.deep.equal(["a", "b"]);
      });

      it("handles single quotes", function () {
        expect(parse("'a','b'\n1,2\n")).to.deep.equal(["a", "b"]);
      });

      it("handles double quotes", function () {
        expect(parse('"a","b"\n1,2\n')).to.deep.equal(["a", "b"]);
      });

      it("handles a mix of unquoted and quoted headers", function () {
        expect(parse('a,"b"\n1,2\n')).to.deep.equal(["a", "b"]);
      });
    });

    describe("formatNumber", function () {
      it("rounds number if the range is between 0.0001 and 100000", function () {
        expect(Utilities.formatNumber(0.000099999, 0.0001)).to.equal("0.00010");
        expect(Utilities.formatNumber(1.9, 100000)).to.equal("2");
      });

      it("uses scientific notation if the range is outside 0.0001 and 100000", function () {
        expect(Utilities.formatNumber(0.000099999, 0.000099999)).to.equal(
          "1.00e-4",
        );
        expect(Utilities.formatNumber(1.9, 100001)).to.equal("1.90e+0");
      });

      it("returns empty string if input value is not a number", function () {
        expect(Utilities.formatNumber("1.0", 0.000099999)).to.equal("");
      });

      it("returns value as is if range is not a number", function () {
        expect(Utilities.formatNumber(1.9, "invalid range")).to.equal("1.9");
      });
    });

    describe("formatFixedNumber", function () {
      it("formats finite numbers using fixed decimal places", function () {
        expect(Utilities.formatFixedNumber(1.2345, 2)).to.equal("1.23");
        expect(Utilities.formatFixedNumber(1.2345, 0)).to.equal("1");
      });

      it("returns the fallback for non-finite values", function () {
        expect(Utilities.formatFixedNumber(Number.NaN, 2, "n/a")).to.equal(
          "n/a",
        );
        expect(Utilities.formatFixedNumber(Infinity, 2, "n/a")).to.equal("n/a");
      });
    });

    describe("deepEqual", function () {
      it("returns true if two objects are deeply equal", function () {
        const a = { a: 1, b: { c: 2 } };
        const b = { a: 1, b: { c: 2 } };
        expect(Utilities.deepEqual(a, b)).to.equal(true);
      });

      it("returns false if two objects are not deeply equal", function () {
        const a = { a: 1, b: { c: 2 } };
        const b = { a: 1, b: { c: 3 } };
        expect(Utilities.deepEqual(a, b)).to.equal(false);
      });

      it("handles nested arrays", function () {
        expect(Utilities.deepEqual([1, 2, [3, 4]], [1, 2, [3, 4]])).to.equal(
          true,
        );
        expect(Utilities.deepEqual([1, 2, [3, 4]], [1, 2, [3, 5]])).to.equal(
          false,
        );
      });
    });

    describe("stableStringify", function () {
      it("returns identical strings for objects with different key order", function () {
        const a = { b: 2, a: 1, nested: { z: 3, a: 0 } };
        const b = { a: 1, nested: { a: 0, z: 3 }, b: 2 };

        expect(Utilities.stableStringify(a)).to.equal(
          Utilities.stableStringify(b),
        );
      });

      it("sorts arrays to make ordering irrelevant", function () {
        expect(Utilities.stableStringify({ list: [2, 1] })).to.equal(
          Utilities.stableStringify({ list: [1, 2] }),
        );
      });

      it("preserves array order when orderMatters is true", function () {
        const s1 = Utilities.stableStringify([2, 1], { orderMatters: true });
        const s2 = Utilities.stableStringify([1, 2], { orderMatters: true });

        expect(s1).to.equal('["number:2","number:1"]');
        expect(s2).to.equal('["number:1","number:2"]');
        expect(s1).to.not.equal(s2);
      });

      it("throws on circular references", function () {
        const a = { name: "circular" };
        a.self = a;

        expect(() => Utilities.stableStringify(a)).to.throw(/circular/);
      });

      it("allows shared references that are not circular", function () {
        const shared = { value: 1 };
        const obj = { a: shared, b: shared };

        expect(() => Utilities.stableStringify(obj)).to.not.throw();
      });

      it("normalizes string case when ignoreCase is true", function () {
        expect(Utilities.stableStringify({ name: "Alpha" })).to.equal(
          Utilities.stableStringify({ name: "alpha" }),
        );
      });

      it("respects ignoreCase when false", function () {
        const a = "  AbC  ";
        const s1 = Utilities.stableStringify(a, { ignoreCase: false });
        const s2 = Utilities.stableStringify(a, { ignoreCase: true });

        expect(s1).to.equal("AbC");
        expect(s2).to.equal("abc");
      });

      it("handles null and undefined values", function () {
        expect(Utilities.stableStringify({ value: null })).to.equal(
          Utilities.stableStringify({ value: undefined }),
        );
        expect(Utilities.stableStringify(null)).to.equal("null");
        expect(Utilities.stableStringify(undefined)).to.equal("null");
      });

      it("adds type prefixes for non-string primitives", function () {
        expect(Utilities.stableStringify(42)).to.equal("number:42");
        expect(Utilities.stableStringify(true)).to.equal("boolean:true");
        expect(Utilities.stableStringify(42n)).to.equal("bigint:42");
        expect(Utilities.stableStringify("42")).to.equal("42");
      });

      it("handles object primitive values", function () {
        const url = new URL("https://Example.com/Path");
        const err = new Error("Boom");
        const parsed = JSON.parse(
          Utilities.stableStringify({
            num: 42,
            date: new Date("2024-01-01T00:00:00Z"),
            regex: /test/i,
            url,
            err,
            func: function () {
              return "test";
            },
          }),
        );

        expect(parsed.num).to.equal("number:42");
        expect(parsed.date).to.equal("date:2024-01-01t00:00:00.000z");
        expect(parsed.regex).to.equal("regexp:/test/i");
        expect(parsed.url).to.equal(`url:${url.toString()}`.toLowerCase());
        expect(parsed.err).to.equal("error:boom");
        expect(parsed.func).to.match(/^function:[a-f0-9]{32}$/);
      });

      it("handles symbols with global and local keys", function () {
        const globalSym = Symbol.for("Token");
        const localSym = Symbol("Token");

        expect(Utilities.stableStringify(globalSym)).to.equal(
          "symbol:global:token",
        );
        expect(Utilities.stableStringify(localSym)).to.equal(
          "symbol:local:token",
        );
        expect(
          Utilities.stableStringify(globalSym, { ignoreCase: false }),
        ).to.equal("symbol:global:Token");
      });

      it("serializes Map entries without collapsing keys", function () {
        const map = new Map();
        map.set({ a: 1 }, "first");
        map.set({ b: 2 }, "second");

        const parsed = JSON.parse(Utilities.stableStringify(map));
        expect(parsed.type).to.equal("Map");
        expect(parsed.entries).to.have.length(2);
        const keys = parsed.entries.map((entry) => entry[0]);
        expect(keys).to.include('{"a":"number:1"}');
        expect(keys).to.include('{"b":"number:2"}');
      });

      it("throws on circular references in Map and Set", function () {
        const map = new Map();
        map.set("self", map);
        expect(() => Utilities.stableStringify(map)).to.throw(/circular/);

        const set = new Set();
        set.add(set);
        expect(() => Utilities.stableStringify(set)).to.throw(/circular/);
      });
    });

    describe("normalizeUrl", function () {
      it("trims whitespace and removes trailing slashes", function () {
        expect(
          Utilities.normalizeUrl("  https://example.org/path///  "),
        ).to.equal("https://example.org/path");
      });

      it("returns empty string for empty input", function () {
        expect(Utilities.normalizeUrl("")).to.equal("");
        expect(Utilities.normalizeUrl(null)).to.equal("");
      });

      it("uses fallback when url is empty", function () {
        expect(
          Utilities.normalizeUrl("", "https://example.org/base/"),
        ).to.equal("https://example.org/base");
      });

      it("handles URLs with query parameters and hashes", function () {
        expect(
          Utilities.normalizeUrl(
            "  https://example.org/path/?query=1#section  ",
          ),
        ).to.equal("https://example.org/path?query=1#section");
      });
    });

    describe("buildInstanceKey", function () {
      it("builds a raw key when encode is false", function () {
        const key = Utilities.buildInstanceKey(
          { baseUrl: " https://example.org/ ", ttlMs: 1000 },
          ["baseUrl", "ttlMs"],
          { baseUrl: Utilities.normalizeUrl },
          "|",
          false,
        );
        expect(key).to.equal("baseUrl:https://example.org|ttlMs:1000");
      });

      it("skips null and undefined fields", function () {
        const key = Utilities.buildInstanceKey(
          { a: "x", b: null, c: undefined },
          ["a", "b", "c"],
          {},
          "|",
          false,
        );
        expect(key).to.equal("a:x");
      });

      it("applies field normalizers", function () {
        const key = Utilities.buildInstanceKey(
          { name: "  Mixed  " },
          ["name"],
          { name: (value) => value.trim().toLowerCase() },
          "|",
          false,
        );
        expect(key).to.equal("name:mixed");
      });

      it("returns a hash when encode is true", function () {
        expect(Utilities.buildInstanceKey({ a: "x" }, ["a"])).to.match(
          /^[a-f0-9]{32}$/,
        );
      });

      it("throws when keys array is empty", function () {
        expect(() => Utilities.buildInstanceKey({}, [])).to.throw(/keys/);
      });
    });

    describe("awaitMetacatUI", function () {
      it("resolves the requested MetacatUI property when available", async function () {
        const appUserModel = { id: "user" };
        window.MetacatUI = { appUserModel };

        const result = await Utilities.awaitMetacatUI({
          property: "appUserModel",
          maxAttempts: 1,
          delay: 0,
        });

        expect(result).to.equal(appUserModel);
      });

      it("waits for a requested property instead of returning undefined", async function () {
        window.MetacatUI = {};

        try {
          await Utilities.awaitMetacatUI({
            property: "appUserModel",
            maxAttempts: 1,
            delay: 0,
          });
          throw new Error("Expected awaitMetacatUI to reject");
        } catch (error) {
          expect(error.message).to.equal(
            "Unable to retrieve MetacatUI.appUserModel",
          );
        }
      });

      it("returns falsy property values when they are explicitly defined", async function () {
        window.MetacatUI = { showBetaBanner: false };

        const result = await Utilities.awaitMetacatUI({
          property: "showBetaBanner",
          maxAttempts: 1,
          delay: 0,
        });

        expect(result).to.equal(false);
      });

      it("resolves properties from a nested appModel", async function () {
        window.MetacatUI = {
          appModel: {
            get(property) {
              return property === "metaServiceUrl"
                ? "https://example.org/meta"
                : undefined;
            },
          },
        };

        const result = await Utilities.awaitMetacatUI({
          property: "metaServiceUrl",
          maxAttempts: 1,
          delay: 0,
        });

        expect(result).to.equal("https://example.org/meta");
      });

      it("resolves properties from a named MetacatUI app", async function () {
        window.MetacatUI = {
          customApp: { serviceUrl: "https://example.org/service" },
        };

        const result = await Utilities.awaitMetacatUI({
          appName: "customApp",
          property: "serviceUrl",
          maxAttempts: 1,
          delay: 0,
        });

        expect(result).to.equal("https://example.org/service");
      });
    });

    describe("toJSONWithoutDefaults", function () {
      it("removes default values from a model's JSON representation", function () {
        const model = new Backbone.Model({
          a: 1,
          b: 200,
          c: 3,
        });

        model.defaults = () => ({
          a: 1,
          b: 2,
        });

        expect(Utilities.toJSONWithoutDefaults(model)).to.deep.equal({
          b: 200,
          c: 3,
        });
      });

      it("removes additional properties from a model's JSON representation", function () {
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

        expect(Utilities.toJSONWithoutDefaults(model, ["b"])).to.deep.equal({
          a: 100,
        });
      });
    });

    describe("bytesToSize", function () {
      it("handles undefined bytes", function () {
        expect(Utilities.bytesToSize(undefined, 2)).to.equal("0 B");
      });

      it("handles bytes less than 1 KiB", function () {
        expect(Utilities.bytesToSize(512, 2)).to.equal("512 B");
      });

      it("converts bytes to larger units with precision", function () {
        expect(Utilities.bytesToSize(2048, 2)).to.equal("2.00 KiB");
        expect(Utilities.bytesToSize(2 * 1024 * 1024, 3)).to.equal("2.000 MiB");
        expect(Utilities.bytesToSize(2 * 1024 * 1024 * 1024, 4)).to.equal(
          "2.0000 GiB",
        );
        expect(
          Utilities.bytesToSize(2 * 1024 * 1024 * 1024 * 1024, 5),
        ).to.equal("2.00000 TiB");
      });

      it("handles very large bytes", function () {
        expect(
          Utilities.bytesToSize(2 * 1024 * 1024 * 1024 * 1024 * 1024, 2),
        ).to.equal("2048.00 TiB");
      });
    });

    describe("awaitObjectFormats", function () {
      it("returns formats and allows retry after a fetch failure", async function () {
        const formats = new ObjectFormats();
        formats.fetch = sinon.stub().callsFake(function () {
          this.trigger("error", this);
        });
        window.MetacatUI = { objectFormats: formats };

        const result = await Utilities.awaitObjectFormats();

        expect(result).to.equal(formats);
        expect(formats.isFetching).to.equal(false);
        expect(formats.hasRemoteFormats).to.equal(false);
        expect(formats.lastFetchError.message).to.equal(
          "Failed to fetch object formats: Unknown error",
        );

        await Utilities.awaitObjectFormats();

        expect(formats.fetch.calledTwice).to.equal(true);
      });
    });
  });
});
