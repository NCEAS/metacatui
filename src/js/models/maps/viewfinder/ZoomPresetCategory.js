"use strict";

define([
  "backbone",
  "models/maps/Map",
  "collections/maps/viewfinder/ZoomPresets",
  "common/IconUtilities",
], (Backbone, MapModel, ZoomPresets, IconUtilities) => {
  /**
   * @classdesc A ZoomPresetCategory Model contains metadata about the group of
   * preset locations in a Map, including a label, optional icon, and whether
   * the category is expanded by default in the Viewfinder UI.
   * @classcategory Models/Maps
   * @class ZoomPresetCategory
   * @name ZoomPresetCategory
   * @augments Backbone.Model
   * @since 0.0.0
   * @augments Backbone.Model
   * @constructs ZoomPresetCategory
   */
  const ZoomPresetCategory = Backbone.Model.extend(
    /** @lends ZoomPresetCategory.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "ZoomPresetCategory",

      /**
       * Configuration options for a zoom preset category. Must have zoomPresets
       * OR a url.
       * @typedef {object} MapConfig#ZoomPresetCategory
       * @property {string} label The label to show for this category in the
       * viewfinder UI.
       * @property {string} [icon] An optional icon class to show next to the
       * category label in the viewfinder UI.
       * @property {boolean} [expanded=false] Whether this category should be
       * expanded by default in the viewfinder UI.
       * @property {MapConfig#ZoomPresets} zoomPresets An array of zoom preset
       * configurations for this category or details on fetching them from a
       * URL. Either this or `url` is required.
       */

      /**
       * Default attributes for ZoomPresetCategory models. See the
       * {@link MapConfig#ZoomPresetCategory} typedef for details on each
       * attribute. Also adds a mapModel attribute that is not part of the
       * config, but is set when the model is created.
       * @returns {object} The default attributes for the model.
       */
      defaults() {
        return {
          label: "Areas of Interest",
          icon: "icon-screenshot",
          expanded: false,
          zoomPresets: null,
          mapModel: null,
        };
      },

      /**
       * Executed when a new ZoomPresetCategory model is created.
       * @param {MapConfig#ZoomPresetCategory} attrs The initial values of the
       * attributes, which will be set on the model.
       */
      initialize(attrs = {}) {
        if (!attrs?.zoomPresets) {
          throw new Error(
            `Category ${attrs.label} has no zoom presets nor url.`,
          );
        }

        // Create the ZoomPresets collection for this category
        const zoomPresets = new ZoomPresets(attrs.zoomPresets || [], {
          mapModel: this.get("mapModel"),
          parse: true,
        });
        this.set("zoomPresets", zoomPresets);
        this.set("expanded", this.get("expanded") === true);

        // Fetch/sanitize the icon, if provided
        if (attrs.icon) {
          try {
            if (IconUtilities.isSVG(attrs.icon)) {
              this.updateIcon(attrs.icon);
              this.set("isSvgIcon", true);
            } else if (
              attrs.icon.startsWith("doi:") ||
              attrs.icon.startsWith("uuid:")
            ) {
              IconUtilities.fetchIcon(attrs.icon).then((icon) => {
                this.set("isSvgIcon", true);
                this.updateIcon(icon);
              });
              // make sure it's a string and if it does not start with icon-, add it
            } else if (typeof attrs.icon === "string") {
              const iconClass = attrs.icon.startsWith("icon-")
                ? attrs.icon
                : `icon-${attrs.icon}`;
              this.set("icon", iconClass);
            } else {
              // If it's not a string, set the default icon
              this.set("icon", this.defaults().icon);
            }
          } catch (_error) {
            this.set("icon", this.defaults().icon);
          }
        }
      },

      /**
       * Sanitizes an SVG string and updates the model's 'icon' attribute with
       * the sanitized string.
       * @param {string} icon An SVG string to use for the ZoomPresetCategory
       * icon
       */
      updateIcon(icon) {
        if (!icon) return;
        this.set("icon", IconUtilities.sanitizeIcon(icon));
      },

      /**
       * Set the parent map model on the ZoomPresets collection in this
       * category. This must be the Map model that contains this category.
       * @param {MapModel} mapModel The map model to set on the ZoomPresets
       * collection
       */
      setMapModel(mapModel) {
        const zoomPresets = this.get("zoomPresets");
        if (zoomPresets) zoomPresets.mapModel = mapModel;
      },
    },
  );

  return ZoomPresetCategory;
});
