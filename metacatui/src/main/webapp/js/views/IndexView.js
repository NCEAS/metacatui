/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'views/FeaturesView',
				'views/FeaturedDataView'
				], 				
	function($, _, Backbone, FeaturesView, FeaturedDataView) {
	'use strict';
	
	var app = app || {};
	
	// Our overall **AppView** is the top-level piece of UI.
	var IndexView = Backbone.View.extend({

		el: '#Content',
		
		initialize: function () {

		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering dynamic subviews within the IndexView');
			
			appModel.set('headerType', 'main');
			
			// Add in the Features section
			this.$el.html('<section id="Features" /><section id="FeaturedData" />');			
			var featuresView = new FeaturesView();
			featuresView.setElement($('#Features')).render();
			
			// Add in the FeaturedData section
			this.featuredDataView = new FeaturedDataView();
			this.featuredDataView.setElement(this.$('#FeaturedData')).render();
			
			return this;
		}	
				
	});
	return IndexView;		
});
