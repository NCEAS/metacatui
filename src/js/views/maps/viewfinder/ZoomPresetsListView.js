"use strict";

define(["underscore", "backbone", "views/maps/viewfinder/ZoomPresetView"], (
  _,
  Backbone,
  ZoomPresetView,
) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder-zoom-presets";

  /**
   * @class ZoomPresetsListView
   * @classdesc Allow user to zoom to a preset location with certain data
   * layers enabled.
   * @classcategory Views/Maps/Viewfinder
   * @name ZoomPresetsListView
   * @augments Backbone.View
   * @screenshot views/maps/viewfinder/ZoomPresetsListView.png
   * @since 2.29.0
   * @constructs ZoomPresetsListView
   */
  const ZoomPresetsListView = Backbone.View.extend(
    /** @lends ZoomPresetsListView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ZoomPresetsListView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * @typedef {object} ZoomPresetsListViewOptions
       * @param root0
       * @param root0.selectZoomPreset
       * @param root0.openVisualization
       * @param root0.closeVisualization
       * @param root0.zoomPresets
       * @property {ZoomPresets} zoomPresets The collection of zoom presets
       * @property {Function} selectZoomPreset The callback function for
       * selecting a zoom preset (zoom + toggle layers).
       * @property {Function} [openVisualization] Called with (url, permissions)
       * to open the visualization overlay.
       * @property {Function} [closeVisualization] Called to close the
       * visualization overlay.
       */
      initialize({
        zoomPresets,
        selectZoomPreset,
        openVisualization,
        closeVisualization,
      }) {
        this.children = [];
        this.zoomPresets = zoomPresets;
        this.selectZoomPreset = selectZoomPreset;
        this.openVisualization =
          typeof openVisualization === "function"
            ? openVisualization
            : () => {};
        this.closeVisualization =
          typeof closeVisualization === "function"
            ? closeVisualization
            : () => {};
      },

      /**
       * Render the view by updating the HTML of the element.
       */
      render() {
        this.el.innerHTML = "";
        this.children = this.zoomPresets?.models?.map((preset) => {
          const view = new ZoomPresetView({
            preset,
            selectCallback: () => {
              this.selectZoomPreset(preset);
            },
            ctaCallback: (url, permissions) => {
              this.openVisualization(url, permissions);
            },
            closeVisualizationCallback: () => {
              this.closeVisualization();
            },
          });
          view.render();
          this.el.appendChild(view.el);
          return view;
        });
      },
    },
  );

  return ZoomPresetsListView;
});
