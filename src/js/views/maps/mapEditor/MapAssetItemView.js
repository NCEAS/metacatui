"use strict";

define(["backbone"], (Backbone) => {
  const CLASS_NAMES = {
    MOVE: "map-editor__move",
    ICON: "icon",
    MOVE_ICON: "icon-ellipsis-vertical",
    REMOVE: "map-editor__remove",
    REMOVING: "map-editor__item--removing",
  };
  const MOVE_ASSET_ATTRIBUTE = "data-move-asset";
  const MESSAGES = {
    UNTITLED_LAYER: "Untitled layer",
    MOVE: "Move",
    REMOVE: "Remove",
  };

  /**
   * @class MapAssetItemView
   * @classdesc Shows one layer and requests editing, movement, or removal.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapAssetItemView.png
   * @since 0.0.0
   */
  return Backbone.View.extend(
    /** @lends MapAssetItemView.prototype */ {
      /** @inheritdoc */
      tagName: "li",

      /** @inheritdoc */
      className: "list-item",

      /** @inheritdoc */
      events: {
        [`click [${MOVE_ASSET_ATTRIBUTE}]`]: "moveAsset",
        "click [data-asset]": "selectAsset",
        "click [data-remove-asset]": "removeAsset",
        "mouseenter [data-remove-asset]": "previewRemoval",
        "mouseleave [data-remove-asset]": "previewRemoval",
        "focusin [data-remove-asset]": "previewRemoval",
        "focusout [data-remove-asset]": "previewRemoval",
      },

      /**
       * Store the settings panel ID and listen for layer label changes.
       * @param {object} options The view options
       * @param {MapAsset} options.model The layer represented by this row
       * @param {string} options.panelId The workspace settings panel ID
       */
      initialize(options) {
        this.panelId = options.panelId;
        this.listenTo(this.model, "change:label", this.updateLabel);
      },

      /**
       * Create the layer's Move, selection, and Remove buttons.
       * @returns {string} The HTML string for the layer item
       */
      template() {
        return `
          <button type="button" class="${CLASS_NAMES.MOVE}" ${MOVE_ASSET_ATTRIBUTE}="${this.model.cid}" aria-expanded="false">
            <i class="${CLASS_NAMES.ICON} ${CLASS_NAMES.MOVE_ICON}" aria-hidden="true"></i>
            <i class="${CLASS_NAMES.ICON} ${CLASS_NAMES.MOVE_ICON}" aria-hidden="true"></i>
          </button>
          <button type="button" class="list-item__label" data-asset="${this.model.cid}"
            aria-pressed="false" aria-controls="${this.panelId}"></button>
          <button type="button" class="${CLASS_NAMES.REMOVE}" data-remove-asset="${this.model.cid}">
            <i class="icon icon-remove" aria-hidden="true"></i>
          </button>
        `;
      },

      /**
       * Render controls without interpolating model-supplied text.
       * @returns {MapAssetItemView} This view
       */
      render() {
        this.el.innerHTML = this.template();
        this.updateLabel();
        return this;
      },

      /** Update the label and the Move and Remove buttons' accessible names */
      updateLabel() {
        const label = this.model.get("label") || MESSAGES.UNTITLED_LAYER;
        this.el.querySelector("[data-asset]").textContent = label;
        this.el
          .querySelector(`[${MOVE_ASSET_ATTRIBUTE}]`)
          .setAttribute("aria-label", `${MESSAGES.MOVE} ${label}`);
        this.el
          .querySelector("[data-remove-asset]")
          .setAttribute("aria-label", `${MESSAGES.REMOVE} ${label}`);
      },

      /**
       * Present selection owned by the workspace.
       * @param {boolean} selected Whether this asset is being edited
       */
      setSelected(selected) {
        this.el
          .querySelector("[data-asset]")
          .setAttribute("aria-pressed", String(selected));
      },

      /** Focus the layer selection button */
      focus() {
        this.el.querySelector("[data-asset]").focus();
      },

      /** Focus the layer's Move button */
      focusMove() {
        this.el.querySelector(`[${MOVE_ASSET_ATTRIBUTE}]`).focus();
      },

      /**
       * Request movement without selecting the layer.
       * @param {Event} event The Move button click
       */
      moveAsset(event) {
        this.trigger("move:asset", this.model, event.currentTarget);
      },

      /**
       * Request editing, carrying activation information for keyboard focus.
       * @param {Event} event The selection button click
       */
      selectAsset(event) {
        this.trigger("select:asset", this.model, event);
      },

      /** Request removal without mutating the asset */
      removeAsset() {
        this.trigger("remove:asset", this.model);
      },

      /**
       * Preview the layer being removed while its control is hovered or focused.
       * @param {Event} event The pointer or focus change
       */
      previewRemoval(event) {
        const preview =
          event.type === "mouseenter" ||
          event.type === "focusin" ||
          event.currentTarget.matches(":hover, :focus");
        this.el.classList.toggle(CLASS_NAMES.REMOVING, preview);
      },
    },
  );
});
