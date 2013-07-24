/*global define */

define(['jquery', 'underscore', 'backbone', 'text!templates/navbar.html'], 				
	function($, _, Backbone, NavbarTemplate) {
	'use strict';
	
	// Build the navbar view of the application
	var NavbarView = Backbone.View.extend({

		el: '#Navbar',
		
		template: _.template(NavbarTemplate),
		
		events: {
			'click #search_btn': 'triggerSearch'
		},
		
		initialize: function () {
		},
				
		render: function () {
			console.log('Rendering the navbar');
			
			// listen to the appModel for changes in username
			this.listenTo(appModel, 'change:username', this.render);
			
			// set the username in the template (can be null if not logged in)
			this.$el.html(
					this.template( 
							{username: appModel.get('username')} 
					)
			);
		},
		
		triggerSearch: function() {
			// alert the model that a search should be performed
			appModel.trigger('search');
		}
				
	});
	return NavbarView;		
});
