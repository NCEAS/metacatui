define([
  "views/maps/MapView",
  "models/maps/Map",
  "common/SearchParams",
  "views/maps/VisualizationPanelView",
], (MapView, MapModel, SearchParams, VisualizationPanelView) => {
  const { expect } = chai;

  describe("MapView Test Suite", () => {
    let renderedMaps;

    function renderMap(options) {
      const view = new MapView(options);
      renderedMaps.push(view);
      // The feature info iframe needs an attached map element.
      view.el.style.display = "none";
      document.body.append(view.el);
      return view.render();
    }

    beforeEach(() => {
      renderedMaps = [];
      SearchParams.clearStateInUrl();
    });

    afterEach(() => {
      renderedMaps.forEach((view) => {
        view.onClose();
        view.remove();
      });
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
        const { portalIndicator } = MapView.CLASS_NAMES;
        const nonPortalMap = renderMap();
        const portalMap = renderMap({ isPortalMap: true });
        expect(nonPortalMap.el.classList.contains(portalIndicator)).to.equal(
          false,
        );
        expect(portalMap.el.classList.contains(portalIndicator)).to.equal(true);
      });
    });

    describe("Visualization panel restore", () => {
      it("opens the visualization panel when activeVisualizationUrl is already set", () => {
        const view = renderMap({
          model: new MapModel({
            activeVisualizationUrl: "https://example.org/app",
            showToolbar: false,
          }),
        });
        expect(
          view.el.querySelector(`.${VisualizationPanelView.CLASS_NAMES.open}`),
        ).to.not.equal(null);
      });

      it("clears feature restore encoding when the feature info panel is closed", () => {
        const map = new MapModel({
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

        const view = renderMap({ model: map });
        view.featureInfo.close();

        expect(map.featureRestoreSession).to.equal(null);
        expect(map.get("restoreState")?.activeFeatures).to.deep.equal([]);
        expect(SearchParams.parseStateFromUrl().activeFeatures).to.deep.equal(
          [],
        );
      });
    });
  });
});
