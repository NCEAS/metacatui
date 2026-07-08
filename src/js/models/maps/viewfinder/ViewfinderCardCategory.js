"use strict";

define([
  "backbone",
  "models/maps/Map",
  "collections/maps/viewfinder/ViewfinderCards",
  "common/IconUtilities",
], (Backbone, MapModel, ViewfinderCards, IconUtilities) => {
  /**
   * @classdesc A ViewfinderCardCategory Model contains metadata about a group
   * of viewfinder cards in a Map, including a label, optional icon, and
   * whether the category is expanded by default in the Viewfinder UI. It was
   * generalized from the ZoomPresetCategory model and renamed for clarity when
   * zoom presets were deprecated in favor of viewfinder cards in 0.0.0.
   * @classcategory Models/Maps
   * @class ViewfinderCardCategory
   * @name ViewfinderCardCategory
   * @augments Backbone.Model
   * @screenshot views/maps/viewfinder/ViewfinderCardCategoryView.png
   * @since 2.35.0
   * @constructs ViewfinderCardCategory
   */
  const ViewfinderCardCategory = Backbone.Model.extend(
    /** @lends ViewfinderCardCategory.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "ViewfinderCardCategory",

      /**
       * Configuration options for a viewfinder card category. Must have
       * viewfinderCards OR a url. It was renamed from ZoomPresetCategory and
       * still accepts the legacy key `zoomPresets` for backward compatibility
       * with existing portal configurations.
       * @typedef {object} MapConfig#ViewfinderCardCategory
       * @property {string} label The label to show for this category in the
       * viewfinder UI.
       * @property {string} [icon] An optional icon class to show next to the
       * category label in the viewfinder UI.
       * @property {boolean} [expanded=false] Whether this category should be
       * expanded by default in the viewfinder UI.
       * @property {MapConfig#ViewfinderCards} viewfinderCards An array of
       * viewfinder card configurations for this category or details on fetching
       * them from a URL. Either this or `url` is required.
       */

      /**
       * Default attributes for ViewfinderCardCategory models. See the
       * {@link MapConfig#ViewfinderCardCategory} typedef for details on each
       * attribute. Also adds a mapModel attribute that is not part of the
       * config, but is set when the model is created.
       * @returns {object} The default attributes for the model.
       */
      defaults() {
        return {
          label: "Areas of Interest",
          icon: "icon-screenshot",
          expanded: false,
          viewfinderCards: null,
          mapModel: null,
        };
      },

      /**
       * Executed when a new ViewfinderCardCategory model is created.
       * @param {MapConfig#ViewfinderCardCategory} attrs The initial values of
       * the attributes, which will be set on the model.
       */
      initialize(attrs = {}) {
        // Support legacy portal config key `zoomPresets` as well as new key
        // `viewfinderCards`.
        const cardsConfig = attrs?.viewfinderCards ?? attrs?.zoomPresets;

        if (!cardsConfig) {
          throw new Error(
            `Category ${attrs.label} has no viewfinder cards nor url.`,
          );
        }

        // Create the ViewfinderCards collection for this category
        const viewfinderCards = new ViewfinderCards(cardsConfig || [], {
          mapModel: this.get("mapModel"),
          parse: true,
        });
        this.set("viewfinderCards", viewfinderCards);
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
       * @param {string} icon An SVG string to use for the ViewfinderCardCategory
       * icon
       */
      updateIcon(icon) {
        if (!icon) return;
        this.set("icon", IconUtilities.sanitizeIcon(icon));
      },

      /**
       * Set the parent map model on the ViewfinderCards collection in this
       * category. This must be the Map model that contains this category.
       * @param {MapModel} mapModel The map model to set on the ViewfinderCards
       * collection
       */
      setMapModel(mapModel) {
        const viewfinderCards = this.get("viewfinderCards");
        if (viewfinderCards) viewfinderCards.mapModel = mapModel;
      },
    },
  );

  return ViewfinderCardCategory;
});
