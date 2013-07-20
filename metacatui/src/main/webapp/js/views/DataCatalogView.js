/*global define */
define(['jquery',
				'underscore', 
				'backbone'
				], 				
	function($, _, Backbone) {
	'use strict';
	
	var app = app || {};
	
	// Our overall **AppView** is the top-level piece of UI.
	var DataCatalogView = Backbone.View.extend({

		el: '#Content',
		
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
			this.$baseurl = window.location.origin;
			//this.$view_service = '/#view/';
			this.$view_service = '/knb/d1/mn/v1/views/metacatui/';
			this.$package_service = this.$baseurl + '/knb/d1/mn/v1/package/';
			this.$searchview = this.$('#Search');
			this.$resultsview = this.$('#results-view');
			this.$metadataview = this.$('#metadata-view');
			this.$results = this.$('#results');
			this.$pagehead = this.$('#pagehead');
			this.$statcounts = this.$('#statcounts');
			this.$isCollapsed = false;
			
//			this.listenTo(app.SearchResults, 'add', this.addOne);
//			this.listenTo(app.SearchResults, 'reset', this.addAll);
//			this.listenTo(app.SearchResults, 'all', this.render);
//
//			app.SearchResults.setfields("id,title,origin,pubDate,dateUploaded,abstract");

			this.render();

		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering dynamic subviews within the DataCatalogView');
						
			this.$el.html('<section id="Catalog"><p>Hi!</p></section>');
			
			//var featuresView = new FeaturesView();
			//featuresView.setElement($('#Features')).render();
			
			//this.featuredDataView = new FeaturedDataView();
			//this.featuredDataView.setElement(this.$('#FeaturedData')).render();
			
			return this;
		}
/*	
		showResults: function () {
			var search = this.$("#search_txt").val();
			this.removeAll();
			this.$pagehead.html('Search Results');
			app.SearchResults.setrows(25);
			app.SearchResults.setSort("title+desc");
			app.SearchResults.query("formatType:METADATA+-obsoletedBy:*+" + search);
			this.$("#recent_link").removeClass("sidebar-item-selected");
			this.$("#mostaccessed_link").removeClass("sidebar-item-selected");
			this.$("#results_link").addClass("sidebar-item-selected");
			this.$("#featureddata_link").removeClass("sidebar-item-selected");
			this.$metadataview.fadeOut();
			this.$resultsview.fadeIn();
			this.updateStats();
		},
	
		updateStats: function () {
			if (app.SearchResults.header != null) {
				this.$statcounts.html(this.statsTemplate({
					start: app.SearchResults.header.get("start")+1,
					end: app.SearchResults.header.get("start") + app.SearchResults.length,
					numFound: app.SearchResults.header.get("numFound")
				}));
			}
		},
		
		// Next page of results
		nextpage: function () {
			this.removeAll();
			app.SearchResults.nextpage();
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Previous page of results
		prevpage: function () {
			this.removeAll();
			app.SearchResults.prevpage();
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Add a single SolrResult item to the list by creating a view for it, and
		// appending its element to the `<ul>`.
		addOne: function (result) {
			result.set( {view_service: this.$view_service, package_service: this.$package_service} );
			var view = new app.SearchResultView({ model: result });
			this.$results.append(view.render().el);
		},

		// Add all items in the **SearchResults** collection at once.
		addAll: function () {
			app.SearchResults.each(this.addOne, this);
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
			//var endpoint = '/knb/d1/mn/v1/views/metacatui/' + pid + ' #Metadata';
			var endpoint = this.$view_service + pid + ' #Metadata';
			$('#metadata-view').load(endpoint);
			
			// Hide the existing results listing, and show the metadata
			this.$resultsview.fadeOut();
			this.$metadataview.fadeIn();
		}
*/
	});
	return DataCatalogView;		
});
