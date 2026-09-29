define([
  "jquery",
  "backbone",
  "models/portals/PortalSectionModel",
  "models/portals/PortalVizSectionModel",
  "views/portals/editor/PortEditorSectionView",
  "/test/js/specs/shared/clean-state.js",
], (
  $,
  Backbone,
  PortalSectionModel,
  PortalVizSectionModel,
  PortEditorSectionView,
  cleanState,
) => {
  const expect = chai.expect;

  describe("PortEditorSectionView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const enableCesium = MetacatUI.appModel.get("enableCesium");
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

      return {
        addNewSectionSpy,
        enableCesium,
        originalTooltip,
        sandbox,
        view,
      };
    }, beforeEach);

    afterEach(() => {
      state.view.off();
      state.view.remove();
      MetacatUI.appModel.set("enableCesium", state.enableCesium);
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

    it("tracks Cesium availability independently of other sections", () => {
      const freeformSection = new PortalSectionModel();
      const cesiumSection = new PortalVizSectionModel({
        visualizationType: "cesium",
      });
      const model = new Backbone.Model({
        hideMetrics: false,
        sections: [freeformSection],
      });
      const view = new PortEditorSectionView({ model });
      view.render();
      const option = view.$("#section-option-cesium");

      expect(option.hasClass("disabled")).to.equal(false);

      model.set("sections", [freeformSection, cesiumSection]);
      expect(option.hasClass("disabled")).to.equal(true);

      model.set("sections", [freeformSection]);
      expect(option.hasClass("disabled")).to.equal(false);

      view.remove();
    });

    it("does not offer Cesium when it is disabled", () => {
      MetacatUI.appModel.set("enableCesium", false);

      state.view.render();

      expect(state.view.$("#section-option-cesium")).to.have.length(0);
    });
  });
});
