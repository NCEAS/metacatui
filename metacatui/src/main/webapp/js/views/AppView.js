/*global Backbone, _, $, ENTER_KEY, */
/*jshint unused:false */
var app = app || {};

(function ($) {
	'use strict';

	// The Application
	// ---------------

	// Our overall **AppView** is the top-level piece of UI.
	app.AppView = Backbone.View.extend({

		// Instead of generating a new element, bind to the existing skeleton of
		// the App already present in the HTML.
		el: '#metacatui-app',
		
		statsTemplate: _.template($('#statcounts-template').html()),

		// Delegated events for creating new items, and clearing completed ones.
		events: {
			//'keypress #new-todo': 'createOnEnter',
			//'click #clear-completed': 'clearCompleted',
			//'click #toggle-all': 'toggleAllComplete'
			'click #mostaccessed_link': 'showMostAccessed',
			'click #results_link': 'showResults',
			'click #recent_link': 'showRecent',
			'click #results_prev': 'prevpage',
			'click #results_next': 'nextpage',
		},

		// At initialization we bind to the relevant events on the `SearchResults`
		// collection, when items are added or changed.
		initialize: function () {
			this.$resultsview = this.$('#results-view');
			this.$results = this.$('#results');
			this.$pagehead = this.$('#pagehead');
			this.$statcounts = this.$('#statcounts');

			this.listenTo(app.SearchResults, 'add', this.addOne);
			this.listenTo(app.SearchResults, 'reset', this.addAll);
			this.listenTo(app.SearchResults, 'all', this.render);

			// TODO: this should not be done at init, rather when requested
			app.SearchResults.fetch({data: {start: 0}});
		},
		
		// Switch the results view to the most accessed data query
		showMostAccessed: function () {
			//this.expandSlides();
			//app.SearchResults = app.SearchResults || new SolrResultList([], { query: "?fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*", rows: 10, start: 0 });
			//app.SearchResults.setrows(10);
			this.$pagehead.html('Most Accessed');
			this.$("#results_link").removeClass("sidebar-item-selected");
			this.$("#recent_link").removeClass("sidebar-item-selected");
			this.$("#mostaccessed_link").addClass("sidebar-item-selected");
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Switch the results view to the most recent data query 
		showRecent: function () {
			//this.expandSlides();
			//app.SearchResults = app.SearchResults || new SolrResultList([], { query: "?fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*", rows: 10, start: 0 });
			//app.SearchResults.setrows(10);
			this.$pagehead.html('Most Recent');
			this.$("#results_link").removeClass("sidebar-item-selected");
			this.$("#mostaccessed_link").removeClass("sidebar-item-selected");
			this.$("#recent_link").addClass("sidebar-item-selected");
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Switch the results view to the search results query
		showResults: function () {
			//this.collapseSlides();
			//app.SearchResults = app.SearchResults || new SolrResultList([], { query: "?fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*", rows: 25, start: 0 });
			//app.SearchResults.setrows(25);
			this.$pagehead.html('Search Results');
			this.$("#recent_link").removeClass("sidebar-item-selected");
			this.$("#mostaccessed_link").removeClass("sidebar-item-selected");
			this.$("#results_link").addClass("sidebar-item-selected");
			this.$resultsview.show();
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
			app.SearchResults.nextpage();
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Previous page of results
		prevpage: function () {
			app.SearchResults.prevpage();
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Re-rendering the App includes refreshing the statistics
		render: function () {
			if (app.SearchResults.length) {
				this.$results.show();
				this.updateStats();
			} else {
				this.$results.hide();
			}
		},
		
		// Add a single SolrResult item to the list by creating a view for it, and
		// appending its element to the `<ul>`.
		addOne: function (result) {
			var view = new app.SearchResultView({ model: result });
			this.$results.append(view.render().el);
		},

		// Add all items in the **SearchResults** collection at once.
		addAll: function () {
			app.SearchResults.each(this.addOne, this);
		},
		
		// Remove a single SolrResult item from the list by removing the view for it, and
		// removing its element from the `<ul>`.
		removeOne: function (result) {
			var view = new app.SearchResultView({ model: result });
			this.$results.append(view.render().el);
		},

		// Remove all items in the **SearchResults** collection at once.
		removeAll: function () {
			app.SearchResults.each(this.removeOne, this);
		},
		
		// Collapse the top slide carousel to display full page
		collapseSlides: function () {
			// TODO: provide padding for the header so the results aren't obscured
			$('#mainPageSlides').collapse("hide");
		},
		
		// Expand the top slide carousel to display partial page
		expandSlides: function () {
			$('#mainPageSlides').collapse("show");
		}
		
	});	
})(jQuery);
