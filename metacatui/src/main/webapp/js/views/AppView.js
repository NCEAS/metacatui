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
		},

		// At initialization we bind to the relevant events on the `SearchResults`
		// collection, when items are added or changed. Kick things off by
		// loading any preexisting SearchResults that might be saved in *localStorage*.
		initialize: function () {
			//this.allCheckbox = this.$('#toggle-all')[0];
			//this.$input = this.$('#new-todo');
			//this.$footer = this.$('#footer');
			this.$mostaccessed = this.$('#mostaccessed');
			this.$statcounts = this.$('#statcounts');

			this.listenTo(app.SolrResults, 'add', this.addOne);
			this.listenTo(app.SolrResults, 'reset', this.addAll);
			//this.listenTo(app.SolrResults, 'change:completed', this.filterOne);
			//this.listenTo(app.SolrResults, 'filter', this.filterAll);
			this.listenTo(app.SolrResults, 'all', this.render);

			app.SolrResults.fetch();
		},

		// Re-rendering the App just means refreshing the statistics -- the rest
		// of the app doesn't change.
		render: function () {
			if (app.SolrResults.length) {
				this.$mostaccessed.show();
				this.$statcounts.html(this.statsTemplate({
					start: app.SolrResults.header.get("start")+1,
					end: app.SolrResults.header.get("start") + app.SolrResults.length,
					numFound: app.SolrResults.header.get("numFound")
				}));
				
			} else {
				this.$mostaccessed.hide();
			}
		},

		// Add a single SearchResult item to the list by creating a view for it, and
		// appending its element to the `<ul>`.
		addOne: function (result) {
			var view = new app.SearchResultView({ model: result });
			this.$mostaccessed.append(view.render().el);
		},

		// Add all items in the **SearchResults** collection at once.
		addAll: function () {
			//this.$('#todo-list').html('');
			app.SolrResults.each(this.addOne, this);
		}
	});
})(jQuery);
