define([
  "views/MetadataView",
  "views/MetadataDocumentView",
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageRecovery",
  "models/dataPackage/UploadRecoveryStore",
  "models/fileTable/DataPackageFileTableAdapter",
  "models/fileTable/FileTableViewModel",
  "views/schemaOrg/SchemaOrgView",
], (
  MetadataView,
  MetadataDocumentView,
  DataPackage,
  DataPackageRecovery,
  UploadRecoveryStore,
  DataPackageFileTableAdapter,
  FileTableViewModel,
  SchemaOrgView,
) => {
  const should = chai.should();
  const expect = chai.expect;
  const RESOURCE_MAP_FORMAT_ID = "http://www.openarchives.org/ore/terms";

  /**
   * These tests exercise the MetadataView resolution dispatch in isolation by
   * calling each handler against a synthetic `this` context, so no DOM render,
   * router, or network access is required.
   */
  describe("MetadataView resolution dispatch", () => {
    let sandbox;
    let originalRoot;
    let originalAppModel;
    let originalAppView;
    let originalAppUserModel;
    let originalUiRouter;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      globalThis.MetacatUI = globalThis.MetacatUI || {};
      originalRoot = globalThis.MetacatUI.root;
      originalAppModel = globalThis.MetacatUI.appModel;
      originalAppUserModel = globalThis.MetacatUI.appUserModel;
      originalUiRouter = globalThis.MetacatUI.uiRouter;
      globalThis.MetacatUI.root = "";
      originalAppView = globalThis.MetacatUI.appView;
    });

    afterEach(() => {
      sandbox.restore();
      globalThis.MetacatUI.root = originalRoot;
      globalThis.MetacatUI.appModel = originalAppModel;
      globalThis.MetacatUI.appView = originalAppView;
      globalThis.MetacatUI.appUserModel = originalAppUserModel;
      globalThis.MetacatUI.uiRouter = originalUiRouter;
      document
        .querySelectorAll("meta[name^='citation_']")
        .forEach((meta) => meta.remove());
    });

    const withRenderContext = (context) => ({
      renderId: "render-test",
      el: document.createElement("div"),
      startRender: MetadataView.prototype.startRender,
      getRenderOptions: MetadataView.prototype.getRenderOptions,
      isCurrentRender: MetadataView.prototype.isCurrentRender,
      closeMetadataView: MetadataView.prototype.closeMetadataView,
      teardownFileTableScrollIndicators:
        MetadataView.prototype.teardownFileTableScrollIndicators,
      closeFileTableView: MetadataView.prototype.closeFileTableView,
      ...context,
    });

    const createViewerDataPackage = ({
      members = [
        {
          pid: "rm.1",
          formatType: "RESOURCE",
          formatId: RESOURCE_MAP_FORMAT_ID,
        },
        {
          pid: "data.1",
          formatType: "DATA",
          fileName: "data.csv",
          size: 10,
        },
        { pid: "meta.1", formatType: "METADATA", title: "EML" },
      ],
      rootResourceMapPid = "rm.1",
    } = {}) => {
      const dataPackage = new DataPackage({ members });
      dataPackage.rootResourceMapPid = rootResourceMapPid;
      return dataPackage;
    };

    const setPackageAppModel = (values = {}) => {
      globalThis.MetacatUI.appModel = {
        get: (key) =>
          ({
            packageServiceUrl: "https://cn.test/package/",
            resolveServiceUrl: "https://cn.test/resolve/",
            ...values,
          })[key] || "",
        isDOI: () => false,
      };
    };

    describe("renderInfoIcons()", () => {
      it("adds a private icon for private package members", async () => {
        const metadata = Object.create({
          isPublic: sandbox.stub().resolves(false),
        });
        const context = withRenderContext({
          metadata,
          addInfoIcon: sandbox.stub(),
          getDataMemberIsPublic: MetadataView.prototype.getDataMemberIsPublic,
          renderInfoIcons: MetadataView.prototype.renderInfoIcons,
        });

        await context.renderInfoIcons();

        sinon.assert.calledOnce(context.addInfoIcon);
        context.addInfoIcon.firstCall.args[0].should.equal("private");
      });

      it("does not add icons after a newer render starts", async () => {
        let resolveIsPublic;
        const context = withRenderContext({
          metadata: { archived: false },
          addInfoIcon: sandbox.stub(),
          getDataMemberIsPublic: sandbox.stub().returns(
            new Promise((resolve) => {
              resolveIsPublic = resolve;
            }),
          ),
          renderInfoIcons: MetadataView.prototype.renderInfoIcons,
        });

        const rendering = context.renderInfoIcons({ renderId: "render-test" });
        context.renderId = "render-new";
        resolveIsPublic(false);
        await rendering;

        sinon.assert.notCalled(context.addInfoIcon);
      });
    });

    describe("insertCitationMetaTags()", () => {
      it("emits citation_doi for bare DOI identifiers", () => {
        globalThis.MetacatUI.appModel = {
          isDOI: sandbox.stub().returns(true),
        };
        const context = {
          pid: "10.5063/F1ABC123",
          dataPackage: {
            getPrimaryMetadataMember: sandbox.stub().returns({
              pid: "10.5063/F1ABC123",
              title: "Dataset title",
              origin: ["Example Author"],
            }),
          },
          metaTagsHighwirePressTemplate:
            MetadataView.prototype.metaTagsHighwirePressTemplate,
          insertCitationMetaTags: MetadataView.prototype.insertCitationMetaTags,
        };

        context.insertCitationMetaTags();

        const doiMeta = document.querySelector("meta[name='citation_doi']");
        expect(doiMeta).to.not.equal(null);
        doiMeta.getAttribute("content").should.equal("10.5063/F1ABC123");
      });
    });

    describe("showLatestVersion()", () => {
      it("does not show an alert when a SID route already resolved to the latest PID", () => {
        const el = document.createElement("div");
        const context = {
          el,
          pid: "doi:10.15485/2403350",
          dataPackage: {
            getPrimaryMetadataMember: sandbox.stub().returns({
              pid: "ess-dive-3b439ff48ee447d-20260627T022324386",
              seriesId: "doi:10.15485/2403350",
            }),
          },
          versionTemplate: MetadataView.prototype.versionTemplate,
        };

        MetadataView.prototype.showLatestVersion.call(
          context,
          "ess-dive-3b439ff48ee447d-20260627T022324386",
        );

        expect(el.querySelector(".newer-version")).to.equal(null);
      });
    });

    describe("render()", () => {
      it("uses the route PID passed after onClose clears the view state", async () => {
        const resolveFromPid = sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .resolves({ notFound: true });
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          showIndexing: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });
        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};

        await MetadataView.prototype.render.call(context, {
          pid: "meta.1",
          seriesId: "series.1",
        });

        context.pid.should.equal("meta.1");
        context.seriesId.should.equal("series.1");
        resolveFromPid.calledOnceWith("meta.1").should.equal(true);
        context.showNotFound.calledOnce.should.equal(true);
      });

      it("shows indexing instead of rendering a sysmeta-only metadata member", async () => {
        sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .callsFake(async function resolveFromPid() {
            this.members.add({
              pid: "meta.1",
              formatType: "METADATA",
            });
            this.primaryMetadataPid = "meta.1";
            return {
              success: false,
              isIndexing: true,
              isMetadata: true,
              resolvedPid: "meta.1",
            };
          });

        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          showIndexing: sandbox.stub(),
          prepareCitationModel: sandbox.stub(),
          renderMetadataShell: sandbox.stub(),
          checkWritePermissions: sandbox.stub().resolves(false),
          checkProvenanceWritePermission: sandbox.stub().resolves(false),
          renderMetadata: sandbox.stub().resolves(),
          resolveFileListingState: sandbox.stub().resolves(null),
          insertPackageTable: sandbox.stub().resolves(),
          insertBreadcrumbs: sandbox.stub(),
          insertParentLink: sandbox.stub().resolves(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });

        await MetadataView.prototype.render.call(context, { pid: "meta.1" });

        sinon.assert.calledOnce(context.showIndexing);
        sinon.assert.notCalled(context.renderMetadata);
      });

      it("preserves DataONE identifiers that contain query strings", async () => {
        const resolveFromPid = sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .resolves({ notFound: true });
        const pid =
          "https://www.polardata.ca/pdcsearch/PDCSearch.jsp?doi_id=13413";
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          showIndexing: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });
        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};

        await MetadataView.prototype.render.call(context, {
          pid,
        });

        context.pid.should.equal(pid);
        resolveFromPid.calledOnceWith(pid).should.equal(true);
      });

      it("retries route section query strings after the full PID misses", async () => {
        const resolveFromPid = sandbox.stub(
          DataPackage.prototype,
          "resolveFromPid",
        );
        resolveFromPid.onFirstCall().resolves({ notFound: true });
        resolveFromPid.onSecondCall().resolves({ isIndexing: true });
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          showIndexing: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });
        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};

        await MetadataView.prototype.render.call(context, {
          pid: "meta.1?section=data",
        });

        context.pid.should.equal("meta.1");
        resolveFromPid.firstCall
          .calledWith("meta.1?section=data")
          .should.equal(true);
        resolveFromPid.secondCall.calledWith("meta.1").should.equal(true);
        context.showNotFound.called.should.equal(false);
        context.showIndexing.calledOnce.should.equal(true);
      });

      it("keeps question marks that do not look like route query strings", async () => {
        const resolveFromPid = sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .resolves({ notFound: true });
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          showIndexing: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });
        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};

        await MetadataView.prototype.render.call(context, {
          pid: "meta.1?literal",
        });

        context.pid.should.equal("meta.1?literal");
        resolveFromPid.calledOnceWith("meta.1?literal").should.equal(true);
      });

      it("ignores an earlier render when a newer render starts before resolution finishes", async () => {
        let resolveFirst;
        const firstResolution = new Promise((resolve) => {
          resolveFirst = resolve;
        });
        const resolveFromPid = sandbox.stub(
          DataPackage.prototype,
          "resolveFromPid",
        );
        resolveFromPid.onFirstCall().returns(firstResolution);
        resolveFromPid.onSecondCall().resolves({ notFound: true });

        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          showIndexing: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });
        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};

        const firstRender = MetadataView.prototype.render.call(context, {
          pid: "meta.old",
        });
        const secondRender = MetadataView.prototype.render.call(context, {
          pid: "meta.new",
        });

        await secondRender;
        context.showNotFound.calledOnce.should.equal(true);

        resolveFirst({ notFound: true });
        await firstRender;

        context.pid.should.equal("meta.new");
        resolveFromPid.firstCall.calledWith("meta.old").should.equal(true);
        resolveFromPid.secondCall.calledWith("meta.new").should.equal(true);
        context.showNotFound.calledOnce.should.equal(true);
      });

      it("does not add index-only rows after a successful resource map load", async () => {
        sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .callsFake(async function resolveFromPid() {
            this.members.add([
              {
                pid: "rm.1",
                formatType: "RESOURCE",
                formatId: RESOURCE_MAP_FORMAT_ID,
              },
              { pid: "meta.1", formatType: "METADATA", title: "EML" },
            ]);
            this.rootResourceMapPid = "rm.1";
            this.primaryMetadataPid = "meta.1";
            return {
              success: true,
              isResourceMap: true,
              resolvedPid: "rm.1",
            };
          });
        sandbox
          .stub(DataPackage.prototype, "getManifestFromResourceMap")
          .resolves({ ok: true });
        const getManifestFromIndex = sandbox
          .stub(DataPackage.prototype, "getManifestFromIndex")
          .callsFake(async function getManifestFromIndex(options) {
            if (!options.onlyExisting) {
              this.members.add(
                {
                  pid: "stale.1",
                  formatType: "DATA",
                  fileName: "stale.csv",
                },
                { sources: ["index"] },
              );
            }
          });

        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};
        globalThis.MetacatUI.uiRouter = {
          navigate: sandbox.stub(),
        };
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          prepareCitationModel: sandbox.stub(),
          renderMetadataShell: sandbox.stub(),
          checkWritePermissions: sandbox.stub().resolves(false),
          checkProvenanceWritePermission: sandbox.stub().resolves(false),
          renderMetadata: sandbox.stub().resolves(),
          resolveFileListingState:
            MetadataView.prototype.resolveFileListingState,
          insertPackageTable: sandbox.stub(),
          insertBreadcrumbs: sandbox.stub(),
          insertParentLink: sandbox.stub().resolves(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });

        await MetadataView.prototype.render.call(context, { pid: "rm.1" });

        context.pid.should.equal("meta.1");
        globalThis.MetacatUI.uiRouter.navigate
          .calledOnceWithExactly("view/meta.1", {
            trigger: false,
            replace: true,
          })
          .should.equal(true);
        expect(context.dataPackage.getMember("stale.1")).to.equal(null);
        sinon.assert.calledOnceWithExactly(getManifestFromIndex, {
          merge: true,
          onlyExisting: true,
          signal: context.renderAbortController.signal,
        });
      });

      it("keeps public metadata visible when package resolution hits private history", async () => {
        sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .callsFake(async function resolveFromPid() {
            this.members.add({
              pid: "meta.1",
              formatType: "METADATA",
              title: "EML",
            });
            this.primaryMetadataPid = "meta.1";
            return {
              success: false,
              unauthorized: true,
              isMetadata: true,
              resolvedPid: "meta.1",
            };
          });

        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          prepareCitationModel: sandbox.stub(),
          renderMetadataShell: sandbox.stub(),
          checkWritePermissions: sandbox.stub().resolves(false),
          checkProvenanceWritePermission: sandbox.stub().resolves(false),
          renderMetadata: sandbox.stub().resolves(),
          resolveFileListingState:
            MetadataView.prototype.resolveFileListingState,
          insertPackageTable: sandbox.stub(),
          insertBreadcrumbs: sandbox.stub(),
          insertParentLink: sandbox.stub().resolves(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });

        await MetadataView.prototype.render.call(context, { pid: "meta.1" });

        context.showIsPrivate.called.should.equal(false);
        context.renderMetadata.calledOnce.should.equal(true);
        context.insertPackageTable.calledOnce.should.equal(true);
        context.insertPackageTable.firstCall.args[1].fileListingState.should.equal(
          "permissionUnavailable",
        );
      });

      it("falls back to the index for visible rows when resource map XML cannot be parsed", async () => {
        sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .callsFake(async function resolveFromPid() {
            this.members.add([
              {
                pid: "rm.1",
                formatType: "RESOURCE",
                formatId: RESOURCE_MAP_FORMAT_ID,
              },
              { pid: "meta.1", formatType: "METADATA", title: "EML" },
            ]);
            this.rootResourceMapPid = "rm.1";
            this.primaryMetadataPid = "meta.1";
            return {
              success: true,
              isMetadata: true,
              resolvedPid: "meta.1",
            };
          });
        sandbox
          .stub(DataPackage.prototype, "getManifestFromResourceMap")
          .rejects(
            Object.assign(new Error("Malformed Resource Map"), {
              code: "resource_map_not_editable",
              issues: [{ code: "invalid_xml" }],
            }),
          );
        const getManifestFromIndex = sandbox
          .stub(DataPackage.prototype, "getManifestFromIndex")
          .callsFake(async function getManifestFromIndex(options) {
            should.equal(options.onlyExisting, undefined);
            this.members.add(
              {
                pid: "nested.rm",
                formatType: "RESOURCE",
                formatId: RESOURCE_MAP_FORMAT_ID,
                title: "Nested package",
              },
              { sources: ["index"] },
            );
            this.indexManifestFetched = true;
            return { ok: true };
          });

        globalThis.MetacatUI.appModel = { set: sandbox.stub() };
        globalThis.MetacatUI.appUserModel = {};
        const context = withRenderContext({
          pid: null,
          seriesId: null,
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          showLoading: sandbox.stub(),
          updateLoadingText: sandbox.stub(),
          showNotFound: sandbox.stub(),
          onModelError: sandbox.stub(),
          showIsPrivate: sandbox.stub(),
          prepareCitationModel: sandbox.stub(),
          renderMetadataShell: sandbox.stub(),
          checkWritePermissions: sandbox.stub().resolves(false),
          checkProvenanceWritePermission: sandbox.stub().resolves(false),
          renderMetadata: sandbox.stub().resolves(),
          resolveFileListingState:
            MetadataView.prototype.resolveFileListingState,
          insertPackageTable: sandbox.stub(),
          insertBreadcrumbs: sandbox.stub(),
          insertParentLink: sandbox.stub().resolves(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });

        await MetadataView.prototype.render.call(context, { pid: "meta.1" });

        context.dataPackage
          .getMember("nested.rm")
          .sources.should.contain("index");
        sinon.assert.calledOnceWithExactly(getManifestFromIndex, {
          merge: true,
          signal: context.renderAbortController.signal,
        });
        context.insertPackageTable.calledOnce.should.equal(true);
        context.insertPackageTable.firstCall.args[1].fileListingState.should.equal(
          "serverUnavailable",
        );
      });
    });

    describe("handleDataInput()", () => {
      it("navigates to the documenting metadata, preserving the data PID in the fragment", async () => {
        const navigateWithFragment = sandbox.stub();
        const onClose = sandbox.stub();
        const signal = new AbortController().signal;
        const context = withRenderContext({
          pid: "data.1",
          dataPackage: {
            getManifest: sandbox.stub().resolves(),
            getPrimaryMetadataMember: sandbox.stub().returns({ pid: "meta.1" }),
            getRootResourceMapMember: sandbox.stub().returns({ pid: "rm.1" }),
          },
          onClose,
          navigateWithFragment,
          renderNoMetadata: sandbox.stub(),
          showMultipleDocumentingDatasets: sandbox.stub(),
          onModelError: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
        });

        await MetadataView.prototype.handleDataInput.call(
          context,
          {
            isData: true,
          },
          { renderId: "render-test", signal },
        );

        onClose.calledOnce.should.equal(true);
        navigateWithFragment
          .calledOnceWith("meta.1", "data.1")
          .should.equal(true);
        sinon.assert.calledOnceWithExactly(context.dataPackage.getManifest, {
          index: false,
          signal,
        });
        context.renderNoMetadata.called.should.equal(false);
      });

      it("offers candidate datasets without navigating when multiple chains document the data", async () => {
        const navigateWithFragment = sandbox.stub();
        const showMultipleDocumentingDatasets = sandbox.stub();
        const context = withRenderContext({
          pid: "data.1",
          dataPackage: { getManifest: sandbox.stub().resolves() },
          navigateWithFragment,
          showMultipleDocumentingDatasets,
        });

        await MetadataView.prototype.handleDataInput.call(context, {
          isData: true,
          multipleRMs: true,
          candidateMetadataPids: ["meta.1", "meta.2"],
        });

        showMultipleDocumentingDatasets.calledOnce.should.equal(true);
        navigateWithFragment.called.should.equal(false);
      });

      it("renders a no-metadata view when no documenting metadata exists", async () => {
        const renderNoMetadata = sandbox.stub();
        const navigateWithFragment = sandbox.stub();
        const context = withRenderContext({
          pid: "data.1",
          dataPackage: {
            getManifest: sandbox.stub().resolves(),
            getPrimaryMetadataMember: sandbox.stub().returns(null),
            getRootResourceMapMember: sandbox.stub().returns({ pid: "rm.1" }),
          },
          navigateWithFragment,
          renderNoMetadata,
          showMultipleDocumentingDatasets: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
        });

        await MetadataView.prototype.handleDataInput.call(context, {
          isData: true,
        });

        navigateWithFragment.called.should.equal(false);
        renderNoMetadata.calledOnce.should.equal(true);
        renderNoMetadata.firstCall.args[0].should.deep.equal({
          id: "rm.1",
          renderId: "render-test",
        });
      });

      it("reports a retrieval error when the package manifest cannot load", async () => {
        const onModelError = sandbox.stub();
        const error = new Error("boom");
        error.status = 500;
        const context = withRenderContext({
          pid: "data.1",
          dataPackage: { getManifest: sandbox.stub().rejects(error) },
          onModelError,
          navigateWithFragment: sandbox.stub(),
          showMultipleDocumentingDatasets: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
        });

        await MetadataView.prototype.handleDataInput.call(context, {
          isData: true,
        });

        onModelError.calledOnce.should.equal(true);
        onModelError.firstCall.args[0].should.equal(500);
      });
    });

    describe("getFileTableRows()", () => {
      it("omits Download All before private-member status is confirmed", () => {
        const dataPackage = createViewerDataPackage();
        sandbox.stub(dataPackage, "hasPrivateMembers").returns(false);
        setPackageAppModel();
        const context = {
          dataPackage,
          model: { get: sandbox.stub().withArgs("title").returns("Dataset") },
          fileTableMetricsByPid: null,
          metricsModel: null,
          packageDownloadAllAllowed: false,
          getFriendlyFormatName: sandbox.stub().returns(""),
        };

        const rows = MetadataView.prototype.getFileTableRows.call(context);
        const rootRow = rows.find((row) => row.id === "dataset:rm.1");

        rootRow.actions.should.deep.equal([]);
        dataPackage.hasPrivateMembers.called.should.equal(false);
      });

      it("adds Download All synchronously when there are no private members", () => {
        const dataPackage = createViewerDataPackage();
        sandbox.stub(dataPackage, "hasPrivateMembers").returns(false);
        setPackageAppModel();
        const fileTableView = {
          viewModel: { mergeRows: sandbox.stub() },
        };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          model: { get: sandbox.stub().withArgs("title").returns("Dataset") },
          fileTableMetricsByPid: null,
          metricsModel: null,
          packageDownloadAllAllowed: false,
          getFriendlyFormatName: sandbox.stub().returns(""),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
        });

        const confirmed = MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
          fileTableView,
          { renderId: "render-test" },
        );
        confirmed.should.equal(true);
        const rows = fileTableView.viewModel.mergeRows.firstCall.args[0];
        const rootRow = rows.find((row) => row.id === "dataset:rm.1");

        rootRow.actions
          .map((action) => action.id)
          .should.deep.equal(["download"]);
        rootRow.downloadUrl.should.equal("https://cn.test/package/rm.1");
      });

      it("does not add Download All when private members may be present", () => {
        const dataPackage = createViewerDataPackage();
        setPackageAppModel();
        const fileTableView = {
          viewModel: { mergeRows: sandbox.stub() },
        };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          packageDownloadAllAllowed: false,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
        });

        const confirmed = MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
          fileTableView,
          { renderId: "render-test" },
        );

        confirmed.should.equal(false);
        context.packageDownloadAllAllowed.should.equal(false);
        fileTableView.viewModel.mergeRows.called.should.equal(false);
      });

      it("does not add Download All when the package exceeds maxDownloadSize", () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "data.1",
              formatType: "DATA",
              fileName: "data.csv",
              size: 101,
            },
          ],
        });
        sandbox.stub(dataPackage, "hasPrivateMembers").returns(false);
        setPackageAppModel({ maxDownloadSize: 100 });
        const fileTableView = {
          viewModel: { mergeRows: sandbox.stub() },
        };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          packageDownloadAllAllowed: false,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
        });

        const confirmed = MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
          fileTableView,
          { renderId: "render-test" },
        );

        confirmed.should.equal(false);
        dataPackage.hasPrivateMembers.called.should.equal(false);
        fileTableView.viewModel.mergeRows.called.should.equal(false);
      });

      it("does not add Download All when a member size is missing", () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "data.1",
              formatType: "DATA",
              fileName: "known.csv",
              size: 60,
            },
            {
              pid: "data.2",
              formatType: "DATA",
              fileName: "unknown.csv",
            },
          ],
        });
        sandbox.stub(dataPackage, "hasPrivateMembers").returns(false);
        setPackageAppModel({ maxDownloadSize: 100 });
        const fileTableView = {
          viewModel: { mergeRows: sandbox.stub() },
        };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          packageDownloadAllAllowed: false,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          getFileTableRows: sandbox.stub().returns([]),
          scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
        });

        const confirmed = MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
          fileTableView,
          { renderId: "render-test" },
        );

        confirmed.should.equal(false);
        dataPackage.hasPrivateMembers.called.should.equal(false);
        fileTableView.viewModel.mergeRows.called.should.equal(false);
      });
    });

    describe("downloadFileTableRow()", () => {
      it("keeps the attached download action disabled while rows merge", async () => {
        setPackageAppModel();
        const dataPackage = createViewerDataPackage();
        let resolveDownload;
        const downloadModel = new Backbone.Model();
        downloadModel.downloadWithCredentials = sandbox.stub().callsFake(
          () =>
            new Promise((resolve) => {
              resolveDownload = resolve;
            }),
        );
        const context = withRenderContext({
          dataPackage,
          packageDownloadAllAllowed: false,
          fileTableDownloadStates: new Map(),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          getFriendlyFormatName: () => "",
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          createDataDetailsModel: sandbox.stub().returns(downloadModel),
          scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
        });
        const fileTableView = {
          viewModel: new FileTableViewModel({
            rows: context.getFileTableRows(),
          }),
        };
        context.fileTableView = fileTableView;
        const getDownloadAction = () =>
          fileTableView.viewModel
            .getRows()
            .get("data.1")
            .getActions()
            .findWhere({ id: "download" });
        const currentRow = fileTableView.viewModel.getRows().get("data.1");
        const firstDownload = MetadataView.prototype.downloadFileTableRow.call(
          context,
          currentRow,
          getDownloadAction(),
        );

        try {
          await MetadataView.prototype.mergeCurrentFileTableRows.call(
            context,
            dataPackage,
            fileTableView,
            { renderId: "render-test" },
          );

          const attachedRow = fileTableView.viewModel.getRows().get("data.1");
          getDownloadAction().get("isDisabled").should.equal(true);
          getDownloadAction().get("label").should.equal("Downloading...");

          const duplicate =
            await MetadataView.prototype.downloadFileTableRow.call(
              context,
              attachedRow,
              getDownloadAction(),
            );

          duplicate.should.equal(false);
          resolveDownload();
          (await firstDownload).should.equal(true);
          downloadModel.downloadWithCredentials.calledOnce.should.equal(true);
          getDownloadAction().get("isDisabled").should.equal(false);
          context.fileTableDownloadStates.size.should.equal(0);
        } finally {
          resolveDownload?.();
          await firstDownload;
        }
      });

      it("restores the current download action when a merged request rejects", async () => {
        setPackageAppModel();
        const dataPackage = createViewerDataPackage();
        const downloadError = new Error("download failed");
        let rejectDownload;
        const downloadModel = new Backbone.Model();
        downloadModel.downloadWithCredentials = sandbox.stub().callsFake(
          () =>
            new Promise((_resolve, reject) => {
              rejectDownload = reject;
            }),
        );
        const context = withRenderContext({
          dataPackage,
          packageDownloadAllAllowed: false,
          fileTableDownloadStates: new Map(),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          getFriendlyFormatName: () => "",
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          createDataDetailsModel: sandbox.stub().returns(downloadModel),
          scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
        });
        const fileTableView = {
          viewModel: new FileTableViewModel({
            rows: context.getFileTableRows(),
          }),
        };
        context.fileTableView = fileTableView;
        const getDownloadAction = () =>
          fileTableView.viewModel
            .getRows()
            .get("data.1")
            .getActions()
            .findWhere({ id: "download" });
        const download = MetadataView.prototype.downloadFileTableRow.call(
          context,
          fileTableView.viewModel.getRows().get("data.1"),
          getDownloadAction(),
        );
        const observedDownload = download.then(
          () => new Error("expected download to reject"),
          (error) => error,
        );

        try {
          await MetadataView.prototype.mergeCurrentFileTableRows.call(
            context,
            dataPackage,
            fileTableView,
            { renderId: "render-test" },
          );

          getDownloadAction().get("isDisabled").should.equal(true);
          rejectDownload(downloadError);
          const receivedError = await observedDownload;

          receivedError.should.equal(downloadError);
          context.fileTableDownloadStates.size.should.equal(0);
          getDownloadAction().get("isDisabled").should.equal(false);
        } finally {
          rejectDownload?.(downloadError);
          await observedDownload;
        }
      });

      it("uses the file table download URL when the member model has none", async () => {
        const row = new Backbone.Model({
          id: "data.1",
          kind: "data",
          downloadUrl: "https://cn.test/resolve/data.1",
        });
        row.getDisplayLabel = () => "data.csv";
        const actionState = { label: "Download" };
        const actionModel = {
          toJSON: () => actionState,
          set: sandbox.stub(),
        };
        const downloadModel = new Backbone.Model();
        downloadModel.downloadWithCredentials = sandbox.stub().callsFake(() => {
          expect(downloadModel.get("url")).to.equal(
            "https://cn.test/resolve/data.1",
          );
        });
        const context = {
          dataPackage: {
            getMember: sandbox
              .stub()
              .withArgs("data.1")
              .returns({ pid: "data.1" }),
          },
          createDataDetailsModel: sandbox.stub().returns(downloadModel),
        };

        await MetadataView.prototype.downloadFileTableRow.call(
          context,
          row,
          actionModel,
        );

        actionModel.set.lastCall.args[0].should.deep.equal(actionState);
      });
    });

    describe("insertPackageTable()", () => {
      it("shows the package file count excluding resource maps", async () => {
        const el = document.createElement("div");
        el.innerHTML = `
          <div id="table-container"></div>
          <div id="data-package-container"><div class="loading"></div></div>
        `;
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "nested.rm",
              formatType: "DATA",
              formatId: RESOURCE_MAP_FORMAT_ID,
              title: "Nested Dataset",
            },
            {
              pid: "data.1",
              formatType: "DATA",
              fileName: "data.csv",
            },
            { pid: "meta.1", formatType: "METADATA", title: "EML" },
          ],
        });
        setPackageAppModel();
        const context = withRenderContext({
          el,
          dataPackage,
          tableContainer: "#table-container",
          subviews: [],
          model: { get: sandbox.stub().withArgs("title").returns("Dataset") },
          fileTableMetricsByPid: null,
          metricsModel: null,
          packageDownloadAllAllowed: false,
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          getFriendlyFormatName: sandbox.stub().returns(""),
          stopListening: sandbox.stub(),
          listenTo: sandbox.stub(),
          $: (selector) => $(el).find(selector),
          setupFileTableScrollIndicators:
            MetadataView.prototype.setupFileTableScrollIndicators,
          updateFileTableScrollIndicators:
            MetadataView.prototype.updateFileTableScrollIndicators,
          teardownFileTableScrollIndicators:
            MetadataView.prototype.teardownFileTableScrollIndicators,
          getFileListingNotice: MetadataView.prototype.getFileListingNotice,
          ensureFriendlyFormatLabels: sandbox.stub(),
          confirmPackageDownloadAll: sandbox.stub(),
          loadNestedPackageTitles: sandbox.stub(),
          enrichFileTableMemberDetails: sandbox.stub(),
          loadFileTableMetrics: sandbox.stub(),
          scrollToFragment: sandbox.stub(),
        });

        await MetadataView.prototype.insertPackageTable.call(context, null, {
          renderId: "render-test",
        });

        context.fileTableView.viewModel
          .get("title")
          .should.equal("2 files in this dataset");
        context.fileTableView.viewModel
          .get("subtitle")
          .should.equal("Package: rm.1");
        context.teardownFileTableScrollIndicators();
        context.fileTableView.remove();
      });
    });

    describe("checkProvenanceWritePermission()", () => {
      it("allows provenance editing when the resource map is writable and not archived", async () => {
        const dataPackage = createViewerDataPackage();
        sandbox
          .stub(dataPackage, "checkResourceMapWritePermission")
          .resolves(true);
        const context = withRenderContext({
          resourceMap: { archived: false },
          dataPackage,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
        });

        const result =
          await MetadataView.prototype.checkProvenanceWritePermission.call(
            context,
          );

        result.should.equal(true);
        context.canEditProvenance.should.equal(true);
      });

      it("disables provenance editing when the resource map is archived", async () => {
        const dataPackage = createViewerDataPackage();
        sandbox
          .stub(dataPackage, "checkResourceMapWritePermission")
          .resolves(true);
        const context = withRenderContext({
          resourceMap: { archived: true },
          dataPackage,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
        });

        const result =
          await MetadataView.prototype.checkProvenanceWritePermission.call(
            context,
          );

        result.should.equal(false);
        context.canEditProvenance.should.equal(false);
      });

      it("disables provenance editing when the Resource Map has edit blockers", async () => {
        const dataPackage = createViewerDataPackage();
        const checkResourceMapWritePermission = sandbox
          .stub(dataPackage, "checkResourceMapWritePermission")
          .resolves(true);
        sandbox.stub(dataPackage, "getResourceMapModel").returns({
          getEditBlockers: sandbox.stub().returns([
            {
              code: "memberIdentifierMismatch",
              severity: "error",
            },
          ]),
        });
        const context = withRenderContext({
          resourceMap: { archived: false },
          dataPackage,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
        });

        const result =
          await MetadataView.prototype.checkProvenanceWritePermission.call(
            context,
          );

        result.should.equal(false);
        context.canEditProvenance.should.equal(false);
        sinon.assert.notCalled(checkResourceMapWritePermission);
      });

      it("does not infer editability from metadata write permission", async () => {
        const dataPackage = createViewerDataPackage();
        const checkWritePermissions = sandbox
          .stub(dataPackage, "checkWritePermissions")
          .resolves(true);
        sandbox
          .stub(dataPackage, "checkResourceMapWritePermission")
          .resolves(false);
        const context = withRenderContext({
          resourceMap: { archived: false },
          dataPackage,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
        });

        await MetadataView.prototype.checkProvenanceWritePermission.call(
          context,
        );

        context.canEditProvenance.should.equal(false);
        checkWritePermissions.called.should.equal(false);
      });
    });

    describe("checkWritePermissions()", () => {
      it("does not update controls from a stale render", async () => {
        let resolvePermission;
        const staleDataPackage = {
          checkWritePermissions: sandbox.stub().returns(
            new Promise((resolve) => {
              resolvePermission = resolve;
            }),
          ),
        };
        const button = {
          show: sandbox.stub(),
          hide: sandbox.stub(),
        };
        const context = withRenderContext({
          canWrite: false,
          dataPackage: staleDataPackage,
          editButtonContainer: "#edit",
          controls: {
            viewModel: { set: sandbox.stub() },
          },
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          $: sandbox.stub().returns(button),
        });

        const check =
          MetadataView.prototype.checkWritePermissions.call(context);
        context.renderId = "render-next";
        resolvePermission(true);
        const result = await check;

        result.should.equal(false);
        context.canWrite.should.equal(false);
        context.$.called.should.equal(false);
        context.controls.viewModel.set.called.should.equal(false);
      });
    });

    describe("refreshMetadataHeaderFromPackage()", () => {
      it("updates the citation source and rerenders controls", () => {
        setPackageAppModel();
        globalThis.MetacatUI.appView = {
          schemaOrg: { setSchema: sandbox.stub() },
        };
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.2.0",
              title: "Indexed dataset title",
              origin: ["Jane Doe"],
            },
          ],
        });
        const controls = {
          citationModal: "old-modal",
          viewModel: {
            set: sandbox.stub(),
            get: sandbox.stub().withArgs("metricsModel").returns("metrics"),
          },
          render: sandbox.stub().callsFake(function render() {
            this.citationModal = "new-modal";
            return this;
          }),
        };
        const context = withRenderContext({
          dataPackage,
          metadata: dataPackage.getPrimaryMetadataMember(),
          controls,
          canWrite: true,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          insertCitation: sandbox.stub(),
          insertCitationMetaTags: sandbox.stub(),
        });

        const refreshed =
          MetadataView.prototype.refreshMetadataHeaderFromPackage.call(
            context,
            dataPackage,
            { renderId: "render-test" },
          );

        refreshed.should.equal(true);
        context.metadataSolrResult
          .get("title")
          .should.equal("Indexed dataset title");
        context.citationModel
          .get("title")
          .should.equal("Indexed dataset title");
        controls.viewModel.set.calledOnce.should.equal(true);
        controls.viewModel.set.firstCall.args[0].metadataModel.should.equal(
          context.metadataSolrResult,
        );
        controls.viewModel.set.firstCall.args[0].hasWritePermission.should.equal(
          true,
        );
        controls.viewModel.set.firstCall.args[1].should.deep.equal({
          silent: true,
        });
        controls.render.calledOnce.should.equal(true);
        context.citationModal.should.equal("new-modal");
        context.metricsModel.should.equal("metrics");
        context.insertCitation.calledOnce.should.equal(true);
        context.insertCitationMetaTags.calledOnce.should.equal(true);
      });
    });

    describe("modifyMetadataView()", () => {
      it("keeps dataset JSON-LD synchronized with package metadata", async () => {
        setPackageAppModel({ isJSONLDEnabled: true });
        globalThis.MetacatUI.appModel.DOItoURL = () => null;
        const originalNodeModel = globalThis.MetacatUI.nodeModel;
        globalThis.MetacatUI.nodeModel = { getMember: () => null };
        const schemaOrg = new SchemaOrgView();
        schemaOrg.render();
        schemaOrg.removeExistingJsonldEls();
        globalThis.MetacatUI.appView = {
          ...(globalThis.MetacatUI.appView || {}),
          schemaOrg,
        };
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.2.0",
              title: "Initial dataset title",
              origin: ["Jane Doe"],
              abstract: "Dataset abstract",
            },
          ],
        });
        const metadata = dataPackage.getPrimaryMetadataMember();
        const metadataView = {
          checkForProv: sandbox.stub(),
          remove: sandbox.stub(),
        };
        const context = withRenderContext({
          dataPackage,
          metadata,
          fileTableView: null,
          subviews: [],
          closeMetadataView: sandbox.stub(),
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          insertCitation: sandbox.stub(),
          insertDataSource: sandbox.stub(),
          showVersionNavigation: sandbox.stub().resolves(),
          renderInfoIcons: sandbox.stub().resolves(),
          renderControls: sandbox.stub(),
          canonicalDatasetHandler: null,
          trigger: sandbox.stub(),
          insertCitationMetaTags: sandbox.stub(),
          scrollToFragment: sandbox.stub(),
        });
        MetadataView.prototype.prepareCitationModel.call(context);

        try {
          await MetadataView.prototype.modifyMetadataView.call(
            context,
            { renderId: "render-test" },
            metadataView,
          );

          const jsonldEl = document.head.querySelector(
            'script[type="application/ld+json"]',
          );
          expect(jsonldEl).to.not.equal(null);
          let jsonld = JSON.parse(jsonldEl.text);
          jsonld["@type"].should.equal("Dataset");
          jsonld.name.should.equal("Initial dataset title");

          metadata.title = "Enriched dataset title";
          MetadataView.prototype.refreshMetadataHeaderFromPackage.call(
            context,
            dataPackage,
            { renderId: "render-test" },
          );

          jsonld = JSON.parse(jsonldEl.text);
          jsonld.name.should.equal("Enriched dataset title");
        } finally {
          schemaOrg.removeExistingJsonldEls();
          schemaOrg.stopListening();
          globalThis.MetacatUI.nodeModel = originalNodeModel;
        }
      });

      it("merges file table rows after metadata view-service entities load", async () => {
        globalThis.MetacatUI.appView = {
          schemaOrg: { setSchema: sandbox.stub() },
        };
        const dataPackage = {};
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const metadataView = {
          subviews: [],
          checkForProv: sandbox.stub(),
          remove: sandbox.stub(),
        };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          subviews: [],
          closeMetadataView: sandbox.stub(),
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
          insertCitation: sandbox.stub(),
          insertDataSource: sandbox.stub(),
          showVersionNavigation: sandbox.stub().resolves(),
          renderInfoIcons: sandbox.stub().resolves(),
          renderControls: sandbox.stub(),
          canonicalDatasetHandler: null,
          trigger: sandbox.stub(),
          insertCitationMetaTags: sandbox.stub(),
          scrollToFragment: sandbox.stub(),
        });

        await MetadataView.prototype.modifyMetadataView.call(
          context,
          { renderId: "render-test" },
          metadataView,
        );

        context.mergeCurrentFileTableRows.calledOnce.should.equal(true);
        context.mergeCurrentFileTableRows.firstCall.args[0].should.equal(
          dataPackage,
        );
        context.mergeCurrentFileTableRows.firstCall.args[1].should.equal(
          fileTableView,
        );
        context.mergeCurrentFileTableRows.firstCall.args[2].should.deep.equal({
          renderId: "render-test",
        });
      });

      it("stops after an awaited step when a newer render starts", async () => {
        let resolveInfoIcons;
        const metadataView = {
          checkForProv: sandbox.stub(),
          remove: sandbox.stub(),
        };
        const context = withRenderContext({
          dataPackage: {},
          fileTableView: null,
          subviews: [],
          closeMetadataView: sandbox.stub(),
          insertCitation: sandbox.stub(),
          insertDataSource: sandbox.stub(),
          showVersionNavigation: sandbox.stub().resolves(),
          renderInfoIcons: sandbox.stub().returns(
            new Promise((resolve) => {
              resolveInfoIcons = resolve;
            }),
          ),
          renderControls: sandbox.stub(),
          canonicalDatasetHandler: null,
          trigger: sandbox.stub(),
          insertCitationMetaTags: sandbox.stub(),
          scrollToFragment: sandbox.stub(),
        });

        const modifying = MetadataView.prototype.modifyMetadataView.call(
          context,
          { renderId: "render-test" },
          metadataView,
        );
        context.renderId = "render-new";
        resolveInfoIcons();
        await modifying;

        sinon.assert.notCalled(context.renderControls);
        sinon.assert.notCalled(context.trigger);
      });
    });

    describe("renderMetadata()", () => {
      const renderWithPermissions = async ({ canWrite, canEditProvenance }) => {
        setPackageAppModel({ viewServiceUrl: "https://view.test/" });
        const dataPackage = new DataPackage();
        const metadata = {
          pid: "meta.1",
          archived: false,
          get: sandbox.stub().returns(null),
          toJSON: sandbox.stub().returns({}),
        };
        const context = withRenderContext({
          canWrite,
          canEditProvenance,
          dataPackage,
          metadata,
          metadataContainer: null,
          renderMetadataShell: sandbox.stub(),
          getDataMemberIsPublic: sandbox.stub().resolves(false),
        });
        const render = sandbox
          .stub(MetadataDocumentView.prototype, "render")
          .returns(new Promise(() => {}));

        await MetadataView.prototype.renderMetadata.call(context, {
          renderId: "render-test",
        });

        const metadataView = render.thisValues[0];
        metadataView.stopListening();
        metadataView.remove();
        return metadataView.editModeOn;
      };

      it("does not show provenance editors with metadata-only write permission", async () => {
        const editModeOn = await renderWithPermissions({
          canWrite: true,
          canEditProvenance: false,
        });

        editModeOn.should.equal(false);
      });

      it("shows provenance editors with Resource Map write permission", async () => {
        const editModeOn = await renderWithPermissions({
          canWrite: false,
          canEditProvenance: true,
        });

        editModeOn.should.equal(true);
      });

      it("discards metadata errors from an earlier render", async () => {
        setPackageAppModel({ viewServiceUrl: "https://view.test/" });
        const dataPackage = new DataPackage();
        const metadata = {
          pid: "meta.1",
          get: sandbox.stub().returns(null),
          toJSON: sandbox.stub().returns({}),
        };
        let rejectRender;
        const renderPromise = new Promise((_resolve, reject) => {
          rejectRender = reject;
        });
        const render = sandbox
          .stub(MetadataDocumentView.prototype, "render")
          .returns(renderPromise);
        const consoleError = sandbox.stub(console, "error");
        const context = withRenderContext({
          canEditProvenance: false,
          dataPackage,
          metadata,
          metadataContainer: null,
          renderMetadataShell: sandbox.stub(),
          getDataMemberIsPublic: sandbox.stub().resolves(false),
        });

        await MetadataView.prototype.renderMetadata.call(context, {
          renderId: "render-test",
        });
        const metadataView = render.thisValues[0];
        const onClose = sandbox.spy(metadataView, "onClose");
        const remove = sandbox.stub(metadataView, "remove");
        context.renderId = "render-new";
        rejectRender(new Error("stale metadata response"));
        await renderPromise.catch(() => {});
        await Promise.resolve();

        sinon.assert.calledOnce(onClose);
        sinon.assert.calledOnce(remove);
        sinon.assert.notCalled(consoleError);
      });
    });

    describe("loadNestedPackageTitles()", () => {
      it("merges rows when package enrichment loads a title", async () => {
        const dataPackage = {
          loadNestedPackageTitles: sandbox.stub().resolves(true),
        };
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
        });

        await MetadataView.prototype.loadNestedPackageTitles.call(context);

        sinon.assert.calledOnceWithExactly(
          dataPackage.loadNestedPackageTitles,
          { signal: undefined },
        );
        sinon.assert.calledOnceWithExactly(
          context.mergeCurrentFileTableRows,
          dataPackage,
          fileTableView,
          { renderId: "render-test", signal: undefined },
        );
      });
    });

    describe("packageNeedsIndexRefresh()", () => {
      it("detects an incomplete metadata header", () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.2.0",
              title: "",
            },
          ],
        });
        const context = {
          metadataHeaderNeedsIndexRefresh:
            MetadataView.prototype.metadataHeaderNeedsIndexRefresh,
        };

        MetadataView.prototype.packageNeedsIndexRefresh
          .call(context, dataPackage)
          .should.equal(true);
      });

      it("accepts a valid member whose System Metadata has no file name", () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.2.0",
              title: "Dataset",
            },
            {
              pid: "data.1",
              formatType: "DATA",
              formatId: "text/csv",
              size: 12,
            },
          ],
        });
        const context = {
          metadataHeaderNeedsIndexRefresh:
            MetadataView.prototype.metadataHeaderNeedsIndexRefresh,
        };

        MetadataView.prototype.packageNeedsIndexRefresh
          .call(context, dataPackage)
          .should.equal(false);
      });

      it("detects an unresolved placeholder with no display name", () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.2.0",
              title: "Dataset",
            },
            {
              pid: "data.1",
              formatType: "DATA",
              formatId: "text/csv",
              isPlaceHolder_b: true,
            },
          ],
        });
        const context = {
          metadataHeaderNeedsIndexRefresh:
            MetadataView.prototype.metadataHeaderNeedsIndexRefresh,
        };

        MetadataView.prototype.packageNeedsIndexRefresh
          .call(context, dataPackage)
          .should.equal(true);
      });

      it("ignores resource maps and confirmed missing members", () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "nested-rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.2.0",
              title: "Dataset",
            },
            {
              pid: "missing.1",
              formatType: "DATA",
              formatId: "text/csv",
              size: 12,
              sysMetaMissing: true,
            },
          ],
        });
        const context = {
          metadataHeaderNeedsIndexRefresh:
            MetadataView.prototype.metadataHeaderNeedsIndexRefresh,
        };

        MetadataView.prototype.packageNeedsIndexRefresh
          .call(context, dataPackage)
          .should.equal(false);
      });
    });

    describe("enrichFileTableMemberDetails()", () => {
      it("merges updated rows and schedules one index refresh after enrichment", async () => {
        const dataPackage = {};
        const enrichMembers = sandbox
          .stub(DataPackageFileTableAdapter, "enrichMembers")
          .resolves({
            attemptedPids: ["data.1"],
            fetchedPids: ["data.1"],
            missingPids: [],
            unresolvedPlaceholderPids: [],
            changed: true,
          });
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          refreshMetadataHeaderFromPackage: sandbox.stub().returns(true),
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
          packageNeedsIndexRefresh: sandbox.stub().returns(true),
          scheduleFileTableIndexRefresh: sandbox.stub(),
        });

        await MetadataView.prototype.enrichFileTableMemberDetails.call(context);

        sinon.assert.calledOnceWithExactly(enrichMembers, dataPackage, {
          signal: undefined,
        });
        context.mergeCurrentFileTableRows.calledOnce.should.equal(true);
        context.mergeCurrentFileTableRows.firstCall.args[0].should.equal(
          dataPackage,
        );
        context.mergeCurrentFileTableRows.firstCall.args[1].should.equal(
          fileTableView,
        );
        context.mergeCurrentFileTableRows.firstCall.args[2].should.deep.equal({
          renderId: "render-test",
          signal: undefined,
        });
        context.scheduleFileTableIndexRefresh.calledOnce.should.equal(true);
      });

      it("does not merge rows after the table becomes stale", async () => {
        const oldFileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const dataPackage = {};
        sandbox
          .stub(DataPackageFileTableAdapter, "enrichMembers")
          .callsFake(async () => {
            context.fileTableView = {
              viewModel: { mergeRows: sandbox.stub() },
            };
            return {
              attemptedPids: ["data.1"],
              fetchedPids: ["data.1"],
              missingPids: [],
              unresolvedPlaceholderPids: [],
              changed: true,
            };
          });
        const context = withRenderContext({
          dataPackage,
          fileTableView: oldFileTableView,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
          scheduleFileTableIndexRefresh: sandbox.stub(),
        });

        await MetadataView.prototype.enrichFileTableMemberDetails.call(context);

        context.mergeCurrentFileTableRows.called.should.equal(false);
        context.scheduleFileTableIndexRefresh.called.should.equal(false);
      });

      it("schedules an index refresh when the metadata header is incomplete", async () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "meta.1",
              formatType: "METADATA",
              formatId: "eml://ecoinformatics.org/eml-2.2.0",
              title: "",
            },
          ],
        });
        sandbox.stub(DataPackageFileTableAdapter, "enrichMembers").resolves({
          attemptedPids: [],
          fetchedPids: [],
          missingPids: [],
          unresolvedPlaceholderPids: [],
          changed: false,
        });
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          metadataHeaderNeedsIndexRefresh:
            MetadataView.prototype.metadataHeaderNeedsIndexRefresh,
          packageNeedsIndexRefresh:
            MetadataView.prototype.packageNeedsIndexRefresh,
          refreshMetadataHeaderFromPackage: sandbox.stub().returns(true),
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
          scheduleFileTableIndexRefresh: sandbox.stub(),
        });

        await MetadataView.prototype.enrichFileTableMemberDetails.call(context);

        context.mergeCurrentFileTableRows.called.should.equal(false);
        context.scheduleFileTableIndexRefresh.calledOnce.should.equal(true);
      });
    });

    describe("scheduleFileTableIndexRefresh()", () => {
      it("polls until the package no longer needs index data", async () => {
        const clock = sandbox.useFakeTimers();
        let attempts = 0;
        const dataPackage = {
          getManifestFromIndex: sandbox.stub().callsFake(async () => {
            attempts += 1;
          }),
        };
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          fileTableIndexRefreshTimer: null,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          refreshMetadataTitleFromIndex: sandbox.stub().resolves(),
          refreshMetadataHeaderFromPackage: sandbox.stub().returns(true),
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
          packageNeedsIndexRefresh: sandbox
            .stub()
            .callsFake(() => attempts < 2),
        });

        MetadataView.prototype.scheduleFileTableIndexRefresh.call(
          context,
          dataPackage,
          fileTableView,
          { renderId: "render-test" },
        );
        await clock.tickAsync(2000);
        await clock.tickAsync(3000);

        dataPackage.getManifestFromIndex.calledTwice.should.equal(true);
        dataPackage.getManifestFromIndex.firstCall.args[0].should.include({
          merge: true,
          onlyExisting: true,
        });
        context.refreshMetadataHeaderFromPackage.calledTwice.should.equal(true);
        context.refreshMetadataHeaderFromPackage.firstCall.args[0].should.equal(
          dataPackage,
        );
        context.mergeCurrentFileTableRows.calledTwice.should.equal(true);
      });
    });

    describe("saveProv()", () => {
      it("shows Resource Map validation issue messages", async () => {
        const mismatchMessage =
          'The member URL "https://mn.example/mn/v2/object/different.1" identifies PID "different.1", but its declared identifier is "data.1". Change the member URL or identifier so they name the same object before saving.';
        const error = Object.assign(
          new Error("Cannot upload: validation failed"),
          {
            code: "validation_failure",
            issues: [
              {
                code: "memberIdentifierMismatch",
                message: mismatchMessage,
              },
            ],
          },
        );
        const context = withRenderContext({
          saveProvPending: false,
          dataPackage: {
            getResourceMapModel: () => ({
              hasUnsavedChanges: () => true,
            }),
            upload: sandbox.stub().rejects(error),
          },
          showSaving: sandbox.stub(),
          saveError: sandbox.stub(),
        });

        await MetadataView.prototype.saveProv.call(context);

        sinon.assert.calledOnceWithExactly(context.saveError, mismatchMessage);
      });

      it("does not update the reused view after an earlier package saves", async () => {
        let resolveUpload;
        const dataPackage = {
          getResourceMapModel: () => ({
            hasUnsavedChanges: () => true,
          }),
          upload: sandbox.stub().returns(
            new Promise((resolve) => {
              resolveUpload = resolve;
            }),
          ),
        };
        const context = withRenderContext({
          saveProvPending: false,
          dataPackage,
          showSaving: sandbox.stub(),
          saveSuccess: sandbox.stub(),
          saveError: sandbox.stub(),
        });

        const saving = MetadataView.prototype.saveProv.call(context);
        context.renderId = "render-new";
        context.dataPackage = {};
        resolveUpload({ outcome: "success" });
        await saving;

        sinon.assert.notCalled(context.saveSuccess);
        sinon.assert.notCalled(context.saveError);
      });
    });

    describe("saveError()", () => {
      it("stores the body-level provenance save alert for later cleanup", () => {
        const alert = document.createElement("div");
        globalThis.MetacatUI.appView = {
          showAlert: sandbox.stub().returns(alert),
        };
        const context = {
          activeAlert: null,
          saveProvPending: true,
          hideSaving: sandbox.stub(),
          hideEditorControls: sandbox.stub(),
          showViewAlert: MetadataView.prototype.showViewAlert,
          removeViewAlert: MetadataView.prototype.removeViewAlert,
        };

        MetadataView.prototype.saveError.call(context, "boom");

        context.activeAlert.should.equal(alert);
        context.saveProvPending.should.equal(false);
      });
    });

    describe("publish()", () => {
      it("shows success without requiring a page container element", async () => {
        const clock = sandbox.useFakeTimers();
        const el = document.createElement("div");
        globalThis.MetacatUI.appModel = {
          get: (key) =>
            ({
              baseUrl: "https://example.test",
              emailContact: "",
              pid: "meta.1",
            })[key] || "",
        };
        globalThis.MetacatUI.uiRouter = { navigate: sandbox.stub() };
        sandbox.stub(window, "confirm").returns(true);

        const view = new MetadataView({ el });
        view.el.innerHTML = view.template();
        view.pid = "meta.1";
        view.dataPackage = {
          publish: sandbox.stub().resolves({
            pid: "doi:10.123/example",
            resourceMapPending: false,
          }),
        };
        sandbox.stub(view, "showLoading");
        sandbox.stub(view, "hideLoading");

        should.equal(view.el.querySelector(".container"), null);

        let result;
        try {
          result = await view.publish();
        } finally {
          delete globalThis.emailOptions;
        }

        result.should.equal("doi:10.123/example");
        view.dataPackage.publish.calledOnce.should.equal(true);
        should.exist(view.el.querySelector(".alert-success"));
        view.el
          .querySelector(".alert-success")
          .textContent.should.contain("Published data package");
        clock.tick(3000);
        globalThis.MetacatUI.uiRouter.navigate.calledOnce.should.equal(true);
      });

      it("redirects with a warning when the file list is still processing", async () => {
        const clock = sandbox.useFakeTimers();
        const el = document.createElement("div");
        const showAlert = sandbox.stub();
        globalThis.MetacatUI.appModel = {
          get: (key) =>
            ({
              baseUrl: "https://example.test",
              emailContact: "",
              pid: "meta.1",
            })[key] || "",
        };
        globalThis.MetacatUI.appView = { showAlert };
        globalThis.MetacatUI.uiRouter = { navigate: sandbox.stub() };
        sandbox.stub(window, "confirm").returns(true);

        const view = new MetadataView({ el });
        view.el.innerHTML = view.template();
        view.pid = "meta.1";
        view.dataPackage = {
          publish: sandbox.stub().resolves({
            pid: "doi:10.123/example",
            resourceMapPending: true,
          }),
        };
        sandbox.stub(view, "showLoading");
        sandbox.stub(view, "hideLoading");

        const result = await view.publish();

        result.should.equal("doi:10.123/example");
        sinon.assert.calledOnce(showAlert);
        const [message, classes, container, delay, options] =
          showAlert.firstCall.args;
        message.should.contain("doi:10.123/example");
        message.should.contain("file list is still being processed");
        classes.should.equal("alert-warning");
        container.should.equal("body");
        delay.should.equal(15000);
        options.should.deep.equal({ remove: true });
        clock.tick(3000);
        globalThis.MetacatUI.uiRouter.navigate.calledOnce.should.equal(true);
      });
    });

    describe("onClose()", () => {
      it("removes all citation metadata tags when the view closes", () => {
        globalThis.MetacatUI.appModel = {
          get: () => null,
          resetTitle: sandbox.stub(),
        };
        const view = new MetadataView({ el: document.createElement("div") });
        view.subviews = [];
        document.head.insertAdjacentHTML(
          "beforeend",
          [
            '<meta name="citation_title" content="Dataset">',
            '<meta name="citation_authors" content="A. Researcher">',
            '<meta name="citation_author" content="A. Researcher">',
            '<meta name="citation_publisher" content="DataONE">',
            '<meta name="citation_date" content="2026">',
            '<meta name="citation_doi" content="10.123/example">',
            '<meta name="citation_abstract" content="Summary">',
          ].join(""),
        );

        view.onClose();

        document
          .querySelectorAll("meta[name^='citation_']")
          .should.have.length(0);
      });

      it("aborts the active controller when a new render starts", () => {
        const previousController = { abort: sandbox.stub() };
        const context = withRenderContext({
          renderAbortController: previousController,
          fileTableIndexRefreshTimer: null,
          abortRender: MetadataView.prototype.abortRender,
        });

        const result = MetadataView.prototype.startRender.call(context);

        previousController.abort.calledOnce.should.equal(true);
        result.renderId.should.equal(context.renderId);
        result.signal.should.equal(context.renderAbortController.signal);
      });

      it("removes the active MetadataView alert when the view closes", () => {
        const alert = document.createElement("div");
        document.body.appendChild(alert);
        const renderAbortController = { abort: sandbox.stub() };
        const context = {
          renderId: "render-test",
          renderAbortController,
          stopListening: sandbox.stub(),
          activeAlert: alert,
          subviews: [],
          abortRender: MetadataView.prototype.abortRender,
          teardownFileTableScrollIndicators:
            MetadataView.prototype.teardownFileTableScrollIndicators,
          removeViewAlert: MetadataView.prototype.removeViewAlert,
          closeMetadataView: MetadataView.prototype.closeMetadataView,
          closeFileTableView: MetadataView.prototype.closeFileTableView,
          $el: {
            removeClass: sandbox.stub().returnsThis(),
            empty: sandbox.stub(),
          },
        };
        globalThis.MetacatUI.appModel = { resetTitle: sandbox.stub() };

        MetadataView.prototype.onClose.call(context);

        should.equal(document.body.contains(alert), false);
        should.equal(context.activeAlert, null);
        should.equal(context.renderId, null);
        renderAbortController.abort.calledOnce.should.equal(true);
      });

      it("clears the file table reference when the view closes", () => {
        const fileTableView = {
          onClose: sandbox.stub(),
        };
        const context = {
          renderId: "render-test",
          renderAbortController: { abort: sandbox.stub() },
          stopListening: sandbox.stub(),
          activeAlert: null,
          fileTableView,
          subviews: [fileTableView],
          abortRender: MetadataView.prototype.abortRender,
          teardownFileTableScrollIndicators:
            MetadataView.prototype.teardownFileTableScrollIndicators,
          removeViewAlert: MetadataView.prototype.removeViewAlert,
          closeMetadataView: MetadataView.prototype.closeMetadataView,
          closeFileTableView: MetadataView.prototype.closeFileTableView,
          $el: {
            removeClass: sandbox.stub().returnsThis(),
            empty: sandbox.stub(),
          },
        };
        globalThis.MetacatUI.appModel = { resetTitle: sandbox.stub() };

        MetadataView.prototype.onClose.call(context);

        fileTableView.onClose.calledOnce.should.equal(true);
        should.equal(context.fileTableView, null);
        context.subviews.should.deep.equal([]);
      });
    });

    describe("ambiguous-package messaging", () => {
      it("lists each candidate resource map as a /view/ link at the page level", () => {
        const showError = sandbox.stub();
        const context = {
          stopPackageLoading: sandbox.stub(),
          hideLoading: sandbox.stub(),
          showError,
        };

        MetadataView.prototype.showMultipleResourceMaps.call(
          context,
          { candidateResourceMapPids: ["rm.1", "rm.2"] },
          { scoped: false },
        );

        showError.calledOnce.should.equal(true);
        const msg = showError.firstCall.args[0];
        msg.should.contain("/view/rm.1");
        msg.should.contain("/view/rm.2");
      });

      it("keeps the ambiguity warning scoped to the file area when metadata is rendered", () => {
        const tableNode = {
          empty: sandbox.stub().returnsThis(),
          append: sandbox.stub().returnsThis(),
        };
        const context = {
          tableContainer: "#table-container",
          $: sandbox.stub().returns(tableNode),
          stopPackageLoading: sandbox.stub(),
          hideLoading: sandbox.stub(),
          showError: sandbox.stub(),
        };

        MetadataView.prototype.showMultipleResourceMaps.call(
          context,
          { candidateResourceMapPids: ["rm.1"] },
          { scoped: true },
        );

        context.stopPackageLoading.calledOnce.should.equal(true);
        context.showError.called.should.equal(false);
        tableNode.empty.calledOnce.should.equal(true);
        tableNode.append.firstCall.args[0].html().should.contain("/view/rm.1");
      });

      it("links candidate datasets with the data PID preserved in the fragment", () => {
        const showError = sandbox.stub();
        const context = {
          pid: "data.1",
          hideLoading: sandbox.stub(),
          showError,
        };

        MetadataView.prototype.showMultipleDocumentingDatasets.call(context, {
          candidateMetadataPids: ["meta.1", "meta.2"],
        });

        const msg = showError.firstCall.args[0];
        msg.should.contain("/view/meta.1#data.1");
        msg.should.contain("/view/meta.2#data.1");
      });
    });

    describe("resolveFileListingState()", () => {
      it("uses a neutral limited listing when no resource map is available", async () => {
        const context = withRenderContext({
          resourceMap: null,
          canWrite: false,
          hasRecoverablePackageRecord: sandbox.stub().resolves(false),
        });

        const state =
          await MetadataView.prototype.resolveFileListingState.call(context);

        state.should.equal("limitedListing");
      });

      it("uses a recoverable state only when an editor has an interrupted-save record", async () => {
        const context = withRenderContext({
          resourceMap: null,
          canWrite: true,
          hasRecoverablePackageRecord: sandbox.stub().resolves(true),
        });

        const state =
          await MetadataView.prototype.resolveFileListingState.call(context);

        state.should.equal("recoverableLimitedListing");
      });

      it("distinguishes permission failures from other package load failures", async () => {
        const context = withRenderContext({ resourceMap: null });

        const permissionState =
          await MetadataView.prototype.resolveFileListingState.call(
            context,
            {},
            { reason: "unauthorized" },
          );
        const serverState =
          await MetadataView.prototype.resolveFileListingState.call(
            context,
            {},
            { reason: "error" },
          );

        permissionState.should.equal("permissionUnavailable");
        serverState.should.equal("serverUnavailable");
      });

      it("offers recovery when the loaded map has a matching interrupted-save record", async () => {
        const context = withRenderContext({
          resourceMap: { pid: "rm.1" },
          canWrite: true,
          hasRecoverablePackageRecord: sandbox.stub().resolves(true),
        });

        const state =
          await MetadataView.prototype.resolveFileListingState.call(context);

        state.should.equal("recoverableLimitedListing");
      });

      it("uses package-load errors before resolved resource map state", async () => {
        const context = withRenderContext({
          resourceMap: { pid: "rm.1" },
        });

        const state = await MetadataView.prototype.resolveFileListingState.call(
          context,
          {},
          { reason: "error" },
        );

        state.should.equal("serverUnavailable");
      });
    });

    describe("hasRecoverablePackageRecord()", () => {
      it("accepts a record prepared to replace the loaded resource map", async () => {
        globalThis.MetacatUI.appModel = { get: sandbox.stub().returns("") };
        sandbox.stub(UploadRecoveryStore.prototype, "get").resolves({
          rmPid: "rm.2",
          obsoletesRmPid: "rm.1",
          rmXml: "<rdf:RDF></rdf:RDF>",
          rmSysMetaXml: "<d1:systemMetadata></d1:systemMetadata>",
        });
        const context = withRenderContext({
          metadata: { pid: "meta.1" },
          resourceMap: { pid: "rm.1" },
        });

        const result =
          await MetadataView.prototype.hasRecoverablePackageRecord.call(
            context,
          );

        result.should.equal(true);
      });

      it("ignores a record prepared for a different resource map", async () => {
        globalThis.MetacatUI.appModel = { get: sandbox.stub().returns("") };
        sandbox.stub(UploadRecoveryStore.prototype, "get").resolves({
          rmPid: "rm.2",
          obsoletesRmPid: "rm.0",
          rmXml: "<rdf:RDF></rdf:RDF>",
          rmSysMetaXml: "<d1:systemMetadata></d1:systemMetadata>",
        });
        const context = withRenderContext({
          metadata: { pid: "meta.1" },
          resourceMap: { pid: "rm.1" },
        });

        const result =
          await MetadataView.prototype.hasRecoverablePackageRecord.call(
            context,
          );

        result.should.equal(false);
      });
    });

    describe("interrupted-save recovery", () => {
      it("replays the viewer's confirmed interrupted save without reconstruction", () => {
        const context = {
          metadata: { pid: "meta.1" },
          repairDataset: sandbox.stub(),
        };

        MetadataView.prototype.handleFileTableNoticeAction.call(
          context,
          "finish-interrupted-save",
        );

        sinon.assert.calledOnceWithExactly(context.repairDataset, "meta.1");
      });

      it("uses exact replay when repairing a viewer interrupted save", async () => {
        globalThis.MetacatUI.appModel = {
          get: sandbox.stub().callsFake(
            (key) =>
              ({
                resolveServiceUrl: "https://resolve.test/",
                objectServiceUrl: "https://object.test/",
                metaServiceUrl: "https://meta.test/",
              })[key] || "",
          ),
        };
        const button = { prop: sandbox.stub() };
        const status = { text: sandbox.stub() };
        const context = withRenderContext({
          $: sandbox
            .stub()
            .callsFake((selector) =>
              selector === ".file-listing-note-action" ? button : status,
            ),
        });
        const recover = sandbox
          .stub(DataPackageRecovery.prototype, "recover")
          .resolves({ recovered: false });

        await MetadataView.prototype.repairDataset.call(context, "meta.1");

        sinon.assert.calledOnceWithExactly(recover, "meta.1");
      });

      it("does not update recovery controls after a newer render starts", async () => {
        globalThis.MetacatUI.appModel = {
          get: sandbox.stub().returns("https://service.test/"),
        };
        const button = { prop: sandbox.stub() };
        const status = { text: sandbox.stub() };
        const context = withRenderContext({
          $: sandbox
            .stub()
            .callsFake((selector) =>
              selector === ".file-listing-note-action" ? button : status,
            ),
        });
        let resolveRecovery;
        sandbox.stub(DataPackageRecovery.prototype, "recover").returns(
          new Promise((resolve) => {
            resolveRecovery = resolve;
          }),
        );

        const recovery = MetadataView.prototype.repairDataset.call(
          context,
          "meta.1",
        );
        context.renderId = "render-new";
        resolveRecovery({ recovered: false });
        await recovery;

        sinon.assert.calledOnceWithExactly(
          status.text,
          " Finishing interrupted save. This may take a moment...",
        );
        sinon.assert.calledOnceWithExactly(button.prop, "disabled", true);
      });
    });

    describe("addInfoIcon()", () => {
      it("adds status icons to the citation title, not rendered metadata titles", () => {
        const el = document.createElement("div");
        el.innerHTML = `
          <div id="citation-container">
            <div class="citation header">
              <h1 class="title">Dataset title</h1>
            </div>
          </div>
          <div id="metadata-container">
            <h4><span class="title">Entity title</span></h4>
          </div>
        `;
        const context = {
          el,
          citationContainer: "#citation-container",
        };

        MetadataView.prototype.addInfoIcon.call(
          context,
          "private",
          "icon-lock",
          "private",
          "This is a private dataset.",
        );
        MetadataView.prototype.addInfoIcon.call(
          context,
          "archived",
          "icon-trash",
          "danger",
          "This dataset has been archived.",
        );

        const citationTitle = el.querySelector("#citation-container .title");
        const metadataTitle = el.querySelector("#metadata-container .title");
        should.exist(
          citationTitle.querySelector(".dataset-info-icons-container"),
        );
        citationTitle
          .querySelectorAll(".dataset-info-icons-container > .icon")
          .should.have.length(2);
        should.not.exist(
          metadataTitle.querySelector(".dataset-info-icons-container"),
        );
      });
    });

    describe("previewData()", () => {
      it("delegates in-page previews to the metadata document", () => {
        const event = { preventDefault: sandbox.stub() };
        const metadataView = {
          previewData: sandbox.stub().withArgs(event).returns(true),
        };
        const context = { metadataView };

        const result = MetadataView.prototype.previewData.call(context, event);

        result.should.equal(true);
        sinon.assert.calledOnceWithExactly(metadataView.previewData, event);
      });
    });
  });
});
