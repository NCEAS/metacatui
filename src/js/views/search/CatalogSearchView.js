/*global define */
define([
  "jquery",
  "backbone",
  "models/filters/FilterGroup",
  "models/connectors/Filters-Search",
  "models/connectors/Geohash-Search",
  "models/maps/Map",
  "views/search/SearchResultsView",
  "views/filters/FilterGroupsView",
  "views/maps/MapView",
  "views/search/SearchResultsPagerView",
  "views/search/SorterView",
  "text!templates/search/catalogSearch.html",
], function (
  $,
  Backbone,
  FilterGroup,
  FiltersSearchConnector,
  GeohashSearchConnector,
  Map,
  SearchResultsView,
  FilterGroupsView,
  MapView,
  PagerView,
  SorterView,
  Template
) {
  "use strict";

  /**
   * @class CatalogSearchView
   * @name CatalogSearchView
   * @classcategory Views
   * @extends Backbone.View
   * @constructor
   * @since 2.22.0
   * TODO: Add screenshot and description
   */
  return Backbone.View.extend(
    /** @lends CatalogSearchView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       * @since 2.22.0
       */
      type: "CatalogSearch",

      /**
       * The HTML tag to use for this view's element
       * @type {string}
       * @since 2.22.0
       */
      tagName: "section",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       * @since 2.22.0
       */
      className: "catalog-search-view",

      /**
       * The template to use for this view's element
       * @type {underscore.template}
       * @since 2.22.0
       */
      template: _.template(Template),

      /**
       * The template to use in case there is a major error in rendering the
       * view.
       * @type {string}
       * @since 2.x.x
       */
      errorTemplate: `<div class="error" role="alert">
        <h2>There was an error loading the search results.</h2>
        <p>Please try again later.</p>
        </div>`,

      /**
       * The search mode to use. This can be set to either `map` or `list`. List
       * mode will hide all map features.
       * @type string
       * @since 2.22.0
       * @default "map"
       */
      mode: "map",

      /**
       * The View that displays the search results. The render method will be
       * attach the search results view to the
       * {@link CatalogSearchView#searchResultsContainer} element and will add
       * the view reference to this property.
       * @type {SearchResultsView}
       * @since 2.22.0
       */
      searchResultsView: null,

      /**
       * The view that shows the search filters. The render method will attach
       * the filter groups view to the
       * {@link CatalogSearchView#filterGroupsContainer} element and will add
       * the view reference to this property.
       * @type {FilterGroupsView}
       * @since 2.22.0
       */
      filterGroupsView: null,

      /**
       * The view that shows the number of pages and allows the user to navigate
       * between them. The render method will attach the pager view to the
       * {@link CatalogSearchView#pagerContainer} element and will add the view
       * reference to this property.
       * @type {PagerView}
       * @since 2.22.0
       */
      pagerView: null,

      /**
       * The view that handles sorting the search results. The render method
       * will attach the sorter view to the
       * {@link CatalogSearchView#sorterContainer} element and will add the view
       * reference to this property.
       * @type {SorterView}
       * @since 2.22.0
       */
      sorterView: null,

      /**
       * The model that retrieves the search results.
       * @type {SearchModel}
       * @since 2.22.0
       */
      searchModel: null,

      /**
       * An array of Filter models, outside of their parent FilterGroup, that
       * can be used to filter the search results. These models are passed to
       * the {@link FiltersSearchConnector} to be used in the search. This
       * property is added to the view by the
       * {@link CatalogSearchView#setupSearch} method.
       * @type {Filter[]}
       * @since 2.22.0
       */
      allFilters: null,

      /**
       * An array of FilterGroup models created by the
       * {@link CatalogSearchView#createFilterGroups} method, using the
       * {@link CatalogSearchView#filterGroupsJSON} property. These FilterGroups
       * will be displayed in this view and used for searching. This property is
       * added to the view by the {@link CatalogSearchView#createFilterGroups}
       * method.
       * @type {FilterGroup[]}
       * @since 2.22.0
       */
      filterGroups: null,

      /**
       * An array of literal objects to transform into FilterGroup models. These
       * FilterGroups will be displayed in this view and used for searching. If
       * not provided, the {@link AppConfig#defaultFilterGroups} will be used.
       * @type {FilterGroup#defaults[]}
       * @since 2.22.0
       */
      filterGroupsJSON: null,

      /**
       * The CSS class to add to the body of the CatalogSearch.
       * @type {string}
       * @since 2.22.0
       * @default "catalog-search-body"
       */
      bodyClass: "catalog-search-body",

      /**
       * The jQuery selector for the FilterGroupsView container
       * @type {string}
       * @since 2.22.0
       */
      filterGroupsContainer: ".filter-groups-container",

      /**
       * The query selector for the SearchResultsView container
       * @type {string}
       * @since 2.22.0
       */
      searchResultsContainer: ".search-results-container",

      /**
       * The query selector for the CesiumWidgetView container
       * @type {string}
       * @since 2.22.0
       */
      mapContainer: ".map-container",

      /**
       * The query selector for the PagerView container
       * @type {string}
       * @since 2.22.0
       */
      pagerContainer: ".pager-container",

      /**
       * The query selector for the SorterView container
       * @type {string}
       * @since 2.22.0
       */
      sorterContainer: ".sorter-container",

      /**
       * The query selector for the title container
       * @type {string}
       * @since 2.22.0
       */
      titleContainer: ".title-container",

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {Object}
       * @since 2.22.0
       */
      events: {
        "click .map-toggle-container": "toggleMode",
      },

      /**
       * Initializes the view
       * @param {Object} options
       * @param {string} options.initialQuery - The initial text query to run
       * when the view is rendered.
       * @since x.x.x
       */
      initialize: function (options) {
        this.initialQuery = options?.initialQuery;
      },

      /**
       * Renders the view
       * @since 2.22.0
       */
      render: function () {
        // Set the search mode - either map or list
        this.setMode();

        // Set up the view for styling and layout
        this.setupView();

        // Set up the search and search result models, as well as the map
        this.setupSearch();

        // Render the search components
        this.renderComponents();

        // When everything is ready, run the initial search and then start
        // listening for changes. Wait for components to render first because
        // when filters are added, they trigger a search unnecessarily.
        this.connector.triggerSearch();
        this.connector.startListening();
      },

      /**
       * Indicates that there was a problem rendering this view.
       */
      renderError: function () {
        this.$el.html(this.errorTemplate);
      },

      /**
       * Sets the search mode (map or list)
       * @since 2.22.0
       */
      setMode: function () {
        try {
          // Get the search mode - either "map" or "list"
          if (
            (typeof this.mode === "undefined" || !this.mode) &&
            MetacatUI.appModel.get("enableCesium")
          ) {
            this.mode = "map";
          }

          // Use map mode on tablets and browsers only. TODO: should we set a
          // listener for window resize?
          if ($(window).outerWidth() <= 600) {
            this.mode = "list";
          }
        } catch (e) {
          console.error(
            "Error setting the search mode, defaulting to list:" + e
          );
          this.mode = "list";
        }
      },

      /**
       * Sets up the basic components of this view
       * @since 2.22.0
       */
      setupView: function () {
        try {
          document.querySelector("body").classList.add(this.bodyClass);

          this.toggleMode(this.mode);

          // Add LinkedData to the page
          this.addLinkedData();

          // Render the template
          this.$el.html(this.template({}));
        } catch (e) {
          console.log(
            "There was an error setting up the CatalogSearchView:" + e
          );
          this.renderError();
        }
      },

      /**
       * Calls other methods that insert the sub-views into the DOM and render
       * them.
       * @since 2.22.0
       */
      renderComponents: function () {
        try {
          this.renderFilters();

          // Render the list of search results
          this.renderSearchResults();

          // Render the Title
          this.renderTitle();
          this.listenTo(
            this.searchResultsView.searchResults,
            "reset",
            this.renderTitle
          );

          // Render Pager
          this.renderPager();

          // Render Sorter
          this.renderSorter();

          // Render Cesium
          this.renderMap();
        } catch (e) {
          console.log(
            "There was an error rendering the CatalogSearchView:" + e
          );
          this.renderError();
        }
      },

      /**
       * Renders the search filters
       * @since 2.22.0
       */
      renderFilters: function () {
        try {
          // Render FilterGroups
          this.filterGroupsView = new FilterGroupsView({
            filterGroups: this.filterGroups,
            filters: this.connector?.get("filters"),
            vertical: true,
            parentView: this,
            initialQuery: this.initialQuery,
          });

          // Add the FilterGroupsView element to this view
          this.$(this.filterGroupsContainer).html(this.filterGroupsView.el);

          // Render the FilterGroupsView
          this.filterGroupsView.render();
        } catch (e) {
          console.log("There was an error rendering the FilterGroupsView:" + e);
        }
      },

      /**
       * Creates the SearchResultsView and saves a reference to the SolrResults
       * collection
       * @since 2.22.0
       */
      createSearchResults: function () {
        try {
          this.searchResultsView = new SearchResultsView();

          if (this.connector) {
            this.searchResultsView.searchResults =
              this.connector.get("searchResults");
          }
        } catch (e) {
          console.log("There was an error creating the SearchResultsView:" + e);
        }
      },

      /**
       * Renders the search result list
       * @since 2.22.0
       */
      renderSearchResults: function () {
        try {
          if (!this.searchResultsView) return;

          // Add the view element to this view
          this.$(this.searchResultsContainer).html(this.searchResultsView.el);

          // Render the view
          this.searchResultsView.render();
        } catch (e) {
          console.log(
            "There was an error rendering the SearchResultsView:" + e
          );
        }
      },

      /**
       * Creates a PagerView and adds it to the page.
       * @since 2.22.0
       */
      renderPager: function () {
        try {
          this.pagerView = new PagerView();

          // Give the PagerView the SearchResults to listen to and update
          this.pagerView.searchResults = this.searchResultsView.searchResults;

          // Add the pager view to the page
          this.el
            .querySelector(this.pagerContainer)
            .replaceChildren(this.pagerView.el);

          // Render the pager view
          this.pagerView.render();
        } catch (e) {
          console.log("There was an error rendering the PagerView:" + e);
        }
      },

      /**
       * Creates a SorterView and adds it to the page.
       * @since 2.22.0
       */
      renderSorter: function () {
        try {
          this.sorterView = new SorterView();

          // Give the SorterView the SearchResults to listen to and update
          this.sorterView.searchResults = this.searchResultsView.searchResults;

          // Add the sorter view to the page
          this.el
            .querySelector(this.sorterContainer)
            .replaceChildren(this.sorterView.el);

          // Render the sorter view
          this.sorterView.render();
        } catch (e) {
          console.log("There was an error rendering the SorterView:" + e);
        }
      },

      /**
       * Constructs an HTML string of the title of this view
       * @param {number} start
       * @param {number} end
       * @param {number} numFound
       * @returns {string}
       * @since 2.22.0
       */
      titleTemplate: function (start, end, numFound) {
        try {
          let content = "";
          const csn = MetacatUI.appView.commaSeparateNumber;
          if (numFound < end) end = numFound;

          if (numFound > 0) {
            content = `<span>${csn(start)}</span> to <span>${csn(end)}</span>`;
            if (typeof numFound == "number") {
              content += ` of <span>${csn(numFound)}</span>`;
            }
          }
          return `
            <div id="statcounts">
              <h5 class="result-header-count bold-header" id="countstats">
              ${content}
              </h5>
            </div>`;
        } catch (e) {
          console.log("There was an error creating the title template:" + e);
          return "";
        }
      },

      /**
       * Updates the view title using the
       * {@link CatalogSearchView#searchResults} data.
       * @since 2.22.0
       */
      renderTitle: function () {
        try {
          const searchResults = this.searchResultsView.searchResults;
          let titleEl = this.el.querySelector(this.titleContainer);

          if (!titleEl) {
            titleEl = document.createElement("div");
            titleEl.classList.add("title-container");
            this.el.prepend(titleEl);
          }

          titleEl.innerHTML = "";

          let title = this.titleTemplate(
            searchResults.getStart() + 1,
            searchResults.getEnd() + 1,
            searchResults.getNumFound()
          );

          titleEl.insertAdjacentHTML("beforeend", title);
        } catch (e) {
          console.log("There was an error rendering the title:" + e);
        }
      },

      /**
       * Creates the Filter models and SolrResults that will be used for
       * searches
       * @since 2.22.0
       */
      setupSearch: function () {
        try {
          // Get an array of all Filter models
          let allFilters = [];
          this.filterGroups = this.createFilterGroups();
          this.filterGroups.forEach((group) => {
            allFilters = allFilters.concat(group.get("filters")?.models);
          });

          // Connect the filters to the search and search results
          let connector = new FiltersSearchConnector({
            filtersList: allFilters,
          });
          this.connector = connector;

          this.createSearchResults();

          this.createMap();
        } catch (e) {
          console.log("There was an error setting up the search:" + e);
        }
      },

      /**
       * Creates UI Filter Groups. UI Filter Groups are custom, interactive
       * search filter elements, grouped together in one panel, section, tab,
       * etc.
       * @param {FilterGroup#defaults[]} filterGroupsJSON An array of literal
       * objects to transform into FilterGroup models. These FilterGroups will
       * be displayed in this view and used for searching. If not provided, the
       * {@link AppConfig#defaultFilterGroups} will be used.
       * @since 2.22.0
       */
      createFilterGroups: function (filterGroupsJSON = this.filterGroupsJSON) {
        try {
          try {
            // Start an array for the FilterGroups and the individual Filter
            // models
            let filterGroups = [];

            // Iterate over each default FilterGroup in the app config and
            // create a FilterGroup model
            (
              filterGroupsJSON || MetacatUI.appModel.get("defaultFilterGroups")
            ).forEach((filterGroupJSON) => {
              // Create the FilterGroup model Add to the array
              filterGroups.push(new FilterGroup(filterGroupJSON));
            });

            return filterGroups;
          } catch (e) {
            console.error("Couldn't create Filter Groups in search. ", e);
          }
        } catch (e) {
          console.error("Couldn't create Filter Groups in search. ", e);
        }
      },

      /**
       * Create the models and views associated with the map and map search
       * @since 2.22.0
       */
      createMap: function () {
        try {
          const mapOptions = Object.assign(
            {},
            MetacatUI.appModel.get("catalogSearchMapOptions") || {}
          );
          const map = new Map(mapOptions);

          const geohashLayer = map
            .get("layers")
            .findWhere({ isGeohashLayer: true });

          // Connect the CesiumGeohash to the SolrResults
          const connector = new GeohashSearchConnector({
            cesiumGeohash: geohashLayer,
            searchResults: this.searchResultsView.searchResults,
          });
          connector.startListening();
          this.geohashSearchConnector = connector;

          // Set the geohash level for the search
          const searchFacet = this.searchResultsView.searchResults.facet;
          const newLevel = "geohash_" + geohashLayer.get("level");
          if (Array.isArray(searchFacet)) searchFacet.push(newLevel);
          else searchFacet = newLevel;

          // Create the Map model and view
          this.mapView = new MapView({ model: map });
        } catch (e) {
          console.error("Couldn't create map in search. ", e);
          this.toggleMode("list");
        }
      },

      /**
       * Renders the Cesium map with a geohash layer
       * @since 2.22.0
       */
      renderMap: function () {
        try {
          // Add the map to the page and render it
          this.$(this.mapContainer).empty().append(this.mapView.el);
          this.mapView.render();
        } catch (e) {
          console.error("Couldn't render map in search. ", e);
          this.toggleMode("list");
        }
      },

      /**
       * Linked Data Object for appending the jsonld into the browser DOM
       * @since 2.22.0
       */
      addLinkedData: function () {
        try {
          // JSON Linked Data Object
          let elJSON = {
            "@context": {
              "@vocab": "http://schema.org/",
            },
            "@type": "DataCatalog",
          };

          // Find the MN info from the CN Node list
          let members = MetacatUI.nodeModel.get("members"),
            nodeModelObject;

          for (let i = 0; i < members.length; i++) {
            if (
              members[i].identifier ==
              MetacatUI.nodeModel.get("currentMemberNode")
            ) {
              nodeModelObject = members[i];
            }
          }
          if (nodeModelObject) {
            // "keywords": "", "provider": "",
            let conditionalData = {
              description: nodeModelObject.description,
              identifier: nodeModelObject.identifier,
              image: nodeModelObject.logo,
              name: nodeModelObject.name,
              url: nodeModelObject.url,
            };
            $.extend(elJSON, conditionalData);
          }

          // Check if the jsonld already exists from the previous data view If
          // not create a new script tag and append otherwise replace the text
          // for the script
          if (!document.getElementById("jsonld")) {
            var el = document.createElement("script");
            el.type = "application/ld+json";
            el.id = "jsonld";
            el.text = JSON.stringify(elJSON);
            document.querySelector("head").appendChild(el);
          } else {
            var script = document.getElementById("jsonld");
            script.text = JSON.stringify(elJSON);
          }
        } catch (e) {
          console.error("Couldn't add linked data to search. ", e);
        }
      },

      /**
       * Toggles between map and list search mode
       * @param {string} newMode - Optionally provide the desired new mode to
       * switch to. If not provided, the opposite of the current mode will be
       * used.
       * @since 2.22.0
       */
      toggleMode: function (newMode) {
        try {
          let classList = document.querySelector("body").classList;

          // If the new mode is not provided, the new mode is the opposite of
          // the current mode
          newMode = newMode != "map" && newMode != "list" ? null : newMode;
          newMode = newMode || (this.mode == "map" ? "list" : "map");

          if (newMode == "list") {
            this.mode = "list";
            classList.remove("mapMode");
            classList.add("listMode");
          } else {
            this.mode = "map";
            classList.remove("listMode");
            classList.add("mapMode");
          }
        } catch (e) {
          console.error("Couldn't toggle search mode. ", e);
        }
      },

      /**
       * Tasks to perform when the view is closed
       * @since 2.22.0
       */
      onClose: function () {
        try {
          document
            .querySelector("body")
            .classList.remove(this.bodyClass, `${this.mode}Mode`);

          // Remove the JSON-LD from the page
          document.getElementById("jsonld")?.remove();
        } catch (e) {
          console.error("Couldn't close search view. ", e);
        }
      },
    }
  );
});
