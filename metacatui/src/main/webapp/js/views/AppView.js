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
		},

		// At initialization we bind to the relevant events on the `SearchResults`
		// collection, when items are added or changed.
		initialize: function () {
			this.$results = this.$('#results');
			this.$pagehead = this.$('#pagehead');
			this.$statcounts = this.$('#statcounts');

			this.listenTo(app.SearchResults, 'add', this.addOne);
			this.listenTo(app.SearchResults, 'reset', this.addAll);
			this.listenTo(app.SearchResults, 'all', this.render);

			// TODO: this should not be done at init, rather when requested
			app.SearchResults.fetch();
		},
		
		// Switch the results view to the most accessed data query
		showMostAccessed: function () {
			this.expandSlides();
			this.$pagehead.html('Most Accessed');
			this.$results.show();
			this.$statcounts.html(this.statsTemplate({
				start: app.SearchResults.header.get("start")+1,
				end: app.SearchResults.header.get("start") + app.SearchResults.length,
				numFound: app.SearchResults.header.get("numFound")
			}));			
		},
		
		// Switch the results view to the most recent data query 
		showRecent: function () {
			this.expandSlides();
			this.$pagehead.html('<p>Most Recent</p>');
			this.$results.show();		
		},
		
		// Switch the results view to the search results query
		showResults: function () {
			this.collapseSlides();
			this.$pagehead.html('<p>Search Results</p>');
			this.$results.show();	
		},
		
		// Re-rendering the App includes refreshing the statistics
		render: function () {
			if (app.SearchResults.length) {
				//this.showMostAccessed();			
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
		
		// Collapse the top slide carousel to display full page
		collapseSlides: function () {
			// TODO: make this a smooth transition
			// TODO: provide padding for the header so the results aren't obscured
			$('#mainPageSlides').hide();
		},
		
		// Expand the top slide carousel to display partial page
		expandSlides: function () {
			// TODO: make this a smooth transition
			$('#mainPageSlides').show();
		}
		
	});	
})(jQuery);
