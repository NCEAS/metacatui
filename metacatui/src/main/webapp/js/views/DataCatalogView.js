/*global define */
define(['jquery',
				'underscore', 
				'backbone'
				], 				
	function($, _, Backbone) {
	'use strict';
	
	var app = app || {};
	
	// Our overall **AppView** is the top-level piece of UI.
	var DataCatalogView = Backbone.View.extend({

		el: '#Content',
		
		initialize: function () {

		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering dynamic subviews within the DataCatalogView');
						
			this.$el.html('<section id="Catalog"><p>Hi!</p></section>');
			
			//var featuresView = new FeaturesView();
			//featuresView.setElement($('#Features')).render();
			
			//this.featuredDataView = new FeaturedDataView();
			//this.featuredDataView.setElement(this.$('#FeaturedData')).render();
			
			return this;
		}	
				
	});
	return DataCatalogView;		
});
