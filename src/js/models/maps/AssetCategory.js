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
       //  TODO: yvonneshi - Find default icon
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
          label: '',
          icon: '',
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
          throw new Error("Category " + categoryConfig.label + " has empty layers.");
        }
        this.set("mapAssets", new MapAssets(categoryConfig.layers));

        this.set("label", categoryConfig.label);

        // Fetch the icon, if there is one
        if (categoryConfig.icon) {
          try {
            if (IconUtilities.isSVG(categoryConfig.icon)) {
              this.updateIcon(categoryConfig.icon);
            } else {
              IconUtilities.fetchIcon(categoryConfig.icon)
                .then(icon => this.updateIcon(icon));
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
    }
  );

  return AssetCategory;
});
