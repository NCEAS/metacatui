"use strict";

define([
  "backbone",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetItemView",
  "views/maps/mapEditor/MapAssetEditorView",
], (Backbone, CesiumImagery, MapAssetItemView, MapAssetEditorView) => {
  const CLASS_NAMES = {
    WORKSPACE: "map-editor__workspace",
    LAYERS: "map-editor__layers",
    LIST: "map-editor__list",
    ADD: "map-editor__add",
    EMPTY: "map-editor__empty",
    PANEL: "map-editor__panel",
  };

  /**
   * @class MapAssetsEditorView
   * @classdesc Owns layer lists, editor selection, and the active asset form.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapAssetsEditorView.png
   * @since 0.0.0
   */
  return Backbone.View.extend(
    /** @lends MapAssetsEditorView.prototype */ {
      /** @inheritdoc */
      className: CLASS_NAMES.WORKSPACE,

      /** @inheritdoc */
      events: {
        "click [data-add-layer]": "addAsset",
      },

      /**
       * Initialize editor selection and the owned child views.
       * @returns {void}
       */
      initialize() {
        this.selectedAsset = null;
        this.assetEditorView = null;
        this.assetItemViews = [];
      },

      /**
       * Create the layers workspace and subscribe to its existing collections.
       * @returns {MapAssetsEditorView} This view
       */
      render() {
        this.onClose();
        this.el.innerHTML = `
          <section class="${CLASS_NAMES.LAYERS}" aria-label="Layers"></section>
          <section id="${this.cid}-asset-panel" class="${CLASS_NAMES.PANEL}" aria-label="Layer settings">
            <p>Select a layer to edit its settings.</p>
          </section>
        `;
        this.model.getLayerGroups().forEach((layers) => {
          this.listenTo(layers, "update reset", this.renderList);
        });
        this.renderList();
        return this;
      },

      /**
       * Rebuild categorized rows while retaining the active asset form.
       * @returns {void}
       */
      renderList() {
        this.assetItemViews.forEach((item) => {
          this.stopListening(item);
          item.remove();
        });
        this.assetItemViews = [];
        const container = this.el.querySelector(`.${CLASS_NAMES.LAYERS}`);
        container.innerHTML = "<h4>Layers</h4>";
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
            const item = new MapAssetItemView({
              model: asset,
              panelId: `${this.cid}-asset-panel`,
            });
            this.assetItemViews.push(item);
            this.listenTo(item, "select:asset", (selected, event) => {
              this.selectAsset(selected);
              // Keyboard and assistive technology clicks have no pointer click count.
              if (event?.originalEvent?.detail === 0)
                this.assetEditorView?.focusLabel();
            });
            this.listenTo(item, "remove:asset", this.removeAsset);
            list.append(item.render().el);
            item.setSelected(asset === this.selectedAsset);
          });
          const add = document.createElement("button");
          add.type = "button";
          add.className = `btn ${CLASS_NAMES.ADD}`;
          add.dataset.addLayer = index;
          add.textContent = "Add layer";
          if (category)
            add.setAttribute(
              "aria-label",
              `Add layer to ${category.get("label")}`,
            );
          container.append(list, add);
        });
        if (!this.assetItemViews.length) {
          const message = document.createElement("p");
          message.className = CLASS_NAMES.EMPTY;
          message.tabIndex = -1;
          message.textContent = "No layers configured.";
          container.append(message);
        }
        if (
          this.selectedAsset &&
          !this.assetItemViews.some((item) => item.model === this.selectedAsset)
        ) {
          this.selectAsset(null);
        }
      },

      /**
       * Select an asset for editing without changing runtime map selection.
       * @param {MapAsset|null} asset The layer to edit, or null to clear selection
       * @returns {void}
       */
      selectAsset(asset) {
        this.assetItemViews.forEach((item) =>
          item.setSelected(item.model === asset),
        );
        if (asset === this.selectedAsset) return;
        this.assetEditorView?.remove();
        this.assetEditorView = null;
        this.selectedAsset = asset;
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
          message.textContent = asset
            ? "Editing this layer is not supported yet."
            : "Select a layer to edit its settings.";
          panel.append(message);
        }
      },

      /**
       * Add a WMTS layer to the chosen group and select its label for editing.
       * @param {Event} event The add button click
       * @returns {void}
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
        this.selectAsset(asset);
        this.assetEditorView.focusLabel();
      },

      /**
       * Remove a layer and focus the next row, preceding row, or empty state.
       * @param {MapAsset} asset The layer to remove
       * @returns {void}
       */
      removeAsset(asset) {
        const index = this.assetItemViews.findIndex(
          (item) => item.model === asset,
        );
        this.model.removeAsset(asset);
        const item =
          this.assetItemViews[Math.min(index, this.assetItemViews.length - 1)];
        if (item) item.focus();
        else this.el.querySelector(`.${CLASS_NAMES.EMPTY}`).focus();
      },

      /**
       * Select the first invalid layer and delegate feedback to its form.
       * @returns {void}
       */
      showValidation() {
        const invalidItem = this.assetItemViews.find(
          (item) => item.model.validationError,
        );
        if (!invalidItem) return;
        this.selectAsset(invalidItem.model);
        if (this.assetEditorView) this.assetEditorView.showValidation();
        else invalidItem.focus();
      },

      /**
       * Release rows, the active form, and collection subscriptions.
       * @returns {void}
       */
      onClose() {
        this.assetItemViews.forEach((item) => item.remove());
        this.assetItemViews = [];
        this.assetEditorView?.remove();
        this.assetEditorView = null;
        this.selectedAsset = null;
        this.stopListening();
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );
});
