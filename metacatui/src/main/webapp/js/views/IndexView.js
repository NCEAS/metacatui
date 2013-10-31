/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'bootstrap',
				'views/MainContentView',
				'views/FeaturedDataView'
				], 				
	function($, _, Backbone, Bootstrap, MainContentView, FeaturedDataView) {
	'use strict';
		
	// Our overall **AppView** is the top-level piece of UI.
	var IndexView = Backbone.View.extend({

		el: '#Content',
		
		featuredDataView: null,
		
		initialize: function () {
			this.featuredDataView = new FeaturedDataView();

		},
		
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering dynamic subviews within the IndexView');
			
			appModel.set('headerType', 'alt');
			
			// Add in the main content section
			console.log("el: " + this.el);
						
			this.$el.html('<section id="mainContent" /><section id="FeaturedData" />');			
			var maincontentView = new MainContentView();
			maincontentView.setElement($('#mainContent')).render();
			if ( maincontentView.postRender ) {
				maincontentView.postRender();
			}
			
			// Add in the FeaturedData section
			this.featuredDataView.setElement(this.$('#FeaturedData')).render();
			if ( this.featuredDataView.postRender ) {
				this.featuredDataView.postRender();
			}
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the index view');
			if (this.featuredDataView.onClose) {
				this.featuredDataView.onClose();
			}
		}	
				
	});
	return IndexView;		
});
