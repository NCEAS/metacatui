"use strict";

define(["backbone"], (Backbone) => {
  const CLASS_NAMES = {
    LAYER: "map-editor__layer",
    REMOVE: "map-editor__remove",
    REMOVING: "map-editor__item--removing",
  };

  /**
   * @class MapAssetItemView
   * @classdesc Displays one layer and requests selection or removal.
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
      events: {
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
       * @returns {void}
       */
      initialize(options) {
        this.panelId = options.panelId;
        this.listenTo(this.model, "change:label", this.updateLabel);
      },

      /**
       * Create the layer selection and removal buttons.
       * @returns {string} The HTML string for the layer item
       */
      template() {
        return `
          <button type="button" class="${CLASS_NAMES.LAYER}" data-asset="${this.model.cid}"
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

      /**
       * Update the visible label and removal accessible name.
       * @returns {void}
       */
      updateLabel() {
        const label = this.model.get("label") || "Untitled layer";
        this.el.querySelector("[data-asset]").textContent = label;
        this.el
          .querySelector("[data-remove-asset]")
          .setAttribute("aria-label", `Remove ${label}`);
      },

      /**
       * Present selection owned by the workspace.
       * @param {boolean} selected Whether this asset is being edited
       * @returns {void}
       */
      setSelected(selected) {
        this.el
          .querySelector("[data-asset]")
          .setAttribute("aria-pressed", String(selected));
      },

      /**
       * Focus the layer selection button.
       * @returns {void}
       */
      focus() {
        this.el.querySelector("[data-asset]").focus();
      },

      /**
       * Request editing, carrying activation information for keyboard focus.
       * @param {Event} event The selection button click
       * @returns {void}
       */
      selectAsset(event) {
        this.trigger("select:asset", this.model, event);
      },

      /**
       * Request removal without mutating the asset.
       * @returns {void}
       */
      removeAsset() {
        this.trigger("remove:asset", this.model);
      },

      /**
       * Preview the layer being removed while its control is hovered or focused.
       * @param {Event} event The pointer or focus change
       * @returns {void}
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
