/*global define */
define(["jquery",
        "jqueryui",
        "backbone",
        "collections/maps/MapAssets",
        "models/filters/FilterGroup",
        "models/connectors/Filters-Search",
        "models/maps/CesiumGeohash",
        "models/maps/Map",
        "views/search/SearchResultsView",
        "views/filters/FilterGroupsView",
        "views/maps/MapView",
    ],
function($, $ui, Backbone, MapAssets, FilterGroup, FiltersSearchConnector, CesiumGeohash, Map, SearchResultsView, FilterGroupsView, MapView){

    "use strict";

    /**
    * @class CatalogSearchView
    * @classcategory Views
    * @extends Backbone.View
    * @constructor
    */
    return Backbone.View.extend(
      /** @lends Backbone.View.prototype */ {

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
            <div class="search-results-container"></div>
            <div class="map-container"></div>
        </section>
    `,

    mode: "",

    searchResults: null,

    filterGroupsView: null,

    searchModel: null,

    allFilters: null,

    filterGroups: null,

    /** 
     * @type {FilterGroup#defaults[]} filterGroupsJSON 
     * An array of literal objects to transform into FilterGroup models. These FilterGroups will be displayed in this view and used for searching. If not provided, the {@link AppConfig#defaultFilterGroups} will be used.
     */
    filterGroupsJSON: null,


    /**
    * The jQuery selector for the FilterGroupsView container
    * @type {string}
    */
    filterGroupsContainer: ".filter-groups-container",

    /**
    * The jQuery selector for the SearchResultsView container
    * @type {string}
    */
     searchResultsContainer: ".search-results-container",

    /**
    * The jQuery selector for the CesiumWidgetView container
    * @type {string}
    */
    mapContainer: ".map-container",

     /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    render: function(){

        //Set the search mode - either map or list
        this.setMode();

        //Set up the view for styling and layout
        this.setupView();

        //Set up the search and search result models
        this.setupSearch();

        //Render the search components
        this.renderComponents();

    },

    setupView: function(){
        $("body").addClass(`catalog-search-body ${this.mode}Mode`);

        this.$el.html(this.template);

        //Add to #Content
        $("#Content").html(this.el);
    },

    setMode: function(){
        //Get the search mode - either "map" or "list"
        if ((typeof this.mode === "undefined") || !this.mode) {
            this.mode = MetacatUI.appModel.get("searchMode");
            if ((typeof this.mode === "undefined") || !this.mode) {
                this.mode = "map";
            }
            MetacatUI.appModel.set("searchMode", this.mode);
        }

        // Use map mode on tablets and browsers only
        if ($(window).outerWidth() <= 600) {
            this.mode = "list";
        }
    },

    renderComponents: function(){
        this.renderFilters();

        this.renderSearchResults();

        //Render Pager

        //Render Sorter

        //Render Cesium
        this.renderMap();
    },

    renderFilters: function(){
        //Render FilterGroups
        this.filterGroupsView = new FilterGroupsView({
            filterGroups: this.filterGroups,
            filters: this.connector?.get("filters"),
            vertical: true,
            parentView: this
        });

        //Add the FilterGroupsView element to this view
        this.$(this.filterGroupsContainer).html(this.filterGroupsView.el);

        //Render the FilterGroupsView
        this.filterGroupsView.render();
    },

    createSearchResults: function(){
        this.searchResultsView = new SearchResultsView();

        if( this.connector )
            this.searchResultsView.searchResults = this.connector.get("searchResults")
    },

    renderSearchResults: function(){
        if(!this.searchResultsView) return;

        //Add the view element to this view
        this.$(this.searchResultsContainer).html(this.searchResultsView.el);

        //Render the view
        this.searchResultsView.render();
    },

    setupSearch: function(){

        //Get an array of all Filter models
        let allFilters = [];
        this.filterGroups = this.createFilterGroups();
        this.filterGroups.forEach(group => {
            allFilters = allFilters.concat(group.get("filters")?.models);
        });

        //Connect the filters to the search and search results
        let connector = new FiltersSearchConnector({ filtersList: allFilters });
        this.connector = connector;
        connector.startListening();

        this.createSearchResults();
    },

    /**
    * Creates UI Filter Groups. UI Filter Groups
    * are custom, interactive search filter elements, grouped together in one
    * panel, section, tab, etc.
    * @param {FilterGroup#defaults[]} filterGroupsJSON An array of literal objects to transform into FilterGroup models. These FilterGroups will be displayed in this view and used for searching. If not provided, the {@link AppConfig#defaultFilterGroups} will be used.
    */
    createFilterGroups: function(filterGroupsJSON=this.filterGroupsJSON){

        try{
            //Start an array for the FilterGroups and the individual Filter models
            let filterGroups = [];

            //Iterate over each default FilterGroup in the app config and create a FilterGroup model
            (filterGroupsJSON || MetacatUI.appModel.get("defaultFilterGroups")).forEach( filterGroupJSON => {

                //Create the FilterGroup model
                //Add to the array
                filterGroups.push(new FilterGroup(filterGroupJSON));

            });

            return filterGroups;
        }
        catch(e){
            console.error("Couldn't create Filter Groups in search. ", e)
        }

    },

    renderMap: function(){
        let mapOptions = Object.assign({}, MetacatUI.appModel.get("catalogSearchMapOptions") || {});
        let assets = new MapAssets();
        assets.add(new CesiumGeohash());
        mapOptions.layers = assets;
        
        let map = new Map(mapOptions);
        this.mapView = new MapView();
        this.mapView.model = map;
        
        this.$(this.mapContainer).empty().append(this.mapView.el);
        this.mapView.render();
        this.mapView.widgetView
    },

    onClose: function(){
        $("body").removeClass(`catalog-search-body ${this.mode}Mode`); 
    }

});

});