define([
  "underscore",
  "jquery",
  "backbone",
  "models/filters/Filter",
  "collections/maps/Geohashes",
  "collections/Filters",
], function (_, $, Backbone, Filter, Geohashes, Filters) {
  /**
   * @classdesc A SpatialFilter represents a spatial constraint on the query to
   * be executed.
   * @class SpatialFilter
   * @classcategory Models/Filters
   * @name SpatialFilter
   * @constructs
   * @extends Filter
   */
  var SpatialFilter = Filter.extend(
    /** @lends SpatialFilter.prototype */ {
      /**
       * @inheritdoc
       */
      type: "SpatialFilter",

      /**
       * Inherits all default properties of {@link Filter}
       * @property {number} east The easternmost longitude of the search area
       * @property {number} west The westernmost longitude of the search area
       * @property {number} north The northernmost latitude of the search area
       * @property {number} south The southernmost latitude of the search area
       * @property {number} height The height at which to calculate the geohash
       * precision for the search area
       * @property {number} maxGeohashValues The maximum number of geohash
       * values to use in the filter. If the number of geohashes exceeds this
       * value, the precision will be reduced until the number of geohashes is
       * less than or equal to this value.
       */
      defaults: function () {
        return _.extend(Filter.prototype.defaults(), {
          filterType: "SpatialFilter",
          east: 180,
          west: -180,
          north: 90,
          south: -90,
          height: Infinity,
          fields: [],
          values: [],
          label: "Limit search to the map area",
          icon: "globe",
          operator: "OR",
          fieldsOperator: "OR",
          matchSubstring: false,
          // 1024 is the default limit in Solr for boolean clauses, limit even
          // more to allow for other filters
          maxGeohashValues: 500,
        });
      },

      /**
       * Initialize the model, calling super
       */
      initialize: function (attributes, options) {
        Filter.prototype.initialize.call(this, attributes, options);
        if (this.hasCoordinates()) this.updateFilterFromExtent();
        this.setListeners();
      },

      /**
       * Returns true if the filter has a valid set of coordinates
       * @returns {boolean} True if the filter has coordinates
       * @since x.x.x
       */
      hasCoordinates: function () {
        return (
          typeof this.get("east") === "number" &&
          typeof this.get("west") === "number" &&
          typeof this.get("north") === "number" &&
          typeof this.get("south") === "number"
        );
      },

      /**
       * Validate the coordinates, ensuring that the east and west are not
       * greater than 180 and that the north and south are not greater than 90.
       * Coordinates will be adjusted if they are out of bounds.
       * @param {boolean} [silent=true] - Whether to trigger a change event in
       * the case where the coordinates are adjusted
       * @since x.x.x
       */
      validateCoordinates: function (silent = true) {
        if (!this.hasCoordinates()) return;
        if (this.get("east") > 180) {
          this.set("east", 180, { silent: silent });
        }
        if (this.get("west") < -180) {
          this.set("west", -180, { silent: silent });
        }
        if (this.get("north") > 90) {
          this.set("north", 90, { silent: silent });
        }
        if (this.get("south") < -90) {
          this.set("south", -90), { silent: silent };
        }
      },

      /**
       * Set a listener that updates the filter when the coordinates & height
       * change
       * @since x.x.x
       */
      setListeners: function () {
        const extentEvents =
          "change:height change:north change:south change:east change:west";
        this.stopListening(this, extentEvents);
        this.listenTo(this, extentEvents, this.updateFilterFromExtent);
      },

      /**
       * Convert the coordinate attributes to a bounds object
       * @returns {object} An object with north, south, east, and west props
       * @since x.x.x
       */
      getBounds: function () {
        return {
          north: this.get("north"),
          south: this.get("south"),
          east: this.get("east"),
          west: this.get("west"),
        };
      },

      /**
       * Returns true if the bounds set on the filter covers the entire earth
       * @returns {boolean}
       * @since x.x.x
       */
      coversEarth: function () {
        const bounds = this.getBounds();
        return (
          bounds.north === 90 &&
          bounds.south === -90 &&
          bounds.east === 180 &&
          bounds.west === -180
        );
      },

      /**
       * Given the current coordinates and height set on the model, update the
       * fields and values to match the geohashes that cover the area. This will
       * set a consolidated set of geohashes that cover the area at the
       * appropriate precision. It will also validate the coordinates to ensure
       * that they are within the bounds of the map.
       * @since x.x.x
       */
      updateFilterFromExtent: function () {
        try {
          this.validateCoordinates();

          // If the bounds are global there is no spatial constraint
          if (this.coversEarth()) {
            this.set({ fields: [], values: [] });
            return;
          }

          const geohashes = new Geohashes();
          const bounds = this.getBounds();
          const limit = this.get("maxGeohashValues");
          geohashes.addGeohashesByBounds(bounds, true, limit, true);
          this.set({
            fields: this.precisionsToFields(geohashes.getPrecisions()),
            values: geohashes.getAllHashStrings(),
          });
        } catch (e) {
          console.log("Error updating filter from extent", e);
        }
      },

      /**
       * Coverts a geohash precision level to a field name for Solr
       * @param {number} precision The geohash precision level, e.g. 4
       * @returns {string} The corresponding field name, e.g. "geohash_4"
       * @since x.x.x
       */
      precisionToField: function (precision) {
        return precision && !isNaN(precision) ? "geohash_" + precision : null;
      },

      /**
       * Converts an array of geohash precision levels to an array of field
       * names for Solr
       * @param {number[]} precisions The geohash precision levels, e.g. [4, 5]
       * @returns {string[]} The corresponding field names, e.g. ["geohash_4",
       * "geohash_5"]
       * @since x.x.x
       */
      precisionsToFields: function (precisions) {
        let fields = [];
        if (precisions && precisions.length) {
          fields = precisions
            .map((lvl) => this.precisionToField(lvl))
            .filter((f) => f);
        }
        return fields;
      },

      /**
       * Builds a query string that represents this spatial filter
       * @param {boolean} [consolidate=false] Whether to consolidate the set of
       * geohashes to the smallest set that covers the same area (i.e. merges
       * geohashes together when there are complete groups of 32). This is false
       * by default because geohashes are already consolidated when they are
       * added as the spatial filter is used right now.
       * @return {string} The query fragment
       * @since x.x.x
       */
      getQuery: function (consolidate = false) {
        try {
          // Methods in the geohash collection allow us make efficient queries
          const hashes = this.get("values");
          let geohashes = new Geohashes(hashes.map((h) => ({ hashString: h })));

          // Don't spatially constrain the search if the geohahes covers the world
          // or if there are no geohashes
          if (geohashes.length === 0 || geohashes.coversEarth()) {
            return "";
          }

          if (consolidate) geohashes = geohashes.consolidate();

          const precisions = geohashes.getPrecisions();

          // Just use a regular Filter if there is only one level of geohash
          if (precisions.length === 1) {
            return this.createBaseFilter(
              precisions,
              geohashes.getAllHashStrings()
            ).getQuery();
          }

          // Make a query fragment that ORs together all the geohashes at each
          // precision level
          const Filters = require("collections/Filters");
          const filters = new Filters();
          precisions.forEach((precision) => {
            if (precision) {
              filters.add(
                this.createBaseFilter(
                  [precision],
                  geohashes.getAllHashStrings(precision)
                )
              );
            }
          });
          return filters.getQuery("OR");
        } catch (e) {
          console.log("Error in SpatialFilter.getQuery", e);
          return "";
        }
      },

      /**
       * Creates a Filter model that represents the geohashes at a given
       * precision level for a specific set of geohashes
       * @param {number[]} precisions The geohash precision levels, e.g. [4, 5]
       * @param {string[]} hashStrings The geohashes, e.g. ["9q8yy", "9q8yz"]
       * @returns {Filter} The filter model
       * @since x.x.x
       */
      createBaseFilter: function (precisions = [], hashStrings = []) {
        return new Filter({
          fields: this.precisionsToFields(precisions),
          values: hashStrings,
          operator: this.get("operator"),
          fieldsOperator: this.get("fieldsOperator"),
          matchSubstring: this.get("matchSubstring"),
        });
      },

      /**
       * @inheritdoc
       */
      updateDOM: function (options) {
        try {
          var updatedDOM = Filter.prototype.updateDOM.call(this, options),
            $updatedDOM = $(updatedDOM);

          //Force the serialization of the "operator" node for SpatialFilters,
          // since the Filter model will skip default values
          var operatorNode = updatedDOM.ownerDocument.createElement("operator");
          operatorNode.textContent = this.get("operator");
          var fieldsOperatorNode =
            updatedDOM.ownerDocument.createElement("fieldsOperator");
          fieldsOperatorNode.textContent = this.get("fieldsOperator");

          var matchSubstringNode =
            updatedDOM.ownerDocument.createElement("matchSubstring");
          matchSubstringNode.textContent = this.get("matchSubstring");

          //Insert the operator node
          $updatedDOM.children("field").last().after(operatorNode);

          //Insert the matchSubstring node
          $(matchSubstringNode).insertBefore(
            $updatedDOM.children("value").first()
          );

          //Return the updated DOM
          return updatedDOM;
        } catch (e) {
          console.error("Unable to serialize a SpatialFilter.", e);
          return this.get("objectDOM") || "";
        }
      },

      /**
       * @inheritdoc
       */
      resetValue: function () {
        const df = this.defaults();
        this.set({
          values: df.values,
          east: df.east,
          west: df.west,
          north: df.north,
          south: df.south,
          height: df.height,
        });
      },
    }
  );
  return SpatialFilter;
});
