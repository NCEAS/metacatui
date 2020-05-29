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
			this.listenTo(MetacatUI.appModel, "change:headerType", this.render);
		},
		
		render: function () {
			
			// figure out which header to render
			var headerType = MetacatUI.appModel.get('headerType');
			
			// then render it
			this.$el.hide();
			if (headerType == "alt") {
				this.$el.html(this.template());
			} else {
				this.$el.html(this.defaultTemplate());
			}
			this.$el.fadeIn('slow');

			// enable the Carousel
			var carouselOptions = {
				interval: 10000,
				pause: 'hover'
			}
			$('.carousel').carousel(carouselOptions);

      //Check if the temporary message is in this view
      if( MetacatUI.appModel.get("temporaryMessageContainer") == "#HeaderContainer"){
        if( typeof MetacatUI.appView.showTemporaryMessage == "function") {
           MetacatUI.appView.showTemporaryMessage();
         }
      }

			return this;
		}
		
				
	});
	return AltHeaderView;		
});
