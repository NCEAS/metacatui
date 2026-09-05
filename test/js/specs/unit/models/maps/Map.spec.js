define([
  "backbone",
  "models/maps/Map",
  "models/maps/AssetCategory",
  "collections/maps/AssetCategories",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
  "common/SearchParams",
], (
  Backbone,
  Map,
  AssetCategory,
  AssetCategories,
  MapAssets,
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
        const originalUpdateActiveFeatures = SearchParams.updateActiveFeatures;
        let updateActiveFeaturesCallCount = 0;

        SearchParams.updateActiveFeatures = () => {
          updateActiveFeaturesCallCount += 1;
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

          expect(updateActiveFeaturesCallCount).to.equal(1);
        } finally {
          SearchParams.updateActiveFeatures = originalUpdateActiveFeatures;
        }
      });

      it("syncs only stable property-based feature ids to URL state", () => {
        const map = new Map({ showShareUrl: true });
        const originalUpdateActiveFeatures = SearchParams.updateActiveFeatures;
        let latestFeatures = null;

        SearchParams.updateActiveFeatures = (features) => {
          latestFeatures = features;
        };

        try {
          map.selectFeatures([
            {
              featureID: "cesium-generated-uuid",
              properties: {
                id: "stable-feature-id",
              },
              mapAsset: null,
              featureObject: {},
              label: null,
            },
            {
              featureID: "another-unstable-uuid",
              properties: {},
              mapAsset: null,
              featureObject: {},
              label: null,
            },
          ]);

          expect(latestFeatures).to.deep.equal([
            { featureId: "stable-feature-id", layerId: null },
          ]);
        } finally {
          SearchParams.updateActiveFeatures = originalUpdateActiveFeatures;
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

      it("does nothing when activeFeatures is empty", () => {
        const map = new Map({ showShareUrl: true });
        map.set("restoreState", { activeFeatures: [] });
        map.applyFeatureRestoreState();
        expect(map.getSelectedFeatures()?.models).to.have.lengthOf(0);
      });

      it("does nothing when showShareUrl is false", () => {
        const map = new Map({ showShareUrl: false });
        map.set("restoreState", {
          activeFeatures: [{ featureId: "feat-1", layerId: null }],
        });
        map.applyFeatureRestoreState();
        expect(map.getSelectedFeatures()?.models).to.have.lengthOf(0);
      });

      it("selects a feature when a ready layer finds it immediately", () => {
        const map = new Map({ showShareUrl: true });
        const fakeFeature = {};
        const mapAsset = new Backbone.Model({ layerId: "layer-a" });
        const fakeAttrs = {
          featureID: "feat-1",
          properties: {},
          mapAsset,
          featureObject: fakeFeature,
          label: null,
        };

        const layer = makeLayer({
          layerId: "layer-a",
          getFeatureById: (id) => (id === "feat-1" ? fakeFeature : null),
          getFeatureAttributes: () => fakeAttrs,
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", {
          activeFeatures: [{ featureId: "feat-1", layerId: null }],
        });
        map.applyFeatureRestoreState();

        const selected = map.getSelectedFeatures()?.models || [];
        expect(selected.some((f) => f.get("featureID") === "feat-1")).to.equal(
          true,
        );
      });

      it("uses waitForFeatureById when a ready tileset layer doesn't find the feature immediately", (done) => {
        const map = new Map({ showShareUrl: true });
        const fakeFeature = {};
        const mapAsset = new Backbone.Model({ layerId: "buildings" });
        const fakeAttrs = {
          featureID: "building-42",
          properties: {},
          mapAsset,
          featureObject: fakeFeature,
          label: null,
        };

        let tileAvailable = false;
        let tileCallback = null;
        const layer = makeLayer({
          layerId: "buildings",
          // Returns the feature only once the tile is "loaded"
          getFeatureById: () => (tileAvailable ? fakeFeature : null),
          getFeatureAttributes: () => fakeAttrs,
          waitForFeatureById: (_id, cb) => {
            tileCallback = cb;
            return () => {};
          },
        });

        map.getAllLayers = () => [layer];
        map.set("restoreState", {
          activeFeatures: [{ featureId: "building-42", layerId: null }],
        });
        map.applyFeatureRestoreState();

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
          done();
        }, 0);
      });

      it("keeps the restore session active across partial feature resolution", (done) => {
        const map = new Map({ showShareUrl: true });
        const originalUpdateActiveFeatures = SearchParams.updateActiveFeatures;
        const urlUpdates = [];
        const fakeFeatureA = {};
        const fakeFeatureB = {};
        const mapAsset = new Backbone.Model({ layerId: "layer-main" });
        const fakeAttrsA = {
          featureID: "feature-a",
          properties: { id: "feature-a" },
          mapAsset,
          featureObject: fakeFeatureA,
          label: null,
        };
        const fakeAttrsB = {
          featureID: "feature-b",
          properties: { id: "feature-b" },
          mapAsset,
          featureObject: fakeFeatureB,
          label: null,
        };

        let tileAvailable = false;
        let tileCallback = null;

        SearchParams.updateActiveFeatures = (features) => {
          urlUpdates.push(features.map((feature) => ({ ...feature })));
        };

        const layer = makeLayer({
          layerId: "layer-main",
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
          activeFeatures: [
            { featureId: "feature-a", layerId: null },
            { featureId: "feature-b", layerId: null },
          ],
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
          expect(map.featureRestoreSession?.requestedFeatures).to.deep.equal([
            { featureId: "feature-a", layerId: null },
            { featureId: "feature-b", layerId: null },
          ]);
          expect(urlUpdates.at(-1)).to.deep.equal([
            { featureId: "feature-a", layerId: "layer-main" },
            { featureId: "feature-b", layerId: null },
          ]);

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
                { featureId: "feature-a", layerId: "layer-main" },
                { featureId: "feature-b", layerId: "layer-main" },
              ]);
              SearchParams.updateActiveFeatures = originalUpdateActiveFeatures;
              done();
            } catch (error) {
              SearchParams.updateActiveFeatures = originalUpdateActiveFeatures;
              done(error);
            }
          }, 0);
        } catch (error) {
          SearchParams.updateActiveFeatures = originalUpdateActiveFeatures;
          done(error);
        }
      });

      it("restores the matching layer when feature ids collide", () => {
        const map = new Map({ showShareUrl: true });
        const layerAAsset = new Backbone.Model({ layerId: "layer-a" });
        const layerBAsset = new Backbone.Model({ layerId: "layer-b" });
        const sharedFeatureId = "row-1";
        const featureA = { source: "a" };
        const featureB = { source: "b" };

        const layerA = makeLayer({
          layerId: "layer-a",
          getFeatureById: (id) => (id === sharedFeatureId ? featureA : null),
          getFeatureAttributes: (feature) =>
            feature === featureA
              ? {
                  featureID: sharedFeatureId,
                  properties: { source: "a" },
                  mapAsset: layerAAsset,
                  featureObject: featureA,
                  label: null,
                }
              : null,
        });
        const layerB = makeLayer({
          layerId: "layer-b",
          getFeatureById: (id) => (id === sharedFeatureId ? featureB : null),
          getFeatureAttributes: (feature) =>
            feature === featureB
              ? {
                  featureID: sharedFeatureId,
                  properties: { source: "b" },
                  mapAsset: layerBAsset,
                  featureObject: featureB,
                  label: null,
                }
              : null,
        });

        map.getAllLayers = () => [layerA, layerB];
        map.set("restoreState", {
          activeFeatures: [
            {
              featureId: sharedFeatureId,
              layerId: "layer-b",
            },
          ],
        });

        map.applyFeatureRestoreState();

        const selected = map.getSelectedFeatures()?.models || [];
        expect(selected).to.have.lengthOf(1);
        expect(selected[0].get("mapAsset").get("layerId")).to.equal("layer-b");
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
        map.set("restoreState", {
          activeFeatures: [{ featureId: "feature-slow", layerId: null }],
        });
        map.applyFeatureRestoreState();

        expect(cancelCount).to.equal(0);

        map.handleShowShareUrlChange(map, false);

        expect(cancelCount).to.equal(1);
      });

      it("skips layers without getFeatureById", () => {
        const map = new Map({ showShareUrl: true });
        const layer = { get: () => "ready" };
        map.getAllLayers = () => [layer];
        map.set("restoreState", {
          activeFeatures: [{ featureId: "feat-x", layerId: null }],
        });
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
        map.set("restoreState", {
          activeFeatures: [{ featureId: "feature-a", layerId: null }],
        });
        map.applyFeatureRestoreState();

        map.set("restoreState", {
          activeFeatures: [{ featureId: "feature-b", layerId: null }],
        });
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
        map.set("restoreState", {
          activeFeatures: [{ featureId: "feature-a", layerId: null }],
        });
        map.applyFeatureRestoreState();
        map.applyFeatureRestoreState();
        map.applyFeatureRestoreState();

        expect(waitCallCount).to.equal(1);
      });
    });
  });
});
