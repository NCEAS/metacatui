/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/altHeader.html', 'text!templates/defaultHeader.html'], 				
	function($, _, Backbone, AltHeaderTemplate, DefaultHeaderTemplate) {
	'use strict';
	
	// Build the main header view of the application
	var AltHeaderView = Backbone.View.extend({

		el: '#HeaderContainer',
		
		template: _.template(AltHeaderTemplate),
		
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
			if (headerType == "alt") {
				console.log('Rendering the alternative header');
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
	return AltHeaderView;		
});
