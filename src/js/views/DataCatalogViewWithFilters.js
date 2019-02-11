define(["jquery",
        "underscore",
        "backbone",
        "gmaps",
        "models/filters/SpatialFilter",
        "views/DataCatalogView",
        "text!templates/datacatalog.html",
        "nGeohash"
    ],
    function($, _, Backbone, gmaps, SpatialFilter, DataCatalogView, template, nGeohash) {

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
            
            /**
             * Override DataCatalogView.render() to render this view with filters
             * from the Filters collection
             */
            render: function() {
                var loadingHTML;
                var templateVars;
                var compiledEl;
                var tooltips;
                var groupedTooltips;
                var forFilterLabel = true;
                var forOtherElements = false;
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
                compiledEl = 
                    this.template(_.extend(this.searchModel.toJSON(), templateVars));
                this.$el.html(compiledEl);

                // Store some references to key views that we use repeatedly
                this.$resultsview = this.$("#results-view");
                this.$results = this.$("#results");

                //Update stats
                this.updateStats();

                //Render the Google Map
                this.renderMap();
                //Initialize the tooltips
                tooltips = $(".tooltip-this");

                //Find the tooltips that are on filter labels - add a slight delay to those
                groupedTooltips = _.groupBy(tooltips, function(t) {
                    return ((($(t).prop("tagName") == "LABEL") || 
                        ($(t).parent().prop("tagName") == "LABEL")) && 
                        ($(t).parents(".filter-container").length > 0))
                });

                $(groupedTooltips[forFilterLabel]).tooltip({
                    delay: {
                        show: "800"
                    }
                });
                $(groupedTooltips[forOtherElements]).tooltip();

                //Initialize all popover elements
                $(".popover-this").popover();

                //Initialize the resizeable content div
                $("#content").resizable({
                    handles: "n,s,e,w"
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
                
                // Listen to changes in the Search model Filters to trigger a search
                this.stopListening(this.searchModel.get("filters"), "change");
                this.listenTo(this.searchModel.get("filters"), "change, add", this.triggerSearch);
                
                // Listen to the MetacatUI.appModel for the search trigger
                this.listenTo(MetacatUI.appModel, "search", this.getResults);

                this.listenTo(MetacatUI.appUserModel, "change:loggedIn", this.triggerSearch);

                // and go to a certain page if we have it
                this.getResults();

                //Set a custom height on any elements that have the .auto-height class
                if ($(".auto-height").length > 0) {
                    //Readjust the height whenever the window is resized
                    $(window).resize(this.setAutoHeight);
                    $(".auto-height-member").resize(this.setAutoHeight);
                }

                if (MetacatUI.appModel.get("bioportalAPIKey")) {
                    this.setUpTree();
                }

                return this;
            },
            
            /*
             * Get Results from the Solr index by combining the Filter query string fragments
             * in each Filter instance in the Search collection and querying Solr.
             *
             * Overrides DataCatalogView.getResults().
             */
            getResults: function() {
                var sortOrder = this.searchModel.get("sortOrder");
                var query; // The full query string
                var geohashLevel; // The geohash level to search
                var page; // The page of search results to render
                
                if ( sortOrder ) {
                    this.searchResults.setSort(sortOrder);
                }
                
                //Specify which fields to retrieve
                var fields = []; 
                    fields.push("id");
                    fields.push("seriesId");
                    fields.push("title");
                    fields.push("origin");
                    fields.push("pubDate");
                    fields.push("dateUploaded");
                    fields.push("abstract");
                    fields.push("resourceMap");
                    fields.push("beginDate");
                    fields.push("endDate");
                    fields.push("read_count_i");
                    fields.push("geohash_9");
                    fields.push("datasource");
                    fields.push("isPublic");
                    fields.push("documents");
                // Add spatial fields if the map is present
                if ( gmaps ) {
                    fields.push("northBoundCoord");
                    fields.push("southBoundCoord");
                    fields.push("eastBoundCoord");
                    fields.push("westBoundCoord");
                }
                this.searchResults.setfields(fields.join(","));
                
                // Get the Solr query string from the Search filter collection
                query = this.searchModel.get("filters").getQuery();
                
                // Specify which geohash level is used to return tile counts
                if ( gmaps && this.map ) {
                    geohashLevel = "geohash_" +
                        this.mapModel.determineGeohashLevel(this.map.zoom);
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

                var currentFilters = this.searchModel.get("filters").getCurrentFilters();

                if (currentFilters && currentFilters.length > 0) {
                    this.showClearButton();
                } else {
                    this.hideClearButton();
                }
            },
            
            /**
             * Reset the map to the defaults
             */
            resetMap: function() {
                if (!gmaps) {
                    return;
                }
                
                // Remove the SpatialFilter from the collection silently
                // so we don't immediately trigger a new search
                this.searchModel.get("filters").remove(
                    this.searchModel.get("filters").where({type: "SpatialFilter"}),
                    {"silent": true}
                );
                
                // Reset the map options to defaults
                this.mapModel.set("mapOptions", this.mapModel.defaults().mapOptions);
                this.allowSearch = false;
            },
            
            /**
             * Render the map based on the mapModel properties and search results
             */
            renderMap: function() {
                
                // If gmaps isn't enabled or loaded with an error, use list mode
                if (!gmaps || this.mode == "list") {
                    this.ready = true;
                    this.mode = "list";
                    return;
                }
                
                // The spatial filter instance used to constrain the search by zoom and extent
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
                var catalogViewRef;
                
                if (this.isSubView) {
                    this.$el.addClass("mapMode");
                } else {
                    $("body").addClass("mapMode");
                }

                // Get the map options and create the map
                gmaps.visualRefresh = true;
                mapOptions = this.mapModel.get("mapOptions");
                $("#map-container").append("<div id='map-canvas'></div>");
                this.map = new gmaps.Map($("#map-canvas")[0], mapOptions);
                this.mapModel.set("map", this.map);

                // Hide the map filter toggle element
                this.$(this.mapFilterToggle).hide();

                // Get the existing spatial filter if it exists
                if (this.searchModel.get("filters") && 
                    this.searchModel.get("filters")
                        .where({type: "SpatialFilter"}).length > 0) {
                    spatialFilter = this.searchModel.get("filters")
                        .where({type: "SpatialFilter"})[0];
                } else {
                    spatialFilter = new SpatialFilter();
                }
                
                // Store references
                mapRef = this.map;
                catalogViewRef = this;
                
                // Listen to idle events on the map (at rest), and render content as needed
                google.maps.event.addListener(mapRef, "idle", function() {
                    catalogViewRef.ready = true;

                    // Remove all markers from the map
                    for (var i = 0; i < catalogViewRef.resultMarkers.length; i++) {
                        catalogViewRef.resultMarkers[i].setMap(null);
                    }
                    catalogViewRef.resultMarkers = new Array();
                    
                    // Trigger a resize so the map background image tiles load completely
                    google.maps.event.trigger(mapRef, "resize");

                    var currentMapCenter = catalogViewRef.mapModel.get("map").getCenter(),
                        savedMapCenter = catalogViewRef.mapModel.get("mapOptions").center,
                        needsRecentered = (currentMapCenter != savedMapCenter);
                        
                    // If we are doing a new search
                    if ( catalogViewRef.allowSearch ) {
                        
                        // If the map is at the minZoom, i.e. zoomed out all the way so the whole world is visible, do not apply the spatial filter
                        if (catalogViewRef.map.getZoom() == mapOptions.minZoom) {
                            if (!catalogViewRef.hasZoomed) {
                                if (needsRecentered && !catalogViewRef.hasDragged) {
                                    catalogViewRef.mapModel.get("map").setCenter(savedMapCenter);
                                }
                                return;
                            }

                            //Hide the map filter toggle element
                            catalogViewRef.$(catalogViewRef.mapFilterToggle).hide();

                            catalogViewRef.resetMap();
                        } else {
                            // If the user has not zoomed or dragged to a new area of the map yet
                            // and our map is off-center, recenter it
                            if (!catalogViewRef.hasZoomed && needsRecentered) {
                                catalogViewRef.mapModel.get("map").setCenter(savedMapCenter);
                            }

                            // Show the map filter toggle element
                            catalogViewRef.$(catalogViewRef.mapFilterToggle).show();
                            
                            // Get the Google map bounding box
                            boundingBox = mapRef.getBounds();

                            // Set the search model's spatial filter properties
                            // Encode the Google Map bounding box into geohash
                            if ( typeof boundingBox !== "undefined") {
                                north = boundingBox.getNorthEast().lat();
                                west = boundingBox.getSouthWest().lng();
                                south = boundingBox.getSouthWest().lat();
                                east = boundingBox.getNorthEast().lng();
                            }

                            // Save the center position and zoom level of the map
                            catalogViewRef.mapModel.get("mapOptions").center = mapRef.getCenter();
                            catalogViewRef.mapModel.get("mapOptions").zoom = mapRef.getZoom();

                            // Determine the precision of geohashes to search for
                            zoom = mapRef.getZoom();

                            precision = catalogViewRef.mapModel.getSearchPrecision(zoom);

                            // Get all the geohash tiles contained in the map bounds
                            if ( south && west && north && east && precision )  {
                                geohashBBoxes = nGeohash.bboxes(south, west, north, east, precision);
                            }

                            // Save our geohash search settings
                            spatialFilter.set({
                                "geohashes": geohashBBoxes,
                                "geohashLevel": precision,
                                "north": north,
                                "west": west,
                                "south": south,
                                "east": east,
                            });
                            catalogViewRef.searchModel.get("filters").add(spatialFilter);
                        }
                        // Reset to the first page
                        if (catalogViewRef.hasZoomed) {
                            MetacatUI.appModel.set("page", 0);
                        }
                        catalogViewRef.allowSearch = false;
                        
                    } else {
                        // Else, if this is the fresh map render on page load
                        if (needsRecentered && !catalogViewRef.hasDragged) {
                            catalogViewRef.mapModel.get("map").setCenter(savedMapCenter);
                        }

                        //Show the map filter toggle element
                        if (catalogViewRef.map.getZoom() > mapOptions.minZoom) {
                            catalogViewRef.$(catalogViewRef.mapFilterToggle).show();
                        }
                    }
                    
                    catalogViewRef.hasZoomed = false;
                });
                
                // When the user has zoomed the map, trigger a new search, idle event follows
                google.maps.event.addListener(mapRef, "zoom_changed", function() {
                    catalogViewRef.allowSearch = true;
                    catalogViewRef.hasZoomed = true;
                    
                });
                
                // When the user has dragged the map, don't load cached results.
                // We still may not trigger a new search because the user has to zoom in first,
                // after the map initially loads at full-world view. Idel event follows
                google.maps.event.addListener(mapRef, "dragend", function() {
                    catalogViewRef.hasDragged = true;
                    if (catalogViewRef.map.getZoom() > mapOptions.minZoom) {
                        catalogViewRef.hasZoomed = true;
                        catalogViewRef.allowSearch = true;
                    }
                });
            }
        });
        return DataCatalogViewWithFilters;
    });