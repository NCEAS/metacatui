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
     * @since x.x.x
     * @constructs ZoomPresetsListView
     */
    var ZoomPresetsListView = Backbone.View.extend({
      /**
       * The type of View this is
       * @type {string}
       */
      type: 'ZoomPresetsListView',

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * @typedef {Object} ZoomPresetsListViewOptions
       * @property {ViewfinderModel} The model associated with the parent view.
       */
      initialize({ viewfinderModel }) {
        this.children = [];
        this.viewfinderModel = viewfinderModel;
      },

      /**
       * Render the view by updating the HTML of the element.
       */
      render() {
        this.children = this.viewfinderModel.get('zoomPresets').map(preset => {
          const view = new ZoomPresetView({
            selectCallback: () => {
              this.viewfinderModel.selectZoomPreset(preset);
              this.children.forEach(child => {
                child.resetActiveState();
              });
            },
            preset,
          });
          view.render();
          return view;
        });

        this.$el.html(this.children.map(view => view.el));
      },
    });

    return ZoomPresetsListView;
  });