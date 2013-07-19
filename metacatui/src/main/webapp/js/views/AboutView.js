/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/about.html'], 				
	function($, _, Backbone, AboutTemplate) {
	'use strict';
	
	// Build the main header view of the application
	var AboutView = Backbone.View.extend({

		el: '#About',
		
		template: _.template(AboutTemplate),
		
		initialize: function () {
		},
				
		render: function () {
			console.log('Rendering the about view');
			this.$el.html(this.template());
			
		}	
				
	});
	return AboutView;		
});
