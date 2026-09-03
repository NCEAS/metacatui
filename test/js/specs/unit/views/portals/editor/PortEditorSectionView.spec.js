define([
  "jquery",
  "backbone",
  "views/portals/editor/PortEditorSectionView",
  "/test/js/specs/shared/clean-state.js",
], ($, Backbone, PortEditorSectionView, cleanState) => {
  const expect = chai.expect;

  describe("PortEditorSectionView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const originalTooltip = $.fn.tooltip;
      $.fn.tooltip = sandbox.stub().callsFake(function tooltipStub() {
        return this;
      });

      const model = new Backbone.Model({
        hideMetrics: false,
        sections: [],
      });
      const view = new PortEditorSectionView({ model });
      const addNewSectionSpy = sandbox.spy();
      view.on("addNewSection", addNewSectionSpy);
      view.render();

      return { addNewSectionSpy, originalTooltip, sandbox, view };
    }, beforeEach);

    afterEach(() => {
      state.view.off();
      state.view.remove();
      $.fn.tooltip = state.originalTooltip;
      state.sandbox.restore();
    });

    it("emits the selected type when enabled option content is clicked", () => {
      state.view.$("#section-option-freeform h5").trigger("click");

      expect(state.addNewSectionSpy.calledOnce).to.equal(true);
      expect(state.addNewSectionSpy.firstCall.args).to.deep.equal(["freeform"]);
    });

    it("does not emit when disabled option content is clicked", () => {
      const option = state.view.$("#section-option-metrics");

      expect(option.hasClass("disabled")).to.equal(true);

      option.find("h5").trigger("click");

      expect(state.addNewSectionSpy.called).to.equal(false);
    });
  });
});
