define([
  "views/maps/MapStatusBarView",
  "models/maps/Map",
  "/test/js/specs/shared/clean-state.js",
], (MapStatusBarView, Map, cleanState) => {
  const expect = chai.expect;

  describe("MapStatusBarView Test Suite", () => {
    const state = cleanState(() => {
      const model = new Map();
      const interactions = model.get("interactions");
      const view = new MapStatusBarView({
        model,
        scaleModel: interactions.get("scale"),
        pointModel: interactions.get("mousePosition"),
      });

      return { model, view };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates a MapStatusBarView instance", () => {
        expect(state.view).to.be.instanceof(MapStatusBarView);
      });
    });

    describe("render", () => {
      it("renders a scale bar and a loading row", () => {
        state.view.render();

        expect(
          state.view.el.getElementsByClassName("scale-bar"),
        ).to.have.lengthOf(1);
        expect(
          state.view.el.getElementsByClassName(
            "map-status-bar__loading-row",
          ),
        ).to.have.lengthOf(1);
      });

      it("does not start expanded", () => {
        state.view.render();

        expect(state.view.isExpanded()).to.equal(false);
      });
    });

    describe("Loading indicator timing", () => {
      let clock;

      beforeEach(() => {
        clock = sinon.useFakeTimers();
        state.view.render();
      });

      afterEach(() => {
        state.view.onClose();
        clock.restore();
      });

      it("does not expand immediately when loading starts", () => {
        state.model.set({
          isLoadingLayers: true,
          loadingLayersMessage: "Loading Roads",
        });

        expect(state.view.isExpanded()).to.equal(false);
      });

      it("expands only once loading outlasts the reveal delay", () => {
        state.model.set({
          isLoadingLayers: true,
          loadingLayersMessage: "Loading Roads",
        });

        clock.tick(999);
        expect(state.view.isExpanded()).to.equal(false);

        clock.tick(1);
        expect(state.view.isExpanded()).to.equal(true);
        expect(state.view.loadingIndicator.messageEl.textContent).to.equal(
          "Loading Roads",
        );
      });

      it("never expands (no flash) if loading finishes before the reveal delay", () => {
        state.model.set({
          isLoadingLayers: true,
          loadingLayersMessage: "Loading Roads",
        });

        clock.tick(500);
        state.model.set({
          isLoadingLayers: false,
          loadingLayersMessage: null,
        });

        clock.tick(1000);
        expect(state.view.isExpanded()).to.equal(false);
      });

      it("stays open for the minimum duration and shows a completed message if loading finishes early", () => {
        state.model.set({
          isLoadingLayers: true,
          loadingLayersMessage: "Loading Roads",
        });
        clock.tick(1000);
        expect(state.view.isExpanded()).to.equal(true);

        clock.tick(200);
        state.model.set({
          isLoadingLayers: false,
          loadingLayersMessage: null,
        });
        expect(state.view.isExpanded()).to.equal(true);
        expect(state.view.loadingIndicator.messageEl.textContent).to.equal(
          "Loading completed!",
        );

        clock.tick(799);
        expect(state.view.isExpanded()).to.equal(true);

        clock.tick(1);
        expect(state.view.isExpanded()).to.equal(false);
      });

      it("collapses immediately once loading finishes after the minimum duration has already elapsed", () => {
        state.model.set({
          isLoadingLayers: true,
          loadingLayersMessage: "Loading Roads",
        });
        clock.tick(2500);
        expect(state.view.isExpanded()).to.equal(true);

        state.model.set({
          isLoadingLayers: false,
          loadingLayersMessage: null,
        });
        expect(state.view.isExpanded()).to.equal(false);
      });

      it("keeps the row open and updates the message if loading resumes before it collapses", () => {
        state.model.set({
          isLoadingLayers: true,
          loadingLayersMessage: "Loading Roads",
        });
        clock.tick(1000);
        expect(state.view.isExpanded()).to.equal(true);

        state.model.set({
          isLoadingLayers: false,
          loadingLayersMessage: null,
        });
        expect(state.view.loadingIndicator.messageEl.textContent).to.equal(
          "Loading completed!",
        );

        state.model.set({
          isLoadingLayers: true,
          loadingLayersMessage: "Loading Wetlands",
        });
        expect(state.view.isExpanded()).to.equal(true);
        expect(state.view.loadingIndicator.messageEl.textContent).to.equal(
          "Loading Wetlands",
        );

        clock.tick(5000);
        expect(state.view.isExpanded()).to.equal(true);
      });
    });
  });
});
