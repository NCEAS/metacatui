"use strict";

define([
  "backbone",
  "models/maps/Map",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetEditorView",
  `text!${MetacatUI.root}/css/map-view.css`,
], (Backbone, Map, CesiumImagery, MapAssetEditorView, MapCSS) => {
  const BASE_CLASS = "map-editor";
  const CLASS_NAMES = {
    BASE: BASE_CLASS,
    WORKSPACE: `${BASE_CLASS}__workspace`,
    LAYERS: `${BASE_CLASS}__layers`,
    LIST: `${BASE_CLASS}__list`,
    LAYER: `${BASE_CLASS}__layer`,
    ADD: `${BASE_CLASS}__add`,
    REMOVE: `${BASE_CLASS}__remove`,
    EMPTY: `${BASE_CLASS}__empty`,
    PANEL: `${BASE_CLASS}__panel`,
    HELP: `${BASE_CLASS}__help`,
  };

  /**
   * @class MapEditorView
   * @classdesc Displays a map configuration for editing.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapEditorView.png
   * @since 0.0.0
   */
  const MapEditorView = Backbone.View.extend(
    /** @lends MapEditorView.prototype */ {
      /**
       * The map configuration model.
       * @type {Map}
       */
      model: null,

      /**
       * The mounted editor for the asset being edited.
       * @type {MapAssetEditorView|null}
       */
      assetEditorView: null,

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /** @inheritdoc */
      attributes: {
        "data-category": "map",
      },

      /** @inheritdoc */
      events: {
        "click [data-asset]": "editAsset",
        "click [data-add-layer]": "addAsset",
        "click [data-remove-asset]": "removeAsset",
      },

      /**
       * Create the HTML for this view.
       * @returns {string} The HTML for this view.
       */
      template() {
        return `
          <h3>Map configuration</h3>
          <div class="${CLASS_NAMES.WORKSPACE}">
            <section class="${CLASS_NAMES.LAYERS}" aria-label="Layers">
              <h4>Layers</h4>
            </section>
            <section id="${this.cid}-asset-panel" class="${CLASS_NAMES.PANEL}" aria-label="Layer settings">
              <p>Select a layer to edit its settings.</p>
            </section>
          </div>
          <p class="${CLASS_NAMES.HELP}">Save the portal to keep your changes.</p>
        `;
      },

      /** @inheritdoc */
      initialize(options = {}) {
        this.model = options.model || new Map();
        MetacatUI.appModel.addCSS(MapCSS, "mapView");
      },

      /**
       * Display all configured layers and a panel for editing one asset.
       * @returns {MapEditorView} This view
       */
      render() {
        this.onClose();
        this.el.classList.add(CLASS_NAMES.BASE);
        this.el.innerHTML = this.template();
        const container = this.el.querySelector(`.${CLASS_NAMES.LAYERS}`);
        const categories = this.model.get("layerCategories");
        this.model.getLayerGroups().forEach((layers, index) => {
          const category = categories?.at(index);
          if (category) {
            const heading = document.createElement("h5");
            heading.textContent = category.get("label");
            container.append(heading);
          }
          const list = document.createElement("ul");
          list.className = CLASS_NAMES.LIST;
          layers.each((asset) => {
            const label = asset.get("label") || "Untitled layer";
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = CLASS_NAMES.LAYER;
            button.dataset.asset = asset.cid;
            button.setAttribute("aria-pressed", "false");
            button.setAttribute("aria-controls", `${this.cid}-asset-panel`);
            button.textContent = label;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = CLASS_NAMES.REMOVE;
            remove.dataset.removeAsset = asset.cid;
            remove.setAttribute("aria-label", `Remove ${label}`);
            remove.innerHTML =
              '<i class="icon icon-remove" aria-hidden="true"></i>';
            item.append(button, remove);
            list.append(item);
          });
          const add = document.createElement("button");
          add.type = "button";
          add.className = `btn ${CLASS_NAMES.ADD}`;
          add.dataset.addLayer = index;
          add.textContent = "Add layer";
          if (category) {
            add.setAttribute(
              "aria-label",
              `Add layer to ${category.get("label")}`,
            );
          }
          container.append(list, add);
          this.listenTo(layers, "update reset", this.render);
          this.listenTo(layers, "change:label", (asset) => {
            const label = asset.get("label") || "Untitled layer";
            this.el.querySelector(`[data-asset="${asset.cid}"]`).textContent =
              label;
            this.el
              .querySelector(`[data-remove-asset="${asset.cid}"]`)
              .setAttribute("aria-label", `Remove ${label}`);
          });
        });
        if (!this.model.getAllLayers().length) {
          const message = document.createElement("p");
          message.className = CLASS_NAMES.EMPTY;
          message.tabIndex = -1;
          message.textContent = "No layers configured.";
          container.append(message);
        }
        return this;
      },

      /**
       * Open settings for an existing asset without changing live map selection.
       * @param {Event} event The layer button click
       */
      editAsset(event) {
        const button = event.currentTarget;
        if (button.getAttribute("aria-pressed") !== "true") {
          this.assetEditorView?.remove();
          this.assetEditorView = null;
          this.el.querySelectorAll("[data-asset]").forEach((row) => {
            row.setAttribute("aria-pressed", String(row === button));
          });
          const asset = this.model
            .getAllLayers()
            .find((layer) => layer.cid === button.dataset.asset);
          const panel = this.el.querySelector(`.${CLASS_NAMES.PANEL}`);
          panel.replaceChildren();
          if (
            asset instanceof CesiumImagery &&
            MapAssetEditorView.SUPPORTED_TYPES.includes(asset.get("type"))
          ) {
            this.assetEditorView = new MapAssetEditorView({ model: asset });
            panel.append(this.assetEditorView.render().el);
          } else {
            const message = document.createElement("p");
            message.textContent = "Editing this layer is not supported yet.";
            panel.append(message);
          }
        }
        // Keyboard and assistive technology clicks have no pointer click count.
        if (event.originalEvent?.detail === 0 && this.assetEditorView) {
          this.assetEditorView.el.querySelector('[name="label"]').focus();
        }
      },

      /**
       * Add a WMTS layer to the chosen group and focus its label for editing.
       * @param {Event} event The add button click
       * @since 0.0.0
       */
      addAsset(event) {
        const layers =
          this.model.getLayerGroups()[event.currentTarget.dataset.addLayer];
        const asset = layers.addAsset(
          {
            label: "New layer",
            type: "WebMapTileServiceImageryProvider",
            cesiumOptions: { url: "" },
          },
          this.model,
        );
        this.el.querySelector(`[data-asset="${asset.cid}"]`).click();
        const label = this.assetEditorView.el.querySelector('[name="label"]');
        label.focus();
        label.select();
      },

      /**
       * Remove a layer immediately, retain any other selection, and move focus
       * to a remaining row or the empty list message.
       * @param {Event} event The remove button click
       * @returns {void}
       * @since 0.0.0
       */
      removeAsset(event) {
        const assetId = event.currentTarget.dataset.removeAsset;
        const assets = this.model.getAllLayers();
        const index = assets.findIndex((asset) => asset.cid === assetId);
        const selectedId = this.el.querySelector(
          '[data-asset][aria-pressed="true"]',
        )?.dataset.asset;
        this.model.removeAsset(assets[index]);
        if (selectedId && selectedId !== assetId) {
          this.el.querySelector(`[data-asset="${selectedId}"]`).click();
        }
        const rows = this.el.querySelectorAll("[data-asset]");
        const focusTarget =
          rows[Math.min(index, rows.length - 1)] ||
          this.el.querySelector(`.${CLASS_NAMES.EMPTY}`);
        focusTarget.focus();
      },

      /** Open the first invalid layer and focus its source settings. */
      showValidation() {
        const asset = this.model
          .getAllLayers()
          .find((layer) => layer.validationError);
        if (!asset) return;
        const button = this.el.querySelector(`[data-asset="${asset.cid}"]`);
        button.click();
        if (!this.assetEditorView) {
          button.focus();
          return;
        }
        this.assetEditorView.showValidation();
        const input = this.assetEditorView.el.querySelector(
          '[aria-invalid="true"]',
        );
        if (input) {
          const details = input.closest("details");
          if (details) details.open = true;
          input.focus();
        }
      },

      /** Remove the child editor and stop listening to layer changes. */
      onClose() {
        this.assetEditorView?.remove();
        this.assetEditorView = null;
        this.stopListening();
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return MapEditorView;
});
