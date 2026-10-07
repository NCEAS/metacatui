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
        "click [data-toggle-category]": "toggleCategory",
      },

      /**
       * Initialize editor selection and the owned child views.
       * @returns {void}
       */
      initialize() {
        this.selectedAsset = null;
        this.assetEditorView = null;
        this.assetItemViews = [];
        this.collapsedCategories = new Set();
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
        this.model.get("layerCategories")?.each((category) => {
          this.listenTo(category, "change:icon", () => {
            this.el.querySelector(
              `[data-toggle-category="${category.cid}"] .expansion-panel__icon`,
            ).innerHTML = category.get("icon");
          });
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
        container.replaceChildren();
        const categories = this.model.get("layerCategories");
        this.model.getLayerGroups().forEach((layers, index) => {
          const category = categories?.at(index);
          let content = container;
          if (category) {
            const group = document.createElement("section");
            group.className = "expansion-panel";
            group.innerHTML = `
              <h5>
                <button type="button" class="expansion-panel__toggle" data-toggle-category="${category.cid}"
                  aria-controls="${this.cid}-${category.cid}-layers">
                  <span class="expansion-panel__icon" aria-hidden="true"></span>
                  <span class="expansion-panel__title"></span>
                  <span class="expansion-panel__icon-toggle" aria-hidden="true">
                    <i class="icon icon-caret-down"></i>
                    <i class="icon icon-caret-up"></i>
                  </span>
                </button>
              </h5>
              <div id="${this.cid}-${category.cid}-layers" class="expansion-panel__content"></div>
            `;
            group.querySelector(".expansion-panel__title").textContent =
              category.get("label");
            group.querySelector(".expansion-panel__icon").innerHTML =
              category.get("icon");
            this.setCategoryExpanded(
              group,
              !this.collapsedCategories.has(category.cid),
            );
            container.append(group);
            content = group.querySelector(".expansion-panel__content");
          }
          const list = document.createElement("ul");
          list.className = "layer-list";
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
          const addItem = document.createElement("li");
          addItem.className = "list-item";
          const add = document.createElement("button");
          add.type = "button";
          add.className = `list-item__label ${CLASS_NAMES.ADD}`;
          add.dataset.addLayer = index;
          add.innerHTML =
            '<i class="icon icon-plus" aria-hidden="true"></i> Add layer';
          if (category)
            add.setAttribute(
              "aria-label",
              `Add layer to ${category.get("label")}`,
            );
          addItem.append(add);
          list.append(addItem);
          content.append(list);
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
       * Toggle a category without changing the saved map configuration.
       * @param {Event} event The category button activation
       */
      toggleCategory(event) {
        const button = event.currentTarget;
        this.setCategoryExpanded(
          button.closest(".expansion-panel"),
          button.getAttribute("aria-expanded") !== "true",
        );
      },

      /**
       * Set category visibility and update its disclosure and editor state.
       * @param {HTMLElement} group The category's expansion panel
       * @param {boolean} expanded Whether its layers are shown
       */
      setCategoryExpanded(group, expanded) {
        const button = group.querySelector("[data-toggle-category]");
        button.setAttribute("aria-expanded", String(expanded));
        group.classList.toggle("show-content", expanded);
        const content = group.querySelector(".expansion-panel__content");
        content.hidden = !expanded;
        if (expanded)
          this.collapsedCategories.delete(button.dataset.toggleCategory);
        else this.collapsedCategories.add(button.dataset.toggleCategory);
      },

      /**
       * Select an asset for editing without changing runtime map selection.
       * @param {MapAsset|null} asset The layer to edit, or null to clear selection
       * @returns {void}
       */
      selectAsset(asset) {
        this.assetItemViews.forEach((item) => {
          const selected = item.model === asset;
          item.setSelected(selected);
          const group = item.el.closest(".expansion-panel");
          if (selected && group) this.setCategoryExpanded(group, true);
        });
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
        if (item) {
          const group = item.el.closest(".expansion-panel");
          if (group) this.setCategoryExpanded(group, true);
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
