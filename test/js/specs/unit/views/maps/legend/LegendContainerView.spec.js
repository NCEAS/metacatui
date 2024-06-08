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
  const COLORS_CONFIG = [{ color: "#1be3ee", value: 0 }];

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
          {
            label: "layer 1",
            visible: false,
            colorPalette: { colors: COLORS_CONFIG },
          },
          {
            label: "layer 2",
            visible: true,
            colorPalette: { colors: COLORS_CONFIG },
          },
        ]);
        state.view.model.set("allLayers", layers);
        state.view.render();

        expect(state.harness.getContent().children()).to.have.lengthOf(1);
      });

      it("updates legend content when layers' visibility changes", () => {
        const layers = new MapAssets([
          {
            label: "layer 1",
            visible: false,
            colorPalette: { colors: COLORS_CONFIG },
          },
          {
            label: "layer 2",
            visible: true,
            colorPalette: { colors: COLORS_CONFIG },
          },
        ]);
        state.view.model.set("allLayers", layers);
        state.view.render();
        layers.at(0).set("visible", true);

        expect(state.harness.getContent().children()).to.have.lengthOf(2);
      });

      it("ignores layers without a colorPalette", () => {
        const layers = new MapAssets([{ label: "layer 1", visible: false }]);
        state.view.model.set("allLayers", layers);
        state.view.render();

        expect(state.harness.getContent().children()).to.have.lengthOf(0);
      });

      it("ignores layers without colors config in the palette", () => {
        const layers = new MapAssets([
          { label: "layer 1", visible: false, palette: {} },
        ]);
        state.view.model.set("allLayers", layers);
        state.view.render();

        expect(state.harness.getContent().children()).to.have.lengthOf(0);
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
