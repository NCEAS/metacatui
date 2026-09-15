define([
  "views/MetadataView",
  "models/AppModel",
  "views/MetadataDocumentView",
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageRecovery",
  "models/dataPackage/UploadRecoveryStore",
  "models/fileTable/DataPackageFileTableAdapter",
  "models/fileTable/FileTableViewModel",
  "models/fileTable/FileItemActionViewModel",
  "views/schemaOrg/SchemaOrgView",
  "common/DateUtilities",
], (
  MetadataView,
  AppModel,
  MetadataDocumentView,
  DataPackage,
  DataPackageRecovery,
  UploadRecoveryStore,
  DataPackageFileTableAdapter,
  FileTableViewModel,
  FileItemActionViewModel,
  SchemaOrgView,
  DateUtilities,
) => {
  const should = chai.should();
  const expect = chai.expect;
  const RESOURCE_MAP_FORMAT_ID = "http://www.openarchives.org/ore/terms";
  const { MESSAGES: FILE_TABLE_MESSAGES } = DataPackageFileTableAdapter;

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
      resolveInput: MetadataView.prototype.resolveInput,
      loadPackageMembers: MetadataView.prototype.loadPackageMembers,
      startMetadataRender: MetadataView.prototype.startMetadataRender,
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
      packageService = null,
    } = {}) => {
      const dataPackage = new DataPackage({ members, packageService });
      dataPackage.rootResourceMapPid = rootResourceMapPid;
      return dataPackage;
    };

    const setPackageAppModel = (values = {}) => {
      globalThis.MetacatUI.appModel = {
        getDataPackageServiceOptions:
          AppModel.prototype.getDataPackageServiceOptions,
        get: (key) =>
          ({
            packageServiceUrl: "https://cn.test/package/",
            resolveServiceUrl: "https://cn.test/resolve/",
            maxViewerPackageMembers: 3000,
            ...values,
          })[key] || "",
        isDOI: () => false,
      };
    };

    const createPackageDownloadContext = ({
      checked = true,
      loggedIn = true,
      result = new Blob(["package"]),
      title = "Dataset title",
    } = {}) => {
      setPackageAppModel();
      const packageService = {
        download: sandbox.stub().resolves(result),
      };
      const dataPackage = createViewerDataPackage({ packageService });
      const userModel = new Backbone.Model({
        checked,
        loggedIn,
      });
      globalThis.MetacatUI.appUserModel = userModel;
      const fileTableView = {
        viewModel: new FileTableViewModel({
          rows: [
            {
              id: "dataset:rm.1",
              pid: "rm.1",
              title,
              kind: "dataset",
              downloadUrl: "https://cn.test/package/rm.1",
              actions: [
                {
                  id: "download",
                  label: "Download All",
                  title: "Download all files in Dataset",
                },
              ],
            },
          ],
        }),
      };
      const row = fileTableView.viewModel.getRows().get("dataset:rm.1");
      const actionModel = row.getActions().get("download");
      const context = {
        dataPackage,
        fileTableView,
        memberDownloadReadDenied: new Set(),
        getFileTableRows: MetadataView.prototype.getFileTableRows,
        confirmPackageDownloadAll:
          MetadataView.prototype.confirmPackageDownloadAll,
        scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
        showViewAlert: sandbox.stub(),
        packageDownloadUrl: "https://cn.test/package/rm.1",
        downloadPackageFileTableRow:
          MetadataView.prototype.downloadPackageFileTableRow,
      };
      return { actionModel, context, packageService, row, userModel };
    };

    const deferred = () => {
      let resolve;
      let reject;
      const promise = new Promise((settle, fail) => {
        resolve = settle;
        reject = fail;
      });
      return { promise, reject, resolve };
    };

    const assertDownloadFailureAlert = (showViewAlert) => {
      sinon.assert.calledOnce(showViewAlert);
      const [message, classes] = showViewAlert.firstCall.args;
      message.should.match(/download failed.*try again/i);
      classes.should.equal("alert-error");
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
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
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
      it("starts metadata rendering while PID resolution is still pending", async () => {
        const resolverEventSent = deferred();
        const finishResolution = deferred();
        sandbox
          .stub(DataPackage.prototype, "resolveFromPid")
          .callsFake(function resolveFromPid() {
            this.members.add({
              pid: "meta.1",
              formatId: "https://eml.ecoinformatics.org/eml-2.2.0",
              formatType: "METADATA",
              title: "Early title",
            });
            this.primaryMetadataPid = "meta.1";
            this.events.trigger("load:metadata", {
              metadata: this.getPrimaryMetadataMember(),
              pid: "meta.1",
            });
            resolverEventSent.resolve();
            return finishResolution.promise;
          });
        const documentRender = sandbox
          .stub(MetadataDocumentView.prototype, "render")
          .callsFake(function render() {
            return Promise.resolve(this);
          });
        globalThis.MetacatUI.appModel = {
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
          get: (key) =>
            ({
              viewServiceUrl: "https://view.test/",
              resolveServiceUrl: "https://resolve.test/",
            })[key] || "",
          set: sandbox.stub(),
        };
        globalThis.MetacatUI.appUserModel = { ...Backbone.Events };
        const view = new MetadataView({ el: document.createElement("div") });
        sandbox.stub(view, "showLoading");
        sandbox.stub(view, "prepareCitationModel");
        sandbox.stub(view, "insertCitation");
        sandbox.stub(view, "getDataMemberIsPublic").resolves(false);
        sandbox.stub(view, "renderMetadataShell").callsFake(() => {
          view.el.innerHTML = '<div id="metadata-container"></div>';
          view.metadataContainer = view.el.firstElementChild;
        });

        const rendering = view.render({ pid: "meta.1" });
        await resolverEventSent.promise;
        await view.metadataRenderPromise;

        sinon.assert.calledOnce(documentRender);
        view.metadataContainer.firstElementChild.should.equal(
          documentRender.thisValues[0].el,
        );

        view.renderId = "newer-render";
        finishResolution.resolve({});
        await rendering;
        view.closeMetadataView();
      });

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
        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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

        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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
        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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
        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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
        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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
        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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

      it("stops member loading when a newer render starts after resource map retrieval", async () => {
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
        let finishResourceMapLoad;
        let markResourceMapLoadStarted;
        const resourceMapLoadStarted = new Promise((resolve) => {
          markResourceMapLoadStarted = resolve;
        });
        sandbox
          .stub(DataPackage.prototype, "getManifestFromResourceMap")
          .callsFake(() => {
            markResourceMapLoadStarted();
            return new Promise((resolve) => {
              finishResourceMapLoad = () => resolve({ ok: true });
            });
          });
        const getManifestFromIndex = sandbox.stub(
          DataPackage.prototype,
          "getManifestFromIndex",
        );

        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          abortRender: MetadataView.prototype.abortRender,
          render: MetadataView.prototype.render,
        });

        const rendering = MetadataView.prototype.render.call(context, {
          pid: "meta.1",
        });
        await resourceMapLoadStarted;
        context.renderId = "render-new";
        finishResourceMapLoad();
        await rendering;

        sinon.assert.notCalled(getManifestFromIndex);
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

        globalThis.MetacatUI.appModel = {
          get: (key) => (key === "maxViewerPackageMembers" ? 3000 : ""),
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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
          rows: 3000,
          signal: context.renderAbortController.signal,
        });
      });

      [
        {
          title: "limits details when the index response is truncated",
          maxRows: 5,
          indexDetails: { count: 5, total: 8 },
          expectedLimited: true,
        },
        {
          title: "keeps details enabled when membership and index results fit",
          maxRows: 5,
          indexDetails: { count: 3, total: 3 },
          expectedLimited: false,
        },
      ].forEach(({ title, maxRows, indexDetails, expectedLimited }) => {
        it(title, async () => {
          setPackageAppModel({ maxViewerPackageMembers: maxRows });
          const dataPackage = createViewerDataPackage();
          sandbox
            .stub(dataPackage, "getManifestFromResourceMap")
            .resolves({ ok: true });
          const getManifestFromIndex = sandbox
            .stub(dataPackage, "getManifestFromIndex")
            .resolves({ ok: true, details: indexDetails });
          const context = withRenderContext({ dataPackage });

          const result = await MetadataView.prototype.loadPackageMembers.call(
            context,
            dataPackage,
            false,
            { renderId: "render-test" },
          );

          sinon.assert.calledOnceWithExactly(getManifestFromIndex, {
            merge: true,
            onlyExisting: true,
            rows: maxRows,
            signal: undefined,
          });
          result.fileTableDetailsLimited.should.equal(expectedLimited);
        });
      });

      [
        {
          title:
            "falls back to the index when resource map membership is unavailable",
          reason: "notFound",
          loadsIndex: true,
          fileListingState: "serverUnavailable",
          maxRows: 2,
          indexDetails: { count: 2, total: 3 },
          expectedLimited: true,
        },
        {
          title:
            "does not use the index when resource map membership is unauthorized",
          reason: "unauthorized",
          loadsIndex: false,
          fileListingState: "permissionUnavailable",
          maxRows: 3000,
          indexDetails: undefined,
          expectedLimited: false,
        },
      ].forEach((testCase) => {
        const {
          title,
          reason,
          loadsIndex,
          fileListingState,
          maxRows,
          indexDetails,
          expectedLimited,
        } = testCase;
        it(title, async () => {
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
            .resolves({ ok: false, reason });
          const getManifestFromIndex = sandbox
            .stub(DataPackage.prototype, "getManifestFromIndex")
            .resolves({ ok: true, details: indexDetails });

          globalThis.MetacatUI.appModel = {
            get: (key) => (key === "maxViewerPackageMembers" ? maxRows : ""),
            set: sandbox.stub(),
            getDataPackageServiceOptions:
              AppModel.prototype.getDataPackageServiceOptions,
          };
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

          if (loadsIndex) {
            sinon.assert.calledOnceWithExactly(getManifestFromIndex, {
              merge: true,
              rows: maxRows,
              signal: context.renderAbortController.signal,
            });
          } else {
            sinon.assert.notCalled(getManifestFromIndex);
          }
          context.insertPackageTable.firstCall.args[1].fileListingState.should.equal(
            fileListingState,
          );
          context.fileTableDetailsLimited.should.equal(expectedLimited);
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

        globalThis.MetacatUI.appModel = {
          get: () => "",
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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

        globalThis.MetacatUI.appModel = {
          get: (key) => (key === "maxViewerPackageMembers" ? 3000 : ""),
          set: sandbox.stub(),
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
        };
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
          rows: 3000,
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

      it("discloses an authoritative limited subset for a data package without metadata", async () => {
        const el = document.createElement("div");
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "data.1",
              formatType: "DATA",
              fileName: "first.csv",
            },
          ],
          rootResourceMapPid: null,
        });
        const getManifest = sandbox
          .stub(dataPackage, "getManifest")
          .callsFake(async function getManifestFromResourceMap() {
            this.members.add([
              {
                pid: "rm.1",
                formatType: "RESOURCE",
                formatId: RESOURCE_MAP_FORMAT_ID,
              },
              {
                pid: "data.2",
                formatType: "DATA",
                fileName: "second.csv",
              },
              {
                pid: "data.3",
                formatType: "DATA",
                fileName: "third.csv",
              },
            ]);
            this.rootResourceMapPid = "rm.1";
            this.resourceManifestIsFetched = true;
          });
        setPackageAppModel({ maxViewerPackageMembers: 2 });
        const view = new MetadataView({ el });
        view.pid = "data.1";
        view.renderId = "render-test";
        view.dataPackage = dataPackage;
        view.fileTableDetailsLimited = false;
        view.fileTableMetricsByPid = null;
        view.metricsModel = null;
        view.packageDownloadUrl = "";
        view.subviews = [];
        sandbox.stub(view, "hideLoading");
        sandbox.stub(view, "insertBreadcrumbs");
        sandbox.stub(view, "showViewAlert");
        sandbox.stub(view, "confirmPackageDownloadAll");
        sandbox.stub(view, "setupFileTableScrollIndicators");
        sandbox.stub(view, "loadNestedPackageTitles");
        sandbox.stub(view, "enrichFileTableMemberDetails");
        sandbox.stub(view, "loadFileTableMetrics");

        await view.handleDataInput(
          { isData: true },
          { renderId: "render-test" },
        );

        sinon.assert.calledOnceWithExactly(getManifest, {
          index: false,
          signal: undefined,
        });
        view.fileTableView.viewModel
          .get("noticeMessage")
          .should.equal(
            "Showing the first 2 of 3 files. Some file details may be unavailable.",
          );
        view.fileTableView.remove();
        view.remove();
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
      it("counts a fallback member only when the package has no active members", () => {
        setPackageAppModel();
        const dataPackage = new DataPackage();
        const context = { dataPackage };
        const fallbackMember = new DataPackage({
          members: [{ pid: "metadata", formatType: "METADATA" }],
        }).getMember("metadata");

        MetadataView.prototype.getFileTableRows.call(context, fallbackMember);
        context.fileTableMemberCount.should.equal(1);

        dataPackage.rootResourceMapPid = "root";
        dataPackage.members.add({ pid: "root", formatType: "RESOURCE" });
        MetadataView.prototype.getFileTableRows.call(context, fallbackMember);
        context.fileTableMemberCount.should.equal(0);
      });

      it("passes all active members and the configured cap to the adapter", () => {
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
              fileName: "first.csv",
            },
            {
              pid: "data.2",
              formatType: "DATA",
              fileName: "second.csv",
            },
            {
              pid: "nested.rm",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            { pid: "meta.1", formatType: "METADATA", title: "EML" },
          ],
        });
        const buildRows = sandbox.spy(DataPackageFileTableAdapter, "buildRows");
        setPackageAppModel({ maxViewerPackageMembers: 2 });
        const context = {
          dataPackage,
          fileTableDetailsLimited: false,
          fileTableMetricsByPid: null,
          metricsModel: null,
          packageDownloadUrl: "",
        };

        const rows = MetadataView.prototype.getFileTableRows.call(context);

        buildRows.firstCall.args[1].members
          .map((member) => member.pid)
          .should.deep.equal([
            "rm.1",
            "data.1",
            "data.2",
            "nested.rm",
            "meta.1",
          ]);
        buildRows.firstCall.args[1].maxMembers.should.equal(2);
        rows
          .map((row) => row.id)
          .should.deep.equal(["dataset:rm.1", "meta.1", "data.1"]);
        context.fileTableMemberCount.should.equal(4);
        context.fileTableDetailsLimited.should.equal(true);
      });

      it("omits Download All when its URL is unavailable", () => {
        const dataPackage = createViewerDataPackage();
        setPackageAppModel();
        const context = {
          dataPackage,
          packageDownloadUrl: "",
        };

        const rows = MetadataView.prototype.getFileTableRows.call(context);
        const rootRow = rows.find((row) => row.id === "dataset:rm.1");

        rootRow.actions.should.deep.equal([]);
      });

      it("adds Download All when member access is unknown", () => {
        const dataPackage = createViewerDataPackage();
        setPackageAppModel();
        const context = {
          dataPackage,
          packageDownloadUrl: "",
          packageDownloadUnavailableReason: "",
          getFileTableRows: MetadataView.prototype.getFileTableRows,
        };

        MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
        );
        context.packageDownloadUrl.should.equal("https://cn.test/package/rm.1");
        const rows = context.getFileTableRows();
        const rootRow = rows.find((row) => row.id === "dataset:rm.1");

        rootRow.actions
          .map((action) => action.id)
          .should.deep.equal(["download"]);
        rootRow.downloadUrl.should.equal("https://cn.test/package/rm.1");
      });

      [
        {
          flag: "sysMetaReadDenied",
          reason: FILE_TABLE_MESSAGES.packageDownloadReadDenied,
        },
        {
          flag: "sysMetaMissing",
          reason: FILE_TABLE_MESSAGES.packageDownloadMissing,
        },
      ].forEach(({ flag, reason }) => {
        it(`disables Download All for ${flag} even without package size`, () => {
          const dataPackage = createViewerDataPackage();
          dataPackage.getMember("data.1")[flag] = true;
          dataPackage.getMember("data.1").size = null;
          setPackageAppModel({ maxDownloadSize: 100 });
          const context = {
            dataPackage,
            packageDownloadUrl: "",
            packageDownloadUnavailableReason: "",
            getFileTableRows: MetadataView.prototype.getFileTableRows,
          };

          MetadataView.prototype.confirmPackageDownloadAll.call(
            context,
            dataPackage,
          );
          const rootRow = context
            .getFileTableRows()
            .find((row) => row.id === "dataset:rm.1");

          context.packageDownloadUrl.should.equal("");
          context.packageDownloadUnavailableReason.should.equal(reason);
          rootRow.actions.should.have.length(1);
          rootRow.actions[0].should.include({
            id: "download",
            title: reason,
            isDisabled: true,
          });
        });
      });

      it("clears a stale URL when package downloads are unconfigured", () => {
        const dataPackage = createViewerDataPackage();
        setPackageAppModel({ packageServiceUrl: "" });
        const context = {
          packageDownloadUrl: "stale URL",
        };

        MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
        );

        context.packageDownloadUrl.should.equal("");
      });

      [
        ["the package", { packageDownloadReadDenied: true }],
        [
          "a file in the package",
          { memberDownloadReadDenied: new Set(["data.1"]) },
        ],
      ].forEach(([target, permissionState]) => {
        it(`disables Download All when the user cannot read ${target}`, () => {
          setPackageAppModel();
          const dataPackage = createViewerDataPackage();
          const context = { ...permissionState };

          MetadataView.prototype.confirmPackageDownloadAll.call(
            context,
            dataPackage,
          );

          context.packageDownloadUrl.should.equal("");
          context.packageDownloadUnavailableReason.should.equal(
            FILE_TABLE_MESSAGES.packageDownloadReadDenied,
          );
        });
      });

      it("allows Download All when the inaccessible file is no longer in the package", () => {
        setPackageAppModel();
        const dataPackage = createViewerDataPackage();
        const context = { memberDownloadReadDenied: new Set(["removed.1"]) };

        MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
        );

        context.packageDownloadUrl.should.equal("https://cn.test/package/rm.1");
        context.packageDownloadUnavailableReason.should.equal("");
      });

      it("clears a stale URL without a Resource Map PID", () => {
        const dataPackage = createViewerDataPackage({
          rootResourceMapPid: null,
        });
        setPackageAppModel();
        const context = {
          packageDownloadUrl: "stale URL",
        };

        MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
        );

        context.packageDownloadUrl.should.equal("");
      });

      it("explains why Download All is disabled when the package is too large", () => {
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
        setPackageAppModel({ maxDownloadSize: 100 });
        const context = {
          packageDownloadUrl: "",
        };

        MetadataView.prototype.confirmPackageDownloadAll.call(
          context,
          dataPackage,
        );

        expect(context.packageDownloadUrl).to.equal("");
        const rows = MetadataView.prototype.getFileTableRows.call({
          ...context,
          dataPackage,
        });
        const root = rows.find((row) => row.id === "dataset:rm.1");
        root.actions.should.have.length(1);
        root.actions[0].should.include({
          id: "download",
          isDisabled: true,
          title: FILE_TABLE_MESSAGES.packageDownloadTooLarge,
        });
      });

      [
        { size: undefined, allowed: true },
        { size: 60, allowed: true },
        { size: 101, allowed: false },
      ].forEach(({ size, allowed }) => {
        it(`${allowed ? "allows" : "blocks"} Download All with ${size ?? "no"} known bytes and another file of unknown size`, () => {
          const dataPackage = createViewerDataPackage({
            members: [
              {
                pid: "rm.1",
                formatType: "RESOURCE",
                formatId: RESOURCE_MAP_FORMAT_ID,
              },
              { pid: "data.1", formatType: "DATA", fileName: "data.csv", size },
              { pid: "data.2", formatType: "DATA", fileName: "unknown.csv" },
            ],
          });
          setPackageAppModel({
            maxDownloadSize: 100,
            maxViewerPackageMembers: 1,
          });
          const context = { dataPackage };

          MetadataView.prototype.confirmPackageDownloadAll.call(
            context,
            dataPackage,
          );
          const root = MetadataView.prototype.getFileTableRows
            .call(context)
            .find((row) => row.id === "dataset:rm.1");

          root.actions.should.have.length(1);
          root.actions[0].isDisabled.should.equal(!allowed);
          context.packageDownloadUrl.should.equal(
            allowed ? "https://cn.test/package/rm.1" : "",
          );
          context.packageDownloadUnavailableReason.should.equal(
            allowed ? "" : FILE_TABLE_MESSAGES.packageDownloadTooLarge,
          );
        });
      });
    });

    describe("downloadFileTableRow()", () => {
      it("downloads signed-in packages through PackageService", async () => {
        const blob = new Blob(["package"]);
        const { actionModel, context, packageService, row } =
          createPackageDownloadContext({
            result: blob,
          });
        const open = sandbox.stub(window, "open");
        const createObjectURL = sandbox
          .stub(window.URL, "createObjectURL")
          .returns("blob:package");
        const revokeObjectURL = sandbox.stub(window.URL, "revokeObjectURL");
        const click = sandbox.stub(HTMLAnchorElement.prototype, "click");

        const downloaded =
          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            row,
            actionModel,
          );

        downloaded.should.equal(true);
        sinon.assert.calledOnceWithExactly(packageService.download, "rm.1");
        sinon.assert.notCalled(open);
        sinon.assert.calledOnceWithExactly(createObjectURL, blob);
        click.firstCall.thisValue.download.should.equal("Dataset title.zip");
        sinon.assert.calledOnceWithExactly(revokeObjectURL, "blob:package");
      });

      it("waits for pending authentication before choosing a package path", async () => {
        const { actionModel, context, packageService, row, userModel } =
          createPackageDownloadContext({
            checked: false,
            loggedIn: false,
          });
        const open = sandbox.stub(window, "open");
        sandbox.stub(window.URL, "createObjectURL").returns("blob:package");
        sandbox.stub(window.URL, "revokeObjectURL");
        sandbox.stub(HTMLAnchorElement.prototype, "click");

        const download = MetadataView.prototype.downloadFileTableRow.call(
          context,
          row,
          actionModel,
        );

        sinon.assert.notCalled(open);
        sinon.assert.notCalled(packageService.download);

        userModel.set({ checked: true, loggedIn: true });
        (await download).should.equal(true);

        sinon.assert.calledOnceWithExactly(packageService.download, "rm.1");
        sinon.assert.notCalled(open);
      });

      it("keeps one authenticated package generation in flight", async () => {
        const response = deferred();
        const { actionModel, context, packageService, row } =
          createPackageDownloadContext();
        packageService.download.resetBehavior();
        packageService.download.returns(response.promise);
        sandbox.stub(window.URL, "createObjectURL").returns("blob:package");
        sandbox.stub(window.URL, "revokeObjectURL");
        sandbox.stub(HTMLAnchorElement.prototype, "click");

        const firstDownload = MetadataView.prototype.downloadFileTableRow.call(
          context,
          row,
          actionModel,
        );
        const duplicate = MetadataView.prototype.downloadFileTableRow.call(
          context,
          row,
          actionModel,
        );

        try {
          actionModel.toRenderData().isDisabled.should.equal(true);
          actionModel.toRenderData().label.should.equal("Downloading...");
          sinon.assert.calledOnce(packageService.download);
          context.fileTableView.viewModel.mergeRows(context.getFileTableRows());
          const refreshedAction = context.fileTableView.viewModel
            .getRows()
            .get("dataset:rm.1")
            .getActions()
            .get("download")
            .toRenderData();
          refreshedAction.isDisabled.should.equal(true);
          refreshedAction.label.should.equal("Downloading...");

          response.resolve(new Blob(["package"]));
          (await firstDownload).should.equal(true);
          (await duplicate).should.equal(false);

          actionModel.toRenderData().isDisabled.should.equal(false);
          actionModel.toRenderData().label.should.equal("Download All");
        } finally {
          response.resolve(new Blob(["package"]));
          await Promise.allSettled([firstDownload, duplicate]);
        }
      });

      [401, 403].forEach((status) => {
        it(`disables package downloads after a ${status} response`, async () => {
          const error = Object.assign(new Error("access denied"), { status });
          const { actionModel, context, packageService, row } =
            createPackageDownloadContext();
          packageService.download.rejects(error);

          const downloaded =
            await MetadataView.prototype.downloadFileTableRow.call(
              context,
              row,
              actionModel,
            );

          downloaded.should.equal(false);
          actionModel.toRenderData().isDisabled.should.equal(true);
          actionModel.toRenderData().label.should.equal("Download All");
          actionModel
            .get("title")
            .should.equal(FILE_TABLE_MESSAGES.packageDownloadReadDenied);
          context.packageDownloadUnavailableReason.should.equal(
            FILE_TABLE_MESSAGES.packageDownloadReadDenied,
          );
          context.fileTableView.viewModel.mergeRows(context.getFileTableRows());
          const refreshedAction = context.fileTableView.viewModel
            .getRows()
            .get("dataset:rm.1")
            .getActions()
            .get("download")
            .toRenderData();
          refreshedAction.isDisabled.should.equal(true);
          refreshedAction.title.should.equal(
            FILE_TABLE_MESSAGES.packageDownloadReadDenied,
          );
          sinon.assert.notCalled(context.showViewAlert);
        });
      });

      it("opens the BagIt URL directly for signed-out users", async () => {
        const { actionModel, context, packageService, row } =
          createPackageDownloadContext({ loggedIn: false });
        const open = sandbox.stub(window, "open");

        const downloaded =
          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            row,
            actionModel,
          );

        downloaded.should.equal(true);
        sinon.assert.calledOnceWithExactly(
          open,
          "https://cn.test/package/rm.1",
          "_blank",
        );
        sinon.assert.notCalled(packageService.download);
        actionModel.toRenderData().isDisabled.should.equal(false);
      });

      it("keeps a denied nested package download disabled across refreshes", async () => {
        const { context, packageService } = createPackageDownloadContext();
        context.dataPackage.members.add({
          pid: "nested.rm",
          formatType: "RESOURCE",
          formatId: RESOURCE_MAP_FORMAT_ID,
        });
        context.fileTableView.viewModel.mergeRows(context.getFileTableRows());
        const rows = context.fileTableView.viewModel.getRows();
        const nestedRow = rows.get("nested.rm");
        const nestedAction = nestedRow.getActions().get("download");
        packageService.download.rejects(
          Object.assign(new Error("denied"), { status: 403 }),
        );

        const downloaded =
          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            nestedRow,
            nestedAction,
          );

        downloaded.should.equal(false);
        nestedAction.isEnabled().should.equal(false);
        nestedAction
          .get("title")
          .should.equal(FILE_TABLE_MESSAGES.packageDownloadReadDenied);
        nestedAction.set("title", "Changed tooltip");
        context.confirmPackageDownloadAll(context.dataPackage);
        context.fileTableView.viewModel.mergeRows(context.getFileTableRows());
        nestedAction.isEnabled().should.equal(false);
        rows
          .get("dataset:rm.1")
          .getActions()
          .get("download")
          .isEnabled()
          .should.equal(false);
        (
          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            nestedRow,
            nestedAction,
          )
        ).should.equal(false);
        sinon.assert.calledOnceWithExactly(
          packageService.download,
          "nested.rm",
        );
      });

      [
        ["", "rm.1.zip"],
        ["Dataset title.zip", "Dataset title.zip"],
      ].forEach(([title, filename]) => {
        it(`saves title ${JSON.stringify(title)} as ${filename}`, async () => {
          const { actionModel, context, row } = createPackageDownloadContext({
            title,
          });
          sandbox.stub(window.URL, "createObjectURL").returns("blob:package");
          sandbox.stub(window.URL, "revokeObjectURL");
          const click = sandbox.stub(HTMLAnchorElement.prototype, "click");

          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            row,
            actionModel,
          );

          click.firstCall.thisValue.download.should.equal(filename);
        });
      });

      it("revokes the object URL when saving the Blob fails", async () => {
        const { actionModel, context, row } = createPackageDownloadContext();
        sandbox.stub(window.URL, "createObjectURL").returns("blob:package");
        const revokeObjectURL = sandbox.stub(window.URL, "revokeObjectURL");
        const saveError = new Error("save failed");
        sandbox.stub(HTMLAnchorElement.prototype, "click").throws(saveError);

        const receivedError = await MetadataView.prototype.downloadFileTableRow
          .call(context, row, actionModel)
          .then(
            () => new Error("expected download to reject"),
            (error) => error,
          );

        receivedError.should.equal(saveError);
        sinon.assert.calledOnceWithExactly(revokeObjectURL, "blob:package");
      });

      it("does not apply a late access denial to a replacement view", async () => {
        const response = deferred();
        const { actionModel, context, packageService, row } =
          createPackageDownloadContext();
        packageService.download.resetBehavior();
        packageService.download.returns(response.promise);
        const download = MetadataView.prototype.downloadFileTableRow.call(
          context,
          row,
          actionModel,
        );
        context.dataPackage = createViewerDataPackage();
        context.fileTableView = {};
        context.memberDownloadReadDenied = new Set();
        context.packageDownloadReadDenied = false;
        context.packageDownloadUnavailableReason = "";

        response.reject(Object.assign(new Error("denied"), { status: 403 }));
        (await download).should.equal(false);

        context.packageDownloadUnavailableReason.should.equal("");
      });

      it("shows retryable package failures and restores Download All", async () => {
        const error = Object.assign(new Error("service unavailable"), {
          status: 503,
        });
        const { actionModel, context, packageService, row } =
          createPackageDownloadContext();
        packageService.download.rejects(error);

        const downloaded =
          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            row,
            actionModel,
          );

        downloaded.should.equal(false);
        actionModel.toRenderData().isDisabled.should.equal(false);
        actionModel.toRenderData().label.should.equal("Download All");
        assertDownloadFailureAlert(context.showViewAlert);
      });

      it("uses repository URLs for indexed-public files", async () => {
        setPackageAppModel({ objectServiceUrl: "https://mn.test/object/" });
        const memberUrl = "https://mn.test/object/public.1";
        const resolverUrl = "https://cn.test/resolve/public.1";
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            {
              pid: "public.1",
              formatType: "DATA",
              fileName: "large.csv",
              isPublic: true,
              viewServiceEntity: { objectUrl: resolverUrl },
            },
          ],
        });
        const row = new Backbone.Model({
          id: "public.1",
          kind: "data",
          downloadUrl: resolverUrl,
        });
        row.getDisplayLabel = () => "large.csv";
        const actionModel = new FileItemActionViewModel({ label: "Download" });
        const context = {
          dataPackage,
          createDataDetailsModel: MetadataView.prototype.createDataDetailsModel,
        };
        const open = sandbox.stub(window, "open");

        const downloaded =
          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            row,
            actionModel,
          );

        downloaded.should.equal(true);
        sinon.assert.calledOnceWithExactly(open, memberUrl, "_blank");
        actionModel.isEnabled().should.equal(true);
      });

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
          packageDownloadUrl: "",
          memberDownloadReadDenied: new Set(),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          confirmPackageDownloadAll:
            MetadataView.prototype.confirmPackageDownloadAll,
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
          getDownloadAction().toRenderData().isDisabled.should.equal(true);
          getDownloadAction()
            .toRenderData()
            .label.should.equal("Downloading...");

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
          getDownloadAction().toRenderData().isDisabled.should.equal(false);
        } finally {
          resolveDownload?.();
          await firstDownload;
        }
      });

      it("shows rejected member downloads and restores the action", async () => {
        setPackageAppModel();
        const dataPackage = createViewerDataPackage();
        const downloadError = Object.assign(new Error("download failed"), {
          status: 503,
        });
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
          packageDownloadUrl: "",
          memberDownloadReadDenied: new Set(),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          confirmPackageDownloadAll:
            MetadataView.prototype.confirmPackageDownloadAll,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          createDataDetailsModel: sandbox.stub().returns(downloadModel),
          scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
          showViewAlert: sandbox.stub(),
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
        try {
          await MetadataView.prototype.mergeCurrentFileTableRows.call(
            context,
            dataPackage,
            fileTableView,
            { renderId: "render-test" },
          );

          getDownloadAction().toRenderData().isDisabled.should.equal(true);
          rejectDownload(downloadError);
          const downloaded = await download;

          downloaded.should.equal(false);
          getDownloadAction().toRenderData().isDisabled.should.equal(false);
          assertDownloadFailureAlert(context.showViewAlert);
        } finally {
          rejectDownload?.(downloadError);
          await Promise.allSettled([download]);
        }
      });

      it("disables Download All after an active member download is denied", async () => {
        setPackageAppModel();
        const dataPackage = createViewerDataPackage();
        const member = dataPackage.getMember("data.1");
        const downloadModel = new Backbone.Model({
          url: "https://cn.test/resolve/data.1",
        });
        downloadModel.downloadWithCredentials = sandbox.stub().callsFake(() => {
          downloadModel.trigger(
            "downloadError",
            Object.assign(new Error("denied"), { status: 403 }),
          );
        });
        const context = withRenderContext({
          dataPackage,
          packageDownloadUrl: "",
          packageDownloadUnavailableReason: "",
          memberDownloadReadDenied: new Set(),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          confirmPackageDownloadAll:
            MetadataView.prototype.confirmPackageDownloadAll,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          createDataDetailsModel: sandbox.stub().returns(downloadModel),
          scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
        });
        context.confirmPackageDownloadAll(dataPackage);
        context.fileTableView = {
          viewModel: new FileTableViewModel({
            rows: context.getFileTableRows(),
          }),
        };
        const rows = context.fileTableView.viewModel.getRows();
        const memberRow = rows.get("data.1");
        const memberAction = memberRow
          .getActions()
          .findWhere({ id: "download" });

        const downloaded =
          await MetadataView.prototype.downloadFileTableRow.call(
            context,
            memberRow,
            memberAction,
          );

        downloaded.should.equal(false);
        expect(member.sysMetaReadDenied).to.not.equal(true);
        const rootAction = rows
          .get("dataset:rm.1")
          .getActions()
          .findWhere({ id: "download" });
        rootAction.get("isDisabled").should.equal(true);
        rootAction
          .get("title")
          .should.equal(FILE_TABLE_MESSAGES.packageDownloadReadDenied);
      });

      it("does not apply a late member denial to a replacement view", async () => {
        setPackageAppModel();
        const response = deferred();
        const dataPackage = createViewerDataPackage();
        const downloadModel = new Backbone.Model({
          url: "https://cn.test/resolve/data.1",
        });
        downloadModel.downloadWithCredentials = sandbox
          .stub()
          .callsFake(() => response.promise);
        const oldFileTableView = {
          viewModel: { mergeRows: sandbox.stub() },
        };
        const context = withRenderContext({
          dataPackage,
          fileTableView: oldFileTableView,
          packageDownloadUrl: "https://cn.test/package/rm.1",
          packageDownloadUnavailableReason: "",
          memberDownloadReadDenied: new Set(),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          confirmPackageDownloadAll:
            MetadataView.prototype.confirmPackageDownloadAll,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          createDataDetailsModel: sandbox.stub().returns(downloadModel),
          scheduleFileTableScrollIndicatorUpdate: sandbox.stub(),
        });
        const row = new Backbone.Model({
          id: "data.1",
          kind: "data",
          downloadUrl: "https://cn.test/resolve/data.1",
        });
        row.getDisplayLabel = () => "data.csv";
        const actionModel = new FileItemActionViewModel({ label: "Download" });
        const download = MetadataView.prototype.downloadFileTableRow.call(
          context,
          row,
          actionModel,
        );
        context.dataPackage = createViewerDataPackage();
        context.fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        context.memberDownloadReadDenied = new Set();
        context.packageDownloadReadDenied = false;

        downloadModel.trigger(
          "downloadError",
          Object.assign(new Error("denied"), { status: 403 }),
        );
        response.resolve();
        (await download).should.equal(false);

        context.packageDownloadUnavailableReason.should.equal("");
        sinon.assert.notCalled(oldFileTableView.viewModel.mergeRows);
      });

      it("uses the file table download URL when the member model has none", async () => {
        const row = new Backbone.Model({
          id: "data.1",
          kind: "data",
          downloadUrl: "https://cn.test/resolve/data.1",
        });
        row.getDisplayLabel = () => "data.csv";
        const actionModel = new FileItemActionViewModel({ label: "Download" });
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

        actionModel.isEnabled().should.equal(true);
      });
    });

    describe("getFileListingNotice()", () => {
      it("discloses limited details without claiming members were omitted", () => {
        setPackageAppModel({ maxViewerPackageMembers: 2 });
        const context = {
          fileTableDetailsLimited: true,
          fileTableMemberCount: 2,
        };

        const notice = MetadataView.prototype.getFileListingNotice.call(
          context,
          null,
        );

        notice.noticeMessage.should.equal(
          "Some file details may be unavailable.",
        );
      });

      it("composes member truncation with the recovery notice and action", () => {
        setPackageAppModel({ maxViewerPackageMembers: 2 });
        const context = {
          dataPackage: { resourceManifestIsFetched: true },
          fileTableDetailsLimited: true,
          fileTableMemberCount: 4,
        };

        const notice = MetadataView.prototype.getFileListingNotice.call(
          context,
          "recoverableLimitedListing",
        );

        notice.noticeMessage.should.equal(
          "Additional files may appear once processing is complete. Showing the first 2 of 4 files. Some file details may be unavailable.",
        );
        notice.noticeActionId.should.equal("finish-interrupted-save");
        notice.noticeActionLabel.should.equal("Finish interrupted save");
      });

      it("does not present index-only fallback membership as an exact total", () => {
        const dataPackage = createViewerDataPackage({
          members: [
            {
              pid: "rm.1",
              formatType: "RESOURCE",
              formatId: RESOURCE_MAP_FORMAT_ID,
            },
            { pid: "meta.1", formatType: "METADATA", title: "EML" },
            { pid: "data.1", formatType: "DATA", fileName: "first.csv" },
            { pid: "data.2", formatType: "DATA", fileName: "second.csv" },
          ],
        });
        setPackageAppModel({ maxViewerPackageMembers: 2 });
        const context = {
          dataPackage,
          fileTableDetailsLimited: true,
          fileTableMetricsByPid: null,
          metricsModel: null,
          packageDownloadUrl: "",
        };

        MetadataView.prototype.getFileTableRows.call(context);
        const notice = MetadataView.prototype.getFileListingNotice.call(
          context,
          "serverUnavailable",
        );

        notice.noticeMessage.should.equal(
          "Some package details could not be loaded. The file list below may be incomplete. Some file details may be unavailable.",
        );
        context.fileTableMemberCount.should.equal(3);
      });
    });

    describe("insertPackageTable()", () => {
      it("shows the authoritative count and exact limited-subset notice", async () => {
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
        dataPackage.resourceManifestIsFetched = true;
        setPackageAppModel({ maxViewerPackageMembers: 2 });
        const context = withRenderContext({
          el,
          dataPackage,
          fileTableDetailsLimited: true,
          tableContainer: "#table-container",
          subviews: [],
          packageDownloadUrl: "",
          getFileTableRows: MetadataView.prototype.getFileTableRows,
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
          .should.equal("3 files in this dataset");
        context.fileTableView.viewModel
          .get("subtitle")
          .should.equal("Package: rm.1");
        context.fileTableView.viewModel
          .get("noticeMessage")
          .should.equal(
            "Showing the first 2 of 3 files. Some file details may be unavailable.",
          );
        context.fileTableView.viewModel
          .getRows()
          .pluck("id")
          .should.deep.equal(["dataset:rm.1", "meta.1", "nested.rm"]);
        context.teardownFileTableScrollIndicators();
        context.fileTableView.remove();
      });

      it("offers Download All without member access evidence", async () => {
        const el = document.createElement("div");
        el.innerHTML = `
          <div id="table-container"></div>
          <div id="data-package-container"><div class="loading"></div></div>
        `;
        const dataPackage = createViewerDataPackage();
        const mergeRows = sandbox.spy(
          FileTableViewModel.prototype,
          "mergeRows",
        );
        setPackageAppModel();
        const view = new MetadataView({ el });
        view.renderId = "render-test";
        view.dataPackage = dataPackage;
        view.model = {
          get: sandbox.stub().withArgs("title").returns("Dataset"),
        };
        view.subviews = [];
        sandbox.stub(view, "setupFileTableScrollIndicators");
        sandbox.stub(view, "loadNestedPackageTitles");
        sandbox.stub(view, "enrichFileTableMemberDetails");
        sandbox.stub(view, "loadFileTableMetrics");

        await view.insertPackageTable(null, { renderId: "render-test" });

        const rootRow = view.fileTableView.viewModel
          .getRows()
          .get("dataset:rm.1");
        const downloadAction = rootRow.getActions().get("download");
        downloadAction.toJSON().should.include({
          label: "Download All",
          title: "Download all files in EML",
          ariaLabel: "Download all files in EML",
        });
        sinon.assert.notCalled(mergeRows);

        view.fileTableView.remove();
        view.remove();
      });
    });

    describe("checkProvenanceWritePermission()", () => {
      const stubLatestResourceMap = (dataPackage, result) => {
        const getLatestVersions = sandbox.stub();
        if (result instanceof Error) {
          getLatestVersions.rejects(result);
        } else {
          getLatestVersions.resolves([result]);
        }
        dataPackage.versionTracker = { getLatestVersions };
        return getLatestVersions;
      };

      it("allows provenance editing when the resource map is writable and not archived", async () => {
        const dataPackage = createViewerDataPackage();
        stubLatestResourceMap(dataPackage, "rm.1");
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

      it("disables provenance editing for an obsolete Resource Map", async () => {
        const dataPackage = createViewerDataPackage();
        stubLatestResourceMap(dataPackage, "rm.2");
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

        result.should.equal(false);
        context.canEditProvenance.should.equal(false);
      });

      it("disables provenance editing when currentness cannot be confirmed", async () => {
        const dataPackage = createViewerDataPackage();
        stubLatestResourceMap(dataPackage, new Error("version lookup failed"));
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

        result.should.equal(false);
        context.canEditProvenance.should.equal(false);
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
        const getLatestResourceMap = stubLatestResourceMap(dataPackage, "rm.1");
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
        sinon.assert.notCalled(getLatestResourceMap);
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
          enhanceWithPackage: sandbox.stub(),
        };
        const context = withRenderContext({
          dataPackage,
          metadata,
          metadataView,
          fileTableView: null,
          subviews: [],
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
          sinon.assert.calledOnceWithExactly(metadataView.enhanceWithPackage, {
            editModeOn: false,
          });
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
          enhanceWithPackage: sandbox.stub(),
        };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          metadataView,
          subviews: [],
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
          enhanceWithPackage: sandbox.stub(),
        };
        const context = withRenderContext({
          dataPackage: {},
          fileTableView: null,
          metadataView,
          subviews: [],
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
      it("reuses one request per PID and ignores a replaced response", async () => {
        setPackageAppModel({ viewServiceUrl: "https://view.test/" });
        const dataPackage = createViewerDataPackage({
          members: [
            { pid: "meta.1", formatType: "METADATA", title: "First" },
            { pid: "meta.2", formatType: "METADATA", title: "Second" },
          ],
          rootResourceMapPid: null,
        });
        const firstRender = deferred();
        const secondRender = deferred();
        const documentRender = sandbox.stub(
          MetadataDocumentView.prototype,
          "render",
        );
        documentRender.onFirstCall().returns(firstRender.promise);
        documentRender.onSecondCall().returns(secondRender.promise);
        const view = new MetadataView({ el: document.createElement("div") });
        view.renderId = "render-test";
        view.dataPackage = dataPackage;
        view.subviews = [];
        sandbox.stub(view, "prepareCitationModel");
        sandbox.stub(view, "insertCitation");
        sandbox.stub(view, "getDataMemberIsPublic").resolves(false);
        sandbox.stub(view, "renderMetadataShell").callsFake(() => {
          if (!view.metadataContainer) {
            view.el.innerHTML = '<div id="metadata-container"></div>';
            view.metadataContainer = view.el.firstElementChild;
          } else {
            view.metadataContainer.textContent = "loading";
          }
        });
        const firstMetadata = dataPackage.getMember("meta.1");
        const secondMetadata = dataPackage.getMember("meta.2");

        const firstPromise = view.startMetadataRender(firstMetadata, {
          renderId: "render-test",
        });
        const firstController = view.metadataAbortController;
        const repeatedPromise = view.startMetadataRender(firstMetadata, {
          renderId: "render-test",
        });
        repeatedPromise.should.equal(firstPromise);
        documentRender.calledOnce.should.equal(true);

        const secondPromise = view.startMetadataRender(secondMetadata, {
          renderId: "render-test",
        });
        firstController.signal.aborted.should.equal(true);
        documentRender.calledTwice.should.equal(true);
        const firstView = documentRender.thisValues[0];
        const secondView = documentRender.thisValues[1];

        secondRender.resolve(secondView);
        await secondPromise;
        view.metadataContainer.firstElementChild.should.equal(secondView.el);

        firstRender.resolve(firstView);
        await firstPromise;
        view.metadataContainer.firstElementChild.should.equal(secondView.el);
        view.closeMetadataView();
      });

      const renderWithPermissions = async ({ canWrite, canEditProvenance }) => {
        setPackageAppModel({ viewServiceUrl: "https://view.test/" });
        const dataPackage = new DataPackage();
        const metadata = {
          pid: "meta.1",
          toJSON: sandbox.stub().returns({}),
        };
        const context = withRenderContext({
          canWrite,
          canEditProvenance,
          dataPackage,
          metadata,
          prepareCitationModel: sandbox.stub(),
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
          prepareCitationModel: sandbox.stub(),
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

      it("accepts a placeholder whose loaded System Metadata has no file name", () => {
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
              isPlaceHolder_b: true,
              sysMeta: { identifier: "data.1", formatId: "text/csv", size: 12 },
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

      it("does not refresh unresolved members when limited details have a complete header", () => {
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
          fileTableDetailsLimited: true,
          metadataHeaderNeedsIndexRefresh:
            MetadataView.prototype.metadataHeaderNeedsIndexRefresh,
        };

        MetadataView.prototype.packageNeedsIndexRefresh
          .call(context, dataPackage)
          .should.equal(false);
      });

      it("ignores resource maps, confirmed missing members, and denied reads", () => {
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
            {
              pid: "denied.1",
              formatType: "DATA",
              isPlaceHolder_b: true,
              sysMetaReadDenied: true,
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
      it("skips bulk enrichment but delegates limited refresh work", async () => {
        const enrichMembers = sandbox
          .stub(DataPackageFileTableAdapter, "enrichMembers")
          .resolves({ changed: false });
        const context = withRenderContext({
          dataPackage: {},
          fileTableView: { viewModel: { mergeRows: sandbox.stub() } },
          fileTableDetailsLimited: true,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          refreshMetadataHeaderFromPackage: sandbox.stub(),
          confirmPackageDownloadAll: sandbox.stub(),
          scheduleFileTableIndexRefresh: sandbox.stub(),
        });

        await MetadataView.prototype.enrichFileTableMemberDetails.call(context);

        sinon.assert.notCalled(enrichMembers);
        sinon.assert.calledOnceWithExactly(
          context.scheduleFileTableIndexRefresh,
          context.dataPackage,
          context.fileTableView,
          { renderId: "render-test", signal: undefined },
        );
      });

      it("merges updated rows and schedules one index refresh after enrichment", async () => {
        const dataPackage = {};
        const enrichMembers = sandbox
          .stub(DataPackageFileTableAdapter, "enrichMembers")
          .resolves({
            attemptedPids: ["data.1"],
            fetchedPids: ["data.1"],
            changed: true,
          });
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          refreshMetadataHeaderFromPackage: sandbox.stub().returns(true),
          confirmPackageDownloadAll: sandbox.stub(),
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
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

      it("disables Download All when enrichment discovers denied access", async () => {
        const dataPackage = createViewerDataPackage();
        dataPackage
          .toArray()
          .forEach((member) => member.addSources(["resourceMap"]));
        sandbox.stub(dataPackage, "fetchSysMeta").resolves([
          {
            pid: "data.1",
            error: Object.assign(new Error("denied"), { status: 403 }),
          },
        ]);
        setPackageAppModel();
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          fileTableDetailsLimited: false,
          fileTableMetricsByPid: null,
          metricsModel: null,
          packageDownloadUrl: "",
          packageDownloadUnavailableReason: "",
          memberDownloadReadDenied: new Set(),
          getFileTableRows: MetadataView.prototype.getFileTableRows,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          refreshMetadataHeaderFromPackage: sandbox.stub(),
          confirmPackageDownloadAll:
            MetadataView.prototype.confirmPackageDownloadAll,
          mergeCurrentFileTableRows: sandbox.stub().callsFake(async () => {
            fileTableView.viewModel.mergeRows(context.getFileTableRows());
            return true;
          }),
          scheduleFileTableIndexRefresh: sandbox.stub(),
        });
        context.confirmPackageDownloadAll(dataPackage);

        await MetadataView.prototype.enrichFileTableMemberDetails.call(context);

        const rootAction = fileTableView.viewModel.mergeRows.firstCall.args[0]
          .find((row) => row.id === "dataset:rm.1")
          .actions.find((action) => action.id === "download");
        rootAction.isDisabled.should.equal(true);
        rootAction.title.should.equal(
          FILE_TABLE_MESSAGES.packageDownloadReadDenied,
        );
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
          changed: false,
        });
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          refreshMetadataHeaderFromPackage: sandbox.stub().returns(true),
          confirmPackageDownloadAll: sandbox.stub(),
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
          scheduleFileTableIndexRefresh: sandbox.stub(),
        });

        await MetadataView.prototype.enrichFileTableMemberDetails.call(context);

        context.mergeCurrentFileTableRows.called.should.equal(false);
        context.scheduleFileTableIndexRefresh.calledOnce.should.equal(true);
      });
    });

    describe("scheduleFileTableIndexRefresh()", () => {
      it("refreshes a limited metadata header without loading the package manifest", async () => {
        const clock = sandbox.useFakeTimers();
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
        const refreshMetadataTitleFromIndex = sandbox.stub().callsFake(() => {
          dataPackage.getMember("meta.1").title = "Dataset";
          return true;
        });
        const context = withRenderContext({
          dataPackage,
          fileTableView: { viewModel: { mergeRows: sandbox.stub() } },
          fileTableDetailsLimited: true,
          fileTableIndexRefreshTimer: null,
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          metadataHeaderNeedsIndexRefresh:
            MetadataView.prototype.metadataHeaderNeedsIndexRefresh,
          packageNeedsIndexRefresh:
            MetadataView.prototype.packageNeedsIndexRefresh,
          refreshMetadataTitleFromIndex,
          refreshMetadataHeaderFromPackage: sandbox.stub(),
          confirmPackageDownloadAll: sandbox.stub(),
          mergeCurrentFileTableRows: sandbox.stub().resolves(true),
          scheduleFileTableIndexRefresh:
            MetadataView.prototype.scheduleFileTableIndexRefresh,
        });
        dataPackage.getManifestFromIndex = sandbox.stub();

        context.scheduleFileTableIndexRefresh(
          dataPackage,
          context.fileTableView,
        );
        await clock.runAllAsync();

        sinon.assert.calledOnce(refreshMetadataTitleFromIndex);
        sinon.assert.notCalled(dataPackage.getManifestFromIndex);
        sinon.assert.calledOnce(context.mergeCurrentFileTableRows);
        expect(context.fileTableIndexRefreshTimer).to.equal(null);
      });

      describe("file table updates after enrichment", () => {
        let clock;
        let dataPackage;
        let fileTableView;
        let context;

        beforeEach(() => {
          clock = sandbox.useFakeTimers();
          dataPackage = createViewerDataPackage();
          dataPackage
            .toArray()
            .forEach((member) => member.addSources(["resourceMap"]));
          dataPackage.resourceManifestIsFetched = true;
          dataPackage.indexManifestTotal = 2;
          dataPackage.getMember("meta.1").addSources(["index"]);
          sandbox
            .stub(dataPackage, "getManifestFromIndex")
            .callsFake(async () => {
              dataPackage.getMember("data.1").addSources(["index"]);
            });
          setPackageAppModel();
          fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
          context = withRenderContext({
            dataPackage,
            fileTableView,
            isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
            isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
            refreshMetadataTitleFromIndex: sandbox.stub().resolves(),
            refreshMetadataHeaderFromPackage: sandbox.stub(),
            confirmPackageDownloadAll:
              MetadataView.prototype.confirmPackageDownloadAll,
            mergeCurrentFileTableRows: sandbox.stub().resolves(true),
            packageNeedsIndexRefresh: sandbox.stub().returns(false),
            scheduleFileTableIndexRefresh:
              MetadataView.prototype.scheduleFileTableIndexRefresh,
          });
          context.confirmPackageDownloadAll(dataPackage);
        });

        it("merges System Metadata without waiting for the index", async () => {
          sandbox
            .stub(dataPackage, "fetchSysMeta")
            .callsFake(async (memberPids) => {
              memberPids.should.include("data.1");
              dataPackage.getMember("data.1").sysMeta = {
                identifier: "data.1",
              };
              return [];
            });
          context.mergeCurrentFileTableRows.callsFake(async () => {
            context.packageDownloadUrl.should.equal(
              "https://cn.test/package/rm.1",
            );
            return true;
          });

          await MetadataView.prototype.enrichFileTableMemberDetails.call(
            context,
          );
          await clock.runAllAsync();

          sinon.assert.calledOnce(context.mergeCurrentFileTableRows);
          sinon.assert.notCalled(dataPackage.getManifestFromIndex);
          dataPackage.indexManifestTotal.should.equal(2);
        });

        it("does not schedule a final count check for inaccessible members", async () => {
          dataPackage.getMember("data.1").sysMetaReadDenied = true;
          context.scheduleFileTableIndexRefresh(dataPackage, fileTableView);
          await clock.runAllAsync();

          sinon.assert.notCalled(dataPackage.getManifestFromIndex);
          context.packageDownloadUrl.should.equal(
            "https://cn.test/package/rm.1",
          );
        });

        it("stops after the regular retries without a final count check", async () => {
          context.packageNeedsIndexRefresh.returns(true);
          dataPackage.getManifestFromIndex.callsFake(async () => {});
          context.scheduleFileTableIndexRefresh(dataPackage, fileTableView);
          await clock.runAllAsync();

          dataPackage.getManifestFromIndex.callCount.should.equal(6);
          context.packageDownloadUrl.should.equal(
            "https://cn.test/package/rm.1",
          );
        });

        it("cancels pending polling when the render is aborted", async () => {
          context.packageNeedsIndexRefresh.returns(true);
          context.scheduleFileTableIndexRefresh(dataPackage, fileTableView);
          MetadataView.prototype.abortRender.call(context);
          await clock.runAllAsync();

          sinon.assert.notCalled(dataPackage.getManifestFromIndex);
        });

        it("does not change download state after an in-flight check becomes stale", async () => {
          context.packageNeedsIndexRefresh.returns(true);
          let finishQuery;
          dataPackage.getManifestFromIndex.callsFake(
            () =>
              new Promise((resolve) => {
                finishQuery = () => {
                  dataPackage.getMember("data.1").addSources(["index"]);
                  resolve();
                };
              }),
          );
          context.scheduleFileTableIndexRefresh(dataPackage, fileTableView);
          await clock.tickAsync(2000);
          context.renderId = "new-render";
          finishQuery();
          await clock.tickAsync(0);

          context.packageDownloadUrl.should.equal(
            "https://cn.test/package/rm.1",
          );
          sinon.assert.notCalled(context.mergeCurrentFileTableRows);
        });
      });

      it("polls until the index catches up", async () => {
        const clock = sandbox.useFakeTimers();
        let attempts = 0;
        const dataPackage = {
          rootResourceMapPid: "rm.1",
          members: { getActiveMembers: () => [] },
          getManifestFromIndex: sandbox.stub().callsFake(async () => {
            attempts += 1;
          }),
        };
        setPackageAppModel({ maxViewerPackageMembers: 7 });
        const fileTableView = { viewModel: { mergeRows: sandbox.stub() } };
        const context = withRenderContext({
          dataPackage,
          fileTableView,
          fileTableIndexRefreshTimer: null,
          packageDownloadUrl: "",
          isCurrentDataPackage: MetadataView.prototype.isCurrentDataPackage,
          isCurrentFileTable: MetadataView.prototype.isCurrentFileTable,
          refreshMetadataTitleFromIndex: sandbox.stub().resolves(),
          refreshMetadataHeaderFromPackage: sandbox.stub().returns(true),
          confirmPackageDownloadAll:
            MetadataView.prototype.confirmPackageDownloadAll,
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
        dataPackage.getManifestFromIndex.getCalls().forEach((call) => {
          call.args[0].should.include({
            merge: true,
            onlyExisting: true,
            rows: 7,
          });
        });
        context.refreshMetadataHeaderFromPackage.calledTwice.should.equal(true);
        context.refreshMetadataHeaderFromPackage.firstCall.args[0].should.equal(
          dataPackage,
        );
        context.mergeCurrentFileTableRows.calledTwice.should.equal(true);
        context.packageDownloadUrl.should.equal("https://cn.test/package/rm.1");
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
            getObjectService: () => ({ writeBaseUrl: "https://object.test" }),
            getSysMetaService: () => ({ writeBaseUrl: "https://meta.test" }),
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
          getObjectService: () => ({ writeBaseUrl: "https://object.test" }),
          getSysMetaService: () => ({ writeBaseUrl: "https://meta.test" }),
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
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
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
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
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
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
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
        const metadataController = { abort: sandbox.stub() };
        const context = withRenderContext({
          renderAbortController: previousController,
          metadataAbortController: metadataController,
          fileTableIndexRefreshTimer: null,
          abortRender: MetadataView.prototype.abortRender,
        });

        const result = MetadataView.prototype.startRender.call(context);

        previousController.abort.calledOnce.should.equal(true);
        metadataController.abort.calledOnce.should.equal(true);
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
      it("lists each candidate file list with its upload time at the page level", () => {
        const showError = sandbox.stub();
        sandbox
          .stub(DateUtilities, "toLocalTimestampWithZone")
          .callsFake((value) => `formatted ${value}`);
        const context = {
          stopPackageLoading: sandbox.stub(),
          hideLoading: sandbox.stub(),
          showError,
        };

        MetadataView.prototype.showMultipleResourceMaps.call(
          context,
          {
            candidateResourceMapPids: ["rm.1", "rm.2"],
            candidateResourceMapDates: {
              "rm.1": "2021-02-09T18:15:00.000Z",
              "rm.2": "2021-02-09T18:20:00.000Z",
            },
          },
          { scoped: false },
        );

        showError.calledOnce.should.equal(true);
        const msg = showError.firstCall.args[0];
        msg.should.contain("/view/rm.1");
        msg.should.contain("/view/rm.2");
        msg.should.contain("formatted 2021-02-09T18:15:00.000Z");
        msg.should.contain("formatted 2021-02-09T18:20:00.000Z");
        msg.should.contain("more than one file list");
        msg.should.not.contain("could not determine which is current");
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

      it("notes when a newer Resource Map is inaccessible", async () => {
        const context = withRenderContext({
          resourceMap: { pid: "rm.public" },
          canWrite: false,
          hasRecoverablePackageRecord: sandbox.stub().resolves(false),
        });

        const state = await MetadataView.prototype.resolveFileListingState.call(
          context,
          { newerResourceMapUnavailable: true },
        );

        state.should.equal("newerVersionUnavailable");
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
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
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
          getDataPackageServiceOptions:
            AppModel.prototype.getDataPackageServiceOptions,
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
