/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'views/NavbarView',
				'views/MainHeaderView',
				'views/FooterView'
				], 				
	function($, _, Backbone, NavbarView, MainHeaderView, FooterView) {
	'use strict';
	
	var app = app || {};
	
	// Our overall **AppView** is the top-level piece of UI.
	var AppView = Backbone.View.extend({

		// Instead of generating a new element, bind to the existing skeleton of
		// the App already present in the HTML.
		el: '#metacatui-app',
		
		initialize: function () {
			console.log('Rendering fixed subviews within the AppView');
			app.navbarView = new NavbarView();
			app.navbarView.setElement($('#Navbar')).render();

			app.mainHeaderView = new MainHeaderView();
			app.mainHeaderView.setElement($('#HeaderContainer')).render();

			app.footerView = new FooterView();
			app.footerView.setElement($('#Footer')).render();

		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering dynamic subviews within the AppView');
									
			return this;
		},
		
		// Our view switcher for the whole app
		showView: function(view) {
			view.render();
		}
				
	});
	return AppView;		
});
