/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// SearchResult Model
	// ------------------

	// Our basic **SearchResult** model has `authors`, `title`, 'pubdate', 'identifier', 'downloads', 'citations', and `selected` attributes.
	app.SearchResult = Backbone.Model.extend({
		// Default attributes for the SearchResult
		defaults: {
			authors: '',
			title: '',
			pubdate: '',
			identifier: '',
			downloads: 0,
			citations: 0,
			selected: false
		},

		// Toggle the `selected` state of this SearchResult item.
		toggle: function () {
			this.save({
				selected: !this.get('selected')
			});
		}
	});
})();
