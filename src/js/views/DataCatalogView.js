define([
  "jquery",
  "underscore",
  "backbone",
  "collections/SolrResults",
  "models/Search",
  "models/MetricsModel",
  "common/Utilities",
  "views/SearchResultView",
  "views/searchSelect/BioontologySelectView",
  "text!templates/search.html",
  "text!templates/statCounts.html",
  "text!templates/pager.html",
  "text!templates/mainContent.html",
  "text!templates/currentFilter.html",
  "text!templates/loading.html",
  "gmaps",
  "nGeohash",
], (
  $,
  _,
  Backbone,
  SearchResults,
  SearchModel,
  MetricsModel,
  Utilities,
  SearchResultView,
  BioontologySelectView,
  CatalogTemplate,
  CountTemplate,
  PagerTemplate,
  MainContentTemplate,
  CurrentFilterTemplate,
  LoadingTemplate,
  gmaps,
  nGeohash,
) => {
  "use strict";

  /**
   * @class DataCatalogView
   * @classcategory Views
   * @augments Backbone.View
   * @class
   * @deprecated
   * @description This view is deprecated and will eventually be removed in a future version (likely 3.0.0)
   */
  const DataCatalogView = Backbone.View.extend(
    /** @lends DataCatalogView.prototype */ {
      el: "#Content",

      isSubView: false,
      filters: true, // Turn on/off the filters in this view

      /**
       * If true, the view height will be adjusted to fit the height of the window
       * If false, the view height will be fixed via CSS
       * @type {boolean}
       */
      fixedHeight: false,

      // The default global models for searching
      searchModel: null,
      searchResults: null,
      statsModel: null,
      mapModel: null,

      /**
       * The templates for this view
       * @type {Underscore.template}
       */
      template: _.template(CatalogTemplate),
      statsTemplate: _.template(CountTemplate),
      pagerTemplate: _.template(PagerTemplate),
      mainContentTemplate: _.template(MainContentTemplate),
      currentFilterTemplate: _.template(CurrentFilterTemplate),
      loadingTemplate: _.template(LoadingTemplate),
      metricStatTemplate: _.template(
        "<span class='metric-icon'> <i class='icon" +
          " <%=metricIcon%>'></i> </span>" +
          "<span class='metric-value'> <i class='icon metric-icon'>" +
          "</i> </span>",
      ),

      // Search mode
      mode: "map",

      // Map settings and storage
      map: null,
      ready: false,
      allowSearch: true,
      hasZoomed: false,
      hasDragged: false,
      markers: {},
      tiles: [],
      tileCounts: [],

      /**
       * The general error message to show as a title in the error box when there
       * is an error fetching results from solr
       * @type {string}
       * @default "Something went wrong while getting the list of datasets"
       * @since 2.15.0
       */
      solrErrorTitle: "Something went wrong while getting the list of datasets",

      /**
       * The user-friendly text to show when a solr request gives a status 500
       * error. If none is provided, then the error message that is returned from
       * solr will be displayed.
       * @type {string}
       * @since 2.15.0
       */
      solrError500Message: null,

      // Contains the geohashes for all the markers on the map (if turned on in the Map model)
      markerGeohashes: [],
      // Contains all the info windows for all the markers on the map (if turned on in the Map model)
      markerInfoWindows: [],
      // Contains all the info windows for each document in the search result list - to display on hover
      tileInfoWindows: [],
      // Contains all the currently visible markers on the map
      resultMarkers: [],
      // The geohash value for each tile drawn on the map
      tileGeohashes: [],
      mapFilterToggle: ".toggle-map-filter",

      // Delegated events for creating new items, and clearing completed ones.
      events: {
        "click #results_prev": "prevpage",
        "click #results_next": "nextpage",
        "click #results_prev_bottom": "prevpage",
        "click #results_next_bottom": "nextpage",
        "click .pagerLink": "navigateToPage",
        "click .filter.btn": "updateTextFilters",
        "keypress input[type='text'].filter": "triggerOnEnter",
        "focus input[type='text'].filter": "getAutocompletes",
        "change #sortOrder": "triggerSearch",
        "change #min_year": "updateYearRange",
        "change #max_year": "updateYearRange",
        "click #publish_year": "updateYearRange",
        "click #data_year": "updateYearRange",
        "click .remove-filter": "removeFilter",
        "click input[type='checkbox'].filter": "updateBooleanFilters",
        "click #clear-all": "resetFilters",
        "click .remove-addtl-criteria": "removeAdditionalCriteria",
        "click .collapse-me": "collapse",
        "click .filter-contain .expand-collapse-control":
          "toggleFilterCollapse",
        "click #toggle-map": "toggleMapMode",
        "click .toggle-map": "toggleMapMode",
        "click .toggle-list": "toggleList",
        "click .toggle-map-filter": "toggleMapFilter",
        "mouseover .open-marker": "showResultOnMap",
        "mouseout .open-marker": "hideResultOnMap",
        "mouseover .prevent-popover-runoff": "preventPopoverRunoff",
      },

      initialize(options) {
        const view = this;

        // Get all the options and apply them to this view
        if (options) {
          const optionKeys = Object.keys(options);
          _.each(optionKeys, (key, i) => {
            view[key] = options[key];
          });
        }
      },

      // Render the main view and/or re-render subviews. Don't call .html() here
      // so we don't lose state, rather use .setElement(). Delegate rendering
      // and event handling to sub views
      render() {
        // Use the global models if there are no other models specified at time of render
        if (
          MetacatUI.appModel.get("searchHistory").length > 0 &&
          (!this.searchModel || Object.keys(this.searchModel).length == 0)
        ) {
          const lastSearchModels = _.last(
            MetacatUI.appModel.get("searchHistory"),
          );

          if (lastSearchModels) {
            if (lastSearchModels.search) {
              this.searchModel = lastSearchModels.search.clone();
            }

            if (lastSearchModels.map) {
              this.mapModel = lastSearchModels.map.clone();
            }
          }
        } else if (
          typeof MetacatUI.appSearchModel !== "undefined" &&
          (!this.searchModel || Object.keys(this.searchModel).length == 0)
        ) {
          this.searchModel = MetacatUI.appSearchModel;
          this.mapModel = MetacatUI.mapModel;
          this.statsModel = MetacatUI.statsModel;
        }

        if (!this.mapModel && gmaps) {
          this.mapModel = MetacatUI.mapModel;
        }

        if (
          (typeof this.searchResults === "undefined" ||
            !this.searchResults ||
            Object.keys(this.searchResults).length == 0) &&
          MetacatUI.appSearchResults &&
          Object.keys(MetacatUI.appSearchResults).length > 0
        ) {
          this.searchResults = MetacatUI.appSearchResults;

          if (!this.statsModel) {
            this.statsModel = MetacatUI.statsModel;
          }

          if (!this.mapModel) {
            this.mapModel = MetacatUI.mapModel;
          }
        }

        // Get the search mode - either "map" or "list"
        if (typeof this.mode === "undefined" || !this.mode) {
          this.mode = MetacatUI.appModel.get("searchMode");
          if (typeof this.mode === "undefined" || !this.mode) {
            this.mode = "map";
          }
          MetacatUI.appModel.set("searchMode", this.mode);
        }
        if ($(window).outerWidth() <= 600) {
          this.mode = "list";
          MetacatUI.appModel.set("searchMode", "list");
          gmaps = null;
        }

        if (!this.isSubView) {
          MetacatUI.appModel.set("headerType", "default");
          $("body").addClass("DataCatalog");
        } else {
          this.$el.addClass("DataCatalog");
        }

        // Populate the search template with some model attributes
        const loadingHTML = this.loadingTemplate({
          msg: "Retrieving member nodes...",
        });

        const templateVars = {
          gmaps,
          mode: MetacatUI.appModel.get("searchMode"),
          useMapBounds: this.searchModel.get("useGeohash"),
          username: MetacatUI.appUserModel.get("username"),
          isMySearch:
            _.indexOf(
              this.searchModel.get("username"),
              MetacatUI.appUserModel.get("username"),
            ) > -1,
          loading: loadingHTML,
          searchModelRef: this.searchModel,
          searchResultsRef: this.searchResults,
          dataSourceTitle:
            MetacatUI.theme == "dataone" ? "Member Node" : "Data source",
        };
        const cel = this.template(
          _.extend(this.searchModel.toJSON(), templateVars),
        );

        this.$el.html(cel);

        // Hide the filters that are disabled in the AppModel settings
        _.each(
          this.$(".filter-contain[data-category]"),
          (filterEl) => {
            if (
              !_.contains(
                MetacatUI.appModel.get("defaultSearchFilters"),
                $(filterEl).attr("data-category"),
              )
            ) {
              $(filterEl).hide();
            }
          },
          this,
        );

        // Store some references to key views that we use repeatedly
        this.$resultsview = this.$("#results-view");
        this.$results = this.$("#results");

        // Update stats
        this.updateStats();

        // Render the Google Map
        this.renderMap();

        // Initialize the tooltips
        const tooltips = $(".tooltip-this");

        // Find the tooltips that are on filter labels - add a slight delay to those
        const groupedTooltips = _.groupBy(
          tooltips,
          (t) =>
            ($(t).prop("tagName") == "LABEL" ||
              $(t).parent().prop("tagName") == "LABEL") &&
            $(t).parents(".filter-container").length > 0,
        );
        const forFilterLabel = true;
        const forOtherElements = false;

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

        // Collapse the filters
        this.toggleFilterCollapse();

        // Iterate through each search model text attribute and show UI filter for each
        const categories = [
          "all",
          "attribute",
          "creator",
          "id",
          "taxon",
          "spatial",
          "additionalCriteria",
          "annotation",
          "isPrivate",
        ];
        let thisTerm = null;

        for (let i = 0; i < categories.length; i++) {
          thisTerm = this.searchModel.get(categories[i]);

          if (thisTerm === undefined || thisTerm === null) break;

          for (let x = 0; x < thisTerm.length; x++) {
            this.showFilter(categories[i], thisTerm[x]);
          }
        }

        // List the Member Node filters
        const view = this;
        _.each(
          _.contains(
            MetacatUI.appModel.get("defaultSearchFilters"),
            "dataSource",
          ),
          (source, i) => {
            view.showFilter("dataSource", source);
          },
        );

        // Add the custom query under the "Anything" filter
        if (this.searchModel.get("customQuery")) {
          this.showFilter("all", this.searchModel.get("customQuery"));
        }

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

        // List data sources
        this.listDataSources();
        this.listenTo(
          MetacatUI.nodeModel,
          "change:members",
          this.listDataSources,
        );

        // listen to the MetacatUI.appModel for the search trigger
        this.listenTo(MetacatUI.appModel, "search", this.getResults);

        this.listenTo(
          MetacatUI.appUserModel,
          "change:loggedIn",
          this.triggerSearch,
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

        MetacatUI.appView.schemaOrg.setSchema("DataCatalog");

        return this;
      },

      /**
       * addAnnotationFilter - Add the annotation filter to the view
       */
      addAnnotationFilter() {
        const view = this;
        if (!MetacatUI.appModel.get("bioportalAPIKey")) return;
        const containerSelector =
          "[data-category='annotation'] .expand-collapse-control + .filter-input-contain";
        const container = this.$el.find(containerSelector);
        if (!container) return;
        const annotationFilter = new BioontologySelectView({
          inputLabel: "",
          compact: true,
        }).render();
        container.append(annotationFilter.el);
        const bioModel = annotationFilter.model;
        this.stopListening(bioModel, "change:selected");
        this.listenTo(bioModel, "change:selected", (model, selected) => {
          const value = selected?.[0] || "";
          const option = model.get("options").getOptionByLabelOrValue(value);
          const filterLabel = option?.get("label") || "";
          const mockEvent = { target: annotationFilter.el };
          const item = { value, filterLabel };
          view.updateTextFilters(mockEvent, item);
        });
      },

      /*
       * Sets the height on elements in the main content area to fill up the entire area minus header and footer
       */
      setAutoHeight() {
        // If we are in list mode, don't determine the height of any elements because we are not "full screen"
        if (
          MetacatUI.appModel.get("searchMode") == "list" ||
          this.fixedHeight
        ) {
          MetacatUI.appView.$(".auto-height").height("auto");
          return;
        }

        // Get the heights of the header, navbar, and footer
        var otherHeight = 0;
        $(".auto-height-member").each((i, el) => {
          if ($(el).css("display") != "none") {
            otherHeight += $(el).outerHeight(true);
          }
        });

        // Get the remaining height left based on the window size
        let remainingHeight = $(window).outerHeight(true) - otherHeight;
        if (remainingHeight < 0)
          remainingHeight = $(window).outerHeight(true) || 300;
        else if (remainingHeight <= 120)
          remainingHeight =
            $(window).outerHeight(true) - remainingHeight || 300;

        // Adjust all elements with the .auto-height class
        $(".auto-height").height(remainingHeight);

        if (
          $("#map-container.auto-height").length > 0 &&
          $("#map-canvas").length > 0
        ) {
          var otherHeight = 0;
          $("#map-container.auto-height")
            .children()
            .each((i, el) => {
              if ($(el).attr("id") != "map-canvas") {
                otherHeight += $(el).outerHeight(true);
              }
            });
          const newMapHeight = remainingHeight - otherHeight;
          if (newMapHeight > 100) {
            $("#map-canvas").height(remainingHeight - otherHeight);
          }
        }

        // Trigger a resize for the map so that all of the map background images are loaded
        if (gmaps && this.mapModel && this.mapModel.get("map")) {
          google.maps.event.trigger(this.mapModel.get("map"), "resize");
        }
      },

      /*
       * ==================================================================================================
       *                                         PERFORMING SEARCH
       * ==================================================================================================
       */
      triggerSearch() {
        // Set the sort order
        const sortOrder = $("#sortOrder").val();
        if (sortOrder) {
          this.searchModel.set("sortOrder", sortOrder);
        }

        // Trigger a search to load the results
        MetacatUI.appModel.trigger("search");

        if (!this.isSubView) {
          // make sure the browser knows where we are
          const route = Backbone.history.fragment;
          if (route.indexOf("data") < 0) {
            MetacatUI.uiRouter.navigate("data", {
              trigger: false,
              replace: true,
            });
          } else {
            MetacatUI.uiRouter.navigate(route);
          }
        }

        // ...but don't want to follow links
        return false;
      },

      triggerOnEnter(e) {
        if (e.keyCode != 13) return;

        // Update the filters
        this.updateTextFilters(e);
      },

      /**
       * getResults gets all the current search filters from the searchModel, creates a Solr query, and runs that query.
       * @param {number} page - The page of search results to get results for
       */
      getResults(page) {
        // Set the sort order based on user choice
        const sortOrder = this.searchModel.get("sortOrder");
        if (sortOrder) {
          this.searchResults.setSort(sortOrder);
        }

        // Specify which fields to retrieve
        let fields = "";
        fields += "id,";
        fields += "seriesId,";
        fields += "title,";
        fields += "origin,";
        fields += "pubDate,";
        fields += "dateUploaded,";
        fields += "abstract,";
        fields += "resourceMap,";
        fields += "beginDate,";
        fields += "endDate,";
        fields += "read_count_i,";
        fields += "geohash_9,";
        fields += "datasource,";
        fields += "isPublic,";
        fields += "documents,";
        fields += "sem_annotation,";
        // Add spatial fields if the map is present
        if (gmaps) {
          fields += "northBoundCoord,";
          fields += "southBoundCoord,";
          fields += "eastBoundCoord,";
          fields += "westBoundCoord";
        }
        // Strip the last trailing comma if needed
        if (fields[fields.length - 1] === ",") {
          fields = fields.substr(0, fields.length - 1);
        }
        this.searchResults.setfields(fields);

        // Get the query
        const query = this.searchModel.getQuery();

        // Specify which facets to retrieve
        if (gmaps && this.map) {
          // If we have Google Maps enabled
          const geohashLevel = `geohash_${this.mapModel.determineGeohashLevel(this.map.zoom)}`;
          this.searchResults.facet.push(geohashLevel);
        }

        // Run the query
        this.searchResults.setQuery(query);

        // Get the page number
        if (this.isSubView) {
          var page = 0;
        } else {
          var page = MetacatUI.appModel.get("page");
          if (page == null) {
            page = 0;
          }
        }
        this.searchResults.start = page * this.searchResults.rows;

        // Show or hide the reset filters button
        this.toggleClearButton();

        // go to the page
        this.showPage(page);

        // don't want to follow links
        return false;
      },

      /*
       * After the search results have been returned,
       * check if any of them are derived data or have derivations
       */
      checkForProv() {
        let maps = [];
        let hasSources = [];
        let hasDerivations = [];
        const mainSearchResults = this.searchResults;

        // Get a list of all the resource map IDs from the SolrResults collection
        maps = this.searchResults.pluck("resourceMap");
        maps = _.compact(_.flatten(maps));

        // Create a new Search model with a search that finds all members of these packages/resource maps
        const provSearchModel = new SearchModel({
          formatType: [
            {
              value: "DATA",
              label: "data",
              description: null,
            },
          ],
          exclude: [],
          resourceMap: maps,
        });

        // Create a new Solr Results model to store the results of this supplemental query
        const provSearchResults = new SearchResults(null, {
          query: provSearchModel.getQuery(),
          searchLogs: false,
          rows: 150,
          fields: `${provSearchModel.getProvFlList()},id,resourceMap`,
        });

        // Trigger a search on that Solr Results model
        this.listenTo(provSearchResults, "reset", (results) => {
          if (results.models.length == 0) return;

          // See if any of the results have a value for a prov field
          results.forEach((result) => {
            if (!result.getSources().length || !result.getDerivations()) return;
            _.each(result.get("resourceMap"), (rMapID) => {
              if (_.contains(maps, rMapID)) {
                const match = mainSearchResults.filter((mainSearchResult) =>
                  _.contains(mainSearchResult.get("resourceMap"), rMapID),
                );
                if (match && match.length && result.getSources().length > 0)
                  hasSources.push(match[0].get("id"));
                if (match && match.length && result.getDerivations().length > 0)
                  hasDerivations.push(match[0].get("id"));
              }
            });
          });

          // Filter out the duplicates
          hasSources = _.uniq(hasSources);
          hasDerivations = _.uniq(hasDerivations);

          // If they do, find their corresponding result row here and add
          // the prov icon (or just change the class to active)
          _.each(hasSources, (metadataID) => {
            const metadataDoc = mainSearchResults.findWhere({
              id: metadataID,
            });
            if (metadataDoc) {
              metadataDoc.set("prov_hasSources", true);
            }
          });
          _.each(hasDerivations, (metadataID) => {
            const metadataDoc = mainSearchResults.findWhere({
              id: metadataID,
            });
            if (metadataDoc) {
              metadataDoc.set("prov_hasDerivations", true);
            }
          });
        });
        provSearchResults.toPage(0);
      },

      cacheSearch() {
        MetacatUI.appModel.get("searchHistory").push({
          search: this.searchModel.clone(),
          map: this.mapModel ? this.mapModel.clone() : null,
        });
        MetacatUI.appModel.trigger("change:searchHistory");
      },

      /*
       * ==================================================================================================
       *                                             FILTERS
       * ==================================================================================================
       */
      updateCheckboxFilter(e, category, value) {
        if (!this.filters) return;

        const checkbox = e.target;
        const checked = $(checkbox).prop("checked");

        if (typeof category === "undefined")
          var category = $(checkbox).attr("data-category");
        if (typeof value === "undefined") var value = $(checkbox).attr("value");

        // If the user just unchecked the box, then remove this filter
        if (!checked) {
          this.searchModel.removeFromModel(category, value);
          this.hideFilter(category, value);
        }
        // If the user just checked the box, then add this filter
        else {
          const currentValue = this.searchModel.get(category);

          // Get the description
          let desc =
            $(checkbox).attr("data-description") || $(checkbox).attr("title");
          if (typeof desc === "undefined" || !desc) desc = "";
          // Get the label
          let labl = $(checkbox).attr("data-label");
          if (typeof labl === "undefined" || !labl) labl = "";

          // Make the filter object
          const filter = {
            description: desc,
            label: labl,
            value,
          };

          // If this filter category is an array, add this value to the array
          if (Array.isArray(currentValue)) {
            currentValue.push(filter);
            this.searchModel.set(category, currentValue);
            this.searchModel.trigger(`change:${category}`);
          } else {
            // If it isn't an array, then just update the model with a simple value
            this.searchModel.set(category, filter);
          }

          // Show the filter element
          this.showFilter(category, value, true, labl);

          // Show the reset button
          this.showClearButton();
        }

        // Route to page 1
        this.updatePageNumber(0);

        // Trigger a new search
        this.triggerSearch();
      },

      updateBooleanFilters(e) {
        if (!this.filters) return;

        // Get the category
        const checkbox = e.target;
        const category = $(checkbox).attr("data-category");
        const currentValue = this.searchModel.get(category);

        // If this filter is not enabled, exit this function
        if (
          !_.contains(MetacatUI.appModel.get("defaultSearchFilters"), category)
        ) {
          return false;
        }

        // The year filter is handled in a different way
        if (category == "pubYear" || category == "dataYear") return;

        // If the checkbox has a value, then update as a string value not boolean
        let value = $(checkbox).attr("value");
        if (value) {
          this.updateCheckboxFilter(e, category, value);
          return;
        }
        value = $(checkbox).prop("checked");

        this.searchModel.set(category, value);

        // Add the filter to the UI
        if (value) {
          this.showFilter(category, "", true);
        } else {
          // Remove the filter from the UI
          value = "";
          this.hideFilter(category, value);
        }

        // Show the reset button
        this.showClearButton();

        // Route to page 1
        this.updatePageNumber(0);

        // Trigger a new search
        this.triggerSearch();

        // Track this event
        MetacatUI.analytics?.trackEvent("search", `filter, ${category}`, value);
      },

      // Update the UI year slider and input values
      // Also update the model
      updateYearRange(e) {
        if (!this.filters) return;

        const viewRef = this;
        const userAction = !(typeof e === "undefined");
        const model = this.searchModel;
        const pubYearChecked = $("#publish_year").prop("checked");
        const dataYearChecked = $("#data_year").prop("checked");

        // If the year range slider has not been created yet
        if (!userAction && !$("#year-range").hasClass("ui-slider")) {
          var defaultMin =
            typeof this.searchModel.defaults === "function"
              ? this.searchModel.defaults().yearMin
              : 1800;
          var defaultMax =
            typeof this.searchModel.defaults === "function"
              ? this.searchModel.defaults().yearMax
              : new Date().getUTCFullYear();

          // jQueryUI slider
          $("#year-range").slider({
            range: true,
            disabled: false,
            min: defaultMin, // sets the minimum on the UI slider on initialization
            max: defaultMax, // sets the maximum on the UI slider on initialization
            values: [
              this.searchModel.get("yearMin"),
              this.searchModel.get("yearMax"),
            ], // where the left and right slider handles are
            stop(event, ui) {
              // When the slider is changed, update the input values
              $("#min_year").val(ui.values[0]);
              $("#max_year").val(ui.values[1]);

              // Also update the search model
              model.set("yearMin", ui.values[0]);
              model.set("yearMax", ui.values[1]);

              // If neither the publish year or data coverage year are checked
              if (
                !$("#publish_year").prop("checked") &&
                !$("#data_year").prop("checked")
              ) {
                // We want to check the data coverage year on the user's behalf
                $("#data_year").prop("checked", "true");

                // And update the search model
                model.set("dataYear", true);
              }

              // Add the filter elements
              if ($("#publish_year").prop("checked")) {
                viewRef.showFilter(
                  $("#publish_year").attr("data-category"),
                  true,
                  false,
                  `${ui.values[0]} to ${ui.values[1]}`,
                  {
                    replace: true,
                  },
                );
              }
              if ($("#data_year").prop("checked")) {
                viewRef.showFilter(
                  $("#data_year").attr("data-category"),
                  true,
                  false,
                  `${ui.values[0]} to ${ui.values[1]}`,
                  {
                    replace: true,
                  },
                );
              }

              // Route to page 1
              viewRef.updatePageNumber(0);

              // Trigger a new search
              viewRef.triggerSearch();
            },
          });

          // Get the minimum and maximum years of this current search and use those as the min and max values in the slider
          this.statsModel.set("query", this.searchModel.getQuery());
          this.listenTo(this.statsModel, "change:firstBeginDate", function () {
            if (
              this.statsModel.get("firstBeginDate") == 0 ||
              !this.statsModel.get("firstBeginDate")
            ) {
              $("#year-range").slider({
                min: defaultMin,
              });
              return;
            }
            const year = new Date(
              this.statsModel.get("firstBeginDate"),
            ).getUTCFullYear();
            if (typeof year !== "undefined") {
              $("#min_year").val(year);
              $("#year-range").slider({
                values: [year, $("#max_year").val()],
              });

              // If the slider min is still at the default value, then update with the min value found at this search
              if ($("#year-range").slider("option", "min") == defaultMin) {
                $("#year-range").slider({
                  min: year,
                });
              }

              // Add the filter elements if this is set
              if (viewRef.searchModel.get("pubYear")) {
                viewRef.showFilter(
                  "pubYear",
                  true,
                  false,
                  `${$("#min_year").val()} to ${$("#max_year").val()}`,
                  {
                    replace: true,
                  },
                );
              }
              if (viewRef.searchModel.get("dataYear")) {
                viewRef.showFilter(
                  "dataYear",
                  true,
                  false,
                  `${$("#min_year").val()} to ${$("#max_year").val()}`,
                  {
                    replace: true,
                  },
                );
              }
            }
          });
          // Only when the first begin date is retrieved, set the slider min and max values
          this.listenTo(this.statsModel, "change:lastEndDate", function () {
            if (
              this.statsModel.get("lastEndDate") == 0 ||
              !this.statsModel.get("lastEndDate")
            ) {
              $("#year-range").slider({
                max: defaultMax,
              });
              return;
            }
            const year = new Date(
              this.statsModel.get("lastEndDate"),
            ).getUTCFullYear();
            if (typeof year !== "undefined") {
              $("#max_year").val(year);
              $("#year-range").slider({
                values: [$("#min_year").val(), year],
              });

              // If the slider max is still at the default value, then update with the max value found at this search
              if ($("#year-range").slider("option", "max") == defaultMax) {
                $("#year-range").slider({
                  max: year,
                });
              }

              // Add the filter elements if this is set
              if (viewRef.searchModel.get("pubYear")) {
                viewRef.showFilter(
                  "pubYear",
                  true,
                  false,
                  `${$("#min_year").val()} to ${$("#max_year").val()}`,
                  {
                    replace: true,
                  },
                );
              }
              if (viewRef.searchModel.get("dataYear")) {
                viewRef.showFilter(
                  "dataYear",
                  true,
                  false,
                  `${$("#min_year").val()} to ${$("#max_year").val()}`,
                  {
                    replace: true,
                  },
                );
              }
            }
          });
          this.statsModel.getFirstBeginDate();
          this.statsModel.getLastEndDate();
        }
        // If the year slider has been created and the user initiated a new search using other filters
        else if (
          !userAction &&
          !this.searchModel.get("dataYear") &&
          !this.searchModel.get("pubYear")
        ) {
          // Reset the min and max year based on this search
          this.statsModel.set("query", this.searchModel.getQuery());
          this.statsModel.getFirstBeginDate();
          this.statsModel.getLastEndDate();
        }
        // If either of the year type selectors is what brought us here, then determine whether the user
        // is completely removing both (reset both year filters) or just one (remove just that one filter)
        else if (userAction) {
          // When both year types were unchecked, assume user wants to reset the year filter
          if (
            ($(e.target).attr("id") == "data_year" ||
              $(e.target).attr("id") == "publish_year") &&
            !pubYearChecked &&
            !dataYearChecked
          ) {
            // Reset the search model
            this.searchModel.set("yearMin", defaultMin);
            this.searchModel.set("yearMax", defaultMax);
            this.searchModel.set("dataYear", false);
            this.searchModel.set("pubYear", false);

            // Reset the min and max year based on this search
            this.statsModel.set("query", this.searchModel.getQuery());
            this.statsModel.getFirstBeginDate();
            this.statsModel.getLastEndDate();

            // Slide the handles back to the defaults
            $("#year-range").slider("values", [defaultMin, defaultMax]);

            // Hide the filters
            this.hideFilter("dataYear");
            this.hideFilter("pubYear");
          }
          // If either of the year inputs have changed or if just one of the year types were unchecked
          else {
            const minVal = $("#min_year").val();
            const maxVal = $("#max_year").val();

            // Update the search model to match what is in the text inputs
            this.searchModel.set("yearMin", minVal);
            this.searchModel.set("yearMax", maxVal);
            this.searchModel.set("dataYear", dataYearChecked);
            this.searchModel.set("pubYear", pubYearChecked);

            // If neither the publish year or data coverage year are checked
            if (!pubYearChecked && !dataYearChecked) {
              // We want to check the data coverage year on the user's behalf
              $("#data_year").prop("checked", "true");

              // And update the search model
              model.set("dataYear", true);

              // Add the filter elements
              this.showFilter(
                $("#data_year").attr("data-category"),
                true,
                true,
                `${minVal} to ${maxVal}`,
                {
                  replace: true,
                },
              );

              // Track this event
              MetacatUI.analytics?.trackEvent(
                "search",
                "filter, Data Year",
                `${minVal} to ${maxVal}`,
              );
            } else {
              // Add the filter elements
              if (pubYearChecked) {
                this.showFilter(
                  $("#publish_year").attr("data-category"),
                  true,
                  true,
                  `${minVal} to ${maxVal}`,
                  {
                    replace: true,
                  },
                );

                // Track this event
                MetacatUI.analytics?.trackEvent(
                  "search",
                  "filter, Publication Year",
                  `${minVal} to ${maxVal}`,
                );
              } else {
                this.hideFilter($("#publish_year").attr("data-category"), true);
              }

              if (dataYearChecked) {
                this.showFilter(
                  $("#data_year").attr("data-category"),
                  true,
                  true,
                  `${minVal} to ${maxVal}`,
                  {
                    replace: true,
                  },
                );

                // Track this event
                MetacatUI.analytics?.trackEvent(
                  "search",
                  "filter, Data Year",
                  `${minVal} to ${maxVal}`,
                );
              } else {
                this.hideFilter($("#data_year").attr("data-category"), true);
              }
            }
          }

          // Route to page 1
          this.updatePageNumber(0);

          // Trigger a new search
          this.triggerSearch();
        }
      },

      updateTextFilters(e, item) {
        if (!this.filters) return;

        // Get the search/filter category
        let category = $(e.target).attr("data-category");

        // Try the parent elements if not found
        if (!category) {
          const parents = $(e.target)
            .parents()
            .each(function () {
              category = $(this).attr("data-category");
              if (category) {
                return false;
              }
            });
        }

        if (!category) {
          return false;
        }

        // Get the input element
        const input = this.$el.find(`#${category}_input`);

        // Get the value of the associated input
        const term = !item || !item.value ? input.val() : item.value;
        const label = !item || !item.filterLabel ? null : item.filterLabel;
        const filterDesc = !item || !item.desc ? null : item.desc;

        // Check that something was actually entered
        if (term == "" || term == " ") {
          return false;
        }

        // Close the autocomplete box
        if (e.type == "hoverautocompleteselect") {
          $(input).hoverAutocomplete("close");
        } else if ($(input).data("ui-autocomplete") != undefined) {
          // If the autocomplete has been initialized, then close it
          $(input).autocomplete("close");
        }

        // Get the current searchModel array for this category
        const filtersArray = _.clone(this.searchModel.get(category));

        if (typeof filtersArray === "undefined") {
          console.error(
            `The filter category '${category}' does not exist in the Search model. Not sending this search term.`,
          );
          return false;
        }

        // Check if this entry is a duplicate
        const duplicate = (function () {
          for (let i = 0; i < filtersArray.length; i++) {
            if (filtersArray[i].value === term) {
              return true;
            }
          }
        })();

        if (duplicate) {
          // Display a quick message
          if ($(`#duplicate-${category}-alert`).length <= 0) {
            $(`#current-${category}-filters`).prepend(
              "<div class='alert alert-block' id='duplicate-' + category + '-alert'>" +
                "You are already using that filter" +
                "</div>",
            );

            $(`#duplicate-${category}-alert`)
              .delay(2000)
              .fadeOut(500, function () {
                this.remove();
              });
          }

          return false;
        }

        // Add the new entry to the array of current filters
        const filter = {
          value: term,
          filterLabel: label,
          label,
          description: filterDesc,
        };
        filtersArray.push(filter);

        // Replace the current array with the new one in the search model
        this.searchModel.set(category, filtersArray);

        // Show the UI filter
        this.showFilter(category, filter, false, label);

        // Clear the input
        input.val("");

        // Route to page 1
        this.updatePageNumber(0);

        // Trigger a new search
        this.triggerSearch();

        // Track this event
        MetacatUI.analytics?.trackEvent("search", `filter, ${category}`, term);
      },

      // Removes a specific filter term from the searchModel
      removeFilter(e) {
        // Get the parent element that stores the filter term
        const filterNode = $(e.target).parent();

        // Find this filter's category and value
        const category =
          filterNode.attr("data-category") ||
          filterNode.parent().attr("data-category");
        const value = $(filterNode).attr("data-term");

        // Remove this filter from the searchModel
        this.searchModel.removeFromModel(category, value);

        // Hide the filter from the UI
        this.hideFilter(category, value);

        // If there is an associated checkbox with this filter, uncheck it
        let assocCheckbox;
        const checkboxes = this.$(
          `input[type='checkbox'][data-category='${category}']`,
        );

        // If there are more than one checkboxes in this category, match by value
        if (checkboxes.length > 1) {
          assocCheckbox = _.find(
            checkboxes,
            (checkbox) => $(checkbox).val() == value,
          );
        }
        // If there is only one checkbox in this category, default to it
        else if (checkboxes.length == 1) {
          assocCheckbox = checkboxes[0];
        }

        // If there is an associated checkbox, uncheck it
        if (assocCheckbox) {
          // Uncheck it
          $(assocCheckbox).prop("checked", false);
        }

        // Route to page 1
        this.updatePageNumber(0);

        // Trigger a new search
        this.triggerSearch();
      },

      // Clear all the currently applied filters
      resetFilters() {
        const viewRef = this;

        this.allowSearch = true;

        // Hide all the filters in the UI
        $.each(this.$(".current-filter"), function () {
          viewRef.hideEl(this);
        });

        // Hide the clear button
        this.hideClearButton();

        // Then reset the model
        this.searchModel.clear();

        // Reset the map model
        if (this.mapModel) {
          this.mapModel.clear();
        }

        // Reset the year slider handles
        $("#year-range").slider("values", [
          this.searchModel.get("yearMin"),
          this.searchModel.get("yearMax"),
        ]);
        // and the year inputs
        $("#min_year").val(this.searchModel.get("yearMin"));
        $("#max_year").val(this.searchModel.get("yearMax"));

        // Reset the checkboxes
        $("#includes_data").prop("checked", this.searchModel.get("documents"));
        $("#data_year").prop("checked", this.searchModel.get("dataYear"));
        $("#publish_year").prop("checked", this.searchModel.get("pubYear"));
        $("#is_private_data").prop(
          "checked",
          this.searchModel.get("isPrivate"),
        );
        this.listDataSources();

        // Zoom out the Google Map
        this.resetMap();
        this.renderMap();

        // Route to page 1
        this.updatePageNumber(0);

        // Trigger a new search
        this.triggerSearch();
      },

      hideEl(element) {
        // Fade out and remove the element
        $(element).fadeOut("slow", () => {
          $(element).remove();
        });
      },

      // Removes a specified filter node from the DOM
      hideFilter(category, value) {
        if (!this.filters) return;

        if (typeof value === "undefined") {
          var filterNode = this.$(
            `.current-filters[data-category='${category}']`,
          ).children(".current-filter");
        } else {
          var filterNode = this.$(
            `.current-filters[data-category='${category}']`,
          ).children(`[data-term='${value}']`);
        }

        // Try finding it a different way
        if (!filterNode || !filterNode.length) {
          filterNode = this.$(`.current-filter[data-category='${category}']`);
        }

        // Remove the filter node from the DOM
        this.hideEl(filterNode);
      },

      // Adds a specified filter node to the DOM
      showFilter(category, term, checkForDuplicates, label, options) {
        if (!this.filters) return;

        const viewRef = this;

        if (typeof term === "undefined") return false;

        // Get the element to add the UI filter node to
        // The pattern is #current-<category>-filters
        const filterContainer = this.$el.find(`#current-${category}-filters`);

        // Allow the option to only display this exact filter category and term once to the DOM
        // Helpful when adding a filter that is not stored in the search model (for display only)
        if (checkForDuplicates) {
          let duplicate = false;

          // Get the current terms from the DOM and check against the new term
          filterContainer.children().each(function () {
            if ($(this).attr("data-term") == term) {
              duplicate = true;
            }
          });

          // If there is a duplicate, exit without adding it
          if (duplicate) {
            return;
          }
        }

        let value = null;
        let desc = null;

        // See if this filter is an object and extract the filter attributes
        if (typeof term === "object") {
          if (typeof term.description !== "undefined") {
            desc = term.description;
          }
          if (typeof term.filterLabel !== "undefined") {
            label = term.filterLabel;
          } else if (typeof term.label !== "undefined" && term.label) {
            label = term.label;
          } else {
            label = null;
          }
          if (typeof term.value !== "undefined") {
            value = term.value;
          }
        } else {
          value = term;

          // Find the filter label
          if (typeof label === "undefined" || !label) {
            // Use the filter value for the label, sans any leading # character
            if (value.indexOf("#") > 0) {
              label = value.substring(value.indexOf("#"));
            }
          }

          desc = label;
        }

        let categoryLabel = this.searchModel.fieldLabels[category];
        if (
          typeof categoryLabel === "undefined" &&
          category == "additionalCriteria"
        )
          categoryLabel = "";
        if (typeof categoryLabel === "undefined") categoryLabel = category;

        // Add a filter node to the DOM
        const filterEl = viewRef.currentFilterTemplate({
          category: Utilities.encodeHTML(categoryLabel),
          value: Utilities.encodeHTML(value),
          label: Utilities.encodeHTML(label),
          description: Utilities.encodeHTML(desc),
        });

        // Add the filter to the page - either replace or tack on
        if (options && options.replace) {
          const currentFilter = filterContainer.find(".current-filter");
          if (currentFilter.length > 0) {
            currentFilter.replaceWith(filterEl);
          } else {
            filterContainer.prepend(filterEl);
          }
        } else {
          filterContainer.prepend(filterEl);
        }

        // Tooltips and Popovers
        $(filterEl).tooltip({
          delay: {
            show: 800,
          },
        });
      },

      /*
       * Get the member node list from the model and list the members in the filter list
       */
      listDataSources() {
        if (!this.filters) return;

        if (MetacatUI.nodeModel.get("members").length < 1) return;

        // Get the member nodes
        const members = _.sortBy(MetacatUI.nodeModel.get("members"), (m) => {
          if (m.name) {
            return m.name.toLowerCase();
          }
          return "";
        });
        const filteredMembers = _.reject(
          members,
          (m) => m.status != "operational",
        );

        // Get the current search filters for data source
        const currentFilters = this.searchModel.get("dataSource");

        // Create an HTML list
        const listMax = 4;
        const numHidden = filteredMembers.length - listMax;
        const list = $(document.createElement("ul")).addClass("checkbox-list");

        // Add a checkbox and label for each member node in the node model
        _.each(filteredMembers, (member, i) => {
          const listItem = document.createElement("li");
          const input = document.createElement("input");
          const label = document.createElement("label");

          // If this member node is already a data source filter, then the checkbox is checked
          const checked = !!_.findWhere(currentFilters, {
            value: member.identifier,
          });

          // Create a textual label for this data source
          $(label)
            .addClass("ellipsis")
            .attr("for", member.identifier)
            .html(member.name);

          // Create a checkbox for this data source
          $(input)
            .addClass("filter")
            .attr("type", "checkbox")
            .attr("data-category", "dataSource")
            .attr("id", member.identifier)
            .attr("name", "dataSource")
            .attr("value", member.identifier)
            .attr("data-label", member.name)
            .attr("data-description", member.description);

          // Add tooltips to the label element
          $(label).tooltip({
            placement: "top",
            delay: {
              show: 900,
            },
            trigger: "hover",
            viewport: "#sidebar",
            title: member.description,
          });

          // If this data source is already selected as a filter (from the search model), then check the checkbox
          if (checked) $(input).prop("checked", "checked");

          // Collapse some of the checkboxes and labels after a certain amount
          if (i > listMax - 1) {
            $(listItem).addClass("hidden");
          }

          // Insert a "More" link after a certain amount to enable users to expand the list
          if (i == listMax) {
            const moreLink = document.createElement("a");
            $(moreLink)
              .html(`Show ${numHidden} more`)
              .addClass("more-link pointer toggle-list")
              .append(
                $(document.createElement("i")).addClass("icon icon-expand-alt"),
              );
            $(list).append(moreLink);
          }

          // Add this checkbox and laebl to the list
          $(listItem).append(input).append(label);
          $(list).append(listItem);
        });

        if (numHidden > 0) {
          const lessLink = document.createElement("a");
          $(lessLink)
            .html("Collapse member nodes")
            .addClass("less-link toggle-list pointer hidden")
            .append(
              $(document.createElement("i")).addClass("icon icon-collapse-alt"),
            );

          $(list).append(lessLink);
        }

        // Add the list of checkboxes to the placeholder
        const container = $(".member-nodes-placeholder");
        $(container).html(list);
        $(".tooltip-this").tooltip();
      },

      resetDataSourceList() {
        if (!this.filters) return;

        // Reset the Member Nodes checkboxes
        const mnFilterContainer = $("#member-nodes-container");
        const defaultMNs = this.searchModel.get("dataSource");

        // Make sure the member node filter exists
        if (!mnFilterContainer || mnFilterContainer.length == 0) return false;
        if (typeof defaultMNs === "undefined" || !defaultMNs) return false;

        // Reset each member node checkbox
        const boxes = $(mnFilterContainer)
          .find(".filter")
          .prop("checked", false);

        // Check the member node checkboxes that are defaults in the search model
        _.each(defaultMNs, (member, i) => {
          let value = null;

          // Allow for string search model filter values and object filter values
          if (typeof member !== "object" && member) value = member;
          else if (typeof member.value === "undefined" || !member.value)
            value = "";
          else value = member.value;

          $(mnFilterContainer)
            .find(`checkbox[value='${value}']`)
            .prop("checked", true);
        });

        return true;
      },

      toggleList(e) {
        if (!this.filters) return;

        const link = e.target;
        const controls = $(link).parents("ul").find(".toggle-list");
        const list = $(link).parents("ul");
        const isHidden = !list.find(".more-link").is(".hidden");

        // Hide/Show the list
        if (isHidden) {
          list.children("li").slideDown();
        } else {
          list.children("li.hidden").slideUp();
        }

        // Hide/Show the control links
        controls.toggleClass("hidden");
      },

      // add additional criteria to the search model based on link click
      additionalCriteria(e) {
        // Get the clicked node
        const targetNode = $(e.target);

        // If this additional criteria is already applied, remove it
        if (targetNode.hasClass("active")) {
          this.removeAdditionalCriteria(e);
          return false;
        }

        // Get the filter criteria
        const term = targetNode.attr("data-term");

        // Find this element's category in the data-category attribute
        const category = targetNode.attr("data-category");

        // style the selection
        $(".keyword-search-link").removeClass("active");
        $(".keyword-search-link").parent().removeClass("active");
        targetNode.addClass("active");
        targetNode.parent().addClass("active");

        // Add this criteria to the search model
        this.searchModel.set(category, [term]);

        // Trigger the search
        this.triggerSearch();

        // prevent default action of click
        return false;
      },

      removeAdditionalCriteria(e) {
        // Get the clicked node
        const targetNode = $(e.target);

        // Reference to model
        const model = this.searchModel;

        // remove the styling
        $(".keyword-search-link").removeClass("active");
        $(".keyword-search-link").parent().removeClass("active");

        // Get the term
        const term = targetNode.attr("data-term");

        // Get the current search model additional criteria
        const current = this.searchModel.get("additionalCriteria");
        // If this term is in the current search model (should be)...
        if (_.contains(current, term)) {
          // then remove it
          const newTerms = _.without(current, term);
          model.set("additionalCriteria", newTerms);
        }

        // Route to page 1
        this.updatePageNumber(0);

        // Trigger a new search
        this.triggerSearch();
      },

      // Get the facet counts
      getAutocompletes(e) {
        if (!e) return;

        // Get the text input to determine the filter type
        const input = $(e.target);
        const category = input.attr("data-category");

        if (!this.filters || !category) return;

        const viewRef = this;

        // Create the facet query by using our current search query
        const facetQuery = `q=${
          this.searchResults.currentquery
        }&rows=0${this.searchModel.getFacetQuery(category)}&wt=json&`;

        // If we've cached these filter results, then use the cache instead of sending a new request
        if (!MetacatUI.appSearchModel.autocompleteCache)
          MetacatUI.appSearchModel.autocompleteCache = {};
        else if (MetacatUI.appSearchModel.autocompleteCache[facetQuery]) {
          this.setupAutocomplete(
            input,
            MetacatUI.appSearchModel.autocompleteCache[facetQuery],
          );
          return;
        }

        // Get the facet counts for the autocomplete
        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + facetQuery,
          type: "GET",
          dataType: "json",
          success(data, textStatus, xhr) {
            let suggestions = [];
            const facetLimit = 999;

            // Get all the facet counts
            _.each(category.split(","), (c) => {
              if (typeof c === "string") c = [c];
              _.each(c, (thisCategory) => {
                // Get the field name(s)
                let fieldNames =
                  MetacatUI.appSearchModel.facetNameMap[thisCategory];
                if (typeof fieldNames === "string") fieldNames = [fieldNames];

                // Get the facet counts
                _.each(fieldNames, (fieldName) => {
                  suggestions.push(data.facet_counts.facet_fields[fieldName]);
                });
              });
            });
            suggestions = _.flatten(suggestions);

            // Format the suggestions
            const rankedSuggestions = new Array();
            for (
              let i = 0;
              i < Math.min(suggestions.length - 1, facetLimit);
              i += 2
            ) {
              // The label is the item value
              let label = suggestions[i];

              // For all categories except the 'all' category, display the facet count
              if (category != "all") {
                label += ` (${suggestions[i + 1]})`;
              }

              // Push the autocomplete item to the array
              rankedSuggestions.push({
                value: suggestions[i],
                label,
              });
            }

            // Save these facets in the app so we don't have to send another query
            MetacatUI.appSearchModel.autocompleteCache[facetQuery] =
              rankedSuggestions;

            // Now setup the actual autocomplete menu
            viewRef.setupAutocomplete(input, rankedSuggestions);
          },
        };
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      setupAutocomplete(input, rankedSuggestions) {
        const viewRef = this;

        // Override the _renderItem() function which renders a single autocomplete item.
        // We want to use the 'title' HTML attribute on each item.
        // This method must create a new <li> element, append it to the menu, and return it.
        $.widget("custom.autocomplete", $.ui.autocomplete, {
          _renderItem(ul, item) {
            return $(document.createElement("li"))
              .attr("title", item.label)
              .append(item.label)
              .appendTo(ul);
          },
        });
        input.autocomplete({
          source(request, response) {
            const term = $.ui.autocomplete.escapeRegex(request.term);
            const startsWithMatcher = new RegExp(`^${term}`, "i");
            const startsWith = $.grep(rankedSuggestions, (value) =>
              startsWithMatcher.test(value.label || value.value || value),
            );
            const containsMatcher = new RegExp(term, "i");
            const contains = $.grep(
              rankedSuggestions,
              (value) =>
                $.inArray(value, startsWith) < 0 &&
                containsMatcher.test(value.label || value.value || value),
            );

            response(startsWith.concat(contains));
          },
          select(event, ui) {
            // set the text field
            input.val(ui.item.value);
            // add to the filter immediately
            viewRef.updateTextFilters(event, ui.item);
            // prevent default action
            return false;
          },
          position: {
            my: "left top",
            at: "left bottom",
            collision: "flipfit",
          },
        });
      },

      hideClearButton() {
        if (!this.filters) return;

        // Hide the current filters panel
        this.$(".current-filters-container").slideUp();

        // Hide the reset button
        $("#clear-all").addClass("hidden");
        this.setAutoHeight();
      },

      showClearButton() {
        if (!this.filters) return;

        // Show the current filters panel
        if (
          _.difference(
            this.searchModel.getCurrentFilters(),
            this.searchModel.spatialFilters,
          ).length > 0
        ) {
          this.$(".current-filters-container").slideDown();
        }

        // Show the reset button
        $("#clear-all").removeClass("hidden");
        this.setAutoHeight();
      },

      /*
       * ==================================================================================================
       *                                             NAVIGATING THE UI
       * ==================================================================================================
       */
      // Update all the statistics throughout the page
      updateStats() {
        if (this.searchResults.header != null) {
          this.$statcounts = this.$("#statcounts");
          this.$statcounts.html(
            this.statsTemplate({
              start: this.searchResults.header.get("start") + 1,
              end:
                this.searchResults.header.get("start") +
                this.searchResults.length,
              numFound: this.searchResults.header.get("numFound"),
            }),
          );
        }

        // piggy back here
        this.updatePager();
      },

      updatePager() {
        if (this.searchResults.header != null) {
          const pageCount = Math.ceil(
            this.searchResults.header.get("numFound") /
              this.searchResults.header.get("rows"),
          );

          // If no results were found, display a message instead of the list and clear the pagination.
          if (pageCount == 0) {
            this.$results.html(
              "<p id='no-results-found'>No results found.</p>",
            );

            this.$("#resultspager").html("");
            this.$(".resultspager").html("");
          }
          // Do not display the pagination if there is only one page
          else if (pageCount == 1) {
            this.$("#resultspager").html("");
            this.$(".resultspager").html("");
          } else {
            const pages = new Array(pageCount);

            // mark current page correctly, avoid NaN
            let currentPage = -1;
            try {
              currentPage = Math.floor(
                (this.searchResults.header.get("start") /
                  this.searchResults.header.get("numFound")) *
                  pageCount,
              );
            } catch (ex) {
              console.log(`Exception when calculating pages:${ex.message}`);
            }

            // Populate the pagination element in the UI
            this.$(".resultspager").html(
              this.pagerTemplate({
                pages,
                currentPage,
              }),
            );
            this.$("#resultspager").html(
              this.pagerTemplate({
                pages,
                currentPage,
              }),
            );
          }
        }
      },

      updatePageNumber(page) {
        MetacatUI.appModel.set("page", page);

        if (!this.isSubView) {
          let route = Backbone.history.fragment;
          const subroutePos = route.indexOf("/page/");
          const newPage = parseInt(page) + 1;

          // replace the last number with the new one
          if (page > 0 && subroutePos > -1) {
            route = route.replace(/\d+$/, newPage);
          } else if (page > 0) {
            route += `/page/${newPage}`;
          } else if (subroutePos >= 0) {
            route = route.substring(0, subroutePos);
          }

          MetacatUI.uiRouter.navigate(route);
        }
      },

      // Next page of results
      nextpage() {
        this.loading();
        this.searchResults.nextpage();
        this.$resultsview.show();
        this.updateStats();

        let page = MetacatUI.appModel.get("page");
        page++;
        this.updatePageNumber(page);
      },

      // Previous page of results
      prevpage() {
        this.loading();
        this.searchResults.prevpage();
        this.$resultsview.show();
        this.updateStats();

        let page = MetacatUI.appModel.get("page");
        page--;
        this.updatePageNumber(page);
      },

      navigateToPage(event) {
        const page = $(event.target).attr("page");
        this.showPage(page);
      },

      showPage(page) {
        this.loading();
        this.searchResults.toPage(page);
        this.$resultsview.show();
        this.updateStats();
        this.updatePageNumber(page);
        this.updateYearRange();
      },

      /*
       * ==================================================================================================
       *                                             THE MAP
       * ==================================================================================================
       */
      renderMap() {
        // If gmaps isn't enabled or loaded with an error, use list mode
        if (!gmaps || this.mode == "list") {
          this.ready = true;
          this.mode = "list";
          return;
        }

        if (this.isSubView) {
          this.$el.addClass("mapMode");
        } else {
          $("body").addClass("mapMode");
        }

        // Get the map options and create the map
        gmaps.visualRefresh = true;
        const mapOptions = this.mapModel.get("mapOptions");
        const defaultZoom = mapOptions.zoom;
        $("#map-container").append("<div id='map-canvas'></div>");
        this.map = new gmaps.Map($("#map-canvas")[0], mapOptions);
        this.mapModel.set("map", this.map);
        this.hasZoomed = false;
        this.hasDragged = false;

        // Hide the map filter toggle element
        this.$(this.mapFilterToggle).hide();

        // Store references
        const mapRef = this.map;
        const viewRef = this;

        google.maps.event.addListener(mapRef, "zoom_changed", () => {
          // If the map is zoomed in further than the default zoom level,
          // than we want to mark the map as zoomed in
          if (viewRef.map.getZoom() > defaultZoom) {
            viewRef.hasZoomed = true;
          }
          // If we are at the default zoom level or higher, than do not mark the map
          // as zoomed in
          else {
            viewRef.hasZoomed = false;
          }
        });

        google.maps.event.addListener(mapRef, "dragend", () => {
          viewRef.hasDragged = true;
        });

        google.maps.event.addListener(mapRef, "idle", () => {
          // Remove all markers from the map
          for (let i = 0; i < viewRef.resultMarkers.length; i++) {
            viewRef.resultMarkers[i].setMap(null);
          }
          viewRef.resultMarkers = new Array();

          // Check if the user has interacted with the map just now, and if so, we
          // want to alter the geohash filter (changing the geohash values or resetting it completely)
          const alterGeohashFilter =
            viewRef.allowSearch || viewRef.hasZoomed || viewRef.hasDragged;
          if (!alterGeohashFilter) {
            return;
          }

          // Determine if the map needs to be recentered. The map only needs to be
          // recentered if it is not at the default lat,long center point AND it
          // is not zoomed in or dragged to a new center point
          const setGeohashFilter =
            viewRef.hasZoomed && viewRef.isMapFilterEnabled();

          // If we are using the geohash filter defined by this map, then
          // apply the filter and trigger a new search
          if (setGeohashFilter) {
            viewRef.$(viewRef.mapFilterToggle).show();

            // Get the Google map bounding box
            const boundingBox = mapRef.getBounds();

            // Set the search model spatial filters
            // Encode the Google Map bounding box into geohash
            const north = boundingBox.getNorthEast().lat();
            const west = boundingBox.getSouthWest().lng();
            const south = boundingBox.getSouthWest().lat();
            const east = boundingBox.getNorthEast().lng();

            viewRef.searchModel.set("north", north);
            viewRef.searchModel.set("west", west);
            viewRef.searchModel.set("south", south);
            viewRef.searchModel.set("east", east);

            // Save the center position and zoom level of the map
            viewRef.mapModel.get("mapOptions").center = mapRef.getCenter();
            viewRef.mapModel.get("mapOptions").zoom = mapRef.getZoom();

            // Determine the precision of geohashes to search for
            const zoom = mapRef.getZoom();

            const precision = viewRef.mapModel.getSearchPrecision(zoom);

            // Get all the geohash tiles contained in the map bounds
            const geohashBBoxes = nGeohash.bboxes(
              south,
              west,
              north,
              east,
              precision,
            );

            // Save our geohash search settings
            viewRef.searchModel.set("geohashes", geohashBBoxes);
            viewRef.searchModel.set("geohashLevel", precision);

            // Start back at page 0
            MetacatUI.appModel.set("page", 0);

            // Mark the view as ready to start a search
            viewRef.ready = true;

            // Trigger a new search
            viewRef.triggerSearch();

            viewRef.allowSearch = false;
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
          }
        });
      },

      // Resets the model and view settings related to the map
      resetMap() {
        if (!gmaps) {
          return;
        }

        // First reset the model
        // The categories pertaining to the map
        const categories = ["east", "west", "north", "south"];

        // Loop through each and remove the filters from the model
        for (let i = 0; i < categories.length; i++) {
          this.searchModel.set(categories[i], null);
        }

        // Reset the map settings
        this.searchModel.resetGeohash();
        this.mapModel.set("mapOptions", this.mapModel.defaults().mapOptions);

        this.allowSearch = false;
      },

      isMapFilterEnabled() {
        const toggleInput = this.$(`input${this.mapFilterToggle}`);
        if (typeof toggleInput === "undefined" || !toggleInput) return;

        return $(toggleInput).prop("checked");
      },

      toggleMapFilter(e, a) {
        const toggleInput = this.$(`input${this.mapFilterToggle}`);
        if (typeof toggleInput === "undefined" || !toggleInput) return;

        let isOn = $(toggleInput).prop("checked");

        // If the user clicked on the label, then change the checkbox for them
        if (e.target.tagName != "INPUT") {
          isOn = !isOn;
          toggleInput.prop("checked", isOn);
        }

        google.maps.event.trigger(this.mapModel.get("map"), "idle");

        // Track this event
        MetacatUI.analytics?.trackEvent("map", isOn ? "on" : "off");
      },

      /**
       * Show the marker, infoWindow, and bounding coordinates polygon on
             the map when the user hovers on the marker icon in the result list
       * @param {Event} e
       */
      showResultOnMap(e) {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        // Get the attributes about this dataset
        let resultRow = e.target;
        let id = $(resultRow).attr("data-id");
        // The mouseover event might be triggered by a nested element, so loop through the parents to find the id
        if (typeof id === "undefined") {
          $(resultRow)
            .parents()
            .each(function () {
              if (typeof $(this).attr("data-id") !== "undefined") {
                id = $(this).attr("data-id");
                resultRow = this;
              }
            });
        }

        // Find the tile for this data set and highlight it on the map
        const resultGeohashes = this.searchResults
          .findWhere({
            id,
          })
          .get("geohash_9");
        for (let i = 0; i < resultGeohashes.length; i++) {
          var thisGeohash = resultGeohashes[i];
          const latLong = nGeohash.decode(thisGeohash);
          const position = new google.maps.LatLng(
            latLong.latitude,
            latLong.longitude,
          );
          const containingTileGeohash = _.find(
            this.tileGeohashes,
            (g) => thisGeohash.indexOf(g) == 0,
          );
          const containingTile = _.findWhere(this.tiles, {
            geohash: containingTileGeohash,
          });

          // If this is a geohash for a georegion outside the map, do not highlight a tile or display a marker
          if (typeof containingTile === "undefined") continue;

          this.highlightTile(containingTile);

          // Set up the options for each marker
          const markerOptions = {
            position,
            icon: this.mapModel.get("markerImage"),
            zIndex: 99999,
            map: this.map,
          };

          // Create the marker and add to the map
          const marker = new google.maps.Marker(markerOptions);

          this.resultMarkers.push(marker);
        }
      },

      /**
       * Hide the marker, infoWindow, and bounding coordinates polygon on
             the map when the user stops hovering on the marker icon in the result list
       * @param {Event} e - The event that brought us to this function
       */
      hideResultOnMap(e) {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        // Get the attributes about this dataset
        let resultRow = e.target;
        let id = $(resultRow).attr("data-id");
        // The mouseover event might be triggered by a nested element, so loop through the parents to find the id
        if (typeof id === "undefined") {
          $(e.target)
            .parents()
            .each(function () {
              if (typeof $(this).attr("data-id") !== "undefined") {
                id = $(this).attr("data-id");
                resultRow = this;
              }
            });
        }

        // Get the map tile for this result and un-highlight it
        const resultGeohashes = this.searchResults
          .findWhere({
            id,
          })
          .get("geohash_9");
        for (let i = 0; i < resultGeohashes.length; i++) {
          var thisGeohash = resultGeohashes[i];
          const containingTileGeohash = _.find(
            this.tileGeohashes,
            (g) => thisGeohash.indexOf(g) == 0,
          );
          const containingTile = _.findWhere(this.tiles, {
            geohash: containingTileGeohash,
          });

          // If this is a geohash for a georegion outside the map, do not unhighlight a tile
          if (typeof containingTile === "undefined") continue;

          // Unhighlight the tile
          this.unhighlightTile(containingTile);
        }

        // Remove all markers from the map
        _.each(this.resultMarkers, (marker) => {
          marker.setMap(null);
        });
        this.resultMarkers = new Array();
      },

      /**
       * Create a tile for each geohash facet. A separate tile label is added to the map with the count of the facet.
       */
      drawTiles() {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        TextOverlay.prototype = new google.maps.OverlayView();

        /**
         *
         * @param options
         */
        function TextOverlay(options) {
          // Now initialize all properties.
          this.bounds_ = options.bounds;
          this.map_ = options.map;
          this.text = options.text;
          this.color = options.color;

          const { length } = options.text.toString();
          if (length == 1) this.width = 8;
          else if (length == 2) this.width = 17;
          else if (length == 3) this.width = 25;
          else if (length == 4) this.width = 32;
          else if (length == 5) this.width = 40;

          // We define a property to hold the image's div. We'll
          // actually create this div upon receipt of the onAdd()
          // method so we'll leave it null for now.
          this.div_ = null;

          // Explicitly call setMap on this overlay
          this.setMap(options.map);
        }

        TextOverlay.prototype.onAdd = function () {
          // Create the DIV and set some basic attributes.
          const div = document.createElement("div");
          div.style.color = this.color;
          div.style.fontSize = "15px";
          div.style.position = "absolute";
          div.style.zIndex = "999";
          div.style.fontWeight = "bold";

          // Create an IMG element and attach it to the DIV.
          div.innerHTML = this.text;

          // Set the overlay's div_ property to this DIV
          this.div_ = div;

          // We add an overlay to a map via one of the map's panes.
          // We'll add this overlay to the overlayLayer pane.
          const panes = this.getPanes();
          panes.overlayLayer.appendChild(div);
        };

        TextOverlay.prototype.draw = function () {
          // Size and position the overlay. We use a southwest and northeast
          // position of the overlay to peg it to the correct position and size.
          // We need to retrieve the projection from this overlay to do this.
          const overlayProjection = this.getProjection();

          // Retrieve the southwest and northeast coordinates of this overlay
          // in latlngs and convert them to pixels coordinates.
          // We'll use these coordinates to resize the DIV.
          const sw = overlayProjection.fromLatLngToDivPixel(
            this.bounds_.getSouthWest(),
          );
          const ne = overlayProjection.fromLatLngToDivPixel(
            this.bounds_.getNorthEast(),
          );
          // Resize the image's DIV to fit the indicated dimensions.
          const div = this.div_;
          const { width } = this;
          const height = 20;

          div.style.left = `${sw.x - width / 2}px`;
          div.style.top = `${ne.y - height / 2}px`;
          div.style.width = `${width}px`;
          div.style.height = `${height}px`;
          div.style.width = `${width}px`;
          div.style.height = `${height}px`;
        };

        TextOverlay.prototype.onRemove = function () {
          this.div_.parentNode.removeChild(this.div_);
          this.div_ = null;
        };

        // Determine the geohash level we will use to draw tiles
        const currentZoom = this.map.getZoom();
        const geohashLevelNum =
          this.mapModel.determineGeohashLevel(currentZoom);
        const geohashLevel = `geohash_${geohashLevelNum}`;
        const geohashes = this.searchResults.facetCounts[geohashLevel];

        // Save the current geohash level in the map model
        this.mapModel.set("tileGeohashLevel", geohashLevelNum);

        // Get all the geohashes contained in the map
        const mapBBoxes = _.flatten(
          _.values(this.searchModel.get("geohashGroups")),
        );

        // Geohashes may be returned that are part of datasets with multiple geographic areas. Some of these may be outside this map.
        // So we will want to filter out geohashes that are not contained in this map.
        if (mapBBoxes.length == 0) {
          var filteredTileGeohashes = geohashes;
        } else if (geohashes) {
          var filteredTileGeohashes = [];
          for (var i = 0; i < geohashes.length - 1; i += 2) {
            // Get the geohash for this tile
            var tileGeohash = geohashes[i];
            let isInsideMap = false;
            let index = 0;
            let searchString = tileGeohash;

            // Find if any of the bounding boxes/geohashes inside our map contain this tile geohash
            while (!isInsideMap && searchString.length > 0) {
              searchString = tileGeohash.substring(
                0,
                tileGeohash.length - index,
              );
              if (_.contains(mapBBoxes, searchString)) isInsideMap = true;
              index++;
            }

            if (isInsideMap) {
              filteredTileGeohashes.push(tileGeohash);
              filteredTileGeohashes.push(geohashes[i + 1]);
            }
          }
        }

        // If there are no tiles on the page, the map may have failed to render, so exit.
        if (
          typeof filteredTileGeohashes === "undefined" ||
          !filteredTileGeohashes.length
        ) {
          return;
        }

        // Make a copy of the array that is geohash counts only
        const countsOnly = [];
        for (var i = 1; i < filteredTileGeohashes.length; i += 2) {
          countsOnly.push(filteredTileGeohashes[i]);
        }

        // Create a range of lightness to make different colors on the tiles
        const lightnessMin = this.mapModel.get("tileLightnessMin");
        const lightnessMax = this.mapModel.get("tileLightnessMax");
        const lightnessRange = lightnessMax - lightnessMin;

        // Get some stats on our tile counts so we can normalize them to create a color scale
        const findMedian = function (nums) {
          if (nums.length % 2 == 0) {
            return (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2;
          }
          return nums[nums.length / 2 - 0.5];
        };
        const sortedCounts = countsOnly.sort((a, b) => a - b);
        const maxCount = sortedCounts[sortedCounts.length - 1];
        const minCount = sortedCounts[0];

        const viewRef = this;

        // Now draw a tile for each geohash facet
        for (var i = 0; i < filteredTileGeohashes.length - 1; i += 2) {
          // Convert this geohash to lat,long values
          var tileGeohash = filteredTileGeohashes[i];
          const decodedGeohash = nGeohash.decode(tileGeohash);
          const latLngCenter = new google.maps.LatLng(
            decodedGeohash.latitude,
            decodedGeohash.longitude,
          );
          const geohashBox = nGeohash.decode_bbox(tileGeohash);
          const swLatLng = new google.maps.LatLng(geohashBox[0], geohashBox[1]);
          const neLatLng = new google.maps.LatLng(geohashBox[2], geohashBox[3]);
          const bounds = new google.maps.LatLngBounds(swLatLng, neLatLng);
          const tileCount = filteredTileGeohashes[i + 1];
          const drawMarkers = this.mapModel.get("drawMarkers");
          var marker;
          var count;
          var color;

          // Normalize the range of tiles counts and convert them to a lightness domain of 20-70% lightness.
          if (maxCount - minCount == 0) {
            var lightness = lightnessRange;
          } else {
            var lightness =
              ((tileCount - minCount) / (maxCount - minCount)) *
                lightnessRange +
              lightnessMin;
          }

          var color = `hsl(${this.mapModel.get("tileHue")},${lightness}%,50%)`;

          // Add the count to the tile
          const countLocation = new google.maps.LatLngBounds(
            latLngCenter,
            latLngCenter,
          );

          // Draw the tile label with the dataset count
          count = new TextOverlay({
            bounds: countLocation,
            map: this.map,
            text: tileCount,
            color: this.mapModel.get("tileLabelColor"),
          });

          // Set up the default tile options
          const tileOptions = {
            fillColor: color,
            strokeColor: color,
            map: this.map,
            visible: true,
            bounds,
          };

          // Merge these options with any tile options set in the map model
          const modelTileOptions = this.mapModel.get("tileOptions");
          for (const attr in modelTileOptions) {
            tileOptions[attr] = modelTileOptions[attr];
          }

          // Draw this tile
          const tile = this.drawTile(tileOptions, tileGeohash, count);

          // Save the geohashes for tiles in the view for later
          this.tileGeohashes.push(tileGeohash);
        }

        // Create an info window for each marker that is on the map, to display when it is clicked on
        if (this.markerGeohashes.length > 0) this.addMarkers();

        // If the map is zoomed all the way in, draw info windows for each tile that will be displayed when they are clicked on
        if (this.mapModel.isMaxZoom(this.map)) this.addTileInfoWindows();
      },

      /**
       * With the options and label object given, add a single tile to the map and set its event listeners
       * @param {object} options
       * @param {string} geohash
       * @param {string} label
       */
      drawTile(options, geohash, label) {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        // Add the tile for these datasets to the map
        const tile = new google.maps.Rectangle(options);

        const viewRef = this;

        // Save our tiles in the view
        const tileObject = {
          text: label,
          shape: tile,
          geohash,
          options,
        };
        this.tiles.push(tileObject);

        // Change styles when the tile is hovered on
        google.maps.event.addListener(tile, "mouseover", (event) => {
          viewRef.highlightTile(tileObject);
        });

        // Change the styles back after the tile is hovered on
        google.maps.event.addListener(tile, "mouseout", (event) => {
          viewRef.unhighlightTile(tileObject);
        });

        // If we are at the max zoom, we will display an info window. If not, we will zoom in.
        if (!this.mapModel.isMaxZoom(viewRef.map)) {
          /**
           * Set up some helper functions for zooming in on the map
           * @param myMap
           * @param bounds
           */
          const myFitBounds = function (myMap, bounds) {
            myMap.fitBounds(bounds); // calling fitBounds() here to center the map for the bounds

            const overlayHelper = new google.maps.OverlayView();
            overlayHelper.draw = function () {
              if (!this.ready) {
                const extraZoom = getExtraZoom(
                  this.getProjection(),
                  bounds,
                  myMap.getBounds(),
                );
                if (extraZoom > 0) {
                  myMap.setZoom(myMap.getZoom() + extraZoom);
                }
                this.ready = true;
                google.maps.event.trigger(this, "ready");
              }
            };
            overlayHelper.setMap(myMap);
          };
          var getExtraZoom = function (
            projection,
            expectedBounds,
            actualBounds,
          ) {
            // in: LatLngBounds bounds -> out: height and width as a Point
            const getSizeInPixels = function (bounds) {
              const sw = projection.fromLatLngToContainerPixel(
                bounds.getSouthWest(),
              );
              const ne = projection.fromLatLngToContainerPixel(
                bounds.getNorthEast(),
              );
              return new google.maps.Point(
                Math.abs(sw.y - ne.y),
                Math.abs(sw.x - ne.x),
              );
            };

            const expectedSize = getSizeInPixels(expectedBounds);
            const actualSize = getSizeInPixels(actualBounds);

            if (
              Math.floor(expectedSize.x) == 0 ||
              Math.floor(expectedSize.y) == 0
            ) {
              return 0;
            }

            const qx = actualSize.x / expectedSize.x;
            const qy = actualSize.y / expectedSize.y;
            const min = Math.min(qx, qy);

            if (min < 1) {
              return 0;
            }

            return Math.floor(Math.log(min) / Math.LN2 /* = log2(min) */);
          };

          // Zoom in when the tile is clicked on
          gmaps.event.addListener(tile, "click", (clickEvent) => {
            // Change the center
            viewRef.map.panTo(clickEvent.latLng);

            // Get this tile's bounds
            const tileBounds = tile.getBounds();
            // Get the current map bounds
            const mapBounds = viewRef.map.getBounds();

            // Change the zoom
            // viewRef.map.fitBounds(tileBounds);
            myFitBounds(viewRef.map, tileBounds);

            // Track this event
            MetacatUI.analytics?.trackEvent(
              "map",
              "clickTile",
              `geohash : ${tileObject.geohash}`,
            );
          });
        }

        return tile;
      },

      highlightTile(tile) {
        // Change the tile style on hover
        tile.shape.setOptions(this.mapModel.get("tileOnHover"));

        // Change the label color on hover
        const div = tile.text.div_;
        if (div) {
          div.style.color = this.mapModel.get("tileLabelColorOnHover");
          tile.text.div_ = div;
          $(div).css("color", this.mapModel.get("tileLabelColorOnHover"));
        }
      },

      unhighlightTile(tile) {
        // Change back the tile to it's original styling
        tile.shape.setOptions(tile.options);

        // Change back the label color
        const div = tile.text.div_;
        div.style.color = this.mapModel.get("tileLabelColor");
        tile.text.div_ = div;
        $(div).css("color", this.mapModel.get("tileLabelColor"));
      },

      /**
       * Get the details on each marker
       * And create an infowindow for that marker
       */
      addMarkers() {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        // Clone the Search model
        const searchModelClone = this.searchModel.clone();
        const geohashLevel = this.mapModel.get("tileGeohashLevel");
        const viewRef = this;
        const { markers } = this;

        // Change the geohash filter to match our tiles
        searchModelClone.set("geohashLevel", geohashLevel);
        searchModelClone.set("geohashes", this.markerGeohashes);

        // Now run a query to get a list of documents that are represented by our markers
        const query =
          `q=${searchModelClone.getQuery()}&fl=id,title,geohash_9,abstract,geohash_${geohashLevel}&rows=1000` +
          `&wt=json`;

        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          success(data, textStatus, xhr) {
            const { docs } = data.response;
            let uniqueGeohashes = viewRef.markerGeohashes;

            // Create a marker and infoWindow for each document
            _.each(docs, (doc, key, list) => {
              let marker;
              const drawMarkersAt = [];

              // Find the tile place that this document belongs to
              // For each geohash value at the current geohash level for this document,
              _.each(doc.geohash_9, (geohash, key, list) => {
                // Loop through each unique tile location to find its match
                for (let i = 0; i <= uniqueGeohashes.length; i++) {
                  if (uniqueGeohashes[i] == geohash.substr(0, geohashLevel)) {
                    drawMarkersAt.push(geohash);
                    uniqueGeohashes = _.without(uniqueGeohashes, geohash);
                  }
                }
              });

              _.each(drawMarkersAt, function (markerGeohash, key, list) {
                const decodedGeohash = nGeohash.decode(markerGeohash);
                const latLng = new google.maps.LatLng(
                  decodedGeohash.latitude,
                  decodedGeohash.longitude,
                );

                // Set up the options for each marker
                const markerOptions = {
                  position: latLng,
                  icon: this.mapModel.get("markerImage"),
                  zIndex: 99999,
                  map: viewRef.map,
                };

                // Create the marker and add to the map
                const marker = new google.maps.Marker(markerOptions);
              });
            });
          },
        };
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      /**
       * Get the details on each tile - a list of ids and titles for each dataset contained in that tile
       * And create an infowindow for that tile
       */
      addTileInfoWindows() {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        // Clone the Search model
        const searchModelClone = this.searchModel.clone();
        const geohashLevel = this.mapModel.get("tileGeohashLevel");
        const geohashName = `geohash_${geohashLevel}`;
        const viewRef = this;
        const infoWindows = [];

        // Change the geohash filter to match our tiles
        searchModelClone.set("geohashLevel", geohashLevel);
        searchModelClone.set("geohashes", this.tileGeohashes);

        // Now run a query to get a list of documents that are represented by our tiles
        const query =
          `q=${searchModelClone.getQuery()}&fl=id,title,geohash_9,${geohashName}&rows=1000` +
          `&wt=json`;

        const requestSettings = {
          url: MetacatUI.appModel.get("queryServiceUrl") + query,
          success(data, textStatus, xhr) {
            // Make an infoWindow for each doc
            const { docs } = data.response;

            // For each tile, loop through the docs to find which ones to include in its infoWindow
            _.each(viewRef.tiles, (tile, key, list) => {
              let infoWindowContent = "";

              _.each(docs, (doc, key, list) => {
                const docGeohashes = doc[geohashName];

                if (docGeohashes) {
                  // Is this document in this tile?
                  for (let i = 0; i < docGeohashes.length; i++) {
                    if (docGeohashes[i] == tile.geohash) {
                      // Add this doc to the infoWindow content
                      infoWindowContent += `<a href='${
                        MetacatUI.root
                      }/view/${encodeURIComponent(doc.id)}'>${doc.title}</a> (${
                        doc.id
                      }) <br/>`;
                      break;
                    }
                  }
                }
              });

              // The center of the tile
              const decodedGeohash = nGeohash.decode(tile.geohash);
              const tileCenter = new google.maps.LatLng(
                decodedGeohash.latitude,
                decodedGeohash.longitude,
              );

              // The infowindow
              const infoWindow = new gmaps.InfoWindow({
                content:
                  `<div class='gmaps-infowindow'>` +
                  `<h4> Datasets located here </h4>` +
                  `<p>${infoWindowContent}</p>` +
                  `</div>`,
                isOpen: false,
                disableAutoPan: false,
                maxWidth: 250,
                position: tileCenter,
              });

              viewRef.tileInfoWindows.push(infoWindow);

              // Zoom in when the tile is clicked on
              gmaps.event.addListener(
                tile.shape,
                "click",
                function (clickEvent) {
                  // --- We are at max zoom, display an infowindow ----//
                  if (this.mapModel.isMaxZoom(viewRef.map)) {
                    // Find the infowindow that belongs to this tile in the view
                    infoWindow.open(viewRef.map);
                    infoWindow.isOpen = true;

                    // Close all other infowindows
                    viewRef.closeInfoWindows(infoWindow);
                  }

                  // ------ We are not at max zoom, so zoom into this tile ----//
                  else {
                    // Change the center
                    viewRef.map.panTo(clickEvent.latLng);

                    // Get this tile's bounds
                    const bounds = tile.shape.getBounds();

                    // Change the zoom
                    viewRef.map.fitBounds(bounds);
                  }
                },
              );

              // Close the infowindow upon any click on the map
              gmaps.event.addListener(viewRef.map, "click", () => {
                infoWindow.close();
                infoWindow.isOpen = false;
              });

              infoWindows[tile.geohash] = infoWindow;
            });

            viewRef.infoWindows = infoWindows;
          },
        };
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      /**
       * Iterate over each infowindow that we have stored in the view and close it.
       * Pass an infoWindow object to this function to keep that infoWindow open/skip it
       * @param {infoWindow} - An infoWindow to keep open
       * @param except
       */
      closeInfoWindows(except) {
        const infoWindowLists = [this.markerInfoWindows, this.tileInfoWindows];

        _.each(infoWindowLists, (infoWindows, key, list) => {
          // Iterate over all the marker infowindows and close all of them except for this one
          for (let i = 0; i < infoWindows.length; i++) {
            if (infoWindows[i].isOpen && infoWindows[i] != except) {
              // Close this info window and stop looking, since only one of each kind should be open anyway
              infoWindows[i].close();
              infoWindows[i].isOpen = false;
              i = infoWindows.length;
            }
          }
        });
      },

      /**
       * Remove all the tiles and text from the map
       */
      removeTiles() {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        // Remove the tile from the map
        _.each(this.tiles, (tile, key, list) => {
          if (tile.shape) tile.shape.setMap(null);
          if (tile.text) tile.text.setMap(null);
        });

        // Reset the tile storage in the view
        this.tiles = [];
        this.tileGeohashes = [];
        this.tileInfoWindows = [];
      },

      /**
       * Iterate over all the markers in the view and remove them from the map and view
       */
      removeMarkers() {
        // Exit if maps are not in use
        if (this.mode != "map" || !gmaps) {
          return false;
        }

        // Remove the marker from the map
        _.each(this.markers, (marker, key, list) => {
          marker.marker.setMap(null);
        });

        // Reset the marker storage in the view
        this.markers = [];
        this.markerGeohashes = [];
        this.markerInfoWindows = [];
      },

      /*
       * ==================================================================================================
       *                                             ADDING RESULTS
       * ==================================================================================================
       */

      /**
       * Add all items in the **SearchResults** collection
       * This loads the first 25, then waits for the map to be
       * fully loaded and then loads the remaining items.
       * Without this delay, the app waits until all records are processed
       */
      addAll() {
        // After the map is done loading, then load the rest of the results into the list
        if (this.ready) this.renderAll();
        else {
          const viewRef = this;
          var intervalID = setInterval(() => {
            if (viewRef.ready) {
              clearInterval(intervalID);
              viewRef.renderAll();
            }
          }, 500);
        }

        // After all the results are loaded, query for our facet counts in the background
        // this.getAutocompletes();
      },

      renderAll() {
        // do this first to indicate coming results
        this.updateStats();

        // Remove all the existing tiles on the map
        this.removeTiles();
        this.removeMarkers();

        // Remove the loading class and styling
        this.$results.removeClass("loading");

        // If there are no results, display so
        const numFound = this.searchResults.length;
        if (numFound == 0) {
          // Add a No Results Found message
          this.$results.html("<p id='no-results-found'>No results found.</p>");

          // Remove the loading styles from the map
          if (gmaps && this.mapModel) {
            $("#map-container").removeClass("loading");
          }

          if (MetacatUI.theme == "arctic") {
            // When we get new results, check if the user is searching for their own datasets and display a message
            if (
              MetacatUI.appView.dataCatalogView &&
              MetacatUI.appView.dataCatalogView.searchModel.getQuery() ==
                MetacatUI.appUserModel.get("searchModel").getQuery() &&
              !MetacatUI.appSearchResults.length
            ) {
              $("#no-results-found").after(
                `<h3>Where are my data sets?</h3><p>If you are a previous ACADIS Gateway user, ` +
                  `you will need to take additional steps to access your data sets in the new NSF Arctic Data Center.` +
                  `<a href='mailto:support@arcticdata.io'>Send us a message at support@arcticdata.io</a> with your old ACADIS ` +
                  `Gateway username and your ORCID identifier (${MetacatUI.appUserModel.get(
                    "username",
                  )}), we will help.</p>`,
              );
            }
          }
          return;
        }

        // Clear the results list before we start adding new rows
        this.$results.html("");

        // --First map all the results--
        if (gmaps && this.mapModel) {
          // Draw all the tiles on the map to represent the datasets
          this.drawTiles();

          // Remove the loading styles from the map
          $("#map-container").removeClass("loading");
        }

        const pid_list = new Array();

        // --- Add all the results to the list ---
        for (i = 0; i < this.searchResults.length; i++) {
          pid_list.push(this.searchResults.models[i].get("id"));
        }

        if (MetacatUI.appModel.get("displayDatasetMetrics")) {
          const metricsModel = new MetricsModel({
            pid_list,
            type: "catalog",
          });
          metricsModel.fetch();
          this.metricsModel = metricsModel;
        }

        // --- Add all the results to the list ---
        for (i = 0; i < this.searchResults.length; i++) {
          const element = this.searchResults.models[i];
          if (typeof element !== "undefined")
            this.addOne(element, this.metricsModel);
        }

        // Initialize any tooltips within the result item
        $(".tooltip-this").tooltip();
        $(".popover-this").popover();

        // Set the autoheight
        this.setAutoHeight();
      },

      /**
       * Add a single SolrResult item to the list by creating a view for it and appending its element to the DOM.
       * @param result
       */
      addOne(result) {
        // Get the view and package service URL's
        this.$view_service = MetacatUI.appModel.get("viewServiceUrl");
        this.$package_service = MetacatUI.appModel.get("packageServiceUrl");
        result.set({
          view_service: this.$view_service,
          package_service: this.$package_service,
        });

        const view = new SearchResultView({
          model: result,
          metricsModel: this.metricsModel,
        });

        // Add this item to the list
        this.$results.append(view.render().el);

        // map it
        if (
          gmaps &&
          this.mapModel &&
          typeof result.get("geohash_9") !== "undefined" &&
          result.get("geohash_9") != null
        ) {
          const title = result.get("title");

          for (let i = 0; i < result.get("geohash_9").length; i++) {
            const centerGeohash = result.get("geohash_9")[i];
            const decodedGeohash = nGeohash.decode(centerGeohash);
            const position = new google.maps.LatLng(
              decodedGeohash.latitude,
              decodedGeohash.longitude,
            );
            const marker = new gmaps.Marker({
              position,
              icon: this.mapModel.get("markerImage"),
              zIndex: 99999,
            });
          }
        }
      },

      /**
       * When the SearchResults collection has an error getting the results,
       * show an error message instead of search results
       * @param {SolrResult} model
       * @param {XMLHttpRequest.response} response
       */
      showError(model, response) {
        let errorMessage = "";
        let statusCode = response.status;

        if (!statusCode) {
          statusCode = parseInt(response.statusText);
        }

        if (statusCode == 500 && this.solrError500Message) {
          errorMessage = this.solrError500Message;
        } else {
          try {
            errorMessage = $(response.responseText).text();
          } catch (e) {
            try {
              errorMessage = JSON.parse(response.responseText).error.msg;
            } catch (e) {
              errorMessage = "";
            }
          } finally {
            if (typeof errorMessage === "string" && errorMessage.length) {
              errorMessage = `<p>Error details: ${errorMessage}</p>`;
            }
          }
        }

        MetacatUI.appView.showAlert(
          `<h4><i class='icon icon-frown'></i>${this.solrErrorTitle}.</h4>${errorMessage}`,
          "alert-error",
          this.$results,
        );

        this.$results.find(".loading").remove();
      },

      /*
       * ==================================================================================================
       *                                             STYLING THE UI
       * ==================================================================================================
       */
      toggleMapMode(e) {
        if (typeof e === "object") {
          e.preventDefault();
        }

        if (gmaps) {
          $(".mapMode").toggleClass("mapMode");
        }

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

      // Communicate that the page is loading
      loading() {
        $("#map-container").addClass("loading");
        this.$results.addClass("loading");

        this.$results.html(
          this.loadingTemplate({
            msg: "Searching for data...",
          }),
        );
      },

      // Toggles the collapseable filters sidebar and result list in the default theme
      collapse(e) {
        const id = $(e.target).attr("data-collapse");

        $(`#${id}`).toggleClass("collapsed");
      },

      toggleFilterCollapse(e) {
        let container = this.$(".filter-contain.collapsable");
        if (typeof e !== "undefined") {
          container = $(e.target).parents(".filter-contain.collapsable");
        }

        // If we can't find a container, then don't do anything
        if (container.length < 1) return;

        const isAnnoContainer =
          $(container).attr("data-category") === "annotation";

        // Expand
        if ($(container).is(".collapsed")) {
          // Toggle the visibility of the collapse/expand icons
          $(container).find(".expand").hide();
          $(container).find(".collapse").show();

          // Cache the height of this element so we can reset it on collapse
          $(container).attr("data-height", $(container).css("height"));

          // Increase the height of the container to expand it
          $(container).css("max-height", "3000px");

          // For annotation container, allow overflow for the dropdown
          if (isAnnoContainer) {
            $(container).css("overflow", "visible");
          }
        }
        // Collapse
        else {
          // Toggle the visibility of the collapse/expand icons
          $(container).find(".collapse").hide();
          $(container).find(".expand").show();

          // Decrease the height of the container to collapse it
          if ($(container).attr("data-height")) {
            $(container).css("max-height", $(container).attr("data-height"));
          } else {
            $(container).css("max-height", "1.5em");
          }
          if (isAnnoContainer) {
            $(container).css("overflow", "hidden");
          }
        }

        $(container).toggleClass("collapsed");
      },
      /*
       * Either hides or shows the "clear all filters" button
       */
      toggleClearButton() {
        if (this.searchModel.filterCount() > 0) {
          this.showClearButton();
        } else {
          this.hideClearButton();
        }
      },

      // Move the popover element up the page a bit if it runs off the bottom of the page
      preventPopoverRunoff(e) {
        // In map view only (because all elements are fixed and you can't scroll)
        if (this.mode == "map") {
          var viewportHeight = $("#map-container").outerHeight();
        } else {
          return false;
        }

        if ($(".popover").length > 0) {
          const offset = $(".popover").offset();
          const popoverHeight = $(".popover").outerHeight();
          const topPosition = offset.top;

          // If pixels are cut off the top of the page, readjust its vertical position
          if (topPosition < 0) {
            $(".popover").offset({
              top: 10,
            });
          } else {
            // Else, let's check if it is cut off at the bottom
            const totalHeight = topPosition + popoverHeight;

            const pixelsHidden = totalHeight - viewportHeight;

            const newTopPosition = topPosition - pixelsHidden - 40;

            // If pixels are cut off the bottom of the page, readjust its vertical position
            if (pixelsHidden > 0) {
              $(".popover").offset({
                top: newTopPosition,
              });
            }
          }
        }
      },

      onClose() {
        this.stopListening();

        $(".DataCatalog").removeClass("DataCatalog");
        $(".mapMode").removeClass("mapMode");

        if (gmaps) {
          // unset map mode
          $("body").removeClass("mapMode");
          $("#map-canvas").remove();
        }

        // remove everything so we don't get a flicker
        this.$el.html("");
      },
    },
  );
  return DataCatalogView;
});
