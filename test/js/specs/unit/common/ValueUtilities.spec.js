define(["common/ValueUtilities"], function (ValueUtilities) {
  var expect = chai.expect;

  describe("ValueUtilities", function () {
    describe("firstDefined", function () {
      it("returns the first non-undefined value", function () {
        expect(
          ValueUtilities.firstDefined(undefined, null, false, "later"),
        ).to.equal(null);
      });
    });

    describe("nullIfEmpty", function () {
      it("collapses nullish and empty-string values to null", function () {
        expect(ValueUtilities.nullIfEmpty(undefined)).to.equal(null);
        expect(ValueUtilities.nullIfEmpty(null)).to.equal(null);
        expect(ValueUtilities.nullIfEmpty("")).to.equal(null);
        expect(ValueUtilities.nullIfEmpty(" ")).to.equal(" ");
        expect(ValueUtilities.nullIfEmpty(false)).to.equal(false);
      });
    });

    describe("normalizeBoolean", function () {
      it("normalizes boolean-like values and preserves invalid input", function () {
        expect(ValueUtilities.normalizeBoolean("true")).to.equal(true);
        expect(ValueUtilities.normalizeBoolean("0")).to.equal(false);
        expect(ValueUtilities.normalizeBoolean("")).to.equal(null);
        expect(ValueUtilities.normalizeBoolean("maybe")).to.equal("maybe");
      });
    });

    describe("normalizeInteger", function () {
      it("normalizes integer-like values and preserves invalid input", function () {
        expect(ValueUtilities.normalizeInteger("7")).to.equal(7);
        expect(ValueUtilities.normalizeInteger("")).to.equal(null);
        expect(ValueUtilities.normalizeInteger("7.5")).to.equal("7.5");
      });
    });

    describe("normalizeStringArray", function () {
      it("wraps single values and trims entries", function () {
        expect(ValueUtilities.normalizeStringArray("  a  ")).to.deep.equal([
          "a",
        ]);
        expect(
          ValueUtilities.normalizeStringArray([" a ", null, "b"]),
        ).to.deep.equal(["a", "b"]);
      });
    });

    describe("dedupeArray", function () {
      it("deduplicates arrays while preserving order", function () {
        expect(ValueUtilities.dedupeArray(["a", "b", "a"])).to.deep.equal([
          "a",
          "b",
        ]);
        expect(ValueUtilities.dedupeArray("nope")).to.deep.equal([]);
      });
    });

    describe("predicates", function () {
      it("checks non-empty strings and unsigned integers", function () {
        expect(ValueUtilities.isNonEmptyString(" a ")).to.equal(true);
        expect(ValueUtilities.isNonEmptyString("   ")).to.equal(false);
        expect(ValueUtilities.isUnsignedInteger(0)).to.equal(true);
        expect(ValueUtilities.isUnsignedInteger(-1)).to.equal(false);
      });
    });

    describe("formatNumber", function () {
      it("rounds numbers when the range is in fixed-point territory", function () {
        expect(ValueUtilities.formatNumber(0.000099999, 0.0001)).to.equal(
          "0.00010",
        );
        expect(ValueUtilities.formatNumber(1.9, 100000)).to.equal("2");
      });

      it("uses scientific notation outside the fixed-point range", function () {
        expect(ValueUtilities.formatNumber(0.000099999, 0.000099999)).to.equal(
          "1.00e-4",
        );
        expect(ValueUtilities.formatNumber(1.9, 100001)).to.equal("1.90e+0");
      });

      it("returns empty string for non-number values", function () {
        expect(ValueUtilities.formatNumber("1.0", 0.000099999)).to.equal("");
      });

      it("returns the value string when range is not numeric", function () {
        expect(ValueUtilities.formatNumber(1.9, "invalid range")).to.equal(
          "1.9",
        );
      });
    });

    describe("deepEqual", function () {
      it("returns true for deeply equal objects", function () {
        const a = { a: 1, b: { c: 2 } };
        const b = { a: 1, b: { c: 2 } };
        expect(ValueUtilities.deepEqual(a, b)).to.equal(true);
      });

      it("returns false for non-equal objects", function () {
        const a = { a: 1, b: { c: 2 } };
        const b = { a: 1, b: { c: 3 } };
        expect(ValueUtilities.deepEqual(a, b)).to.equal(false);
      });

      it("returns true for deeply equal arrays", function () {
        const a = [1, 2, [3, 4]];
        const b = [1, 2, [3, 4]];
        expect(ValueUtilities.deepEqual(a, b)).to.equal(true);
      });

      it("returns false for non-equal arrays", function () {
        const a = [1, 2, [3, 4]];
        const b = [1, 2, [3, 5]];
        expect(ValueUtilities.deepEqual(a, b)).to.equal(false);
      });
    });

    describe("stableStringify", function () {
      it("returns identical strings for objects with different key order", function () {
        const a = { b: 2, a: 1, nested: { z: 3, a: 0 } };
        const b = { a: 1, nested: { a: 0, z: 3 }, b: 2 };

        const s1 = ValueUtilities.stableStringify(a);
        const s2 = ValueUtilities.stableStringify(b);

        expect(s1).to.equal(s2);
      });

      it("sorts arrays to make ordering irrelevant", function () {
        const a = { list: [2, 1] };
        const b = { list: [1, 2] };

        const s1 = ValueUtilities.stableStringify(a);
        const s2 = ValueUtilities.stableStringify(b);

        expect(s1).to.equal(s2);
      });

      it("preserves array order when orderMatters is true", function () {
        const a = [2, 1];
        const b = [1, 2];

        const s1 = ValueUtilities.stableStringify(a, { orderMatters: true });
        const s2 = ValueUtilities.stableStringify(b, { orderMatters: true });

        expect(s1).to.equal('["number:2","number:1"]');
        expect(s2).to.equal('["number:1","number:2"]');
        expect(s1).to.not.equal(s2);
      });

      it("throws on circular references", function () {
        const a = { name: "circular" };
        a.self = a;

        expect(function () {
          ValueUtilities.stableStringify(a);
        }).to.throw(/circular/);
      });

      it("allows shared references that are not circular", function () {
        const shared = { value: 1 };
        const obj = { a: shared, b: shared };

        expect(function () {
          ValueUtilities.stableStringify(obj);
        }).to.not.throw();
      });

      it("normalizes string case when ignoreCase is true", function () {
        const a = { name: "Alpha" };
        const b = { name: "alpha" };

        const s1 = ValueUtilities.stableStringify(a, { ignoreCase: true });
        const s2 = ValueUtilities.stableStringify(b, { ignoreCase: true });

        expect(s1).to.equal(s2);
      });

      it("respects ignoreCase when false", function () {
        const a = "  AbC  ";
        const s1 = ValueUtilities.stableStringify(a, { ignoreCase: false });
        const s2 = ValueUtilities.stableStringify(a, { ignoreCase: true });

        expect(s1).to.equal("AbC");
        expect(s2).to.equal("abc");
      });

      it("does not modify original objects", function () {
        const a = { name: "Alpha" };
        const b = { name: "alpha" };

        ValueUtilities.stableStringify(a, { ignoreCase: true });
        ValueUtilities.stableStringify(b, { ignoreCase: true });

        expect(a.name).to.equal("Alpha");
        expect(b.name).to.equal("alpha");
      });

      it("handles null and undefined values", function () {
        const a = { value: null };
        const b = { value: undefined };

        const s1 = ValueUtilities.stableStringify(a);
        const s2 = ValueUtilities.stableStringify(b);

        expect(s1).to.equal(s2);
      });

      it("stringifies null and undefined at the top level", function () {
        expect(ValueUtilities.stableStringify(null)).to.equal("null");
        expect(ValueUtilities.stableStringify(undefined)).to.equal("null");
      });

      it("adds type prefixes for non-string primitives", function () {
        expect(ValueUtilities.stableStringify(42)).to.equal("number:42");
        expect(ValueUtilities.stableStringify(true)).to.equal("boolean:true");
        expect(ValueUtilities.stableStringify(42n)).to.equal("bigint:42");
        expect(ValueUtilities.stableStringify("42")).to.equal("42");
      });

      it("handles non-object primitive values", function () {
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

        const parsed = JSON.parse(ValueUtilities.stableStringify(a));

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

        expect(ValueUtilities.stableStringify(globalSym)).to.equal(
          "symbol:global:token",
        );
        expect(ValueUtilities.stableStringify(localSym)).to.equal(
          "symbol:local:token",
        );
        expect(
          ValueUtilities.stableStringify(globalSym, { ignoreCase: false }),
        ).to.equal("symbol:global:Token");
      });

      it("serializes Map entries without collapsing keys", function () {
        const map = new Map();
        map.set({ a: 1 }, "first");
        map.set({ b: 2 }, "second");

        const parsed = JSON.parse(ValueUtilities.stableStringify(map));
        expect(parsed.type).to.equal("Map");
        expect(parsed.entries).to.have.length(2);
        const keys = parsed.entries.map(function (entry) {
          return entry[0];
        });
        expect(keys).to.include('{"a":"number:1"}');
        expect(keys).to.include('{"b":"number:2"}');
      });

      it("throws on circular references in Map and Set", function () {
        const map = new Map();
        map.set("self", map);
        expect(function () {
          ValueUtilities.stableStringify(map);
        }).to.throw(/circular/);

        const set = new Set();
        set.add(set);
        expect(function () {
          ValueUtilities.stableStringify(set);
        }).to.throw(/circular/);
      });
    });

    describe("normalizeUrl", function () {
      it("trims whitespace and removes trailing slashes", function () {
        const url = "  https://example.org/path///  ";
        expect(ValueUtilities.normalizeUrl(url)).to.equal(
          "https://example.org/path",
        );
      });

      it("returns empty string for empty input", function () {
        expect(ValueUtilities.normalizeUrl("")).to.equal("");
        expect(ValueUtilities.normalizeUrl(null)).to.equal("");
      });

      it("uses fallback when url is empty", function () {
        const fallback = "https://example.org/base/";
        expect(ValueUtilities.normalizeUrl("", fallback)).to.equal(
          "https://example.org/base",
        );
      });

      it("coerces non-string input to string", function () {
        expect(ValueUtilities.normalizeUrl(12345)).to.equal("12345");
      });

      it("preserves query parameters and hashes", function () {
        const url = "  https://example.org/path/?query=1#section  ";
        expect(ValueUtilities.normalizeUrl(url)).to.equal(
          "https://example.org/path?query=1#section",
        );
      });
    });

    describe("buildInstanceKey", function () {
      it("builds a raw key when encode is false", function () {
        const options = { baseUrl: " https://example.org/ ", ttlMs: 1000 };
        const key = ValueUtilities.buildInstanceKey(
          options,
          ["baseUrl", "ttlMs"],
          {
            baseUrl: ValueUtilities.normalizeUrl,
          },
          "|",
          false,
        );
        expect(key).to.equal("baseUrl:https://example.org|ttlMs:1000");
      });

      it("skips null and undefined fields", function () {
        const options = { a: "x", b: null, c: undefined };
        const key = ValueUtilities.buildInstanceKey(
          options,
          ["a", "b", "c"],
          {},
          "|",
          false,
        );
        expect(key).to.equal("a:x");
      });

      it("applies field normalizers", function () {
        const options = { name: "  Mixed  " };
        const key = ValueUtilities.buildInstanceKey(
          options,
          ["name"],
          {
            name: function (value) {
              return value.trim().toLowerCase();
            },
          },
          "|",
          false,
        );
        expect(key).to.equal("name:mixed");
      });

      it("returns a hash when encode is true", function () {
        const options = { a: "x" };
        const key = ValueUtilities.buildInstanceKey(options, ["a"]);
        expect(key).to.match(/^[a-f0-9]{32}$/);
      });

      it("throws when keys array is empty", function () {
        expect(function () {
          ValueUtilities.buildInstanceKey({}, []);
        }).to.throw(/keys/);
      });
    });

    describe("getSingleton", function () {
      it("returns the same instance for the same key", function () {
        class ExampleSingleton {
          constructor(options) {
            this.options = options;
          }
        }

        const buildKey = function (options) {
          return options.id;
        };

        const first = ValueUtilities.getSingleton(
          ExampleSingleton,
          { id: "a" },
          buildKey,
        );
        const second = ValueUtilities.getSingleton(
          ExampleSingleton,
          { id: "a" },
          buildKey,
        );

        expect(first).to.equal(second);
      });
    });

    describe("toJSONWithoutDefaults", function () {
      it("removes default values from a model's JSON representation", function () {
        const model = new Backbone.Model({
          a: 1,
          b: 200,
          c: 3,
        });

        model.defaults = function () {
          return {
            a: 1,
            b: 2,
          };
        };

        const json = ValueUtilities.toJSONWithoutDefaults(model);

        expect(json).to.deep.equal({ b: 200, c: 3 });
      });

      it("removes additional properties when requested", function () {
        const model = new Backbone.Model({
          a: 100,
          b: 200,
          c: 3,
          d: 4,
        });

        model.defaults = function () {
          return {
            a: 1,
            b: 2,
            c: 3,
            d: 4,
          };
        };

        const json = ValueUtilities.toJSONWithoutDefaults(model, ["b"]);
        expect(json).to.deep.equal({ a: 100 });
      });
    });

    describe("bytesToSize", function () {
      it("handles undefined bytes", function () {
        expect(ValueUtilities.bytesToSize(undefined, 2)).to.equal("0 B");
      });

      it("formats byte units with precision", function () {
        expect(ValueUtilities.bytesToSize(512, 2)).to.equal("512 B");
        expect(ValueUtilities.bytesToSize(2048, 2)).to.equal("2.00 KiB");
        expect(ValueUtilities.bytesToSize(2 * 1024 * 1024, 3)).to.equal(
          "2.000 MiB",
        );
        expect(
          ValueUtilities.bytesToSize(2 * 1024 * 1024 * 1024, 4),
        ).to.equal("2.0000 GiB");
        expect(
          ValueUtilities.bytesToSize(2 * 1024 * 1024 * 1024 * 1024, 5),
        ).to.equal("2.00000 TiB");
      });
    });

    describe("wildcardToRegex", function () {
      it("turns wildcard strings into case-insensitive regexes", function () {
        expect(ValueUtilities.wildcardToRegex("eml*").test("eml://abc")).to.be
          .true;
        expect(ValueUtilities.wildcardToRegex("*iso*").test("MY-ISO-FILE")).to
          .be.true;
      });
    });

    describe("getCaseInsensitive", function () {
      it("reads object values by case-insensitive key", function () {
        const value = ValueUtilities.getCaseInsensitive(
          { Accept: "text/plain" },
          "accept",
        );
        expect(value).to.equal("text/plain");
      });

      it("applies an optional value normalizer", function () {
        const value = ValueUtilities.getCaseInsensitive(
          { Accept: " text/plain " },
          "accept",
          function (raw) {
            return raw.trim();
          },
        );
        expect(value).to.equal("text/plain");
      });
    });
  });
});
