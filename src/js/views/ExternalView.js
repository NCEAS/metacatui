/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';
		
	// Build views of "external" content
	var ExternalView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		containerTemplate: '<article id="external"><div class="container"><div class="row-fluid span10"><div id="DynamicContent" class="text-left"></div></div></div></article>',
				
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
			if(href.lastIndexOf("http", 0) >= 0) {
				// just follow the link
				return true;
			} 
			else if((href.lastIndexOf(".pdf") > 0) || (href.lastIndexOf(".bin") > 0) || (href.lastIndexOf(".exe") > 0) || (href.lastIndexOf(".tar.gz") > 0) || (href.lastIndexOf(".zip") > 0) || (href.lastIndexOf(".tar") > 0)){
				if(href.indexOf(this.url) > 0)
					window.location = MetacatUI.appModel.get("baseUrl") + href;
				else
					window.location = MetacatUI.appModel.get("baseUrl") + this.url + "/" + href;
				
				return false;
			}
			else {
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
				    xhrFields: {
						withCredentials: true
					},
				    success: complete
				});
			} else {
				// simple form
				formData = $(form).serialize();
				$.ajax({
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: formUrl,
					data: formData,
					success: complete
				});
			}
			
			return false;
			
		},
				
		initialize: function () {
		},
				
		render: function () {
			
			// request a smaller header
			MetacatUI.appModel.set('headerType', 'default');
			
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
			
			// handle anchor-only URL (will be within lastUrl) or relative
			if (this.url.indexOf("#") == 0) {
				// this is just an anchor on the same page
				this.anchorId = this.url.substring(this.url.lastIndexOf("#") + 1, this.url.length);
				computedUrl = this.lastUrl + this.url ;
			} else if (this.url.indexOf(".") == 0 || !(this.url.lastIndexOf("/", 0) == 0) ) {
				// handle relative url to the lastUrl base
				var lastSlashIndex = this.lastUrl.lastIndexOf("/");
				var baseUrl = this.lastUrl;
				// For "dir/file.ext"
				if (this.lastUrl.lastIndexOf('.') > lastSlashIndex){
					baseUrl = this.lastUrl.substring(0, lastSlashIndex); 
				}
				// For "dir/" 
				if (baseUrl.lastIndexOf("/") == (baseUrl.length-1)){
					baseUrl = baseUrl.substring(0, baseUrl.length-1);
				}
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
			
			// handle image URLs
			if (this.endsWith(computedUrl, ".png")
					|| this.endsWith(computedUrl, ".jpg")
					|| this.endsWith(computedUrl, ".gif")) {
				window.location = computedUrl;
				return this;
			} 
			
			// load the URL
			var viewRef = this;
			this.$el.html(viewRef.containerTemplate);
			var contentArea = this.$("#DynamicContent");
			contentArea.load(
					computedUrl, 
					function() {
						// make sure to re-bind to the new DOM objects
						viewRef.undelegateEvents();
						viewRef.delegateEvents(viewRef.powerfulEvents);
						//load images in
						viewRef.loadImages(computedUrl);
						// make sure we scroll
						viewRef.postRender();
						// make sure our browser history has it
						MetacatUI.uiRouter.navigate("external/" + computedUrl);
						
					});
			
			
			
			return this;
		},
		
		onClose: function () {			
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
			// Anchor tag may be in the name or id attribute. Sphinx creates anchors with id rather than name
			//First search by name
			var anchorTag = $("a[name='" + anchorId + "']" );
			// If that doesn't exist, then search for it in the id
			if (anchorTag.length == 0){
				anchorTag = $("div[id='" + anchorId + "']" );
			}
			$('html,body').animate({scrollTop: anchorTag.offset().top}, 'slow');
		},
		
		// scroll to top of page
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		},
		
		// Change the src of all images so they'll load
		loadImages: function(computedUrl){	
			var newSrc = null;
			
			this.$el.find('img').each( function(){
				var src = $(this).attr('src');
				var beginningChars = src.substring(0, 4);
				var newSrc = null;
				
				//Only change relative paths
				if ((src.indexOf("/") == 0) || (src.indexOf("http") == 0) || (src.indexOf("www") == 0)){
					return;
				}
				else{
					if (computedUrl.lastIndexOf(".") > computedUrl.lastIndexOf("/")) {
						newSrc = computedUrl.substring(0, computedUrl.lastIndexOf('/')) + '/' + src;
					}
					else{
						newSrc = computedUrl + '/' + src;
					}
					//change the img src
					$(this).attr('src', newSrc)
				}
			});
			
			/*$('link[rel="stylesheet"').each( function(){
				$(this).attr('href', computedUrl + $(this).attr('href'));
			});*/
		}
		
	});
	return ExternalView;		
});
