/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// SolrResult Model
	// ------------------
	app.SolrResult = Backbone.Model.extend({
		// This model contains all of the attributes found in the SOLR 'docs' field inside of the SOLR response element
		defaults: {
			origin: '',
			title: '',
			pubDate: '',
			id: '',
			downloads: 0,
			citations: 0,
			selected: false
		},
		
		// Toggle the `selected` state of the result
		toggle: function () {
			this.selected = !this.get('selected');
		}
		
	});
})();
