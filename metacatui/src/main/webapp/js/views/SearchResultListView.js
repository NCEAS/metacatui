/*global define */
define(['jquery', 'underscore', 'backbone',  'collections/SolrResults', "views/SearchResultView", "text!templates/search.html", 'text!templates/statCounts.html'], 				
	function($, _, Backbone, SolrResults, SearchResultView, SearchTemplate, CountTemplate) {
	
	'use strict';

	/* =========================
	 * Search Result List View
	 * A view for the list of search results - used in the DataCatalogView and user profile
	 * =========================
	 */ 	
	var SearchResultListView = Backbone.View.extend({
		
		el: "#content",
					
		template: _.template(SearchTemplate),
		
		statsTemplate: _.template(CountTemplate),

		events: {
			
		},
		
		initialize: function(){
			this.model = new SolrResults([], {});
			this.stopListening(this.model);
			this.listenTo(this.model, 'add', this.addOne);
			this.listenTo(this.model, 'reset', this.addAll);
			
			this.resultsEl = this.$("#results");
		},
		
		render: function(){
			
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
			$(this.resultsEl).append(view.render().el);
		},
		
		/** Add all items in the **SearchResults** collection
		 * This loads the first 25, then waits for the map to be 
		 * fully loaded and then loads the remaining items.
		 * Without this delay, the app waits until all records are processed
		*/
		addAll: function () {
			
			// do this first to indicate coming results
			this.updateStats();
			
			//Clear the results list before we start adding new rows
			$(this.resultsEl).html('');
			
			//If there are no results, display so
			var numFound = this.model.models.length;
			if (numFound == 0){
				$(this.resultsEl).html('<p id="no-results-found">No results found.</p>');
			}
			
			//--- Add all the results to the list ---
			for (i = 0; i < numFound; i++) {
				var element = this.model.models[i];
				this.addOne(element);
			};
			
			// Initialize any tooltips within the result item
			$(".tooltip-this").tooltip();
			$(".popover-this").popover();
			
			//Remove the loading class and styling
			$(this.resultsEl).removeClass('loading');
		},
		
		//Update all the statistics throughout the page
		updateStats : function() {
			if (this.model.header != null) {
				this.$statcounts = this.$('#statcounts');
				this.$statcounts.html(
					this.statsTemplate({
						start : this.model.header.get("start") + 1,
						end   : this.model.header.get("start") + this.model.length,
						numFound : this.model.header.get("numFound")
					})
				);
			}
			
			// piggy back here
			//this.updatePager();
		},
	});
	
	return SearchResultListView;
});