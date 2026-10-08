"use strict";

define([
  "backbone",
  "sortable",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetItemView",
  "views/maps/mapEditor/MapAssetEditorView",
  "views/maps/mapEditor/MapAssetCategoryView",
], (
  Backbone,
  Sortable,
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
    MOVE_CONTROLS: "map-editor__move-controls",
    MOVE_STATUS: "map-editor__move-status",
    DROP_PLACEHOLDER: "map-editor__drop-placeholder",
  };
  const DRAG_GROUP_PREFIX = "map-editor";
  const ADD_LAYER_ATTRIBUTE = "data-add-layer";
  const MOVE_ASSET_ATTRIBUTE = "data-move-asset";
  const MOVE_ATTRIBUTES = {
    DIRECTION: "data-move-direction",
    CATEGORY_CONTROLS: "data-move-category-controls",
    DESTINATION: "data-move-destination",
    TO_CATEGORY: "data-move-to-category",
    CLOSE: "data-close-move",
  };
  const MOVE_CONTROLS_ID_SUFFIX = "move-controls";
  const MOVE_DESTINATION_ID_SUFFIX = "move-destination";
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
    UNTITLED_LAYER: "Untitled layer",
    MOVE: "Move",
    MOVE_UP: "Move up",
    MOVE_DOWN: "Move down",
    MOVE_TO_CATEGORY: "Move to category",
    CLOSE: "Close",
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
        [`click [${MOVE_ATTRIBUTES.DIRECTION}], [${MOVE_ATTRIBUTES.TO_CATEGORY}]`]:
          "moveFromControls",
        /** Close the controls and focus the grip */
        [`click [${MOVE_ATTRIBUTES.CLOSE}]`]() {
          this.closeMoveControls(true);
        },
        [`keydown .${CLASS_NAMES.MOVE_CONTROLS}, [${MOVE_ASSET_ATTRIBUTE}]`]:
          "handleMoveKeydown",
        [`focusout .${CLASS_NAMES.MOVE_CONTROLS}, [${MOVE_ASSET_ATTRIBUTE}]`]:
          "handleMoveFocusout",
      },

      /** Initialize editor selection, Move controls, and the child views */
      initialize() {
        this.selectedAsset = null;
        this.assetEditorView = null;
        this.assetItemViews = [];
        this.layerLists = [];
        this.moveContext = null;
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
          `<p class="${CLASS_NAMES.EMPTY}" tabindex="-1">${MESSAGES.NO_LAYERS}</p>
          <div id="${this.cid}-${MOVE_CONTROLS_ID_SUFFIX}" class="${CLASS_NAMES.MOVE_CONTROLS}" role="group" hidden>
            <button type="button" ${MOVE_ATTRIBUTES.DIRECTION}="-1">${MESSAGES.MOVE_UP}</button>
            <button type="button" ${MOVE_ATTRIBUTES.DIRECTION}="1">${MESSAGES.MOVE_DOWN}</button>
            <div ${MOVE_ATTRIBUTES.CATEGORY_CONTROLS}>
              <label for="${this.cid}-${MOVE_DESTINATION_ID_SUFFIX}">${MESSAGES.MOVE_TO_CATEGORY}</label>
              <select id="${this.cid}-${MOVE_DESTINATION_ID_SUFFIX}" ${MOVE_ATTRIBUTES.DESTINATION}></select>
              <button type="button" ${MOVE_ATTRIBUTES.TO_CATEGORY}>${MESSAGES.MOVE}</button>
            </div>
            <button type="button" ${MOVE_ATTRIBUTES.CLOSE}>${MESSAGES.CLOSE}</button>
          </div>
          <p class="${CLASS_NAMES.MOVE_STATUS}" role="status"></p>`,
        );
        this.moveControls = container.querySelector(
          `.${CLASS_NAMES.MOVE_CONTROLS}`,
        );
        this.moveStatus = container.querySelector(
          `.${CLASS_NAMES.MOVE_STATUS}`,
        );
        this.renderList();
        this.layerLists.forEach((entry) => {
          Object.assign(entry, {
            sortable: Sortable.create(entry.list, {
              group: `${DRAG_GROUP_PREFIX}-${this.cid}`,
              direction: "vertical",
              handle: `[${MOVE_ASSET_ATTRIBUTE}]`,
              ghostClass: CLASS_NAMES.DROP_PLACEHOLDER,
              onStart: () => this.closeMoveControls(),
              onEnd: (event) => {
                const item = this.assetItemViews.find(
                  (row) => row.el === event.item,
                );
                const target = this.layerLists.find(
                  ({ list }) => list === event.to,
                );
                // Sortable 1.10.2 can count its fallback ghost in the event index.
                const index = Array.from(target.list.children).indexOf(
                  event.item,
                );
                const changed = this.moveAsset(
                  item.model,
                  target.layers,
                  index,
                );
                if (!changed) item.focusMove();
              },
            }),
          });
        });
        return this;
      },

      /**
       * Create a stable layer list and a separate Add control.
       * @param {MapAssets} layers The collection shown in this list
       * @param {HTMLElement} host The container for the list and Add control
       * @param {MapAssetCategoryView} [categoryView] The category presentation
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
       * Create a row and listen for editing, movement, and removal requests.
       * @param {MapAsset} asset The layer represented by the row
       * @returns {MapAssetItemView} The rendered row
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
        this.listenTo(item, "move:asset", this.showMoveControls);
        return item.render();
      },

      /**
       * Sync rows while keeping their controls and the active form.
       */
      renderList() {
        const previousItems = this.assetItemViews;
        const assets = this.model.getAllLayers();
        previousItems.forEach((item) => {
          if (!assets.includes(item.model)) {
            if (this.moveContext?.asset === item.model)
              this.closeMoveControls();
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
       * Open or toggle Move controls for a layer without selecting it.
       * @param {MapAsset} asset The layer to move
       * @param {HTMLButtonElement} button The layer's grip
       */
      showMoveControls(asset, button) {
        if (this.moveContext?.button === button) {
          this.closeMoveControls(true);
          return;
        }
        this.closeMoveControls();
        this.moveContext = { asset, button };
        const source = this.layerLists.find(({ layers }) => layers.get(asset));
        const index = source.layers.indexOf(asset);
        const up = this.moveControls.querySelector(
          `[${MOVE_ATTRIBUTES.DIRECTION}="-1"]`,
        );
        const down = this.moveControls.querySelector(
          `[${MOVE_ATTRIBUTES.DIRECTION}="1"]`,
        );
        up.disabled = index === 0;
        down.disabled = index === source.layers.length - 1;
        const categoryControls = this.moveControls.querySelector(
          `[${MOVE_ATTRIBUTES.CATEGORY_CONTROLS}]`,
        );
        const select = this.moveControls.querySelector(
          `[${MOVE_ATTRIBUTES.DESTINATION}]`,
        );
        categoryControls.hidden = this.layerLists.length < 2;
        select.replaceChildren();
        if (!categoryControls.hidden) {
          this.layerLists.forEach((entry) => {
            if (entry !== source) {
              select.add(
                new Option(
                  entry.categoryView.model.get("label"),
                  entry.categoryView.model.cid,
                ),
              );
            }
          });
        }
        this.moveControls.setAttribute(
          "aria-label",
          `${MESSAGES.MOVE} ${asset.get("label") || MESSAGES.UNTITLED_LAYER}`,
        );
        button.parentElement.append(this.moveControls);
        button.setAttribute("aria-controls", this.moveControls.id);
        button.setAttribute("aria-expanded", "true");
        this.moveControls.hidden = false;
        if (!up.disabled) up.focus();
        else if (!down.disabled) down.focus();
        else if (!categoryControls.hidden) select.focus();
        else
          this.moveControls.querySelector(`[${MOVE_ATTRIBUTES.CLOSE}]`).focus();
      },

      /**
       * Hide Move controls and return them to the layers section.
       * @param {boolean} [restoreFocus] Whether to focus the old grip
       */
      closeMoveControls(restoreFocus = false) {
        if (!this.moveContext) return;
        const { button } = this.moveContext;
        this.moveContext = null;
        button.setAttribute("aria-expanded", "false");
        this.moveControls.hidden = true;
        this.el
          .querySelector(`.${CLASS_NAMES.LAYERS}`)
          .append(this.moveControls);
        if (restoreFocus) button.focus();
      },

      /**
       * Move the active layer up, down, or to the chosen category.
       * @param {Event} event The Move action's click
       */
      moveFromControls(event) {
        const { asset } = this.moveContext;
        const source = this.layerLists.find(({ layers }) =>
          layers.get(asset),
        ).layers;
        let target = source;
        let index;
        if (event.currentTarget.hasAttribute(MOVE_ATTRIBUTES.DIRECTION)) {
          index =
            source.indexOf(asset) +
            Number(event.currentTarget.getAttribute(MOVE_ATTRIBUTES.DIRECTION));
        } else {
          const cid = this.moveControls.querySelector(
            `[${MOVE_ATTRIBUTES.DESTINATION}]`,
          ).value;
          target = this.layerLists.find(
            ({ categoryView }) => categoryView.model.cid === cid,
          ).layers;
          index = target.length;
        }
        this.moveAsset(asset, target, index);
      },

      /**
       * Move a layer, show its destination, and announce its new position.
       * @param {MapAsset} asset The layer to move
       * @param {MapAssets} targetLayers The destination collection
       * @param {number} index The layer's new index in that collection
       * @returns {boolean} Whether the layer moved
       */
      moveAsset(asset, targetLayers, index) {
        if (!this.model.moveAsset(asset, targetLayers, index)) return false;
        this.closeMoveControls();
        const destination = this.layerLists.find(
          ({ layers }) => layers === targetLayers,
        );
        destination.categoryView?.setExpanded(true);
        this.assetItemViews.find((item) => item.model === asset).focusMove();
        const label = asset.get("label") || MESSAGES.UNTITLED_LAYER;
        const category = destination.categoryView;
        const location = category ? ` to ${category.model.get("label")}` : "";
        this.moveStatus.textContent = `${label} moved${location}, position ${index + 1} of ${targetLayers.length}.`;
        return true;
      },

      /**
       * Close Move controls with Escape and focus the grip.
       * @param {KeyboardEvent} event The key pressed in the controls or grip
       */
      handleMoveKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          this.closeMoveControls(true);
        }
      },

      /**
       * Close Move controls when focus leaves them and their grip.
       * @param {FocusEvent} event The focus change
       */
      handleMoveFocusout(event) {
        if (!this.moveContext) return;
        if (
          event.relatedTarget !== this.moveContext.button &&
          !this.moveControls.contains(event.relatedTarget)
        ) {
          this.closeMoveControls();
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
       * Close Move controls and release drag handlers, views, and subscriptions.
       */
      onClose() {
        this.closeMoveControls();
        this.layerLists.forEach(({ sortable }) => sortable.destroy());
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
