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
//			'click #recent_link': 'showRecent',
//			'click #featureddata_link': 'showFeatured',
			'click #results_prev': 'prevpage',
			'click #results_next': 'nextpage',
			'click #results_prev_bottom': 'prevpage',
			'click #results_next_bottom': 'nextpage',
			'click #results_link': 'showResults',
			'click #search_btn': 'showResults',
			'click #view_link': 'showMetadata',
		},
		
		initialize: function () {
			
		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {

			console.log('Rendering the DataCatlog view');
			appModel.set('headerType', 'default');
			var cel = this.template();
			this.$el.html(cel);
			this.updateStats();
			
			// Register listeners; this is done here in render because the HTML
			// needs to be bound before the listenTo call can be made
			this.listenTo(appSearchResults, 'add', this.addOne);
			this.listenTo(appSearchResults, 'reset', this.addAll);
			this.listenTo(appSearchResults, 'all', this.render);

			// Store some references to key views that we use repeatedly
			//this.$searchview = this.$('#Search');
			this.$resultsview = this.$('#results-view');
			this.$metadataview = this.$('#metadata-view');
			this.$results = this.$('#results');
			this.$pagehead = this.$('#pagehead');

			return this;
		},

		showResults: function () {

			var search = $("#search_txt").val();
			this.removeAll();
			this.$pagehead.html('Search Results');
			appSearchResults.setrows(25);
			appSearchResults.setSort("title+desc");
			appSearchResults.setfields("id,title,origin,pubDate,dateUploaded,abstract");
			appSearchResults.query("formatType:METADATA+-obsoletedBy:*+" + search);
			//this.$("#recent_link").removeClass("sidebar-item-selected");
			//this.$("#mostaccessed_link").removeClass("sidebar-item-selected");
			this.$("#results_link").addClass("sidebar-item-selected");
			//this.$("#featureddata_link").removeClass("sidebar-item-selected");
			this.$metadataview.fadeOut();
			this.$resultsview.fadeIn();
			this.updateStats();
		},

		updateStats : function() {
			if (appSearchResults.header != null) {
			this.$statcounts = this.$('#statcounts');
				this.$statcounts.html(this.statsTemplate({
					start : appSearchResults.header.get("start") + 1,
					end : appSearchResults.header.get("start") + appSearchResults.length,
					numFound : appSearchResults.header.get("numFound")
				}));
			}
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
		},
		
		// Remove all html for items in the **SearchResults** collection at once.
		removeAll: function () {
			this.$results.html('');
		},
		
		// Switch the view to the Metadata view, which is built from an AJAX call
		// to retrieve the metadata view from the server for the given ID
		showMetadata: function (event) {
			
			// Look up the pid from the clicked link element
			var pid = event.target.getAttribute("pid");
			
			// Get the view of the document from the server and load it
			this.$view_service = appModel.get('viewServiceUrl');
			this.$package_service = appModel.get('packageServiceUrl');
			var endpoint = this.$view_service + pid + ' #Metadata';
			$('#metadata-view').load(endpoint);
			
			// Hide the existing results listing, and show the metadata
			this.$resultsview.fadeOut();
			this.$metadataview.fadeIn();
		},
		
		onClose: function () {			
			console.log('Closing the data view');
		}				
	});
	return DataCatalogView;		
});
