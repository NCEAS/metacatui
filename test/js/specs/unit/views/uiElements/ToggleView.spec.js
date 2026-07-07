define([
  "jquery",
  "views/uiElements/ToggleView",
  "/test/js/specs/shared/clean-state.js",
], ($, ToggleView, cleanState) => {
  const expect = chai.expect;

  describe("ToggleView Test Suite", () => {
    const state = cleanState(() => {
      const originalPopup = $.fn.popup;
      const popupSpy = sinon.spy(function popupStub() {
        return this;
      });
      $.fn.popup = popupSpy;

      const view = new ToggleView({
        selected: "list",
        options: [
          {
            value: "list",
            label: "List View",
            tooltip: "Show list results",
          },
          {
            value: "map",
            label: "Map View",
          },
        ],
      });

      const testContainer = document.createElement("div");
      testContainer.id = "toggle-view-test-container";
      testContainer.append(view.el);
      document.body.append(testContainer);

      view.render();

      return { originalPopup, popupSpy, testContainer, view };
    }, beforeEach);

    afterEach(() => {
      state.view.remove();
      state.testContainer.remove();
      $.fn.popup = state.originalPopup;
    });

    it("creates a ToggleView instance", () => {
      expect(state.view).to.be.instanceof(ToggleView);
    });

    it("uses the first option if selected value is invalid", () => {
      const view = new ToggleView({
        selected: "not-an-option",
        options: [
          { value: "first", label: "First" },
          { value: "second", label: "Second" },
        ],
      });
      view.render();

      expect(view.selected).to.equal("first");
      view.remove();
    });

    it("emits toggle events with selected value and option", () => {
      const toggleSpy = sinon.spy();
      const changeSpy = sinon.spy();
      state.view.on("toggle:change", toggleSpy);
      state.view.on("change", changeSpy);

      const secondOption = state.view.$(".toggle-option").last();
      secondOption.trigger("click");

      expect(toggleSpy.callCount).to.equal(1);
      expect(changeSpy.callCount).to.equal(1);
      expect(toggleSpy.firstCall.args[0]).to.equal("map");
      expect(toggleSpy.firstCall.args[1].label).to.equal("Map View");
      expect(changeSpy.firstCall.args[0]).to.equal("map");
    });

    it("creates a Formantic popup for options with tooltip text", () => {
      const calls = state.popupSpy.getCalls();
      const popupInit = calls.find(
        (call) => call.args[0] && call.args[0].content === "Show list results",
      );

      expect(popupInit).to.exist;
    });
  });
});
