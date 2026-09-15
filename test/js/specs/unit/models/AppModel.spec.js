define(["models/AppModel"], (AppModel) => {
  const should = chai.should();

  describe("AppModel", () => {
    it("defaults the viewer package member limit to 3000", () => {
      AppModel.prototype.defaults.maxViewerPackageMembers.should.equal(3000);
    });

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

    describe("getDataPackageServiceOptions", () => {
      it("uses the local Member Node for reads and writes", () => {
        const context = {
          get: sinon.stub(),
          getActiveAltRepo: sinon.stub(),
          setActiveAltRepoIfRequired: sinon.stub(),
        };
        context.get
          .withArgs("objectServiceUrl")
          .returns("https://mn.example.org/object/");
        context.get
          .withArgs("metaServiceUrl")
          .returns("https://mn.example.org/meta/");
        context.get
          .withArgs("resolveServiceUrl")
          .returns("https://cn.example.org/resolve/");
        context.get
          .withArgs("packageServiceUrl")
          .returns("https://mn.example.org/packages/application%2Fbagit-1.0/");

        AppModel.prototype.getDataPackageServiceOptions
          .call(context)
          .should.deep.equal({
            objectServiceOptions: {
              readBaseUrl: "https://mn.example.org/object/",
              writeBaseUrl: "https://mn.example.org/object/",
            },
            packageServiceOptions: {
              baseUrl:
                "https://mn.example.org/packages/application%2Fbagit-1.0/",
            },
            sysMetaServiceOptions: {
              readBaseUrl: "https://mn.example.org/meta/",
              writeBaseUrl: "https://mn.example.org/meta/",
            },
            resolverOptions: {
              metaServiceUrl: "https://mn.example.org/meta/",
              resolveServiceUrl: "https://cn.example.org/resolve/",
              objectServiceUrl: "https://mn.example.org/object/",
            },
          });
        sinon.assert.notCalled(context.getActiveAltRepo);
        sinon.assert.notCalled(context.setActiveAltRepoIfRequired);
      });

      it("keeps Coordinating Node packages read-only", () => {
        const context = {
          get: sinon.stub(),
          getActiveAltRepo: sinon.stub().returns({
            objectServiceUrl: "https://mn.example.org/object/",
            metaServiceUrl: "https://mn.example.org/meta/",
          }),
          setActiveAltRepoIfRequired: sinon.stub(),
        };
        context.get.withArgs("objectServiceUrl").returns(null);
        context.get
          .withArgs("metaServiceUrl")
          .returns("https://cn.example.org/meta/");
        context.get
          .withArgs("resolveServiceUrl")
          .returns("https://cn.example.org/resolve/");
        context.get
          .withArgs("packageServiceUrl")
          .returns("https://cn.example.org/packages/application%2Fbagit-1.0/");

        AppModel.prototype.getDataPackageServiceOptions
          .call(context)
          .should.deep.equal({
            objectServiceOptions: {
              readBaseUrl: "https://cn.example.org/resolve/",
              writeBaseUrl: undefined,
            },
            packageServiceOptions: {
              baseUrl:
                "https://cn.example.org/packages/application%2Fbagit-1.0/",
            },
            sysMetaServiceOptions: {
              readBaseUrl: "https://cn.example.org/meta/",
              writeBaseUrl: undefined,
            },
            resolverOptions: {
              metaServiceUrl: "https://cn.example.org/meta/",
              resolveServiceUrl: "https://cn.example.org/resolve/",
              objectServiceUrl: null,
            },
          });
        sinon.assert.notCalled(context.getActiveAltRepo);
        sinon.assert.notCalled(context.setActiveAltRepoIfRequired);
      });
    });
  });
});
