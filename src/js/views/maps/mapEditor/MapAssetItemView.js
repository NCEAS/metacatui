"use strict";

define(["backbone", "views/maps/LayerItemView"], (Backbone, LayerItemView) => {
  const CLASS_NAMES = {
    BASE: LayerItemView.CLASS_NAMES.BASE,
    MOVE: "assets-editor__move",
    ICON: LayerItemView.CLASS_NAMES.ICON_FONT,
    MOVE_ICON: "icon-ellipsis-vertical",
    REMOVE: "assets-editor__remove",
    REMOVE_ICON: "icon-remove",
    SETTINGS: LayerItemView.CLASS_NAMES.SETTINGS,
    SETTINGS_TOGGLE: LayerItemView.CLASS_NAMES.SETTINGS_TOGGLE,
    REMOVING: "assets-editor__item--removing",
    LABEL: LayerItemView.CLASS_NAMES.LABEL,
    LABEL_TEXT: LayerItemView.CLASS_NAMES.LABEL_TEXT,
  };
  const MOVE_ASSET_ATTRIBUTE = "data-move-asset";
  const ASSET_ATTRIBUTE = "data-asset";
  const REMOVE_ASSET_ATTRIBUTE = "data-remove-asset";
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
   * @since 2.41.0
   */
  const MapAssetItemView = Backbone.View.extend(
    /** @lends MapAssetItemView.prototype */ {
      /** @inheritdoc */
      tagName: "li",

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /** @inheritdoc */
      events: {
        [`click [${MOVE_ASSET_ATTRIBUTE}]`]: "moveAsset",
        [`click [${ASSET_ATTRIBUTE}]`]: "selectAsset",
        [`click [${REMOVE_ASSET_ATTRIBUTE}]`]: "removeAsset",
        [`mouseenter [${REMOVE_ASSET_ATTRIBUTE}]`]: "previewRemoval",
        [`mouseleave [${REMOVE_ASSET_ATTRIBUTE}]`]: "previewRemoval",
        [`focusin [${REMOVE_ASSET_ATTRIBUTE}]`]: "previewRemoval",
        [`focusout [${REMOVE_ASSET_ATTRIBUTE}]`]: "previewRemoval",
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
          <button type="button" class="${CLASS_NAMES.LABEL}" ${ASSET_ATTRIBUTE}="${this.model.cid}"
            aria-pressed="false" aria-controls="${this.panelId}"><span class="${CLASS_NAMES.LABEL_TEXT}"></span></button>
          <button type="button" class="${CLASS_NAMES.REMOVE} ${CLASS_NAMES.SETTINGS}" ${REMOVE_ASSET_ATTRIBUTE}="${this.model.cid}">
            <i class="${CLASS_NAMES.ICON} ${CLASS_NAMES.REMOVE_ICON} ${CLASS_NAMES.SETTINGS_TOGGLE}" aria-hidden="true"></i>
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
        const labelText = this.el.querySelector(`.${CLASS_NAMES.LABEL_TEXT}`);
        labelText.textContent = label;
        labelText.title = label;
        this.el
          .querySelector(`[${MOVE_ASSET_ATTRIBUTE}]`)
          .setAttribute("aria-label", `${MESSAGES.MOVE} ${label}`);
        this.el
          .querySelector(`[${REMOVE_ASSET_ATTRIBUTE}]`)
          .setAttribute("aria-label", `${MESSAGES.REMOVE} ${label}`);
      },

      /**
       * Present selection owned by the workspace.
       * @param {boolean} selected Whether this asset is being edited
       */
      setSelected(selected) {
        this.el
          .querySelector(`[${ASSET_ATTRIBUTE}]`)
          .setAttribute("aria-pressed", String(selected));
      },

      /** Focus the layer selection button */
      focus() {
        this.el.querySelector(`[${ASSET_ATTRIBUTE}]`).focus();
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

  /**
   * CSS class names used by editor layer items.
   * @type {Object<string, string>}
   */
  MapAssetItemView.CLASS_NAMES = CLASS_NAMES;

  return MapAssetItemView;
});
