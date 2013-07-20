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
		
		// the currently rendered view
		currentView: null,
		
		// Our view switcher for the whole app
		showView: function(view) {
			// close the current view
			if (this.currentView){
				//TODO: implement Backbone.View.protoype.close as:
				//this.currentView.remove();
				//this.currentView.unbind();
				// OR: each view subclass can implement an onClose() method

				// need reference to the old/current view for the callback method
				var oldView = this.currentView;
				this.currentView.$el.fadeOut('slow', function() {
					console.log('complete with fadeout');
					// clean up old view
					if (oldView.onClose){
						oldView.onClose();
					}
					// render the new view
					view.$el.hide();
					view.render();
					view.$el.fadeIn('slow');
				});
			} else {
				// just show the view without transition
				view.render();
			}
			
			// track the current view
			this.currentView = view;
		}
				
	});
	return AppView;		
});
