define([
  "/test/js/specs/shared/clean-state.js",
  "backbone",
  "views/MetadataView",
  "common/QueryService",
], (cleanState, Backbone, MetadataView, QueryService) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("MetadataView resolvePackageIDs()", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const originalMetacatUI = globalThis.MetacatUI;
        if (!globalThis.MetacatUI) {
          globalThis.MetacatUI = {};
        }
        if (!globalThis.MetacatUI.analytics) {
          globalThis.MetacatUI.analytics = {};
        }
        if (
          typeof globalThis.MetacatUI.analytics.trackException !== "function"
        ) {
          globalThis.MetacatUI.analytics.trackException = () => {};
        }
        sandbox.stub(globalThis.MetacatUI.analytics, "trackException");

        return { sandbox, originalMetacatUI };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
      globalThis.MetacatUI = state.originalMetacatUI;
    });

    it("returns the Solr package ID unchanged when exactly one is present", async () => {
      const getResolverStub = state.sandbox.stub();
      const context = {
        model: new Backbone.Model({ id: "pid.1" }),
        pid: "pid.1",
        getResourceMapResolver: getResolverStub,
      };

      const result = await MetadataView.prototype.resolvePackageIDs.call(
        context,
        ["rm.1"],
      );

      result.should.deep.equal(["rm.1"]);
      getResolverStub.called.should.be.false;
    });

    it("uses ResourceMapResolver when Solr does not provide a package ID", async () => {
      const resolver = {
        resolve: state.sandbox.stub().resolves({
          success: true,
          rm: "rm.resolved",
        }),
      };
      const context = {
        model: new Backbone.Model({ id: "pid.2" }),
        pid: "pid.2",
        getResourceMapResolver: state.sandbox.stub().resolves(resolver),
      };

      const result = await MetadataView.prototype.resolvePackageIDs.call(
        context,
        [],
      );

      result.should.deep.equal(["rm.resolved"]);
      resolver.resolve.calledOnceWithExactly("pid.2").should.be.true;
    });

    it("uses ResourceMapResolver to collapse multiple Solr package IDs to one", async () => {
      const resolver = {
        resolve: state.sandbox.stub().resolves({
          success: true,
          rm: "rm.latest",
        }),
      };
      const context = {
        model: new Backbone.Model({ id: "pid.3" }),
        pid: "pid.3",
        getResourceMapResolver: state.sandbox.stub().resolves(resolver),
      };

      const result = await MetadataView.prototype.resolvePackageIDs.call(
        context,
        ["rm.old", "rm.latest"],
      );

      result.should.deep.equal(["rm.latest"]);
      resolver.resolve.calledOnceWithExactly("pid.3").should.be.true;
    });

    it("falls back to the Solr package IDs when resolver fails", async () => {
      const resolverError = new Error("resolver failure");
      const resolver = {
        resolve: state.sandbox.stub().rejects(resolverError),
      };
      const context = {
        model: new Backbone.Model({ id: "pid.4" }),
        pid: "pid.4",
        getResourceMapResolver: state.sandbox.stub().resolves(resolver),
      };
      const packageIDs = ["rm.1", "rm.2"];

      const result = await MetadataView.prototype.resolvePackageIDs.call(
        context,
        packageIDs,
      );

      result.should.deep.equal(packageIDs);
      expect(globalThis.MetacatUI.analytics.trackException.calledOnce).to.equal(
        true,
      );
    });
  });

  describe("MetadataView showIndexingOrNotFound()", () => {
    it("shows indexing message when sysmeta exists", async () => {
      const showError = sinon.spy();
      const hideLoading = sinon.spy();
      const showNotFound = sinon.spy();

      const context = {
        model: new Backbone.Model({ id: "pid.indexing" }),
        pid: "pid.indexing",
        getSysMeta: sinon.stub().resolves({ data: { identifier: "pid.indexing" } }),
        hideLoading,
        showError,
        showNotFound,
      };

      await MetadataView.prototype.showIndexingOrNotFound.call(context);

      expect(hideLoading.calledOnce).to.equal(true);
      expect(showError.calledOnce).to.equal(true);
      expect(showNotFound.called).to.equal(false);
      expect(showError.firstCall.args[0]).to.contain("being indexed");
    });

    it("marks as not found when sysmeta is missing", async () => {
      const showNotFound = sinon.spy();
      const context = {
        model: new Backbone.Model({ id: "pid.missing" }),
        pid: "pid.missing",
        getSysMeta: sinon.stub().resolves(null),
        showNotFound,
      };

      await MetadataView.prototype.showIndexingOrNotFound.call(context);

      expect(context.model.get("notFound")).to.equal(true);
      expect(showNotFound.calledOnce).to.equal(true);
    });
  });

  describe("MetadataView getSysMeta()", () => {
    it("returns null on 404 and 401 errors", async () => {
      const context404 = {
        sysMetaService: {
          download: sinon.stub().rejects({ status: 404 }),
        },
      };
      const context401 = {
        sysMetaService: {
          download: sinon.stub().rejects({ status: 401 }),
        },
      };

      const result404 = await MetadataView.prototype.getSysMeta.call(
        context404,
        "pid.404",
      );
      const result401 = await MetadataView.prototype.getSysMeta.call(
        context401,
        "pid.401",
      );

      expect(result404).to.equal(null);
      expect(result401).to.equal(null);
    });
  });

  describe("MetadataView resolveMetadataForData()", () => {
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
    });

    it("falls back to the last metadata PID when query service fails", async () => {
      state.sandbox.stub(QueryService, "queryWithFetch").rejects(new Error("fail"));
      const context = {
        model: new Backbone.Model({ isDocumentedBy: ["meta.old", "meta.new"] }),
        pid: "data.pid",
        navigateWithFragment: state.sandbox.spy(),
        noMetadata: state.sandbox.spy(),
      };

      await MetadataView.prototype.resolveMetadataForData.call(context);

      expect(
        context.navigateWithFragment.calledOnceWithExactly("meta.new", "data.pid"),
      ).to.equal(true);
      expect(context.noMetadata.called).to.equal(false);
    });
  });
});
