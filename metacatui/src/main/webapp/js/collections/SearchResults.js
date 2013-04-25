/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// SearchResults Collection
	// ------------------------

	// The collection of SearchResults
	var SearchResultList = Backbone.Collection.extend({
		// Reference to this collection's model.
		model: app.SearchResult,

		  url: "/metacatui/d1proxy",

		// Filter down the list of all result items that are selected.
		selected: function () {
			return this.filter(function (result) {
				return result.get('selected');
			});
		},

		// We keep the results in sequential order, despite being saved by unordered
		// GUID in the database. This generates the next order number for new items.
		nextOrder: function () {
			if (!this.length) {
				return 1;
			}
			return this.last().get('order') + 1;
		},

		// Results are sorted by their original insertion order.
		comparator: function (result) {
			return result.get('order');
		}
	});

	// Create our global collection of **SearchResults**.
	app.SearchResults = new SearchResultList();
})();
