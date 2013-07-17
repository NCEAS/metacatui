/*global define */
'use strict';

define(['jquery',
				'underscore', 
				'backbone',
				'collections/SolrResults',
				'views/SearchResultsView', 
				'text!templates/statCounts.html',
				'text!templates/navbar.html',
				'text!templates/secondaryHeader.html',
				'text!templates/footer.html'], 				
	function($, _, Backbone, SolrResultList, SearchResultsView, 
		statCountsTemplate, mainNavbarTemplate, secondaryHeaderTemplate, mainFooterTemplate) {

	// The Application
	// ---------------

	// Our overall **AppView** is the top-level piece of UI.
	var AppView = Backbone.View.extend({

		// Instead of generating a new element, bind to the existing skeleton of
		// the App already present in the HTML.
		el: '#metacatui-app',
		
		statsTemplate: _.template(statCountsTemplate),
		
		navbarTemplate: _.template(mainNavbarTemplate),

		headerTemplate: _.template(secondaryHeaderTemplate),
		
		footerTemplate: _.template(mainFooterTemplate),

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
			'click #search_btn': 'showResults',
		},

		// At initialization we bind to the relevant events on the `SearchResults`
		// collection, when items are added or changed.
		initialize: function () {
			//this.$baseurl = "http://localhost/knb/metacat/d1/mn/";
			this.$baseurl = window.location.protocol + '//' + window.location.host + ":" + window.location.port + window.location.pathname;
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
		
		// Switch the results view to the search results query
		showResults: function () {
			this.collapseSlides();
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
			this.$resultsview.show();
			this.updateStats();
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
			result.set( {baseurl: this.$baseurl+'d1proxy/view/'} );
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
		}
		
	});
	return AppView;		
});