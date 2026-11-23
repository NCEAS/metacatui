"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "showdownXssFilter",
  "text!templates/maps/layer-info.html",
], ($, _, Backbone, MapAsset, sanitizeHTML, Template) => {
  /**
   * @class LayerInfoView
   * @classdesc A view that shows some of the basic info from a MapAsset model,
   * like the description, attribution, and link to more information.
   * @classcategory Views/Maps
   * @name LayerInfoView
   * @augments Backbone.View
   * @screenshot views/maps/LayerInfoView.png
   * @since 2.18.0
   * @constructs
   */
  const LayerInfoView = Backbone.View.extend(
    /** @lends LayerInfoView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerInfoView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "layer-info",

      /**
       * The model that this view uses
       * @type {MapAsset|undefined|null}
       */
      model: undefined,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {object}
       */
      events: {},

      /**
       * Executed when a new LayerInfoView is created
       * @param {object} [options] A literal object with options to pass to the
       * view
       */
      initialize(options) {
        if (typeof options === "object") {
          Object.assign(this, options);
        }
      },

      /**
       * Renders this view
       * @returns {LayerInfoView} This view
       */
      render() {
        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        // Insert the template into the view
        const templateOptions = this.model ? this.model.toJSON() : {};
        templateOptions.description = sanitizeHTML(templateOptions.description);
        this.$el.html(this.template(templateOptions));

        return this;
      },
    },
  );

  return LayerInfoView;
});
