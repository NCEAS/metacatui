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
			this.$el.html(this.template());
		},
		
		triggerSearch: function() {
			// alert the model that a search should be performed
			appModel.trigger('search');
		}
				
	});
	return NavbarView;		
});
