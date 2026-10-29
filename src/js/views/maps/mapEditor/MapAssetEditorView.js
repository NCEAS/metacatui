"use strict";

define([
  "backbone",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapImageryEditorView",
], (Backbone, CesiumImagery, MapImageryEditorView) => {
  const BASE_CLASS = "map-asset-editor";
  const CLASS_NAMES = {
    BASE: BASE_CLASS,
    FIELD: `${BASE_CLASS}__field`,
  };
  const LABELS = {
    LABEL: "Label",
    DESCRIPTION: "Description",
  };
  const HELP_TEXT = {
    ADDITIONAL_SETTINGS: "Additional layer settings are not supported yet.",
  };

  /**
   * @class MapAssetEditorView
   * @classdesc Edits Label and Description and owns the imagery editor.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapAssetEditorView.png
   * @since 2.41.0
   */
  const MapAssetEditorView = Backbone.View.extend(
    /** @lends MapAssetEditorView.prototype */ {
      /**
       * The existing asset supplied by the caller.
       * @type {MapAsset}
       */
      model: null,

      /**
       * The imagery editor owned by this view.
       * @type {MapImageryEditorView|null}
       */
      typeEditorView: null,

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /** @inheritdoc */
      events() {
        return {
          'change [name="label"], [name="description"]': "updateModel",
        };
      },

      /**
       * Build the Label and Description controls.
       * @returns {string} Markup containing no model-supplied values
       */
      template() {
        const fieldClass = CLASS_NAMES.FIELD;
        return `
          <label class="${fieldClass}">${LABELS.LABEL}
            <input name="label" type="text" />
          </label>
          <label class="${fieldClass}">${LABELS.DESCRIPTION}
            <textarea name="description" rows="4"></textarea>
          </label>
        `;
      },

      /**
       * Render shared fields and the imagery editor when supported.
       * @returns {MapAssetEditorView} This view
       */
      render() {
        this.onClose();
        this.el.innerHTML = this.template();
        this.el.querySelector('[name="label"]').value = this.model.get("label");
        this.el.querySelector('[name="description"]').value =
          this.model.get("description");
        if (
          this.model instanceof CesiumImagery &&
          MapImageryEditorView.SUPPORTED_TYPES.includes(this.model.get("type"))
        ) {
          this.typeEditorView = new MapImageryEditorView({ model: this.model });
          this.el.append(this.typeEditorView.render().el);
        }
        const message = document.createElement("p");
        message.textContent = HELP_TEXT.ADDITIONAL_SETTINGS;
        this.el.append(message);
        return this;
      },

      /**
       * Focus and select the label for editing.
       * @returns {void}
       * @since 2.41.0
       */
      focusLabel() {
        const label = this.el.querySelector('[name="label"]');
        label.focus();
        label.select();
      },

      /**
       * Update the asset's Label or Description.
       * @param {Event} event The changed field
       */
      updateModel(event) {
        const { name, value } = event.target;
        this.model.set(name, value);
      },

      /**
       * Show source errors in the imagery editor, if present.
       * @param {string} [field] The source field to check
       */
      showValidation(field) {
        this.typeEditorView?.showValidation(field);
      },

      /** Remove the child editor before rendering or closing */
      onClose() {
        this.typeEditorView?.remove();
        this.typeEditorView = null;
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return MapAssetEditorView;
});
