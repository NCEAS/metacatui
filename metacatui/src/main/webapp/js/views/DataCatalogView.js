/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'views/SearchResultView',
				'text!templates/search.html',
				'text!templates/statCounts.html',
				'text!templates/resultsItem.html'
				], 				
	function($, _, Backbone, SearchResultView, CatalogTemplate, CountTemplate, ResultItemTemplate) {
	'use strict';
	
	var DataCatalogView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(CatalogTemplate),
		
		statsTemplate: _.template(CountTemplate),

		resultTemplate: _.template(ResultItemTemplate),
		
		// Delegated events for creating new items, and clearing completed ones.
		events: {
//			'click #mostaccessed_link': 'showMostAccessed',
			'click #recent_link': 'showRecent',
//			'click #featureddata_link': 'showFeatured',
			'click #results_prev': 'prevpage',
			'click #results_next': 'nextpage',
			'click #results_prev_bottom': 'prevpage',
			'click #results_next_bottom': 'nextpage',
			'click #search_btn_side': 'triggerSearch',
			'keypress #search_txt_side': 'triggerOnEnter'
		},
		
		initialize: function () {
			
		},
		
		triggerSearch: function() {
			// alert the model that a search should be performed
			var searchTerm = $("#search_txt_side").val();
			appModel.set('searchTerm', searchTerm);
			appModel.trigger('search');
			
			// make sure the browser knows where we are
			uiRouter.navigate("data");
			
			// ...but don't want to follow links
			return false;
		},
		
		triggerOnEnter: function(e) {
			if (e.keyCode != 13) return;
			this.triggerSearch();
		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {

			console.log('Rendering the DataCatlog view');
			appModel.set('headerType', 'default');
			appModel.set('navbarPosition', 'fixed');
			
			var cel = this.template(
					{
						searchTerm: appModel.get('searchTerm')
					}
			);
			this.$el.html(cel);
			this.updateStats();
			
			// Register listeners; this is done here in render because the HTML
			// needs to be bound before the listenTo call can be made
			this.stopListening(appSearchResults);
			this.listenTo(appSearchResults, 'add', this.addOne);
			this.listenTo(appSearchResults, 'reset', this.addAll);
			
			// listen to the appModel for the search trigger
			this.stopListening(appModel);
			this.listenTo(appModel, 'search', this.showResults);

			// Store some references to key views that we use repeatedly
			this.$resultsview = this.$('#results-view');
			this.$results = this.$('#results');
			this.$pagehead = this.$('#pagehead');
			
			// show the results by default
			this.showResults();

			return this;
		},

		showResults: function () {

			var search = appModel.get('searchTerm');

			var resultTitle = 'Search Results';
			if (search) {
				resultTitle += ' - ' + search; 
			}
			this.removeAll();
			this.$pagehead.html(resultTitle);
			appSearchResults.setrows(25);
			appSearchResults.setSort("dateUploaded+desc");
			appSearchResults.setfields("id,title,origin,pubDate,dateUploaded,abstract,resourceMap");
			appSearchResults.query('formatType:METADATA+-obsoletedBy:*+' + search);
			this.$resultsview.fadeIn();
			this.updateStats();
			this.updateSearchBox();
			// update links
			this.$(".popular-search-link").removeClass("sidebar-item-selected");
			try {
				this.$("#popular-search-" + search).addClass("sidebar-item-selected");
			} catch (ex) {
				// syntax in search term is probably to blame
				console.log(ex.message + " - could not set selected state for: " + "#popular-search-" + search);
			}
			//this.$("#mostaccessed_link").removeClass("sidebar-item-selected");
			//this.$("#featureddata_link").removeClass("sidebar-item-selected");
			
			// don't want to follow links
			return false;
		},
		
		showRecent: function () {

			// clear the search term
			var currentSearchTerm = appModel.get('searchTerm');
			appModel.set('searchTerm', '');
			
			// search last month
			var dateQuery = "dateUploaded: [NOW-1MONTH/DAY TO *]";

			this.removeAll();
			this.$pagehead.html('Most Recent');
			appSearchResults.setrows(25);
			appSearchResults.setSort("dateUploaded+desc");
			appSearchResults.setfields("id,title,origin,pubDate,dateUploaded,abstract,resourceMap");
			appSearchResults.query("formatType:METADATA+-obsoletedBy:*+" + dateQuery);
			this.$resultsview.fadeIn();
			this.updateStats();
			this.updateSearchBox();
			
			// update links
			this.$(".popular-search-link").removeClass("sidebar-item-selected");
			this.$("#recent_link").addClass("sidebar-item-selected");
			
			// don't want the link to be followed
			return false;
			
		},

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
		},
		
		updateSearchBox: function() {
			// look up from the model to ensure we display the side box correctly
			var search = appModel.get('searchTerm');
			this.$("#search_txt_side").val(search);
		},

		// Next page of results
		nextpage: function () {
			this.removeAll();
			appSearchResults.nextpage();
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Previous page of results
		prevpage: function () {
			this.removeAll();
			appSearchResults.prevpage();
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Add a single SolrResult item to the list by creating a view for it, and
		// appending its element to the `<ul>`.
		addOne: function (result) {
			this.$view_service = appModel.get('viewServiceUrl');
			this.$package_service = appModel.get('packageServiceUrl');
			result.set( {view_service: this.$view_service, package_service: this.$package_service} );
			var view = new SearchResultView({ model: result });
			this.$results.append(view.render().el);
		},

		// Add all items in the **SearchResults** collection at once.
		addAll: function () {
			appSearchResults.each(this.addOne, this);
			this.updateStats();
		},
		
		// Remove all html for items in the **SearchResults** collection at once.
		removeAll: function () {
			this.$results.html('');
		},
		
		onClose: function () {			
			console.log('Closing the data view');
			// remove everything so we don't get a flicker
			this.$el.html('')
		}				
	});
	return DataCatalogView;		
});
