/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/footer.html'], 				
	function($, _, Backbone, FooterTemplate) {
	'use strict';
	
	// Build the Footer view of the application
	var FooterView = Backbone.View.extend({

		el: '#Footer',
		
		template: _.template(FooterTemplate),
		
		initialize: function () {
		},
				
		render: function () {
			console.log('Rendering the footer');
			this.$el.html(this.template());
			
		}	
				
	});
	return FooterView;		
});
