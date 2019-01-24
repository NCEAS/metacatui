define(["jquery",
        "underscore",
        "backbone",
        "gmaps",
        "views/DataCatalogView",
        "text!templates/datacatalog.html"
    ],
    function($, _, Backbone, gmaps, DataCatalogView, template) {

        /**
         * A DataCatalogView that uses the Search collection
         * and the Filter models for managing queries rather than the
         * Search model and the filter literal objects used in the
         * parent DataCatalogView.  This accommodates custom project filters.
         */
        var DataCatalogViewWithFilters = DataCatalogView.extend({

            /* The HTML template for this view */
            template: _.template(template),
            
            /* The sort order for the Solr query */
            sortOrder: "dateUploaded+desc",
            
            /* The top level collection of filters used to build a query, an instance of Filters */
            filters: null, // previously: searchModel
            
            /**
             * Override DataCatalogView.render() to render this view with filters
             * from the Filters collection
             */
            render: function() {
                var loadingHTML;
                var templateVars;
                
                // TODO: Do we really need to cache the filters collection? 
                // Reconcile this from DataCatalogView.render()
                // See https://github.com/NCEAS/metacatui/blob/19d608df9cc17ac2abee76d35feca415137c09d7/src/js/views/DataCatalogView.js#L122-L145
                
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
                //Populate the search template with some model attributes
                loadingHTML = this.loadingTemplate({
                    msg: "Loading entries ..."
                });
                
                templateVars = {
                    gmaps: gmaps,
                    mode: MetacatUI.appModel.get("searchMode"),
                    useMapBounds: this.searchModel.get("useGeohash"),
                    username: MetacatUI.appUserModel.get("username"),
                    isMySearch: (_.indexOf(this.searchModel.get("username"), MetacatUI.appUserModel.get("username")) > -1),
                    loading: loadingHTML,
                    searchModelRef: this.searchModel,
                    searchResultsRef: this.searchResults,
                    dataSourceTitle: (MetacatUI.theme == "dataone") ? "Member Node" : "Data source"
                }
            },
            
            /*
             * Get Results from the Solr index by combining the Filter query string fragments
             * in each Filter instance in the Search collection and querying Solr.
             *
             * Overrides DataCatalogView.getResults().
             */
            getResults: function() {
                var sortOrder = this.searchModel.sortOrder || "dateUploaded+desc";
                var query; // The full query string
                var geohashLevel; // The geohash level to search
                var page; // The page of search results to render
                
                if ( sortOrder ) {
                    this.searchResults.setSort(sortOrder);
                }
                
                //Specify which fields to retrieve
                var fields = ""; 
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
                // Add spatial fields if the map is present
                if ( gmaps ) {
                    fields += "northBoundCoord,";
                    fields += "southBoundCoord,";
                    fields += "eastBoundCoord,";
                    fields += "westBoundCoord";
                }
                // Strip the last trailing comma if needed
                if ( fields[fields.length - 1] === "," ) {
                    fields = fields.substr(0, fields.length - 1);
                }
                this.searchResults.setfields(fields);
                
                // Get the Solr query string from the Search filter collection
                query = this.filters.getQuery();
                
                // Specify which geohash level is used to return tile counts
                if ( gmaps && this.map ) {
                    geohashLevel = "geohash_" + this.mapModel.determineGeohashLevel(this.map.zoom);
                    this.searchResults.facet.push(geohashLevel);
                }
                
                // Run the query
                this.searchResults.setQuery(query);
                
                // Get the page number
                if ( this.isSubView ) {
                    page = 0;
                } else {
                    page = MetacatUI.appModel.get("page");
                    if ( page == null ) {
                        page = 0;
                    }
                }
                this.searchResults.start = page * this.searchResults.rows;
                
                //Show or hide the reset filters button
                this.toggleClearButton();

                // go to the page
                this.showPage(page);

                // don't want to follow links
                return false;
            },
            /*
             * Either hides or shows the "clear all filters" button
             */
            toggleClearButton: function() {

                var currentFilters = this.filters.getCurrentFilters();

                if (currentFilters && currentFilters.length > 0) {
                    this.showClearButton();
                } else {
                    this.hideClearButton();
                }
            }
        });
        return DataCatalogViewWithFilters;

    });