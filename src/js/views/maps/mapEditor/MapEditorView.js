"use strict";

define(["backbone", "models/maps/Map"], (Backbone, Map) => {
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
       * The HTML classes to use for this view's element.
       * @type {string}
       */
      className: "map-editor",

      /**
       * The HTML attributes to set on this view's element.
       * @type {object}
       */
      attributes: {
        "data-category": "map",
      },

      /**
       * Create the HTML for this view.
       * @param {object} variables The variables to use in the template.
       * @returns {string} The HTML for this view.
       */
      template(variables) {
        const { layerNames } = variables;
        const layerItems = layerNames
          .map((name) => `<li>${name}</li>`)
          .join("");
        return `<div class="map-editor">
          <h3>Map Editor</h3>
          <p>Layers in this map:</p>
          <ul>${layerItems}</ul>
        </div>`;
      },

      /** @inheritdoc */
      initialize(options = {}) {
        this.model = options.model || new Map();
      },

      /**
       * Displays the map configuration as JSON.
       * @returns {MapEditorView} This view
       */
      render() {
        const layers = this.model.getAllLayers();
        const layerNames = layers.map((layer) => layer.get("label"));
        this.el.innerHTML = this.template({ layerNames });
        return this;
      },

      /**
       * Cleans up the view and stops listening to events.
       */
      onClose() {
        this.stopListening();
      },
    },
  );

  return MapEditorView;
});
