define([
  "underscore",
  "jquery",
  "backbone",
  "models/filters/Filter",
  "collections/Filters",
  "collections/maps/Geohashes",
], function (_, $, Backbone, Filter, Filters, Geohashes) {
  /**
   * @classdesc A SpatialFilter represents a spatial constraint on the query to be executed,
   * and stores the geohash strings for all of the geohash tiles that coincide with the
   * search bounding box at the given zoom level.
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
       * TODO: Fix these docs
       * Inherits all default properties of {@link Filter}
       * @property {string[]} geohashes - The array of geohashes used to spatially constrain the search
       * @property {object} groupedGeohashes -The same geohash values, grouped by geohash level (e.g. 1,2,3...). Complete geohash groups (of 32) are consolidated to the level above.
       * @property {number} east The easternmost longitude of the represented bounding box
       * @property {number} west The westernmost longitude of the represented bounding box
       * @property {number} north The northernmost latitude of the represented bounding box
       * @property {number} south The southernmost latitude of the represented bounding box
       * @property {number} geohashLevel The default precision level of the geohash-based search
       * // TODO update the above
       */
      defaults: function () {
        return _.extend(Filter.prototype.defaults(), {
          geohashes: [],
          filterType: "SpatialFilter",
          east: null,
          west: null,
          north: null,
          south: null,
          height: null,
          fields: ["geohash_1"],
          label: "Limit search to the map area",
          icon: "globe",
          operator: "OR",
          fieldsOperator: "OR",
          matchSubstring: false,
        });
      },

      /**
       * Initialize the model, calling super
       */
      initialize: function (attributes, options) {
        Filter.prototype.initialize.call(this, attributes, options);
        this.setUpGeohashCollection();
        this.update();
        this.setListeners();
      },

      setUpGeohashCollection: function () {
        this.set("geohashCollection", new Geohashes());
      },

      setListeners: function () {
        this.listenTo(
          this,
          "change:height change:north change:south change:east change:west",
          this.update
        );
      },

      update: function () {
        this.updateGeohashCollection();
        this.updateFilter();
      },

      updateGeohashCollection: function () {
        const gCollection = this.get("geohashCollection");
        gCollection.addGeohashesByExtent(
          (bounds = {
            north: this.get("north"),
            south: this.get("south"),
            east: this.get("east"),
            west: this.get("west"),
          }),
          (height = this.get("height")),
          (overwrite = true)
        );
      },

      /**
       * Update the level, fields, geohashes, and values on the model, according
       * to the current height, north, south and east attributes.
       */
      updateFilter: function () {
        try {
          const levels = this.getGeohashLevels().forEach((lvl) => {
            return "geohash_" + lvl;
          });
          const IDs = this.getGeohashIDs();
          this.set("fields", levels);
          this.set("values", IDs);
        } catch (e) {
          console.log("Failed to update geohashes", e);
        }
      },

      getGeohashLevels: function () {
        const gCollection = this.get("geohashCollection");
        return gCollection.getLevels();
      },

      getGeohashIDs: function () {
        const gCollection = this.get("geohashCollection");
        return gCollection.getGeohashIDs();
      },

      /**
       * Builds a query string that represents this spatial filter
       * @return {string} The query fragment
       */
      getQuery: function () {
        const subset = this.get("geohashCollection").getMerged();
        const levels = subset.getLevels();
        if (levels.length <= 1) {
          // We can use the prototype getQuery method if only one level of
          // geohash is set on the fields
          return Filter.prototype.getQuery.call(this);
        }
        // Otherwise, we will get a query from a collection of filters, each
        // one representing a single level of geohash
        const filters = new Filters();
        levels.forEach((lvl) => {
          const filter = new SpatialFilter({
            fields: ["geohash_" + lvl],
            values: subset[lvl],
          });
          filters.add(filter);
        });
        return filters.getQuery();
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
        this.set("fields", this.defaults().fields);
        this.set("values", this.defaults().values);
      },
    }
  );
  return SpatialFilter;
});
