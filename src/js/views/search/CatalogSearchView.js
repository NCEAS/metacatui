/*global define */
define([
  "jquery",
  "backbone",
  "collections/maps/MapAssets",
  "models/filters/FilterGroup",
  "models/connectors/Filters-Search",
  "models/connectors/Geohash-Search",
  "models/maps/assets/CesiumGeohash",
  "models/maps/Map",
  "views/search/SearchResultsView",
  "views/filters/FilterGroupsView",
  "views/maps/MapView",
  "views/search/SearchResultsPagerView",
  "views/search/SorterView",
], function (
  $,
  Backbone,
  MapAssets,
  FilterGroup,
  FiltersSearchConnector,
  GeohashSearchConnector,
  CesiumGeohash,
  Map,
  SearchResultsView,
  FilterGroupsView,
  MapView,
  PagerView,
  SorterView
) {
  "use strict";

  /**
   * @class CatalogSearchView
   * @name CatalogSearchView
   * @classcategory Views
   * @extends Backbone.View
   * @constructor
   * @since 2.22.0
   */
  return Backbone.View.extend(
    /** @lends CatalogSearchView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "CatalogSearch",

      /**
       * The HTML tag to use for this view's element
       * @type {string}
       */
      tagName: "section",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "catalog-search-view",

      template: `
        <section class="catalog-search-inner">
            <div class="filter-groups-container"></div>
            <div class="search-results-panel-container">
                <div class="map-toggle-container">
                  <a class="toggle-map">
                    <i class="icon icon-double-angle-left"></i> Show Map
                  </a></div>
                <div class="title-container"></div>
                <div class="pager-container"></div>
                <div class="sorter-container"></div>
                <div class="search-results-container"></div>
            </div>
            <div class="map-panel-container">
                <div class="map-toggle-container">
                  <a class="toggle-map">
                    Hide Map <i class="icon icon-double-angle-right"></i>
                  </a>
                </div>
                <div class="map-container"></div>
            </div>
        </section>
    `,

      /**
       * The search mode to use. This can be set to either `map` or `list`. List
       * mode will hide all map features.
       * @type string
       * @since 2.22.0
       * @default "map"
       */
      mode: "map",

      searchResults: null,

      filterGroupsView: null,

      /**
       * @type {PagerView}
       */
      pagerView: null,

      /**
       * @type {SorterView}
       */
      sorterView: null,

      searchModel: null,

      allFilters: null,

      filterGroups: null,

      /**
       * An array of literal objects to transform into FilterGroup models. These
       * FilterGroups will be displayed in this view and used for searching. If
       * not provided, the {@link AppConfig#defaultFilterGroups} will be used.
       * @type {FilterGroup#defaults[]}
       */
      filterGroupsJSON: null,

      /**
       * The jQuery selector for the FilterGroupsView container
       * @type {string}
       */
      filterGroupsContainer: ".filter-groups-container",

      /**
       * The query selector for the SearchResultsView container
       * @type {string}
       */
      searchResultsContainer: ".search-results-container",

      /**
       * The query selector for the CesiumWidgetView container
       * @type {string}
       */
      mapContainer: ".map-container",

      /**
       * The query selector for the PagerView container
       * @type {string}
       */
      pagerContainer: ".pager-container",

      /**
       * The query selector for the SorterView container
       * @type {string}
       */
      sorterContainer: ".sorter-container",

      /**
       * The query selector for the title container
       * @type {string}
       */
      titleContainer: ".title-container",

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {Object}
       */
      events: {
        "click .map-toggle-container": "toggleMode",
      },

      render: function () {
        // Set the search mode - either map or list
        this.setMode();

        // Set up the view for styling and layout
        this.setupView();

        // Set up the search and search result models
        this.setupSearch();

        // Render the search components
        this.renderComponents();
      },

      /**
       * Sets up the basic components of this view
       */
      setupView: function () {
        document
          .querySelector("body")
          .classList.add(`catalog-search-body`, `${this.mode}Mode`);

        // Add LinkedData to the page
        this.addLinkedData();

        this.$el.html(this.template);
      },

      /**
       * Sets the search mode (map or list)
       * @since 2.22.0
       */
      setMode: function () {
        // Get the search mode - either "map" or "list"
        if (
          (typeof this.mode === "undefined" || !this.mode) &&
          MetacatUI.appModel.get("enableCesium")
        ) {
          this.mode = "map";
        }

        // Use map mode on tablets and browsers only
        if ($(window).outerWidth() <= 600) {
          this.mode = "list";
        }
      },

      renderComponents: function () {
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
      },

      /**
       * Renders the search filters
       * @since 2.22.0
       */
      renderFilters: function () {
        // Render FilterGroups
        this.filterGroupsView = new FilterGroupsView({
          filterGroups: this.filterGroups,
          filters: this.connector?.get("filters"),
          vertical: true,
          parentView: this,
        });

        // Add the FilterGroupsView element to this view
        this.$(this.filterGroupsContainer).html(this.filterGroupsView.el);

        // Render the FilterGroupsView
        this.filterGroupsView.render();
      },

      /**
       * Creates the SearchResultsView and saves a reference to the SolrResults
       * collection
       * @since 2.22.0
       */
      createSearchResults: function () {
        this.searchResultsView = new SearchResultsView();

        if (this.connector) {
          this.searchResultsView.searchResults =
            this.connector.get("searchResults");
        }
      },

      /**
       * Renders the search result list
       * @since 2.22.0
       */
      renderSearchResults: function () {
        if (!this.searchResultsView) return;

        // Add the view element to this view
        this.$(this.searchResultsContainer).html(this.searchResultsView.el);

        // Render the view
        this.searchResultsView.render();
      },

      /**
       * Creates a PagerView and adds it to the page.
       * @since 2.22.0
       */
      renderPager: function () {
        this.pagerView = new PagerView();

        // Give the PagerView the SearchResults to listen to and update
        this.pagerView.searchResults = this.searchResultsView.searchResults;

        // Add the pager view to the page
        this.el
          .querySelector(this.pagerContainer)
          .replaceChildren(this.pagerView.el);

        // Render the pager view
        this.pagerView.render();
      },

      /**
       * Creates a SorterView and adds it to the page.
       * @since 2.22.0
       */
      renderSorter: function () {
        this.sorterView = new SorterView();

        // Give the SorterView the SearchResults to listen to and update
        this.sorterView.searchResults = this.searchResultsView.searchResults;

        // Add the sorter view to the page
        this.el
          .querySelector(this.sorterContainer)
          .replaceChildren(this.sorterView.el);

        // Render the sorter view
        this.sorterView.render();
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
        let html = `
          <div id="statcounts">
            <h5 class="result-header-count bold-header" id="countstats">
              <span>
              ${MetacatUI.appView.commaSeparateNumber(start)}
              </span> to <span>
              ${MetacatUI.appView.commaSeparateNumber(end)}
              </span>`;

        if (typeof numFound == "number") {
          html += ` of <span>
              ${MetacatUI.appView.commaSeparateNumber(numFound)}
            </span>`;
        }

        html += `</h5></div>`;
        return html;
      },

      /**
       * Updates the view title using the
       * {@link CatalogSearchView#searchResults} data.
       * @since 2.22.0
       */
      renderTitle: function () {
        let titleEl = this.el.querySelector(this.titleContainer);

        if (!titleEl) {
          titleEl = document.createElement("div");
          titleEl.classList.add("title-container");
          this.el.prepend(titleEl);
        }

        titleEl.innerHTML = "";

        let title = this.titleTemplate(
          this.searchResultsView.searchResults.getStart() + 1,
          this.searchResultsView.searchResults.getEnd() + 1,
          this.searchResultsView.searchResults.getNumFound()
        );

        titleEl.insertAdjacentHTML("beforeend", title);
      },

      /**
       * Creates the Filter models and SolrResults that will be used for
       * searches
       * @since 2.22.0
       */
      setupSearch: function () {
        // Get an array of all Filter models
        let allFilters = [];
        this.filterGroups = this.createFilterGroups();
        this.filterGroups.forEach((group) => {
          allFilters = allFilters.concat(group.get("filters")?.models);
        });

        // Connect the filters to the search and search results
        let connector = new FiltersSearchConnector({ filtersList: allFilters });
        this.connector = connector;
        connector.startListening();

        this.createSearchResults();

        this.createMap();
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
          // Start an array for the FilterGroups and the individual Filter models
          let filterGroups = [];

          // Iterate over each default FilterGroup in the app config and create a
          // FilterGroup model
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
      },

      /**
       * Create the models and views associated with the map and map search
       * @since 2.22.0
       */
      createMap: function () {
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
      },

      /**
       * Renders the Cesium map with a geohash layer
       * @since 2.22.0
       */
      renderMap: function () {
        // Add the map to the page and render it
        this.$(this.mapContainer).empty().append(this.mapView.el);
        this.mapView.render();
      },

      /**
       * Linked Data Object for appending the jsonld into the browser DOM
       * @since 2.22.0
       * */
      addLinkedData: function () {
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

        // Check if the jsonld already exists from the previous data view If not
        // create a new script tag and append otherwise replace the text for the
        // script
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
      },

      /**
       * Toggles between map and list search mode
       * @since 2.22.0
       */
      toggleMode: function () {
        let classList = document.querySelector("body").classList;

        if (this.mode == "map") {
          this.mode = "list";
          classList.remove("mapMode");
          classList.add("listMode");
        } else {
          this.mode = "map";
          classList.remove("listMode");
          classList.add("mapMode");
        }
      },

      onClose: function () {
        document
          .querySelector("body")
          .classList.remove(`catalog-search-body`, `${this.mode}Mode`);

        // Remove the JSON-LD from the page
        document.getElementById("jsonld")?.remove();
      },
    }
  );
});
