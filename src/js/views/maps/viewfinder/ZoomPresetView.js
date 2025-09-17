"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/viewfinder/viewfinder-zoom-preset.html",
], (_, Backbone, Template) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder-zoom-preset";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    active: `${BASE_CLASS}--active`,
    description: `${BASE_CLASS}__description`,
    layer: `${BASE_CLASS}__layer`,
    layerContent: `${BASE_CLASS}__layer-content`,
    layers: `${BASE_CLASS}__layers`,
    preset: `${BASE_CLASS}__preset`,
    title: `${BASE_CLASS}__title`,
    image: `${BASE_CLASS}__image`,
  };
  // A function that does nothing. Can be safely called as a default callback.
  const noop = () => {};

  /**
   * @class ZoomPresetView
   * @classdesc Shows the title, description, and associated layers of a
   * configured location within a MapView. Users may click on a preset
   * to zoom to that location.
   * @classcategory Views/Maps/Viewfinder
   * @name ZoomPresetView
   * @augments Backbone.View
   * @screenshot views/maps/viewfinder/ZoomPresetView.png
   * @since 2.29.0
   * @constructs ZoomPresetView
   */
  const ZoomPresetView = Backbone.View.extend(
    /** @lends ZoomPresetView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ZoomPresetView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The events this view will listen to and the associated function to call.
       * @type {object}
       */
      events() {
        return {
          [`click .${CLASS_NAMES.preset}`]: "select",
        };
      },

      resetActiveState() {
        this.el.classList.remove(CLASS_NAMES.active);
      },

      /**
       * Add the active class and call the select callback function set on
       * this view by the parent ZoomPresetsListView.
       */
      select() {
        this.selectCallback();
        this.el.classList.add(CLASS_NAMES.active);
      },

      /** Values meant to be used by the rendered HTML template. */
      templateVars: {
        classNames: CLASS_NAMES,
        preset: {},
      },

      /**
       * Initialize the view with the given options.
       * @param {object} param0 - The view options.
       * @param {ZoomPresetModel} param0.preset - The metadata associated with this zoom
       * @param {Function} param0.selectCallback to be called when this preset is
       * selected.
       */
      initialize({ preset, selectCallback }) {
        this.selectCallback =
          typeof selectCallback === "function" ? selectCallback : noop;
        this.preset = preset;
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       */
      render() {
        this.templateVars.preset = this.preset.toJSON();
        this.el.innerHTML = _.template(Template)(this.templateVars);
      },
    },
  );

  return ZoomPresetView;
});
