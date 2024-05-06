'use strict';

define(
  [
    'underscore',
    'backbone',
    'views/maps/viewfinder/ZoomPresetView',
  ],
  (_, Backbone, ZoomPresetView) => {
    // The base classname to use for this View's template elements.
    const BASE_CLASS = 'viewfinder-zoom-presets';

    /**
     * @class ZoomPresetsListView
     * @classdesc Allow user to zoom to a preset location with certain data
     * layers enabled.
     * @classcategory Views/Maps/Viewfinder
     * @name ZoomPresetsListView
     * @extends Backbone.View
     * @screenshot views/maps/viewfinder/ZoomPresetsListView.png
     * @since 2.29.0
     * @constructs ZoomPresetsListView
     */
    var ZoomPresetsListView = Backbone.View.extend(
    /** @lends ZoomPresetsListView.prototype */ {
        /**
         * The type of View this is
         * @type {string}
         */
        type: 'ZoomPresetsListView',

        /** @inheritdoc */
        className: BASE_CLASS,

        /**
         * @typedef {Object} ZoomPresetsListViewOptions
         * @property {ZoomPreset[]} zoomPresets The zoom presets to render.
         * @property {Function} selectZoomPreset The callback function for 
         * selecting a zoom preset.
         */
        initialize({ zoomPresets, selectZoomPreset }) {
          this.children = [];
          this.zoomPresets = zoomPresets;
          this.selectZoomPreset = selectZoomPreset;
        },

        /**
         * Render the view by updating the HTML of the element.
         */
        render() {
          this.children = this.zoomPresets.map(preset => {
            const view = new ZoomPresetView({
              selectCallback: () => {
                this.selectZoomPreset(preset);
                this.children.forEach(child => {
                  child.resetActiveState();
                });
              },
              preset,
            });
            view.render();

            this.el.appendChild(view.el);

            return view;
          });
        },
      });

    return ZoomPresetsListView;
  });