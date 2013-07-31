/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';
		
	// Build views of "external" content
	var ExternalView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		containerTemplate: '<article><div class="container"><div class="row-fluid"><div id="DynamicContent" class="text-left"></div></div></div></article>',
				
		lastUrl: null,
		
		url: null,
		
		anchorId: null,
				
		events: null,
		
		powerfulEvents: {
			"click a"						:	"handleAnchor",
			"click input[type='submit']"	:	"submitForm"

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
		
		// of course: http://stackoverflow.com/questions/280634/endswith-in-javascript
		endsWith: function (str, suffix) {
		    return str.indexOf(suffix, str.length - suffix.length) !== -1;
		},
		
		submitForm: function(event) {
			
			// which form?
			var form = $(event.target).parents("form");
			
			// get the form url
			var formUrl = $(form).attr("action");
			
			//enctype="multipart/form-data"
			var formType = $(form).attr("enctype");

			// ajax call to submit the given form and then render the results in the content area
			var viewRef = this;
			var complete = 
			    function(data, textStatus, jqXHR) {
					viewRef.$el.hide();
					
					viewRef.$el.html(viewRef.containerTemplate);
					var contentArea = viewRef.$("#DynamicContent");
					contentArea.html(data);
					
					viewRef.$el.fadeIn('slow');
			};
			
			// determine form type
			var formData = null;
			
			// use the correct form
			if (formType == "multipart/form-data") {
				// get the form data for multipart compatibility
				formData = new FormData($(form)[0]);
				$.ajax({
				    url: formUrl,
				    data: formData,
				    cache: false,
				    contentType: false,
				    processData: false,
				    type: 'POST',
				    success: complete
				});
			} else {
				// simple form
				formData = $(form).serialize();
				$.post(
					formUrl,
					formData,
					complete
				);
			}
			
			return false;
			
		},
				
		initialize: function () {
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			appModel.set('navbarPosition', 'fixed');
			
			// catch all link clicks so we navigate within the UI - careful when calling this!
			this.undelegateEvents();
			this.delegateEvents(this.powerfulEvents);
			
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
			
			// handle images
			if (this.endsWith(computedUrl, ".png")
					|| this.endsWith(computedUrl, ".jpg")
					|| this.endsWith(computedUrl, ".gif")) {
				window.location = computedUrl;
				return this;
			} 
			
			// load the URL
			console.log('Loading the external URL: ' + computedUrl);
			var viewRef = this;
			this.$el.html(viewRef.containerTemplate);
			var contentArea = this.$("#DynamicContent");
			contentArea.load(
					computedUrl, 
					function() {
						// make sure to re-bind to the new DOM objects
						viewRef.undelegateEvents();
						viewRef.delegateEvents(viewRef.powerfulEvents);
						// make sure we scroll
						viewRef.postRender();
						// make sure our browser history has it
						uiRouter.navigate("external/" + computedUrl);
						
					});
			
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the external view');
			// stop listening to the click events
			this.undelegateEvents();
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
