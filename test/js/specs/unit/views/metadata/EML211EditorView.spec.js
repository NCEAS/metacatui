define([
  "jquery",
  "backbone",
  "models/dataONEServices/SysMetaService",
  "views/metadata/EML211EditorView",
], function (
  $,
  Backbone,
  SysMetaService,
  EML211EditorView,
) {
  describe("EML211EditorView", function () {
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

      // Spy on the methods that interact with the DOM
      sandbox.spy(view, "showError");
      sandbox.spy(view, "showLeafErrors");
    });

    afterEach(function () {
      globalThis.MetacatUI = originalMetacatUI;
      sandbox.restore();
    });

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

    it("should handle string error messages correctly in showError", function () {
      // Mock the category elements
      view.$ = sandbox.stub().returns({
        addClass: sandbox.stub().returnsThis(),
        text: sandbox.stub(),
        filter: sandbox.stub().returnsThis(),
        parents: sandbox.stub().returnsThis(),
        data: sandbox.stub().returnsThis(),
        find: sandbox.stub().returnsThis(),
        show: sandbox.stub(),
      });

      // Call the showError method
      view.showError("methodSteps.step1", "Error in step 1");

      // Assert that the appropriate DOM manipulation methods were called
      sinon.assert.calledWith(view.$, "[data-category='methodSteps.step1']");
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

      sinon.assert.calledOnceWithExactly(downloadStub, "pid.1");
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
      sandbox.stub(SysMetaService.prototype, "download").rejects(new Error("404"));

      await view.handleMetadataNotFound();

      sinon.assert.notCalled(view.showNotIndexed);
      sinon.assert.calledOnce(view.showNotFound);
    });
  });
});
