"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/layer-category-item.html",
  "models/maps/AssetCategory",
  "common/IconUtilities",
  // Sub-views
  "views/maps/LayerListView",
], function (
  $,
  _,
  Backbone,
  Template,
  AssetCategory,
  IconUtilities,
  // Sub-views
  LayerListView,
) {
  const BASE_CLASS = "layer-category-item";
  const CLASS_NAMES = {
    metadata: `${BASE_CLASS}__metadata`,
    icon: `${BASE_CLASS}__icon`,
    expanded: `${BASE_CLASS}__expanded`,
    collapsed: `${BASE_CLASS}__collapsed`,
    layers: `${BASE_CLASS}__layers`,
  };

  /**
   * @class LayerCategoryItemView
   * @classdesc One item in a Category List: shows some basic information about the
   * layer category, including label and icon. Also has a button that expands the
   * nested layers list.
   * @classcategory Views/Maps
   * @name LayerCategoryItemView
   * @extends Backbone.View
   * @screenshot views/maps/LayerCategoryItemView.png
   * @since 2.28.0
   * @constructs
   */
  const LayerCategoryItemView = Backbone.View.extend(
    /** @lends LayerCategoryItemView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerCategoryItemView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: BASE_CLASS,

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

      /** @inheritdoc */
      events() {
        return { [`click .${CLASS_NAMES.metadata}`]: "toggleExpanded" };
      },

      /**
       * Executed when a new LayerCategoryItemView is created
       * @param {Object} options - A literal object with options to pass to the view
       */
      initialize(options) {
        if (options?.model instanceof AssetCategory) {
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
        this.$el.html(
          this.template({
            classNames: CLASS_NAMES,
            label: this.model.get("label"),
          }),
        );

        // Insert the icon on the left
        this.insertIcon();

        this.layerListView = new LayerListView({
          collection: this.model.get("mapAssets"),
          isCategorized: true,
        });
        this.layerListView.render();
        this.$(`.${CLASS_NAMES.layers}`).append(this.layerListView.el);

        // Show the category as expanded or collapsed depending on the model
        // properties.
        this.updateLayerList();
        this.listenTo(this.model, "change:expanded", this.updateLayerList);

        return this;
      },

      /**
       * Inserts the icon before the label.
       */
      insertIcon() {
        const icon = this.model.get("icon");
        if (icon && typeof icon === "string" && IconUtilities.isSVG(icon)) {
          this.$(`.${CLASS_NAMES.icon}`).html(icon);
        }
      },

      /**
       * Sets the model's 'expanded' status attribute to true if it's false, and
       * to false if it's true. Executed when a user clicks on this CategoryItem in a
       * CategoryListView.
       */
      toggleExpanded() {
        this.model.set("expanded", !this.model.get("expanded"));
      },

      /**
       * Show or hide the layer list based on the category's expand status.
       */
      updateLayerList() {
        const expanded = this.$(`.${CLASS_NAMES.expanded}`);
        const collapsed = this.$(`.${CLASS_NAMES.collapsed}`);
        const layers = this.$(`.${CLASS_NAMES.layers}`);
        if (this.model.get("expanded")) {
          expanded.show();
          collapsed.hide();
          layers.addClass("open");
        } else {
          expanded.hide();
          collapsed.show();
          layers.removeClass("open");
        }
      },

      /**
       * Searches and only displays self if layers match the text.
       * @param {string} [text] - The search text from user input.
       * @returns {boolean} - True if a layer item matches the text
       */
      search(text) {
        const matched = this.layerListView.search(text);
        if (matched) {
          this.$el.show();
          this.model.set("expanded", text !== "");
        } else {
          this.$el.hide();
          this.model.set("expanded", false);
        }
        return matched;
      },
    },
  );

  return LayerCategoryItemView;
});
