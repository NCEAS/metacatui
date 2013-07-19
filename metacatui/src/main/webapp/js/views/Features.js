/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/features.html'], 				
	function($, _, Backbone, FeaturesTemplate) {
	'use strict';
	
	// Build the features view of the application
	var FeaturesView = Backbone.View.extend({

		el: '#Features',
		
		template: _.template(FeaturesTemplate),
		
		initialize: function () {
		},
				
		render: function () {
			console.log('Rendering the features section');
			this.$el.html(this.template());
			
		}	
				
	});
	return FeaturesView;		
});
