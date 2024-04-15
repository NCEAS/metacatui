"use strict";

define([
  "backbone",
  "text!templates/maps/layers-panel.html",
  "views/maps/LayerCategoryListView",
  "views/maps/LayerListView",
  "views/maps/SearchInputView",
], (
  Backbone,
  Template,
  LayerCategoryListView,
  LayerListView,
  SearchInputView,
) => {
  /**
   * @class LayersPanelView
   * @classdesc LayersPanelView shows information about a map's layers and supports
   * searching. This view is used as a toolbar section.
   * @classcategory Views/Maps
   * @name LayersPanelView
   * @extends Backbone.View
   * @screenshot views/maps/LayersPanelView.png
   * @since 2.28.0
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
      search: "layers-panel__search",
      layers: "layers-panel__layers",
    },

    /**
     * @typedef {Object} LayersPanelViewOptions
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
      this.el.innerHTML = _.template(Template)({ classNames: this.classNames });

      if (this.map.get('layerCategories')?.length > 0) {
        this.layersView = new LayerCategoryListView({ collection: this.map.get("layerCategories") });
      } else {
        this.layersView = new LayerListView({
          collection: this.map.get("layers"),
          isCategorized: false,
        });
      }
      this.layersView.render();
      this.$(`.${this.classNames.layers}`).append(this.layersView.el);

      this.searchInput = new SearchInputView({
        placeholder: "Search all data layers",
        search: text => this.search(text),
        noMatchCallback: () => this.layersView.search(""),
      });
      this.searchInput.render();
      this.$(`.${this.classNames.search}`).append(this.searchInput.el);
    },

    /**
     * Search function for the SearchInputView.
     * @param {string} [text] - The search text from user input.
     * @returns {boolean} - True if there is a layer match.
     */
    search(text) {
      this.dismissLayerDetails();
      const matched = this.layersView.search(text);
      if (!matched) {
        this.searchInput.setError("No layers match your search");
      }
      return matched;
    },

    dismissLayerDetails() {
      this.map.getLayerGroups().forEach(mapAssets => {
        mapAssets.forEach(layerModel => {
          layerModel.set("selected", false);
        });
      });
    },
  });

  return LayersPanelView;
});
