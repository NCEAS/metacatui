"use strict";

define([
  "backbone",
  "models/maps/Map",
  "views/maps/mapEditor/MapAssetsEditorView",
  `text!${MetacatUI.root}/css/map-view.css`,
], (Backbone, Map, MapAssetsEditorView, MapCSS) => {
  const CLASS_NAMES = {
    BASE: "map-editor",
  };

  /**
   * @class MapEditorView
   * @classdesc Composes editing sections for a map configuration.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapEditorView.png
   * @since 0.0.0
   */
  const MapEditorView = Backbone.View.extend(
    /** @lends MapEditorView.prototype */ {
      /**
       * The map configuration model shared by editing sections.
       * @type {Map}
       */
      model: null,

      /**
       * The layers workspace owned by this view.
       * @type {MapAssetsEditorView|null}
       */
      assetsEditorView: null,

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /** @inheritdoc */
      attributes: {
        "data-category": "map",
      },

      /** @inheritdoc */
      initialize(options = {}) {
        this.model = options.model || new Map();
        MetacatUI.appModel.addCSS(MapCSS, "mapView");
      },

      /**
       * Render the assets workspace.
       * @returns {MapEditorView} This view
       */
      render() {
        this.onClose();
        this.el.classList.add(CLASS_NAMES.BASE);
        this.assetsEditorView = new MapAssetsEditorView({ model: this.model });
        this.el.append(this.assetsEditorView.render().el);
        return this;
      },

      /** Delegate portal validation feedback to the assets workspace */
      showValidation() {
        this.assetsEditorView.showValidation();
      },

      /** Remove the workspace before replacing the shell or closing */
      onClose() {
        this.assetsEditorView?.remove();
        this.assetsEditorView = null;
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
