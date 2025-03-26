"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/draw-tool-data-panel.html",
  "views/maps/MapView",
], (
  $, // jQuery assigned here
  _,
  Backbone,
  Template,
  MapView,
) => {
  /**
   * @class DrawToolDataPanelView
   * @classdesc DrawToolDataPanelView shows information about a map's selected data layers upon the user drawing a polygon on the map
   * @classcategory Views/Maps
   * @name DrawToolDataPanelView
   * @extends Backbone.View
   * @screenshot views/maps/LayersPanelView.png
   * @since 2.28.0
   * @constructs DrawToolDataPanelView
   */
  const DrawToolDataPanelView = Backbone.View.extend(
    /** @lends DrawToolDataPanelView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "DrawToolDataPanelView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "draw-tool-data-panel",

      /**
       * The primary HTML template for this view. The template must have two element,
       * one with the contentContainer class, and one with the linksContainer class.
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * @typedef {Object} DrawToolDataPanelViewOptions
       * @property {Map} The Map model that contains layers information.
       */
      initialize(options) {
        this.map = options.model;
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       * */
      render() {
        try {
          // Save a reference to this view
          var view = this;

          // Insert the template into the view
          this.$el.html(this.template({}));

          // Ensure the view's main element has the given class name
          this.el.classList.add(this.className);
        } catch (error) {
          console.log(
            "There was an error rendering a DrawToolPanelView" +
              ". Error details: " +
              error,
          );
        }
      },
    },
  );

  return DrawToolDataPanelView;
});
