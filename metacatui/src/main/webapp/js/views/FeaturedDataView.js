/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/featuredData.html'], 				
	function($, _, Backbone, FeaturedDataTemplate) {
	'use strict';
	
	// Build the featured data view of the application
	var FeaturedDataView = Backbone.View.extend({

		el: '#FeaturedData',
		
		template: _.template(FeaturedDataTemplate),
		
		events:
			{
			"click .featuredButton" : "showFeaturedData"
			},
		
		initialize: function () {
		},
				
		render: function () {
			console.log('Rendering the featured data section');
			this.$el.html(this.template());
			
		},
		
		showFeaturedData: function(event) {
			var href = $(event.target).attr("href");
			console.log('Routing to featured data: ' + href);
			uiRouter.navigate(href, {trigger: true});
			
		}
				
	});
	return FeaturedDataView;		
});
