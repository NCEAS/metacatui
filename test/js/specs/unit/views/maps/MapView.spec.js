define(
  ["views/maps/MapView", "models/maps/Map", "common/SearchParams"],
  (MapView, MapAsset, SearchParams) => {
  const expect = chai.expect;

  describe("MapView Test Suite", () => {
    beforeEach(() => {
      SearchParams.clearStateInUrl();
    });

    afterEach(() => {
      SearchParams.clearStateInUrl();
    });

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

      it("clears feature restore encoding when the feature info panel is closed", () => {
        const map = new MapAsset({
          showShareUrl: true,
          showToolbar: false,
        });
        const featureAttrs = {
          featureID: "dismiss-me",
          properties: {},
          mapAsset: null,
          featureObject: {},
          label: null,
        };

        map.featureRestoreSession = {
          requestedIds: ["dismiss-me"],
          cancelers: [],
          key: "dismiss-me",
        };
        map.set("restoreState", { activeFeatureIds: ["dismiss-me"] });
        map.selectFeatures([featureAttrs]);

        const view = new MapView({ model: map });
        view.$el.hide();
        document.body.appendChild(view.el);

        try {
          view.render();
          view.featureInfo.close();

          expect(map.featureRestoreSession).to.equal(null);
          expect(map.get("restoreState")?.activeFeatureIds).to.deep.equal([]);
          expect(SearchParams.parseStateFromUrl().activeFeatureIds).to.deep.equal(
            [],
          );
        } finally {
          view.remove();
        }
      });
    });

    describe("Layer loading indicator", () => {
      it("shows only after the map has been loading for half a second", () => {
        const clock = sinon.useFakeTimers();
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
          const indicator = view.el.querySelector(
            ".map-view__loading-indicator",
          );
          const message = view.el.querySelector(".map-view__loading-text");

          view.model.set({
            isLoadingLayers: true,
            loadingLayersMessage: "Loading Habitat roads",
          });

          expect(mapWidgetContainer.contains(indicator)).to.equal(true);
          expect(indicator.hidden).to.equal(true);
          expect(message.textContent).to.equal("Loading Habitat roads");

          clock.tick(499);
          expect(indicator.hidden).to.equal(true);

          clock.tick(1);
          expect(indicator.hidden).to.equal(false);

          view.model.set({
            isLoadingLayers: false,
            loadingLayersMessage: null,
          });

          expect(indicator.hidden).to.equal(true);
        } finally {
          view.remove();
          clock.restore();
        }
      });

      it("only delays the first reveal and updates immediately afterward", () => {
        const clock = sinon.useFakeTimers();
        const view = new MapView({
          model: new MapAsset({
            showToolbar: false,
          }),
        });
        view.$el.hide();
        document.body.appendChild(view.el);

        try {
          view.render();

          const indicator = view.el.querySelector(
            ".map-view__loading-indicator",
          );
          const message = view.el.querySelector(".map-view__loading-text");

          view.model.set({
            isLoadingLayers: true,
            loadingLayersMessage: "Loading Habitat roads",
          });

          clock.tick(499);
          expect(indicator.hidden).to.equal(true);

          clock.tick(1);
          expect(indicator.hidden).to.equal(false);
          expect(message.textContent).to.equal("Loading Habitat roads");

          view.model.set({
            loadingLayersMessage: "Loading Wetlands",
          });
          expect(indicator.hidden).to.equal(false);
          expect(message.textContent).to.equal("Loading Wetlands");

          view.model.set({
            isLoadingLayers: false,
            loadingLayersMessage: null,
          });
          expect(indicator.hidden).to.equal(true);

          view.model.set({
            isLoadingLayers: true,
            loadingLayersMessage: "Loading Roads",
          });
          expect(indicator.hidden).to.equal(true);
          clock.tick(499);
          expect(indicator.hidden).to.equal(true);
          clock.tick(1);
          expect(indicator.hidden).to.equal(false);
          expect(message.textContent).to.equal("Loading Roads");
        } finally {
          view.remove();
          clock.restore();
        }
      });
    });
  });
  },
);
