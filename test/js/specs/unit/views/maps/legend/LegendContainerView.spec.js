define([
  "views/maps/legend/LegendContainerView",
  "models/maps/Map",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/unit/views/maps/legend/LegendContainerViewHarness.js",
], (
  LegendContainerView,
  Map,
  MapAssets,
  cleanState,
  LegendContainerViewHarness,
) => {
  const expect = chai.expect;

  describe("LegendContainerView Test Suite", () => {
    const state = cleanState(() => {
      const view = new LegendContainerView({
        el: document.createElement("div"),
        model: new Map(),
      });
      const harness = new LegendContainerViewHarness(view);

      return { view, harness };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an LegendContainerView instance", () => {
        expect(state.view).to.be.instanceof(LegendContainerView);
      });
    });

    describe("render", () => {
      it("shows the legend for the visible layers", () => {
        const layers = new MapAssets([
          { label: "layer 1", visible: false, colorPalette: {} },
          { label: "layer 2", visible: true, colorPalette: {} },
        ]);
        state.view.model.set("allLayers", layers);
        state.view.render();

        expect(state.harness.getContent().children()).to.have.lengthOf(1);
      });

      it("updates legend content when layers' visibility changes", () => {
        const layers = new MapAssets([
          { label: "layer 1", visible: false, colorPalette: {} },
          { label: "layer 2", visible: true, colorPalette: {} },
        ]);
        state.view.model.set("allLayers", layers);
        state.view.render();
        layers.at(0).set("visible", true);

        expect(state.harness.getContent().children()).to.have.lengthOf(2);
      });
    });

    describe("toggleExpanded", () => {
      it("toggles expanded status when triggered", () => {
        state.view.render();
        expect(state.harness.isExpanded()).to.be.false;

        state.view.toggleExpanded();
        expect(state.harness.isExpanded()).to.be.true;

        state.view.toggleExpanded();
        expect(state.harness.isExpanded()).to.be.false;
      });
    });
  });
});
