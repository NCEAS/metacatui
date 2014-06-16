/*global define */
define(['jquery',
				'jqueryui', 
				'underscore', 
				'backbone',
				'views/SearchResultView',
				'text!templates/search.html',
				'text!templates/statCounts.html',
				'text!templates/pager.html',
				'text!templates/resultsItem.html',
				'text!templates/mainContent.html',
				'text!templates/currentFilter.html',
				'gmaps',
				'nGeohash',
				'markerClusterer'
				], 				
	function($, $ui, _, Backbone, SearchResultView, CatalogTemplate, CountTemplate, PagerTemplate, ResultItemTemplate, MainContentTemplate, CurrentFilterTemplate, gmaps, nGeohash, MarkerClusterer) {
	'use strict';
	
	var DataCatalogView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(CatalogTemplate),
		
		statsTemplate: _.template(CountTemplate),
		
		pagerTemplate: _.template(PagerTemplate),

		resultTemplate: _.template(ResultItemTemplate),
		
		mainContentTemplate: _.template(MainContentTemplate),
		
		currentFilterTemplate: _.template(CurrentFilterTemplate),
		
		map: null,
		
		ready: false,
		
		allowSearch: true,
		
		hasZoomed: false,
				
		markers: {},
		
		markerClusterer: {},
		
		tiles: [],
		
		tileCounts: [],
		
		markerGeohashes: [],
		
		markerInfoWindows: [],
		
		tileInfoWindows: [],
		
		tileGeohashes: [],
		
		reservedMapPhrase: 'Only results with all spatial coverage inside the map',
		
		// Delegated events for creating new items, and clearing completed ones.
		events: {
							'click #results_prev' : 'prevpage',
							'click #results_next' : 'nextpage',
					 'click #results_prev_bottom' : 'prevpage',
					 'click #results_next_bottom' : 'nextpage',
			       			   'click .pagerLink' : 'navigateToPage',
							  'click .filter.btn' : 'updateTextFilters',
						  'keypress input.filter' : 'triggerOnEnter',
							  'change #sortOrder' : 'triggerSearch',
							   'change #min_year' : 'updateYearRange',
							   'change #max_year' : 'updateYearRange',
			                'click #publish_year' : 'updateYearRange',
			                   'click #data_year' : 'updateYearRange', 
						   'click .remove-filter' : 'removeFilter',
			'click input[type="checkbox"].filter' : 'updateBooleanFilters',
							   'click #clear-all' : 'resetFilters',
					'click a.keyword-search-link' : 'additionalCriteria',
				   'click .remove-addtl-criteria' : 'removeAdditionalCriteria',
				   			 'click .collapse-me' : 'collapse',
				   			  'click #toggle-map' : 'toggleMapMode',
				   			   'click .view-link' : 'routeToMetadata',
				   		 'mouseover .open-marker' : 'openMarker',
				   	      'mouseout .open-marker' : 'closeMarker',
		      'mouseover .prevent-popover-runoff' : 'preventPopoverRunoff'
		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {

			console.log('Rendering the DataCatalog view');
			appModel.set('headerType', 'default');
		
			
			//Populate the search template with some model attributes
			var cel = this.template(
					{
						sortOrder: searchModel.get('sortOrder'),
						yearMin: searchModel.get('yearMin'),
						yearMax: searchModel.get('yearMax'),
						pubYear: searchModel.get('pubYear'),
						dataYear: searchModel.get('dataYear'),
						resourceMap: searchModel.get('resourceMap'),
						searchOptions: registryModel.get('searchOptions'),
						username: appModel.get('username')
					}
			);
			
			
			this.$el.html(cel);
			this.updateStats();		
			

			//Render the Google Map
			this.renderMap();	
			
			//Initialize the tooltips
			$('.tooltip-this').tooltip();
			$('.popover-this').popover();
			
			//Initialize the resizeable content div
			$('#content').resizable({handles: "n,s,e,w"});
			
			//Initialize the jQueryUI button checkboxes
			$( "#filter-year" ).buttonset();
			$( "#includes-files-buttonset" ).buttonset();
			
			//Update the year slider
			this.updateYearRange(); 
			
			//Iterate through each search model text attribute and show UI filter for each
			var categories = ['all', 'creator', 'taxon', 'characteristic', 'standard'];
			var thisTerm = null;
			
			for (var i=0; i<categories.length; i++){
				thisTerm = searchModel.get(categories[i]);
				
				if(thisTerm === undefined) break;
				
				for (var x=0; x<thisTerm.length; x++){
					this.showFilter(categories[i], thisTerm[x]);
				}
			}			
			// the additional fields
			this.showAdditionalCriteria();
			
			// Add the custom query under the "Anything" filter
			if(searchModel.get('customQuery')){
				this.showFilter("all", searchModel.get('customQuery'));
			}
			
			// Register listeners; this is done here in render because the HTML
			// needs to be bound before the listenTo call can be made
			this.stopListening(appSearchResults);
			this.listenTo(appSearchResults, 'add', this.addOne);
			this.listenTo(appSearchResults, 'reset', this.addAll);
			
			//Listen to changes in the searchModel
			this.stopListening(searchModel);
			
			// listen to the appModel for the search trigger
			this.stopListening(appModel);
			this.listenTo(appModel, 'search', this.showResults);

			// Store some references to key views that we use repeatedly
			this.$resultsview = this.$('#results-view');
			this.$results = this.$('#results');
			
			// show the results by default
			console.log("Backbone.history.fragment=" + Backbone.history.fragment);
			
			// and go to a certain page if we have it
			this.showResults();		

			return this;
		},
		
		renderMap: function() {
			
			//If gmaps isn't enabled or loaded with an error, use list mode
			if (!gmaps) {
				this.ready = true;
				appModel.set('searchMode', 'list');
				return;
			}		

			// If the list mode is currently in use, no need to render the map
			if(appModel.get('searchMode') == 'list'){
				this.ready = true;
				return;
			}
			
			$("body").addClass("mapMode");				
				
			gmaps.visualRefresh = true;
			var mapOptions = mapModel.get('mapOptions');
			this.map = new gmaps.Map($('#map-canvas')[0], mapOptions);

			var mapRef = this.map;
			var viewRef = this;

			google.maps.event.addListener(mapRef, "idle", function(){
			
				viewRef.ready = true;
				
				if(viewRef.allowSearch){
					
					//If the map is at the minZoom, i.e. zoomed out all the way so the whole world is visible, do not apply the spatial filter
					if(viewRef.map.getZoom() == mapOptions.minZoom){
						if(!viewRef.hasZoomed){
							return;
						}	
						viewRef.resetMap();	
					}
					else{
						console.log("zoom level " + viewRef.map.getZoom());
						
						//Get the Google map bounding box
						var boundingBox = mapRef.getBounds();
						
						//Set the search model spatial filters
						searchModel.set('north', boundingBox.getNorthEast().lat());
						searchModel.set('west',  boundingBox.getSouthWest().lng());
						searchModel.set('south', boundingBox.getSouthWest().lat());
						searchModel.set('east',  boundingBox.getNorthEast().lng());
						
						//Determine the precision of geohashes to search for
						var zoom = mapRef.getZoom(),
							precision;
						
						if(zoom <= 5) precision = 2;
						else if(zoom <= 7) precision = 3;
						else if (zoom <= 11) precision = 4;
						else if (zoom <= 13) precision = 5;
						else if (zoom <= 15) precision = 6;
						else if (zoom <= 19) precision = 7;
						
						//Encode the Google Map bounding box into geohash
						var geohashNorth = boundingBox.getNorthEast().lat(),
							geohashWest  = boundingBox.getSouthWest().lng(),
							geohashSouth = boundingBox.getSouthWest().lat(),
							geohashEast	 = boundingBox.getNorthEast().lng(),
							geohashBBoxes = nGeohash.bboxes(geohashSouth, geohashWest, geohashNorth, geohashEast, precision);
						
						//Save our geohash search settings
						searchModel.set('geohashes', geohashBBoxes);
						searchModel.set('geohashLevel', precision);
						
						//Set the search model map filters
						searchModel.set('map', {
							zoom: viewRef.map.getZoom(), 
							center: viewRef.map.getCenter()
							});
						
						//Add a new visual 'current filter' to the DOM for the spatial search
						viewRef.showFilter('spatial', viewRef.reservedMapPhrase, true);
					}
					
					//Trigger a new search
					viewRef.triggerSearch();	
				}
				else{
					viewRef.allowSearch = true;
				}
				
				viewRef.hasZoomed = false;
			});
			
			//Let the view know we have zoomed on the map
			google.maps.event.addListener(mapRef, "zoom_changed", function(){
				viewRef.allowSearch = true;
				viewRef.hasZoomed = true;
			});

		},
		
		//Resets the model and view settings related to the map
		resetMap : function(){
			if(!gmaps){
				return;
			}
			
			//First reset the model
			//The categories pertaining to the map
			var categories = ["east", "west", "north", "south"];
			
			//Loop through each and remove the filters from the model
			for(var i = 0; i < categories.length; i++){
				searchModel.set(categories[i], null);				
			}
			
			//Reset the map settings
			mapModel.clear();
			
			this.allowSearch = false;
			
			
			//Remove the map filter in the UI
			this.hideFilter($('#current-spatial-filters').find('[data-term="'+ this.reservedMapPhrase +'"]'));
		},
		
		triggerSearch: function() {	
			console.log('Search triggered');			
			
			//Set the sort order 
			var sortOrder = $("#sortOrder").val();
			searchModel.set('sortOrder', sortOrder);
			
			//Trigger a search to load the results
			appModel.trigger('search');
			
			// make sure the browser knows where we are
			var route = Backbone.history.fragment;
			if (route.indexOf("data") < 0) {
				uiRouter.navigate("data");
			} else {
				uiRouter.navigate(route);
			}
			
			// ...but don't want to follow links
			return false;
		},
		
		triggerOnEnter: function(e) {
			if (e.keyCode != 13) return;
			
			//Update the filters
			this.updateTextFilters(e);
		},
		
		/* 
		 * showResults gets all the current search filters from the searchModel, creates a Solr query, and runs that query.
		 */
		showResults: function (page) {
			console.log('showing results');
			
			//Get the page number
			var page = appModel.get("page");
			if (page == null) {
				page = 0;
			}
			
			//Style the UI as loading
			this.loading();
			
			//Set the sort order based on user choice
			var sortOrder = searchModel.get('sortOrder');
			appSearchResults.setSort(sortOrder);
			
			//Specify which fields to retrieve
			var fields = "id,title,origin,pubDate,dateUploaded,abstract,resourceMap,beginDate,endDate,read_count_i,geohash_9";
			if(gmaps){
				fields += ",northBoundCoord,southBoundCoord,eastBoundCoord,westBoundCoord";
			}
			appSearchResults.setfields(fields);
			
			//Get the query
			var query = searchModel.getQuery();
			
			//Specify which facets to retrieve
			if(gmaps){ //If we have Google Maps enabled
				var geohashes = ["geohash_1", "geohash_2", "geohash_3", "geohash_4", "geohash_5", "geohash_6", "geohash_7", "geohash_8", "geohash_9"]
			    appSearchResults.facet = _.union(appSearchResults.facet, geohashes);
			}
			
			//Run the query
			appSearchResults.setQuery(query);
			
			//Show or hide the reset filters button
			if(searchModel.filterCount() > 0){
				$('#clear-all').css('display', 'block');
			}
			else{
				$('#clear-all').css('display', 'none');
			}				
			
			// go to the page
			this.showPage(page);
			
			// don't want to follow links
			return false;
		},
		
		updateBooleanFilters : function(e){
			//Get the category
			var category = $(e.target).attr('data-category');
			
			//Get the check state
			var state = $(e.target).prop('checked');

			//Update the model
			searchModel.set(category, state);
			
			//Show the reset button
			$('#clear-all').css('display', 'block');
			
			//Route to page 1
			this.updatePageNumber(0);
			
			//Trigger a new search
			this.triggerSearch();
		},
		
		//Update the UI year slider and input values
		//Also update the model
		updateYearRange : function(e) {
			
			var viewRef = this;
			
			// Get the minimum and maximum values from the input fields
			var minVal = $('#min_year').val();
			var maxVal = $('#max_year').val();
			  
			//Get the default minimum and maximum values
			var defaultMinYear = searchModel.defaults.yearMin;
			var defaultMaxYear = searchModel.defaults.yearMax;
			
			// If either of the year type selectors is what brought us here, then determine whether the user
			// is completely removing both (reset both year filters) or just one (remove just that one filter)
			if((e !== undefined)){
				if(($(e.target).attr('id') == "data_year") || ($(e.target).attr('id') == "publish_year")){
					var pubYearChecked  = $('#publish_year').prop('checked');
					var dataYearChecked = $('#data_year').prop('checked');
					
					//When both are unchecked, assume user wants to reset the year filter
					if((!pubYearChecked) && (!dataYearChecked)){
						//Reset the search model
						searchModel.set('yearMin', defaultMinYear);
						searchModel.set('yearMax', defaultMaxYear);
						searchModel.set('dataYear', false);
						searchModel.set('pubYear', false);
						
						//Reset the number inputs
						$('#min_year').val(defaultMinYear);
						$('#max_year').val(defaultMaxYear);
						
						//Slide the handles back to the defaults
						$('#year-range').slider("values", [defaultMinYear, defaultMaxYear]);
						
						return;
					}
				}	
			}
			
			//If either of the year inputs have changed
			if((minVal != defaultMinYear) || (maxVal != defaultMaxYear)){
				
				//Update the search model to match what is in the text inputs
			    searchModel.set('yearMin', $('#min_year').val());
			    searchModel.set('yearMax', $('#max_year').val());	
			    
			    //auto choose the year type for the user
			    this.selectYearType();
			    
				  //Route to page 1
			      this.updatePageNumber(0);
				      
				 //Trigger a new search
				 this.triggerSearch();
			}

		      			
			//jQueryUI slider 
			$('#year-range').slider({
			    range: true,
			    disabled: false,
			    min: searchModel.defaults.yearMin,	//sets the minimum on the UI slider on initialization
			    max: searchModel.defaults.yearMax, 	//sets the maximum on the UI slider on initialization
			    values: [ searchModel.get('yearMin'), searchModel.get('yearMax') ], //where the left and right slider handles are
			    stop: function( event, ui ) {
			    	
			      // When the slider is changed, update the input values
			      $('#min_year').val(ui.values[0]);
			      $('#max_year').val(ui.values[1]);
			      
			      //Also update the search model
			      searchModel.set('yearMin', $('#min_year').val());
			      searchModel.set('yearMax', $('#max_year').val());
			      
			      viewRef.selectYearType();
			      
				  //Route to page 1
			      viewRef.updatePageNumber(0);
				      
				 //Trigger a new search
				 viewRef.triggerSearch();
			    } 
			    
			  });

		},
		
		selectYearType : function(autoSelect){
			
		      var pubYearChecked  = $('#publish_year').prop('checked');
			  var dataYearChecked = $('#data_year').prop('checked');
		    
			  // If neither the publish year or data coverage year are checked
		      if((!pubYearChecked) && (!dataYearChecked)){
		    	  
		    	  //We want to check the data coverage year on the user's behalf
		    	  $('#data_year').prop('checked', 'true');  
			    	  
		    	  //And update the search model
		    	  searchModel.set('dataYear', true);
		    	  
		    	  //refresh the UI buttonset so it appears as checked/unchecked
		    	  $("#filter-year").buttonset("refresh");
		      }
		},
		
		updateTextFilters : function(e){
			//Get the search/filter category
			var category = $(e.target).attr('data-category');
			
			//Try the parent elements if not found
			if(!category){
				var parents = $(e.target).parents().each(function(){
					category = $(this).attr('data-category');
					if (category){
						return false;
					}
				});
			}
			
			if(!category){ return false; }
			
			//Get the value of the associated input
			var input = this.$el.find($('#' + category + '_input'));
			var term = input.val();
			
			//Check that something was actually entered
			if((term == "") || (term == " ")){
				return false;
			}
			
			//Close the autocomplete box
			$('#' + category + '_input').autocomplete("close");
				
			//Get the current searchModel array for this category
			var filtersArray = _.clone(searchModel.get(category));
				
			//Check if this entry is a duplicate
			var duplicate = (function(){
				for(var i=0; i < filtersArray.length; i++){
					if(filtersArray[i] === term){ return true; }
				}
			})();
			
			if(duplicate){ 	
				//Display a quick message
				if($('#duplicate-' + category + '-alert').length <= 0){					
					$('#current-' + category + '-filters').prepend(
							'<div class="alert alert-block" id="duplicate-' + category + '-alert">' +
							'You are already using that filter' +
							'</div>'						
					);
					
					$('#duplicate-' + category + '-alert').delay(2000).fadeOut(500, function(){
						this.remove();
					});
				}
				
				return false; 
			}
				
			//Add the new entry to the array of current filters
			filtersArray.push(term);
			
			//Replace the current array with the new one in the search model
			searchModel.set(category, filtersArray);
			
			//Show the UI filter
			this.showFilter(category, term);
			
			//Clear the input
			input.val('');
			
			//Route to page 1
			this.updatePageNumber(0);
			
			//Trigger a new search
			this.triggerSearch();
		},
		
		//Removes a specific filter term from the searchModel
		removeFilter : function(e){			
			//Get the parent element that stores the filter term 
			var filterNode = $(e.target).parent();
			
			//Find this element's category in the data-category attribute of it's parent
			var category = filterNode.parent().attr('data-category');
			
			//Get the filter term
			var term = $(filterNode).attr('data-term');
			console.log('removing '+ term);	
			
			//Check if this is the reserved phrase for the map filter
			if((category == "spatial") && (term == this.reservedMapPhrase)){
				this.resetMap();
				this.renderMap();
			}
			else{
				//Remove this filter term from the searchModel
				this.removeFromModel(category, term);				
			}
			
			//Hide the filter from the UI
			this.hideFilter(filterNode);
			
			//Route to page 1
			this.updatePageNumber(0);
			
			//Trigger a new search
			this.triggerSearch();

		},
		
		//Clear all the currently applied filters
		resetFilters : function(){			
			var viewRef = this;
			
			console.log('Resetting the filters');
			
			this.allowSearch = true;
			
			//Clear all the filters in the UI
			this.$el.find('.current-filter').each(function(){
				viewRef.hideFilter(this);
			});
			
			//Then reset the model
			searchModel.clear().set(searchModel.defaults);		
			
			//Reset the year slider handles
			$("#year-range").slider("values", [searchModel.get('yearMin'), searchModel.get('yearMax')])
			//and the year inputs
			$("#min_year").val(searchModel.get('yearMin'));
			$("#max_year").val(searchModel.get('yearMax'));

			//Reset the checkboxes
			$("#includes_data").prop("checked", searchModel.get("resourceMap"));
			$("#includes-files-buttonset").buttonset("refresh");
			$("#data_year").prop("checked", searchModel.get("dataYear"));
			$("#publish_year").prop("checked", searchModel.get("pubYear"));
			$("#filter-year").buttonset("refresh");
			
			//Zoom out the Google Map
			this.resetMap();	
			this.renderMap();
		
			//Hide the reset button again
			$('#clear-all').css('display', 'none');
			
			// reset any filter links
			this.showAdditionalCriteria();
			
			//Route to page 1
			this.updatePageNumber(0);
		
			//Trigger a new search
			this.triggerSearch();
		},
		
		//Removes a specified filter node from the DOM
		hideFilter : function(filterNode){
			//Remove the filter node from the DOM
			$(filterNode).fadeOut("slow", function(){
				filterNode.remove();
			});	
		},
		
		//Removes a specified filter from the search model
		removeFromModel : function(category, term){			
			//Remove this filter term from the searchModel
			if (category){
				
				//Get the current filter terms array
				var currentTerms = searchModel.get(category);
				//Remove this filter term from the array
				var newTerms = _.without(currentTerms, term);
				//Set the new value
				searchModel.set(category, newTerms);	
				
			}
		},
		
		//Adds a specified filter node to the DOM
		showFilter : function(category, term, checkForDuplicates){
			
			var viewRef = this;
			
			//Get the element to add the UI filter node to 
			//The pattern is #current-<category>-filters
			var e = this.$el.find('#current-' + category + '-filters');
			
			//Allow the option to only display this exact filter category and term once to the DOM
			//Helpful when adding a filter that is not stored in the search model (for display only)
			if (checkForDuplicates){
				var duplicate = false;
				
				//Get the current terms from the DOM and check against the new term
				e.children().each( function(){
					if($(this).attr('data-term') == term){
						duplicate = true;
					}
				});
				
				//If there is a duplicate, exit without adding it
				if(duplicate){ return; }				
			}
			
							
			// is it a semantic concept?
			var termLabel = null;
			if (term.indexOf("#") > 0) {
				termLabel = term.substring(term.indexOf("#"));
			}
			//Add a filter node to the DOM
			e.prepend(viewRef.currentFilterTemplate({filterTerm: term, termLabel: termLabel}));	
				
			return;
		},
		
		// highlights anything additional that has been selected
		showAdditionalCriteria: function() {
			
			// style the selection			
			$(".keyword-search-link").each(function(index, targetNode){
				//Neutralize all keyword search links by 'deactivating'
				$(targetNode).removeClass("active");
				//Do this for the parent node as well for template flexibility
				$(targetNode).parent().removeClass("active");
				
				var dataCategory = $(targetNode).attr("data-category");
				var dataTerm = $(targetNode).attr("data-term");
				var terms = searchModel.get(dataCategory);
				if (_.contains(terms, dataTerm)) {
					//Add the active class for styling
					$(targetNode).addClass("active");
					
					//Add the class to the parent node as well for template flexibility
					$(targetNode).parent().addClass("active");
				}

			});
			
		},
		
		// add additional criteria to the search model based on link click
		additionalCriteria: function(e){			
			// Get the clicked node
			var targetNode = $(e.target);
			
			//If this additional criteria is already applied, remove it
			if(targetNode.hasClass('active')){
				this.removeAdditionalCriteria(e);
				return false;
			}
			
			// Get the filter criteria
			var term = targetNode.attr('data-term');
			
			// Find this element's category in the data-category attribute
			var category = targetNode.attr('data-category');
			
			// style the selection
			$(".keyword-search-link").removeClass("active");
			$(".keyword-search-link").parent().removeClass("active");
			targetNode.addClass("active");
			targetNode.parent().addClass("active");
			
			// Add this criteria to the search model
			searchModel.set(category, [term]);
			
			// Trigger the search
			this.triggerSearch();
			
			// prevent default action of click
			return false;

		},
		
		removeAdditionalCriteria: function(e){

			// Get the clicked node
			var targetNode = $(e.target);
			
			// remove the styling
			$(".keyword-search-link").removeClass("active");
			$(".keyword-search-link").parent().removeClass("active");
			
			//Get the term
			var term = targetNode.attr('data-term');
			
			//Get the current search model additional criteria 
			var current = searchModel.get('additionalCriteria');
			//If this term is in the current search model (should be)...
			if(_.contains(current, term)){
				//then remove it
				var newTerms = _.without(current, term);
				searchModel.set("additionalCriteria", newTerms);
			}

			//Route to page 1
			this.updatePageNumber(0);
			
			//Trigger a new search
			this.triggerSearch();
		},

		//Update all the statistics throughout the page
		updateStats : function() {
			if (appSearchResults.header != null) {
				this.$statcounts = this.$('#statcounts');
				this.$statcounts.html(
					this.statsTemplate({
						start : appSearchResults.header.get("start") + 1,
						end : appSearchResults.header.get("start") + appSearchResults.length,
						numFound : appSearchResults.header.get("numFound")
					})
				);
			}
			
			// piggy back here
			this.updatePager();
		},
		
		updatePager : function() {
			if (appSearchResults.header != null) {
				var pageCount = Math.ceil(appSearchResults.header.get("numFound") / appSearchResults.header.get("rows"));
				
				//If no results were found, display a message instead of the list and clear the pagination.
				if(pageCount == 0){
					this.$results.html('<p id="no-results-found">No results found.</p>');
					
					this.$('#resultspager').html("");
				}
				//Do not display the pagination if there is only one page
				else if(pageCount == 1){
					this.$('#resultspager').html("");
				}
				else{
					var pages = new Array(pageCount);
					
					// mark current page correctly, avoid NaN
					var currentPage = -1;
					try {
						currentPage = Math.floor((appSearchResults.header.get("start") / appSearchResults.header.get("numFound")) * pageCount);
					} catch (ex) {
						console.log("Exception when calculating pages:" + ex.message);
					}
					
					this.$resultspager = this.$('#resultspager');
					
					//Populate the pagination element in the UI
					this.$resultspager.html(
						this.pagerTemplate({
							pages: pages,
							currentPage: currentPage
						})
					);
				}
			}
		},
		
		updatePageNumber: function(page) {
			var route = Backbone.history.fragment;
			if (route.indexOf("/page/") >= 0) {
				//replace the last number with the new one
				route = route.replace(/\d+$/, page);
			} else {
				route += "/page/" + page;
			}
			appModel.set("page", page);
			uiRouter.navigate(route);
		},

		// Next page of results
		nextpage: function () {
			this.loading();
			appSearchResults.nextpage();
			this.$resultsview.show();
			this.updateStats();
			
			var page = appModel.get("page");
			page++;
			this.updatePageNumber(page);
		},
		
		// Previous page of results
		prevpage: function () {
			this.loading();
			appSearchResults.prevpage();
			this.$resultsview.show();
			this.updateStats();
			
			var page = appModel.get("page");
			page--;
			this.updatePageNumber(page);
		},
		
		navigateToPage: function(event) {
			var page = $(event.target).attr("page");
			this.showPage(page);
		},
		
		showPage: function(page) {
			this.loading();
			appSearchResults.toPage(page);
			this.$resultsview.show();
			this.updateStats();	
			this.updatePageNumber(page);
		},
		
		//Get the facet counts
		getAutoCompletes: function(){
			var viewRef = this;
			
			var facetQuery = "q=" + appSearchResults.currentquery +
							 "&wt=json" +
							 "&rows=0" +
							 "&facet=true" +
							 "&facet.sort=count" +
							 "&facet.field=keywords" +
							 "&facet.field=origin" +
							 "&facet.field=family" +
							 "&facet.field=species" +
							 "&facet.field=genus" +
							 "&facet.field=kingdom" + 
							 "&facet.field=phylum" + 
							 "&facet.field=order" +
							 "&facet.field=class" +
							 "&facet.field=attributeName" +
							 "&facet.field=attributeLabel" +
							 "&facet.field=site" +
							 "&facet.field=characteristic_sm" +
							 "&facet.field=standard_sm" +
							 "&facet.mincount=1" +
							 "&facet.limit=-1";

			$.get(appModel.get('queryServiceUrl') + facetQuery, function(data, textStatus, xhr) {
				
				var facetCounts = data.facet_counts.facet_fields,
					facetLimit  = 999;
								
				//***Set up the autocomplete (jQueryUI) feature for each text input****//				
				//For the 'all' filter, use keywords
				var allSuggestions = facetCounts.keywords;
				var rankedSuggestions = new Array();
				for (var i=0; i < Math.min(allSuggestions.length-1, facetLimit); i+=2) {
					rankedSuggestions.push({value: allSuggestions[i], label: allSuggestions[i] + " (" + allSuggestions[i+1] + "+)"});
				}

				$('#all_input').autocomplete({
					source: function (request, response) {
			            var term = $.ui.autocomplete.escapeRegex(request.term)
			                , startsWithMatcher = new RegExp("^" + term, "i")
			                , startsWith = $.grep(rankedSuggestions, function(value) {
			                    return startsWithMatcher.test(value.label || value.value || value);
			                })
			                , containsMatcher = new RegExp(term, "i")
			                , contains = $.grep(rankedSuggestions, function (value) {
			                    return $.inArray(value, startsWith) < 0 && 
			                        containsMatcher.test(value.label || value.value || value);
			                });
			            
			            response(startsWith.concat(contains));
			        },
					select: function(event, ui) {
						// set the text field
						$('#all_input').val(ui.item.value);
						// add to the filter immediately
						viewRef.updateTextFilters(event);
						// prevent default action
						return false;
					},
					position: {
						my: "left top",
						at: "left bottom",
						collision: "fit"
					}
				});
				
				// suggest attribute criteria
				var attributeNameSuggestions = facetCounts.attributeName;
				var attributeLabelSuggestions = facetCounts.attributeLabel;
				// NOTE: only using attributeName for auto-complete suggestions.
				attributeLabelSuggestions = null;
				
				var attributeSuggestions = [];
				attributeSuggestions = 
					attributeSuggestions.concat(
						attributeNameSuggestions, 
						attributeLabelSuggestions);
				var rankedAttributeSuggestions = new Array();
				for (var i=0; i < Math.min(attributeSuggestions.length-1, facetLimit); i+=2) {
					rankedAttributeSuggestions.push({value: attributeSuggestions[i], label: attributeSuggestions[i] + " (" + attributeSuggestions[i+1] + ")"});
				}
				$('#attribute_input').autocomplete({
					source: function (request, response) {
			            var term = $.ui.autocomplete.escapeRegex(request.term)
			                , startsWithMatcher = new RegExp("^" + term, "i")
			                , startsWith = $.grep(rankedAttributeSuggestions, function(value) {
			                    return startsWithMatcher.test(value.label || value.value || value);
			                })
			                , containsMatcher = new RegExp(term, "i")
			                , contains = $.grep(rankedAttributeSuggestions, function (value) {
			                    return $.inArray(value, startsWith) < 0 && 
			                        containsMatcher.test(value.label || value.value || value);
			                });
			            
			            response(startsWith.concat(contains));
			        },
					select: function(event, ui) {
						// set the text field
						$('#attribute_input').val(ui.item.value);
						// add to the filter immediately
						viewRef.updateTextFilters(event);
						// prevent default action
						return false;
					},
					position: {
						my: "left top",
						at: "left bottom"				
					}
				});
				
				// suggest characteristics
				var characteristicSuggestions = facetCounts.characteristic_sm;
				var rankedCharacteristicSuggestions = new Array();
				for (var i=0; i < Math.min(characteristicSuggestions.length-1, facetLimit); i+=2) {
					rankedCharacteristicSuggestions.push({value: characteristicSuggestions[i], label: characteristicSuggestions[i].substring(characteristicSuggestions[i].indexOf("#")) });
				}
				$('#characteristic_input').autocomplete({
					source: function (request, response) {
			            var term = $.ui.autocomplete.escapeRegex(request.term)
			                , startsWithMatcher = new RegExp("^" + term, "i")
			                , startsWith = $.grep(rankedCharacteristicSuggestions, function(value) {
			                    return startsWithMatcher.test(value.label || value.value || value);
			                })
			                , containsMatcher = new RegExp(term, "i")
			                , contains = $.grep(rankedCharacteristicSuggestions, function (value) {
			                    return $.inArray(value, startsWith) < 0 && 
			                        containsMatcher.test(value.label || value.value || value);
			                });
			            
			            response(startsWith.concat(contains));
			        },
					select: function(event, ui) {
						// set the text field
						$('#characteristic_input').val(ui.item.value);
						// add to the filter immediately
						viewRef.updateTextFilters(event);
						// prevent default action
						return false;
					},
					position: {
						my: "left top",
						at: "left bottom"				
					}
				});
				
				// suggest standards
				var standardSuggestions = facetCounts.standard_sm;
				var rankedStandardSuggestions = new Array();
				for (var i=0; i < Math.min(standardSuggestions.length-1, facetLimit); i+=2) {
					rankedStandardSuggestions.push({value: standardSuggestions[i], label: standardSuggestions[i].substring(standardSuggestions[i].indexOf("#")) });
				}
				$('#standard_input').autocomplete({
					source: function (request, response) {
			            var term = $.ui.autocomplete.escapeRegex(request.term)
			                , startsWithMatcher = new RegExp("^" + term, "i")
			                , startsWith = $.grep(rankedStandardSuggestions, function(value) {
			                    return startsWithMatcher.test(value.label || value.value || value);
			                })
			                , containsMatcher = new RegExp(term, "i")
			                , contains = $.grep(rankedStandardSuggestions, function (value) {
			                    return $.inArray(value, startsWith) < 0 && 
			                        containsMatcher.test(value.label || value.value || value);
			                });
			            
			            response(startsWith.concat(contains));
			        },
					select: function(event, ui) {
						// set the text field
						$('#standard_input').val(ui.item.value);
						// add to the filter immediately
						viewRef.updateTextFilters(event);
						// prevent default action
						return false;
					},
					position: {
						my: "left top",
						at: "left bottom"				
					}
				});
			
				// suggest creator names/organizations
				var originSuggestions = facetCounts.origin;
				var rankedOriginSuggestions = new Array();
				for (var i=0; i < Math.min(originSuggestions.length-1, facetLimit); i+=2) {
					rankedOriginSuggestions.push({value: originSuggestions[i], label: originSuggestions[i] + " (" + originSuggestions[i+1] + ")"});
				}
				$('#creator_input').autocomplete({
					source: function (request, response) {
			            var term = $.ui.autocomplete.escapeRegex(request.term)
			                , startsWithMatcher = new RegExp("^" + term, "i")
			                , startsWith = $.grep(rankedOriginSuggestions, function(value) {
			                    return startsWithMatcher.test(value.label || value.value || value);
			                })
			                , containsMatcher = new RegExp(term, "i")
			                , contains = $.grep(rankedOriginSuggestions, function (value) {
			                    return $.inArray(value, startsWith) < 0 && 
			                        containsMatcher.test(value.label || value.value || value);
			                });
			            
			            response(startsWith.concat(contains));
			        },
					select: function(event, ui) {
						// set the text field
						$('#creator_input').val(ui.item.value);
						// add to the filter immediately
						viewRef.updateTextFilters(event);
						// prevent default action
						return false;
					},
					position: {
						my: "left top",
						at: "left bottom"				
					}
				});
				
				// suggest taxonomic criteria
				var familySuggestions  = facetCounts.family;
				var speciesSuggestions = facetCounts.species;
				var genusSuggestions   = facetCounts.genus;
				var kingdomSuggestions = facetCounts.kingdom;
				var phylumSuggestions  = facetCounts.phylum;
				var orderSuggestions   = facetCounts.order;
				var classSuggestions   = facetCounts["class"];
				
				var taxonSuggestions = [];
				taxonSuggestions = 
					taxonSuggestions.concat(
						familySuggestions, 
						speciesSuggestions, 
						genusSuggestions, 
						kingdomSuggestions,
						phylumSuggestions,
						orderSuggestions,
						classSuggestions);
				var rankedTaxonSuggestions = new Array();
				for (var i=0; i < Math.min(taxonSuggestions.length-1, facetLimit); i+=2) {
					rankedTaxonSuggestions.push({value: taxonSuggestions[i], label: taxonSuggestions[i] + " (" + taxonSuggestions[i+1] + ")"});
				}
				$('#taxon_input').autocomplete({
					source: function (request, response) {
			            var term = $.ui.autocomplete.escapeRegex(request.term)
			                , startsWithMatcher = new RegExp("^" + term, "i")
			                , startsWith = $.grep(rankedTaxonSuggestions, function(value) {
			                    return startsWithMatcher.test(value.label || value.value || value);
			                })
			                , containsMatcher = new RegExp(term, "i")
			                , contains = $.grep(rankedTaxonSuggestions, function (value) {
			                    return $.inArray(value, startsWith) < 0 && 
			                        containsMatcher.test(value.label || value.value || value);
			                });
			            
			            response(startsWith.concat(contains));
			        },
					position: {
						my: "left top",
						at: "left bottom",
						collision: "none"
					},
					select: function(event, ui) {
						// set the text field
						$('#taxon_input').val(ui.item.value);
						// add to the filter immediately
						viewRef.updateTextFilters(event);
						// prevent default action
						return false;
					}
				});	
				
				// suggest location names
				var spatialSuggestions = facetCounts.site;
				var rankedSpatialSuggestions = new Array();
				for (var i=0; i < Math.min(spatialSuggestions.length-1, facetLimit); i+=2) {
					rankedSpatialSuggestions.push({value: spatialSuggestions[i], label: spatialSuggestions[i] + " (" + spatialSuggestions[i+1] + ")"});
				}
				$('#spatial_input').autocomplete({
					source: function (request, response) {
			            var term = $.ui.autocomplete.escapeRegex(request.term)
			                , startsWithMatcher = new RegExp("^" + term, "i")
			                , startsWith = $.grep(rankedSpatialSuggestions, function(value) {
			                    return startsWithMatcher.test(value.label || value.value || value);
			                })
			                , containsMatcher = new RegExp(term, "i")
			                , contains = $.grep(rankedSpatialSuggestions, function (value) {
			                    return $.inArray(value, startsWith) < 0 && 
			                        containsMatcher.test(value.label || value.value || value);
			                });
			            
			            response(startsWith.concat(contains));
			        },
					select: function(event, ui) {
						// set the text field
						$('#spatial_input').val(ui.item.value);
						// add to the filter immediately
						viewRef.updateTextFilters(event);
						// prevent default action
						return false;
					},
					position: {
						my: "left top",
						at: "left bottom",
						collision: "flip"
					}
				});
			}, "json");
		},
		
		/* add a marker for objects */
	/*	addObjectMarker: function(markerDetails) {
			
			//Skip this if there is no map
			if (!gmaps) {
				return;
			}
			
			// Retrieve all the details about this marker. 
			var pid = ("id" in markerDetails) ? markerDetails.get('id') : 0,
				n   = ("northBoundCoord" in markerDetails) ? markerDetails.get('northBoundCoord') : null,
				s   = ("southBoundCoord" in markerDetails) ? markerDetails.get('southBoundCoord') : null,
				e   = ("eastBoundCoord" in markerDetails)  ? markerDetails.get('eastBoundCoord')  : null,
				w   = ("westBoundCoord" in markerDetails)  ? markerDetails.get('westBoundCoord')  : null;
			
			// if already on map
			if (this.markers[pid]) {
				return;
			}
			
			
			//Create Google Map LatLng objects out of our coordinates
			var latLngSW = new gmaps.LatLng(s, w);
			var latLngNE = new gmaps.LatLng(n, e);
			var latLngNW = new gmaps.LatLng(n, w);
			var latLngSE = new gmaps.LatLng(s, e);
			
			//Get the centroid location of this data item
			var bounds = new gmaps.LatLngBounds(latLngSW, latLngNE);
			var latLngCEN = bounds.getCenter();
			
			//Keep track of our overall bounds
			if(this.masterBounds){
				this.masterBounds = bounds.union(this.masterBounds);
			}
			else{
				this.masterBounds = bounds;
			}
	
			//An infowindow or bubble for each marker
			var infoWindow = new gmaps.InfoWindow({
				content:
					'<div class="gmaps-infowindow">'
					+ '<h4>' + markerDetails.get('title') 
					+ ' ' 
					+ '<a href="#view/' + pid + '" >'
					+ markerDetails.get('id') 
					+ '</a>'
					+ '</h4>'
					+ '<p>' + markerDetails.get('abstract') + '</p>'
					+ '</div>',
				isOpen: false,
				disableAutoPan: true,
				maxWidth: 250
			});
			
			// A small info window with just the title for each marker
			var titleWindow = new gmaps.InfoWindow({
				content: markerDetails.get('title'),
				disableAutoPan: true,
				maxWidth: 250
			});

			//Set up the options for each marker
			var markerOptions = {
				position: latLngCEN,
				title: markerDetails.get('title'),
				icon: this.markerImage,
				zIndex: 99999,
				id: pid,
				map: this.map
			};
			
			//Set up the polygon for each marker
			var polygon = new gmaps.Polygon({
				paths: [latLngNW, latLngNE, latLngSE, latLngSW],
				strokeColor: '#FFFFFF',
				strokeWeight: 2,
				fillColor: '#FFFFFF',
				fillOpacity: '0.3'
			});
			
			
			//Create an instance of the marker
			var marker = new gmaps.Marker(markerOptions);
			this.markers[pid] = marker;
			
			//Show the info window upon marker click
			gmaps.event.addListener(marker, 'click', function() {
				titleWindow.close();
				infoWindow.open(this.map, marker);
				infoWindow.isOpen = true;
			});
			
			//Close the infowindow upon any click on the map
			gmaps.event.addListener(this.map, 'click', function() {
				titleWindow.close();
				infoWindow.close();
				infoWindow.isOpen = false;
			});
			
			var viewRef = this;
			
			// Behavior for marker mouseover
			gmaps.event.addListener(marker, 'mouseover', function() {
				
				if(!infoWindow.isOpen){						
					//Open the brief title window
					titleWindow.open(viewRef.map, marker);	
				}
				
				//Show the data boundaries as a polygon
				polygon.setMap(viewRef.map);
				polygon.setVisible(true);
			});
			
			// Behavior for marker mouseout
			gmaps.event.addListener(marker, 'mouseout', function() {
				titleWindow.close();
				
				//Hide the data coverage boundaries polygon
				polygon.setVisible(false);
			});
			
		},
	*/	
		openMarker: function(e){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Clear the panning timeout
			window.clearTimeout(this.centerTimeout);
			
			//Get the attributes about this dataset
			var id = $(e.target).attr('data-id');
			var centerGeohash = $(e.target).attr("data-center");
			
			//The mouseover event might be triggered by a nested element, so loop through the parents to find the id
			if(typeof id == "undefined"){
				$(e.target).parents().each(function(){
					if(typeof $(this).attr('data-id') != "undefined"){
						id = $(this).attr('data-id');
						centerGeohash = $(this).attr('data-center');
					}
				});
			}
			
			//Zoom to the center of this dataset
			var decodedGeohash = nGeohash.decode(centerGeohash);
			var position = new google.maps.LatLng(decodedGeohash.latitude, decodedGeohash.longitude);

			//Do not trigger a new search when we pan
			this.allowSearch = false;
			
			//Pan the map
			this.map.panTo(position);	
		},
	/*	
		closeMarker: function(e){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			var id = $(e.target).attr('data-id');
			
			//The mouseout event might be triggered by a nested element, so loop through the parents to find the id
			if(typeof id == "undefined"){
				$(e.target).parents().each(function(){
					if(typeof $(this).attr('data-id') != "undefined"){
						id = $(this).attr('data-id');
					}
				});
			}		
			
			//Trigger the mouseout event
			gmaps.event.trigger(this.markers[id], 'mouseout');
			
			//Pan back to the map center so the map will reflect the current spatial filter bounding box
			var mapCenter = mapModel.get('center');			
			if(mapCenter !== null){
				var viewRef = this;
			
				
				// Set a delay on the panning in case we hover over another openMarker item right away.
				// Without this delay the map will recenter quickly, then move to the next marker, etc. and it is very jarring
				var recenter = function(){
					//Do not trigger a new search when we pan
					viewRef.allowSearch = false;
					
					viewRef.map.panTo(mapCenter);
				}

				this.centerTimeout = window.setTimeout(recenter, 500);
			}
			
		},
		
		showMarkers: function() {
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			var i = 1;
			_.each(_.values(this.markers), function(marker) {
				setTimeout(function() {
					marker.setVisible(true);
				}, i++ * 1);
			});
		},
		
		// removes any existing markers that are not in the new search results
		mergeMarkers: function() {
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			var searchPids =
			_.map(appSearchResults.models, function(element, index, list) {
				return element.get("id");
			});
			var diff = _.difference(_.keys(this.markers), searchPids);
			var viewRef = this;
			_.each(diff, function(pid, index, list) {
				var marker = viewRef.markers[pid];
				marker.setMap(null);
				delete viewRef.markers[pid];
			});
		},
*/
		// Add a single SolrResult item to the list by creating a view for it, and
		// appending its element to the DOM.
		addOne: function (result) {
			//Get the view and package service URL's
			this.$view_service = appModel.get('viewServiceUrl');
			this.$package_service = appModel.get('packageServiceUrl');
			result.set( {view_service: this.$view_service, package_service: this.$package_service} );
			
			//Create a new result item
			var view = new SearchResultView({ model: result });
			
			//Add this item to the list
			this.$results.append(view.render().el);
			
			// map it
		/*	if(gmaps && (appModel.get('searchMode') == 'map')){
				this.addObjectMarker(result);	
			}
		*/
		},

		/** Add all items in the **SearchResults** collection
		 * This loads the first 25, then waits for the map to be 
		 * fully loaded and then loads the remaining items.
		 * Without this delay, the app waits until all records are processed
		*/
		addAll: function () {
			console.log("Adding all the results to the list and map");
			
			// do this first to indicate coming results
			this.updateStats();
						
			//reset the master bounds
			this.masterBounds = null;
			
			//Clear the results list before we start adding new rows
			this.$results.html('');
			
			//Remove all the existing tiles on the map
			this.removeTiles();
			this.removeMarkers();
			
			//If there are no results, display so
			var numFound = appSearchResults.models.length;
			if (numFound == 0){
				this.$results.html('<p id="no-results-found">No results found.</p>');
			}
			
			//Remove the loading class and styling
			this.$results.removeClass('loading');
			
			//After the map is done loading, then load the rest of the results into the list
			var viewRef = this;
			var intervalId = setInterval(function() {
				if (viewRef.ready) {
					clearInterval(intervalId);
										
					//--First map all the results--
					if(gmaps){
						//Draw all the tiles on the map to represent the datasets
						viewRef.drawTiles();	
						
						//Remove the loading styles from the map
						$("#map-container").removeClass("loading");
					}
					
					//--- Add all the results to the list ---
					for (i = 0; i < numFound; i++) {
						var element = appSearchResults.models[i];
						viewRef.addOne(element);
					};
					
					// Initialize any tooltips within the result item
					$(".tooltip-this").tooltip();
					$(".popover-this").popover();

				}
				
			}, 500);
			
			//After all the results are loaded, query for our facet counts in the background
			this.getAutoCompletes();
		},
		
		drawTiles: function(){
			
			this.removeTiles();
			
			TextOverlay.prototype = new google.maps.OverlayView();
			
			/** @constructor */
			function TextOverlay(options) {
				// Now initialize all properties.
				  this.bounds_ = options.bounds;
				  this.map_    = options.map;
				  this.text    = options.text;
				  this.color   = options.color;
				  
				  var length = options.text.toString().length;
				  if(length == 1) this.width = 8;
				  else if(length == 2) this.width = 17;
				  else if(length == 3) this.width = 25;
				  else if(length == 4) this.width = 32;
				  else if(length == 5) this.width = 40;

				  // We define a property to hold the image's div. We'll
				  // actually create this div upon receipt of the onAdd()
				  // method so we'll leave it null for now.
				  this.div_ = null;
				  
				  // Explicitly call setMap on this overlay
				  this.setMap(options.map);
			}
			
			TextOverlay.prototype.onAdd = function() {
					
			  // Create the DIV and set some basic attributes.
			  var div = document.createElement('div');
			  div.style.color = this.color;
			  div.style.fontSize = "15px";
			  div.style.position = 'absolute';
			  div.style.zIndex = "999";

			  // Create an IMG element and attach it to the DIV.
			  div.innerHTML = this.text;

			  // Set the overlay's div_ property to this DIV
			  this.div_ = div;

			  // We add an overlay to a map via one of the map's panes.
			  // We'll add this overlay to the overlayLayer pane.
			  var panes = this.getPanes();
			  panes.overlayLayer.appendChild(div);
			}
			
			TextOverlay.prototype.draw = function() {
				// Size and position the overlay. We use a southwest and northeast
				  // position of the overlay to peg it to the correct position and size.
				  // We need to retrieve the projection from this overlay to do this.				  
				  var overlayProjection = this.getProjection();

				  // Retrieve the southwest and northeast coordinates of this overlay
				  // in latlngs and convert them to pixels coordinates.
				  // We'll use these coordinates to resize the DIV.
				  var sw = overlayProjection.fromLatLngToDivPixel(this.bounds_.getSouthWest());
				  var ne = overlayProjection.fromLatLngToDivPixel(this.bounds_.getNorthEast());
				  
				  // Resize the image's DIV to fit the indicated dimensions.
				  var div = this.div_;
				  var width = this.width;
				  var height = 20;
				  
				  div.style.left = (sw.x - width/2) + 'px';
				  div.style.top = (ne.y - height/2) + 'px';
				  div.style.width = width + 'px';
				  div.style.height = height + 'px';				  
				  div.style.width = width + "px";
				  div.style.height = height + "px";

			}
			
			TextOverlay.prototype.onRemove = function() {
				  this.div_.parentNode.removeChild(this.div_);
				  this.div_ = null;
			}
			
			//Determine the geohash level we will use to draw tiles
			var currentZoom     = this.map.getZoom(),
				geohashLevelNum	= mapModel.determineGeohashLevel(currentZoom),
				geohashLevel    = "geohash_" + geohashLevelNum,
				geohashes       = appSearchResults.facetCounts[geohashLevel];
						
			//Find the totals of our geohash tiles
			var total      = appSearchResults.header.get("numFound"),
				totalTiles = geohashes.length,
				maxCount   = _.max(geohashes),
				viewRef	   = this;
			
			//Now draw a tile for each geohash facet
			for(var i=0; i<geohashes.length-1; i+=2){
				
				//Convert this geohash to lat,long values 
				var decodedGeohash = nGeohash.decode(geohashes[i]),
					latLngCenter   = new google.maps.LatLng(decodedGeohash.latitude, decodedGeohash.longitude),
					geohashBox 	   = nGeohash.decode_bbox(geohashes[i]),
					swLatLng	   = new google.maps.LatLng(geohashBox[0], geohashBox[1]),
					neLatLng	   = new google.maps.LatLng(geohashBox[2], geohashBox[3]),
					bounds 		   = new google.maps.LatLngBounds(swLatLng, neLatLng),
					tileCount	   = geohashes[i+1],
					percent		   = tileCount/maxCount,
					useBins		   = (total > 200) ? true : false,
					marker,
					count,
					color;
								
				//When there is only one dataset in this tile, we will display a marker
				if ((tileCount == 1) && (currentZoom >= 7)){
					//Find a more exact location for this marker, by looking in the geohash_9 facets
					var geohash9Values = appSearchResults.facetCounts.geohash_9,
						exactLocation;
					
					//We can start at the index from this geohash array since they are sorted by index - this will save time for geohash values towards the end of the array
					for(var x = i; x < geohash9Values.length; x+=2){
						if(geohash9Values[x].indexOf(geohashes[i]) == 0){
							//This is the most exact geohash location
							exactLocation = geohash9Values[x];
							var decodedLocation = nGeohash.decode(exactLocation),
							     latLngLocation = new google.maps.LatLng(decodedLocation.latitude, decodedLocation.longitude);
							
							viewRef.markerGeohashes.push(exactLocation);
							
							break; //Stop looking
						}
					}
					
					//Draw the marker
					var marker = this.drawMarker(latLngLocation);
					
					//Save this marker in the view
					this.markers.push({marker: marker, geohash: exactLocation});
				}
				else{
					if(!useBins){
						//Determine the style of the tile depending on the percentage of datasets
						if (percent < .20){
							color = mapModel.get("tileColors").level1; 
						}
						else if (percent < .40){
							color = mapModel.get("tileColors").level2; 
						}
						else if (percent < .70){
							color = mapModel.get("tileColors").level3; 
						}
						else if (percent < .80) {
							color = mapModel.get("tileColors").level4; 
						}
						else{
							color = mapModel.get("tileColors").level5; 
						}
					}
					else{
						//Determine the style of the tile depending on the number of datasets
						if (tileCount < 10){
							color = mapModel.get("tileColors").level1; 
						}
						else if (tileCount < 50){
							color = mapModel.get("tileColors").level2; 
						}
						else if (tileCount < 100){
							color = mapModel.get("tileColors").level3; 
						}
						else if (tileCount < 1000) {
							color = mapModel.get("tileColors").level4; 
						}
						else{
							color = mapModel.get("tileColors").level5; 
						}
				}
					//Add the count to the tile
					var countLocation = new google.maps.LatLngBounds(latLngCenter, latLngCenter);
									
					//Draw the tile label with the dataset count
					count = new TextOverlay({
						bounds: countLocation,
						   map: this.map,
						  text: tileCount,
						 color: mapModel.get("tileLabelColor")
					});
					
					//Set up the default tile options 
					var tileOptions = {
						      fillColor: color, 
						      map: this.map,
						      visible: true,
						      bounds: bounds
						    };
					
					//Merge these options with any tile options set in the map model
					var modelTileOptions =  mapModel.get("tileOptions");					
					for(var attr in modelTileOptions){
						tileOptions[attr] = modelTileOptions[attr];
					}
					
					//Draw this tile
					var tile = this.drawTile(tileOptions, count);
					
					//Save the geohashes for tiles in the view for later
					this.tileGeohashes.push(geohashes[i]);
					
					//Save our tiles in the view
					this.tiles.push({text: count, shape: tile, geohash: geohashes[i]});
				}
			}
			
			//After all the tiles and markers are added, retrieve details about them
			if(this.markerGeohashes.length > 0) this.addMarkerInfoWindows();
			if(mapModel.isMaxZoom(this.map)) this.addTileInfoWindows();
		},
					
		drawTile: function(options, label){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			// Add the tile for these datasets to the map
			var tile = new google.maps.Rectangle(options);
					
			var viewRef = this;
			
			//Change styles when the tile is hovered on
			google.maps.event.addListener(tile, 'mouseover', function(event) {
				
				//Change the tile style on hover
				tile.setOptions(mapModel.get('tileOnHover'));
				
				//Change the label color on hover
				var div = label.div_;
				div.style.color = mapModel.get("tileLabelColorOnHover");
				label.div_ = div;
			});
			
			//Change the styles back after the tile is hovered on
			google.maps.event.addListener(tile, 'mouseout', function(event) {
								
				//Change back the tile to it's original styling
				tile.setOptions(options);
				
				//Change back the label color
				var div = label.div_;
				div.style.color = mapModel.get("tileLabelColor");
				label.div_ = div;
			});
			
			//If we are at the max zoom, we will display an info window. If not, we will zoom in.
			if(!mapModel.isMaxZoom(viewRef.map)){
				//Zoom in when the tile is clicked on
				gmaps.event.addListener(tile, 'click', function(clickEvent) {
					//Change the center
					viewRef.map.panTo(clickEvent.latLng);
					
					//Get this tile's bounds
					var bounds = tile.getBounds();
								
					//Change the zoom
					viewRef.map.fitBounds(bounds);	
				});
			}
			
			return tile;
		},
		
		drawMarker: function(latLng){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Set up the options for each marker
			var markerOptions = {
				position: latLng,
				icon: mapModel.get("markerImage"),
				zIndex: 99999,
				map: this.map
			};
			
			//Create the marker and add to the map
			var marker = new google.maps.Marker(markerOptions);
		
			return marker;
		},
		
		/**
		 * Get the details on each marker
		 * And create an infowindow for that marker
		 */		
		addMarkerInfoWindows: function(){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}	
			
			//Clone the Search model
			var searchModelClone = searchModel.clone(),
				geohashLevel = 9,
				viewRef = this,
				infoWindows = [],
				markers = this.markers;
			
			//Change the geohash filter to match our tiles 
			searchModelClone.set("geohashLevel", geohashLevel);
			searchModelClone.set("geohashes", this.markerGeohashes);
			
			//Now run a query to get a list of documents that are represented by our tiles
			var query = "q=" + searchModelClone.getQuery() + 
						"&wt=json" +
						"&fl=id,title,geohash_9,abstract" +
						"&rows=1000";
			
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr){
				var docs = data.response.docs;
				
				//Create an infoWindow for each document
				_.each(docs, function(doc, key, list){
					
					var marker;
					
					//Find the marker for this document				
					for(var i=0; i<markers.length; i++){
						//Is this the marker for this document?
						if(markers[i].geohash == doc.geohash_9[0]){
							marker = markers[i];
							break;
						}
					}
					
					//Create the infoWindow
					if(!marker) return;
					
					var decodedGeohash = nGeohash.decode(marker.geohash),
						position 	   = new google.maps.LatLng(decodedGeohash.latitude, decodedGeohash.longitude);
					
					//The infowindow
					var infoWindow = new gmaps.InfoWindow({
						content:
							'<div class="gmaps-infowindow">'
							+ "<h4>" + doc.title + "</h4>"
							+ "<a href='#view/" + doc.id + "'>" + doc.id + "</a>"
							+ "<p>" + doc.abstract + "</p>"
							+ "<p><a href='#view/" + doc.id + "'>Read more</a></p>"
							+ '</div>',
						isOpen: false,
						disableAutoPan: true,
						maxWidth: 250,
						position: position
					});	
					
					//Store this infowindow in the view
					viewRef.markerInfoWindows.push(infoWindow);
					
					marker = marker.marker;
					
					//Show the info window upon marker click
					gmaps.event.addListener(marker, 'click', function() {
						infoWindow.open(viewRef.map, marker);
						infoWindow.isOpen = true;
						
						//Close all other infowindows 
						viewRef.closeInfoWindows(infoWindow);
					});
					
					//Close the infowindow upon any click on the map
					gmaps.event.addListener(viewRef.map, 'click', function() {
						infoWindow.close();
						infoWindow.isOpen = false;
					});
				});
			});
		},
		
		/**
		 * Get the details on each tile - a list of ids and titles for each dataset contained in that tile
		 * And create an infowindow for that tile
		 */
		addTileInfoWindows: function(){	
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Clone the Search model
			var searchModelClone = searchModel.clone(),
				geohashLevel = mapModel.determineGeohashLevel(this.map.getZoom()),
				geohashName	 = "geohash_" + geohashLevel,
				viewRef = this,
				infoWindows = [];
			
			//Change the geohash filter to match our tiles 
			searchModelClone.set("geohashLevel", geohashLevel);
			searchModelClone.set("geohashes", this.tileGeohashes);
			
			//Now run a query to get a list of documents that are represented by our tiles
			var query = "q=" + searchModelClone.getQuery() + 
						"&wt=json" +
						"&fl=id,title,geohash_9," + geohashName +
						"&rows=1000";
			
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr){
				//Make an infoWindow for each doc
				var docs = data.response.docs;
				
				//For each tile, loop through the docs to find which ones to include in its infoWindow	
				_.each(viewRef.tiles, function(tile, key, list){
					
					var infoWindowContent = "";
								
					_.each(docs, function(doc, key, list){
						
						//Is this document in this tile?
						for(var i=0; i<doc[geohashName].length; i++){
							if(doc[geohashName][i] == tile.geohash){
								//Add this doc to the infoWindow content
								infoWindowContent += "<a href='#view/" + doc.id + "'>" + doc.title +"</a> (" + doc.id +") <br/>"
								break;
							}	
						}							
					});
						
					//The center of the tile
					var decodedGeohash = nGeohash.decode(tile.geohash),
						tileCenter 	   = new google.maps.LatLng(decodedGeohash.latitude, decodedGeohash.longitude);
						
					//The infowindow
					var infoWindow = new gmaps.InfoWindow({
						content:
							'<div class="gmaps-infowindow">'
							+ '<h4> Datasets located here </h4>'
							+ "<p>" + infoWindowContent + "</p>"
							+ '</div>',
						isOpen: false,
						disableAutoPan: true,
						maxWidth: 250,
						position: tileCenter
					});
					
					viewRef.tileInfoWindows.push(infoWindow);
					
					//Zoom in when the tile is clicked on
					gmaps.event.addListener(tile.shape, 'click', function(clickEvent) {
						
						//--- We are at max zoom, display an infowindow ----//
						if(mapModel.isMaxZoom(viewRef.map)){
							
							//Find the infowindow that belongs to this tile in the view
							infoWindow.open(viewRef.map);
							infoWindow.isOpen = true;
							
							//Close all other infowindows 
							viewRef.closeInfoWindows(infoWindow);
						}
						
						//------ We are not at max zoom, so zoom into this tile ----//
						else{
							//Change the center
							viewRef.map.panTo(clickEvent.latLng);
							
							//Get this tile's bounds
							var bounds = tile.shape.getBounds();
									
							//Change the zoom
							viewRef.map.fitBounds(bounds);	
						}
					});
					
					//Close the infowindow upon any click on the map
					gmaps.event.addListener(viewRef.map, 'click', function() {						
						infoWindow.close();
						infoWindow.isOpen = false;
					});
					
					infoWindows[tile.geohash] = infoWindow;
				});
				
				viewRef.infoWindows = infoWindows;
				
			},
			"json");
		},
		
		/**
		 * Iterate over each infowindow that we have stored in the view and close it.
		 * Pass an infoWindow object to this function to keep that infoWindow open/skip it
		 */
		closeInfoWindows: function(except){
			var infoWindowLists = [this.markerInfoWindows, this.tileInfoWindows];

			_.each(infoWindowLists, function(infoWindows, key, list){
				//Iterate over all the marker infowindows and close all of them except for this one
				for(var i=0; i<infoWindows.length; i++){
					if((infoWindows[i].isOpen) && (infoWindows[i] != except)){
						//Close this info window and stop looking, since only one of each kind should be open anyway
						infoWindows[i].close();
						infoWindows[i].isOpen = false;
						i = infoWindows.length;
					}
				}
			});
		},
		
		/**
		 * Remove all the tiles and text from the map
		 **/
		removeTiles: function(){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Remove the tile from the map
			_.each(this.tiles, function(tile, key, list){
				if(tile.shape) tile.shape.setMap(null);
				if(tile.text)  tile.text.setMap(null);
			});
			
			//Reset the tile storage in the view
			this.tiles = [];
			this.tileGeohashes = [];
			this.tileInfoWindows = [];
		},
		
		removeMarkers: function(){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Remove the marker from the map
			_.each(this.markers, function(marker, key, list){
				marker.marker.setMap(null);
			});
			
			//Reset the marker storage in the view
			this.markers = [];
			this.markerGeohashes = [];
			this.markerInfoWindows = [];
		},
		
		// Communicate that the page is loading
		loading: function () {
			$("#map-container").addClass("loading");
			this.$results.addClass("loading");
		},
		
		//Toggles the collapseable filters sidebar and result list in the default theme 
		collapse: function(e){
				var id = $(e.target).attr('data-collapse');

				$('#'+id).toggleClass('collapsed');

		},
		
		//Move the popover element up the page a bit if it runs off the bottom of the page
		preventPopoverRunoff: function(e){
			
			//In map view only (because all elements are fixed and you can't scroll)
			if(appModel.get('searchMode') == 'map'){
				var viewportHeight = $('#map-container').outerHeight();
			}
			else{
				return false;
			}

			if($('.popover').length > 0){
				var offset = $('.popover').offset();
				var popoverHeight = $('.popover').outerHeight();
				var topPosition = offset.top;
				
				//If pixels are cut off the top of the page, readjust its vertical position
				if(topPosition < 0){
					$('.popover').offset({top: 10});
				}
				else{
					//Else, let's check if it is cut off at the bottom
					var totalHeight = topPosition + popoverHeight;
		
					var pixelsHidden = totalHeight - viewportHeight;
			
					var newTopPosition = topPosition - pixelsHidden - 40;
					
					//If pixels are cut off the bottom of the page, readjust its vertical position
					if(pixelsHidden > 0){
						$('.popover').offset({top: newTopPosition});
					}
				}
			}
			
		},
		
		toggleMapMode: function(){	
			if(gmaps){
				$('body').toggleClass('mapMode');	
			}
			
			if(appModel.get('searchMode') == 'map'){
				appModel.set('searchMode', 'list');
			}
			else if (appModel.get('searchMode') == 'list'){
				appModel.set('searchMode', 'map');
				this.renderMap();
				this.showResults();
			}
		},
		
		routeToMetadata: function(e){
			var id = $(e.target).attr('data-id');
			
			//If the user clicked on the download button or any element with the class 'stop-route', we don't want to navigate to the metadata
			if ($(e.target).hasClass('stop-route')){
				return;
			}
			
			if(typeof id == "undefined"){
				$(e.target).parents().each(function(){
					if(typeof $(this).attr('data-id') != "undefined"){
						id = $(this).attr('data-id');
					}
				});
			}
			
			uiRouter.navigate('view/'+id, true);
		},
		
		postRender: function() {
			if((gmaps) && (appModel.get('searchMode') == 'map')){
				console.log("Resizing the map");
				var center = this.map.getCenter(); 
				google.maps.event.trigger(this.map, 'resize'); 
				this.map.setCenter(center);	
			}
		},
		
		onClose: function () {			
			console.log('Closing the data view');
			
			if(gmaps){
				// unset map mode
				$("body").removeClass("mapMode");
			}
			
			// remove everything so we don't get a flicker
			this.$el.html('')
		}				
	});
	return DataCatalogView;		
});
