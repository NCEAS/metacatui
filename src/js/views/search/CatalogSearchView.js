/*global define */
define(["jquery",
        "backbone",
        "collections/maps/MapAssets",
        "models/filters/FilterGroup",
        "models/connectors/Filters-Search",
        "models/maps/assets/Geohash",
        "models/maps/Map",
        "views/search/SearchResultsView",
        "views/filters/FilterGroupsView",
        "views/maps/MapView",
        "views/search/PagerView"
    ],
function($, Backbone, MapAssets, FilterGroup, FiltersSearchConnector, CesiumGeohash, Map, SearchResultsView, FilterGroupsView, MapView, PagerView){

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
            <div>
                <div class="pager-container"></div>
                <div class="search-results-container"></div>
            </div>
            <div class="map-container"></div>
        </section>
    `,

    /**
     * The search mode to use. This can be set to either `map` or `list`. List mode will hide all map features.
     * @type string
     * @since 2.X
     * @default "map"
     */
    mode: "map",

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
    * The jQuery selector for the PagerView container
    * @type {string}
    */
    pagerContainer: ".pager-container",

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

        //Add LinkedData to the page
        this.addLinkedData();

        this.$el.html(this.template);

        //Add to #Content
        $("#Content").html(this.el);
    },

    setMode: function(){
        //Get the search mode - either "map" or "list"
        if ((typeof this.mode === "undefined") || !this.mode) {
            this.mode = "map";
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
        this.renderPager();

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

        if( this.connector ){
            this.searchResultsView.searchResults = this.connector.get("searchResults");
        }
    },

    renderSearchResults: function(){
        if(!this.searchResultsView) return;

        //Add the view element to this view
        this.$(this.searchResultsContainer).html(this.searchResultsView.el);

        //Render the view
        this.searchResultsView.render();
    },

    /**
     * Creates a PagerView and adds it to the page.
     */
    renderPager: function(){
        this.pagerView = new PagerView();
        
        //Give the PagerView the SearchResults to listen to and update
        this.pagerView.searchResults = this.searchResultsView.searchResults;

        //Add the pager view to the page
        this.el.querySelector(this.pagerContainer).replaceChildren(this.pagerView.el);

        //Render the pager view
        this.pagerView.render();
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

     /**
      * Linked Data Object for appending the jsonld into the browser DOM 
      * */ 
     addLinkedData: function() {

        // JSON Linked Data Object
        let elJSON = {
            "@context": {
                "@vocab": "http://schema.org/"
            },
            "@type": "DataCatalog",
        }

        // Find the MN info from the CN Node list
        let members = MetacatUI.nodeModel.get("members"),
            nodeModelObject;

        for (let i = 0; i < members.length; i++) {
            if (members[i].identifier == MetacatUI.nodeModel.get("currentMemberNode")) {
                nodeModelObject = members[i];
            }
        }
        if (nodeModelObject) {
            // "keywords": "",
            // "provider": "",
            let conditionalData = {
                "description": nodeModelObject.description,
                "identifier": nodeModelObject.identifier,
                "image": nodeModelObject.logo,
                "name": nodeModelObject.name,
                "url": nodeModelObject.url
            }
            $.extend(elJSON, conditionalData);
        }


        // Check if the jsonld already exists from the previous data view
        // If not create a new script tag and append otherwise replace the text for the script
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

    onClose: function(){
        $("body").removeClass(`catalog-search-body ${this.mode}Mode`); 
        
        //Remove the JSON-LD from the page
        document.getElementById("jsonld")?.remove();
    }

});

});