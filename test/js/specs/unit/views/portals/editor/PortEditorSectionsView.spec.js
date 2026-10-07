define([
  "jquery",
  "backbone",
  "models/maps/Map",
  "models/maps/assets/CesiumImagery",
  "models/portals/PortalSectionModel",
  "models/portals/PortalVizSectionModel",
  "models/portals/PortalModel",
  "views/EditorView",
  "views/portals/editor/PortalEditorView",
  "views/portals/editor/PortEditorMapSectionView",
  "views/portals/editor/PortEditorMdSectionView",
  "views/portals/editor/PortEditorSectionsView",
  "/test/js/specs/shared/clean-state.js",
], (
  $,
  Backbone,
  Map,
  CesiumImagery,
  PortalSectionModel,
  PortalVizSectionModel,
  PortalModel,
  EditorView,
  PortalEditorView,
  PortEditorMapSectionView,
  PortEditorMdSectionView,
  PortEditorSectionsView,
  cleanState,
) => {
  const expect = chai.expect;

  describe("PortEditorSectionsView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const model = new Backbone.Model({
        pageOrder: null,
        sections: [],
      });
      model.addSection = (sectionType) => {
        let section = null;
        if (sectionType === "freeform") {
          section = new PortalSectionModel();
          model.set("sections", [...model.get("sections"), section]);
        }
        return section;
      };
      model.removeSection = (section) => {
        model.set(
          "sections",
          model.get("sections").filter((candidate) => candidate !== section),
        );
      };

      const editorView = { showControls() {} };
      const view = new PortEditorSectionsView({ model, editorView });
      view.sectionLabels = [];
      view.$el.html('<div class="sections-container"></div>');

      sandbox.stub(PortEditorMdSectionView.prototype, "render");
      sandbox.stub(view, "addSectionLink");
      sandbox.stub(view, "removeSectionLink");
      sandbox.stub(view, "switchSection");
      sandbox.stub(view, "toggleRemoveSectionOption");
      sandbox.stub(view, "updatePageOrder");

      return { model, sandbox, view };
    }, beforeEach);

    afterEach(() => {
      state.view.subviews.forEach((subview) => subview.remove());
      state.view.remove();
      state.sandbox.restore();
    });

    it("adds and selects a freeform section", () => {
      state.view.addSection("freeform");

      const section = state.model.get("sections")[0];
      const sectionView = state.view.getSectionByModel(section);

      expect(sectionView).to.be.instanceof(PortEditorMdSectionView);
      expect(sectionView.model).to.equal(section);
      expect(state.view.el.contains(sectionView.el)).to.equal(true);
      expect(state.view.switchSection.calledWith(sectionView)).to.equal(true);
      expect(state.view.updatePageOrder.calledOnce).to.equal(true);
    });

    it("uses the Cesium section map model in its map editor", () => {
      const mapModel = new Map();
      const section = new PortalVizSectionModel({
        label: "Map",
        visualizationType: "cesium",
        mapModel,
      });

      state.view.renderContentSection(section);

      const sectionView = state.view.getSectionByModel(section);
      expect(sectionView).to.be.instanceof(PortEditorMapSectionView);
      expect(sectionView.mapEditorView.model).to.equal(mapModel);
    });

    it("removes a freeform section", () => {
      const section = new PortalSectionModel({ label: "About" });
      const sectionView = new Backbone.View();
      sectionView.uniqueSectionLabel = "About";
      state.model.set("sections", [section]);
      state.view.sectionLabels = ["About"];
      state.view.subviews.push(sectionView);
      state.view.$(state.view.sectionsContainer).append(sectionView.el);

      const sectionLink = $("<li></li>")
        .data("model", section)
        .data("view", sectionView)
        .data("section-type", "freeform");

      state.view.removeSection(
        { currentTarget: $('<a class="disabled"></a>')[0] },
        sectionLink,
      );
      expect(state.model.get("sections")).to.deep.equal([section]);

      state.view.removeSection(null, sectionLink);

      expect(state.model.get("sections")).to.deep.equal([]);
      expect(state.view.sectionLabels).not.to.include("About");
      expect(state.view.subviews).not.to.include(sectionView);
      expect(state.view.el.contains(sectionView.el)).to.equal(false);
      expect(state.view.removeSectionLink.calledWith(sectionView)).to.equal(
        true,
      );
    });

    it("closes a previous map editor before rerendering its section", () => {
      const section = new PortalVizSectionModel({
        label: "Map",
        visualizationType: "cesium",
      });
      const sectionView = new PortEditorMapSectionView({
        model: section,
      }).render();
      const previous = sectionView.mapEditorView;
      const stopListening = state.sandbox.spy(previous, "stopListening");
      sectionView.render();
      expect(stopListening.called).to.equal(true);
      expect(sectionView.mapEditorView).not.to.equal(previous);
      sectionView.remove();
    });

    it("cleans up a map editor when its portal section is deleted", () => {
      const section = new PortalVizSectionModel({
        label: "Map",
        visualizationType: "cesium",
      });
      state.model.set("sections", [section]);
      state.view.renderContentSection(section);
      const sectionView = state.view.getSectionByModel(section);
      const sectionLink = $("<li></li>")
        .data("model", section)
        .data("view", sectionView)
        .data("section-type", "cesium");
      state.view.removeSection(null, sectionLink);
      expect(sectionView.mapEditorView).to.equal(null);
      expect(state.view.el.contains(sectionView.el)).to.equal(false);
    });

    it("shows portal save controls after a field change without requiring a keypress", () => {
      state.sandbox.stub(
        CesiumImagery.prototype,
        "createCesiumModelWhenVisible",
      );
      state.sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const mapModel = new Map({
        layers: [
          {
            label: "Imagery",
            type: "WebMapTileServiceImageryProvider",
            cesiumOptions: { url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}" },
          },
        ],
      });
      const section = new PortalVizSectionModel({
        label: "Map",
        visualizationType: "cesium",
        mapModel,
      });
      const editorView = new EditorView({ el: document.createElement("div") });
      editorView.el.innerHTML = '<div class="editor-controls hidden"></div>';
      state.view.editorView = editorView;
      const controls = editorView.el.querySelector(".editor-controls");
      state.view.renderContentSection(section);
      const sectionView = state.view.getSectionByModel(section);
      sectionView.el.querySelector("[data-asset]").click();
      const provider = sectionView.el.querySelector('[name="type"]');
      provider.value = "IonImageryProvider";
      provider.dispatchEvent(new Event("change", { bubbles: true }));
      expect(controls.classList.contains("hidden")).to.equal(false);
      sectionView.el.querySelector('[name="ionAssetId"]').value = "0";
      sectionView.el
        .querySelector('[name="ionAssetId"]')
        .dispatchEvent(new Event("change", { bubbles: true }));
      expect(
        mapModel.getAllLayers()[0].get("cesiumOptions").ionAssetId,
      ).to.equal("0");

      provider.value = "OpenStreetMapImageryProvider";
      provider.dispatchEvent(new Event("change", { bubbles: true }));
      expect(controls.classList.contains("hidden")).to.equal(false);
      editorView.remove();
      mapModel.getAllLayers().forEach((asset) => asset.stopListening());
    });

    it("shows portal save controls after removing a categorized layer", () => {
      state.sandbox.stub(
        CesiumImagery.prototype,
        "createCesiumModelWhenVisible",
      );
      state.sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const mapModel = new Map({
        layerCategories: [
          {
            label: "Base maps",
            layers: [{ label: "Base", type: "OpenStreetMapImageryProvider" }],
          },
          {
            label: "Overlays",
            layers: [
              { label: "Overlay", type: "OpenStreetMapImageryProvider" },
            ],
          },
        ],
      });
      const section = new PortalVizSectionModel({
        label: "Map",
        visualizationType: "cesium",
        mapModel,
      });
      const editorView = new EditorView({ el: document.createElement("div") });
      editorView.el.innerHTML = '<div class="editor-controls hidden"></div>';
      state.view.editorView = editorView;
      state.view.renderContentSection(section);
      const sectionView = state.view.getSectionByModel(section);
      const buttons = sectionView.el.querySelectorAll("[data-remove-asset]");
      expect(buttons).to.have.length(2);
      buttons[1].click();
      expect(
        editorView.el
          .querySelector(".editor-controls")
          .classList.contains("hidden"),
      ).to.equal(false);
      expect(
        mapModel.getAllLayers().map((asset) => asset.get("label")),
      ).to.deep.equal(["Base"]);
      editorView.remove();
      mapModel.getAllLayers().forEach((asset) => asset.stopListening());
      mapModel.stopListening();
    });

    it("shows save controls and validates a new layer in an empty category", () => {
      state.view.switchSection.restore();
      state.sandbox.stub(state.view, "updatePath");
      state.sandbox.stub(
        CesiumImagery.prototype,
        "createCesiumModelWhenVisible",
      );
      state.sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      state.sandbox.stub(MetacatUI.appView, "showAlert");
      const portal = new PortalModel({
        label: "map-portal",
        name: "Map portal",
      });
      portal
        .get("definitionFilters")
        .add({ fields: ["formatType"], values: ["METADATA"] });
      const mapModel = new Map({
        layerCategories: [
          {
            label: "Base maps",
            layers: [{ label: "Base", type: "OpenStreetMapImageryProvider" }],
          },
          { label: "Overlays", layers: [] },
        ],
      });
      const section = portal.addSection("cesium");
      section.set("mapModel", mapModel);
      const editorView = new PortalEditorView({
        el: document.createElement("div"),
        model: portal,
      });
      editorView.sectionsView = state.view;
      state.view.editorView = editorView;
      state.view.model = portal;
      editorView.el.innerHTML = '<div class="editor-controls hidden"></div>';
      editorView.el.append(state.view.el);
      document.body.append(editorView.el);
      state.view.renderContentSection(section);
      const sectionView = state.view.getSectionByModel(section);
      try {
        sectionView.el.querySelectorAll("[data-add-layer]")[1].click();
        expect(
          editorView.el
            .querySelector(".editor-controls")
            .classList.contains("hidden"),
        ).to.equal(false);
        sectionView.el.querySelector("[data-asset]").click();
        expect(portal.isValid()).to.equal(false);
        editorView.showValidation();
        expect(state.view.activeSection).to.equal(sectionView);
        expect(sectionView.mapEditorView.assetEditorView.model).to.equal(
          mapModel.getAllLayers()[1],
        );
        const url = sectionView.el.querySelector('textarea[name="url"]');
        expect(document.activeElement).to.equal(url);
        expect(url.getAttribute("aria-invalid")).to.equal("true");
        url.value = "/tiles/{TileMatrix}/{TileCol}/{TileRow}";
        url.dispatchEvent(new Event("change", { bubbles: true }));
        expect(portal.isValid()).to.equal(true);
      } finally {
        editorView.remove();
        mapModel.getAllLayers().forEach((asset) => asset.stopListening());
        mapModel.stopListening();
        portal.stopListening();
      }
    });

    it("opens the invalid layer and focuses its field during portal validation", () => {
      state.view.switchSection.restore();
      state.sandbox.stub(state.view, "updatePath");
      state.sandbox.stub(
        CesiumImagery.prototype,
        "createCesiumModelWhenVisible",
      );
      state.sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      state.sandbox.stub(MetacatUI.appView, "showAlert");
      const portal = new PortalModel({
        label: "map-portal",
        name: "Map portal",
      });
      portal
        .get("definitionFilters")
        .add({ fields: ["formatType"], values: ["METADATA"] });
      const section = portal.addSection("cesium");
      const mapModel = new Map({
        layers: [
          { label: "Basemap", type: "OpenStreetMapImageryProvider" },
          {
            label: "Incomplete",
            type: "IonImageryProvider",
            cesiumOptions: { ionAssetId: "0" },
          },
        ],
      });
      section.set("mapModel", mapModel);
      const editorView = new PortalEditorView({
        el: document.createElement("div"),
        model: portal,
      });
      editorView.sectionsView = state.view;
      state.view.editorView = editorView;
      state.view.model = portal;
      editorView.el.append(state.view.el);
      document.body.append(editorView.el);
      state.view.renderContentSection(section);
      const sectionView = state.view.getSectionByModel(section);
      sectionView.el.querySelector("[data-asset]").click();
      try {
        portal.isValid();
        editorView.showValidation();
        expect(state.view.activeSection).to.equal(sectionView);
        expect(sectionView.mapEditorView.assetEditorView.model).to.equal(
          mapModel.getAllLayers()[1],
        );
        const field = sectionView.el.querySelector('[name="ionAssetId"]');
        expect(document.activeElement).to.equal(field);
        expect(field.getAttribute("aria-invalid")).to.equal("true");
        expect(
          sectionView.el.querySelector(
            '[data-error="cesiumOptions.ionAssetId"]',
          ).textContent,
        ).not.to.equal("");

        const provider = sectionView.el.querySelector('[name="type"]');
        provider.value = "WebMapTileServiceImageryProvider";
        provider.dispatchEvent(new Event("change", { bubbles: true }));
        const tileURL = sectionView.el.querySelector("textarea[name=url]");
        tileURL.value = "/tiles/{TileMatrix}/{TileCol}/{TileRow}";
        tileURL.dispatchEvent(new Event("change", { bubbles: true }));
        const west = sectionView.el.querySelector('[name="west"]');
        west.value = "-143.9";
        west.dispatchEvent(new Event("change", { bubbles: true }));
        const details = sectionView.el.querySelector("details");
        expect(details.open).to.equal(false);
        portal.isValid();
        editorView.showValidation();
        expect(details.open).to.equal(true);
        expect(document.activeElement).to.equal(west);
        expect(west.getAttribute("aria-invalid")).to.equal("true");
      } finally {
        editorView.remove();
        mapModel.getAllLayers().forEach((asset) => asset.stopListening());
        portal.stopListening();
      }
    });

    it("places a Cesium section before non-content pages by default", () => {
      state.view.addSectionLink.restore();
      state.view.$el.html(`
        <ul class="section-links-container">
          <li class="section-link-container" data-section-name="Data"></li>
          <li class="section-link-container" data-section-name="AddPage"></li>
        </ul>
      `);

      const sectionView = new Backbone.View({
        model: new PortalVizSectionModel({
          label: "Map",
          visualizationType: "cesium",
        }),
      });
      sectionView.type = "PortEditorMapSection";
      sectionView.sectionType = "cesium";
      sectionView.uniqueSectionLabel = "Map";

      state.view.addSectionLink(sectionView, [], false);

      const sectionNames = state.view
        .$(state.view.sectionLinksContainer)
        .children()
        .map((index, link) => $(link).data("section-name"))
        .get();
      expect(sectionNames).to.deep.equal(["Map", "Data", "AddPage"]);

      sectionView.remove();
    });
  });
});
