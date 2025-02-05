define(["jquery", "backbone", "views/metadata/EML211EditorView"], function (
  $,
  Backbone,
  EML211EditorView,
) {
  describe("EML211EditorView", function () {
    let view, model, sandbox;

    beforeEach(function () {
      sandbox = sinon.createSandbox();
      console.log("beforeEach called");
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
      sandbox.restore();
    });

    it("should log validation errors correctly", function () {
      console.log("Test: should log validation errors correctly");
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
      console.log(
        "Test: should handle string error messages correctly in showError",
      );
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
      console.log(
        "Test: should handle nested error objects correctly in showLeafErrors",
      );

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
  });
});
