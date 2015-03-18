/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/tools.html'], 				
	function($, _, Backbone, ToolsTemplate) {
	'use strict';
		
	// Build the tools view of the application
	var ToolsView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(ToolsTemplate),
				
		initialize: function () {
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			this.$el.html(this.template());
			
			return this;
		},
		
		postRender: function() {
			var anchorId = appModel.get('anchorId');
			if (anchorId) {
				this.scrollToAnchor(anchorId);
			} else {
				this.scrollToTop();
			}
		},
		
		// scroll to the anchor given to the render function
		scrollToAnchor: function(anchorId) {
			var anchorTag = $("a[name='" + anchorId + "']" );
			$('html,body').animate({scrollTop: anchorTag.offset().top}, 'slow');
		},
		
		// scroll to top of page
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		}
		
	});
	return ToolsView;		
});
