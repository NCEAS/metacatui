define([
  "backbone",
  "models/maps/Map",
  "models/maps/AssetCategory",
  "collections/maps/AssetCategories",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
  "common/SearchParams",
  "common/IconUtilities",
  "text!/test/data/models/maps/mapConfig.json",
], (
  Backbone,
  Map,
  AssetCategory,
  AssetCategories,
  MapAssets,
  cleanState,
  SearchParams,
  IconUtilities,
  mapConfigText,
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

      it("defaults flat layers with undefined visibility to visible", () => {
        const map = new Map({
          layers: [{ layerId: "layer-1" }, { layerId: "layer-2" }],
        });

        expect(map.get("layers").at(0).get("visible")).to.be.true;
        expect(map.get("layers").at(1).get("visible")).to.be.true;
      });

      it("defaults categorized layers with undefined visibility to visible", () => {
        const map = new Map({
          layerCategories: [
            {
              layers: [{ layerId: "layer-1" }, { layerId: "layer-2" }],
            },
          ],
        });

        expect(map.getAllLayers()[0].get("visible")).to.be.true;
        expect(map.getAllLayers()[1].get("visible")).to.be.true;
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

    describe("toConfig", () => {
      it("round-trips the categorized map config fixture", () => {
        const inputConfig = JSON.parse(mapConfigText);
        const savedConfig = new Map(JSON.parse(mapConfigText)).toConfig();
        const reloadedConfig = new Map(
          JSON.parse(JSON.stringify(savedConfig)),
        ).toConfig();
        const {
          layerCategories,
          terrains,
          viewfinderCardCategories,
          ...mapSettings
        } = inputConfig;

        expect(reloadedConfig).to.deep.equal(savedConfig);
        expect(savedConfig).to.deep.include(mapSettings);
        expect(savedConfig.layerCategories).to.have.length(
          layerCategories.length,
        );
        layerCategories.forEach((category, index) => {
          const savedCategory = savedConfig.layerCategories[index];
          expect(savedCategory).to.deep.include({
            label: category.label,
            icon: category.icon,
            expanded: category.expanded,
          });
          expect(savedCategory.layers).to.have.length(category.layers.length);
          category.layers.forEach((layer, layerIndex) => {
            expect(savedCategory.layers[layerIndex]).to.deep.include(layer);
          });
        });
        expect(savedConfig.terrains).to.have.length(terrains.length);
        terrains.forEach((terrain, index) => {
          expect(savedConfig.terrains[index]).to.deep.include(terrain);
        });
        expect(savedConfig.viewfinderCardCategories).to.have.length(
          viewfinderCardCategories.length,
        );
        const firstCard = viewfinderCardCategories[0].viewfinderCards[0];
        viewfinderCardCategories.forEach((category, index) => {
          const savedCategory = savedConfig.viewfinderCardCategories[index];
          expect(savedCategory).to.deep.include({
            label: category.label,
            icon: category.icon,
            expanded: category.expanded,
          });
          expect(savedCategory.viewfinderCards).to.have.length(
            category.viewfinderCards.length,
          );
          category.viewfinderCards.forEach((card, cardIndex) => {
            const savedCard = savedCategory.viewfinderCards[cardIndex];
            expect(savedCard.title).to.equal(card.title);
            expect(savedCard.description).to.equal(card.description);
            expect(savedCard.image).to.equal(card.image);
            expect(savedCard.featureId).to.equal(card.featureId);
            expect(savedCard.featureLayerId).to.equal(card.featureLayerId);
            // The first card's top-level location adds a map button.
            if (index !== 0 || cardIndex !== 0) {
              expect(savedCard.buttons).to.deep.equal(card.buttons);
            }
          });
        });
        const firstSavedCard =
          savedConfig.viewfinderCardCategories[0].viewfinderCards[0];
        expect(firstSavedCard.buttons).to.deep.equal([
          ...firstCard.buttons,
          {
            type: "map",
            ordinality: "secondary",
            label: "View Layers",
            icon: "eye-open",
            latitude: firstCard.latitude,
            longitude: firstCard.longitude,
            height: firstCard.height,
            layerIds: firstCard.layerIds,
          },
        ]);
      });

      it("saves current config settings without live map state", () => {
        const map = new Map({ showToolbar: false });
        map.set("showToolbar", true);
        map.set("homePosition", { longitude: -80, latitude: 45 });
        map.set("activeVisualizationUrl", "https://example.com/live");

        const config = map.toConfig();

        expect(config.showToolbar).to.equal(true);
        expect(config.homePosition).to.deep.equal({
          longitude: -80,
          latitude: 45,
        });
        expect(config).not.to.have.any.keys(
          "interactions",
          "allLayers",
          "restoreState",
          "activeVisualizationUrl",
          "originalConfig",
        );
      });

      it("keeps map defaults and false values without nullish settings", () => {
        const config = new Map({ showToolbar: false }).toConfig();

        expect(config).to.include({ showToolbar: false, showLayerList: true });
        expect(config).not.to.have.any.keys("feedbackText", "globeBaseColor");
      });

      it("saves current flat layers and reloads the saved config", () => {
        const map = new Map({
          layers: [{ type: "OpenStreetMapImageryProvider", label: "Old" }],
        });
        map.get("layers").at(0).set("label", "Edited");
        map.addAsset({ type: "OpenStreetMapImageryProvider", label: "Added" });

        const config = map.toConfig();
        const reloaded = new Map(JSON.parse(JSON.stringify(config)));

        expect(config.layers.map((layer) => layer.label)).to.deep.equal([
          "Edited",
          "Added",
        ]);
        expect(reloaded.get("layers").pluck("label")).to.deep.equal([
          "Edited",
          "Added",
        ]);
      });

      it("saves current category metadata and assets with the config icon ID", async () => {
        const originalFetchIcon = IconUtilities.fetchIcon;
        IconUtilities.fetchIcon = () => Promise.resolve("<svg></svg>");

        try {
          const map = new Map({
            layerCategories: [
              {
                label: "Old category",
                icon: "category-icon-pid",
                layers: [
                  { type: "OpenStreetMapImageryProvider", label: "Old" },
                ],
              },
            ],
            layers: [
              { type: "OpenStreetMapImageryProvider", label: "Ignored" },
            ],
          });
          const category = map.get("layerCategories").at(0);
          category.set("label", "Edited category");
          category.get("mapAssets").at(0).set("label", "Edited layer");
          category.get("mapAssets").add({
            type: "OpenStreetMapImageryProvider",
            label: "Added layer",
          });
          await Promise.resolve();

          expect(category.get("icon")).not.to.equal("category-icon-pid");

          const config = map.toConfig();

          expect(config).not.to.have.property("layers");
          expect(config.layerCategories[0].label).to.equal("Edited category");
          expect(config.layerCategories[0].icon).to.equal("category-icon-pid");
          expect(config.layerCategories[0].expanded).to.equal(false);
          expect(
            config.layerCategories[0].layers.map((layer) => layer.label),
          ).to.deep.equal(["Edited layer", "Added layer"]);
          expect(config.layerCategories[0]).not.to.have.property("mapAssets");
          const reloaded = new Map(JSON.parse(JSON.stringify(config)));
          expect(reloaded.get("layerCategories").at(0).get("label")).to.equal(
            "Edited category",
          );
          expect(
            reloaded.getAllLayers().map((layer) => layer.get("label")),
          ).to.deep.equal(["Edited layer", "Added layer"]);
        } finally {
          IconUtilities.fetchIcon = originalFetchIcon;
        }
      });

      it("saves current terrain assets", () => {
        const map = new Map({
          terrains: [{ type: "CesiumTerrainProvider", label: "Old terrain" }],
        });
        map.get("terrains").at(0).set("label", "Edited terrain");

        expect(map.toConfig().terrains[0].label).to.equal("Edited terrain");
      });

      it("saves config visibility despite a live URL override", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: [] });
        const map = new Map({
          layers: [
            {
              type: "OpenStreetMapImageryProvider",
              layerId: "layer-1",
              visible: true,
            },
          ],
        });

        expect(map.get("layers").at(0).get("visible")).to.equal(false);
        expect(map.toConfig().layers[0].visible).to.equal(true);
      });

      it("round-trips an empty effective layer list", () => {
        const map = new Map();
        map.get("layers").reset();
        const config = map.toConfig();
        const reloaded = new Map(JSON.parse(JSON.stringify(config)));

        expect(config.layers).to.deep.equal([]);
        expect(reloaded.get("layers")).to.be.instanceof(MapAssets);
        expect(reloaded.getAllLayers()).to.have.length(0);
      });

      it("returns a detached JSON-safe config without live asset references", () => {
        const map = new Map({
          layers: [{ type: "OpenStreetMapImageryProvider", label: "Original" }],
        });
        map.get("layers").at(0).set("cesiumModel", { mapModel: map });

        const config = map.toConfig();
        config.homePosition.longitude = 12;
        config.layers[0].label = "Changed copy";

        expect(
          JSON.parse(JSON.stringify(config)).layers[0],
        ).not.to.have.property("cesiumModel");
        expect(map.get("homePosition").longitude).to.equal(-65);
        expect(map.get("layers").at(0).get("label")).to.equal("Original");
      });

      it("saves simple cards in the canonical category wrapper", () => {
        const map = new Map({
          viewfinderCards: [
            {
              title: "Home",
              latitude: 45,
              longitude: -80,
              imageFallback: null,
              featureId: null,
              featureLayerId: null,
            },
          ],
        });
        const config = map.toConfig();

        expect(config.viewfinderCardCategories).to.deep.equal([
          {
            label: "Zoom to...",
            icon: "plane",
            expanded: true,
            viewfinderCards: [
              {
                title: "Home",
                description: "",
                buttons: [
                  {
                    type: "map",
                    ordinality: "secondary",
                    label: "View Layers",
                    icon: "eye-open",
                    latitude: 45,
                    longitude: -80,
                    layerIds: [],
                  },
                ],
              },
            ],
          },
        ]);
        expect(config).not.to.have.any.keys(
          "viewfinderCards",
          "zoomPresets",
          "zoomPresetCategories",
        );
      });

      it("saves grouped inline card edits without live references", () => {
        const map = new Map({
          layers: [
            {
              type: "OpenStreetMapImageryProvider",
              layerId: "site",
              label: "Site",
            },
          ],
          viewfinderCardCategories: [
            {
              label: "Places",
              icon: "map-marker",
              expanded: false,
              viewfinderCards: [
                {
                  title: "Old title",
                  description: "Old description",
                  image: "https://example.com/old.png",
                  imageFallback: "https://example.com/fallback.png",
                  featureId: "feature-1",
                  featureLayerId: "site",
                  buttons: [
                    {
                      id: "open-dashboard",
                      type: "iframe",
                      label: "Open dashboard",
                      url: "https://example.com/dashboard",
                      initialQueryParams: { theme: "dark" },
                    },
                  ],
                },
              ],
            },
          ],
        });
        const category = map.get("viewfinderCardsCollection").at(0);
        const card = category.get("viewfinderCards").at(0);
        category.set({ label: "Edited places", expanded: true });
        card.set({
          title: "Edited title",
          image: "https://example.com/new.png",
        });
        card.set("buttons", [
          { ...card.get("buttons")[0], label: "Edited dashboard" },
        ]);
        card.set("featureLayer", map.get("layers").at(0));
        card.set("enabledLayerLabels", ["Site"]);

        const saved = map.toConfig().viewfinderCardCategories[0];

        expect(saved.label).to.equal("Edited places");
        expect(saved.expanded).to.equal(true);
        expect(saved.icon).to.equal("map-marker");
        expect(saved.viewfinderCards[0]).to.deep.equal({
          title: "Edited title",
          description: "Old description",
          image: "https://example.com/new.png",
          imageFallback: "https://example.com/fallback.png",
          featureId: "feature-1",
          featureLayerId: "site",
          buttons: [
            {
              id: "open-dashboard",
              type: "iframe",
              label: "Edited dashboard",
              url: "https://example.com/dashboard",
              initialQueryParams: { theme: "dark" },
            },
          ],
        });
        expect(map.has("originalConfig")).to.equal(false);
      });

      it("converts both legacy simple and category keys to canonical output", () => {
        const simple = new Map({
          zoomPresets: [
            { title: "Simple", position: { latitude: 1, longitude: 2 } },
          ],
        });
        const grouped = new Map({
          zoomPresetCategories: [
            {
              label: "Legacy",
              zoomPresets: [{ title: "Grouped", layerIds: ["site"] }],
            },
          ],
        });

        expect(
          simple.toConfig().viewfinderCardCategories[0].viewfinderCards[0]
            .buttons,
        ).to.have.length(1);
        expect(
          grouped.toConfig().viewfinderCardCategories[0].viewfinderCards[0]
            .buttons,
        ).to.deep.equal([
          {
            type: "map",
            ordinality: "secondary",
            label: "View Layers",
            icon: "eye-open",
            layerIds: ["site"],
          },
        ]);
        expect(grouped.toConfig()).not.to.have.any.keys(
          "zoomPresets",
          "zoomPresetCategories",
        );
        expect(
          grouped.toConfig().viewfinderCardCategories[0],
        ).not.to.have.property("zoomPresets");
      });

      it("keeps one legacy map action after two save and reload cycles", () => {
        [
          { position: { latitude: 45, longitude: -80 }, layerIds: ["site"] },
          { layerIds: ["site"] },
        ].forEach((legacyCard) => {
          const first = new Map({
            viewfinderCards: [{ title: "Legacy", ...legacyCard }],
          });
          const second = new Map(first.toConfig());
          const third = new Map(second.toConfig());

          expect(
            second.toConfig().viewfinderCardCategories[0].viewfinderCards[0]
              .buttons,
          ).to.have.length(1);
          expect(
            third.toConfig().viewfinderCardCategories[0].viewfinderCards[0]
              .buttons,
          ).to.have.length(1);
        });
      });

      it("keeps a URL card source before and after fetched cards load", () => {
        const source = {
          url: "https://leonetwork.org/en/lists/geojson/example",
          layerIds: ["site"],
          featureLayerId: "site",
          initialQueryParams: { language: "en" },
        };
        const map = new Map({
          viewfinderCardCategories: [
            { label: "Network", viewfinderCards: source },
          ],
        });
        const cards = map
          .get("viewfinderCardsCollection")
          .at(0)
          .get("viewfinderCards");
        expect(
          map.toConfig().viewfinderCardCategories[0].viewfinderCards,
        ).to.deep.equal(source);

        cards.sync = (_method, _collection, options) => {
          options.success({
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [-80, 45] },
                properties: {
                  id: "observation-1",
                  localized_date: "2026 Sep 24",
                  thumbnail_url: "/en/attachments/thumbnail/image-1",
                  observation: { title: "Fetched", summary: "Summary" },
                },
              },
            ],
          });
        };
        cards.fetch();

        expect(cards).to.have.length(1);
        expect(
          map.toConfig().viewfinderCardCategories[0].viewfinderCards,
        ).to.deep.equal(source);
      });

      it("keeps a category icon ID after its SVG loads", async () => {
        const originalFetchIcon = IconUtilities.fetchIcon;
        IconUtilities.fetchIcon = () => Promise.resolve("<svg></svg>");

        try {
          const map = new Map({
            viewfinderCardCategories: [
              {
                label: "Places",
                icon: "doi:10.1234/icon",
                viewfinderCards: [],
              },
            ],
          });
          await Promise.resolve();
          const category = map.get("viewfinderCardsCollection").at(0);

          expect(category.get("icon")).not.to.equal("doi:10.1234/icon");
          expect(map.toConfig().viewfinderCardCategories[0].icon).to.equal(
            "doi:10.1234/icon",
          );
        } finally {
          IconUtilities.fetchIcon = originalFetchIcon;
        }
      });

      it("omits only assets explicitly marked as live and temporary", () => {
        const map = new Map({ layers: [] });
        map.addAsset({
          type: "OpenStreetMapImageryProvider",
          label: "Legitimate hidden layer",
          hideInLayerList: true,
        });
        map.addAsset({
          type: "CustomDataSource",
          label: "Your Polygon",
          transient: true,
        });

        expect(map.toConfig().layers.map((layer) => layer.label)).to.deep.equal(
          ["Legitimate hidden layer"],
        );
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
