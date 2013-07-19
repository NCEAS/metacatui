/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'views/NavbarView',
				'views/MainHeaderView',
				'views/FeaturesView'
				//'views/featuredData',
				//'views/footer'
				], 				
	function($, _, Backbone, NavbarView, MainHeaderView, FeaturesView) {
	'use strict';
	
	// Our overall **AppView** is the top-level piece of UI.
	var AppView = Backbone.View.extend({

		// Instead of generating a new element, bind to the existing skeleton of
		// the App already present in the HTML.
		el: '#metacatui-app',
		
		initialize: function () {

		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering subviews within the AppView');
			this.navbarView = new NavbarView();
			this.navbarView.setElement(this.$('#Navbar')).render();
			
			this.mainHeaderView = new MainHeaderView();
			this.mainHeaderView.setElement(this.$('#mainHeader')).render();
			
			this.featuresView = new FeaturesView();
			this.featuresView.setElement(this.$('#Features')).render();
			return this;
		}	
				
	});
	return AppView;		
});
