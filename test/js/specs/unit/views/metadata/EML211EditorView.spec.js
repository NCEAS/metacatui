define([
  "jquery",
  "backbone",
  "models/dataPackage/DataPackage",
  "models/dataPackage/DataPackageRecovery",
  "models/dataONEServices/SysMetaService",
  "models/fileTable/DataPackageFileTableAdapter",
  "views/EditorView",
  "views/metadata/EML211EditorView",
  "common/Utilities",
], function (
  $,
  Backbone,
  DataPackage,
  DataPackageRecovery,
  SysMetaService,
  DataPackageFileTableAdapter,
  EditorView,
  EML211EditorView,
  Utilities,
) {
  describe("EML211EditorView", function () {
    chai.should();

    let view, model, sandbox, originalMetacatUI;

    beforeEach(function () {
      sandbox = sinon.createSandbox();
      originalMetacatUI = globalThis.MetacatUI;
      // Create a mock model with validation errors
      model = new Backbone.Model();
      model.validationError = {
        title: "Error in title",
        abstract: "Error in abstract",
        methods: {
          methodSteps: "Error in step 1",
        },
      };

      // Instantiate the view with the mock model
      view = new EML211EditorView({ model: model });
      view.renderId = "render-test";

      // Spy on the methods that interact with the DOM
      sandbox.spy(view, "showError");
      sandbox.spy(view, "showLeafErrors");
    });

    afterEach(function () {
      globalThis.MetacatUI = originalMetacatUI;
      sandbox.restore();
    });

    function createRootDataPackage({
      members = [],
      rootResourceMapPid = "resource_map_1",
      sources,
    } = {}) {
      const options = { members };
      if (sources) options.sources = sources;
      const rootDataPackage = new DataPackage(options);
      rootDataPackage.rootResourceMapPid = rootResourceMapPid;
      return rootDataPackage;
    }

    function createEditorRootDataPackage(options = {}) {
      return createRootDataPackage({
        sources: ["editor"],
        members: [
          { pid: "resource_map_1", formatType: "RESOURCE" },
          { pid: "metadata_1", formatType: "METADATA", title: "EML doc" },
          { pid: "data_1", formatType: "DATA", fileName: "data.csv" },
        ],
        ...options,
      });
    }

    function createUploadedCsvRootDataPackage() {
      return createEditorRootDataPackage({
        members: [
          { pid: "resource_map_1", formatType: "RESOURCE" },
          {
            pid: "data.1",
            formatType: "DATA",
            formatId: "text/csv",
            fileName: "data.csv",
            remoteState: "uploaded",
          },
        ],
      });
    }

    it("should log validation errors correctly", function () {
      // Call the showValidation method
      view.showValidation();

      // Assert that showError and showLeafErrors were called with the expected arguments
      sinon.assert.calledWith(view.showError, "methods", "Error in step 1");
      sinon.assert.calledWith(view.showLeafErrors, "methods", {
        methodSteps: "Error in step 1",
      });
      sinon.assert.calledWith(view.showError, "title", "Error in title");
      sinon.assert.calledWith(view.showError, "abstract", "Error in abstract");
    });

    it("maps DataPackage load phases to editor loading text", function () {
      sandbox.stub(view, "updateLoadingText");

      view.updateDataPackageLoadProgress({
        phase: DataPackage.LoadPhases.EDITABLE_METADATA,
      });

      sinon.assert.calledOnceWithExactly(
        view.updateLoadingText,
        "Loading metadata for editing...",
      );
    });

    it("should handle string error messages correctly in showError", function () {
      view.setElement(
        $(
          `<div>
            <div
              class="notification"
              data-category="methodSteps.step1"
            ></div>
            <div id="metadata-container">
              <input data-category="methodSteps.step1">
            </div>
            <div class="side-nav-item" data-category="methodSteps.step1">
              <span class="icon" style="display:none"></span>
            </div>
          </div>`,
        ),
      );
      const onceSpy = sandbox.spy(model, "once");

      // Call the showError method
      view.showError("methodSteps.step1", "Error in step 1");

      view.$(".notification").hasClass("error").should.equal(true);
      view.$(".notification").text().should.equal("Error in step 1");
      view.$("input").hasClass("error").should.equal(true);
      view.$(".side-nav-item").hasClass("error").should.equal(true);
      view.$(".side-nav-item .icon").hasClass("error").should.equal(true);
      sinon.assert.calledWith(
        onceSpy,
        "change:methodSteps.step1",
        view.checkValidity,
        view,
      );
    });

    it("should handle nested error objects correctly in showLeafErrors", function () {
      // Call the showLeafErrors method
      view.showLeafErrors("methodSteps.step2", {
        subStep1: "Error in sub-step 1",
        subStep2: "Error in sub-step 2",
      });

      // Assert that showError was called with the expected arguments
      sinon.assert.calledWith(
        view.showError,
        "methodSteps.step2",
        "Error in sub-step 1",
      );
      sinon.assert.calledWith(
        view.showError,
        "methodSteps.step2",
        "Error in sub-step 2",
      );
    });

    it("clears previous validation markers when the model is valid", function () {
      view.setElement(
        $(
          `<div>
            <div class="notification error" data-category="title">Old error</div>
            <div id="metadata-container">
              <input class="error" data-category="title">
            </div>
            <div class="side-nav-item error" data-category="title">
              <span class="icon error" style="display:block"></span>
            </div>
          </div>`,
        ),
      );
      model.validationError = null;

      view.showValidation();

      view.$(".notification").text().should.equal("");
      view.$("#metadata-container input").hasClass("error").should.equal(false);
      view.$(".side-nav-item").hasClass("error").should.equal(false);
      view.$(".side-nav-item .icon").hasClass("error").should.equal(false);
      view.$(".side-nav-item .icon").is(":visible").should.equal(false);
    });

    it("uses SysMetaService for metadata-not-found sysmeta lookups", async function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "metaServiceUrl") {
              return "https://example.org/meta";
            }
            return null;
          }),
        },
        appUserModel: {
          get: sandbox.stub().returns(null),
          getTokenPromise: sandbox.stub().resolves(null),
        },
      };

      view.pid = "pid.1";
      sandbox.stub(view, "updateLoadingText");
      sandbox.stub(view, "showNotIndexed");
      sandbox.stub(view, "showNotFound");
      const downloadStub = sandbox
        .stub(SysMetaService.prototype, "download")
        .resolves({});

      await view.handleMetadataNotFound();

      sinon.assert.calledOnceWithExactly(downloadStub, "pid.1", {
        signal: undefined,
      });
      sinon.assert.calledOnce(view.showNotIndexed);
      sinon.assert.notCalled(view.showNotFound);
    });

    it("shows not found when SysMetaService lookup fails", async function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "metaServiceUrl") {
              return "https://example.org/meta";
            }
            return null;
          }),
        },
        appUserModel: {
          get: sandbox.stub().returns(null),
          getTokenPromise: sandbox.stub().resolves(null),
        },
      };

      view.pid = "pid.1";
      sandbox.stub(view, "updateLoadingText");
      sandbox.stub(view, "showNotIndexed");
      sandbox.stub(view, "showNotFound");
      sandbox
        .stub(SysMetaService.prototype, "download")
        .rejects(new Error("404"));

      await view.handleMetadataNotFound();

      sinon.assert.notCalled(view.showNotIndexed);
      sinon.assert.calledOnce(view.showNotFound);
    });

    it("hides the EML metadata row while keeping the editor root row stable", function () {
      const rootDataPackage = createEditorRootDataPackage();

      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().returns(""),
        },
        rootDataPackage,
      };
      model.set("title", "Dataset title");

      const firstRows = view.getEditorFileTableRows();
      rootDataPackage.rootResourceMapPid = "resource_map_2";
      const nextRows = view.getEditorFileTableRows();

      firstRows
        .map((row) => row.id)
        .should.deep.equal(["dataset:editor-root", "data_1"]);
      nextRows
        .map((row) => row.id)
        .should.deep.equal(["dataset:editor-root", "data_1"]);
      firstRows[0].pid.should.equal("resource_map_1");
      nextRows[0].pid.should.equal("resource_map_2");
      firstRows[1].parentId.should.equal("dataset:editor-root");
      nextRows[1].parentId.should.equal("dataset:editor-root");
    });

    it("keeps an editor member PID distinct from the dataset root row", function () {
      const memberPid = "dataset:editor-root";
      const rootDataPackage = createEditorRootDataPackage({
        members: [
          { pid: "resource_map_1", formatType: "RESOURCE" },
          { pid: "metadata_1", formatType: "METADATA", title: "EML doc" },
          { pid: memberPid, formatType: "DATA", fileName: "data.csv" },
        ],
      });

      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: { get: sandbox.stub().returns("") },
        rootDataPackage,
      };
      model.set("title", "Dataset title");

      const rows = view.getEditorFileTableRows();
      const rootRow = rows.find((row) => row.className === "root-dataset");
      const memberRow = rows.find((row) => row.id === memberPid);

      new Set(rows.map((row) => row.id)).size.should.equal(rows.length);
      rootRow.id.should.equal("dataset:editor-root:1");
      memberRow.id.should.equal(memberPid);
      memberRow.parentId.should.equal(rootRow.id);
    });

    it("uses the legacy untitled label for new editor package rows", function () {
      const rootDataPackage = createRootDataPackage({
        members: [
          { pid: "resource_map_1", formatType: "RESOURCE" },
          { pid: "metadata_1", formatType: "METADATA" },
        ],
      });

      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().returns(""),
        },
        rootDataPackage,
      };
      model.set({ id: "metadata_1", title: [] });
      model.isNew = sandbox.stub().returns(true);

      const rows = view.getEditorFileTableRows();

      rows.length.should.equal(1);
      rows[0].label.should.equal("Untitled dataset");
      rows[0].isRenamable.should.equal(true);
    });

    it("renders the untitled label in the new-package citation", function () {
      view.setElement($('<div><div id="citation-container"></div></div>'));
      model.set({ id: "metadata_1", title: [] });
      model.isNew = sandbox.stub().returns(true);

      view.renderCitationHeader(model);

      view
        .$("#citation-container .title")
        .text()
        .should.equal("Untitled dataset");
    });

    it("renders the legacy start prompt for new packages with no files", function () {
      const rows = new Backbone.Collection([
        new Backbone.Model({
          id: "dataset:resource_map_1",
          className: "root-dataset",
        }),
      ]);
      const table = $("<table><tbody></tbody></table>");
      model.isNew = sandbox.stub().returns(true);
      view.fileTableView = {
        viewModel: {
          getRows: () => rows,
          getColumnCount: () => 7,
        },
        $: (selector) => table.find(selector),
      };

      view.renderFileTableStartMessage();

      table
        .find(".message-row h2")
        .text()
        .should.equal("Add files to start your dataset");
      table.find(".message-row .addFiles").length.should.equal(1);
      table.find(".message-row td").attr("colspan").should.equal("7");
    });

    it("routes the start prompt add-files button through the root row", async function () {
      const rootRow = new Backbone.Model({
        id: "dataset:resource_map_1",
        className: "root-dataset",
      });
      const rows = new Backbone.Collection([rootRow]);
      const file = new Blob(["data"], { type: "text/plain" });
      const event = { preventDefault: sandbox.stub() };
      view.fileTableView = {
        viewModel: {
          getRows: () => rows,
        },
      };
      sandbox.stub(view, "choosePackageFiles").resolves([file]);
      sandbox.stub(view, "addFilesFromFileTable").resolves([]);

      const handled = await view.handleFileTableStartAddFiles(event);

      handled.should.equal(true);
      sinon.assert.calledOnce(event.preventDefault);
      sinon.assert.calledOnceWithExactly(view.addFilesFromFileTable, rootRow, [
        file,
      ]);
    });

    it("renames the root dataset row by updating the metadata title", async function () {
      const rowModel = new Backbone.Model({
        id: "dataset:resource_map_1",
        className: "root-dataset",
        isContainer: true,
      });
      model.set("title", []);
      sandbox.stub(view, "renderCitationHeader");
      sandbox.stub(view, "refreshFileTable");

      await view.handleFileTableRename(rowModel, "Renamed dataset");

      model.get("title").should.deep.equal(["Renamed dataset"]);
      sinon.assert.calledOnceWithExactly(view.renderCitationHeader, model);
      sinon.assert.calledOnce(view.refreshFileTable);
    });

    it("restores the root dataset row after an empty rename proposal", async function () {
      const rowModel = new Backbone.Model({
        id: "dataset:resource_map_1",
        className: "root-dataset",
        isContainer: true,
      });
      sandbox.stub(view, "refreshFileTable");

      await view.handleFileTableRename(rowModel, "");

      sinon.assert.calledOnce(view.refreshFileTable);
    });

    it("recovers the file table when a member rename is rejected", async function () {
      const error = new Error("Filename <b>is unavailable</b>");
      const rootDataPackage = {
        renameMemberFile: sandbox.stub().rejects(error),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      const rowModel = new Backbone.Model({ id: "data_1" });
      sandbox.stub(view, "refreshFileTable");

      await view.handleFileTableRename(rowModel, "renamed.csv");

      sinon.assert.calledOnceWithExactly(
        rootDataPackage.renameMemberFile,
        "data_1",
        "renamed.csv",
      );
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Failed to rename the file",
      );
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Filename &lt;b&gt;is unavailable&lt;/b&gt;",
      );
    });

    it("ignores metadata-only package changes when refreshing the file table", async function () {
      const rootDataPackage = createEditorRootDataPackage();
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: { get: sandbox.stub().returns("") },
        appUserModel: { get: sandbox.stub().returns([]) },
        rootDataPackage,
      };
      view.setElement($('<div><div id="data-package-container"></div></div>'));
      model.set({ id: "metadata_1", title: "Dataset title" });
      model.isNew = sandbox.stub().returns(false);
      sandbox.stub(view, "renderMetadata");
      sandbox.stub(view, "getEditorFileTableRows").returns([]);
      sandbox.stub(view, "renderFileTableStartMessage");
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "enrichEditorFileTableMembers");
      view.renderDataPackage();
      sinon.assert.calledOnceWithExactly(view.enrichEditorFileTableMembers, {
        renderId: "render-test",
        signal: undefined,
      });
      sandbox.spy(view, "refreshFileTable");
      view.metadataEntitySyncNeeded = false;

      rootDataPackage.events.trigger("change", { event: "metadata:changed" });
      rootDataPackage.events.trigger("change", { event: "metadata:changed" });

      sinon.assert.notCalled(view.refreshFileTable);
      view.metadataEntitySyncNeeded.should.equal(false);

      rootDataPackage.events.trigger("change", { event: "members:add" });

      sinon.assert.notCalled(view.refreshFileTable);
      await new Promise((resolve) => setTimeout(resolve, 0));
      sinon.assert.calledOnce(view.refreshFileTable);
      view.metadataEntitySyncNeeded.should.equal(true);
    });

    it("refreshes the editor table after missing file details load", async function () {
      const rootDataPackage = createEditorRootDataPackage();
      const enrichMembers = sandbox
        .stub(DataPackageFileTableAdapter, "enrichMembers")
        .resolves({ changed: true });
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      view.fileTableView = {};
      sandbox.stub(view, "refreshFileTable");

      await view.enrichEditorFileTableMembers({ renderId: "render-test" });

      sinon.assert.calledOnceWithExactly(enrichMembers, rootDataPackage, {
        signal: undefined,
      });
      sinon.assert.calledOnce(view.refreshFileTable);
    });

    it("ignores file details loaded for a stale editor table", async function () {
      const rootDataPackage = createEditorRootDataPackage();
      let finishLoading;
      sandbox.stub(DataPackageFileTableAdapter, "enrichMembers").returns(
        new Promise((resolve) => {
          finishLoading = resolve;
        }),
      );
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      view.fileTableView = {};
      sandbox.stub(view, "refreshFileTable");

      const loading = view.enrichEditorFileTableMembers({
        renderId: "render-test",
      });
      view.renderId = "render-next";
      finishLoading({ changed: true });
      await loading;

      sinon.assert.notCalled(view.refreshFileTable);
    });

    it("hides file-table sharing when the dataset allow-list excludes the user", function () {
      const rootDataPackage = createEditorRootDataPackage();

      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: (key) => {
            if (key === "allowAccessPolicyChanges") return true;
            if (key === "allowAccessPolicyChangesDatasets") return true;
            if (key === "allowAccessPolicyChangesDatasetsForSubjects") {
              return ["CN=allowed,DC=dataone,DC=org"];
            }
            return "";
          },
        },
        appUserModel: {
          get: (key) =>
            key === "allIdentitiesAndGroups"
              ? ["CN=other,DC=dataone,DC=org"]
              : null,
        },
        rootDataPackage,
      };
      model.set("title", "Dataset title");

      const rows = view.getEditorFileTableRows();

      rows.forEach((row) => {
        row.showShare.should.equal(false);
        chai.expect(row.shareAction).to.equal(null);
      });
    });

    it("creates editor packages with metadata filename and ResourceMap creator", function () {
      model.set({
        id: "metadata.1",
        formatId: "https://eml.ecoinformatics.org/eml-2.2.0",
        title: "A new dataset",
      });
      model.setFileName = sandbox
        .stub()
        .callsFake(() => model.set("fileName", "A_new_dataset.xml"));
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "d1CNBaseUrl") {
              return "https://cn-stage.test.dataone.org";
            }
            if (key === "d1CNService") {
              return "/cn/v2";
            }
            if (key === "resolveServiceUrl") {
              return "https://cn-stage.test.dataone.org/cn/v2/resolve";
            }
            return null;
          }),
        },
        appUserModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "firstName") return "Robyn";
            if (key === "lastName") return "Thiessen-Bock";
            return null;
          }),
        },
      };

      view.createRootDataPackage([model]);

      const pkg = globalThis.MetacatUI.rootDataPackage;
      const metadataMember = pkg.getMember("metadata.1");
      const resourceMap = pkg.getRootResourceMapMember().objectModel;

      sinon.assert.calledOnce(model.setFileName);
      pkg.rootResourceMapPid.should.equal("resource_map_metadata.1");
      metadataMember.fileName.should.equal("A_new_dataset.xml");
      resourceMap.getSummary().creatorName.should.equal("Robyn Thiessen-Bock");
      model.get("collections").should.deep.equal([pkg]);

      view.attachMetadataModelToPackage(model);

      model.get("collections").should.deep.equal([pkg]);
    });

    it("does not derive a new untitled metadata filename from the generated PID", function () {
      model.set({
        id: "metadata.1",
        formatId: "https://eml.ecoinformatics.org/eml-2.2.0",
        title: [],
      });
      model.setFileName = sandbox.stub();
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "d1CNBaseUrl") {
              return "https://cn-stage.test.dataone.org";
            }
            if (key === "d1CNService") {
              return "/cn/v2";
            }
            if (key === "resolveServiceUrl") {
              return "https://cn-stage.test.dataone.org/cn/v2/resolve";
            }
            return null;
          }),
        },
        appUserModel: {
          get: sandbox.stub().returns(null),
        },
      };

      view.createRootDataPackage([model]);

      const metadataMember =
        globalThis.MetacatUI.rootDataPackage.getMember("metadata.1");
      sinon.assert.notCalled(model.setFileName);
      chai.expect(model.get("fileName")).to.equal(undefined);
      chai.expect(metadataMember.fileName).to.equal(undefined);
    });

    it("delegates ResourceMap PID creation to createRootDataPackage", function () {
      sandbox.stub(view, "createRootDataPackage").callsFake(() => {
        globalThis.MetacatUI.rootDataPackage = {
          getRootResourceMapMember: () => ({ pid: "resource_map_metadata.1" }),
        };
      });
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
      };

      view.createDataPackage();

      sinon.assert.calledOnceWithExactly(view.createRootDataPackage, [model]);
    });

    it("renders only when both package members are writable", function () {
      const rootDataPackage = createRootDataPackage({
        members: [
          {
            pid: "resource_map_1",
            formatType: "RESOURCE",
            isAuthorized_write: true,
          },
          {
            pid: "metadata.1",
            formatType: "METADATA",
            isAuthorized_write: true,
          },
        ],
      });
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "renderDataPackage");
      sandbox.stub(view, "notAuthorized");

      view.renderEditorComponents();

      sinon.assert.calledOnce(view.renderDataPackage);
      sinon.assert.notCalled(view.notAuthorized);
    });

    it("loads once and refreshes both package-member permissions", async function () {
      globalThis.MetacatUI = { ...(originalMetacatUI || {}) };
      model.set("id", "metadata.1");
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      const getLatestVersion = sandbox.stub().resolves("metadata.1");
      sandbox
        .stub(DataPackage.prototype, "getVersionTracker")
        .returns({ getLatestVersion });
      let resourceMapPermission;
      let metadataPermission;
      const getRecoveryRecord = sandbox.stub().resolves({
        metadataPid: "metadata.1",
        rmPid: "resource_map_2",
        obsoletesRmPid: "resource_map_0",
        rmXml: "<rdf:RDF></rdf:RDF>",
        rmSysMetaXml: "<d1:systemMetadata></d1:systemMetadata>",
      });
      sandbox
        .stub(DataPackage.prototype, "getUploadRecoveryStore")
        .returns({ get: getRecoveryRecord });
      const loadEditablePackage = sandbox
        .stub(DataPackage.prototype, "loadEditablePackage")
        .callsFake(async function () {
          this.members.add([
            { pid: "resource_map_1", formatType: "RESOURCE" },
            { pid: "metadata.1", formatType: "METADATA" },
          ]);
          this.rootResourceMapPid = "resource_map_1";
          resourceMapPermission = sandbox
            .stub(this.getRootResourceMapMember(), "checkWritePermission")
            .resolves(true);
          metadataPermission = sandbox
            .stub(this.getPrimaryMetadataMember(), "checkWritePermission")
            .resolves(true);
          return this;
        });
      sandbox.stub(view, "updateLoadingText");
      sandbox.stub(view, "setListeners");
      sandbox.stub(view, "getEditorPackageMemberLimit").returns(123);

      const loaded = await view.getDataPackage();
      const authorizationService = loaded.getAuthorizationService();

      sinon.assert.calledOnceWithExactly(getLatestVersion, "metadata.1", {
        signal: undefined,
      });
      sinon.assert.calledOnceWithExactly(loadEditablePackage, "metadata.1", {
        resolverOptions: { metaServiceUrl: "https://example.org/meta" },
        maxMembers: 123,
        signal: undefined,
      });
      sinon.assert.calledOnceWithExactly(
        resourceMapPermission,
        {
          refresh: true,
          signal: undefined,
        },
        authorizationService,
      );
      sinon.assert.calledOnceWithExactly(
        metadataPermission,
        {
          refresh: true,
          signal: undefined,
        },
        authorizationService,
      );
      loaded.should.equal(globalThis.MetacatUI.rootDataPackage);
      loaded.getRootResourceMapMember().isAuthorized_write.should.equal(true);
      loaded.getPrimaryMetadataMember().isAuthorized_write.should.equal(true);
      model.get("isAuthorized_write").should.equal(true);
      sinon.assert.calledOnceWithExactly(getRecoveryRecord, "metadata.1");
      sinon.assert.calledOnce(view.setListeners);
    });

    it("continues loading when the recovery store is unavailable", async function () {
      globalThis.MetacatUI = { ...(originalMetacatUI || {}) };
      model.set("id", "metadata.1");
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      sandbox.stub(DataPackage.prototype, "getVersionTracker").returns({
        getLatestVersion: sandbox.stub().resolves("metadata.1"),
      });
      sandbox
        .stub(DataPackage.prototype, "getUploadRecoveryStore")
        .returns({ get: sandbox.stub().rejects(new Error("unavailable")) });
      sandbox
        .stub(DataPackage.prototype, "loadEditablePackage")
        .callsFake(async function () {
          this.members.add([
            { pid: "resource_map_1", formatType: "RESOURCE" },
            { pid: "metadata.1", formatType: "METADATA" },
          ]);
          this.rootResourceMapPid = "resource_map_1";
          sandbox
            .stub(this.getRootResourceMapMember(), "checkWritePermission")
            .resolves(true);
          sandbox
            .stub(this.getPrimaryMetadataMember(), "checkWritePermission")
            .resolves(true);
          return this;
        });
      sandbox.stub(view, "updateLoadingText");
      sandbox.stub(view, "setListeners");

      const loaded = await view.getDataPackage();

      loaded.should.equal(globalThis.MetacatUI.rootDataPackage);
      sinon.assert.calledOnce(view.setListeners);
    });

    it("offers recovery before exposing a loaded older resource map", async function () {
      globalThis.MetacatUI = { ...(originalMetacatUI || {}) };
      model.set("id", "metadata.1");
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      sandbox.stub(DataPackage.prototype, "getVersionTracker").returns({
        getLatestVersion: sandbox.stub().resolves("metadata.1"),
      });
      const getRecoveryRecord = sandbox.stub().resolves({
        metadataPid: "metadata.1",
        rmPid: "resource_map_2",
        obsoletesRmPid: "resource_map_1",
        rmXml: "<rdf:RDF></rdf:RDF>",
        rmSysMetaXml: "<d1:systemMetadata></d1:systemMetadata>",
      });
      sandbox
        .stub(DataPackage.prototype, "getUploadRecoveryStore")
        .returns({ get: getRecoveryRecord });
      sandbox
        .stub(DataPackage.prototype, "loadEditablePackage")
        .callsFake(async function () {
          this.members.add([
            { pid: "resource_map_1", formatType: "RESOURCE" },
            { pid: "metadata.1", formatType: "METADATA" },
          ]);
          this.rootResourceMapPid = "resource_map_1";
          sandbox
            .stub(this.getRootResourceMapMember(), "checkWritePermission")
            .resolves(true);
          sandbox
            .stub(this.getPrimaryMetadataMember(), "checkWritePermission")
            .resolves(true);
          return this;
        });
      sandbox.stub(view, "updateLoadingText");
      sandbox.stub(view, "setListeners");
      sandbox.stub(view, "showFullPageAlert");
      sandbox.spy(view, "trigger");

      const loaded = await view.getDataPackage();

      chai.expect(loaded).to.equal(null);
      chai.expect(globalThis.MetacatUI.rootDataPackage).to.equal(null);
      sinon.assert.calledOnceWithExactly(getRecoveryRecord, "metadata.1");
      sinon.assert.calledOnce(view.showFullPageAlert);
      view.showFullPageAlert.firstCall.args[0].should.contain(
        "interrupted save",
      );
      sinon.assert.neverCalledWith(view.trigger, "dataPackageFound");
      sinon.assert.notCalled(view.setListeners);
    });

    it("does not expose stale package load completions", async function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: { stale: true },
      };
      model.set("id", "metadata.1");
      view.renderId = "render-current";
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      sandbox.stub(DataPackage.prototype, "getVersionTracker").returns({
        getLatestVersion: sandbox.stub().resolves("metadata.1"),
      });
      let resolveLoad;
      sandbox
        .stub(DataPackage.prototype, "loadEditablePackage")
        .callsFake(function () {
          this.members.add([
            { pid: "resource_map_1", formatType: "RESOURCE" },
            { pid: "metadata.1", formatType: "METADATA" },
          ]);
          this.rootResourceMapPid = "resource_map_1";
          return new Promise((resolve) => {
            resolveLoad = () => resolve(this);
          });
        });
      sandbox.stub(view, "attachMetadataModelToPackage");
      sandbox.stub(view, "setListeners");
      sandbox.stub(view, "updateLoadingText");
      sandbox.spy(view, "trigger");

      const loading = view.getDataPackage(model, {
        renderId: "render-current",
      });
      await Promise.resolve();
      await Promise.resolve();
      view.renderId = "render-next";
      resolveLoad();
      const loaded = await loading;

      chai.expect(loaded).to.equal(null);
      chai.expect(globalThis.MetacatUI.rootDataPackage).to.equal(null);
      chai.expect(model.get("isAuthorized_write")).to.equal(undefined);
      sinon.assert.notCalled(view.attachMetadataModelToPackage);
      sinon.assert.neverCalledWith(view.trigger, "dataPackageFound");
      sinon.assert.notCalled(view.setListeners);
    });

    it("does not render editor components when a render-owned load becomes stale", async function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: { set: sandbox.stub(), get: sandbox.stub().returns(null) },
        appView: { loadingTemplate: sandbox.stub().returns("Loading") },
        appUserModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "checked") return true;
            if (key === "loggedIn") return true;
            return null;
          }),
        },
      };
      view.setElement($("<div></div>"));
      model.set("id", "metadata.1");
      model.fetch = sandbox.stub().callsFake(() => model.trigger("sync"));
      let resolveLoad;
      sandbox.stub(EditorView.prototype, "render").returns(view);
      sandbox.stub(view, "renderCitationHeader");
      sandbox.stub(view, "updateLoadingText");
      sandbox.stub(view, "renderEditorComponents");
      sandbox.stub(view, "getDataPackage").callsFake(
        () =>
          new Promise((resolve) => {
            resolveLoad = () => {
              view.renderId = "render-next";
              resolve({});
            };
          }),
      );

      view.render();
      await Promise.resolve();
      resolveLoad();
      await Promise.resolve();

      sinon.assert.notCalled(view.renderEditorComponents);
    });

    it("blocks editing when the package exceeds the configured member limit", async function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "maxEditorPackageMembers") return 2;
            return null;
          }),
        },
        rootDataPackage: { stale: true },
      };
      model.set("id", "metadata.1");
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      sandbox.stub(DataPackage.prototype, "getVersionTracker").returns({
        getLatestVersion: sandbox.stub().resolves("metadata.1"),
      });
      const loadEditablePackage = sandbox
        .stub(DataPackage.prototype, "loadEditablePackage")
        .rejects(
          Object.assign(new Error("too many members"), {
            code: "package_member_limit_exceeded",
            inputId: "metadata.1",
            rootResourceMapPid: "resource_map_1",
            memberCount: 3,
            maxMembers: 2,
          }),
        );
      sandbox.stub(view, "showFullPageAlert");
      sandbox.stub(view, "setListeners");

      const loaded = await view.getDataPackage();

      chai.expect(loaded).to.equal(null);
      chai.expect(globalThis.MetacatUI.rootDataPackage).to.equal(null);
      sinon.assert.calledOnceWithExactly(loadEditablePackage, "metadata.1", {
        resolverOptions: { metaServiceUrl: "https://example.org/meta" },
        maxMembers: 2,
        signal: undefined,
      });
      sinon.assert.notCalled(view.setListeners);
      sinon.assert.calledOnce(view.showFullPageAlert);
      view.showFullPageAlert.firstCall.args[0].should.contain(
        "3 package members",
      );
      view.showFullPageAlert.firstCall.args[0].should.contain(
        "2 members currently supported",
      );
      view.showFullPageAlert.firstCall.args[1].should.equal("error");
      view.showFullPageAlert.firstCall.args[2].should.contain("metadata.1");
      view.showFullPageAlert.firstCall.args[2].should.contain("resource_map_1");
      view.showFullPageAlert.firstCall.args[3].should.contain(
        "Dataset editor member limit exceeded",
      );
    });

    it("caps the configured editor member limit at the index manifest row limit", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox.stub().callsFake((key) => {
            if (key === "maxEditorPackageMembers") return 2000;
            return null;
          }),
        },
      };

      view.getEditorPackageMemberLimit().should.equal(1000);
    });

    it("defaults the editor member limit when none is configured", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: { get: sandbox.stub().returns(null) },
      };

      view.getEditorPackageMemberLimit().should.equal(700);
    });

    it("redirects to the latest version before editable loading", async function () {
      globalThis.MetacatUI = { ...(originalMetacatUI || {}) };
      model.set("id", "metadata.1");
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      sandbox.stub(DataPackage.prototype, "getVersionTracker").returns({
        getLatestVersion: sandbox.stub().resolves("metadata.2"),
      });
      const loadEditablePackage = sandbox.stub(
        DataPackage.prototype,
        "loadEditablePackage",
      );
      sandbox.stub(view, "showLatestVersion");

      const loaded = await view.getDataPackage();

      chai.expect(loaded).to.equal(null);
      model.get("latestVersion").should.equal("metadata.2");
      sinon.assert.calledOnce(view.showLatestVersion);
      sinon.assert.notCalled(loadEditablePackage);
    });

    it("does not expose a partially loaded package after loading fails", async function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: { stale: true },
      };
      model.set("id", "metadata.1");
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      sandbox.stub(DataPackage.prototype, "getVersionTracker").returns({
        getLatestVersion: sandbox.stub().resolves("metadata.1"),
      });
      sandbox.stub(DataPackage.prototype, "loadEditablePackage").rejects(
        Object.assign(new Error("baseline failed"), {
          code: "editable_baseline_unavailable",
        }),
      );

      let caught;
      try {
        await view.getDataPackage();
      } catch (error) {
        caught = error;
      }

      caught.code.should.equal("editable_baseline_unavailable");
      chai.expect(globalThis.MetacatUI.rootDataPackage).to.equal(null);
    });

    it("does not check remote permissions for a new package", async function () {
      globalThis.MetacatUI = { ...(originalMetacatUI || {}) };
      let resourceMapMember;
      let metadataMember;
      sandbox
        .stub(Utilities, "awaitMetacatUI")
        .resolves("https://example.org/meta");
      sandbox.stub(view, "createDataPackage").callsFake(() => {
        const rootDataPackage = createRootDataPackage({
          rootResourceMapPid: "resource_map_metadata.new",
          members: [
            { pid: "resource_map_metadata.new", formatType: "RESOURCE" },
            { pid: "metadata.new", formatType: "METADATA" },
          ],
        });
        resourceMapMember = rootDataPackage.getRootResourceMapMember();
        metadataMember = rootDataPackage.getPrimaryMetadataMember();
        sandbox.spy(resourceMapMember, "checkWritePermission");
        sandbox.spy(metadataMember, "checkWritePermission");
        globalThis.MetacatUI.rootDataPackage = rootDataPackage;
      });
      sandbox.stub(view, "setListeners");

      await view.getDataPackage();

      sinon.assert.notCalled(resourceMapMember.checkWritePermission);
      sinon.assert.notCalled(metadataMember.checkWritePermission);
      resourceMapMember.isAuthorized_write.should.equal(true);
      metadataMember.isAuthorized_write.should.equal(true);
      model.get("isAuthorized_write").should.equal(true);
    });

    [
      { resourceMapPermission: false, metadataPermission: true },
      { resourceMapPermission: true, metadataPermission: false },
    ].forEach(({ resourceMapPermission, metadataPermission }) => {
      it("blocks rendering when either package member is not writable", function () {
        const rootDataPackage = createRootDataPackage({
          members: [
            {
              pid: "resource_map_1",
              formatType: "RESOURCE",
              isAuthorized_write: resourceMapPermission,
            },
            {
              pid: "metadata.1",
              formatType: "METADATA",
              isAuthorized_write: metadataPermission,
            },
          ],
        });
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          rootDataPackage,
        };
        sandbox.stub(view, "renderDataPackage");
        sandbox.stub(view, "notAuthorized");

        view.renderEditorComponents();

        sinon.assert.notCalled(view.renderDataPackage);
        sinon.assert.calledOnce(view.notAuthorized);
      });
    });

    it("routes editable loading failures to blocking messages", function () {
      sandbox.stub(view, "showResourceMapNotEditable");
      sandbox.stub(view, "showResourceMapNotFound");
      sandbox.stub(view, "notAuthorized");
      sandbox.stub(view, "showFullPageAlert");
      sandbox.stub(view, "loadError");

      const notEditable = Object.assign(new Error("unsafe graph"), {
        code: "resource_map_not_editable",
        issues: [{ code: "memberIdentifierMismatch", severity: "error" }],
      });
      const missing = Object.assign(new Error("missing"), {
        code: "resource_map_unavailable",
        reason: "missing",
      });
      const multiple = Object.assign(new Error("multiple"), {
        code: "resource_map_unavailable",
        multipleRMs: true,
      });
      const unauthorized = Object.assign(new Error("private"), {
        code: "resource_map_unavailable",
        reason: "unauthorized",
        httpStatus: 403,
      });
      const parseError = new Error("malformed RDF");
      const unavailable = Object.assign(new Error("unavailable"), {
        code: "resource_map_unavailable",
        reason: "error",
        cause: parseError,
      });
      view.handleDataPackageLoadError(notEditable);
      view.handleDataPackageLoadError(missing);
      view.handleDataPackageLoadError(multiple);
      view.handleDataPackageLoadError(unauthorized);
      view.handleDataPackageLoadError(unavailable);
      view.handleDataPackageLoadError(
        Object.assign(new Error("baseline"), {
          code: "editable_baseline_unavailable",
        }),
      );
      view.handleDataPackageLoadError(new Error("unexpected"));

      sinon.assert.calledOnceWithExactly(
        view.showResourceMapNotEditable,
        notEditable,
      );
      sinon.assert.calledTwice(view.showResourceMapNotFound);
      sinon.assert.calledWithExactly(view.showResourceMapNotFound, missing);
      sinon.assert.calledWithExactly(view.showResourceMapNotFound, multiple);
      sinon.assert.calledOnce(view.notAuthorized);
      sinon.assert.calledOnceWithExactly(
        view.showFullPageAlert,
        "System metadata required to edit this dataset could not be loaded. Reload the page or try again later.",
        "error",
      );
      sinon.assert.calledTwice(view.loadError);
      sinon.assert.calledWithExactly(view.loadError, "malformed RDF");
      sinon.assert.calledWithExactly(view.loadError, "unexpected");
    });

    it("renders Resource Map diagnostics as escaped, copyable text", function () {
      model.set("id", "meta.1");
      sandbox.stub(view, "showFullPageAlert");
      const unsafeValue = '<script>alert("unsafe")</script>';

      view.showResourceMapNotEditable({
        inputId: "meta.1",
        rootResourceMapPid: "resource_map_1",
        issues: [
          {
            code: "memberIdentifierMismatch",
            severity: "error",
            message: unsafeValue,
            details: { object: "<img src=x onerror=alert(1)>" },
          },
        ],
      });

      sinon.assert.calledOnce(view.showFullPageAlert);
      const [message, type, emailBody, emailSubject] =
        view.showFullPageAlert.firstCall.args;
      const rendered = $(message);
      type.should.equal("error");
      rendered.find("pre").length.should.equal(1);
      rendered.find("pre").text().should.contain("memberIdentifierMismatch");
      rendered.find("pre").text().should.contain("unsafe");
      rendered.find("script").length.should.equal(0);
      rendered.find("img").length.should.equal(0);
      rendered.find(".repair-dataset").length.should.equal(0);
      emailBody.should.contain("memberIdentifierMismatch");
      emailSubject.should.equal(
        "Resource Map cannot be edited (PID: resource_map_1)",
      );
    });

    it("offers reconstruction repair for a confirmed missing map only", function () {
      model.set("id", "meta.1");
      sandbox.stub(view, "showFullPageAlert");
      const repairDataset = sandbox.stub(view, "repairDataset");
      const repairButton = { one: sandbox.stub() };
      sandbox.stub(view, "$").returns(repairButton);

      view.showResourceMapNotFound({ reason: "missing" });

      let message = view.showFullPageAlert.firstCall.args[0];
      const rendered = $("<div>").html(message);
      rendered.find(".repair-dataset").length.should.equal(1);
      rendered.text().should.contain("Files added during the interrupted save");
      rendered.text().should.contain("file relationships");
      repairButton.one.firstCall.args[1]();
      sinon.assert.calledOnceWithExactly(repairDataset, "meta.1", {
        allowReconstruct: true,
      });

      view.showResourceMapNotFound({
        reason: "missing",
        multipleRMs: true,
      });

      message = view.showFullPageAlert.secondCall.args[0];
      $("<div>").html(message).find(".repair-dataset").length.should.equal(0);
      sinon.assert.calledOnce(repairButton.one);
    });

    it("does not offer repair when a resource map is not confirmed missing", function () {
      model.set("id", "meta.1");
      sandbox.stub(view, "showFullPageAlert");
      const repairButton = { one: sandbox.stub() };
      sandbox.stub(view, "$").returns(repairButton);

      view.showResourceMapNotFound({ reason: "error" });

      const message = view.showFullPageAlert.firstCall.args[0];
      $("<div>").html(message).find(".repair-dataset").length.should.equal(0);
      sinon.assert.notCalled(repairButton.one);
    });

    it("replays an editor interrupted save without reconstruction", function () {
      const repairDataset = sandbox.stub(view, "repairDataset");
      const repairButton = { one: sandbox.stub() };
      sandbox.stub(view, "$").returns(repairButton);
      sandbox.stub(view, "showFullPageAlert");

      view.showInterruptedSave("meta.1");

      repairButton.one.firstCall.args[1]();
      sinon.assert.calledOnceWithExactly(repairDataset, "meta.1");
    });

    it("forwards editor recovery options to DataPackageRecovery", async function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: sandbox
            .stub()
            .callsFake((key) =>
              key === "metaServiceUrl"
                ? "https://meta.test/"
                : "https://resolve.test/",
            ),
        },
      };
      view.setElement(
        $("<div>").html(`
          <div class="repair-dataset-controls">
            <button class="repair-dataset"></button>
            <span class="repair-dataset-status"></span>
          </div>
        `),
      );
      const recoveryOptions = { allowReconstruct: true };
      const recover = sandbox
        .stub(DataPackageRecovery.prototype, "recover")
        .resolves({ recovered: false });

      await view.repairDataset("meta.1", recoveryOptions);

      sinon.assert.calledOnceWithExactly(recover, "meta.1", recoveryOptions);
    });

    it("shows whole plural minutes when a recent resource map is missing", function () {
      sandbox.useFakeTimers(new Date("2026-07-01T12:00:00Z").getTime());
      model.set({
        title: "100s of members",
        dateModified: "2026-07-01T11:26:48Z",
      });
      sandbox.stub(view, "showFullPageAlert");

      view.showResourceMapNotFound({ reason: "missing" });

      sinon.assert.calledOnce(view.showFullPageAlert);
      const message = view.showFullPageAlert.firstCall.args[0];
      message.should.contain("This document was last updated 33 minutes ago.");
      message.should.not.contain("33.2");
      message.should.not.contain("33 minute ago");
    });

    it("keeps editor controls disabled while package edits are locked", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          isEditLocked: sandbox.stub().returns(true),
          getPendingEagerUploads: sandbox.stub().returns([]),
        },
      };
      sandbox.stub(view, "disableControls");
      sandbox.stub(view, "enableControls");

      view.toggleEnableControls();

      sinon.assert.calledOnceWithExactly(
        view.disableControls,
        sinon.match(/submitting/i),
        sinon.match.string,
      );
      sinon.assert.notCalled(view.enableControls);
    });

    it("shows package-save preparation messages while controls are disabled", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          isEditLocked: sandbox.stub().returns(false),
          getPendingEagerUploads: sandbox.stub().returns([]),
        },
      };
      view.packageSaveUploadCount = 119;
      view.packageSavePrepMessage = "prep-message";
      sandbox.stub(view, "setFileTableDisabled");
      sandbox.stub(view, "disableControls");
      sandbox.stub(view, "enableControls");

      view.toggleEnableControls();

      sinon.assert.calledOnceWithExactly(view.setFileTableDisabled, true);
      sinon.assert.calledOnceWithExactly(
        view.disableControls,
        "prep-message",
        sinon.match.string,
      );
      sinon.assert.notCalled(view.enableControls);
    });

    it("keeps editor controls disabled while file-table edits are staging", function () {
      view.fileTableEditInProgress = true;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          isEditLocked: sandbox.stub().returns(false),
          getPendingEagerUploads: sandbox.stub().returns([]),
        },
      };
      sandbox.stub(view, "disableControls");
      sandbox.stub(view, "enableControls");

      view.toggleEnableControls();

      sinon.assert.calledOnceWithExactly(
        view.disableControls,
        "Adding files...",
        "File changes are still being staged.",
      );
      sinon.assert.notCalled(view.enableControls);
    });

    it("counts files when eager upload records contain multiple members", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          isEditLocked: sandbox.stub().returns(false),
          getPendingEagerUploads: sandbox.stub().returns([
            {
              members: [
                { pid: "data.1", remoteState: "pending" },
                { pid: "data.2", remoteState: "uploading" },
                { pid: "data.3", remoteState: "uploaded" },
              ],
            },
          ]),
        },
      };
      sandbox.stub(view, "disableControls");
      sandbox.stub(view, "enableControls");

      view.toggleEnableControls();

      sinon.assert.calledOnceWithExactly(
        view.disableControls,
        "Waiting for 2 files to upload...",
      );
      sinon.assert.notCalled(view.enableControls);
    });

    it("shows upload progress for uploading file-table rows", function () {
      view.fileUploadProgressByPid = { "data.1": 42 };

      const status = view.getEditorFileTableStatus(
        {
          pid: "data.1",
          remoteState: "uploading",
        },
        "DATA",
      );

      status.className.should.equal("status-uploading");
      status.progress.should.equal(42);
      status.title.should.match(/Uploading/);
    });

    it("shows save progress for rows queued by the package save", function () {
      view.fileUploadProgressByPid = { "data.1": 0 };
      view.packageSavePendingPids = new Set(["data.1"]);

      const status = view.getEditorFileTableStatus(
        {
          pid: "data.1",
          remoteState: "uploaded",
        },
        "DATA",
      );

      status.className.should.equal("status-uploading");
      status.progress.should.equal(0);
      status.title.should.match(/Uploading/);
    });

    it("ignores stale progress for uploaded rows outside a package save", function () {
      view.fileUploadProgressByPid = { "data.1": 0 };
      view.packageSavePendingPids = null;

      const status = view.getEditorFileTableStatus(
        {
          pid: "data.1",
          remoteState: "uploaded",
        },
        "DATA",
      );

      status.className.should.equal("status-missing-attributes");
      chai.expect(status.progress).to.equal(undefined);
    });

    it("shows an uploading status for a member being replaced", function () {
      view.replacingPids = new Set(["data.1"]);

      // The member is still UPLOADED under its old PID while the replace is
      // prepared, but the row should optimistically reflect the pending upload.
      const status = view.getEditorFileTableStatus(
        {
          pid: "data.1",
          remoteState: "uploaded",
        },
        "DATA",
      );

      status.className.should.equal("status-uploading");
      status.progress.should.equal(0);
      status.title.should.match(/Uploading/);
    });

    it("uses one EML entity map while building editor file-table rows", function () {
      const attributeList = {
        hasNonEmptyAttributes: sandbox.stub().returns(true),
        isValid: sandbox.stub().returns(true),
      };
      const entity = new Backbone.Model({
        downloadID: "data.1",
        entityName: "data.csv",
        attributeList,
      });
      entity.getDataPid = function () {
        return this.get("downloadID") || null;
      };
      entity.isValid = sandbox.stub().returns(true);
      const rootDataPackage = createUploadedCsvRootDataPackage();
      model.set("entities", new Backbone.Collection([entity]));
      model.getEntity = sandbox.stub().throws(new Error("unexpected scan"));
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: { get: sandbox.stub().returns("") },
        rootDataPackage,
      };

      const dataRow = view
        .getEditorFileTableRows()
        .find((row) => row.id === "data.1");

      dataRow.status.className.should.equal("status-complete");
      sinon.assert.notCalled(model.getEntity);
      view.entityByMemberPid.get("data.1").should.equal(entity);
    });

    it("matches filename-only EML entities without mutating them while building the row map", function () {
      const entity = new Backbone.Model({
        entityName: "data.csv",
        attributeList: {
          hasNonEmptyAttributes: sandbox.stub().returns(false),
          isValid: sandbox.stub().returns(true),
        },
      });
      entity.getDataPid = function () {
        return this.get("downloadID") || null;
      };
      entity.isValid = sandbox.stub().returns(true);
      const rootDataPackage = createUploadedCsvRootDataPackage();
      model.set("entities", new Backbone.Collection([entity]));
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: { get: sandbox.stub().returns("") },
        rootDataPackage,
      };

      view.getEditorFileTableRows();

      view.entityByMemberPid.get("data.1").should.equal(entity);
      chai.expect(entity.get("downloadID")).to.equal(undefined);
      chai.expect(entity.get("entityType")).to.equal(undefined);
    });

    it("shows missing attribute status instead of an uploaded checkmark", function () {
      model.getEntity = sandbox.stub().returns({
        get: sandbox
          .stub()
          .withArgs("attributeList")
          .returns({
            hasNonEmptyAttributes: sandbox.stub().returns(false),
            isValid: sandbox.stub().returns(true),
          }),
        isValid: sandbox.stub().returns(true),
      });

      const status = view.getEditorFileTableStatus(
        {
          pid: "data.1",
          remoteState: "uploaded",
        },
        "DATA",
      );

      status.className.should.equal("status-missing-attributes");
      status.iconClass.should.match(/warning/);
      status.title.should.match(/needs to be described/);
    });

    it("shows complete status when the file has valid attributes", function () {
      model.getEntity = sandbox.stub().returns({
        get: sandbox
          .stub()
          .withArgs("attributeList")
          .returns({
            hasNonEmptyAttributes: sandbox.stub().returns(true),
            isValid: sandbox.stub().returns(true),
          }),
        isValid: sandbox.stub().returns(true),
      });

      const status = view.getEditorFileTableStatus(
        {
          pid: "data.1",
          remoteState: "uploaded",
        },
        "DATA",
      );

      status.className.should.equal("status-complete");
      status.iconClass.should.match(/ok-circle/);
      status.title.should.equal("Complete");
    });

    it("shows complete status when the file has linked attributes", function () {
      const sourceAttributeList = {
        hasNonEmptyAttributes: sandbox.stub().returns(true),
      };
      const references = {
        getLinkedModel: sandbox.stub().returns(sourceAttributeList),
      };
      const attributeList = {
        get: sandbox.stub().withArgs("references").returns(references),
        hasNonEmptyAttributes: sandbox.stub().returns(false),
        isValid: sandbox.stub().returns(true),
      };

      model.getEntity = sandbox.stub().returns({
        get: sandbox.stub().withArgs("attributeList").returns(attributeList),
        isValid: sandbox.stub().returns(true),
      });

      const status = view.getEditorFileTableStatus(
        {
          pid: "data.1",
          remoteState: "uploaded",
        },
        "DATA",
      );

      status.className.should.equal("status-complete");
      status.iconClass.should.match(/ok-circle/);
      status.title.should.equal("Complete");
    });

    it("updates file-table row progress from package upload events", function () {
      const member = {
        pid: "data.1",
        remoteState: "uploading",
        formatType: "DATA",
        isData: sandbox.stub().returns(true),
      };
      const updateRow = sandbox.stub().returns(new Backbone.Model());
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.fileTableView = {
        viewModel: { updateRow },
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          getMember: sandbox.stub().withArgs("data.1").returns(member),
        },
      };

      view.handlePackageUploadProgress({
        action: { memberPid: "data.1" },
        loaded: 25,
        total: 100,
        lengthComputable: true,
      });

      view.fileUploadProgressByPid["data.1"].should.equal(25);
      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.calledOnce(updateRow);
      updateRow.firstCall.args[0].should.equal("data.1");
      updateRow.firstCall.args[1].status.className.should.equal(
        "status-uploading",
      );
      updateRow.firstCall.args[1].status.progress.should.equal(25);
      sinon.assert.calledOnce(view.toggleEnableControls);
    });

    it("does not rebuild the table on progress for a member without a row", function () {
      // The metadata and resource map have no file-table row, so a progress
      // event for them must not trigger a full refresh (the per-event refresh
      // that froze large-package saves).
      const member = {
        pid: "meta.1",
        remoteState: "uploading",
        formatType: "METADATA",
        isData: sandbox.stub().returns(false),
      };
      const updateRow = sandbox.stub().returns(new Backbone.Model());
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.fileTableView = { viewModel: { updateRow } };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          getMember: sandbox.stub().withArgs("meta.1").returns(member),
        },
      };

      view.handlePackageUploadProgress({
        action: { memberPid: "meta.1" },
        status: "running",
      });

      sinon.assert.notCalled(updateRow);
      sinon.assert.notCalled(view.refreshFileTable);
    });

    it("rebuilds the table on progress for a data member that has no row yet", function () {
      const member = {
        pid: "data.new",
        remoteState: "uploading",
        formatType: "DATA",
        isData: sandbox.stub().returns(true),
      };
      // No matching row: updateRow returns null.
      const updateRow = sandbox.stub().returns(null);
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.entityByMemberPid = new Map();
      view.fileTableView = { viewModel: { updateRow } };
      model.getEntity = sandbox.stub().returns(null);
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          getMember: sandbox.stub().withArgs("data.new").returns(member),
        },
      };

      view.handlePackageUploadProgress({
        action: { memberPid: "data.new" },
        status: "running",
      });

      sinon.assert.calledOnce(view.refreshFileTable);
    });

    it("updates one file-table row status after an entity changes", function () {
      const attributeList = {
        hasNonEmptyAttributes: sandbox.stub().returns(true),
        isValid: sandbox.stub().returns(true),
      };
      const entity = {
        get: sandbox.stub().withArgs("attributeList").returns(attributeList),
        isValid: sandbox.stub().returns(true),
      };
      const member = {
        pid: "data.1",
        remoteState: "uploaded",
        formatType: "DATA",
        isData: sandbox.stub().returns(true),
      };
      const updateRow = sandbox.stub().returns(new Backbone.Model());
      view.entityByMemberPid = new Map();
      view.fileTableView = {
        viewModel: { updateRow },
      };
      model.getEntity = sandbox.stub().withArgs(member).returns(entity);
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          getMember: sandbox.stub().withArgs("data.1").returns(member),
        },
      };

      const row = view.updateFileTableMemberStatus("data.1");

      row.should.be.instanceOf(Backbone.Model);
      view.entityByMemberPid.get("data.1").should.equal(entity);
      sinon.assert.calledOnce(updateRow);
      updateRow.firstCall.args[0].should.equal("data.1");
      updateRow.firstCall.args[1].status.className.should.equal(
        "status-complete",
      );
    });

    it("skips entity cache lookup while upload status owns the row state", function () {
      const member = {
        pid: "data.1",
        remoteState: "uploading",
        formatType: "DATA",
        isData: sandbox.stub().returns(true),
      };
      const updateRow = sandbox.stub().returns(new Backbone.Model());
      view.entityByMemberPid = new Map();
      view.fileTableView = {
        viewModel: { updateRow },
      };
      model.getEntity = sandbox.stub();
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          getMember: sandbox.stub().withArgs("data.1").returns(member),
        },
      };

      view.updateFileTableMemberStatus("data.1");

      sinon.assert.notCalled(model.getEntity);
      sinon.assert.calledOnce(updateRow);
      updateRow.firstCall.args[1].status.className.should.equal(
        "status-uploading",
      );
    });

    it("refreshes controls when eager uploads settle", async function () {
      const rootDataPackage = new Backbone.Model();
      rootDataPackage.events = { ...Backbone.Events };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        eventDispatcher: new Backbone.Model(),
      };
      sandbox.stub(Utilities, "awaitMetacatUI").resolves(rootDataPackage);
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.fileUploadProgressByPid = { "data.1": 100, "data.2": 50 };

      view.setListeners();
      await Promise.resolve();
      rootDataPackage.events.trigger("eagerUpload:complete", {
        memberPids: ["data.1"],
        members: [{ pid: "data.renamed" }],
      });

      view.fileUploadProgressByPid.should.deep.equal({ "data.2": 50 });
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.calledOnce(view.toggleEnableControls);
    });

    it("updates controls without re-disabling the file table during upload preparation", async function () {
      const rootDataPackage = new Backbone.Model();
      rootDataPackage.events = { ...Backbone.Events };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        eventDispatcher: new Backbone.Model(),
      };
      sandbox.stub(Utilities, "awaitMetacatUI").resolves(rootDataPackage);
      sandbox.stub(view, "disableControls");
      sandbox.stub(view, "setFileTableDisabled");
      sandbox.stub(view, "toggleEnableControls");
      view.packageSaveUploadCount = 2;
      view.fileUploadProgressByPid = { "data.1": 0 };

      view.setListeners();
      await Promise.resolve();
      rootDataPackage.events.trigger("upload:prepare:progress", {
        message: "Checking permissions 0/2...",
      });
      rootDataPackage.events.trigger("upload:prepare:progress", {
        message: "Checking permissions 1/2...",
      });

      view.packageSavePrepMessage.should.equal("Checking permissions 1/2...");
      view.fileUploadProgressByPid["data.1"].should.equal(0);
      sinon.assert.calledTwice(view.disableControls);
      sinon.assert.notCalled(view.setFileTableDisabled);
      sinon.assert.notCalled(view.toggleEnableControls);
    });

    it("does not attach package listeners after the render changes", async function () {
      const rootDataPackage = new Backbone.Model();
      rootDataPackage.events = { ...Backbone.Events };
      let resolveRootPackage;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        eventDispatcher: new Backbone.Model(),
      };
      sandbox.stub(Utilities, "awaitMetacatUI").returns(
        new Promise((resolve) => {
          resolveRootPackage = resolve;
        }),
      );
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.renderId = "render-current";

      view.setListeners();
      view.renderId = "render-next";
      resolveRootPackage(rootDataPackage);
      await Promise.resolve();
      rootDataPackage.events.trigger("eagerUpload:complete");

      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.notCalled(view.toggleEnableControls);
    });

    it("does not attach package listeners after close", async function () {
      const rootDataPackage = new Backbone.Model();
      rootDataPackage.events = { ...Backbone.Events };
      let resolveRootPackage;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        eventDispatcher: new Backbone.Model(),
      };
      sandbox.stub(Utilities, "awaitMetacatUI").returns(
        new Promise((resolve) => {
          resolveRootPackage = resolve;
        }),
      );
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.renderId = "render-current";

      view.setListeners();
      view.onClose();
      resolveRootPackage(rootDataPackage);
      await Promise.resolve();
      rootDataPackage.events.trigger("eagerUpload:complete");

      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.notCalled(view.toggleEnableControls);
    });

    it("clears package upload progress without refreshing the full table", async function () {
      const rootDataPackage = new Backbone.Model();
      rootDataPackage.events = { ...Backbone.Events };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        eventDispatcher: new Backbone.Model(),
      };
      sandbox.stub(Utilities, "awaitMetacatUI").resolves(rootDataPackage);
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.fileUploadProgressByPid = { "data.1": 100 };

      view.setListeners();
      await Promise.resolve();
      rootDataPackage.events.trigger("upload:success");

      view.fileUploadProgressByPid.should.deep.equal({});
      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.calledOnce(view.toggleEnableControls);
    });

    it("refreshes file-table rows after a successful save", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        root: "",
        rootDataPackage: {
          getPrimaryMetadataMember: sandbox
            .stub()
            .returns({ pid: "metadata.1" }),
        },
        uiRouter: {
          navigate: sandbox.stub(),
        },
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      model.set("id", "metadata.1");
      view.fileUploadProgressByPid = { "data.1": 42 };
      view.packageSaveUploadCount = 2;
      view.packageSaveUploadTotal = 500;
      view.packageSavePrepMessage = "prep-message";
      view.fileTableView = { setDisabled: sandbox.stub() };
      view.subviews = [];
      sandbox.stub(view, "hideSaving");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");

      view.saveSuccess({ outcome: "success" });

      view.fileUploadProgressByPid.should.deep.equal({});
      (view.packageSaveUploadCount === null).should.equal(true);
      (view.packageSaveUploadTotal === null).should.equal(true);
      (view.packageSavePrepMessage === null).should.equal(true);
      sinon.assert.calledOnceWithExactly(view.fileTableView.setDisabled, false);
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.calledOnce(view.toggleControls);
      sinon.assert.calledOnce(view.toggleEnableControls);
    });

    it("warns when a successful save skips newly added files", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        root: "",
        rootDataPackage: {
          getPrimaryMetadataMember: sandbox
            .stub()
            .returns({ pid: "metadata.1" }),
        },
        uiRouter: {
          navigate: sandbox.stub(),
        },
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      model.set("id", "metadata.1");
      view.fileTableView = { setDisabled: sandbox.stub() };
      view.subviews = [];
      sandbox.stub(view, "hideSaving");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");

      view.saveSuccess(
        { outcome: "success" },
        { skippedNewDataFiles: ["failed.csv - network down"] },
      );

      sinon.assert.calledTwice(globalThis.MetacatUI.appView.showAlert);
      const warningArgs =
        globalThis.MetacatUI.appView.showAlert.secondCall.args;
      warningArgs[0]
        .text()
        .should.contain(
          "The dataset was saved, but these new files were not added",
        );
      warningArgs[0].text().should.contain("failed.csv - network down");
      warningArgs[1].should.equal("alert-warning");
    });

    it("registers model change listeners only once", async function () {
      const listenerModel = new Backbone.Model();
      listenerModel.handleChange = sandbox.spy();
      listenerModel.saveDraft = sandbox.spy();
      view.model = listenerModel;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: new Backbone.Model(),
        eventDispatcher: new Backbone.Model(),
      };
      sandbox.stub(Utilities, "awaitMetacatUI").resolves();

      view.setListeners();
      view.setListeners();
      await Promise.resolve();
      listenerModel.trigger("change", listenerModel);

      sinon.assert.calledOnce(listenerModel.handleChange);
      sinon.assert.notCalled(listenerModel.saveDraft);
    });

    it("debounces draft saves from editor change events", function () {
      const clock = sandbox.useFakeTimers();
      model.set("objectXML", "<eml/>");
      sandbox.stub(view, "saveDraftNow");

      view.saveDraft();
      view.saveDraft();
      clock.tick(9999);

      sinon.assert.notCalled(view.saveDraftNow);

      clock.tick(1);

      sinon.assert.calledOnce(view.saveDraftNow);
    });

    it("skips draft serialization for very large EML documents", function () {
      const clock = sandbox.useFakeTimers();
      model.set("objectXML", "x".repeat(1000001));
      sandbox.stub(view, "saveDraftNow");

      view.saveDraft();
      clock.tick(10000);

      sinon.assert.notCalled(view.saveDraftNow);
    });

    it("flushes a pending small draft when the editor closes", function () {
      const clock = sandbox.useFakeTimers();
      model.set("objectXML", "<eml/>");
      sandbox.stub(view, "saveDraftNow");

      view.saveDraft();
      view.flushDraftSave();
      clock.tick(10000);

      sinon.assert.calledOnce(view.saveDraftNow);
    });

    it("does not show save controls for upload status changes without package edits", function () {
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: {
          hasUnsavedChanges: sandbox.stub().returns(false),
        },
        eventDispatcher: new Backbone.Model(),
      };
      sandbox.stub(Utilities, "awaitMetacatUI").resolves();
      sandbox.stub(view, "showControls");
      sandbox.stub(view, "hideControls");

      view.setListeners();
      model.trigger("change:uploadStatus");

      sinon.assert.notCalled(view.showControls);
      sinon.assert.calledOnce(view.hideControls);
    });

    it("shows a package save count for sysmeta-only uploads", async function () {
      const sysMetaOnlyMember = {
        pid: "data.1",
        sysMetaDirty: true,
        accessPolicyDirty: true,
        isData: () => true,
      };
      const rootDataPackage = {
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        getChangedMembers: sandbox.stub().returns([sysMetaOnlyMember]),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      view.fileTableView = { setDisabled: sandbox.stub() };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "disableControls");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });

      view.packageSaveUploadCount.should.equal(1);
      view.packageSaveUploadTotal.should.equal(1);
      view.fileUploadProgressByPid["data.1"].should.equal(0);
      sinon.assert.calledWith(view.fileTableView.setDisabled, true);
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.calledOnceWithExactly(
        view.disableControls,
        sinon.match(/\b1 file\b/),
        sinon.match.string,
      );
      sinon.assert.calledOnce(rootDataPackage.upload);
    });

    it("skips entity sync and pre-upload refresh for metadata-only saves", async function () {
      const metadataMember = {
        pid: "metadata.1",
        contentDirty: true,
        isData: () => false,
      };
      const rootDataPackage = {
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getPrimaryMetadataMember: sandbox.stub().returns(metadataMember),
        getChangedMembers: sandbox.stub().returns([metadataMember]),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      view.fileTableView = { setDisabled: sandbox.stub() };
      sandbox.stub(view, "showSaving");
      sandbox
        .stub(view, "attachMetadataModelToPackage")
        .returns(metadataMember);
      sandbox.stub(view, "syncMetadataEntities");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "disableControls");
      sandbox.stub(view, "saveSuccess");
      view.metadataEntitySyncNeeded = false;

      await view.save({ target: $("<button></button>")[0] });

      view.packageSaveUploadCount.should.equal(1);
      view.packageSaveUploadTotal.should.equal(1);
      view.fileUploadProgressByPid["metadata.1"].should.equal(0);
      sinon.assert.calledOnce(view.attachMetadataModelToPackage);
      sinon.assert.notCalled(view.syncMetadataEntities);
      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.calledOnce(rootDataPackage.upload);
    });

    it("syncs entities once after a package relationship change", async function () {
      const metadataModel = new Backbone.Model({
        entities: new Backbone.Collection(),
      });
      metadataModel.addEntity = sandbox.stub();
      const metadataMember = {
        pid: "metadata.1",
        contentDirty: false,
        documents: [],
        objectModel: metadataModel,
        isData: () => false,
      };
      const rootDataPackage = new Backbone.Model();
      rootDataPackage.events = { ...Backbone.Events };
      rootDataPackage.hasMetadataContentEdits = sandbox.stub().returns(true);
      rootDataPackage.getPrimaryMetadataMember = sandbox
        .stub()
        .returns(metadataMember);
      rootDataPackage.getChangedMembers = sandbox.stub().returns([]);
      rootDataPackage.markMemberContentDirty = sandbox
        .stub()
        .resolves(metadataMember);
      rootDataPackage.upload = sandbox.stub().resolves({ outcome: "success" });
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: { get: sandbox.stub().returns("") },
        appUserModel: { get: sandbox.stub().returns([]) },
        rootDataPackage,
      };
      view.setElement($('<div><div id="data-package-container"></div></div>'));
      model.set({ id: "metadata.1", title: "Dataset title" });
      model.isNew = sandbox.stub().returns(false);
      sandbox.stub(view, "renderMetadata");
      sandbox.stub(view, "getEditorFileTableRows").returns([]);
      sandbox.stub(view, "renderFileTableStartMessage");
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "enrichEditorFileTableMembers");
      view.renderDataPackage();
      view.metadataEntitySyncNeeded = false;
      rootDataPackage.events.trigger("change", {
        event: "documentation:link",
      });
      sandbox.stub(view, "showSaving");
      sandbox
        .stub(view, "attachMetadataModelToPackage")
        .returns(metadataMember);
      sandbox.spy(view, "syncMetadataEntities");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });
      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnce(view.syncMetadataEntities);
      view.metadataEntitySyncNeeded.should.equal(false);
      sinon.assert.calledTwice(rootDataPackage.upload);
    });

    it("updates package save progress and remaining count as uploads finish", function () {
      view.fileUploadProgressByPid = { "data.1": 0, "data.2": 0 };
      view.packageSavePendingPids = new Set(["data.1", "data.2"]);
      view.packageSaveUploadCount = 2;
      sandbox.stub(view, "updateFileTableMemberStatus").returns({});
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");

      view.handlePackageUploadProgress({
        action: { memberPid: "data.1" },
        status: "running",
        loaded: 10,
        total: 10,
        lengthComputable: true,
      });

      view.fileUploadProgressByPid["data.1"].should.equal(99);
      view.packageSaveUploadCount.should.equal(2);

      view.handlePackageUploadProgress({
        action: { memberPid: "data.1" },
        status: "succeeded",
      });

      chai.expect(view.fileUploadProgressByPid["data.1"]).to.equal(undefined);
      view.packageSaveUploadCount.should.equal(1);
      view.packageSavePendingPids.has("data.1").should.equal(false);
      sinon.assert.calledTwice(view.updateFileTableMemberStatus);
      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.calledTwice(view.toggleEnableControls);
    });

    it("replaces prep messages with the submitting countdown on action progress", function () {
      view.fileUploadProgressByPid = { "data.1": 0, "data.2": 0 };
      view.packageSavePendingPids = new Set(["data.1", "data.2"]);
      view.packageSaveUploadCount = 2;
      view.packageSaveUploadTotal = 500;
      view.packageSavePrepMessage = "prep-message";
      sandbox.stub(view, "updateFileTableMemberStatus").returns({});
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "setFileTableDisabled");
      sandbox.stub(view, "disableControls");

      view.handlePackageUploadProgress({
        action: { memberPid: "data.1" },
        status: "running",
      });

      (view.packageSavePrepMessage === null).should.equal(true);
      sinon.assert.calledOnceWithExactly(
        view.disableControls,
        sinon.match(/\b2\/500 files\b/),
        sinon.match.string,
      );
    });

    it("refreshes the title-based metadata filename before upload", async function () {
      model.set({
        id: "metadata.1",
        fileName: "urn_uuid_metadata_1.xml",
        title: "Title",
      });
      model.setFileName = sandbox
        .stub()
        .callsFake(() => model.set("fileName", "Title.xml"));
      const metadataMember = {
        pid: "metadata.1",
        documents: [],
        fileName: "urn_uuid_metadata_1.xml",
        sysMeta: { fileName: "urn_uuid_metadata_1.xml" },
      };
      const rootDataPackage = {
        hasMetadataContentEdits: sandbox.stub().returns(true),
        getMember: sandbox.stub().returns(metadataMember),
        getPrimaryMetadataMember: sandbox.stub().returns(metadataMember),
        markMemberContentDirty: sandbox.stub().resolves(),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      view.emlView = { triggerChanges: sandbox.stub() };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "syncMetadataEntities");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });

      metadataMember.fileName.should.equal("Title.xml");
      metadataMember.sysMeta.fileName.should.equal("Title.xml");
      sinon.assert.notCalled(view.emlView.triggerChanges);
      sinon.assert.calledOnce(model.setFileName);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.markMemberContentDirty,
        "metadata.1",
      );
    });

    it("uses the stale-package message before the generic reload message", function () {
      view
        .getUploadErrorMessage({
          outcome: "stale_remote",
          reloadRequired: true,
        })
        .should.equal(
          "This package has been updated elsewhere. Reload the latest version before saving.",
        );
    });

    it("uses the generic uncertain-state message for cancelled uploads", function () {
      view
        .getUploadErrorMessage({
          outcome: "cancelled",
          reloadRequired: true,
        })
        .should.equal(
          "The upload state is uncertain. Reload the package before saving again.",
        );
    });

    it("requires reload after cancellation even without an ambiguous member", async function () {
      model.validationError = null;
      const rootDataPackage = {
        toArray: sandbox.stub().returns([]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        upload: sandbox.stub(),
      };
      rootDataPackage.upload
        .onFirstCall()
        .resolves({ outcome: "cancelled", reloadRequired: true });
      rootDataPackage.upload.onSecondCall().resolves({ outcome: "success" });
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "saveSuccess");
      sandbox.stub(view, "saveError");

      await view.save({ target: $("<button></button>")[0] });
      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnce(rootDataPackage.upload);
      sinon.assert.notCalled(view.saveSuccess);
      sinon.assert.calledTwice(view.saveError);
      view.saveError
        .alwaysCalledWithExactly(
          "The upload state is uncertain. Reload the package before saving again.",
        )
        .should.equal(true);
    });

    it("uses the stale message for an upload preparation error", async function () {
      model.validationError = null;
      const staleError = Object.assign(new Error("metadata superseded"), {
        code: "stale_remote",
        reloadRequired: true,
      });
      const rootDataPackage = {
        toArray: sandbox.stub().returns([]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        upload: sandbox.stub().rejects(staleError),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "hideSaving");
      sandbox.stub(view, "setFileTableDisabled");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      const alert = globalThis.MetacatUI.appView.showAlert.firstCall.args[0];
      alert
        .find("p")
        .first()
        .text()
        .should.equal(
          "This package has been updated elsewhere. Reload the latest version before saving.",
        );
      alert.text().should.include("metadata superseded");
    });

    it("shows EML validation errors before failed-file cleanup or upload", async function () {
      const validationErrors = { title: "A title is required" };
      model.validate = sandbox.stub().returns(validationErrors);
      const failedNewMember = {
        pid: "data.failed",
        remotePid: null,
        remoteState: "failed",
        isData: sandbox.stub().returns(true),
      };
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "failed",
        isData: sandbox.stub().returns(true),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedNewMember, failedReplacement]),
        removeMembers: sandbox.stub().resolves(),
        discardFileReplacement: sandbox.stub().resolves(),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");

      await view.save({ target: $("<button></button>")[0] });

      model.validationError.should.deep.equal(validationErrors);
      sinon.assert.notCalled(view.showSaving);
      sinon.assert.notCalled(rootDataPackage.removeMembers);
      sinon.assert.notCalled(rootDataPackage.discardFileReplacement);
      sinon.assert.notCalled(rootDataPackage.upload);
    });

    it("does not save while file-table edits are still staging", async function () {
      view.fileTableEditInProgress = true;
      model.validate = sandbox.stub();
      const rootDataPackage = {
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "showSaving");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnce(view.toggleEnableControls);
      sinon.assert.notCalled(view.showSaving);
      sinon.assert.notCalled(model.validate);
      sinon.assert.notCalled(rootDataPackage.upload);
    });

    it("removes failed newly added files before saving the package", async function () {
      model.validationError = null;
      const failedNewMember = {
        pid: "data.failed",
        remotePid: null,
        remoteState: "failed",
        fileName: "failed.csv",
        lastUploadError: new Error("network down"),
        isData: sandbox.stub().returns(true),
      };
      const successResult = { outcome: "success" };
      const failedRemoteMember = {
        pid: "data.remote",
        remotePid: "data.remote",
        remoteState: "failed",
        isData: sandbox.stub().returns(true),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedNewMember, failedRemoteMember]),
        removeMembers: sandbox.stub().resolves([failedNewMember]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        upload: sandbox.stub().resolves(successResult),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnceWithExactly(rootDataPackage.removeMembers, [
        "data.failed",
      ]);
      sinon.assert.callOrder(
        rootDataPackage.removeMembers,
        rootDataPackage.upload,
      );
      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.calledOnce(rootDataPackage.upload);
      sinon.assert.calledWithExactly(view.saveSuccess, successResult, {
        skippedFileReplacements: [],
        skippedNewDataFiles: ["failed.csv - network down"],
      });
    });

    it("reports failed-file cleanup errors without starting package upload", async function () {
      model.validationError = null;
      const failedNewMember = {
        pid: "data.failed",
        remotePid: null,
        remoteState: "failed",
        isData: sandbox.stub().returns(true),
      };
      const cleanupError = new Error("ResourceMap update failed");
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedNewMember]),
        removeMembers: sandbox.stub().rejects(cleanupError),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "saveError");
      sandbox.stub(view, "showSaving");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnceWithExactly(
        view.saveError,
        "ResourceMap update failed",
      );
      sinon.assert.notCalled(view.showSaving);
      sinon.assert.notCalled(rootDataPackage.upload);
    });

    it("stops before saving an already-stale file replacement", async function () {
      model.validationError = null;
      const staleError = Object.assign(new Error("updated elsewhere"), {
        code: "stale_remote",
        reloadRequired: true,
      });
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "failed",
        fileName: "data.csv",
        lastUploadError: staleError,
        isData: sandbox.stub().returns(true),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedReplacement]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        discardFileReplacement: sandbox.stub().resolves(),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "saveSuccess");
      sandbox.stub(view, "saveError");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.notCalled(view.showSaving);
      sinon.assert.notCalled(rootDataPackage.discardFileReplacement);
      sinon.assert.notCalled(rootDataPackage.upload);
      sinon.assert.notCalled(view.saveSuccess);
      sinon.assert.calledOnceWithExactly(
        view.saveError,
        "This package has been updated elsewhere. Reload the latest version before saving.",
      );
    });

    it("stops before cleanup when metadata state is stale", async function () {
      model.validationError = null;
      const staleMetadata = {
        pid: "metadata.2",
        remoteState: "failed",
        lastUploadError: Object.assign(new Error("updated elsewhere"), {
          code: "stale_remote",
          reloadRequired: true,
        }),
        isData: sandbox.stub().returns(false),
      };
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "failed",
        lastUploadError: new Error("replacement rejected"),
        isData: sandbox.stub().returns(true),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([staleMetadata, failedReplacement]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns(staleMetadata),
        discardFileReplacement: sandbox.stub().resolves(),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "saveSuccess");
      sandbox.stub(view, "saveError");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.notCalled(view.showSaving);
      sinon.assert.notCalled(rootDataPackage.discardFileReplacement);
      sinon.assert.notCalled(rootDataPackage.upload);
      sinon.assert.notCalled(view.saveSuccess);
      sinon.assert.calledOnceWithExactly(
        view.saveError,
        "This package has been updated elsewhere. Reload the latest version before saving.",
      );
    });

    it("stops before cleanup when a package member is ambiguous", async function () {
      model.validationError = null;
      const ambiguousMetadata = {
        pid: "metadata.2",
        remoteState: "ambiguous",
        lastUploadError: new Error("write result unknown"),
        isData: sandbox.stub().returns(false),
      };
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "failed",
        lastUploadError: new Error("replacement rejected"),
        isData: sandbox.stub().returns(true),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([ambiguousMetadata, failedReplacement]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns(ambiguousMetadata),
        discardFileReplacement: sandbox.stub().resolves(),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "saveSuccess");
      sandbox.stub(view, "saveError");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.notCalled(view.showSaving);
      sinon.assert.notCalled(rootDataPackage.discardFileReplacement);
      sinon.assert.notCalled(rootDataPackage.upload);
      sinon.assert.notCalled(view.saveSuccess);
      sinon.assert.calledOnceWithExactly(
        view.saveError,
        "The upload state is uncertain. Reload the package before saving again.",
      );
    });

    it("retries a save without failed file replacements", async function () {
      model.validationError = null;
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "pending",
        fileName: "data.csv",
        lastUploadError: new Error("replacement rejected"),
        isData: sandbox.stub().returns(true),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedReplacement]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        discardFileReplacement: sandbox.stub().callsFake(async () => {
          failedReplacement.remoteState = "uploaded";
          failedReplacement.pid = "data.1";
        }),
        upload: sandbox.stub(),
      };
      const successResult = { outcome: "success" };
      rootDataPackage.upload.onFirstCall().callsFake(async () => {
        failedReplacement.remoteState = "failed";
        return { outcome: "partial_failure", reloadRequired: false };
      });
      rootDataPackage.upload.onSecondCall().resolves(successResult);
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledTwice(rootDataPackage.upload);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.discardFileReplacement,
        "data.2",
      );
      sinon.assert.calledWithExactly(view.saveSuccess, successResult, {
        skippedFileReplacements: ["data.csv - replacement rejected"],
        skippedNewDataFiles: [],
      });
    });

    it("requires reload when the replacement retry becomes ambiguous", async function () {
      model.validationError = null;
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "pending",
        fileName: "data.csv",
        lastUploadError: new Error("replacement rejected"),
        isData: sandbox.stub().returns(true),
      };
      const metadataMember = {
        pid: "metadata.2",
        remoteState: "pending",
        isData: sandbox.stub().returns(false),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedReplacement, metadataMember]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns(metadataMember),
        discardFileReplacement: sandbox.stub().callsFake(async () => {
          failedReplacement.remoteState = "uploaded";
          failedReplacement.pid = "data.1";
        }),
        upload: sandbox.stub(),
      };
      rootDataPackage.upload.onFirstCall().callsFake(async () => {
        failedReplacement.remoteState = "failed";
        return { outcome: "partial_failure", reloadRequired: false };
      });
      rootDataPackage.upload.onSecondCall().callsFake(async () => {
        metadataMember.remoteState = "ambiguous";
        return { outcome: "partial_failure", reloadRequired: false };
      });
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "saveSuccess");
      sandbox.stub(view, "saveError");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledTwice(rootDataPackage.upload);
      sinon.assert.calledOnce(rootDataPackage.discardFileReplacement);
      sinon.assert.notCalled(view.saveSuccess);
      sinon.assert.calledOnceWithExactly(
        view.saveError,
        "The upload state is uncertain. Reload the package before saving again.",
      );
    });

    it("does not discard or retry a stale file replacement", async function () {
      model.validationError = null;
      const staleError = Object.assign(new Error("updated elsewhere"), {
        code: "stale_remote",
        reloadRequired: true,
      });
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "pending",
        fileName: "data.csv",
        lastUploadError: null,
        isData: sandbox.stub().returns(true),
      };
      const staleResult = {
        outcome: "stale_remote",
        reloadRequired: true,
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedReplacement]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        discardFileReplacement: sandbox.stub().callsFake(async () => {
          failedReplacement.remoteState = "uploaded";
          failedReplacement.pid = "data.1";
        }),
        upload: sandbox.stub().callsFake(async () => {
          failedReplacement.remoteState = "failed";
          failedReplacement.lastUploadError = staleError;
          return staleResult;
        }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "hideSaving");
      sandbox.stub(view, "setFileTableDisabled");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnce(rootDataPackage.upload);
      sinon.assert.notCalled(rootDataPackage.discardFileReplacement);
      sinon.assert.notCalled(view.saveSuccess);
      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      const alert = globalThis.MetacatUI.appView.showAlert.firstCall.args[0];
      alert
        .find("p")
        .first()
        .text()
        .should.equal(
          "This package has been updated elsewhere. Reload the latest version before saving.",
        );
      alert.text().should.not.include("Save the dataset again");
    });

    it("does not discard or retry while another member is ambiguous", async function () {
      model.validationError = null;
      const failedReplacement = {
        pid: "data.2",
        remotePid: "data.1",
        remoteState: "pending",
        fileName: "data.csv",
        lastUploadError: new Error("replacement rejected"),
        isData: sandbox.stub().returns(true),
      };
      const ambiguousMember = {
        pid: "metadata.2",
        remoteState: "pending",
        isData: sandbox.stub().returns(false),
      };
      const rootDataPackage = {
        toArray: sandbox.stub().returns([failedReplacement, ambiguousMember]),
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getChangedMembers: sandbox.stub().returns([]),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        discardFileReplacement: sandbox.stub().resolves(),
        upload: sandbox.stub().callsFake(async () => {
          failedReplacement.remoteState = "failed";
          ambiguousMember.remoteState = "ambiguous";
          return { outcome: "partial_failure", reloadRequired: false };
        }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "hideSaving");
      sandbox.stub(view, "setFileTableDisabled");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnce(rootDataPackage.upload);
      sinon.assert.notCalled(rootDataPackage.discardFileReplacement);
      sinon.assert.notCalled(view.saveSuccess);
      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      const alert = globalThis.MetacatUI.appView.showAlert.firstCall.args[0];
      alert
        .find("p")
        .first()
        .text()
        .should.equal(
          "The upload state is uncertain. Reload the package before saving again.",
        );
      alert.text().should.not.include("Save the dataset again");
    });

    it("shows model validation errors from package validation failures", async function () {
      const validationErrors = { title: "A title is required" };
      const error = Object.assign(
        new Error("Cannot upload: validation failed"),
        {
          code: "validation_failure",
          issues: [
            {
              pid: "metadata.1",
              message: "Invalid metadata content",
              errors: validationErrors,
            },
          ],
        },
      );
      const rootDataPackage = {
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        upload: sandbox.stub().rejects(error),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "hideSaving");
      sandbox.stub(view, "saveError");
      sandbox.stub(view, "setFileTableDisabled");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.fileUploadProgressByPid = { "data.1": 42 };
      view.packageSaveUploadCount = 1;
      view.packageSaveUploadTotal = 1;
      view.packageSavePrepMessage = "Saving...";
      view.packageSavePendingPids = new Set(["data.1"]);
      view.stopListening(model, "invalid");

      await view.save({ target: $("<button></button>")[0] });

      model.validationError.should.deep.equal(validationErrors);
      view.fileUploadProgressByPid.should.deep.equal({});
      (view.packageSaveUploadCount === null).should.equal(true);
      (view.packageSaveUploadTotal === null).should.equal(true);
      (view.packageSavePrepMessage === null).should.equal(true);
      (view.packageSavePendingPids === null).should.equal(true);
      sinon.assert.calledOnce(view.hideSaving);
      sinon.assert.calledWith(view.setFileTableDisabled, false);
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.calledTwice(view.toggleEnableControls);
      sinon.assert.notCalled(view.saveError);
    });

    it("includes package validation issue messages in save errors", async function () {
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
      const rootDataPackage = {
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getPrimaryMetadataMember: sandbox.stub().returns({
          pid: "metadata.1",
          contentDirty: false,
        }),
        upload: sandbox.stub().rejects(error),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "saveError");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.calledOnceWithExactly(view.saveError, mismatchMessage);
    });

    it("does not version metadata for a data-item access-policy save", async function () {
      model.set("id", "metadata.1");
      model.setFileName = sandbox.stub();
      const metadataMember = {
        pid: "metadata.1",
        contentDirty: false,
      };
      const rootDataPackage = {
        hasMetadataContentEdits: sandbox.stub().returns(false),
        getMember: sandbox.stub().returns(metadataMember),
        getPrimaryMetadataMember: sandbox.stub().returns(metadataMember),
        markMemberContentDirty: sandbox.stub().resolves(),
        upload: sandbox.stub().resolves({ outcome: "success" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      view.emlView = {
        triggerChanges: sandbox.stub(),
      };
      sandbox.stub(view, "showSaving");
      sandbox.stub(view, "syncMetadataEntities");
      sandbox.stub(view, "saveSuccess");

      await view.save({ target: $("<button></button>")[0] });

      sinon.assert.notCalled(view.emlView.triggerChanges);
      sinon.assert.notCalled(model.setFileName);
      sinon.assert.notCalled(view.syncMetadataEntities);
      sinon.assert.notCalled(rootDataPackage.markMemberContentDirty);
      sinon.assert.calledOnce(rootDataPackage.upload);
    });

    it("renders a data member's access policy through a Backbone facade", async function () {
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        sysMeta: null,
        isMetadata: () => false,
        isResourceMap: () => false,
        isAuthorized_write: true,
        checkPermission: sandbox.stub().resolves(true),
        getFileName: () => "a.csv",
      };
      member.fetchSysMeta = sandbox.stub().callsFake(async () => {
        member.sysMeta = {
          accessPolicy: {
            toJSON: () => [{ subjects: ["public"], permissions: ["read"] }],
          },
        };
      });
      const authorizationService = {};
      const rootDataPackage = {
        getAuthorizationService: sandbox.stub().returns(authorizationService),
        getMember: sandbox.stub().withArgs("data.1").returns(member),
        setMemberAccessPolicy: sandbox.stub().resolves(member),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      const showAccessPolicyLoadingModal = sandbox
        .stub(EditorView.prototype, "showAccessPolicyLoadingModal")
        .returns(true);
      const showAccessPolicyModal = sandbox.stub(
        EditorView.prototype,
        "showAccessPolicyModal",
      );
      const rowModel = new Backbone.Model({ id: "data.1", kind: "data" });

      const shown = await view.showFileTableAccessPolicy(rowModel, {});

      shown.should.equal(true);
      sinon.assert.calledOnceWithExactly(member.fetchSysMeta, {
        useCache: false,
      });
      sinon.assert.calledOnceWithExactly(
        member.checkPermission,
        "changePermission",
        { refresh: true },
        authorizationService,
      );
      sinon.assert.callOrder(
        showAccessPolicyLoadingModal,
        member.fetchSysMeta,
        showAccessPolicyModal,
      );

      const options =
        showAccessPolicyModal.firstCall.args[
          showAccessPolicyModal.firstCall.args.length - 1
        ];
      options.packageLevel.should.equal(false);
      options.policy.should.equal(member.sysMeta.accessPolicy);
      options.policyContext.should.deep.equal({
        fileName: "a.csv",
        rightsHolder: null,
        canChangePermission: true,
        targetPid: "data.1",
        type: "DataONEObject",
      });
      await options.onApply(options.policy, { propagate: false });
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.setMemberAccessPolicy,
        "data.1",
        member.sysMeta.accessPolicy,
      );
    });

    it("does not treat write permission as permission to edit sharing", async function () {
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        sysMeta: {
          accessPolicy: {
            toJSON: () => [],
          },
        },
        fetchSysMeta: sandbox.stub().resolves(),
        isMetadata: () => false,
        isResourceMap: () => false,
        isAuthorized_write: true,
        checkPermission: sandbox.stub().resolves(false),
        getFileName: () => "a.csv",
      };
      const authorizationService = {};
      const rootDataPackage = {
        getAuthorizationService: sandbox.stub().returns(authorizationService),
        getMember: sandbox.stub().withArgs("data.1").returns(member),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox
        .stub(EditorView.prototype, "showAccessPolicyLoadingModal")
        .returns(true);
      const showAccessPolicyModal = sandbox.stub(
        EditorView.prototype,
        "showAccessPolicyModal",
      );
      const rowModel = new Backbone.Model({ id: "data.1", kind: "data" });

      await view.showFileTableAccessPolicy(rowModel, {});

      const options =
        showAccessPolicyModal.firstCall.args[
          showAccessPolicyModal.firstCall.args.length - 1
        ];
      options.policyContext.canChangePermission.should.equal(false);
      sinon.assert.calledOnceWithExactly(
        member.checkPermission,
        "changePermission",
        { refresh: true },
        authorizationService,
      );
    });

    it("does not open file-table sharing when dataset sharing is disabled", async function () {
      const rootDataPackage = {
        getMember: sandbox.stub(),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get: (key) => {
            if (key === "allowAccessPolicyChanges") return true;
            if (key === "allowAccessPolicyChangesDatasets") return false;
            return null;
          },
        },
        rootDataPackage,
      };
      const showAccessPolicyLoadingModal = sandbox.stub(
        EditorView.prototype,
        "showAccessPolicyLoadingModal",
      );
      const rowModel = new Backbone.Model({ id: "data.1", kind: "data" });

      const shown = await view.showFileTableAccessPolicy(rowModel, {});

      shown.should.equal(false);
      sinon.assert.notCalled(rootDataPackage.getMember);
      sinon.assert.notCalled(showAccessPolicyLoadingModal);
    });

    it("opens root sharing as a package-level access policy", async function () {
      const member = {
        pid: "resource_map_1",
        remotePid: "resource_map_1",
        sysMeta: {
          accessPolicy: {
            toJSON: () => [],
          },
        },
        fetchSysMeta: sandbox.stub().resolves(),
        isMetadata: () => false,
        isResourceMap: () => true,
        isAuthorized_write: true,
        checkPermission: sandbox.stub().resolves(true),
        getFileName: () => "resource_map_1",
      };
      const authorizationService = {};
      const rootDataPackage = {
        getAuthorizationService: sandbox.stub().returns(authorizationService),
        getRootResourceMapMember: sandbox.stub().returns(member),
        setPackageAccessPolicy: sandbox.stub().resolves([member]),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      const showAccessPolicyLoadingModal = sandbox
        .stub(EditorView.prototype, "showAccessPolicyLoadingModal")
        .returns(true);
      const showAccessPolicyModal = sandbox.stub(
        EditorView.prototype,
        "showAccessPolicyModal",
      );
      const rowModel = new Backbone.Model({
        id: "dataset:resource_map_1",
        kind: "dataset",
      });

      const shown = await view.showFileTableAccessPolicy(rowModel, {});

      shown.should.equal(true);
      sinon.assert.calledOnce(showAccessPolicyLoadingModal);
      sinon.assert.calledOnceWithExactly(
        member.checkPermission,
        "changePermission",
        { refresh: true },
        authorizationService,
      );
      const options =
        showAccessPolicyModal.firstCall.args[
          showAccessPolicyModal.firstCall.args.length - 1
        ];
      options.policyContext.type.should.equal("DataPackage");
      // Package-level sharing broadcasts to the whole package on apply.
      options.packageLevel.should.equal(true);
      const onProgress = sandbox.stub();
      await options.onApply(options.policy, { propagate: true, onProgress });
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.setPackageAccessPolicy,
        member.sysMeta.accessPolicy,
        { propagate: true, onProgress },
      );
    });

    it("shows an error in the sharing modal when sysmeta cannot load", async function () {
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        sysMeta: null,
        fetchSysMeta: sandbox.stub().rejects(new Error("sysmeta failed")),
        isMetadata: () => false,
        isResourceMap: () => false,
        isAuthorized_write: true,
        checkPermission: sandbox.stub().resolves(true),
        getFileName: () => "a.csv",
      };
      const rootDataPackage = {
        getMember: sandbox.stub().withArgs("data.1").returns(member),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      const showAccessPolicyLoadingModal = sandbox
        .stub(EditorView.prototype, "showAccessPolicyLoadingModal")
        .returns(true);
      const showAccessPolicyLoadError = sandbox.stub(
        EditorView.prototype,
        "showAccessPolicyLoadError",
      );
      const showAccessPolicyModal = sandbox.stub(
        EditorView.prototype,
        "showAccessPolicyModal",
      );
      const consoleError = sandbox.stub(console, "error");
      const rowModel = new Backbone.Model({ id: "data.1", kind: "data" });

      const shown = await view.showFileTableAccessPolicy(rowModel, {});

      shown.should.equal(true);
      sinon.assert.calledOnce(showAccessPolicyLoadingModal);
      sinon.assert.calledOnceWithExactly(member.fetchSysMeta, {
        useCache: false,
      });
      sinon.assert.calledOnceWithExactly(
        showAccessPolicyLoadError,
        "Sharing settings could not be loaded. Please try again.",
      );
      sinon.assert.notCalled(showAccessPolicyModal);
      sinon.assert.calledOnce(consoleError);
    });

    it("does not reopen sharing when the loading modal was closed", async function () {
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        sysMeta: null,
        isMetadata: () => false,
        isResourceMap: () => false,
        isAuthorized_write: true,
        checkPermission: sandbox.stub().resolves(true),
        getFileName: () => "a.csv",
      };
      member.fetchSysMeta = sandbox.stub().callsFake(async () => {
        member.sysMeta = {
          accessPolicy: {
            toJSON: () => [{ subjects: ["public"], permissions: ["read"] }],
          },
        };
      });
      const rootDataPackage = {
        getMember: sandbox.stub().withArgs("data.1").returns(member),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox
        .stub(EditorView.prototype, "showAccessPolicyLoadingModal")
        .returns(true);
      const showAccessPolicyModal = sandbox.stub(
        EditorView.prototype,
        "showAccessPolicyModal",
      );
      sandbox.stub(view, "$").callsFake((selector) => {
        if (String(selector).includes("access-policy-view-modal")) {
          return {
            length: 1,
            hasClass: () => false,
            is: () => false,
          };
        }
        return Backbone.View.prototype.$.call(view, selector);
      });
      const rowModel = new Backbone.Model({ id: "data.1", kind: "data" });

      const shown = await view.showFileTableAccessPolicy(rowModel, {});

      shown.should.equal(true);
      sinon.assert.calledOnce(member.fetchSysMeta);
      sinon.assert.notCalled(showAccessPolicyModal);
    });

    it("adds missing otherEntity nodes for documented data members", function () {
      const rootDataPackage = createEditorRootDataPackage({
        members: [
          { pid: "resource_map_1", formatType: "RESOURCE" },
          {
            pid: "metadata.1",
            formatType: "METADATA",
            documents: ["data.1"],
          },
          {
            pid: "data.1",
            formatType: "DATA",
            formatId: "text/plain",
            fileName: "data.txt",
          },
        ],
      });
      const metadataMember = rootDataPackage.getMember("metadata.1");
      const metadataModel = new Backbone.Model({ id: "metadata.1" });
      metadataModel.getEntity = sandbox
        .stub()
        .throws(new Error("unexpected entity scan"));
      metadataModel.addEntity = sandbox.stub();
      metadataMember.objectModel = metadataModel;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      view.metadataEntitySyncNeeded = true;

      view.syncMetadataEntities(metadataMember);

      sinon.assert.calledOnce(metadataModel.addEntity);
      const entity = metadataModel.addEntity.firstCall.args[0];
      entity.get("entityName").should.equal("data.txt");
      entity.get("entityType").should.equal("text/plain");
      entity.getDataPid().should.equal("data.1");
      entity.get("xmlID").should.equal("data.1");
      sinon.assert.notCalled(metadataModel.getEntity);
      view.entityByMemberPid.get("data.1").should.equal(entity);
      view.metadataEntitySyncNeeded.should.equal(false);
    });

    it("syncs existing entities by PID, XML ID, and filename without scanning per member", function () {
      const rootDataPackage = createEditorRootDataPackage({
        members: [
          { pid: "resource_map_1", formatType: "RESOURCE" },
          {
            pid: "metadata.1",
            formatType: "METADATA",
            documents: ["data.pid", "data.xml", "data.filename"],
          },
          {
            pid: "data.pid",
            formatType: "DATA",
            formatId: "text/csv",
            fileName: "pid.csv",
          },
          {
            pid: "data.xml",
            formatType: "DATA",
            formatId: "text/plain",
            fileName: "xml.txt",
          },
          {
            pid: "data.filename",
            formatType: "DATA",
            formatId: "image/tiff",
            fileName: "image.tif",
          },
        ],
      });
      const metadataMember = rootDataPackage.getMember("metadata.1");
      const pidEntity = new Backbone.Model({ downloadID: "data.pid" });
      pidEntity.getDataPid = function () {
        return this.get("downloadID") || null;
      };
      const xmlEntity = new Backbone.Model({ xmlID: "data.xml" });
      xmlEntity.getDataPid = function () {
        return this.get("downloadID") || null;
      };
      const filenameEntity = new Backbone.Model({ entityName: "image.tif" });
      filenameEntity.getDataPid = function () {
        return this.get("downloadID") || null;
      };
      const metadataModel = new Backbone.Model({
        id: "metadata.1",
        entities: new Backbone.Collection([
          pidEntity,
          xmlEntity,
          filenameEntity,
        ]),
      });
      metadataModel.getEntity = sandbox
        .stub()
        .throws(new Error("unexpected entity scan"));
      metadataModel.addEntity = sandbox.stub();
      metadataMember.objectModel = metadataModel;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };

      view.syncMetadataEntities(metadataMember);

      sinon.assert.notCalled(metadataModel.getEntity);
      sinon.assert.notCalled(metadataModel.addEntity);
      view.entityByMemberPid.get("data.pid").should.equal(pidEntity);
      view.entityByMemberPid.get("data.xml").should.equal(xmlEntity);
      view.entityByMemberPid.get("data.filename").should.equal(filenameEntity);
      filenameEntity.get("downloadID").should.equal("data.filename");
      filenameEntity.get("entityType").should.equal("image/tiff");
      filenameEntity.get("xmlID").should.equal("data.filename");
    });

    it("syncs EML entities when files are added from the file table", async function () {
      const metadataMember = {
        pid: "metadata.1",
        documents: ["data.1"],
      };
      const addedMember = {
        pid: "data.1",
        formatType: "DATA",
        fileName: "data.txt",
      };
      const rootDataPackage = {
        stageLocalFiles: sandbox.stub().callsFake(() => {
          view.fileTableEditInProgress.should.equal(true);
          return Promise.resolve([addedMember]);
        }),
        linkStagedFiles: sandbox.stub().resolves([addedMember]),
        getMember: sandbox
          .stub()
          .withArgs("metadata.1")
          .returns(metadataMember),
        getPrimaryMetadataMember: sandbox.stub().returns(metadataMember),
        markMemberContentDirty: sandbox.stub().resolves(metadataMember),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "syncMetadataEntities");
      sandbox.stub(view, "waitForNextPaint").resolves();
      const rowModel = new Backbone.Model({
        kind: "metadata",
        id: "metadata.1",
      });
      const file = new Blob(["data"], { type: "text/plain" });

      const added = await view.addFilesFromFileTable(rowModel, [file]);

      added.should.deep.equal([addedMember]);
      sinon.assert.calledOnceWithExactly(rootDataPackage.stageLocalFiles, [
        file,
      ]);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.linkStagedFiles,
        [addedMember],
        {
          metadataPid: "metadata.1",
          atLocation: "",
        },
      );
      sinon.assert.calledOnceWithExactly(
        view.syncMetadataEntities,
        metadataMember,
      );
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.markMemberContentDirty,
        "metadata.1",
      );
      view.fileTableEditInProgress.should.equal(false);
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.callOrder(
        rootDataPackage.stageLocalFiles,
        view.refreshFileTable,
        view.waitForNextPaint,
        rootDataPackage.linkStagedFiles,
        view.syncMetadataEntities,
        rootDataPackage.markMemberContentDirty,
      );
      sinon.assert.calledOnce(view.toggleControls);
      sinon.assert.calledThrice(view.toggleEnableControls);
    });

    it("reports metadata follow-up failure after files are linked", async function () {
      const metadataMember = {
        pid: "metadata.1",
        documents: ["data.1"],
      };
      const addedMember = {
        pid: "data.1",
        formatType: "DATA",
        fileName: "data.txt",
      };
      const rootDataPackage = {
        stageLocalFiles: sandbox.stub().resolves([addedMember]),
        linkStagedFiles: sandbox.stub().resolves([addedMember]),
        getMember: sandbox
          .stub()
          .withArgs("metadata.1")
          .returns(metadataMember),
        getPrimaryMetadataMember: sandbox.stub().returns(metadataMember),
        markMemberContentDirty: sandbox
          .stub()
          .rejects(new Error("Metadata update failed")),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "syncMetadataEntities");
      sandbox.stub(view, "waitForNextPaint").resolves();
      const rowModel = new Backbone.Model({
        kind: "metadata",
        id: "metadata.1",
      });
      const file = new Blob(["data"], { type: "text/plain" });

      const added = await view.addFilesFromFileTable(rowModel, [file]);

      added.should.deep.equal([addedMember]);
      sinon.assert.calledTwice(view.refreshFileTable);
      sinon.assert.calledOnceWithExactly(
        globalThis.MetacatUI.appView.showAlert,
        sinon
          .match("files were added")
          .and(sinon.match("metadata could not be updated"))
          .and(sinon.match("Metadata update failed")),
        "alert-warning",
        view.$el,
        10000,
        { remove: true },
      );
      rootDataPackage.linkStagedFiles.firstCall.callId.should.be.lessThan(
        view.syncMetadataEntities.firstCall.callId,
      );
      view.syncMetadataEntities.firstCall.callId.should.be.lessThan(
        rootDataPackage.markMemberContentDirty.firstCall.callId,
      );
      rootDataPackage.markMemberContentDirty.firstCall.callId.should.be.lessThan(
        view.refreshFileTable.secondCall.callId,
      );
      view.refreshFileTable.secondCall.callId.should.be.lessThan(
        globalThis.MetacatUI.appView.showAlert.firstCall.callId,
      );
      view.fileTableEditInProgress.should.equal(false);
      sinon.assert.calledThrice(view.toggleEnableControls);
    });

    it("passes explicit folder row locations when files are added from the file table", async function () {
      const metadataMember = {
        pid: "metadata.1",
        documents: ["data.1"],
      };
      const addedMember = {
        pid: "data.1",
        formatType: "DATA",
        fileName: "data.txt",
      };
      const rootDataPackage = {
        stageLocalFiles: sandbox.stub().resolves([addedMember]),
        linkStagedFiles: sandbox.stub().resolves([addedMember]),
        getMember: sandbox
          .stub()
          .withArgs("metadata.1")
          .returns(metadataMember),
        getPrimaryMetadataMember: sandbox.stub().returns(metadataMember),
        markMemberContentDirty: sandbox.stub().resolves(metadataMember),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "syncMetadataEntities");
      sandbox.stub(view, "waitForNextPaint").resolves();
      const rowModel = new Backbone.Model({
        kind: "folder",
        id: "folder:measurements/qc",
        atLocation: "measurements/qc",
      });
      const file = new Blob(["data"], { type: "text/plain" });

      const added = await view.addFilesFromFileTable(rowModel, [file]);

      added.should.deep.equal([addedMember]);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.linkStagedFiles,
        [addedMember],
        {
          metadataPid: "metadata.1",
          atLocation: "measurements/qc",
        },
      );
      sinon.assert.calledOnceWithExactly(
        view.syncMetadataEntities,
        metadataMember,
      );
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.markMemberContentDirty,
        "metadata.1",
      );
    });

    it("shows an alert when adding files from the file table fails", async function () {
      const rootDataPackage = {
        stageLocalFiles: sandbox
          .stub()
          .rejects(new Error("Cannot upload an empty file")),
        linkStagedFiles: sandbox.stub(),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "refreshFileTable");
      const rowModel = new Backbone.Model({
        kind: "metadata",
        id: "metadata.1",
      });
      const file = new Blob(["data"], { type: "text/plain" });

      const added = await view.addFilesFromFileTable(rowModel, [file]);

      added.should.deep.equal([]);
      view.fileTableEditInProgress.should.equal(false);
      sinon.assert.calledOnceWithExactly(rootDataPackage.stageLocalFiles, [
        file,
      ]);
      sinon.assert.notCalled(rootDataPackage.linkStagedFiles);
      sinon.assert.notCalled(view.refreshFileTable);
      sinon.assert.calledTwice(view.toggleEnableControls);
      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Failed to add files",
      );
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Cannot upload an empty file",
      );
    });

    it("refreshes staged rows away when linking added files fails", async function () {
      const addedMember = {
        pid: "data.1",
        formatType: "DATA",
        fileName: "data.txt",
      };
      const rootDataPackage = {
        stageLocalFiles: sandbox.stub().resolves([addedMember]),
        linkStagedFiles: sandbox
          .stub()
          .rejects(new Error("ResourceMap update failed")),
        getPrimaryMetadataMember: sandbox.stub().returns({ pid: "metadata.1" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "toggleControls");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "waitForNextPaint").resolves();
      const rowModel = new Backbone.Model({
        kind: "metadata",
        id: "metadata.1",
      });
      const file = new Blob(["data"], { type: "text/plain" });

      const added = await view.addFilesFromFileTable(rowModel, [file]);

      added.should.deep.equal([]);
      view.fileTableEditInProgress.should.equal(false);
      sinon.assert.calledOnceWithExactly(rootDataPackage.stageLocalFiles, [
        file,
      ]);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.linkStagedFiles,
        [addedMember],
        {
          metadataPid: "metadata.1",
          atLocation: "",
        },
      );
      sinon.assert.calledTwice(view.refreshFileTable);
      sinon.assert.callOrder(
        rootDataPackage.stageLocalFiles,
        view.refreshFileTable,
        view.waitForNextPaint,
        rootDataPackage.linkStagedFiles,
        globalThis.MetacatUI.appView.showAlert,
      );
      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Failed to add files",
      );
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "ResourceMap update failed",
      );
    });

    it("does not start a replacement when file selection is cancelled", async function () {
      const rootDataPackage = {
        getMember: sandbox.stub(),
        getVersionTracker: sandbox.stub(),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      sandbox.stub(view, "choosePackageFiles").resolves([]);
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "startFileReplacementPreview");
      sandbox.stub(view, "finishFileReplacementPreview");
      const event = { preventDefault: sandbox.stub() };

      const handled = await view.handleFileTableAction(
        new Backbone.Model({ id: "data.1" }),
        new Backbone.Model({ id: "replace" }),
        event,
      );

      handled.should.equal(false);
      sinon.assert.calledOnce(event.preventDefault);
      sinon.assert.notCalled(rootDataPackage.getMember);
      sinon.assert.notCalled(rootDataPackage.getVersionTracker);
      sinon.assert.notCalled(view.toggleEnableControls);
      sinon.assert.notCalled(view.startFileReplacementPreview);
      sinon.assert.notCalled(view.finishFileReplacementPreview);
    });

    it("replaces the selected file immediately when it is the latest version", async function () {
      const file = new Blob(["replacement"], { type: "text/plain" });
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        getFormatType: sandbox.stub().returns("DATA"),
      };
      const updateRow = sandbox.stub().returns({});
      const getLatestVersion = sandbox.stub().callsFake(async () => {
        view.fileTableEditInProgress.should.equal(true);
        sinon.assert.calledOnceWithExactly(updateRow, "data.1", {
          status: {
            title: "Uploading now. This file is being saved to the repository.",
            iconClass: "icon icon-circle-blank warning icon-large",
            className: "status-uploading",
            progress: 0,
          },
        });
        return "data.1";
      });
      const rootDataPackage = {
        cancelEagerUpload: sandbox.stub().returns(true),
        getMember: sandbox.stub().withArgs("data.1").returns(member),
        getVersionTracker: sandbox.stub().returns({ getLatestVersion }),
        replaceFile: sandbox.stub().resolves(member),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "choosePackageFiles").resolves([file]);
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "showReplaceNewestVersionModal").resolves(false);
      view.fileTableView = {
        viewModel: {
          updateRow,
        },
      };
      const rowModel = new Backbone.Model({
        id: "data.1",
        label: "data.csv",
      });
      const actionModel = new Backbone.Model({ id: "replace" });
      const event = { preventDefault: sandbox.stub() };

      const handled = await view.handleFileTableAction(
        rowModel,
        actionModel,
        event,
      );

      handled.should.equal(true);
      sinon.assert.calledOnceWithExactly(getLatestVersion, "data.1", {
        useCache: false,
      });
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.replaceFile,
        "data.1",
        file,
      );
      sinon.assert.notCalled(view.showReplaceNewestVersionModal);
      view.fileTableEditInProgress.should.equal(false);
      sinon.assert.calledTwice(view.toggleEnableControls);
    });

    it("does not stage a replacement when the obsolete-file modal is cancelled", async function () {
      const file = new Blob(["replacement"], { type: "text/plain" });
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        fileName: "data.csv",
        size: 2048,
        dateSysMetadataModified: "2025-06-24T12:00:00Z",
      };
      const getLatestVersion = sandbox.stub().resolves("data.2");
      const getSysMeta = sandbox.stub().resolves({
        fileName: "latest.csv",
        size: 4096,
        dateSysMetadataModified: "2025-06-25T12:00:00Z",
      });
      const rootDataPackage = {
        cancelEagerUpload: sandbox.stub(),
        getMember: sandbox.stub().withArgs("data.1").returns(member),
        getVersionTracker: sandbox
          .stub()
          .returns({ getLatestVersion, getSysMeta }),
        replaceFile: sandbox.stub().resolves(member),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appModel: {
          get: sandbox
            .stub()
            .callsFake((key) =>
              key === "resolveServiceUrl"
                ? "https://repo.example/resolve/"
                : "",
            ),
        },
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "choosePackageFiles").resolves([file]);
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      sandbox.stub(view, "showReplaceNewestVersionModal").resolves(false);
      const updateRow = sandbox.stub().returns({});
      view.fileTableView = {
        viewModel: {
          updateRow,
        },
      };
      const rowModel = new Backbone.Model({
        id: "data.1",
        label: "data.csv",
        sizeLabel: "2 KiB",
        downloadUrl: "https://repo.example/resolve/data.1",
      });
      const actionModel = new Backbone.Model({ id: "replace" });
      const event = { preventDefault: sandbox.stub() };

      const handled = await view.handleFileTableAction(
        rowModel,
        actionModel,
        event,
      );

      handled.should.equal(true);
      sinon.assert.calledOnceWithExactly(getLatestVersion, "data.1", {
        useCache: false,
      });
      sinon.assert.calledOnceWithExactly(getSysMeta, "data.2", {
        useCache: false,
      });
      sinon.assert.notCalled(rootDataPackage.cancelEagerUpload);
      sinon.assert.notCalled(rootDataPackage.replaceFile);
      sinon.assert.calledOnce(updateRow);
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.calledTwice(view.toggleEnableControls);
      sinon.assert.calledOnce(view.showReplaceNewestVersionModal);
      const modalOptions = view.showReplaceNewestVersionModal.firstCall.args[0];
      modalOptions.rowId.should.equal("data.1");
      modalOptions.member.should.equal(member);
      modalOptions.latestPid.should.equal("data.2");
      modalOptions.sourceDetails.title.should.equal("data.csv");
      modalOptions.sourceDetails.size.should.equal("2 KiB");
      modalOptions.sourceDetails.downloadUrl.should.equal(
        "https://repo.example/resolve/data.1",
      );
      modalOptions.latestDetails.title.should.equal("latest.csv");
      modalOptions.latestDetails.size.should.equal("4 KiB");
      modalOptions.latestDetails.downloadUrl.should.equal(
        "https://repo.example/resolve/data.2",
      );
      modalOptions.file.should.equal(file);
      view.fileTableEditInProgress.should.equal(false);
    });

    it("stages a replacement against the newest PID when the modal is confirmed", async function () {
      const file = new Blob(["replacement"], { type: "text/plain" });
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        getFormatType: sandbox.stub().returns("DATA"),
      };
      const rootDataPackage = {
        cancelEagerUpload: sandbox.stub().returns(true),
        replaceFile: sandbox.stub().resolves(member),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "refreshFileTable");
      view.fileTableView = {
        viewModel: {
          updateRow: sandbox.stub().returns({}),
        },
      };

      const modalResult = view.showReplaceNewestVersionModal({
        rowId: "data.1",
        member,
        sourceDetails: {
          title: "Original file",
          size: "2 KiB",
          modified: "2025-06-24 08:00 EDT",
          downloadUrl: "https://repo.example/resolve/data.1",
        },
        latestPid: "data.2",
        latestDetails: {
          title: "Newest file",
          size: "4 KiB",
          modified: "2025-06-25 08:00 EDT",
          downloadUrl: "https://repo.example/resolve/data.2",
        },
        file,
      });
      const modalText = $(".replace-newest-version-modal").text();
      modalText.should.contain("Original file");
      modalText.should.contain("Newest file");
      modalText.should.contain("2 KiB");
      modalText.should.contain("4 KiB");
      modalText.should.not.contain("Selected row PID");
      modalText.should.not.contain("Newest file PID");
      modalText.should.not.contain("data.1");
      modalText.should.not.contain("data.2");
      $(
        ".replace-newest-version-modal .replace-newest-version-confirm",
      ).trigger("click");

      (await modalResult).should.equal(true);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.replaceFile,
        "data.1",
        file,
        { replacementSourcePid: "data.2" },
      );
    });

    it("shows an alert when the replace latest-version check fails", async function () {
      const file = new Blob(["replacement"], { type: "text/plain" });
      const member = {
        pid: "data.1",
        remotePid: "data.1",
      };
      const getLatestVersion = sandbox
        .stub()
        .rejects(new Error("Version service unavailable"));
      const rootDataPackage = {
        cancelEagerUpload: sandbox.stub(),
        getMember: sandbox.stub().withArgs("data.1").returns(member),
        getVersionTracker: sandbox.stub().returns({ getLatestVersion }),
        replaceFile: sandbox.stub(),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "choosePackageFiles").resolves([file]);
      sandbox.stub(view, "refreshFileTable");
      sandbox.stub(view, "toggleEnableControls");
      view.fileTableView = {
        viewModel: {
          updateRow: sandbox.stub().returns({}),
        },
      };
      const rowModel = new Backbone.Model({ id: "data.1" });
      const actionModel = new Backbone.Model({ id: "replace" });
      const event = { preventDefault: sandbox.stub() };

      const handled = await view.handleFileTableAction(
        rowModel,
        actionModel,
        event,
      );

      handled.should.equal(true);
      sinon.assert.calledOnceWithExactly(getLatestVersion, "data.1", {
        useCache: false,
      });
      sinon.assert.notCalled(rootDataPackage.cancelEagerUpload);
      sinon.assert.notCalled(rootDataPackage.replaceFile);
      sinon.assert.calledOnce(view.fileTableView.viewModel.updateRow);
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.calledTwice(view.toggleEnableControls);
      view.fileTableEditInProgress.should.equal(false);
      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Failed to replace the file",
      );
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Version service unavailable",
      );
    });

    it("shows an alert when replacing a file from the file table fails", async function () {
      const file = new Blob(["replacement"], { type: "text/plain" });
      const member = {
        pid: "data.1",
        remotePid: "data.1",
        getFormatType: sandbox.stub().returns("DATA"),
      };
      const getLatestVersion = sandbox.stub().resolves("data.1");
      const rootDataPackage = {
        cancelEagerUpload: sandbox.stub().returns(true),
        getMember: sandbox.stub().withArgs("data.1").returns(member),
        getVersionTracker: sandbox.stub().returns({ getLatestVersion }),
        replaceFile: sandbox
          .stub()
          .rejects(new Error("Identifier allocation failed")),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
        appView: {
          showAlert: sandbox.stub(),
        },
      };
      sandbox.stub(view, "choosePackageFiles").resolves([file]);
      sandbox.stub(view, "refreshFileTable");
      const updateRow = sandbox.stub().returns({});
      view.fileTableView = {
        viewModel: {
          updateRow,
        },
      };
      view.fileUploadProgressByPid = { "data.1": 20 };
      const rowModel = new Backbone.Model({ id: "data.1" });
      const actionModel = new Backbone.Model({ id: "replace" });
      const event = { preventDefault: sandbox.stub() };

      const handled = await view.handleFileTableAction(
        rowModel,
        actionModel,
        event,
      );

      handled.should.equal(true);
      sinon.assert.calledOnce(event.preventDefault);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.cancelEagerUpload,
        "data.1",
      );
      sinon.assert.calledOnceWithExactly(rootDataPackage.getMember, "data.1");
      chai.expect(view.fileUploadProgressByPid["data.1"]).to.equal(undefined);
      sinon.assert.calledOnceWithExactly(updateRow, "data.1", {
        status: {
          title: "Uploading now. This file is being saved to the repository.",
          iconClass: "icon icon-circle-blank warning icon-large",
          className: "status-uploading",
          progress: 0,
        },
      });
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.replaceFile,
        "data.1",
        file,
      );
      sinon.assert.calledOnce(view.refreshFileTable);
      sinon.assert.callOrder(
        updateRow,
        rootDataPackage.replaceFile,
        view.refreshFileTable,
      );
      sinon.assert.calledOnce(globalThis.MetacatUI.appView.showAlert);
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Failed to replace the file",
      );
      globalThis.MetacatUI.appView.showAlert.firstCall.args[0].should.contain(
        "Identifier allocation failed",
      );
    });

    it("removes a file table row immediately and refreshes when package removal fails", async function () {
      let rejectRemove;
      const removePromise = new Promise((resolve, reject) => {
        rejectRemove = reject;
      });
      const rootDataPackage = {
        removeMembers: sandbox.stub().returns(removePromise),
        getMember: sandbox.stub().returns({ pid: "data.1" }),
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage,
      };
      const removedRow = new Backbone.Model({
        id: "data.1",
        label: "data.csv",
      });
      const rows = new Backbone.Collection([removedRow]);
      const viewModel = {
        removeRow: sandbox.stub().callsFake((id) => {
          const row = rows.get(id);
          rows.remove(row);
          return row;
        }),
      };
      view.fileTableView = { viewModel };
      sandbox.stub(view, "refreshFileTable").callsFake(() => {
        rows.add(removedRow);
      });
      sandbox.stub(view, "showFullPageAlert");
      const rowModel = new Backbone.Model({ id: "data.1" });
      const actionModel = new Backbone.Model({ id: "remove" });
      const event = { preventDefault: sandbox.stub() };

      const handled = view.handleFileTableAction(rowModel, actionModel, event);

      sinon.assert.calledOnceWithExactly(viewModel.removeRow, "data.1");
      chai.expect(rows.get("data.1")).to.equal(undefined);

      rejectRemove(new Error("ResourceMap update failed"));
      (await handled).should.equal(true);

      chai.expect(rows.get("data.1")).to.equal(removedRow);
      sinon.assert.calledOnceWithExactly(
        rootDataPackage.removeMembers,
        "data.1",
      );
      sinon.assert.calledOnceWithExactly(rootDataPackage.getMember, "data.1");
      sinon.assert.calledOnce(view.showFullPageAlert);
      sinon.assert.calledOnce(view.refreshFileTable);
    });
  });
});
