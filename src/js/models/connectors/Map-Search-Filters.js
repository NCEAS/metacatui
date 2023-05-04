/*global define */
define([
  "backbone",
  "models/maps/Map",
  "collections/SolrResults",
  "collections/Filters",
  "models/connectors/Map-Search",
  "models/connectors/Filters-Search",
  "models/connectors/Filters-Map",
  "models/filters/FilterGroup",
], function (
  Backbone,
  Map,
  SearchResults,
  Filters,
  MapSearchConnector,
  FiltersSearchConnector,
  FiltersMapConnector,
  FilterGroup
) {
  "use strict";

  /**
   * @class  MapSearchFiltersConnector
   * @classdesc A model that handles connecting the Map model, the SolrResults
   * model, and the Filters model, e.g. for a CatalogSearchView.
   * @name  MapSearchFiltersConnector
   * @extends Backbone.Model
   * @constructor
   * @classcategory Models/Connectors
   * @since x.x.x
   */
  return Backbone.Model.extend(
    /** @lends  MapSearchFiltersConnector.prototype */ {
      /**
       * The default values for this model.
       * @type {object}
       * @property {Map} map
       * @property {SolrResults} searchResults
       * @property {Filters} filters
       */
      defaults: function () {
        return {
          map: new Map(),
          searchResults: new SearchResults(),
          filterGroups: [],
          filters: null,
        };
      },

      /**
       * Initialize the model.
       * @param {Object} attrs - The attributes for this model.
       * @param {Object} options - The options for this model.
       * @param {Map | Object} [options.map] - The Map model to use for this
       * connector or a JSON object with options to create a new Map model. If
       * not provided, the default from the appModel will be used. See
       * {@link AppModel#catalogSearchMapOptions}.
       * @param {SolrResults | Object} [options.searchResults] - The SolrResults
       * model to use for this connector or a JSON object with options to create
       * a new SolrResults model. If not provided, a new SolrResults model will
       * be created.
       * @param {FilterGroup[] | FilterGroup} [options.filterGroups] - An array
       * of FilterGroup models or JSON objects with options to create new
       * FilterGroup models. If a single FilterGroup is passed, it will be
       * wrapped in an array. If not provided, the default from the appModel
       * will be used. See {@link AppModel#defaultFilterGroups}.
       * @param {boolean} [options.addGeohashLayer=true] - If set to true, a Geohash
       * layer will be added to the Map model if one is not already present. If
       * set to false, no Geohash layer will be added. A geohash layer is
       * required for the Search-Map connector to work.
       * @param {boolean} [options.addSpatialFilter=true] - If set to true, a spatial
       * filter will be added to the Filters model if one is not already
       * present. If set to false, no spatial filter will be added. A spatial
       * filter is required for the Filters-Map connector to work.
       * @param {boolean} [options.catalogSearch=false] - If set to true, a
       * catalog search phrase in the Filters will be appended to the search
       * query that limits the results to un-obsoleted metadata. See
       * {@link Filters#createCatalogSearchQuery}.If set to true, a catalog
       * search phrase will be appended to the search query that limits the
       * results to un-obsoleted metadata.
       */
      initialize: function (attrs, options = {}) {
        if (!options) options = {};
        const app = MetacatUI.appModel;
        const map = options.map || app.get("catalogSearchMapOptions");
        const searchResults = options.searchResults || null;
        const filterGroups =
          options.filterGroups || app.get("defaultFilterGroups");
        const catalogSearch = options.catalogSearch !== true;
        const addGeohashLayer = options.addGeohashLayer !== false;
        const addSpatialFilter = options.addGeohashLayer !== false;
        this.setMap(map);
        this.setSearchResults(searchResults);
        this.setFilters(filterGroups, catalogSearch);
        this.setConnectors(addGeohashLayer, addSpatialFilter);
      },

      /**
       * Set the Map model for this connector.
       * @param {Map | Object } map - The Map model to use for this connector or
       * a JSON object with options to create a new Map model.
       */
      setMap: function (map) {
        const mapModel = map instanceof Map ? map : new Map(map || null);
        this.set("map", mapModel);
      },

      /**
       * Set the SearchResults model for this connector.
       * @param {SolrResults | Object } searchResults - The SolrResults model to
       * use for this connector or a JSON object with options to create a new
       * SolrResults model.
       */
      setSearchResults: function (searchResults) {
        const resultsModel =
          searchResults instanceof SearchResults
            ? searchResults
            : new SearchResults(searchResults || {});
        this.set("searchResults", resultsModel);
      },

      /**
       * Set the Filters model for this connector.
       * @param {Array} filters - An array of FilterGroup models or JSON objects
       * with options to create new FilterGroup models. If a single FilterGroup
       * is passed, it will be wrapped in an array.
       * @param {boolean} [catalogSearch=true] - If true, the Filters model will
       * be created with the catalogSearch option set to true.
       * @see Filters
       * @see FilterGroup
       */
      setFilters: function (filtersArray, catalogSearch = true) {
        const filterGroups = [];
        const filters = new Filters(null, { catalogSearch: catalogSearch });

        filtersArray = Array.isArray(filtersArray)
          ? filtersArray
          : [filtersArray];

        filtersArray.forEach((filterGroup) => {
          // filterGroupJSON.isUIFilterType = true; // TODO - do we need this?
          const filterGroupModel =
            filterGroup instanceof FilterGroup
              ? filterGroup
              : new FilterGroup(filterGroup || {});
          filterGroups.push(filterGroupModel);
          filters.add(filterGroupModel.get("filters").models);
        });

        this.set("filterGroups", filterGroups);
        this.set("filters", filters);
      },

      /**
       * Set all the connectors required to connect the Map, SearchResults, and
       * Filters. This does not connect them (see connect()).
       * @param {boolean} [addGeohashLayer=true] - If set to true, a Geohash
       * layer will be added to the Map model if one is not already present. If
       * set to false, no Geohash layer will be added. A geohash layer is
       * required for the Search-Map connector to work.
       * @param {boolean} [addSpatialFilter=true] - If set to true, a spatial
       * filter will be added to the Filters model if one is not already
       * present. If set to false, no spatial filter will be added. A spatial
       * filter is required for the Filters-Map connector to work.
       */
      setConnectors: function (
        addGeohashLayer = true,
        addSpatialFilter = true
      ) {
        const map = this.get("map");
        const searchResults = this.get("searchResults");
        const filters = this.get("filters");

        this.set(
          "mapSearchConnector",
          new MapSearchConnector({ map, searchResults }, { addGeohashLayer })
        );
        this.set(
          "filtersSearchConnector",
          new FiltersSearchConnector({ filters, searchResults })
        );
        this.set(
          "filtersMapConnector",
          new FiltersMapConnector({ filters, map }, { addSpatialFilter })
        );
      },

      /**
       * Get all the connectors associated with this connector.
       * @returns {Backbone.Model[]} An array of connector models.
       */
      getConnectors: function () {
        return [
          this.get("mapSearchConnector"),
          this.get("filtersSearchConnector"),
          this.get("filtersMapConnector"),
        ];
      },

      /**
       * Get all the connectors associated with the Map.
       * @returns {Backbone.Model[]} An array of connector models.
       */
      getMapConnectors: function () {
        return [
          this.get("mapSearchConnector"),
          this.get("filtersMapConnector"),
        ];
      },

      /**
       * Set all necessary listeners between the Map, SearchResults, and Filters
       * so that they work together.
       */
      connect: function () {
        this.coordinateMoveEndSearch();
        this.getConnectors().forEach((connector) => connector.connect());
      },

      /**
       * Disconnect all listeners between the Map, SearchResults, and Filters.
       * @param {boolean} [resetSpatialFilter=false] - If true, the spatial
       * filter will be reset to the default value, which will effectively
       * remove any spatial constraints from the search.
       */
      disconnect: function (resetSpatialFilter = false) {
        this.get("filtersMapConnector").disconnect(resetSpatialFilter);
        this.get("filtersSearchConnector").disconnect();
        this.get("mapSearchConnector").disconnect();
        this.resetMoveEndSearch();
      },

      /**
       * Coordinate behaviour between the two map related sub-connectors when
       * the map extent changes. This is necessary to reduce the number of
       * search queries. We keep the moveEnd behaviour within the sub-connectors
       * so that each sub-connector still functions independently from this
       * coordinating connector.
       */
      coordinateMoveEndSearch: function () {
        // Undo any previous coordination, if any
        this.resetMoveEndSearch();

        const map = this.get("map");
        const mapConnectors = this.getMapConnectors();

        // Stop the sub-connectors from doing anything on moveEnd by setting
        // their method they call on moveEnd to null
        mapConnectors.forEach((connector) => {
          connector.set("onMoveEnd", null);
        });

        // Set the single moveEnd listener here, and run the default moveEnd
        // behaviour for each sub-connector. This effectively triggers only one
        // search per moveEnd.
        this.listenTo(map, "moveEnd", function () {
          mapConnectors.forEach((connector) => {
            const moveEndFunc = connector.defaults().onMoveEnd;
            if (typeof moveEndFunc === "function") {
              moveEndFunc.call(connector);
            }
          });
        });
      },

      /**
       * Undo the coordination of the two map related sub-connectors when the
       * map extent changes. Reset the moveEnd behaviour of the sub-connectors
       * to their defaults.
       * @see coordinateMoveEndSearch
       */
      resetMoveEndSearch: function () {
        this.stopListening(this.get("map"), "moveEnd");
        const mapConnectors = this.getMapConnectors();
        mapConnectors.forEach((connector) => {
          connector.set("onMoveEnd", connector.defaults().onMoveEnd);
        });
      },

      /**
       * Disconnect the filters from the map. This stops the map from updating
       * any spatial filters in the filters collection with the extent of the
       * map view.
       * @param {boolean} [resetSpatialFilter=false] - If true, the spatial
       * filter will be reset to the default value, which will effectively
       * remove any spatial constraints from the search.
       */
      disconnectFiltersMap: function (resetSpatialFilter = false) {
        const [mapSearch, filtersMap] = this.getMapConnectors();

        if (mapSearch.get("isConnected")) {
          this.resetMoveEndSearch();
          mapSearch.set("onMoveEnd", mapSearch.defaults().onMoveEnd);
        }

        filtersMap.disconnect(resetSpatialFilter);
      },

      /**
       * Connect or re-connect the filters to the map. This will enable the map
       * to start updating any spatial filters in the filters collection with
       * the extent of the map view.
       */
      connectFiltersMap: function () {
        const [mapSearch, filtersMap] = this.getMapConnectors();

        if (mapSearch.get("isConnected")) {
          this.coordinateMoveEndSearch();
        }
        filtersMap.connect();
      },

      /**
       * Check if all connectors are connected.
       * @returns {boolean} True if all connectors are connected, false if any
       * are disconnected.
       */
      isConnected: function () {
        const connectors = this.getConnectors();
        return connectors.every((connector) => connector.get("isConnected"));
      },

      /**
       * Remove the spatial filter from the Filters model.
       */
      removeSpatialFilter: function () {
        this.get("filtersMapConnector").removeSpatialFilter();
      },
    }
  );
});
