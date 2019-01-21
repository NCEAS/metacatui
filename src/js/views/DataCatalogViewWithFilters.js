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
            
            /* The main search collection, an instance of SolrResults */
            collection: null, // previously: searchResults
            
            /* The top level collection of filters used to build a query, an instance of Filters */
            filters: null, // previously: searchModel
            
            /* The map model used to configure the map */
            mapModel: null,
            
            /*
             * Get Results from the Solr index by combining the Filter query string fragments
             * in each Filter instance in the Search collection and querying Solr.
             *
             * Overrides DataCatalogView.getResults().
             */
            getResults: function() {
                var sortOrder = this.sortOrder || "dateUploaded+desc";
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