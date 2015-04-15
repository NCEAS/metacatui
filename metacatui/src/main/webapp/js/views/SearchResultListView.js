/*global define */
define(['jquery', 'underscore', 'backbone', "views/SearchResultView"], 				
	function($, _, Backbone, SearchResultView) {
	
	'use strict';

	/* =========================
	 * Search Result List View
	 * A view for the list of search results - used in the DataCatalogView and user profile
	 * =========================
	 */ 	
	var SearchResultListView = Backbone.View.extend({
		
		el: "#results",
			
		events: {
			
		},
		
		render: function(){
			
		}
	});
	
	return SearchResultListView;
});