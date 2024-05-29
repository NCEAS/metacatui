"use strict";

define([
  "backbone",
  "models/maps/Map",
  "collections/maps/MapAssets",
  "common/IconUtilities",
], function (Backbone, MapModel, MapAssets, IconUtilities) {
  /**
   * @classdesc A AssetCategory Model contains metadata about the category, like a label and an icon.
   * @classcategory Models/Maps
   * @class AssetCategory
   * @name AssetCategory
   * @extends Backbone.Model
   * @since 2.28.0
   * @constructor
   */
  const AssetCategory = Backbone.Model.extend(
    /** @lends AssetCategory.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "AssetCategory",

      /**
       * Default attributes for AssetCategory models
       * @name AssetCategory#defaults
       * @type {Object}
       * @property {string} label A user friendly name for this category, to be displayed
       * in a map.
       * @property {string} icon
       * A PID for an SVG saved as a dataObject, or an SVG string. The SVG will be used
       * as an icon that will be displayed next to the category label. It should be an
       * SVG file that has no fills, borders, or styles set on it (since the icon will
       * be shaded dynamically by the maps CSS using a fill attribute). It must use a
       * viewbox property rather than a height and width.
       * @property {Boolean} [expanded = false] Set to true when this category has been
       * expanded by the user.
       * @property {MapAssets} mapAssets The data to render in the map.
       */
      defaults() {
        return {
          label: "",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="m3.2 7.3 8.6 4.6a.5.5 0 0 0 .4 0l8.6-4.6a.4.4 0 0 0 0-.8L12.1 3a.5.5 0 0 0-.4 0L3.3 6.5a.4.4 0 0 0 0 .8Z"/><path d="M20.7 10.7 19 9.9l-6.7 3.6a.5.5 0 0 1-.4 0L5 9.9l-1.8.8a.5.5 0 0 0 0 .8l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.8Z"/><path d="m20.7 15.1-1.5-.7-7 3.8a.5.5 0 0 1-.4 0l-7-3.8-1.5.7a.5.5 0 0 0 0 .9l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.9Z"/></svg>',
          expanded: false,
        };
      },

      /**
       * The source of a specific category to show in the ToolBarView, as well as
       * display properties of the asset.
       * @typedef {Object} AssetCategoryConfig
       * @name MapConfig#AssetCategoryConfig
       * @property {string} label - A user friendly name for this category, to be
       * displayed in a map.
       * @property {string} icon - A PID for an SVG saved as a dataObject, or an SVG
       * string. The SVG will be used as an icon that will be displayed next to the
       * category label. It should be an SVG file that has no fills, borders, or styles
       * set on it (since the icon will be shaded dynamically by the maps CSS using a
       * fill attribute). It must use a viewbox property rather than a height and width.
       * @property {MapAssets} layers - The data to render in the map.
       */

      /**
       * Executed when a new AssetCategory model is created.
       * @param {MapConfig#AssetCategoryConfig} categoryConfig The initial values of the
       * attributes, which will be set on the model.
       */
      initialize(categoryConfig) {
        if (!categoryConfig?.layers) {
          throw new Error(
            "Category " + categoryConfig.label + " has empty layers."
          );
        }
        this.set("mapAssets", new MapAssets(categoryConfig.layers));

        this.set("label", categoryConfig.label);

        // Fetch the icon, if there is one
        if (categoryConfig.icon) {
          try {
            if (IconUtilities.isSVG(categoryConfig.icon)) {
              this.updateIcon(categoryConfig.icon);
            } else {
              IconUtilities.fetchIcon(categoryConfig.icon).then((icon) =>
                this.updateIcon(icon)
              );
            }
          } catch (error) {
            // Do nothing. Use the default icon instead.
          }
        }
      },

      /**
       * Sanitizes an SVG string and updates the model's 'icon' attribute the sanitized
       * string.
       * @param {string} icon An SVG string to use for the AssetCategory icon
       */
      updateIcon(icon) {
        if (!icon) return;

        this.set("icon", IconUtilities.sanitizeIcon(icon));
      },

      /**
       * Set the parent map model on each of the MapAsset models in this
       * collection. This must be the Map model that contains this asset
       * collection.
       * @param {MapModel} mapModel The map model to set on each of the AssetCategory
       * models
       */
      setMapModel(mapModel) {
        this.get("mapAssets").setMapModel(mapModel);
      },
    },
  );

  return AssetCategory;
});
