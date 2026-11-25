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

    describe("Selecting a layer", () => {
      beforeEach(() => {
        sinon.stub(MapView.prototype, "renderMapWidget");
      });

      afterEach(() => {
        MapView.prototype.renderMapWidget.restore();
      });

      function expectOpenFor(panel, layer) {
        expect(panel.el.classList.contains(panel.classes.open)).to.be.true;
        expect(
          panel.el.querySelector(`.${panel.classes.label}`).textContent,
        ).to.equal(layer.get("label"));
      }

      it("opens, switches, and closes layer details within one category", () => {
        const map = new MapModel({
          showFeatureInfo: false,
          layerCategories: [
            {
              label: "Water",
              layers: [{ label: "Rivers" }, { label: "Lakes" }],
            },
          ],
        });
        const [rivers, lakes] = map.getAllLayers();
        const { layerDetails } = renderMap({ model: map });

        rivers.set("selected", true);
        expectOpenFor(layerDetails, rivers);

        lakes.set("selected", true);
        expect(rivers.get("selected")).to.be.false;
        expect(lakes.get("selected")).to.be.true;
        expectOpenFor(layerDetails, lakes);

        layerDetails.el
          .querySelector(`.${layerDetails.classes.toggle}`)
          .click();
        expect(lakes.get("selected")).to.be.false;
        expect(layerDetails.el.classList.contains(layerDetails.classes.open)).to
          .be.false;
      });

      it("keeps the new layer's panel open when a layer in another category is deselected", () => {
        const map = new MapModel({
          showFeatureInfo: false,
          layerCategories: [
            { label: "Water", layers: [{ label: "Rivers" }] },
            { label: "Land", layers: [{ label: "Forests" }] },
          ],
        });
        const [rivers, forests] = map.getAllLayers();
        const { layerDetails } = renderMap({ model: map });

        rivers.set("selected", true);
        expectOpenFor(layerDetails, rivers);
        forests.set("selected", true);

        expect(rivers.get("selected")).to.be.false;
        expect(forests.get("selected")).to.be.true;
        expectOpenFor(layerDetails, forests);
      });

      it("switches the open panel to the feature's layer when See layer details is clicked", () => {
        const map = new MapModel({
          layerCategories: [
            { label: "Water", layers: [{ label: "Rivers" }] },
            { label: "Land", layers: [{ label: "Forests" }] },
          ],
        });
        const [rivers, forests] = map.getAllLayers();
        const { layerDetails, featureInfo } = renderMap({ model: map });
        // The feature iframe schedules a resize after the test removes the map.
        sinon.stub(featureInfo, "updateIFrameHeight");

        rivers.set("selected", true);
        map.selectFeatures([
          { featureID: "grove", mapAsset: forests, properties: {} },
        ]);
        expectOpenFor(layerDetails, rivers);

        featureInfo.elements.layerDetailsButton.click();

        expectOpenFor(layerDetails, forests);
        expect(rivers.get("selected")).to.be.false;
        expect(forests.get("selected")).to.be.true;
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
