/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// MetacatUI Router
	// ----------------
	var UIRouter = Backbone.Router.extend({
		routes: {
			'*mostaccessed': 'showMostAccessed',
			'*about': 'showAbout'

		},

		showMostAccessed: function (param) {
			//app.TodoFilter = param || '';

			// Trigger a switch of search views
			//app.Todos.trigger('filter');
		},
		
		showAbout: function (param) {
			app.AppView.$mostaccessed.html("<p>About this site... :)</p>");
		}
	});

	app.UIRouter = new UIRouter();
	Backbone.history.start();
})();