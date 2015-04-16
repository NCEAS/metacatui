/*global define */
define(['jquery',
				'jqueryui', 
				'underscore', 
				'backbone',
				'views/SearchResultView',
				'text!templates/search.html',
				'text!templates/statCounts.html',
				'text!templates/pager.html',
				'text!templates/mainContent.html',
				'text!templates/currentFilter.html',
				'text!templates/loading.html',
				'gmaps',
				'nGeohash'
				], 				
	function($, $ui, _, Backbone, SearchResultView, CatalogTemplate, CountTemplate, PagerTemplate, MainContentTemplate, CurrentFilterTemplate, LoadingTemplate, gmaps, nGeohash) {
	'use strict';
	
	var DataCatalogView = Backbone.View.extend({

		el: '#Content',
		
		//The default global models for searching
		searchModel: appSearchModel,		
		searchResults: appSearchResults,
		
		//Templates
		template: _.template(CatalogTemplate),		
		statsTemplate: _.template(CountTemplate),		
		pagerTemplate: _.template(PagerTemplate),		
		mainContentTemplate: _.template(MainContentTemplate),
		currentFilterTemplate: _.template(CurrentFilterTemplate),
		loadingTemplate: _.template(LoadingTemplate),
		
		//Search mode
		mode: "map",
		
		//Map settings and storage
		map: null,
		ready: false,
		allowSearch: true,
		hasZoomed: false,
		markers: {},
		tiles: [],
		tileCounts: [],		
		//Contains the geohashes for all the markers on the map (if turned on in the Map model)
		markerGeohashes: [],		
		//Contains all the info windows for all the markers on the map (if turned on in the Map model)
		markerInfoWindows: [],		
		//Contains all the info windows for each document in the search result list - to display on hover
		tileInfoWindows: [],
		//Contains all the markers for each document in the search result list - to display on hover
		resultMarkers: [],
		//The geohash value for each tile drawn on the map
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
				   			   'click .more-link' : 'showMoreList',
				   		 'mouseover .open-marker' : 'showResultOnMap',
				   	      'mouseout .open-marker' : 'hideResultOnMap',
		      'mouseover .prevent-popover-runoff' : 'preventPopoverRunoff'
		},
		
		initialize: function(options){
			var view = this;
			
			//Get all the options and apply them to this view
			if(options){
				var optionKeys = Object.keys(options);
				_.each(optionKeys, function(key, i){
					view[key] = options[key];
				});				
			}
		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			//Use the global models if there are no other models specified at time of render
			if(typeof appSearchModel !== "undefined" && (Object.keys(this.searchModel).length == 0)) this.searchModel = appSearchModel;
			if(((typeof this.searchResults === "undefined") || (Object.keys(this.searchResults).length == 0)) && (appSearchResults && (Object.keys(appSearchResults).length > 0))) this.searchResults = appSearchResults;
			
			//Default to map mode
			if((typeof this.mode === "undefined") || !this.mode) this.mode = "map";
			
			appModel.set('headerType', 'default');
			this.toggleViewClass("DataCatalog");
			
			//Populate the search template with some model attributes
			var loadingHTML = this.loadingTemplate({
				msg: "Retrieving member nodes..."
			});
			var cel = this.template({	
				sortOrder:   this.searchModel.get('sortOrder'),
				yearMin:     this.searchModel.get('yearMin'),
				yearMax:     this.searchModel.get('yearMax'),
				pubYear:     this.searchModel.get('pubYear'),
				dataYear:    this.searchModel.get('dataYear'),
				resourceMap: this.searchModel.get('resourceMap'),
				searchOptions: registryModel.get('searchOptions'),
				username: appModel.get('username'),
				loading: loadingHTML
			});
			
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
			var categories = ['all', 'creator', 'taxon', 'annotation'];
			var thisTerm = null;
			
			for (var i=0; i<categories.length; i++){
				thisTerm = this.searchModel.get(categories[i]);
				
				if(thisTerm === undefined) break;
				
				for (var x=0; x<thisTerm.length; x++){
					this.showFilter(categories[i], thisTerm[x]);
				}
			}			
			// the additional fields
			this.showAdditionalCriteria();
			
			// Add the custom query under the "Anything" filter
			if(this.searchModel.get('customQuery')){
				this.showFilter("all", this.searchModel.get('customQuery'));
			}
			
			// Register listeners; this is done here in render because the HTML
			// needs to be bound before the listenTo call can be made
			this.stopListening(this.searchResults);
			this.listenTo(this.searchResults, 'add', this.addOne);
			this.listenTo(this.searchResults, 'reset', this.addAll);
			if(nodeModel.get("members").length > 0) this.listMemberNodes();
			else this.listenTo(nodeModel,   'change:members', this.listMemberNodes);
			
			//Listen to changes in the searchModel
			this.stopListening(this.searchModel);
			
			// listen to the appModel for the search trigger
			this.stopListening(appModel);
			this.listenTo(appModel, 'search', this.getResults);

			// Store some references to key views that we use repeatedly
			this.$resultsview = this.$('#results-view');
			this.$results = this.$('#results');
			
			// and go to a certain page if we have it
			this.getResults();	
			
			//Set a custom height on any elements that have the .auto-height class
			if($(".auto-height").length > 0) this.setAutoHeight();

			return this;
		},
		
		/*
		 * Sets the height on elements in the main content area to fill up the entire area minus header and footer
		 */
		setAutoHeight: function(){
			//Get the heights of the header, navbar, and footer
			var navbarHeight = ($("#Navbar").length > 0) ? $("#Navbar").outerHeight(true) : 0;
			var headerHeight = ($("#Header").length > 0) ? $("#Header").outerHeight(true) : 0;
			var footerHeight = ($("#Footer").length > 0) ? $("#Footer").outerHeight(true) : 0;
			var totalHeight = navbarHeight + headerHeight + footerHeight;
			
			//Get the remaining height left based on the window size
			var remainingHeight = $(window).outerHeight(true) - totalHeight;
			
			//Adjust all elements with the .auto-height class
			$(".auto-height").height(remainingHeight);
			
			$(window).resize(this.setAutoHeight);
		},
		
		toggleViewClass: function(name){
			$('body').toggleClass(name);
		},
		
		/**
		 * ==================================================================================================
		 * 										PERFORMING SEARCH
		 * ==================================================================================================
		**/
		triggerSearch: function() {				
			//Set the sort order 
			var sortOrder = $("#sortOrder").val();
			this.searchModel.set('sortOrder', sortOrder);
			
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
		
		
		/** 
		 * getResults gets all the current search filters from the searchModel, creates a Solr query, and runs that query.
		 */
		getResults: function (page) {			
			//Get the page number
			var page = appModel.get("page");
			if (page == null) {
				page = 0;
			}
			
			//Style the UI as loading
			this.loading();
			
			//Set the sort order based on user choice
			var sortOrder = this.searchModel.get('sortOrder');
			this.searchResults.setSort(sortOrder);
			
			//Specify which fields to retrieve
			var fields = "id,title,origin,pubDate,dateUploaded,abstract,resourceMap,beginDate,endDate,read_count_i,geohash_9,datasource,prov_hasSources,prov_hasDerivations";
			if(gmaps){
				fields += ",northBoundCoord,southBoundCoord,eastBoundCoord,westBoundCoord";
			}
			this.searchResults.setfields(fields);
			
			//Get the query
			var query = this.searchModel.getQuery();
						
			//Specify which facets to retrieve
			if(gmaps){ //If we have Google Maps enabled
				var geohashes = ["geohash_1", "geohash_2", "geohash_3", "geohash_4", "geohash_5", "geohash_6", "geohash_7", "geohash_8", "geohash_9"]
			    this.searchResults.facet = _.union(this.searchResults.facet, geohashes);
			}
			
			//Run the query
			this.searchResults.setQuery(query);
			
			//Show or hide the reset filters button
			if(this.searchModel.filterCount() > 0){
				this.showClearButton();
			}
			else{
				this.hideClearButton();
			}				
			
			// go to the page
			this.showPage(page);
			
			// don't want to follow links
			return false;
		},
		
		/**
		 * ==================================================================================================
		 * 											FILTERS
		 * ==================================================================================================
		**/
		updateCheckboxFilter : function(e, category, value){
			
			var checkbox = e.target;
			var checked = $(checkbox).prop("checked");

			if(typeof category == "undefined") var category = $(checkbox).attr('data-category');
			if(typeof value == "undefined") var value = $(checkbox).attr("value");
			
			//If the user just unchecked the box, then remove this filter
			if(!checked){
				this.searchModel.removeFromModel(category, value);
			}
			//If the user just checked the box, then add this filter
			else{
				var currentValue = this.searchModel.get(category);

				//Get the description
				var desc = $(checkbox).attr("data-description") || $(checkbox).attr("title");
				if(typeof desc == "undefined" || !desc) desc = "";
				//Get the label
				var labl = $(checkbox).attr("data-label");
				if(typeof labl == "undefined" || !labl) labl = "";
					
				//Make the filter object 
				var filter = {
						description: desc,
						label: labl,
						value: value
				}
				
				//If this filter category is an array, add this value to the array 
				if(Array.isArray(currentValue)){
					currentValue.push(filter);
					this.searchModel.set(category, currentValue);
				}
				else{
					//If it isn't an array, then just update the model with a simple value
					this.searchModel.set(category, filter);				
				}
				
				//Show the reset button
				this.showClearButton();
			}
			
			//Route to page 1
			this.updatePageNumber(0);
			
			//Trigger a new search
			this.triggerSearch();
		},
		
		updateBooleanFilters : function(e){
			var checkbox = e.target;
			
			//Get the category
			var category = $(checkbox).attr('data-category');
			var currentValue = this.searchModel.get(category);
			
			//If this filter is not available, exit this function
			if(!this.searchModel.filterIsAvailable(category)) return false;
			
			//If the checkbox has a value, then update as a string value not boolean
			var value = $(checkbox).attr("value");
			if(value){
				this.updateCheckboxFilter(e, category, value);
				return;
			}
			else value = $(checkbox).prop('checked');

			this.searchModel.set(category, value);
			
			//Show the reset button
			this.showClearButton();
			
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
			var defaultMinYear = this.searchModel.defaults().yearMin;
			var defaultMaxYear = this.searchModel.defaults().yearMax;
			
			// If either of the year type selectors is what brought us here, then determine whether the user
			// is completely removing both (reset both year filters) or just one (remove just that one filter)
			if((e !== undefined)){
				if(($(e.target).attr('id') == "data_year") || ($(e.target).attr('id') == "publish_year")){
					var pubYearChecked  = $('#publish_year').prop('checked');
					var dataYearChecked = $('#data_year').prop('checked');
					
					//When both are unchecked, assume user wants to reset the year filter
					if((!pubYearChecked) && (!dataYearChecked)){
						//Reset the search model
						this.searchModel.set('yearMin', defaultMinYear);
						this.searchModel.set('yearMax', defaultMaxYear);
						this.searchModel.set('dataYear', false);
						this.searchModel.set('pubYear', false);
						
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
			    this.searchModel.set('yearMin', $('#min_year').val());
			    this.searchModel.set('yearMax', $('#max_year').val());	
			    
			    //auto choose the year type for the user
			    this.selectYearType();
			    
				  //Route to page 1
			      this.updatePageNumber(0);
				      
				 //Trigger a new search
				 this.triggerSearch();
			}

		      			
			//jQueryUI slider 
			var model = this.searchModel;
			$('#year-range').slider({
			    range: true,
			    disabled: false,
			    min: this.searchModel.defaults().yearMin,	//sets the minimum on the UI slider on initialization
			    max: this.searchModel.defaults().yearMax, 	//sets the maximum on the UI slider on initialization
			    values: [ this.searchModel.get('yearMin'), this.searchModel.get('yearMax') ], //where the left and right slider handles are
			    stop: function( event, ui ) {
			    	
			      // When the slider is changed, update the input values
			      $('#min_year').val(ui.values[0]);
			      $('#max_year').val(ui.values[1]);
			      
			      //Also update the search model
			      model.set('yearMin', $('#min_year').val());
			      model.set('yearMax', $('#max_year').val());
			      
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
			  this.searchModel.set('dataYear', true);
			  
			  //refresh the UI buttonset so it appears as checked/unchecked
			  $("#filter-year").buttonset("refresh");
			  }
		},
		
		updateTextFilters : function(e, item){
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
			
			//Get the input element
			var input = this.$el.find('#' + category + '_input');
			
			//Get the value of the associated input
			var term 		= (!item || !item.value) ? input.val() : item.value;
			var label 		= (!item || !item.filterLabel) ? null : item.filterLabel;
			var filterDesc  = (!item || !item.desc) ? null : item.desc;
			
			//Check that something was actually entered
			if((term == "") || (term == " ")){
				return false;
			}
			
			//Take out quotes since all search multi-word terms are wrapped in quotes anyway
			while(term.startsWith('"') || term.startsWith("'")){
				term = term.substr(1);
			}
			while(term.startsWith("%22")){
				term = term.substr(3);
			}
			while(term.endsWith('"') || term.endsWith("'")){
				term = term.substr(0, term.length-1);
			}
			while(term.startsWith("%22")){
				term = term.substr(0, term.length-3);
			}
			
			//Close the autocomplete box
			if (e.type == "hoverautocompleteselect") {
				$(input).hoverAutocomplete("close");
			} 
			else if($(input).data('ui-autocomplete') != undefined){
				//If the autocomplete has been initialized, then close it
				$(input).autocomplete("close");
			}
				
			//Get the current searchModel array for this category
			var filtersArray = _.clone(this.searchModel.get(category));
			
			if(typeof filtersArray == "undefined"){
				console.error("The filter category '" + category + "' does not exist in the Search model. Not sending this search term.");
				return false;
			}
				
			//Check if this entry is a duplicate
			var duplicate = (function(){
				for(var i=0; i < filtersArray.length; i++){
					if(filtersArray[i].value === term){ return true; }
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
			var filter = {
					value: term,
					filterLabel: label,
					label: label,
					description: filterDesc
				};
			filtersArray.push(filter);
			
			//Replace the current array with the new one in the search model
			this.searchModel.set(category, filtersArray);
			
			//Show the UI filter
			this.showFilter(category, filter, false, label);
			
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
			
			//Check if this is the reserved phrase for the map filter
			if((category == "spatial") && (term == this.reservedMapPhrase)){
				this.resetMap();
				this.renderMap();
			}
			else{
				//Remove this filter term from the searchModel
				this.searchModel.removeFromModel(category, term);				
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
						
			this.allowSearch = true;
			
			//Clear all the filters in the UI
			this.$el.find('.current-filter').each(function(){
				viewRef.hideFilter(this);
			});
			
			//Hide the clear button
			this.hideClearButton();
			
			//Then reset the model
			this.searchModel.clear();		
			
			//Reset the year slider handles
			$("#year-range").slider("values", [this.searchModel.get('yearMin'), this.searchModel.get('yearMax')])
			//and the year inputs
			$("#min_year").val(this.searchModel.get('yearMin'));
			$("#max_year").val(this.searchModel.get('yearMax'));

			//Reset the checkboxes
			$("#includes_data").prop("checked", this.searchModel.get("resourceMap"));
			$("#includes-files-buttonset").buttonset("refresh");
			$("#data_year").prop("checked", this.searchModel.get("dataYear"));
			$("#publish_year").prop("checked", this.searchModel.get("pubYear"));
			$("#filter-year").buttonset("refresh");
			this.resetMemberNodeList();
			
			//Zoom out the Google Map
			this.resetMap();	
			this.renderMap();
			
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
		
		//Adds a specified filter node to the DOM
		showFilter : function(category, term, checkForDuplicates, label){
			
			var viewRef = this;
			
			if((typeof term === "undefined") || !term) return false;
			
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
			 
			var	value = null, 
				desc  = null;
			
			//See if this filter is an object and extract the filter attributes
			if(typeof term === "object"){
				if (typeof  term.description !== "undefined") {
					desc = term.description;
				}
				if (typeof term.filterLabel !== "undefined") {
					label = term.filterLabel;
				} else if (label) {
					// just keep it
				} else {
					label = null;
				}
				if (typeof  term.value !== "undefined") {
					value = term.value;
				}
			}
			else{
				value = term;
				
				//Find the filter label
				if((typeof label === "undefined") || !label) {
					
					//Use the filter value for the label, sans any leading # character
					if (value.indexOf("#") > 0) {
						label = value.substring(value.indexOf("#"));
					}
				}
				
				desc = label;
			}
			
			//Add a filter node to the DOM
			e.prepend(viewRef.currentFilterTemplate({
				value: value, 
				label: label,
				description: desc
				}
			));	
						
			
			return;
		},
		
		/*
		 * Get the member node list from the model and list the members in the filter list
		 */
		listMemberNodes: function(){
			//Get the member nodes
			var members = nodeModel.get("members");
			
			//Create an HTML list
			var listMax = 4,
				numHidden = members.length - listMax,
				list = document.createElement("ul");
			
			$(list).addClass("checkbox-list");
			
			//Add a checkbox and label for each member node in the node model
			_.each(members, function(member, i){
				var listItem = document.createElement("li"),
					input = document.createElement("input"),
					label = document.createElement("label");
					
					$(label).addClass("ellipsis tooltip-this")
							.attr("data-trigger", "hover")
							.attr("title", member.description)
							.attr("data-placement", "top")
							.html(member.name);
					$(input).addClass("filter")
							.attr("type", "checkbox")
							.attr("data-category", "memberNode")
							.attr("id", member.identifier)
							.attr("name", member.identifier)
							.attr("value", member.identifier)
							.attr("data-label", member.name)
							.attr("data-description", member.description);
										
					if(i > (listMax - 1)){
						$(listItem).addClass("hidden");
					}
					
					if(i == listMax){
						var moreLink = document.createElement("a");
						$(moreLink).html("Show " + numHidden + " more member nodes")
								   .addClass("more-link pointer");
						$(list).append(moreLink);
					} 
					
					$(listItem).append(input).append(label);
					$(list).append(listItem);
			});
			
			//Add the list of checkboxes to the placeholder
			var container = $('.member-nodes-placeholder');
			$(container).html(list);
			$(".tooltip-this").tooltip();
		},
		
		resetMemberNodeList: function(){
			//Reset the Member Nodes checkboxes
			var mnFilterContainer = $("#member-nodes-container"),
				defaultMNs = this.searchModel.get("memberNode");
			
			//Make sure the member node filter exists
			if(!mnFilterContainer || mnFilterContainer.length == 0) return false;
			if((typeof defaultMNs === "undefined") || !defaultMNs) return false;
			
			//Reset each member node checkbox
			var boxes = $(mnFilterContainer).find(".filter").prop("checked", false);
			
			//Check the member node checkboxes that are defaults in the search model
			_.each(defaultMNs, function(member, i){
				var value = null;
				
				//Allow for string search model filter values and object filter values
				if((typeof member !== "object") && member) value = member;
				else if((typeof member.value === "undefined") || !member.value) value = "";
				else value = member.value;
				
				$(mnFilterContainer).find("checkbox[value='" + value + "']").prop("checked", true);	
			});
			
			return true;
		},
		
		showMoreList: function(e){
			var link = e.target,
				hiddenListItems = $(link).parent().find("li.hidden");
			
			_.each(hiddenListItems, function(listItem){
				$(listItem).fadeIn();
				$(listItem).removeClass("hidden");
			});
			
			$(link).addClass("hidden");
		},
		
		// highlights anything additional that has been selected
		showAdditionalCriteria: function() {
			var model = this.searchModel;
			
			// style the selection			
			$(".keyword-search-link").each(function(index, targetNode){
				//Neutralize all keyword search links by 'deactivating'
				$(targetNode).removeClass("active");
				//Do this for the parent node as well for template flexibility
				$(targetNode).parent().removeClass("active");
				
				var dataCategory = $(targetNode).attr("data-category");
				var dataTerm = $(targetNode).attr("data-term");
				var terms = model.get(dataCategory);
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
			this.searchModel.set(category, [term]);
			
			// Trigger the search
			this.triggerSearch();
			
			// prevent default action of click
			return false;

		},
		
		removeAdditionalCriteria: function(e){

			// Get the clicked node
			var targetNode = $(e.target);
			
			//Reference to model
			var model = this.searchModel;
			
			// remove the styling
			$(".keyword-search-link").removeClass("active");
			$(".keyword-search-link").parent().removeClass("active");
			
			//Get the term
			var term = targetNode.attr('data-term');
			
			//Get the current search model additional criteria 
			var current = this.searchModel.get('additionalCriteria');
			//If this term is in the current search model (should be)...
			if(_.contains(current, term)){
				//then remove it
				var newTerms = _.without(current, term);
				model.set("additionalCriteria", newTerms);
			}

			//Route to page 1
			this.updatePageNumber(0);
			
			//Trigger a new search
			this.triggerSearch();
		},

		//Get the facet counts
		getAutoCompletes: function(){
			var viewRef = this;
			
			//Create the facet query by using our current search query 
			var facetQuery = "q=" + this.searchResults.currentquery +
							 "&wt=json" +
							 "&rows=0" +
							 this.searchModel.getFacetQuery();

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
						viewRef.updateTextFilters(event, ui.item);
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
				
				if(attributeNameSuggestions){
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
							viewRef.updateTextFilters(event, ui.item);
							// prevent default action
							return false;
						},
						position: {
							my: "left top",
							at: "left bottom"				
						}
					});
				}
				
				// suggest annotation concepts
				var annotationSuggestions = facetCounts.sem_annotation;
				if(annotationSuggestions){
					var rankedAnnotationSuggestions = new Array();
					for (var i=0; i < Math.min(annotationSuggestions.length-1, facetLimit); i+=2) {
						rankedAnnotationSuggestions.push({
							value: annotationSuggestions[i], 
							label: annotationSuggestions[i].substring(annotationSuggestions[i].indexOf("#")), 
							filterLabel: annotationSuggestions[i].substring(annotationSuggestions[i].indexOf("#")),
							desc: annotationSuggestions[i], 

						});
					}
					$('#annotation_input').hoverAutocomplete({
						source: 
							function (request, response) {
					            var term = $.ui.autocomplete.escapeRegex(request.term)
					                , startsWithMatcher = new RegExp("^" + term, "i")
					                , startsWith = $.grep(rankedAnnotationSuggestions, function(value) {
					                    return startsWithMatcher.test(value.label || value.value || value);
					                })
					                , containsMatcher = new RegExp(term, "i")
					                , contains = $.grep(rankedAnnotationSuggestions, function (value) {
					                    return $.inArray(value, startsWith) < 0 && 
					                        containsMatcher.test(value.label || value.value || value);
					                });
					            					            
					            // use local values from facet
					            var localValues = startsWith.concat(contains);
					            
					            // pass to bioportal search to complete the list and do the call back
					            lookupModel.bioportalSearch(request, response, localValues, rankedAnnotationSuggestions);
					            
				        },
						select: function(event, ui) {
							// set the text field
							$('#annotation_input').val(ui.item.value);
							// add to the filter immediately
							viewRef.updateTextFilters(event, ui.item);
							// prevent default action
							return false;
						},
						position: {
							my: "left top",
							at: "left bottom"				
						}
					});
				}
				
				
				// suggest creator names/organizations
				var originSuggestions = facetCounts.origin;
				if(originSuggestions){
					var rankedOriginSuggestions = new Array();
					for (var i=0; i < Math.min(originSuggestions.length-1, facetLimit); i+=2) {
						rankedOriginSuggestions.push({value: originSuggestions[i], label: originSuggestions[i] + " (" + originSuggestions[i+1] + ")"});
					}
					$('#creator_input').hoverAutocomplete({
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
				            
				            // use local values from facet
				            var localValues = startsWith.concat(contains);
				            
				            // pass to orcid search to complete the list and do the call back
				            lookupModel.orcidSearch(request, response, localValues);
				        },
						select: function(event, ui) {
							// set the text field
							$('#creator_input').val(ui.item.value);
							// add to the filter immediately
							viewRef.updateTextFilters(event, ui.item);
							// prevent default action
							return false;
						},
						position: {
							my: "left top",
							at: "left bottom"				
						}
					});
				}
				
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
						viewRef.updateTextFilters(event, ui.item);
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
						viewRef.updateTextFilters(event, ui.item);
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
		
		hideClearButton: function(){
			//Hide the reset button
			$('#clear-all').addClass("hidden");
		},
		
		showClearButton: function(){
			//Show the reset button
			$("#clear-all").removeClass("hidden");
		},
		
		/**
		 * ==================================================================================================
		 * 											NAVIGATING THE UI
		 * ==================================================================================================
		**/
		//Update all the statistics throughout the page
		updateStats : function() {
			if (this.searchResults.header != null) {
				this.$statcounts = this.$('#statcounts');
				this.$statcounts.html(
					this.statsTemplate({
						start    : this.searchResults.header.get("start") + 1,
						end      : this.searchResults.header.get("start") + this.searchResults.length,
						numFound : this.searchResults.header.get("numFound")
					})
				);
			}
			
			// piggy back here
			this.updatePager();
		},
		
		updatePager : function() {
			if (this.searchResults.header != null) {
				var pageCount = Math.ceil(this.searchResults.header.get("numFound") / this.searchResults.header.get("rows"));
				
				//If no results were found, display a message instead of the list and clear the pagination.
				if(pageCount == 0){
					this.$results.html('<p id="no-results-found">No results found.</p>');
					
					this.$('#resultspager').html("");
					this.$('.resultspager').html("");
				}
				//Do not display the pagination if there is only one page
				else if(pageCount == 1){
					this.$('#resultspager').html("");
					this.$('.resultspager').html("");
				}
				else{
					var pages = new Array(pageCount);
					
					// mark current page correctly, avoid NaN
					var currentPage = -1;
					try {
						currentPage = Math.floor((this.searchResults.header.get("start") / this.searchResults.header.get("numFound")) * pageCount);
					} catch (ex) {
						console.log("Exception when calculating pages:" + ex.message);
					}

					//Populate the pagination element in the UI
					this.$('.resultspager').html(
						this.pagerTemplate({
							pages: pages,
							currentPage: currentPage
						})
					);
					this.$('#resultspager').html(
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
			this.searchResults.nextpage();
			this.$resultsview.show();
			this.updateStats();
			
			var page = appModel.get("page");
			page++;
			this.updatePageNumber(page);
		},
		
		// Previous page of results
		prevpage: function () {
			this.loading();
			this.searchResults.prevpage();
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
			this.searchResults.toPage(page);
			this.$resultsview.show();
			this.updateStats();	
			this.updatePageNumber(page);
		},
		
		/**
		 * ==================================================================================================
		 * 											THE MAP
		 * ==================================================================================================
		**/		
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
			
			//Get the map options and create the map
			gmaps.visualRefresh = true;
			var mapOptions = mapModel.get('mapOptions');
			$("#map-container").html('<div id="map-canvas"></div>');
			this.map = new gmaps.Map($('#map-canvas')[0], mapOptions);

			//Store references
			var mapRef = this.map;
			var viewRef = this;
			
			google.maps.event.addListener(mapRef, "idle", function(){
				viewRef.ready = true;
				
				google.maps.event.trigger(mapRef, 'resize');
				
				if(viewRef.allowSearch){
					
					//If the map is at the minZoom, i.e. zoomed out all the way so the whole world is visible, do not apply the spatial filter
					if(viewRef.map.getZoom() == mapOptions.minZoom){
						if(!viewRef.hasZoomed) return; 
						
						viewRef.resetMap();	
					}
					else{						
						//Get the Google map bounding box
						var boundingBox = mapRef.getBounds();
						
						//Set the search model spatial filters
						//Encode the Google Map bounding box into geohash
						var north = boundingBox.getNorthEast().lat(),
							west  = boundingBox.getSouthWest().lng(),
							south = boundingBox.getSouthWest().lat(),
							east  = boundingBox.getNorthEast().lng();
							
						viewRef.searchModel.set('north', north);
						viewRef.searchModel.set('west',  west);
						viewRef.searchModel.set('south', south);
						viewRef.searchModel.set('east',  east);
						
						//Determine the precision of geohashes to search for
						var zoom = mapRef.getZoom();												
						
						var precision = mapModel.getSearchPrecision(zoom);
						
						//Get all the geohash tiles contained in the map bounds
						var geohashBBoxes = nGeohash.bboxes(south, west, north, east, precision);
												
						//Save our geohash search settings
						viewRef.searchModel.set('geohashes', geohashBBoxes);
						viewRef.searchModel.set('geohashLevel', precision);
						
						//Set the search model map filters
						viewRef.searchModel.set('map', {
							zoom: viewRef.map.getZoom(), 
							center: viewRef.map.getCenter()
							});
												
						//Add a new visual 'current filter' to the DOM for the spatial search
						viewRef.showFilter('spatial', viewRef.reservedMapPhrase, true);
					}
					
					viewRef.mapCenter = viewRef.map.getCenter();
					
					//Reset to the first page
					appModel.set("page", 0);
					
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
			this.searchModel.resetGeohash();
			mapModel.clear();
			
			this.allowSearch = false;
			
			//Remove the map filter in the UI
			this.hideFilter($('#current-spatial-filters').find('[data-term="'+ this.reservedMapPhrase +'"]'));
		},
		
		/**
		 * Show the marker, infoWindow, and bounding coordinates polygon on the map when the user hovers on the marker icon in the result list
		 */
		showResultOnMap: function(e){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Clear the panning timeout
			window.clearTimeout(this.centerTimeout);
			
			//Get the attributes about this dataset
			var resultRow = e.target,
				id = $(resultRow).attr("data-id"),
				position = nGeohash.decode( $(resultRow).attr("data-geohash") ),
				positionLatLng = new google.maps.LatLng(position.latitude, position.longitude);
						
			//The mouseover event might be triggered by a nested element, so loop through the parents to find the id
			if(typeof id == "undefined"){
				$(resultRow).parents().each(function(){
					if(typeof $(this).attr('data-id') != "undefined"){
						id = $(this).attr('data-id');
						resultRow = this;
					}
				});
			}
			
			//Open up the infoWindow, display the polygon, and display the marker for this dataset
			if(this.resultMarkers[id]){
				this.resultMarkers[id].infoWindow.open(this.map, this.resultMarkers[id].marker);
				this.resultMarkers[id].infoWindow.isOpen = true;
				this.resultMarkers[id].marker.setMap(this.map);
				this.resultMarkers[id].polygon.setMap(this.map);
				this.resultMarkers[id].polygon.setVisible(true);
			}

			//Do not trigger a new search when we pan
			this.allowSearch = false;
			
			//Pan the map
			this.map.panTo(positionLatLng);	
		},
	
		/**
		 * Hide the marker, infoWindow, and bounding coordinates polygon on the map when the user stops hovering on the marker icon in the result list
		 */
		hideResultOnMap: function(e){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
			
			//Get the attributes about this dataset
			var resultRow = e.target,
				id = $(resultRow).attr("data-id");
			
			//The mouseover event might be triggered by a nested element, so loop through the parents to find the id
			if(typeof id == "undefined"){
				$(e.target).parents().each(function(){
					if(typeof $(this).attr('data-id') != "undefined"){
						id = $(this).attr('data-id');
						resultRow = this;
					}
				});
			}		
			
			//Find the marker, polygon, and infoWindow in the view for this result item and close it
			if(this.resultMarkers[id]){
				this.resultMarkers[id].infoWindow.close();
				this.resultMarkers[id].infoWindow.isOpen = false;
				this.resultMarkers[id].polygon.setMap(null);
				this.resultMarkers[id].polygon.setVisible(false);
				this.resultMarkers[id].marker.setMap(null);
			}
			
			//Pan back to the map center so the map will reflect the current spatial filter bounding box
			var mapCenter = this.mapCenter;
			
			if((typeof mapCenter != "undefined") && (mapCenter !== null)){
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
		
		/**
		 * Create a tile for each geohash facet. A separate tile label is added to the map with the count of the facet.
		 **/
		drawTiles: function(){			
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}
						
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
				geohashes       = this.searchResults.facetCounts[geohashLevel];
			
			//Save the current geohash level in the map model
			mapModel.set("tileGeohashLevel", geohashLevelNum);
			
			//Get all the geohashes contained in the map
			var mapBBoxes = this.searchModel.get("geohashes");
			
			//Geohashes may be returned that are part of datasets with multiple geographic areas. Some of these may be outside this map.
			//So we will want to filter out geohashes that are not contained in this map. 
			if(mapBBoxes.length == 0){
				var filteredTileGeohashes = geohashes;
			}
			else{
				var filteredTileGeohashes = [];
				for(var i=0; i<geohashes.length-1; i+=2){
					
					//Get the geohash for this tile
					var tileGeohash	= geohashes[i],
						isInsideMap = false,
						index		= 0;
					
					//Find if any of the bounding boxes/geohashes inside our map contain this tile geohash
					while((!isInsideMap) && (index < mapBBoxes.length)){
						if(tileGeohash.substring(0, mapBBoxes[index].length) == mapBBoxes[index]) isInsideMap = true;
						index++;
					}
					
					if(isInsideMap){
						filteredTileGeohashes.push(tileGeohash);
						filteredTileGeohashes.push(geohashes[i+1]);
					}
				}
			}
			
			//Get some stats on our tile counts so we can normalize them to create a color scale
			var totalTiles = filteredTileGeohashes.length/2,
				maxCount = _.max(filteredTileGeohashes, function(value){
					var reg = new RegExp('^\\d+$');
					if(!reg.test(value)) return 0;
					return value;
				}),
				ratio = maxCount / 100;
			
			var viewRef = this;
			
			//Now draw a tile for each geohash facet
			for(var i=0; i<filteredTileGeohashes.length-1; i+=2){
				
				//Convert this geohash to lat,long values 
				var tileGeohash	   = filteredTileGeohashes[i],
					decodedGeohash = nGeohash.decode(tileGeohash),
					latLngCenter   = new google.maps.LatLng(decodedGeohash.latitude, decodedGeohash.longitude),
					geohashBox 	   = nGeohash.decode_bbox(tileGeohash),
					swLatLng	   = new google.maps.LatLng(geohashBox[0], geohashBox[1]),
					neLatLng	   = new google.maps.LatLng(geohashBox[2], geohashBox[3]),
					bounds 		   = new google.maps.LatLngBounds(swLatLng, neLatLng),
					tileCount	   = filteredTileGeohashes[i+1],
					percent 		   = Math.round( tileCount / ratio ),
					useBins		   = (maxCount > 200) ? true : false,
					drawMarkers    = mapModel.get("drawMarkers"),
					marker,
					count,
					color;
								
				//When there is only one dataset in this tile, we might display a marker
				if ((tileCount == 1) && drawMarkers){
						viewRef.markerGeohashes.push(tileGeohash);
				}
				else{
					if(!useBins){
						//Determine the style of the tile depending on the percentage of datasets
							 if (percent < .20) color = mapModel.get("tileColors").level1;
						else if (percent < .40) color = mapModel.get("tileColors").level2; 
						else if (percent < .70) color = mapModel.get("tileColors").level3; 
						else if (percent < .80) color = mapModel.get("tileColors").level4; 
						else 					color = mapModel.get("tileColors").level5; 
						
					}
					else{
						//Determine the style of the tile depending on the number of datasets
						     if (tileCount < 10)   color = mapModel.get("tileColors").level1; 
						else if (tileCount < 50)   color = mapModel.get("tileColors").level2; 
						else if (tileCount < 100)  color = mapModel.get("tileColors").level3; 
						else if (tileCount < 1000) color = mapModel.get("tileColors").level4; 
						else                       color = mapModel.get("tileColors").level5; 
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
					this.tileGeohashes.push(tileGeohash);
					
					//Save our tiles in the view
					this.tiles.push({text: count, shape: tile, geohash: tileGeohash});
				}
			}
			
			//Create an info window for each result item in the list that has spatial data, to display when it is hovered over
			
			
			//Create an info window for each marker that is on the map, to display when it is clicked on
			if(this.markerGeohashes.length > 0) this.addMarkers();
			
			//If the map is zoomed all the way in, draw info windows for each tile that will be displayed when they are clicked on
			if(mapModel.isMaxZoom(this.map)) this.addTileInfoWindows();
		},
			
		/**
		 * With the options and label object given, add a single tile to the map and set its event listeners
		 **/
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
				
				/** Set up some helper functions for zooming in on the map **/
				var myFitBounds = function(myMap, bounds) {
				    myMap.fitBounds(bounds); // calling fitBounds() here to center the map for the bounds

				    var overlayHelper = new google.maps.OverlayView();
				    overlayHelper.draw = function () {
				        if (!this.ready) {
				            var extraZoom = getExtraZoom(this.getProjection(), bounds, myMap.getBounds());
				            if (extraZoom > 0) {
				                myMap.setZoom(myMap.getZoom() + extraZoom);
				            }
				            this.ready = true;
				            google.maps.event.trigger(this, 'ready');
				        }
				    };
				    overlayHelper.setMap(myMap);
				}
				 var getExtraZoom = function(projection, expectedBounds, actualBounds) {

				    // in: LatLngBounds bounds -> out: height and width as a Point
				    var getSizeInPixels = function(bounds) {
				        var sw = projection.fromLatLngToContainerPixel(bounds.getSouthWest());
				        var ne = projection.fromLatLngToContainerPixel(bounds.getNorthEast());
				        return new google.maps.Point(Math.abs(sw.y - ne.y), Math.abs(sw.x - ne.x));
				    }

				    var expectedSize = getSizeInPixels(expectedBounds),
				        actualSize = getSizeInPixels(actualBounds);

				    if (Math.floor(expectedSize.x) == 0 || Math.floor(expectedSize.y) == 0) {
				        return 0;
				    }

				    var qx = actualSize.x / expectedSize.x;
				    var qy = actualSize.y / expectedSize.y;
				    var min = Math.min(qx, qy);

				    if (min < 1) {
				        return 0;
				    }

				    return Math.floor(Math.log(min) / Math.LN2 /* = log2(min) */);
				}
				
				//Zoom in when the tile is clicked on
				gmaps.event.addListener(tile, 'click', function(clickEvent) {
					//Change the center
					viewRef.map.panTo(clickEvent.latLng);
					
					//Get this tile's bounds
					var tileBounds = tile.getBounds();
					//Get the current map bounds
					var mapBounds = viewRef.map.getBounds();
								
					//Change the zoom
					//viewRef.map.fitBounds(tileBounds);
					myFitBounds(viewRef.map, tileBounds);
				});
			}
			
			return tile;
		},
		
		/**
		 * Get the details on each marker
		 * And create an infowindow for that marker
		 */		
		addMarkers: function(){
			//Exit if maps are not in use
			if((appModel.get('searchMode') != 'map') || (!gmaps)){
				return false;
			}	
			
			//Clone the Search model
			var searchModelClone = this.searchModel.clone(),
				geohashLevel = mapModel.get("tileGeohashLevel"),
				viewRef = this,
				infoWindows = [],
				markers = this.markers;
			
			//Change the geohash filter to match our tiles 
			searchModelClone.set("geohashLevel", geohashLevel);
			searchModelClone.set("geohashes", this.markerGeohashes);
			
			//Now run a query to get a list of documents that are represented by our markers
			var query = "q=" + searchModelClone.getQuery() + 
						"&wt=json" +
						"&fl=id,title,geohash_9,abstract,geohash_" + geohashLevel +
						"&rows=1000";
						
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr){
				var docs = data.response.docs;
				var uniqueGeohashes = viewRef.markerGeohashes;
				
				//Create a marker and infoWindow for each document
				_.each(docs, function(doc, key, list){
					
					var marker,
						drawMarkersAt = [];
					
					// Find the tile place that this document belongs to
					// For each geohash value at the current geohash level for this document,
					_.each(doc.geohash_9, function(geohash, key, list){
						// Loop through each unique tile location to find its match
						for(var i=0; i <= uniqueGeohashes.length; i++){
							if(uniqueGeohashes[i] == geohash.substr(0, geohashLevel)){
								drawMarkersAt.push(geohash);
								uniqueGeohashes = _.without(uniqueGeohashes, geohash);
							}
						}
					});
					
					_.each(drawMarkersAt, function(markerGeohash, key, list){

						var decodedGeohash = nGeohash.decode(markerGeohash),
							latLng   	   = new google.maps.LatLng(decodedGeohash.latitude, decodedGeohash.longitude);	
						
						//Set up the options for each marker
						var markerOptions = {
							position: latLng,
							icon: mapModel.get("markerImage"),
							zIndex: 99999,
							map: viewRef.map
						};
						
						//Create the marker and add to the map
						var marker = new google.maps.Marker(markerOptions);
						
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
							disableAutoPan: false,
							maxWidth: 250,
							position: latLng
						});
						
						//Store this infowindow in the view
						viewRef.markerInfoWindows.push(infoWindow);
						
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

			}, "json");
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
			var searchModelClone = this.searchModel.clone(),
				geohashLevel = mapModel.get("tileGeohashLevel"),
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
						for(var i=0; i < doc[geohashName].length; i++){
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
						disableAutoPan: false,
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
		
		/**
		 * Iterate over all the markers in the view and remove them from the map and view
		 */
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
		
		
		/**
		 * ==================================================================================================
		 * 											ADDING RESULTS 
		 * ==================================================================================================
		**/

		/** Add all items in the **SearchResults** collection
		 * This loads the first 25, then waits for the map to be 
		 * fully loaded and then loads the remaining items.
		 * Without this delay, the app waits until all records are processed
		*/
		addAll: function () {
			
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
			var numFound = this.searchResults.models.length;
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
						var element = viewRef.searchResults.models[i];
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
		
		/**
		 * Add a single SolrResult item to the list by creating a view for it and appending its element to the DOM.
		 */
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
			if(gmaps && (typeof result.get("northBoundCoord") != "undefined")){
				
				//Set up the options for our polygon and marker
				var north = result.get("northBoundCoord"),
					south = result.get("southBoundCoord"),
					east  = result.get("eastBoundCoord"),
					west  = result.get("westBoundCoord"),
					title = result.get("title"),
					centerGeohash = result.get("geohash_9")[0],	
					decodedGeohash = nGeohash.decode(centerGeohash),
					position = new google.maps.LatLng(decodedGeohash.latitude, decodedGeohash.longitude),
					latLngSW = new gmaps.LatLng(south, west),
					latLngNE = new gmaps.LatLng(north, east),
					latLngNW = new gmaps.LatLng(north, west),
					latLngSE = new gmaps.LatLng(south, east),
					//Create a polygon representing the bounding coordinates of this data
					polygon = new gmaps.Polygon({
						paths: [latLngNW, latLngNE, latLngSE, latLngSW],
						strokeColor: '#FFFFFF',
						strokeWeight: 2,
						fillColor: '#FFFFFF',
						fillOpacity: '0.3'
					}),
					//Create a marker at the center of this data
					marker = new gmaps.Marker({
						position: position,
						icon: mapModel.get("markerImage"),
						zIndex: 99999
					}),
					// A small info window with just the title for each marker
					infoWindow = new gmaps.InfoWindow({
						content: title,
						disableAutoPan: true,
						maxWidth: 250
					});
				
				this.resultMarkers[result.get("id")] = {
						polygon: polygon, 
						marker: marker, 
						infoWindow: infoWindow
						}
			}
		
		},
		
		
		/**
		 * ==================================================================================================
		 * 											STYLING THE UI 
		 * ==================================================================================================
		**/
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
				this.getResults();
			}
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
		
		onClose: function () {						
			this.$el.removeClass("DataCatalog");
			
			if(gmaps){
				// unset map mode
				$("body").removeClass("mapMode");
				$("#map-canvas").remove();
			}
			
			// remove everything so we don't get a flicker
			this.$el.html('')
		}				
	});
	return DataCatalogView;		
});
