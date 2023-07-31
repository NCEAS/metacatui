define([
  "jquery",
  "underscore",
  "backbone",
  "gmaps",
  "collections/Filters",
  "collections/SolrResults",
  "models/filters/FilterGroup",
  "models/filters/SpatialFilter",
  "models/Stats",
  "views/DataCatalogView",
  "views/filters/FilterGroupsView",
  "text!templates/dataCatalog.html",
  "nGeohash",
], function (
  $,
  _,
  Backbone,
  gmaps,
  Filters,
  SearchResults,
  FilterGroup,
  SpatialFilter,
  Stats,
  DataCatalogView,
  FilterGroupsView,
  template,
  nGeohash
) {
  /**
   * @class DataCatalogViewWithFilters
   * @classdesc A DataCatalogView that uses the Search collection and the Filter
   * models for managing queries rather than the Search model and the filter
   * literal objects used in the parent DataCatalogView.  This accommodates
   * custom portal filters. This view is deprecated and will eventually be
   * removed in a future version (likely 3.0.0)
   * @classcategory Views
   * @extends DataCatalogView
   * @constructor
   * @deprecated
   */
  var DataCatalogViewWithFilters = DataCatalogView.extend(
    /** @lends DataCatalogViewWithFilters.prototype */ {
      el: null,

      /**
       * The HTML tag name for this view element
       * @type {string}
       */
      tagName: "div",

      /**
       * The HTML class names for this view element
       * @type {string}
       */
      className: "data-catalog",

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(template),

      /**
       * A reference to the PortalEditorView
       * @type {PortalEditorView}
       */
      editorView: undefined,

      /**
       * The sort order for the Solr query
       * @type {string}
       */
      sortOrder: "dateUploaded+desc",

      /**
       * The jQuery selector for the FilterGroupsView container
       * @type {string}
       */
      filterGroupsContainer: ".filter-groups-container",

      /**
       * The Search model to use for creating and storing Filters and
       * constructing query strings. This property is a Search model instead of
       * a Filters collection in order to be quickly compatible with the
       * superclass/superview, DataCatalogView, which was created with the
       * (eventually to be deprecated) SearchModel. A Filters collection is set
       * on the Search model and does most of the work for creating queries.
       * @type (Search)
       */
      searchModel: undefined,

      /**
       * Override DataCatalogView.render() to render this view with filters from
       * the Filters collection
       */
      render: function () {
        var loadingHTML;
        var templateVars;
        var compiledEl;
        var tooltips;
        var groupedTooltips;
        var forFilterLabel = true;
        var forOtherElements = false;
        // TODO: Do we really need to cache the filters collection? Reconcile
        // this from DataCatalogView.render() See
        // https://github.com/NCEAS/metacatui/blob/19d608df9cc17ac2abee76d35feca415137c09d7/src/js/views/DataCatalogView.js#L122-L145

        // Get the search mode - either "map" or "list"
        if (typeof this.mode === "undefined" || !this.mode) {
          this.mode = MetacatUI.appModel.get("searchMode");
          if (typeof this.mode === "undefined" || !this.mode) {
            this.mode = "map";
          }
          MetacatUI.appModel.set("searchMode", this.mode);
        }

        if (!this.statsModel) {
          this.statsModel = new Stats();
        }

        if (!this.searchResults) {
          this.searchResults = new SearchResults();
        }

        // Use map mode on tablets and browsers only
        if ($(window).outerWidth() <= 600) {
          this.mode = "list";
          MetacatUI.appModel.set("searchMode", "list");
          gmaps = null;
        }

        // If this is a subview, don't set the headerType
        if (!this.isSubView) {
          MetacatUI.appModel.set("headerType", "default");
          $("body").addClass("DataCatalog");
        } else {
          this.$el.addClass("DataCatalog");
        }
        // Populate the search template with some model attributes
        loadingHTML = this.loadingTemplate({
          msg: "Loading entries ...",
        });

        templateVars = {
          gmaps: gmaps,
          mode: MetacatUI.appModel.get("searchMode"),
          useMapBounds: this.searchModel.get("useGeohash"),
          username: MetacatUI.appUserModel.get("username"),
          isMySearch:
            _.indexOf(
              this.searchModel.get("username"),
              MetacatUI.appUserModel.get("username")
            ) > -1,
          loading: loadingHTML,
          searchModelRef: this.searchModel,
          searchResultsRef: this.searchResults,
          dataSourceTitle:
            MetacatUI.theme == "dataone" ? "Member Node" : "Data source",
        };
        compiledEl = this.template(
          _.extend(this.searchModel.toJSON(), templateVars)
        );
        this.$el.html(compiledEl);

        // Create and render the FilterGroupsView
        this.createFilterGroups();

        // Store some references to key views that we use repeatedly
        this.$resultsview = this.$("#results-view");
        this.$results = this.$("#results");

        // Update stats
        this.updateStats();

        // Render the Google Map
        this.renderMap();
        // Initialize the tooltips
        tooltips = $(".tooltip-this");

        // Find the tooltips that are on filter labels - add a slight delay to
        // those
        groupedTooltips = _.groupBy(tooltips, function (t) {
          return (
            ($(t).prop("tagName") == "LABEL" ||
              $(t).parent().prop("tagName") == "LABEL") &&
            $(t).parents(".filter-container").length > 0
          );
        });

        $(groupedTooltips[forFilterLabel]).tooltip({
          delay: {
            show: "800",
          },
        });
        $(groupedTooltips[forOtherElements]).tooltip();

        // Initialize all popover elements
        $(".popover-this").popover();

        // Initialize the resizeable content div
        $("#content").resizable({
          handles: "n,s,e,w",
        });

        // Register listeners; this is done here in render because the HTML
        // needs to be bound before the listenTo call can be made
        this.stopListening(this.searchResults);
        this.stopListening(this.searchModel);
        this.stopListening(MetacatUI.appModel);
        this.listenTo(this.searchResults, "reset", this.cacheSearch);
        this.listenTo(this.searchResults, "add", this.addOne);
        this.listenTo(this.searchResults, "reset", this.addAll);
        this.listenTo(this.searchResults, "reset", this.checkForProv);
        this.listenTo(this.searchResults, "error", this.showError);

        // Listen to changes in the Search model Filters to trigger a search
        this.stopListening(
          this.searchModel.get("filters"),
          "add remove update reset change"
        );
        this.listenTo(
          this.searchModel.get("filters"),
          "add remove update reset change",
          this.triggerSearch
        );

        // Listen to the MetacatUI.appModel for the search trigger
        this.listenTo(MetacatUI.appModel, "search", this.getResults);

        this.listenTo(
          MetacatUI.appUserModel,
          "change:loggedIn",
          this.triggerSearch
        );

        // and go to a certain page if we have it
        this.getResults();

        // Set a custom height on any elements that have the .auto-height class
        if ($(".auto-height").length > 0 && !this.fixedHeight) {
          // Readjust the height whenever the window is resized
          $(window).resize(this.setAutoHeight);
          $(".auto-height-member").resize(this.setAutoHeight);
        }

        this.addAnnotationFilter();

        return this;
      },

      /**
       * Creates UI Filter Groups and renders them in this view. UI Filter
       * Groups are custom, interactive search filter elements, grouped together
       * in one panel, section, tab, etc.
       */
      createFilterGroups: function () {
        // If it was already created, then exit
        if (this.filterGroupsView) {
          return;
        }

        // Start an array for the FilterGroups and the individual Filter models
        var filterGroups = [],
          allFilters = [];

        // Iterate over each default FilterGroup in the app config and create a
        // FilterGroup model
        _.each(
          MetacatUI.appModel.get("defaultFilterGroups"),
          function (filterGroupJSON) {
            // Create the FilterGroup model
            var filterGroup = new FilterGroup(filterGroupJSON);

            // Add to the array
            filterGroups.push(filterGroup);

            // Add the Filters to the array
            allFilters = _.union(allFilters, filterGroup.get("filters").models);
          },
          this
        );

        // Add the filters to the Search model
        this.searchModel.get("filters").add(allFilters);

        // Create a FilterGroupsView
        var filterGroupsView = new FilterGroupsView({
          filterGroups: filterGroups,
          filters: this.searchModel.get("filters"),
          vertical: true,
          parentView: this,
          editorView: this.editorView,
        });

        // Add the FilterGroupsView element to this view
        this.$(this.filterGroupsContainer).html(filterGroupsView.el);

        // Render the FilterGroupsView
        filterGroupsView.render();

        // Save a reference to the FilterGroupsView
        this.filterGroupsView = filterGroupsView;
      },

      /*
       * Get Results from the Solr index by combining the Filter query string
       * fragments in each Filter instance in the Search collection and querying
       * Solr.
       *
       * Overrides DataCatalogView.getResults().
       */
      getResults: function () {
        var sortOrder = this.searchModel.get("sortOrder");
        var query; // The full query string
        var geohashLevel; // The geohash level to search
        var page; // The page of search results to render
        var position; // The geohash level position in the facet array

        // Get the Solr query string from the Search filter collection
        query = this.searchModel.get("filters").getQuery();

        // If the query hasn't changed since the last query that was sent, don't
        // do anything. This function may have been triggered by a change event
        // on a filter that doesn't affect the query at all
        if (query == this.searchResults.getLastQuery()) {
          return;
        }

        if (sortOrder) {
          this.searchResults.setSort(sortOrder);
        }

        // Specify which fields to retrieve
        var fields = [
          "id",
          "seriesId",
          "title",
          "origin",
          "pubDate",
          "dateUploaded",
          "abstract",
          "resourceMap",
          "beginDate",
          "endDate",
          "read_count_i",
          "geohash_9",
          "datasource",
          "isPublic",
          "project",
          "documents",
          "label",
          "logo",
          "formatId",
        ];
        // Add spatial fields if the map is present
        if (gmaps) {
          fields.push(
            "northBoundCoord",
            "southBoundCoord",
            "eastBoundCoord",
            "westBoundCoord"
          );
        }
        // Set the field list on the SolrResults collection as a comma-separated
        // string
        this.searchResults.setfields(fields.join(","));

        // Specify which geohash level is used to return tile counts
        if (gmaps && this.map) {
          geohashLevel =
            "geohash_" + this.mapModel.determineGeohashLevel(this.map.zoom);
          // Does it already exist as a facet field?
          position = this.searchResults.facet.indexOf(geohashLevel);
          if (position == -1) {
            this.searchResults.facet.push(geohashLevel);
          }
        }

        // Set the query on the SolrResults collection
        this.searchResults.setQuery(query);

        // Get the page number
        if (this.isSubView) {
          page = 0;
        } else {
          page = MetacatUI.appModel.get("page");
          if (page == null) {
            page = 0;
          }
        }
        this.searchResults.start = page * this.searchResults.rows;

        // go to the page, which triggers a search
        this.showPage(page);

        // don't want to follow links
        return false;
      },

      /**
       * Toggle the map filter to include or exclude it from the Solr query
       */
      toggleMapFilter: function (event) {
        var toggleInput = this.$("input" + this.mapFilterToggle);
        if (typeof toggleInput === "undefined" || !toggleInput) return;

        var isOn = $(toggleInput).prop("checked");

        // If the user clicked on the label, then change the checkbox for them
        if (event && event.target.tagName != "INPUT") {
          isOn = !isOn;
          toggleInput.prop("checked", isOn);
        }

        var spatialFilter = _.findWhere(
          this.searchModel.get("filters").models,
          { type: "SpatialFilter" }
        );

        if (isOn) {
          this.searchModel.set("useGeohash", true);

          if (this.filterGroupsView && spatialFilter) {
            this.filterGroupsView.addCustomAppliedFilter(spatialFilter);
          }
        } else {
          this.searchModel.set("useGeohash", false);
          // Remove the spatial filter from the collection
          this.searchModel.get("filters").remove(spatialFilter);

          if (this.filterGroupsView && spatialFilter) {
            this.filterGroupsView.removeCustomAppliedFilter(spatialFilter);
          }
        }

        // Tell the map to trigger a new search and redraw tiles
        this.allowSearch = true;
        google.maps.event.trigger(this.mapModel.get("map"), "idle");

        // Track this event
        MetacatUI.analytics?.trackEvent("map", (isOn ? "on" : "off"));
      },

      /**
       * Overload this function with an empty function since the Clear button
       * has been moved to the FilterGroupsView
       */
      toggleClearButton: function () {},

      /**
       * Overload this function with an empty function since the Clear button
       * has been moved to the FilterGroupsView
       */
      hideClearButton: function () {},

      /**
       * Overload this function with an empty function since the Clear button
       * has been moved to the FilterGroupsView
       */
      showClearButton: function () {},

      /**
       * Toggle between map and list mode
       *
       * @param(Event)  the event passed by clicking the toggle-map class button
       */
      toggleMapMode: function (event) {
        // Block the event from bubbling
        if (typeof event === "object") {
          event.preventDefault();
        }

        if (gmaps) {
          $(".mapMode").toggleClass("mapMode");
        }

        // Toggle the mode
        if (this.mode == "map") {
          MetacatUI.appModel.set("searchMode", "list");
          this.mode = "list";
          this.$("#map-canvas").detach();
          this.setAutoHeight();
          this.getResults();
        } else if (this.mode == "list") {
          MetacatUI.appModel.set("searchMode", "map");
          this.mode = "map";
          this.renderMap();
          this.setAutoHeight();
          this.getResults();
        }
      },

      /**
       * Reset the map to the defaults
       */
      resetMap: function () {
        // The spatial models registered in the filters collection
        var spatialModels;

        if (!gmaps) {
          return;
        }

        // Remove the SpatialFilter from the collection silently so we don't
        // immediately trigger a new search
        spatialModels = _.where(this.searchModel.get("filters").models, {
          type: "SpatialFilter",
        });
        this.searchModel.get("filters").remove(spatialModels, { silent: true });

        // Reset the map options to defaults
        this.mapModel.set("mapOptions", this.mapModel.defaults().mapOptions);
        this.allowSearch = false;
      },

      /**
       * Render the map based on the mapModel properties and search results
       */
      renderMap: function () {
        // If gmaps isn't enabled or loaded with an error, use list mode
        if (!gmaps || this.mode == "list") {
          this.ready = true;
          this.mode = "list";
          return;
        }

        // The spatial filter instance used to constrain the search by zoom and
        // extent
        var spatialFilter;

        // The map's configuration
        var mapOptions;

        // The map extent
        var boundingBox;

        // The map bounding coordinates
        var north;
        var west;
        var south;
        var east;

        // The map zoom level
        var zoom;

        // The map geohash precision based on the zoom level
        var precision;

        // The geohash boxes associated with the map extent and zoom
        var geohashBBoxes;

        // References to the map and catalog view instances for callbacks
        var mapRef;
        var viewRef;

        if (this.isSubView) {
          this.$el.addClass("mapMode");
        } else {
          $("body").addClass("mapMode");
        }

        // Get the map options and create the map
        gmaps.visualRefresh = true;
        mapOptions = this.mapModel.get("mapOptions");
        var defaultZoom = mapOptions.zoom;
        $("#map-container").append("<div id='map-canvas'></div>");
        this.map = new gmaps.Map($("#map-canvas")[0], mapOptions);
        this.mapModel.set("map", this.map);
        this.hasZoomed = false;
        this.hasDragged = false;

        // Hide the map filter toggle element
        this.$(this.mapFilterToggle).hide();

        // Get the existing spatial filter if it exists
        if (
          this.searchModel.get("filters") &&
          this.searchModel.get("filters").where({ type: "SpatialFilter" })
            .length > 0
        ) {
          spatialFilter = this.searchModel
            .get("filters")
            .where({ type: "SpatialFilter" })[0];
        } else {
          spatialFilter = new SpatialFilter();
        }

        // Store references
        mapRef = this.map;
        viewRef = this;

        // Listen to idle events on the map (at rest), and render content as
        // needed
        google.maps.event.addListener(mapRef, "idle", function () {
          // Remove all markers from the map
          for (var i = 0; i < viewRef.resultMarkers.length; i++) {
            viewRef.resultMarkers[i].setMap(null);
          }
          viewRef.resultMarkers = new Array();

          // Check if the user has interacted with the map just now, and if so,
          // we want to alter the geohash filter (changing the geohash values or
          // resetting it completely)
          var alterGeohashFilter =
            viewRef.allowSearch || viewRef.hasZoomed || viewRef.hasDragged;
          if (!alterGeohashFilter) {
            return;
          }

          // Determine if the map needs to be recentered. The map only needs to
          // be recentered if it is not at the default lat,long center point AND
          // it is not zoomed in or dragged to a new center point
          var setGeohashFilter =
            viewRef.hasZoomed && viewRef.isMapFilterEnabled();

          // If we are using the geohash filter defined by this map, then apply
          // the filter and trigger a new search
          if (setGeohashFilter) {
            // Get the Google map bounding box
            boundingBox = mapRef.getBounds();

            // Set the search model's spatial filter properties Encode the
            // Google Map bounding box into geohash
            if (typeof boundingBox !== "undefined") {
              north = boundingBox.getNorthEast().lat();
              west = boundingBox.getSouthWest().lng();
              south = boundingBox.getSouthWest().lat();
              east = boundingBox.getNorthEast().lng();
            }

            // Save the center position and zoom level of the map
            viewRef.mapModel.get("mapOptions").center = mapRef.getCenter();
            viewRef.mapModel.get("mapOptions").zoom = mapRef.getZoom();

            // Determine the precision of geohashes to search for
            zoom = mapRef.getZoom();

            precision = viewRef.mapModel.getSearchPrecision(zoom);

            // Get all the geohash tiles contained in the map bounds
            if (south && west && north && east && precision) {
              geohashBBoxes = nGeohash.bboxes(
                south,
                west,
                north,
                east,
                precision
              );
            }

            // Save our geohash search settings
            spatialFilter.set({
              geohashes: geohashBBoxes,
              geohashLevel: precision,
              north: north,
              west: west,
              south: south,
              east: east,
            });

            // Add the spatial filter to the filters collection if enabled
            if (viewRef.searchModel.get("useGeohash")) {
              viewRef.searchModel.get("filters").add(spatialFilter);

              if (viewRef.filterGroupsView && spatialFilter) {
                viewRef.filterGroupsView.addCustomAppliedFilter(spatialFilter);

                // When the custom spatial filter is removed in the UI, toggle
                // the map filter
                viewRef.listenTo(
                  viewRef.filterGroupsView,
                  "customAppliedFilterRemoved",
                  function (removedFilter) {
                    if (removedFilter.type == "SpatialFilter") {
                      // Uncheck the map filter on the map itself
                      viewRef.$(".toggle-map-filter").prop("checked", false);
                      viewRef.toggleMapFilter();
                    }
                  }
                );
              }
            }
          } else {
            // Reset the map filter
            viewRef.resetMap();

            // Start back at page 0
            MetacatUI.appModel.set("page", 0);

            // Mark the view as ready to start a search
            viewRef.ready = true;

            // Trigger a new search
            viewRef.triggerSearch();

            viewRef.allowSearch = false;

            return;
          }
        });

        google.maps.event.addListener(mapRef, "zoom_changed", function () {
          // If the map is zoomed in further than the default zoom level, than
          // we want to mark the map as zoomed in
          if (viewRef.map.getZoom() > defaultZoom) {
            viewRef.hasZoomed = true;
          }
          // If we are at the default zoom level or higher, than do not mark the
          // map as zoomed in
          else {
            viewRef.hasZoomed = false;
          }
        });

        google.maps.event.addListener(mapRef, "dragend", function () {
          viewRef.hasDragged = true;
        });
      },
    }
  );
  return DataCatalogViewWithFilters;
});
