define(["views/maps/MapView", "models/maps/Map"], (MapView, MapAsset) => {
  const expect = chai.expect;

  describe("MapView Test Suite", () => {
    describe("Initialization", () => {
      it("creates a MapView instance", () => {
        const view = new MapView();
        expect(view).to.be.instanceof(MapView);
      });
    });

    describe("Portal map", () => {
      it("has an additional portal indicator class", () => {
        const nonPortalMap = new MapView();
        // Required for iFrame to not break in FeatureInfoView.
        nonPortalMap.$el.hide();
        document.body.appendChild(nonPortalMap.el);

        nonPortalMap.render();
        expect(nonPortalMap.$el.hasClass("map-view__portal")).to.be.false;

        const portalMap = new MapView({ isPortalMap: true });
        // Required for iFrame to not break in FeatureInfoView.
        portalMap.$el.hide();
        document.body.appendChild(portalMap.el);

        portalMap.render();
        expect(portalMap.$el.hasClass("map-view__portal")).to.be.true;
      });
    });

    describe("Visualization panel restore", () => {
      it("opens the visualization panel when activeVisualizationUrl is already set", () => {
        const view = new MapView({
          model: new MapAsset({
            activeVisualizationUrl: "https://example.org/app",
            showToolbar: false,
          }),
        });
        view.$el.hide();
        document.body.appendChild(view.el);

        try {
          view.render();

          expect(view.el.querySelector(".visualization-panel--open")).to.not.be
            .null;
        } finally {
          view.remove();
        }
      });
    });

    describe("Layer loading indicator", () => {
      it("shows and updates the loading message from the map model", () => {
        const view = new MapView({
          model: new MapAsset({
            showToolbar: false,
          }),
        });
        view.$el.hide();
        document.body.appendChild(view.el);

        try {
          view.render();

          const mapWidgetContainer = view.el.querySelector(
            ".map-view__map-widget-container",
          );
          const indicator = view.el.querySelector(".map-view__loading-indicator");
          const message = view.el.querySelector(".map-view__loading-text");

          view.model.set({
            isLoadingLayers: true,
            loadingLayersMessage: "Loading Habitat roads",
          });

          expect(mapWidgetContainer.contains(indicator)).to.equal(true);
          expect(indicator.hidden).to.equal(false);
          expect(message.textContent).to.equal("Loading Habitat roads");
          expect(
            view.el.querySelector(".map-view__loading-ellipsis"),
          ).to.equal(null);

          view.model.set({
            isLoadingLayers: false,
            loadingLayersMessage: null,
          });

          expect(indicator.hidden).to.equal(true);
        } finally {
          view.remove();
        }
      });
    });
  });
});
