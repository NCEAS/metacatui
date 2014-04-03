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
				'markerClusterer'
				], 				
	function($, $ui, _, Backbone, SearchResultView, CatalogTemplate, CountTemplate, PagerTemplate, ResultItemTemplate, MainContentTemplate, CurrentFilterTemplate, gmaps, MarkerClusterer) {
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
				
		markerImage: './img/markers/orangered-marker.png',
		
		markerImageAlt: './img/markers/orangered-enlarged-marker.png',
		
		markerImage15: './img/markers/orangered-15px-25a.png',
		
		markerImage20: './img/markers/orangered-20px-25a.png',
		
		markerImage30: './img/markers/orangered-30px-25a.png',
		
		markerImage40: './img/markers/orangered-40px-25a.png',
		
		markerImage50: './img/markers/orangered-50px-25a.png',
		
		markerImage60: './img/markers/orangered-60px-25a.png',
		
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
		
		initialize: function () {
			
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
					
			//If the spatial filters are set, rezoom and recenter the map to those filters
			if(searchModel.get('north')){
				var mapZoom = searchModel.get('map').zoom;
				var mapCenter = searchModel.get('map').center;
			}
			else{
				var mapZoom = 3;
				var mapCenter = new gmaps.LatLng(-15.0, 0.0);
			}
			
			var mapOptions = {
			    zoom: mapZoom,
				minZoom: 3,
			    center: mapCenter,
				disableDefaultUI: true,
			    zoomControl: true,
			    zoomControlOptions: {
				          style: google.maps.ZoomControlStyle.SMALL,
				          position: google.maps.ControlPosition.TOP_LEFT
				        },
				panControl: false,
				scaleControl: false,
				streetViewControl: false,
				mapTypeControl: true,
				mapTypeControlOptions:{
						position: google.maps.ControlPosition.TOP_LEFT
				},
			    mapTypeId: google.maps.MapTypeId.TERRAIN
			};
			
			gmaps.visualRefresh = true;
			this.map = new gmaps.Map($('#map-canvas')[0], mapOptions);

			var mapRef = this.map;
			var viewRef = this;
			
			google.maps.event.addListener(mapRef, "idle", function(){
			
				viewRef.ready = true;
				
				if(viewRef.allowSearch){
					
					//If the map is at the minZoom, i.e. zoomed out all the way so the whole world is visible, do not apply the spatial filter
					if(viewRef.map.getZoom() == mapOptions.minZoom){
						console.log('at minimum zoom');		
						if(!viewRef.hasZoomed){
							return;
						}	
						viewRef.resetMap();	
					}
					else{
						//Get the Google map bounding box
						var boundingBox = mapRef.getBounds();
						
						//Set the search model spatial filters
						searchModel.set('north', boundingBox.getNorthEast().lat());
						searchModel.set('west', boundingBox.getSouthWest().lng());
						searchModel.set('south', boundingBox.getSouthWest().lat());
						searchModel.set('east', boundingBox.getNorthEast().lng());
						
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
				console.log('has zoomed');
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
			searchModel.set('map', {
				zoom: null,
				center: null
			});
			
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
			
			var page = appModel.get("page");
			if (page == null) {
				page = 0;
			}
					
			this.loading();
			
			var sortOrder = searchModel.get('sortOrder');
			
			appSearchResults.setrows(200);
			appSearchResults.setSort(sortOrder);
			
			var fields = "id,title,origin,pubDate,dateUploaded,abstract,resourceMap,beginDate,endDate,read_count_i";
			if(gmaps){
				fields += ",northBoundCoord,southBoundCoord,eastBoundCoord,westBoundCoord";
			}
			appSearchResults.setfields(fields);
			
			//Create the filter terms from the search model and create the query
			var query = "formatType:METADATA+-obsoletedBy:*";
			var filterQuery = "";
			
			//Function here to check for spaces in a string - we'll use this to url encode the query
			var needsQuotes = function(entry){
				//Check for spaces
				var space = null;
				
				space = entry.indexOf(" ");
				
				if(space >= 0){
					return true;
				}
				
				//Check for the colon : character
				var colon = null;
				colon = entry.indexOf(":");
				if(colon >= 0){
					return true;
				}
				
				return false;
			};
			
			/* Add trim() function for IE*/
			if(typeof String.prototype.trim !== 'function') {
				  String.prototype.trim = function() {
				    return this.replace(/^\s+|\s+$/g, ''); 
				  }
			}
			
			//**Get all the search model attributes**
		
			//resourceMap
			var resourceMap = searchModel.get('resourceMap');
			if(resourceMap){
				filterQuery += '&fq=resourceMap:*';
			}
			
			// attribute
			var thisAttribute = null;
			var attribute = searchModel.get('attribute');
			
			for (var i=0; i < attribute.length; i++){
				
				//Trim the spaces off
				thisAttribute = attribute[i].trim();
				
				// Does this need to be wrapped in quotes?
				if (needsQuotes(thisAttribute)){
					thisAttribute = thisAttribute.replace(" ", "%20");
					thisAttribute = "%22" + thisAttribute + "%22";
				}
				// TODO: surround with **?
				filterQuery += "&fq=attribute:" + thisAttribute;
				
			}
			
			// characteristic
			var thisCharacteristic = null;
			var characteristic = searchModel.get('characteristic');
			
			for (var i=0; i < characteristic.length; i++){
				
				//Trim the spaces off
				thisCharacteristic = characteristic[i].trim();
				
				// encode the semantic URI
				thisCharacteristic = "%22" + encodeURIComponent(thisCharacteristic) + "%22";
				
				// add to the query
				filterQuery += "&fq=characteristic_sm:" + thisCharacteristic;
				
			}
			
			// standard
			var thisStandard = null;
			var standard = searchModel.get('standard');
			
			for (var i=0; i < standard.length; i++){
				
				//Trim the spaces off
				thisStandard = standard[i].trim();
				
				// encode the semantic URI
				thisStandard = "%22" + encodeURIComponent(thisStandard) + "%22";
				
				// add to the query
				filterQuery += "&fq=standard_sm:" + thisStandard;
				
			}
			
			//All
			var thisAll = null;
			var all = searchModel.get('all');
			for(var i=0; i < all.length; i++){
				//Trim the spaces off
				thisAll = all[i].trim();
				
				//Does this need to be wrapped in quotes?
				if(needsQuotes(thisAll)){
					thisAll = thisAll.replace(" ", "%20");
					filterQuery += "&fq=*%22" + thisAll + "%22*";
				}
				else{
					filterQuery += "&fq=" + thisAll;
				}
			}
			
			//Creator
			var thisCreator = null;
			var creator = searchModel.get('creator');
			for(var i=0; i < creator.length; i++){
				//Trim the spaces off
				thisCreator = creator[i].trim();
				
				//Does this need to be wrapped in quotes?
				if(needsQuotes(thisCreator)){
					thisCreator = thisCreator.replace(" ", "%20");
					filterQuery += "&fq=origin:*%22" + thisCreator + "%22*";
				}
				else{
					filterQuery += "&fq=origin:*" + thisCreator + "*";
				}
			}
			
			//Taxon
			var taxon = searchModel.get('taxon');
			var thisTaxon = null;
			for (var i=0; i < taxon.length; i++){
				//Trim the spaces off
				thisTaxon = taxon[i].trim();
				
				// Does this need to be wrapped in quotes?
				if (needsQuotes(thisTaxon)){
					thisTaxon = thisTaxon.replace(" ", "%20");
					thisTaxon = "%22" + thisTaxon + "%22";
				}
				
				filterQuery += "&fq=(" +
							   "family:*" + thisTaxon + "*" +
							   " OR " +
							   "species:*" + thisTaxon + "*" +
							   " OR " +
							   "genus:*" + thisTaxon + "*" +
							   " OR " +
							   "kingdom:*" + thisTaxon + "*" +
							   " OR " +
							   "phylum:*" + thisTaxon + "*" +
							   " OR " +
							   "order:*" + thisTaxon + "*" +
							   " OR " +
							   "class:*" + thisTaxon + "*" +
							   ")";
			}
			
			// Additional criteria - both field and value are provided
			var additionalCriteria = searchModel.get('additionalCriteria');
			for (var i=0; i < additionalCriteria.length; i++){
				filterQuery += "&fq=" + additionalCriteria[i];
			}
			
			// Theme restrictions from Registry Model
			var registryCriteria = registryModel.get('searchFields');
			_.each(registryCriteria, function(value, key, list) {
				filterQuery += "&fq=" + value;
			});
			
			//Custom query (passed from the router)
			var customQuery = searchModel.get('customQuery');
			if(customQuery){
				query += customQuery;
			}
			
			//Year
			//Get the types of year to be searched first
			var pubYear  = searchModel.get('pubYear');
			var dataYear = searchModel.get('dataYear');
			if (pubYear || dataYear){
				//Get the minimum and maximum years chosen
				var yearMin = searchModel.get('yearMin');
				var yearMax = searchModel.get('yearMax');	
				
				//Add to the query if we are searching data coverage year
				if(dataYear){
					//Add to the main query because there can be hundreds of year variations cluttering our filter cache
					query += "+beginDate:%5B" + yearMin + "-01-01T00:00:00Z%20TO%20*%5D" +
							 "+endDate:%5B*%20TO%20" + yearMax + "-12-31T00:00:00Z%5D";
				}
				//Add to the query if we are searching publication year
				if(pubYear){
					query += "+dateUploaded:%5B" + yearMin + "-01-01T00:00:00Z%20TO%20" + yearMax + "-12-31T00:00:00Z%5D";				
				}
			}
			
			//Map
			//Add to the main query because there can be thousands of lat/long variations cluttering our filter cache
			if(searchModel.get('north')!=null){
				query += "+southBoundCoord:%7B" + searchModel.get('south') + "%20TO%20" + searchModel.get('north') + "%7D" + 
						 "+northBoundCoord:%7B" + searchModel.get('south') + "%20TO%20" + searchModel.get('north') + "%7D";
				
				if (searchModel.get('west') > searchModel.get('east')) {
					query += 
						"+eastBoundCoord:("
						+ "%7B" + searchModel.get('west') + "%20TO%20" + "180" + "%7D"
						+ "%20OR%20"
						+ "%7B" + "-180" + "%20TO%20" + searchModel.get('east') + "%7D"
						+ ")"
						+ "+westBoundCoord:(" 
						+ "%7B" + searchModel.get('west') + "%20TO%20" + "180" + "%7D"
						+ "%20OR%20"
						+ "%7B" + "-180" + "%20TO%20" + searchModel.get('east') + "%7D"
						+ ")"
						;
				} else {
					query += 
						"+eastBoundCoord:%7B" + searchModel.get('west') + "%20TO%20" + searchModel.get('east') + "%7D" +
						"+westBoundCoord:%7B" + searchModel.get('west') + "%20TO%20" + searchModel.get('east') + "%7D";
				}
			}
			
			//Spatial string
			var thisSpatial = null;
			var spatial = searchModel.get('spatial');
			for(var i=0; i < spatial.length; i++){
				//Trim the spaces off
				thisSpatial = spatial[i].trim();
				
				//Does this need to be wrapped in quotes?
				if(needsQuotes(thisSpatial)){
					thisSpatial = thisSpatial.replace(" ", "%20");
					query += "&fq=site:*%22" + thisSpatial + "%22*";
				}
				else{
					query += "&fq=site:*" + thisSpatial + "*";
				}
			}
			
			//Run the query
			appSearchResults.setQuery(query + filterQuery);
			
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
		getFacetCounts: function(){
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
				
				var facetCounts = data.facet_counts.facet_fields;
								
				//***Set up the autocomplete (jQueryUI) feature for each text input****//				
				//For the 'all' filter, use keywords
				var allSuggestions = facetCounts.keywords;
				var rankedSuggestions = new Array();
				for (var i=0; i < allSuggestions.length-1; i+=2) {
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
				for (var i=0; i < attributeSuggestions.length-1; i+=2) {
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
				for (var i=0; i < characteristicSuggestions.length-1; i+=2) {
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
				for (var i=0; i < standardSuggestions.length-1; i+=2) {
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
				for (var i=0; i < originSuggestions.length-1; i+=2) {
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
				for (var i=0; i < taxonSuggestions.length-1; i+=2) {
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
				for (var i=0; i < spatialSuggestions.length-1; i+=2) {
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
			});
		},
		
		/* add a marker for objects */
		addObjectMarker: function(solrResult) {
			
			//Skip this if there is no map
			if (!gmaps) {
				return;
			}
			
			var pid = solrResult.get('id');
			
			// if already on map
			if (this.markers[pid]) {
				return;
			}
			
			//Get the four bounding lat/longs for this data item
			var n = solrResult.get('northBoundCoord');
			var s = solrResult.get('southBoundCoord');
			var e = solrResult.get('eastBoundCoord');
			var w = solrResult.get('westBoundCoord');
			
			//Create Google Map LatLng objects out of our coordinates
			var latLngSW = new gmaps.LatLng(s, w);
			var latLngNE = new gmaps.LatLng(n, e);
			var latLngNW = new gmaps.LatLng(n, w);
			var latLngSE = new gmaps.LatLng(s, e);
			
			//Get the centertroid location of this data item
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
					+ '<h4>' + solrResult.get('title') 
					+ ' ' 
					+ '<a href="#view/' + pid + '" >'
					+ solrResult.get('id') 
					+ '</a>'
					+ '</h4>'
					+ '<p>' + solrResult.get('abstract') + '</p>'
					+ '</div>',
				isOpen: false,
				disableAutoPan: true,
				maxWidth: 250
			});
			
			// A small info window with just the title for each marker
			var titleWindow = new gmaps.InfoWindow({
				content: solrResult.get('title'),
				disableAutoPan: true,
				maxWidth: 250
			});

			//Set up the options for each marker
			var markerOptions = {
				position: latLngCEN,
				title: solrResult.get('title'),
				icon: this.markerImage,
				zIndex: 99999,
				id: solrResult.get('id'),
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
		
		openMarker: function(e){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Clear the panning timeout
			window.clearTimeout(this.centerTimeout);
			
			var id = $(e.target).attr('data-id');
			
			//The mouseover event might be triggered by a nested element, so loop through the parents to find the id
			if(typeof id == "undefined"){
				$(e.target).parents().each(function(){
					if(typeof $(this).attr('data-id') != "undefined"){
						id = $(this).attr('data-id');
					}
				});
			}
			
			gmaps.event.trigger(this.markers[id], 'mouseover');
			
			var position = this.markers[id].getPosition();
			
			var long = position.lng();
			var lat = position.lat();
			
			var newPosition = new gmaps.LatLng(lat, long);
			
			//Do not trigger a new search when we pan
			this.allowSearch = false;
			
			//Pan the map
			this.map.panTo(newPosition);	
		},
		
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
			var mapCenter = searchModel.get('map').center;			
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
			if(gmaps && (appModel.get('searchMode') == 'map')){
				this.addObjectMarker(result);	
			}

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
			
			//If there are no results, display so
			var numFound = appSearchResults.models.length;
			if (numFound == 0){
				this.$results.html('<p id="no-results-found">No results found.</p>');
			}

			//Load the first 25 results first so the list has visible results while the rest load in the background
			var min = 25;
			min = Math.min(min, numFound);
			var i = 0;
			for (i = 0; i < min; i++) {
				var element = appSearchResults.models[i];

				this.addOne(element);
			};
			
			//Remove the loading class and styling
			this.$results.removeClass('loading');
			
			//After the map is done loading, then load the rest of the results into the list
			var viewRef = this;
			var intervalId = setInterval(function() {
				if (viewRef.ready) {
					for (i = min; i < numFound; i++) {
						var element = appSearchResults.models[i];
						viewRef.addOne(element);
					};
					
					// Initialize any tooltips within the result item
					$(".tooltip-this").tooltip();
					$(".popover-this").popover();

					if(gmaps){
						// clean out any old markers
						viewRef.mergeMarkers();
						
						// show the clustered markers
						var mcOptions = {
							gridSize: 25,
							maxZoom: 15,
							styles: [
							{height: 20, width: 20, url: viewRef.markerImage20, textColor: '#FFFFFF'},
							{height: 30, width: 30, url: viewRef.markerImage30, textColor: '#FFFFFF'},
							{height: 40, width: 40, url: viewRef.markerImage40, textColor: '#FFFFFF'},
							{height: 50, width: 50, url: viewRef.markerImage50, textColor: '#FFFFFF'},
							{height: 60, width: 60, url: viewRef.markerImage60, textColor: '#FFFFFF'},
							]
						};
						
						if ( viewRef.markerCluster ) {
							viewRef.markerCluster.clearMarkers();
						}
						
						viewRef.markerCluster = new MarkerClusterer(viewRef.map, _.values(viewRef.markers), mcOptions);
						
						viewRef.markerClusters = viewRef.markerCluster.getMarkers();
						
						//Pan the map to the center of our results
						if((!viewRef.allowSearch) && (viewRef.masterBounds)){
							var center = viewRef.masterBounds.getCenter();
							viewRef.map.panTo(center);
						}
						
						$("#map-container").removeClass("loading");
					}
					
					clearInterval(intervalId);
				}
				
			}, 500);
			
			//After all the results are loaded, query for our facet counts in the background
			this.getFacetCounts();

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
			console.log($(e.target));
			
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
