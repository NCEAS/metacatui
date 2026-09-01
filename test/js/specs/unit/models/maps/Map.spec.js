define([
  "backbone",
  "models/maps/Map",
  "models/maps/AssetCategory",
  "collections/maps/AssetCategories",
  "collections/maps/MapAssets",
  "models/maps/LayerLoadingCoordinator",
  "/test/js/specs/shared/clean-state.js",
  "common/SearchParams",
], (
  Backbone,
  Map,
  AssetCategory,
  AssetCategories,
  MapAssets,
  LayerLoadingCoordinator,
  cleanState,
  SearchParams,
) => {
  const expect = chai.expect;

  describe("Map Test Suite", () => {
    const state = cleanState(() => {
      return { model: new Map() };
    }, beforeEach);

    beforeEach(() => {
      SearchParams.clearStateInUrl();
    });

    afterEach(() => {
      SearchParams.clearStateInUrl();
    });

    describe("Initialization", () => {
      it("creates an Map instance", () => {
        expect(state.model).to.be.instanceof(Map);
      });

      it("defaults debug to false", () => {
        expect(state.model.get("debug")).to.equal(false);
      });

      it("excludes the default base layer from loading-state tracking", () => {
        const layers = state.model.get("layers");
        expect(layers).to.have.lengthOf(1);
        expect(layers.at(0).get("label")).to.equal("Base layer");
        expect(layers.at(0).get("excludeFromLoadingState")).to.equal(true);
      });

      it("ignores layers if layerCategories exist", () => {
        const map = new Map({
          layerCategories: [{ layers: [{}] }],
          layers: [{}],
        });

        expect(map.has("layerCategories")).to.be.true;
        expect(map.has("layers")).to.be.false;
      });

      it("restores the URL destination when share URL syncing is enabled", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            longitude: 135,
            height: 9999,
          },
        });

        const map = new Map({ showShareUrl: false });
        map.set("showShareUrl", true);

        expect(map.get("interactions").get("zoomTarget")).to.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });
      });

      it("changes flat layer visibility based on search params", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: ["layer-2"] });
        const map = new Map({
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: false },
          ],
        });

        expect(map.get("layers").at(0).get("visible")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.true;
      });

      it("restores all layers as hidden when el is explicitly empty", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: [] });
        const map = new Map({
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: true },
          ],
        });

        expect(map.get("layers").at(0).get("visible")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.false;
      });

      it("preserves configured visibility for flat layers", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: ["layer-2"] });
        const map = new Map({
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: false },
          ],
        });

        expect(map.get("layers").at(0).get("configuredVisibility")).to.be.true;
        expect(map.get("layers").at(1).get("configuredVisibility")).to.be.false;
      });

      it("changes categorized layer visibility based on search params", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: ["layer-2"] });
        const map = new Map({
          layerCategories: [
            {
              layers: [
                { layerId: "layer-1", visible: true },
                { layerId: "layer-2", visible: false },
              ],
            },
          ],
        });

        expect(map.getAllLayers()[0].get("visible")).to.be.false;
        expect(map.getAllLayers()[1].get("visible")).to.be.true;
      });

      it("defaults flat layers with undefined visibility to hidden", () => {
        const map = new Map({
          layers: [{ layerId: "layer-1" }, { layerId: "layer-2" }],
        });

        expect(map.get("layers").at(0).get("visible")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.false;
      });

      it("defaults categorized layers with undefined visibility to hidden", () => {
        const map = new Map({
          layerCategories: [
            {
              layers: [{ layerId: "layer-1" }, { layerId: "layer-2" }],
            },
          ],
        });

        expect(map.getAllLayers()[0].get("visible")).to.be.false;
        expect(map.getAllLayers()[1].get("visible")).to.be.false;
      });

      it("uses configuredVisibility when visible is omitted for flat layers", () => {
        const map = new Map({
          layers: [
            { layerId: "layer-1", configuredVisibility: true },
            { layerId: "layer-2", configuredVisibility: false },
          ],
        });

        expect(map.get("layers").at(0).get("configuredVisibility")).to.be.true;
        expect(map.get("layers").at(0).get("visible")).to.be.true;
        expect(map.get("layers").at(1).get("configuredVisibility")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.false;
      });

      it("uses configuredVisibility when visible is omitted for categorized layers", () => {
        const map = new Map({
          layerCategories: [
            {
              layers: [
                { layerId: "layer-1", configuredVisibility: true },
                { layerId: "layer-2", configuredVisibility: false },
              ],
            },
          ],
        });

        expect(map.getAllLayers()[0].get("configuredVisibility")).to.be.true;
        expect(map.getAllLayers()[0].get("visible")).to.be.true;
        expect(map.getAllLayers()[1].get("configuredVisibility")).to.be.false;
        expect(map.getAllLayers()[1].get("visible")).to.be.false;
      });

      it("throws when model instance layers are provided", () => {
        const layerModel = new Backbone.Model({
          layerId: "layer-1",
          visible: true,
          configuredVisibility: false,
        });
        expect(() => new Map({ layers: [layerModel] })).to.throw(
          "Map configuration layers must contain plain MapAssetConfig objects, not Backbone model instances.",
        );
      });

      it("throws when model instance category layers are provided", () => {
        const layerModel = new Backbone.Model({
          layerId: "layer-1",
          visible: true,
        });
        expect(
          () =>
            new Map({
              layerCategories: [{ layers: [layerModel] }],
            }),
        ).to.throw(
          "Map configuration layerCategories[].layers must contain plain MapAssetConfig objects, not Backbone model instances.",
        );
      });

      it("sets viewfinderCards from config with layers (legacy zoomPresets key)", () => {
        const map = new Map({
          zoomPresets: [
            {
              latitude: 55,
              longitude: 66,
              height: 77,
              description: "Some zoom preset",
              title: "Zoom 1",
              layerIds: ["layer1"],
            },
          ],
          layers: [{}],
        });

        expect(
          map
            .get("viewfinderCardsCollection")
            .at(0)
            .get("viewfinderCards")
            .at(0)
            .get("title"),
        ).to.equal("Zoom 1");
      });

      it("sets viewfinderCards from config with layerCategories (legacy zoomPresets key)", () => {
        const map = new Map({
          zoomPresets: [
            {
              latitude: 55,
              longitude: 66,
              height: 77,
              description: "Some zoom preset",
              title: "Zoom 1",
              layerIds: ["layer1"],
            },
          ],
          layerCategories: [{ layers: [{}] }],
        });

        expect(
          map
            .get("viewfinderCardsCollection")
            .at(0)
            .get("viewfinderCards")
            .at(0)
            .get("title"),
        ).to.equal("Zoom 1");
      });

      it("filters out enabledLayerIds for layerIds that do not exist", () => {
        const map = new Map({
          zoomPresets: [
            {
              latitude: 55,
              longitude: 66,
              height: 77,
              description: "Some zoom preset",
              title: "Zoom 1",
              layerIds: ["layer1", "layer2"],
            },
          ],
          layerCategories: [{ layers: [{ layerId: "layer1" }] }],
        });

        // Deep equality check with .to.eql
        expect(
          map
            .get("viewfinderCardsCollection")
            .at(0)
            .get("viewfinderCards")
            .at(0)
            .get("enabledLayerIds"),
        ).to.eql(["layer1"]);
      });

      it("accepts debug from config", () => {
        const map = new Map({ debug: true });

        expect(map.get("debug")).to.equal(true);
      });

      it("accepts show3DTilesInspector from config", () => {
        const map = new Map({ show3DTilesInspector: true });

        expect(map.get("show3DTilesInspector")).to.equal(true);
      });

      it("writes camera position and enabled layers to the URL", () => {
        const map = new Map({
          showShareUrl: true,
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: false },
          ],
        });

        map.get("interactions").setCameraPosition({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 1,
          pitch: 2,
          roll: 3,
        });
        map.updateSearchParams();

        expect(SearchParams.parseStateFromUrl().destination).to.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 1,
          pitch: 2,
          roll: 3,
        });
        expect(SearchParams.parseStateFromUrl().enabledLayerIds).to.deep.equal([
          "layer-1",
        ]);
      });
    });

    describe("getLayerGroups", () => {
      it("returns an array of MapAssets", () => {
        const layers = new MapAssets([{}]);
        state.model.set("layers", layers);

        expect(state.model.getLayerGroups()).to.have.lengthOf(1);
        expect(state.model.getLayerGroups()[0]).to.equal(layers);
      });

      it("ignores layers if layerCategories exist", () => {
        state.model.set("layers", new MapAssets([{}]));

        const category1 = new AssetCategory({ layers: [{}] });
        const category2 = new AssetCategory({ layers: [{}] });
        state.model.set(
          "layerCategories",
          new AssetCategories([category1, category2]),
        );

        expect(state.model.getLayerGroups()).to.have.lengthOf(2);
      });
    });

    describe("setUpUrlStateListeners", () => {
      it("does not duplicate selectedFeatures URL sync listeners on repeated setup", () => {
        const map = new Map({ showShareUrl: true });
        const originalUpdateActiveFeatureIds =
          SearchParams.updateActiveFeatureIds;
        let updateActiveFeatureIdsCallCount = 0;

        SearchParams.updateActiveFeatureIds = () => {
          updateActiveFeatureIdsCallCount += 1;
        };

        try {
          map.setUpUrlStateListeners();
          map.setUpUrlStateListeners();
          map.setUpUrlStateListeners();

          map.selectFeatures([
            {
              featureID: "feat-1",
              properties: {},
              mapAsset: null,
              featureObject: {},
              label: null,
            },
          ]);

          expect(updateActiveFeatureIdsCallCount).to.equal(1);
        } finally {
          SearchParams.updateActiveFeatureIds = originalUpdateActiveFeatureIds;
        }
      });
    });

    describe("applyFeatureRestoreState", () => {
      const makeLayer = (overrides = {}) =>
        Object.assign(
          {
            status: "ready",
            get(key) {
              return this[key];
            },
            set(key, val) {
              this[key] = val;
            },
            getFeatureById: () => null,
          },
          overrides,
        );

      it("does nothing when activeFeatureIds is empty", () => {
        const map = new Map({ showShareUrl: true });
        map.set("restoreState", { activeFeatureIds: [] });
        map.applyFeatureRestoreState();
        expect(map.getSelectedFeatures()?.models).to.have.lengthOf(0);
      });

      it("does nothing when showShareUrl is false", () => {
        const map = new Map({ showShareUrl: false });
        map.set("restoreState", { activeFeatureIds: ["feat-1"] });
        map.applyFeatureRestoreState();
        expect(map.getSelectedFeatures()?.models).to.have.lengthOf(0);
      });

      it("selects a feature when a ready layer finds it immediately", () => {
        const map = new Map({ showShareUrl: true });
        const fakeFeature = {};
        const fakeAttrs = {
          featureID: "feat-1",
          properties: {},
          mapAsset: null,
          featureObject: fakeFeature,
          label: null,
        };

        const layer = makeLayer({
          getFeatureById: (id) => (id === "feat-1" ? fakeFeature : null),
          getFeatureAttributes: () => fakeAttrs,
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["feat-1"] });
        map.applyFeatureRestoreState();

        const selected = map.getSelectedFeatures()?.models || [];
        expect(selected.some((f) => f.get("featureID") === "feat-1")).to.equal(
          true,
        );
      });

      it("uses waitForFeatureById when a ready tileset layer doesn't find the feature immediately", (done) => {
        const map = new Map({ showShareUrl: true });
        const fakeFeature = {};
        const fakeAttrs = {
          featureID: "building-42",
          properties: {},
          mapAsset: null,
          featureObject: fakeFeature,
          label: null,
        };

        let tileAvailable = false;
        let tileCallback = null;
        const layer = makeLayer({
          label: "Habitat roads",
          // Returns the feature only once the tile is "loaded"
          getFeatureById: () => (tileAvailable ? fakeFeature : null),
          getFeatureAttributes: () => fakeAttrs,
          waitForFeatureById: (_id, cb) => {
            tileCallback = cb;
            return () => {};
          },
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["building-42"] });
        map.applyFeatureRestoreState();

        expect(map.get("isLoadingLayers")).to.equal(false);
        expect(map.get("loadingLayersMessage")).to.equal(null);

        expect(
          (map.getSelectedFeatures()?.models || []).some(
            (f) => f.get("featureID") === "building-42",
          ),
        ).to.equal(false);

        // Simulate tile becoming visible: mark feature available then fire callback
        tileAvailable = true;
        tileCallback();

        setTimeout(() => {
          const selected = map.getSelectedFeatures()?.models || [];
          expect(
            selected.some((f) => f.get("featureID") === "building-42"),
          ).to.equal(true);
          expect(map.get("isLoadingLayers")).to.equal(false);
          done();
        }, 0);
      });

      it("keeps the restore session active across partial feature resolution", (done) => {
        const map = new Map({ showShareUrl: true });
        const originalUpdateActiveFeatureIds =
          SearchParams.updateActiveFeatureIds;
        const urlUpdates = [];
        const fakeFeatureA = {};
        const fakeFeatureB = {};
        const fakeAttrsA = {
          featureID: "feature-a",
          properties: {},
          mapAsset: null,
          featureObject: fakeFeatureA,
          label: null,
        };
        const fakeAttrsB = {
          featureID: "feature-b",
          properties: {},
          mapAsset: null,
          featureObject: fakeFeatureB,
          label: null,
        };

        let tileAvailable = false;
        let tileCallback = null;

        SearchParams.updateActiveFeatureIds = (ids) => {
          urlUpdates.push(ids.slice());
        };

        const layer = makeLayer({
          getFeatureById: (id) => {
            if (id === "feature-a") return fakeFeatureA;
            if (id === "feature-b" && tileAvailable) return fakeFeatureB;
            return null;
          },
          getFeatureAttributes: (feature) => {
            if (feature === fakeFeatureA) return fakeAttrsA;
            if (feature === fakeFeatureB) return fakeAttrsB;
            return null;
          },
          waitForFeatureById: (id, cb) => {
            if (id === "feature-b") tileCallback = cb;
            return () => {};
          },
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", {
          activeFeatureIds: ["feature-a", "feature-b"],
        });

        try {
          map.applyFeatureRestoreState();

          expect(
            (map.getSelectedFeatures()?.models || []).some(
              (f) => f.get("featureID") === "feature-a",
            ),
          ).to.equal(true);
          expect(
            (map.getSelectedFeatures()?.models || []).some(
              (f) => f.get("featureID") === "feature-b",
            ),
          ).to.equal(false);
          expect(map.featureRestoreSession?.requestedIds).to.deep.equal([
            "feature-a",
            "feature-b",
          ]);
          expect(urlUpdates.at(-1)).to.deep.equal(["feature-a", "feature-b"]);

          tileAvailable = true;
          tileCallback();

          setTimeout(() => {
            try {
              const selected = map.getSelectedFeatures()?.models || [];
              expect(
                selected.some((f) => f.get("featureID") === "feature-a"),
              ).to.equal(true);
              expect(
                selected.some((f) => f.get("featureID") === "feature-b"),
              ).to.equal(true);
              expect(map.featureRestoreSession).to.equal(null);
              expect(urlUpdates.at(-1)).to.deep.equal([
                "feature-a",
                "feature-b",
              ]);
              SearchParams.updateActiveFeatureIds =
                originalUpdateActiveFeatureIds;
              done();
            } catch (error) {
              SearchParams.updateActiveFeatureIds =
                originalUpdateActiveFeatureIds;
              done(error);
            }
          }, 0);
        } catch (error) {
          SearchParams.updateActiveFeatureIds = originalUpdateActiveFeatureIds;
          done(error);
        }
      });

      it("cancels pending feature restore waiters when showShareUrl turns off", () => {
        const map = new Map({ showShareUrl: true });
        let cancelCount = 0;

        const layer = makeLayer({
          getFeatureById: () => null,
          waitForFeatureById: () => {
            return () => {
              cancelCount += 1;
            };
          },
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["feature-slow"] });
        map.applyFeatureRestoreState();

        expect(cancelCount).to.equal(0);

        map.handleShowShareUrlChange(map, false);

        expect(cancelCount).to.equal(1);
      });

      it("skips layers without getFeatureById", () => {
        const map = new Map({ showShareUrl: true });
        const layer = { get: () => "ready" };
        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["feat-x"] });
        map.applyFeatureRestoreState();
        expect(map.getSelectedFeatures()?.models).to.have.lengthOf(0);
      });

      it("cancels stale async waiters before starting a new restore", () => {
        const map = new Map({ showShareUrl: true });

        let waitCallCount = 0;
        let cancelCallCount = 0;
        const layer = makeLayer({
          getFeatureById: () => null,
          waitForFeatureById: () => {
            waitCallCount += 1;
            return () => {
              cancelCallCount += 1;
            };
          },
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["feature-a"] });
        map.applyFeatureRestoreState();

        map.set("restoreState", { activeFeatureIds: ["feature-b"] });
        map.applyFeatureRestoreState();

        expect(waitCallCount).to.equal(2);
        expect(cancelCallCount).to.equal(1);
      });

      it("does not create duplicate async waiters for repeated restores of same ids", () => {
        const map = new Map({ showShareUrl: true });

        let waitCallCount = 0;
        const layer = makeLayer({
          getFeatureById: () => null,
          waitForFeatureById: () => {
            waitCallCount += 1;
            return () => {};
          },
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["feature-a"] });
        map.applyFeatureRestoreState();
        map.applyFeatureRestoreState();
        map.applyFeatureRestoreState();

        expect(waitCallCount).to.equal(1);
      });

      it("replaces a stale restore session when comma-containing ids form a different scope", () => {
        const map = new Map({ showShareUrl: true });
        const layer = makeLayer({
          layerId: "layer-1",
          getFeatureById: () => null,
          waitForFeatureById: () => () => {},
        });

        map.getAllLayers = () => [layer];
        map.featureRestoreSession = {
          cancelers: [],
          key: JSON.stringify({
            featureIds: ["a", "b,c"],
            layerIds: ["layer-1"],
          }),
          requestedIds: ["a", "b,c"],
        };
        map.set("restoreState", { activeFeatureIds: ["a,b", "c"] });

        map.applyFeatureRestoreState();

        expect(map.featureRestoreSession?.requestedIds).to.deep.equal([
          "a,b",
          "c",
        ]);
      });

      it("re-runs feature restore when a hidden searchable layer becomes visible after no session was created", () => {
        const map = new Map({ showShareUrl: true });
        const fakeFeature = {};
        const fakeAttrs = {
          featureID: "hidden-feature-1",
          properties: {},
          mapAsset: null,
          featureObject: fakeFeature,
          label: null,
        };

        const layer = makeLayer({
          layerId: "searchable-layer",
          visible: false,
          status: "ready",
          getFeatureById: (id) =>
            id === "hidden-feature-1" ? fakeFeature : null,
          getFeatureAttributes: () => fakeAttrs,
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["hidden-feature-1"] });

        map.applyFeatureRestoreState();
        expect(map.featureRestoreSession).to.equal(null);
        expect(
          (map.getSelectedFeatures()?.models || []).some(
            (feature) => feature.get("featureID") === "hidden-feature-1",
          ),
        ).to.equal(false);

        layer.set("visible", true);
        map.handleLayerVisibilityChange();

        expect(
          (map.getSelectedFeatures()?.models || []).some(
            (feature) => feature.get("featureID") === "hidden-feature-1",
          ),
        ).to.equal(true);
      });

      it("replaces restore waiters when visible searchable layers change for the same requested feature ids", (done) => {
        const map = new Map({ showShareUrl: true });
        const fakeFeature = {};
        const fakeAttrs = {
          featureID: "road-feature-1",
          properties: {},
          mapAsset: null,
          featureObject: fakeFeature,
          label: null,
        };

        let roadReady = false;
        let staleRoadCallback = null;
        let roadCancelCount = 0;
        let fallbackWaitCount = 0;

        const roadsLayer = makeLayer({
          layerId: "roads",
          label: "Roads",
          visible: true,
          status: "ready",
          getFeatureById: (id) => {
            if (id === "road-feature-1" && roadReady) return fakeFeature;
            return null;
          },
          getFeatureAttributes: () => fakeAttrs,
          waitForFeatureById: (_id, cb) => {
            staleRoadCallback = cb;
            return () => {
              roadCancelCount += 1;
            };
          },
        });

        const fallbackLayer = makeLayer({
          layerId: "fallback",
          label: "Fallback",
          visible: true,
          status: "loading",
          getFeatureById: () => null,
          waitForFeatureById: () => {
            fallbackWaitCount += 1;
            return () => {};
          },
        });

        map.getAllLayers = () => [roadsLayer, fallbackLayer];
        map.set("restoreState", { activeFeatureIds: ["road-feature-1"] });

        map.applyFeatureRestoreState();
        expect(roadCancelCount).to.equal(0);

        roadsLayer.set("visible", false);
        map.applyFeatureRestoreState();

        expect(roadCancelCount).to.equal(1);
        expect(fallbackWaitCount).to.equal(2);

        roadReady = true;
        staleRoadCallback();

        setTimeout(() => {
          try {
            const selected = map.getSelectedFeatures()?.models || [];
            expect(
              selected.some((f) => f.get("featureID") === "road-feature-1"),
            ).to.equal(false);
            done();
          } catch (error) {
            done(error);
          }
        }, 0);
      });

      it("clears the loading state when no layer can continue the restore asynchronously", () => {
        const map = new Map({ showShareUrl: true });
        const layer = makeLayer({
          getFeatureById: () => null,
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["missing-feature"] });
        map.applyFeatureRestoreState();

        expect(map.get("isLoadingLayers")).to.equal(false);
      });

      it("clears pending feature restore ids from the URL when the restoring layer is hidden before the feature appears", () => {
        const map = new Map({ showShareUrl: true });
        let cancelCount = 0;

        const roadsLayer = makeLayer({
          layerId: "roads",
          label: "Roads",
          visible: true,
          status: "ready",
          getFeatureById: () => null,
          waitForFeatureById: () => {
            return () => {
              cancelCount += 1;
            };
          },
        });

        map.getAllLayers = () => [roadsLayer];
        map.set("restoreState", { activeFeatureIds: ["road-feature-1"] });

        map.applyFeatureRestoreState();
        expect(map.featureRestoreSession).to.not.equal(null);
        expect(SearchParams.parseStateFromUrl().activeFeatureIds).to.deep.equal(
          [],
        );

        roadsLayer.set("visible", false);
        map.handleLayerVisibilityChange(roadsLayer, false);

        expect(cancelCount).to.equal(1);
        expect(map.featureRestoreSession).to.equal(null);
        expect(map.get("restoreState")?.activeFeatureIds).to.deep.equal([]);
        expect(SearchParams.parseStateFromUrl().activeFeatureIds).to.deep.equal(
          [],
        );
      });

      it("does not treat feature restore sessions as map layer loading state", () => {
        const map = new Map({ showShareUrl: true });

        const layer = makeLayer({
          label: "Habitat roads",
          visible: true,
          status: "ready",
          displayReady: true,
          getFeatureById: () => null,
          waitForFeatureById: () => () => {},
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["road-feature-1"] });

        map.applyFeatureRestoreState();
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.featureRestoreSession).to.not.equal(null);
        expect(map.get("isLoadingLayers")).to.equal(false);
        expect(map.get("loadingLayersMessage")).to.equal(null);
      });

      it("clears loading state when a restored layer is toggled off before loading, and reopens on toggle on", () => {
        const map = new Map({ showShareUrl: true });
        let waitCallCount = 0;

        const layer = makeLayer({
          label: "Roads (HABITAT-OSM)",
          status: "ready",
          displayReady: false,
          visible: true,
          getFeatureById: () => null,
          waitForFeatureById: () => {
            waitCallCount += 1;
            return () => {};
          },
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", { activeFeatureIds: ["road-feature-1"] });

        map.applyFeatureRestoreState();
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("isLoadingLayers")).to.equal(true);
        expect(map.get("loadingLayersMessage")).to.equal(
          "Loading Roads (HABITAT-OSM)",
        );

        layer.set("visible", false);
        map.applyFeatureRestoreState();
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("isLoadingLayers")).to.equal(false);
        expect(map.get("loadingLayersMessage")).to.equal(null);

        layer.set("visible", true);
        map.applyFeatureRestoreState();
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("isLoadingLayers")).to.equal(true);
        expect(map.get("loadingLayersMessage")).to.equal(
          "Loading Roads (HABITAT-OSM)",
        );
        expect(waitCallCount).to.equal(2);
      });

      it("treats visible loading layers as map loading state", () => {
        const map = new Map({ showShareUrl: false });
        const layer = makeLayer({
          label: "Habitat roads",
          status: "loading",
          visible: true,
        });

        map.getAllLayers = () => [layer];
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("isLoadingLayers")).to.equal(true);
        expect(map.get("loadingLayersMessage")).to.equal(
          "Loading Habitat roads",
        );
      });

      it("recalculates loading state when a loading layer is added dynamically", () => {
        const map = new Map({
          showShareUrl: false,
          layers: [
            {
              layerId: "base",
              label: "Base",
              visible: true,
              status: "ready",
              displayReady: true,
              excludeFromLoadingState: true,
            },
          ],
        });

        expect(map.get("isLoadingLayers")).to.equal(false);

        map.addAsset({
          layerId: "roads",
          label: "Roads",
          visible: true,
          status: "ready",
          displayReady: false,
        });

        expect(map.get("isLoadingLayers")).to.equal(true);
        expect(map.get("loadingLayersMessage")).to.equal("Loading Roads");
      });

      it("recalculates loading state when a loading layer is removed dynamically", () => {
        const map = new Map({
          showShareUrl: false,
          layers: [
            {
              layerId: "base",
              label: "Base",
              visible: true,
              status: "ready",
              displayReady: true,
              excludeFromLoadingState: true,
            },
          ],
        });

        const roads = map.addAsset({
          layerId: "roads",
          label: "Roads",
          visible: true,
          status: "loading",
          displayReady: false,
        });

        expect(map.get("isLoadingLayers")).to.equal(true);
        expect(map.get("loadingLayersMessage")).to.equal("Loading Roads");

        map.removeAsset(roads);

        expect(map.get("isLoadingLayers")).to.equal(false);
        expect(map.get("loadingLayersMessage")).to.equal(null);
      });

      it("does not treat failed visible layers as still loading", () => {
        const map = new Map({ showShareUrl: false });
        const layer = makeLayer({
          label: "Lakes",
          status: "error",
          visible: true,
          displayReady: false,
        });

        map.getAllLayers = () => [layer];
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("isLoadingLayers")).to.equal(false);
        expect(map.get("loadingLayersMessage")).to.equal(null);
      });

      it("treats visible layers that are not yet display-ready as loading", () => {
        const map = new Map({ showShareUrl: false });
        const layer = makeLayer({
          label: "Buildings (HABITAT-OSM)",
          status: "ready",
          visible: true,
          displayReady: false,
        });

        map.getAllLayers = () => [layer];
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("isLoadingLayers")).to.equal(true);
        expect(map.get("loadingLayersMessage")).to.equal(
          "Loading Buildings (HABITAT-OSM)",
        );
      });

      it("syncs per-layer loading flags with aggregate loading state", () => {
        const map = new Map({ showShareUrl: false });
        const roads = makeLayer({
          label: "Roads",
          status: "ready",
          visible: true,
          displayReady: false,
        });
        const buildings = makeLayer({
          label: "Buildings",
          status: "ready",
          visible: true,
          displayReady: true,
        });

        map.getAllLayers = () => [roads, buildings];
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(roads.get("isLoadingLayer")).to.equal(true);
        expect(buildings.get("isLoadingLayer")).to.equal(false);
        expect(map.get("isLoadingLayers")).to.equal(true);

        roads.set("displayReady", true);
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(roads.get("isLoadingLayer")).to.equal(false);
        expect(buildings.get("isLoadingLayer")).to.equal(false);
        expect(map.get("isLoadingLayers")).to.equal(false);
        expect(map.get("loadingLayersMessage")).to.equal(null);
      });

      it("ignores helper layers that opt out of loading state tracking", () => {
        const map = new Map({ showShareUrl: false });
        const layers = [
          makeLayer({
            label: "Your Polygon",
            status: "loading",
            visible: true,
            excludeFromLoadingState: true,
          }),
          makeLayer({
            label: "Habitat roads",
            status: "ready",
            visible: true,
            displayReady: false,
          }),
        ];

        map.getAllLayers = () => layers;
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("isLoadingLayers")).to.equal(true);
        expect(map.get("loadingLayersMessage")).to.equal(
          "Loading Habitat roads",
        );
      });

      it("summarizes multiple visible loading layers in the loading message", () => {
        const map = new Map({ showShareUrl: false });
        const layers = [
          makeLayer({
            label: "Habitat roads",
            status: "loading",
            visible: true,
          }),
          makeLayer({
            label: "Wetlands",
            status: "ready",
            visible: true,
            displayReady: false,
          }),
          makeLayer({
            label: "Elevation",
            status: "ready",
            visible: true,
            displayReady: false,
          }),
        ];

        map.getAllLayers = () => layers;
        LayerLoadingCoordinator.updateLayerLoadingState(map);

        expect(map.get("loadingLayersMessage")).to.equal(
          "Loading Habitat roads and 2 more layers",
        );
      });
    });
  });
});
