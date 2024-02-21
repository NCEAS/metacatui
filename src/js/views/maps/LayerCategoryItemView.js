
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'text!templates/maps/layer-category-item.html',
    'models/maps/AssetCategory',
    'common/IconUtilities',
    // Sub-views
    'views/maps/LayerListView',
  ],
  function (
    $,
    _,
    Backbone,
    Template,
    AssetCategory,
    IconUtilities,
    // Sub-views
    LayerListView,
  ) {

    /**
    * @class LayerCategoryItemView
    * @classdesc One item in a Category List: shows some basic information about the
    * layer category, including label and icon. Also has a button that expands the
    * nested layers list.
    * @classcategory Views/Maps
    * @name LayerCategoryItemView
    * @extends Backbone.View
    * @screenshot views/maps/LayerCategoryItemView.png
    // * @since x.x.x
    * @constructs
    */
    const LayerCategoryItemView = Backbone.View.extend(
      /** @lends LayerCategoryItemView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerCategoryItemView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-category-item',

        /**
        * The model that this view uses
        * @type {AssetCategory}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        classNames: {
          baseClass: 'layer-category-item',
          metadata: 'layer-category-item__metadata',
          icon: 'layer-category-item__icon',
          expanded: 'layer-category-item__expanded',
          collapsed: 'layer-category-item__collapsed',
          layers: 'layer-category-item__layers',
        },

        /**
        * A function that gives the events this view will listen to and the associated
        * function to call.
        * @returns {Object} Returns an object with events in the format 'event selector':
        * 'function'
        */
        events() {
          return {[`click .${this.classNames.metadata}`]: 'toggleExpanded'};
        },

        /**
        * Executed when a new LayerCategoryItemView is created
        * @param {Object} options - A literal object with options to pass to the view
        */
        initialize(options) {
          if (options.model instanceof AssetCategory) {
            this.model = options.model;
          }
        },

        /**
        * Renders this view
        * @return {LayerCategoryItemView} Returns the rendered view element
        */
        render() {
          if (!this.model) {
            return;
          }

          // Insert the template into the view
          this.$el.html(this.template({
            classNames: this.classNames,
            label: this.model.get('label'),
          }));

          // Insert the icon on the left
          this.insertIcon();

          const layerList = new LayerListView({ collection: this.model.get("mapAssets") });
          layerList.render();
          this.$(`.${this.classNames.layers}`).append(layerList.el);

          // Show the category as expanded or collapsed depending on the model
          // properties.
          this.updateLayerList();

          return this;
        },

        /**
         * Inserts the icon before the label.
         */
        insertIcon() {
          const icon = this.model.get('icon');
          if (icon && typeof icon === 'string' && IconUtilities.isSVG(icon)) {
            this.$(`.${this.classNames.icon}`).html(icon);
          }
        },

        /**
         * Sets the model's 'expanded' status attribute to true if it's false, and
         * to false if it's true. Executed when a user clicks on this CategoryItem in a
         * CategoryListView.
         */
        toggleExpanded() {
          this.model.set('expanded', !this.model.get('expanded'));
          this.updateLayerList();
        },

        /**
         * Show or hide the layer list based on the category's expand status.
         */
        updateLayerList() {
          const expanded = this.$(`.${this.classNames.expanded}`);
          const collapsed = this.$(`.${this.classNames.collapsed}`);
          const layers = this.$(`.${this.classNames.layers}`);
          if (this.model.get('expanded')) {
            expanded.show();
            collapsed.hide();
            layers.show();
          } else {
            expanded.hide();
            collapsed.show();
            layers.hide();
          }
        },
      }
    );

    return LayerCategoryItemView;
  }
);
