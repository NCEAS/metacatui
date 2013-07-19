/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'views/NavbarView',
				'views/MainHeaderView',
				'views/FeaturesView',
				'views/FeaturedDataView',
				'views/FooterView'
				], 				
	function($, _, Backbone, NavbarView, MainHeaderView, FeaturesView, FeaturedDataView, FooterView) {
	'use strict';
	
	// Our overall **AppView** is the top-level piece of UI.
	var AppView = Backbone.View.extend({

		// Instead of generating a new element, bind to the existing skeleton of
		// the App already present in the HTML.
		el: '#metacatui-app',
		
		initialize: function () {
			console.log('Rendering fixed subviews within the AppView');
			this.navbarView = new NavbarView();
			this.navbarView.setElement(this.$('#Navbar')).render();

			this.footerView = new FooterView();
			this.footerView.setElement(this.$('#Footer')).render();

		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering dynamic subviews within the AppView');
			
			this.mainHeaderView = new MainHeaderView();
			this.mainHeaderView.setElement(this.$('#mainHeader')).render();
			
			this.featuresView = new FeaturesView();
			this.featuresView.setElement(this.$('#Features')).render();
			
			//this.featuredDataView = new FeaturedDataView();
			//this.featuredDataView.setElement(this.$('#FeaturedData')).render();
			
			return this;
		}		
				
	});
	return AppView;		
});
