define([
  "underscore",
  "jquery",
  "backbone",
  "nGeohash",
  "models/filters/Filter",
], function (_, $, Backbone, nGeohash, Filter) {
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
          level: null,
          maxGeohashes: 1000,
          // groupedGeohashes: {},
          fields: ["geohash_1"],
          label: "Limit search to the map area",
          icon: "globe",
          operator: "OR",
          fieldsOperator: "OR",
          matchSubstring: false,
          levelHeightMap: {
            1: 6800000,
            2: 2400000,
            3: 550000,
            4: 120000,
            5: 7000,
            6: 0,
          },
        });
      },

      /**
       * Initialize the model, calling super
       */
      initialize: function (attributes, options) {
        Filter.prototype.initialize.call(this, attributes, options);
        this.listenTo(
          this,
          "change:height change:north change:south change:east",
          this.updateGeohashes
        );
      },

      /**
       * Update the level, fields, geohashes, and values on the model, according
       * to the current height, north, south and east attributes.
       */
      updateGeohashes: function () {
        try {
          const height = this.get("height");
          const limit = this.get("maxGeohashes");
          const bounds = {
            north: this.get("north"),
            south: this.get("south"),
            east: this.get("east"),
            west: this.get("west"),
          };
          let level = this.getGeohashLevel(height);
          let geohashIDs = this.getGeohashIDs(bounds, level);
          if (limit && geohashIDs.length > limit && level > 1) {
            while (geohashIDs.length > limit && level > 1) {
              level--;
              geohashIDs = this.getGeohashIDs(bounds, level);
            }
          }
          this.set("level", level);
          this.set("fields", ["geohash_" + level]);
          this.set("geohashes", geohashIDs);
          this.set("values", geohashIDs);
        } catch (e) {
          console.log("Failed to update geohashes" + e);
        }
      },

      /**
       * Get the geohash level to use for a given height.
       * 
       * @param {number} [height] - Altitude to use to calculate the geohash
       * level/precision.
       */
      getGeohashLevel: function (height) {
        try {
          const levelHeightMap = this.get("levelHeightMap");
          return Object.keys(levelHeightMap).find(
            (key) => height >= levelHeightMap[key]
          );
        } catch (e) {
          console.log("Failed to get geohash level, returning 1" + e);
          return 1;
        }
      },

      /**
       * Retrieves the geohash IDs for the provided bounding boxes and level.
       *
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {number} level - Geohash level.
       * @returns {string[]} Array of geohash IDs.
       */
      getGeohashIDs: function (bounds, level) {
        let geohashIDs = [];
        bounds = this.splitBoundingBox(bounds);
        bounds.forEach(function (bb) {
          geohashIDs = geohashIDs.concat(
            nGeohash.bboxes(bb.south, bb.west, bb.north, bb.east, level)
          );
        });
        return geohashIDs;
      },

      /**
       * Splits the bounding box if it crosses the prime meridian. Returns an
       * array of bounding boxes.
       *
       * @param {Object} bounds - Bounding box object with north, south, east,
       * and west properties.
       * @returns {Array<Object>} Array of bounding box objects.
       * @since x.x.x
       */
      splitBoundingBox: function (bounds) {
        const { north, south, east, west } = bounds;

        if (east < west) {
          return [
            { north, south, east: 180, west },
            { north, south, east, west: -180 },
          ];
        } else {
          return [{ north, south, east, west }];
        }
      },

      // TODO: Use the `groupGeohashes` function to consolidate geohashes into
      // groups and shorten the query. We can add each group as a sub-filter
      // within a filters group. Then the get Query function is fairly simple,
      // we might not have to override it at all. (to check). Question: Will
      // SolrResults give results for only the geohashes in the group, or will
      // it give results for all highest level geohashes? This will impact what
      // is shown on the cesium map, because we need counts for each geohash,
      // not each group.

      // /**
      //  * Sets geohashes for the model, considering the maximum geohash limit.
      //  * If the limit is exceeded, it reduces the level and calls the function recursively.
      //  */
      // setGeohashes: function () {
      //   try {
      //     const level = this.get("level");
      //     const limit = this.get("maxGeohashes");
      //     let bounds = {}[("north", "south", "east", "west")].forEach((key) => {
      //       bounds[key] = this.get(key);
      //     });
      //     // bounds = this.splitBoundingBox(...bounds);
      //     const geohashIDs = this.getGeohashIDs(bounds, level);
      //     if (limit && geohashIDs.length > limit && level > 1) {
      //       this.set("level", level - 1);
      //       this.setGeohashes();
      //       return;
      //     }
      //     this.set("geohashes", geohashIDs);
      //   } catch (error) {
      //     console.log(
      //       "There was an error getting geohashes in a Geohash model" +
      //         ". Error details: " +
      //         error
      //     );
      //   }
      // },

      /**
       * Builds a query string that represents this spatial filter
       * @return queryFragment - the query string representing the geohash constraints
       */
      // getQuery: function () {
      //   var queryFragment = "";
      //   var geohashes = this.get("geohashes");
      //   var groups = this.get("geohashGroups");
      //   var geohashList;

      //   // Only return geohash query fragments when they are enabled in the filter
      //   if (
      //     !geohashes ||
      //     !geohashes.length ||
      //     !groups ||
      //     !Object.keys(groups).length
      //   ) {
      //     return queryFragment;
      //   }

      //   // Group the Solr query fragment
      //   queryFragment += "+(";

      //   // Append geohashes at each level up to a fixed query string length
      //   _.each(Object.keys(groups), function (level) {
      //     geohashList = groups[level];
      //     queryFragment += "geohash_" + level + ":(";
      //     _.each(geohashList, function (geohash) {
      //       if (queryFragment.length < 7900) {
      //         queryFragment += geohash + "%20OR%20";
      //       }
      //     });
      //     // Remove the last OR
      //     queryFragment = queryFragment.substring(0, queryFragment.length - 8);
      //     queryFragment += ")%20OR%20";
      //   });
      //   // Remove the last OR
      //   queryFragment = queryFragment.substring(0, queryFragment.length - 8);
      //   // Ungroup the Solr query fragment
      //   queryFragment += ")";

      //   return queryFragment;
      // },

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

      // /**
      //  *  Consolidates geohashes into groups based on their geohash level
      //  *  and updates the model with those groups. The fields and values attributes
      //  *  on this model are also updated with the geohashes.
      //  */
      // groupGeohashes: function () {
      //   var geohashGroups = {};
      //   var sortedGeohashes = this.get("geohashes").sort();
      //   var groupedGeohashes = _.groupBy(sortedGeohashes, function (geohash) {
      //     return geohash.substring(0, geohash.length - 1);
      //   });
      //   //Find groups of geohashes that makeup a complete geohash tile (32)
      //   // so we can shorten the query
      //   var completeGroups = _.filter(
      //     Object.keys(groupedGeohashes),
      //     function (group) {
      //       return groupedGeohashes[group].length == 32;
      //     }
      //   );

      //   // Find groups that fall short of 32 tiles
      //   var incompleteGroups = [];
      //   _.each(
      //     _.filter(Object.keys(groupedGeohashes), function (group) {
      //       return groupedGeohashes[group].length < 32;
      //     }),
      //     function (incomplete) {
      //       incompleteGroups.push(groupedGeohashes[incomplete]);
      //     }
      //   );
      //   incompleteGroups = _.flatten(incompleteGroups);

      //   // Add both complete and incomplete groups to the instance property
      //   if (
      //     typeof incompleteGroups !== "undefined" &&
      //     incompleteGroups.length > 0
      //   ) {
      //     geohashGroups[incompleteGroups[0].length.toString()] =
      //       incompleteGroups;
      //   }
      //   if (
      //     typeof completeGroups !== "undefined" &&
      //     completeGroups.length > 0
      //   ) {
      //     geohashGroups[completeGroups[0].length.toString()] = completeGroups;
      //   }
      //   this.set("geohashGroups", geohashGroups); // Triggers a change event

      //   //Determine the field and value attributes
      //   var fields = [],
      //     values = [];
      //   _.each(
      //     Object.keys(geohashGroups),
      //     function (geohashLevel) {
      //       fields.push("geohash_" + geohashLevel);
      //       values = values.concat(geohashGroups[geohashLevel].slice());
      //     },
      //     this
      //   );

      //   this.set("fields", fields);
      //   this.set("values", values);
      // },

      // /**
      //  * @inheritdoc
      //  */
      // resetValue: function () {
      //   this.set("fields", this.defaults().fields);
      //   this.set("values", this.defaults().values);
      // },
    }
  );
  return SpatialFilter;
});
