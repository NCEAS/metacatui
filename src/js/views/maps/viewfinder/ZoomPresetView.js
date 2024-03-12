'use strict';

define(
  [
    'underscore',
    'backbone',
    'text!templates/maps/viewfinder/viewfinder-zoom-preset.html',
  ],
  (_, Backbone, Template) => {
    // The base classname to use for this View's template elements.
    const BASE_CLASS = 'viewfinder-zoom-preset';
    //The HTML classes to use for this view's HTML elements.
    const CLASS_NAMES = {
      active: `${BASE_CLASS}--active`,
      description: `${BASE_CLASS}__description`,
      layer: `${BASE_CLASS}__layer`,
      layerContent: `${BASE_CLASS}__layer-content`,
      layers: `${BASE_CLASS}__layers`,
      preset: `${BASE_CLASS}__preset`,
      title: `${BASE_CLASS}__title`,
    };

    /**
     * @class ZoomPresetView
     * @classdesc Allow user to zoom to a preset location with certain data
     * layers enabled.
     * @classcategory Views/Maps/Viewfinder
     * @name ZoomPresetView
     * @extends Backbone.View
     * @screenshot views/maps/viewfinder/ZoomPresetView.png
     * @since x.x.x
     * @constructs ZoomPresetView
     */
    var ZoomPresetView = Backbone.View.extend(
    /** @lends ZoomPresetView.prototype */ {
        /**
         * The type of View this is
         * @type {string}
         */
        type: 'ZoomPresetView',

        /** @inheritdoc */
        className: BASE_CLASS,

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events() {
          return {
            [`click .${CLASS_NAMES.preset}`]: 'select',
          };
        },

        resetActiveState() {
          this.el.classList.remove(CLASS_NAMES.active);
        },

        select(event) {
          this.selectCallback();

          this.el.classList.add(CLASS_NAMES.active);
        },

        /** Values meant to be used by the rendered HTML template. */
        templateVars: {
          classNames: CLASS_NAMES,
          preset: {},
        },

        /**
         * @typedef {Object} ZoomPresetViewOptions
         * @property {ZoomPresetModel} The metadata associated with this zoom
         * preset.
         * @property {Function} selectCallback to be called when this preset is
         * selected.
         */
        initialize({ preset, selectCallback }) {
          this.selectCallback = selectCallback;
          this.templateVars.preset = {
            title: preset.get('title'),
            description: preset.get('description'),
            enabledLayers: preset.get('enabledLayers'),
          };
        },

        /**
         * Render the view by updating the HTML of the element.
         * The new HTML is computed from an HTML template that
         * is passed an object with relevant view state.
         * */
        render() {
          this.el.innerHTML = _.template(Template)(this.templateVars);
        },
      });

    return ZoomPresetView;
  });