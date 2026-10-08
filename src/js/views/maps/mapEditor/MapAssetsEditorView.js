"use strict";

define([
  "backbone",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetItemView",
  "views/maps/mapEditor/MapAssetEditorView",
  "views/maps/mapEditor/MapAssetCategoryView",
], (
  Backbone,
  CesiumImagery,
  MapAssetItemView,
  MapAssetEditorView,
  MapAssetCategoryView,
) => {
  const CLASS_NAMES = {
    WORKSPACE: "map-editor__workspace",
    LAYERS: "map-editor__layers",
    ADD: "map-editor__add",
    EMPTY: "map-editor__empty",
    PANEL: "map-editor__panel",
    LIST: "layer-list",
    ITEM: "list-item",
    ITEM_LABEL: "list-item__label",
    ADD_ROW: "map-editor__add-row",
    ICON: "icon",
    ADD_ICON: "icon-plus",
  };
  const ADD_LAYER_ATTRIBUTE = "data-add-layer";
  const ASSET_PANEL_ID_SUFFIX = "asset-panel";
  const WMTS_PROVIDER = "WebMapTileServiceImageryProvider";
  const MESSAGES = {
    LAYERS: "Layers",
    SETTINGS: "Layer settings",
    SELECT_LAYER: "Select a layer to edit its settings.",
    NO_LAYERS: "No layers configured.",
    ADD_LAYER: "Add layer",
    NEW_LAYER: "New layer",
    UNSUPPORTED_LAYER: "Editing this layer is not supported yet.",
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
        [`click [${ADD_LAYER_ATTRIBUTE}]`]: "addAsset",
      },

      /**
       * Initialize editor selection and the owned child views.
       * @returns {void}
       */
      initialize() {
        this.selectedAsset = null;
        this.assetEditorView = null;
        this.assetItemViews = [];
        this.layerLists = [];
      },

      /**
       * Create the layers workspace and subscribe to its existing collections.
       * @returns {MapAssetsEditorView} This view
       */
      render() {
        this.onClose();
        this.el.innerHTML = `
          <section class="${CLASS_NAMES.LAYERS}" aria-label="${MESSAGES.LAYERS}"></section>
          <section id="${this.cid}-${ASSET_PANEL_ID_SUFFIX}" class="${CLASS_NAMES.PANEL}" aria-label="${MESSAGES.SETTINGS}">
            <p>${MESSAGES.SELECT_LAYER}</p>
          </section>
        `;
        const container = this.el.querySelector(`.${CLASS_NAMES.LAYERS}`);
        const categories = this.model.get("layerCategories");
        this.model.getLayerGroups().forEach((layers, index) => {
          const category = categories?.at(index);
          let categoryView;
          if (category) {
            categoryView = new MapAssetCategoryView({
              model: category,
            }).render();
            container.append(categoryView.el);
          }
          this.createLayerList(
            layers,
            categoryView?.contentEl || container,
            categoryView,
          );
          this.listenTo(layers, "update reset", this.renderList);
        });
        container.insertAdjacentHTML(
          "beforeend",
          `<p class="${CLASS_NAMES.EMPTY}" tabindex="-1">${MESSAGES.NO_LAYERS}</p>`,
        );
        this.renderList();
        return this;
      },

      /**
       * Create a stable layer list and a separate Add control.
       * @param {MapAssets} layers The collection shown in this list
       * @param {HTMLElement} host The container for the list and Add control
       * @param {MapAssetCategoryView} [categoryView] The category presentation
       * @since 0.0.0
       */
      createLayerList(layers, host, categoryView) {
        const group = document.createElement("div");
        const list = document.createElement("ul");
        list.className = CLASS_NAMES.LIST;
        const addRow = document.createElement("div");
        addRow.className = `${CLASS_NAMES.ITEM} ${CLASS_NAMES.ADD_ROW}`;
        const add = document.createElement("button");
        add.type = "button";
        add.className = `${CLASS_NAMES.ITEM_LABEL} ${CLASS_NAMES.ADD}`;
        add.setAttribute(ADD_LAYER_ATTRIBUTE, this.layerLists.length);
        add.innerHTML = `<i class="${CLASS_NAMES.ICON} ${CLASS_NAMES.ADD_ICON}" aria-hidden="true"></i> ${MESSAGES.ADD_LAYER}`;
        if (categoryView) {
          const category = categoryView.model;
          const updateName = () =>
            add.setAttribute(
              "aria-label",
              `${MESSAGES.ADD_LAYER} to ${category.get("label")}`,
            );
          updateName();
          this.listenTo(category, "change:label", updateName);
        }
        addRow.append(add);
        group.append(list, addRow);
        host.append(group);
        this.layerLists.push({ layers, list, categoryView });
      },

      /**
       * Create a layer row and subscribe to its selection and removal requests.
       * @param {MapAsset} asset The layer represented by the row
       * @returns {MapAssetItemView} The rendered row
       * @since 0.0.0
       */
      createAssetItem(asset) {
        const item = new MapAssetItemView({
          model: asset,
          panelId: `${this.cid}-${ASSET_PANEL_ID_SUFFIX}`,
        });
        this.listenTo(item, "select:asset", (selected, event) => {
          this.selectAsset(selected);
          // Keyboard and assistive technology clicks have no pointer click count.
          if (event?.originalEvent?.detail === 0)
            this.assetEditorView?.focusLabel();
        });
        this.listenTo(item, "remove:asset", this.removeAsset);
        return item.render();
      },

      /**
       * Synchronize rows while retaining surviving controls and the active form.
       * @returns {void}
       */
      renderList() {
        const previousItems = this.assetItemViews;
        const assets = this.model.getAllLayers();
        previousItems.forEach((item) => {
          if (!assets.includes(item.model)) {
            this.stopListening(item);
            item.remove();
          }
        });
        const orderedItems = [];
        this.layerLists.forEach(({ layers, list }) => {
          let next = list.firstElementChild;
          layers.each((asset) => {
            const item =
              previousItems.find((row) => row.model === asset) ||
              this.createAssetItem(asset);
            // Leave ordered rows in place so their controls keep focus.
            if (item.el !== next) list.insertBefore(item.el, next);
            next = item.el.nextElementSibling;
            item.setSelected(asset === this.selectedAsset);
            orderedItems.push(item);
          });
        });
        this.assetItemViews = orderedItems;
        this.el.querySelector(`.${CLASS_NAMES.EMPTY}`).hidden =
          orderedItems.length > 0;
        if (this.selectedAsset && !assets.includes(this.selectedAsset)) {
          this.selectAsset(null);
        }
      },

      /**
       * Select an asset for editing without changing runtime map selection.
       * @param {MapAsset|null} asset The layer to edit, or null to clear selection
       * @returns {void}
       */
      selectAsset(asset) {
        this.assetItemViews.forEach((item) => {
          item.setSelected(item.model === asset);
        });
        this.layerLists
          .find(({ layers }) => layers.get(asset))
          ?.categoryView?.setExpanded(true);
        if (asset === this.selectedAsset) return;
        this.assetEditorView?.remove();
        this.assetEditorView = null;
        this.selectedAsset = asset;
        const panel = this.el.querySelector(`.${CLASS_NAMES.PANEL}`);
        panel.replaceChildren();
        panel.scrollTop = 0;
        if (
          asset instanceof CesiumImagery &&
          MapAssetEditorView.SUPPORTED_TYPES.includes(asset.get("type"))
        ) {
          this.assetEditorView = new MapAssetEditorView({ model: asset });
          panel.append(this.assetEditorView.render().el);
        } else {
          const message = document.createElement("p");
          message.textContent = asset
            ? MESSAGES.UNSUPPORTED_LAYER
            : MESSAGES.SELECT_LAYER;
          panel.append(message);
        }
      },

      /**
       * Add a WMTS layer to the chosen group and select its label for editing.
       * @param {Event} event The add button click
       * @returns {void}
       */
      addAsset(event) {
        const { layers } =
          this.layerLists[
            event.currentTarget.getAttribute(ADD_LAYER_ATTRIBUTE)
          ];
        const asset = layers.addAsset(
          {
            label: MESSAGES.NEW_LAYER,
            type: WMTS_PROVIDER,
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
        if (item) {
          this.layerLists
            .find(({ layers }) => layers.get(item.model))
            .categoryView?.setExpanded(true);
          item.focus();
        } else this.el.querySelector(`.${CLASS_NAMES.EMPTY}`).focus();
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
       * Release rows, categories, the active form, and workspace subscriptions.
       * @returns {void}
       */
      onClose() {
        this.assetItemViews.forEach((item) => item.remove());
        this.layerLists.forEach(({ categoryView }) => categoryView?.remove());
        this.assetItemViews = [];
        this.layerLists = [];
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
