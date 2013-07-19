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
			'click #featureddata_link': 'showFeatured',
			'click #results_prev': 'prevpage',
			'click #results_next': 'nextpage',
			'click #results_prev_bottom': 'prevpage',
			'click #results_next_bottom': 'nextpage',
			'click #search_btn': 'showResults',
			'click #view_link': 'showMetadata',
		},

		// At initialization we bind to the relevant events on the `SearchResults`
		// collection, when items are added or changed.
		initialize: function () {
			this.$baseurl = window.location.origin;
			//this.$view_service = '/#view/';
			this.$view_service = '/knb/d1/mn/v1/views/metacatui/';
			this.$package_service = this.$baseurl + '/knb/d1/mn/v1/package/';
			this.$searchview = this.$('#Search');
			this.$resultsview = this.$('#results-view');
			this.$results = this.$('#results');
			this.$pagehead = this.$('#pagehead');
			this.$statcounts = this.$('#statcounts');
			this.$isCollapsed = false;
			
			this.listenTo(app.SearchResults, 'add', this.addOne);
			this.listenTo(app.SearchResults, 'reset', this.addAll);
			this.listenTo(app.SearchResults, 'all', this.render);

			app.SearchResults.setfields("id,title,origin,pubDate,dateUploaded,abstract");

			this.render();
		},
		
		// Switch the results view to the most accessed data query
		showMostAccessed: function () {
			//this.collapseSlides();
			this.removeAll();
			this.$pagehead.html('Most Accessed');
			app.SearchResults.setrows(10);
			app.SearchResults.setSort("dateUploaded+asc");
			app.SearchResults.query("formatType:METADATA+-obsoletedBy:*+most");
			this.$("#results_link").removeClass("sidebar-item-selected");
			this.$("#recent_link").removeClass("sidebar-item-selected");
			this.$("#mostaccessed_link").addClass("sidebar-item-selected");
			this.$("#featureddata_link").removeClass("sidebar-item-selected");
			this.$resultsview.show();
			this.updateStats();
		},
		
		// Switch the results view to the most recent data query 
		showRecent: function () {
			//this.collapseSlides();
			this.removeAll();
			this.$pagehead.html('Most Recent');
			app.SearchResults.setrows(10);
			app.SearchResults.setSort("dateUploaded+desc");
			app.SearchResults.query("formatType:METADATA+-obsoletedBy:*");
			this.$("#results_link").removeClass("sidebar-item-selected");
			this.$("#mostaccessed_link").removeClass("sidebar-item-selected");
			this.$("#recent_link").addClass("sidebar-item-selected");
			this.$("#featureddata_link").removeClass("sidebar-item-selected");
			this.$resultsview.show();
			this.updateStats();
		},
		
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
			$('#metadata-view').fadeOut();
			this.$resultsview.show();
			this.updateStats();
			//var content = $('#content');
			//content.children().html(this.$resultsview);
		},
	
		// Switch the results view to the featured data query
		showFeatured: function () {
			this.expandSlides();
			this.removeAll();
			this.$pagehead.html('Featured Data');
			app.SearchResults.setrows(10);
			app.SearchResults.setSort("dateUploaded+desc");
			app.SearchResults.query("formatType:METADATA+-obsoletedBy:*+jones");
			this.$("#recent_link").removeClass("sidebar-item-selected");
			this.$("#mostaccessed_link").removeClass("sidebar-item-selected");
			this.$("#results_link").removeClass("sidebar-item-selected");
			this.$("#featureddata_link").addClass("sidebar-item-selected");
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
		
		// Re-rendering the App includes refreshing the statistics
		render: function () {
			if (app.SearchResults.length) {
				this.$resultsview.show();
				this.updateStats();
			} else {
				this.$resultsview.hide();
			}
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
		
		// Collapse the top slide carousel to display full page
		collapseSlides: function () {
			this.$("#main_body").addClass("main-body-padded");
			$('#mainPageSlides').collapse("hide");
			this.$isCollapsed = true;
		},
		
		// Expand the top slide carousel to display partial page
		expandSlides: function () {
			if (this.$isCollapsed) {
				this.$("#main_body").removeClass("main-body-padded");
				$('#mainPageSlides').collapse("show");
				this.$isCollapsed = false;
			}
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
			$('#metadata-view').fadeIn();
		}
		
	});	
})(jQuery);
