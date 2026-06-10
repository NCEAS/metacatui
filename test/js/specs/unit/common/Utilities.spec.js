define(["common/Utilities"], function (Utilities) {
  var expect = chai.expect;

  describe("Utilities", function () {
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

    describe("awaitMetacatUI", function () {
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
  });
});
