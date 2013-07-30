/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';
		
	// Build views of "external" content
	var ExternalView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
				
		lastUrl: null,
		
		url: null,
		
		anchorId: null,
				
		events: {
			// catch all link clicks so we navigate within the UI
			"click a"	:	"handleAnchor"
		},
		
		handleAnchor: function(event) {
			var href = $(event.target).attr("href");
			if (href.lastIndexOf("http", 0) >= 0) {
				// just follow the link
				return true;
			} else {
				console.log('Loading href: ' + href)
				this.url = href;
				this.render();
			}
			
			return false;
			
		},
				
		initialize: function () {
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			appModel.set('navbarPosition', 'fixed');
			
			// track the lastUrl if there isn't one
			if (!this.lastUrl) {
				this.lastUrl = this.url;
			}
			
			// reset the anchorId
			this.anchorId = null;

			// figure out the URL to load
			var computedUrl = this.url;
			
			// handle anchor-only URL (will be within lastUrl)
			if (this.url.indexOf("#") == 0) {
				// this is just an anchor on the same page
				this.anchorId = this.url.substring(this.url.lastIndexOf("#") + 1, this.url.length);
				computedUrl = this.lastUrl + this.url ;
			}
			
			// handle relative url to the lastUrl base
			if (this.url.indexOf(".") == 0 || !(this.url.lastIndexOf("/", 0) == 0) ) {
				var baseUrl = this.lastUrl.substring(0, this.lastUrl.lastIndexOf("/"));
				computedUrl = baseUrl + "/" + this.url ;
			}
			
			// now, is there an anchor somewhere in our computed url to scroll to?
			if (computedUrl.indexOf("#") >= 0) {
				// extract the anchor
				this.anchorId = computedUrl.substring(computedUrl.lastIndexOf("#") + 1, computedUrl.length);
				// set the lastUrl without the anchor
				this.lastUrl = computedUrl.substring(0, computedUrl.indexOf("#"));
			} else {
				// just set the lastUrl to this new one
				this.lastUrl = computedUrl;
			}
			
			
			// load the URL
			console.log('Loading the external URL: ' + computedUrl);
			var viewRef = this;
			this.$el.load(
					computedUrl, 
					function() {
						// make sure to re-bind to the new DOM objects
						viewRef.undelegateEvents();
						viewRef.delegateEvents();
						// make sure we scroll
						viewRef.postRender();
						// make sure our browser history has it
						uiRouter.navigate("external/" + computedUrl);
						
					});
			
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the external view');
		},
		
		postRender: function() {
			if (this.anchorId) {
				this.scrollToAnchor(this.anchorId);
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
	return ExternalView;		
});
