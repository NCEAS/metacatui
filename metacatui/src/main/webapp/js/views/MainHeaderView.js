/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/mainHeader.html', 'text!templates/defaultHeader.html'], 				
	function($, _, Backbone, MainHeaderTemplate, DefaultHeaderTemplate) {
	'use strict';
	
	// Build the main header view of the application
	var MainHeaderView = Backbone.View.extend({

		el: '#HeaderContainer',
		
		template: _.template(MainHeaderTemplate),
		
		defaultTemplate: _.template(DefaultHeaderTemplate),
		
		initialize: function () {
			// listen for changes in the [header] app model
			this.listenTo(appModel, "change:headerType", this.render);
		},
		
		render: function () {
			
			// figure out which header to render
			var headerType = appModel.get('headerType');
			
			// then render it
			this.$el.hide();
			if (headerType == "main") {
				console.log('Rendering the main header');
				this.$el.html(this.template());
			} else {
				console.log('Rendering the default header');
				this.$el.html(this.defaultTemplate());
			}
			this.$el.fadeIn('slow');

			// enable the Carousel
			var carouselOptions = {
				interval: 10000,
				pause: 'hover'
			}
			$('.carousel').carousel(carouselOptions);
			
			return this;
		}
		
				
	});
	return MainHeaderView;		
});
