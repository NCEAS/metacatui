define(["views/maps/MapView", "models/maps/Map", "common/SearchParams"], (
  MapView,
  MapAsset,
  SearchParams,
) => {
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
        map.set("restoreState", {
          activeFeatures: [{ featureId: "dismiss-me", layerId: null }],
        });
        map.selectFeatures([featureAttrs]);

        const view = new MapView({ model: map });
        view.$el.hide();
        document.body.appendChild(view.el);

        try {
          view.render();
          view.featureInfo.close();

          expect(map.featureRestoreSession).to.equal(null);
          expect(map.get("restoreState")?.activeFeatures).to.deep.equal([]);
          expect(SearchParams.parseStateFromUrl().activeFeatures).to.deep.equal(
            [],
          );
        } finally {
          view.remove();
        }
      });
    });
  });
});
