/*global define */
define(["backbone", "collections/Filters", "models/maps/Map"], function (
  Backbone,
  Filters,
  Map
) {
  "use strict";

  /**
   * @class FiltersMapConnector
   * @name FiltersMapConnector
   * @classdesc A model that creates listeners between a Map model and a
   * collection of Filters. The Map will update any spatial filters in the
   * collection with map extent and zoom level changes. This connector does not
   * assume anything about how the map or filters will be displayed in the UI or
   * why those components need to be connected.
   * @name FiltersMapConnector
   * @extends Backbone.Model
   * @constructor
   * @classcategory Models/Connectors
   * @since 2.25.0
   */
  return Backbone.Model.extend(
    /** @lends FiltersMapConnector.prototype */ {
      /**
       * The type of Backbone.Model this is.
       * @type {string}
       * @since 2.25.0
       * @default "FiltersMapConnector"
       */
      type: "FiltersMapConnector",
      /**
       * @type {object}
       * @property {Filter[]} filtersList An array of Filter models to
       * optionally add to the Filters collection
       * @property {Filters} filters A Filters collection to connect to the Map
       * @property {SpatialFilter[]} spatialFilters An array of SpatialFilter
       * models present in the Filters collection.
       * @property {Map} map The Map model that will update the spatial filters
       * @property {boolean} isConnected Whether the connector is currently
       * listening to the Map model for changes. Set automatically when the
       * connector is started or stopped.
       * @property {function} onMoveEnd A function to call when the map is
       * finished moving. This function will be called with the connector as
       * 'this'.
       * @since 2.25.0
       */
      defaults: function () {
        return {
          filters: null,
          spatialFilters: [],
          map: null,
          isConnected: false,
          onMoveEnd: this.updateSpatialFilters,
        };
      },

      /**
       * Set up the model connections.
       * @param {object} attr - The attributes passed to the model, must include
       * a Filters collection and a Map model.
       * @param {object} options - The options passed to the model.
       * @param {boolean} [options.addSpatialFilter=true] - Whether to add a
       * SpatialFilter to the Filters collection if none are found. The
       * connector won't work without a SpatialFilter, but it will listen for
       * updates to the Filters collection and connect to any SpatialFilters
       * that are added.
       */
      initialize: function (attr, options) {
        try {
          if (!this.get("filters")) {
            this.set("filters",  new Filters([], { catalogSearch: true }));
          }
          if (!this.get("map")) {
            this.set("map", new Map());
          }
          const add = options?.addSpatialFilter ?? true;
          this.findAndSetSpatialFilters(add);
        } catch (e) {
          console.log("Error initializing Filters-Map connector: ", e);
        }
      },

      /**
       * Finds and sets the spatial filters within the Filters collection. Stops
       * any existing listeners, adds a new listener for collection updates, and
       * adds a spatial filter if needed.
       * @param {boolean} [add=false] - Whether to add a SpatialFilter if none
       * are found in the collection.
       */
      findAndSetSpatialFilters: function (add = false) {
        const wasConnected = this.get("isConnected");
        this.disconnect();
        this.setSpatialFilters();
        this.listenOnceToFiltersUpdates();
        this.addSpatialFilterIfNeeded(add);
        if (wasConnected) {
          this.connect();
        }
      },

      /**
       * Sets the SpatialFilter models found within the Filters collection to
       * the 'spatialFilters' attribute.
       */
      setSpatialFilters: function () {
        const spatialFilters = this.get("filters").where({
          filterType: "SpatialFilter",
        });
        this.set("spatialFilters", spatialFilters);
      },

      /**
       * Adds a listener to the Filters collection for updates, to re-run the
       * findAndSetSpatialFilters function.
       */
      listenOnceToFiltersUpdates: function () {
        this.listenToOnce(
          this.get("filters"),
          "add remove",
          this.findAndSetSpatialFilters
        );
      },

      /**
       * Adds a new SpatialFilter to the Filters collection if no spatial
       * filters are found and 'add' is true. This will trigger a collection
       * update, which will re-run the findAndSetSpatialFilters function.
       * @param {boolean} add - Whether to add a SpatialFilter if none are found
       * in the collection.
       */
      addSpatialFilterIfNeeded: function (add) {
        const spatialFilters = this.get("spatialFilters");
        if (!spatialFilters?.length && add) {
          this.get("filters").add({
            filterType: "SpatialFilter",
            isInvisible: true,
          });
        }
      },

      /**
       * Removes all SpatialFilter models from the Filters collection and
       * destroys them.
       */
      removeSpatialFilter: function () {
        const spatialFilters = this.get("spatialFilters");
        if (spatialFilters?.length) {
          this.stopListening(
            this.get("filters"),
            "add remove",
            this.findAndSetSpatialFilters
          );
          spatialFilters.forEach((filter) => {
            filter.collection.remove(filter);
          });
        }
        this.set("spatialFilters", []);
      },

      /**
       * Reset the spatial filter values to their defaults. This will remove
       * any spatial constraints from the search.
       */
      resetSpatialFilter: function () {
        const spatialFilters = this.get("spatialFilters");
        if (spatialFilters?.length) {
          spatialFilters.forEach((filter) => {
            filter.resetValue();
          });
        }
      },

      /**
       * Stops all Filter-Map listeners, including listeners on the Filters
       * collection and the Map model.
       * @param {boolean} [resetSpatialFilter=false] - Whether to reset the
       * spatial filter values to their defaults. This will remove any spatial
       * constraints from the search.
       */
      disconnect: function (resetSpatialFilter = false) {
        try {
          if (resetSpatialFilter) {
            this.resetSpatialFilter();
          }
          const interactions = this.get("map")?.get("interactions");
          this.stopListening(this.get("filters"), "add remove");
          this.stopListening(interactions, "moveEnd moveStartAndChanged");
          this.set("isConnected", false);
        } catch (e) {
          console.log("Error stopping Filter-Map listeners: ", e);
        }
      },

      /**
       * Starts listening to the Map Interaction model for changes in the
       * 'viewExtent' attribute, and calls the updateSpatialFilters function
       * when changes are detected. This method needs to be called for the
       * connector to work.
       */
      connect: function () {
        try {
          this.disconnect();
          const map = this.get("map");
          const interactions = map.get("interactions");
          // Constrain the spatial filter to the current map extent right away
          this.updateSpatialFilters();
          // Trigger a 'changing' event on the filters collection to
          // indicate that the spatial filter is being updated
          this.listenTo(interactions, "moveStartAndChanged", function () {
            this.get("filters").trigger("changing");
          });
          this.listenTo(interactions, "moveEnd", function () {
            const moveEndFunc = this.get("onMoveEnd");
            if (typeof moveEndFunc === "function") {
              moveEndFunc.call(this);
            }
          });
          this.set("isConnected", true);
        } catch (e) {
          console.log("Error starting Filter-Map listeners: ", e);
        }
      },

      /**
       * Updates the spatial filters with the current map extent and zoom level.
       */
      updateSpatialFilters: function () {
        try {
          const map = this.get("map");
          // TODO: If we update the spatialFilter to use the GeoBoundingBox
          // model (instead of north, south, east, west attributes), then we can
          // point directly to the MapInteraction model's 'viewExtent' attribute
          // instead of getting the extent from the map. They will stay in sync
          // automatically.
          const extent = map.get("interactions").get("viewExtent").toJSON();
          const spatialFilters = this.get("spatialFilters");

          if (!spatialFilters?.length) {
            return;
          }
          spatialFilters.forEach((spFilter) => {
            spFilter.set(extent, { silent: true });
            spFilter.trigger("change:height"); // Only trigger one change event
          });
        } catch (e) {
          console.log("Error updating spatial filters: ", e);
        }
      },
    }
  );
});
