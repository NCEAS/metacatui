/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/mainHeader.html'], 				
	function($, _, Backbone, MainHeaderTemplate) {
	'use strict';
	
	// Build the main header view of the application
	var MainHeaderView = Backbone.View.extend({

		el: '#mainHeader',
		
		template: _.template(MainHeaderTemplate),
		
		initialize: function () {
		},
				
		render: function () {
			console.log('Rendering the main header');
			this.$el.html(this.template());
			
		}	
				
	});
	return MainHeaderView;		
});
