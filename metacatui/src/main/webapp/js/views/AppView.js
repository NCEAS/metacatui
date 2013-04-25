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

			this.listenTo(app.SearchResults, 'add', this.addOne);
			this.listenTo(app.SearchResults, 'reset', this.addAll);
			//this.listenTo(app.SearchResults, 'change:completed', this.filterOne);
			//this.listenTo(app.SearchResults, 'filter', this.filterAll);
			this.listenTo(app.SearchResults, 'all', this.render);

			app.SearchResults.fetch();
		},

		// Re-rendering the App just means refreshing the statistics -- the rest
		// of the app doesn't change.
		render: function () {

			if (app.SearchResults.length) {
				this.$mostaccessed.show();
			} else {
				this.$mostaccessed.show();
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
			app.SearchResults.each(this.addOne, this);
		}
	});
})(jQuery);
