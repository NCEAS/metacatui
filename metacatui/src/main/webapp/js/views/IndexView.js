/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'bootstrap',
				'views/FeaturesView',
				'views/FeaturedDataView'
				], 				
	function($, _, Backbone, Bootstrap, FeaturesView, FeaturedDataView) {
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
			appModel.set('navbarPosition', 'absolute');		
			
			// enable the Catousel
			$('.carousel').carousel();
			
			// Add in the Features section
			this.$el.html('<section id="Features" /><section id="FeaturedData" />');			
			var featuresView = new FeaturesView();
			featuresView.setElement($('#Features')).render();
			if ( featuresView.postRender ) {
				featuresView.postRender();
			}
			
			// Add in the FeaturedData section
			var featuredDataView = new FeaturedDataView();
			featuredDataView.setElement(this.$('#FeaturedData')).render();
			if ( featuredDataView.postRender ) {
				featuredDataView.postRender();
			}
			
			return this;
		}	
				
	});
	return IndexView;		
});
