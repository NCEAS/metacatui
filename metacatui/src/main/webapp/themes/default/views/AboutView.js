/*global define */
define(['jquery', 'underscore', 'backbone', 'models/AboutModel', 'text!templates/about.html'], 				
	function($, _, Backbone, AboutModel, AboutTemplate) {
	'use strict';
		
	// Build the main header view of the application
	var AboutView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(AboutTemplate),
				
		initialize: function () {
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			appModel.set('navbarPosition', 'fixed');		
			
			console.log('Rendering the about view');
			this.$el.html(this.template());
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the about view');
		},
		
		postRender: function() {
			var anchorId = aboutModel.get('anchorId');
			if (anchorId) {
				this.scrollToAnchor(anchorId);
			} else {
				this.scrollToTop();
			}
		},
		
		// scroll to the anchor given to the render function
		scrollToAnchor: function(anchorId) {
			var anchorTag = $("a[name='" + anchorId + "']" );
			console.log('Scrolling ' + anchorId + ' to offset.top: ' + anchorTag.offset().top);
			$('html,body').animate({scrollTop: anchorTag.offset().top}, 'slow');
		},
		
		// scroll to top of page
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		}
		
	});
	return AboutView;		
});
