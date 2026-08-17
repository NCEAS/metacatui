define(["models/AppModel"], (AppModel) => {
  const should = chai.should();

  describe("AppModel", () => {
    describe("getDataONEMNAPIs", () => {
      const makeContext = ({
        d1Service = "/d1/mn/v2",
        context = "",
        packageFormat = "application/bagit-097",
      } = {}) => {
        const values = {
          d1Service,
          context,
          packageFormat,
          enableMonitorStatus: false,
        };
        return {
          get(key) {
            return values[key];
          },
        };
      };

      it("constructs objectServiceUrl for MN service URLs", () => {
        const context = makeContext({
          d1Service: "/d1/mn/v2",
          context: "/metacat",
        });
        const urls = AppModel.prototype.getDataONEMNAPIs.call(
          context,
          "https://example.org",
        );

        urls.objectServiceUrl.should.equal(
          "https://example.org/metacat/d1/mn/v2/object/",
        );
      });

      it("constructs CN identifier service URLs for CN service URLs", () => {
        const context = makeContext({
          d1Service: "/cn/v2",
          context: "/metacat",
        });
        const urls = AppModel.prototype.getDataONEMNAPIs.call(
          context,
          "https://example.org",
        );

        urls.generateServiceUrl.should.equal(
          "https://example.org/metacat/cn/v2/generate",
        );
        urls.reserveServiceUrl.should.equal(
          "https://example.org/metacat/cn/v2/reserve",
        );
      });
    });
  });
});
