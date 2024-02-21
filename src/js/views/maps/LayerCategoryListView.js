
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'text!templates/maps/layer-category-list.html',
    'collections/maps/AssetCategories',
    // Sub-views
    'views/maps/LayerCategoryItemView',
  ],
  function (
    $,
    _,
    Backbone,
    Template,
    AssetCategories,
    // Sub-views
    LayerCategoryItemView,
  ) {

    /**
    * @class LayerCategoryListView
    * @classdesc A LayerCategoryListView shows a collection of AssetCategories, each with
    * a MapAssets collection nested under it.
    * @classcategory Views/Maps
    * @name LayerCategoryListView
    * @screenshot views/maps/LayerCategoryListView.png
    * @extends Backbone.View
    //  * @since x.x.x
    * @constructs
    */
    const LayerCategoryListView = Backbone.View.extend(
      /** @lends LayerCategoryListView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerCategoryListView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-category-list',

        /**
        * The collection of layers to display in the list
        * @type {AssetCategories}
        */
        collection: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
        * Executed when a new LayerCategoryListView is created
        * @param {Object} options - A literal object with options to pass to the view
        */
        initialize(options) {
          if (options.collection instanceof AssetCategories) {
            this.collection = options.collection.clone();
          }
        },

        /**
        * Renders this view
        * @return {LayerCategoryListView} Returns the rendered view element
        */
        render() {
          // Insert the template into the view
          this.$el.html(this.template({}));

          // Ensure the view's main element has the given class name
          this.el.classList.add(this.className);

          if (!this.collection) {
            return
          }

          // Render a layer item for each layer in the collection
          this.collection.forEach(categoryModel => {
            const layerCategoryItemView = new LayerCategoryItemView({model: categoryModel});
            layerCategoryItemView.render();
            this.el.appendChild(layerCategoryItemView.el);
          })

          return this;
        },


      }
    );

    return LayerCategoryListView;

  }
);
