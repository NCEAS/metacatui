"use strict";

define([
  "backbone",
  "text!templates/maps/layers-panel.html",
  "views/maps/LayerCategoryListView",
  "views/maps/LayerListView",
], (
  Backbone,
  Template,
  LayerCategoryListView,
  LayerListView,
) => {
  /**
   * @class LayersPanelView
   * @classdesc LayersPanelView shows information about a map's layers and supports
   * searching. This view is used as a toolbar section.
   * @classcategory Views/Maps
   * @name LayersPanelView
   * @extends Backbone.View
   // TODO: yvonne
   * @screenshot views/maps/LayersPanelView.png
   * @since x.x.x
   * @constructs LayersPanelView
   */
  const LayersPanelView = Backbone.View.extend({
    /**
     * The type of View this is
     * @type {string}
     */
    type: "LayersPanelView",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "layers-panel",

    /**
     * The HTML classes to use for this view's HTML elements.
     * @type {Object<string,string>}
     */
    classNames: {
      layers: "layers-panel__layers",
    },

    /** 
     * Values meant to be used by the rendered HTML template.
     */
    templateVars: {
      classNames: {},
    },

    /**
     * @typedef {Object} LayersPanelViewOptions
     * @property {Map} The Map model that contains layers information.
     */
    initialize(options) {
      this.map = options.model;
      this.templateVars.classNames = this.classNames;
    },

    /**
     * Render the view by updating the HTML of the element.
     * The new HTML is computed from an HTML template that
     * is passed an object with relevant view state.
     * */
    render() {
      this.el.innerHTML = _.template(Template)(this.templateVars);

      if (this.map.get('layerCategories')?.length > 0) {
        this.layersView = new LayerCategoryListView({ collection: this.map.get("layerCategories") });
      } else {
        this.layersView = new LayerListView({ collection: this.map.get("layers") });
      }
      this.layersView.render();
      this.$(`.${this.classNames.layers}`).append(this.layersView.el);
    },

  });

  return LayersPanelView;
});
