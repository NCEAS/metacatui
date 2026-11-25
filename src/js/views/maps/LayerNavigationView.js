"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "text!templates/maps/layer-navigation.html",
], ($, _, Backbone, MapAsset, Template) => {
  const CLASS_NAMES = {
    extentButton: "layer-navigation__button--extent",
  };

  /**
   * @class LayerNavigationView
   * @classdesc A panel with buttons that control navigation to points of
   * interest in a Layer or other Map Asset, including a button that zooms to
   * the entire extent of the asset. This view may update the opacity and
   * visibility of a MapAsset.
   * @classcategory Views/Maps
   * @name LayerNavigationView
   * @augments Backbone.View
   * @screenshot views/maps/LayerNavigationView.png
   * @since 2.18.0
   * @constructs
   */
  const LayerNavigationView = Backbone.View.extend(
    /** @lends LayerNavigationView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerNavigationView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "layer-navigation",

      /**
       * The model that this view uses
       * @type {MapAsset|null}
       */
      model: null,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * CSS classes assigned to the HTML elements that make up this view
       * @type {object}
       * @property {string} extentButton The button that should zoom to the full
       * extent of the asset/layer when clicked
       */
      classes: CLASS_NAMES,

      /** @inheritdoc */
      events() {
        return { [`click .${this.classes.extentButton}`]: "flyToExtent" };
      },

      /**
       * Executed when a new LayerNavigationView is created
       * @param {object} [options] A literal object with options to pass to the
       * view
       */
      initialize(options) {
        if (typeof options === "object") {
          Object.assign(this, options);
        }
      },

      /** @inheritdoc */
      render() {
        // Insert the template into the view
        this.$el.html(this.template({}));

        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        return this;
      },

      /** Show the layer and zoom to its full extent */
      flyToExtent() {
        if (!this.model) return;
        this.model.show();
        this.model.zoomTo(this.model);
      },
    },
  );

  return LayerNavigationView;
});
