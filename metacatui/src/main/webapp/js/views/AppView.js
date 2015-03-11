/*global define */
define(['jquery',
				'underscore', 
				'jquerysidr',
				'backbone',
				'jws',
				'views/NavbarView',
				'views/AltHeaderView',
				'views/FooterView',
				'text!templates/appHead.html',
				'text!templates/app.html'
				], 				
	function($, _, jQuerySidr, Backbone, JWS, NavbarView, AltHeaderView, FooterView, AppHeadTemplate, AppTemplate) {
	'use strict';
	
	var app = app || {};
	
	var theme = document.getElementById("loader").getAttribute("data-theme");
		
	// Our overall **AppView** is the top-level piece of UI.
	var AppView = Backbone.View.extend({

		// Instead of generating a new element, bind to the existing skeleton of
		// the App already present in the HTML.
		el: '#metacatui-app',
		
		template: _.template(AppTemplate),
		
		appHeadTemplate: _.template(AppHeadTemplate),
				
		initialize: function () {
			//Change the document title when the app changes the appModel title at any time
			this.listenTo(appModel, "change:title", this.changeTitle);

			// set up the head - make sure to prepend, otherwise the CSS may be out of order!			
			$("head").prepend(this.appHeadTemplate({theme: theme, themeTitle: themeTitle}));
									
			// set up the body
			this.$el.append(this.template());
			
			// check the user status whenever we render the main application
			this.checkUserStatus();
			
			// render the nav
			app.navbarView = new NavbarView();
			app.navbarView.setElement($('#Navbar')).render();

			app.altHeaderView = new AltHeaderView();
			app.altHeaderView.setElement($('#HeaderContainer')).render();

			app.footerView = new FooterView();
			app.footerView.setElement($('#Footer')).render();
			
			// listen for image loading - bind only once in init method
			var imageEl = $('#bg_image');
			if ($(imageEl).length > 0) {
				// only show the image when it is completely done loading
				$(imageEl).load(function() {
					console.log("Showing IMAGE AFTER LOAD()");
					$(imageEl).fadeIn('slow');
				});
			}

		},
		
		//Changes the web document's title
		changeTitle: function(){
			document.title = appModel.get("title");
		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {									
			return this;
		},
		
		// call Metacat to validate the session and tell us the user's name
		checkUserStatus: function() {
			
			// look up the URL
			var metacatUrl = appModel.get('metacatServiceUrl');
			
			if (metacatUrl) {
				// ajax call to validate the session/get the user info
				$.ajax({
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: metacatUrl,
					data: { action: "validatesession" },
					success: function(data, textStatus, xhr) {
						
						// the Metacat (XML) response should have a fullName element
						var fullName = $(data).find("fullName").text();
						var username = $(data).find("name").text();
						// set in the model
						appModel.set('fullName', fullName);
						appModel.set('username', username);
						
					}
				});
			} else {
				// use the token method for checking authentication
				this.checkToken();
			}
			
			return false;
		},
		
		logout: function() {
			
			var portalUrl = appModel.get('baseUrl') + "/portal/identity?action=logout";
			var target = Backbone.history.location.href;
			// DO NOT include the route otherwise we have an infinite redirect
			target  = target.split("#")[0];
			
			// make sure to include the target
			portalUrl += "&target=" + target;
			
			// do it!
			window.location = portalUrl;
			
			return;
			
		},
		
		checkToken: function() {
			var tokenUrl = appModel.get('tokenUrl');
			var viewRef = this;
			
			if(!tokenUrl) return false;
			
			// ajax call to get token
			$.ajax({
				type: "GET",
				xhrFields: {
					withCredentials: true
				},
				url: tokenUrl,
				data: {},
				success: function(data, textStatus, xhr) {
					
					// the response should have the token
					var payload = viewRef.parseToken(data);
					var username = payload.userId;
					var fullName = payload.fullName;

					// set in the model
					appModel.set('fullName', fullName);
					appModel.set('username', username);
					
				}
			});
		},
		
		parseToken: function(token) {
			
			var jws = new KJUR.jws.JWS();
			var result = 0;
			try {
				result = jws.parseJWS(token);
			} catch (ex) {
				console.log("JWT warning: " + ex);
			    result = 0;
			}
			
			var payload = $.parseJSON(jws.parsedJWS.payloadS);
			return payload;
			
		},
		
		// the currently rendered view
		currentView: null,
		
		// Our view switcher for the whole app
		showView: function(view) {
			
			//reference to appView
			var thisAppViewRef = this;
	
			// Change the background image if there is one
			var imageEl = $('#bg_image');
			if ($(imageEl).length > 0) {
				
				var imgCnt = $(imageEl).attr('data-image-count');
				
				// hide the existing image
				$(imageEl).fadeOut('fast', function() {
					
					//Randomly choose the next background image
					var bgNum = Math.ceil(Math.random() * imgCnt);
					//If the element is an img, change the src attribute
					if ($(imageEl).prop('tagName') == 'IMG'){
						$(imageEl).attr('src', './js/themes/' + theme + '/img/backgrounds/bg' + bgNum + '.jpg');
						// note the load() callback will show this image for us
					}
					else { 
						//Otherwise, change the background image style property
						$(imageEl).css('background-image', 'url(\'./js/themes/' + theme + '/img/backgrounds/bg' + bgNum + '.jpg\')');
						$(imageEl).fadeIn('slow');
					}
					
				});
			}
		
			
			// close the current view
			if (this.currentView){
				//TODO: implement Backbone.View.protoype.close as:
				//this.currentView.remove();
				//this.currentView.unbind();
				// OR: each view subclass can implement an onClose() method

				// need reference to the old/current view for the callback method
				var oldView = this.currentView;
				
				this.currentView.$el.fadeOut('slow', function() {
					// clean up old view
					if (oldView.onClose){
						oldView.onClose();
					}	
					
					// render the new view
					view.$el.hide();
					view.render();
					view.$el.fadeIn('slow', function() {
						
						// after fade in, do postRender()
						if (view.postRender) {
							view.postRender();
						} else {
							// force scroll to top if no custom scrolling is implemented
							thisAppViewRef.scrollToTop();
						}
					});
				});
			} else {
				
				// just show the view without transition
				view.render();
				
			}
			
			// track the current view
			this.currentView = view;
		},
		
		// scroll to top of page
		scrollToTop: function() {
			$("body,html").stop(true,true) //stop first for it to work in FF
						  .animate({ scrollTop: 0 }, "slow");
			return false;
		},
		
		scrollTo: function(pageElement){
			//Find the header height if it is a fixed element
			var headerOffset = (this.$("#Header").css("position") == "fixed") ? this.$("#Header").outerHeight() : 0;
			
			$("body,html").stop(true,true) //stop first for it to work in FF
						  .animate({ scrollTop: $(pageElement).offset().top - 40 - headerOffset}, 1000);
			return false;
		}
				
	});
	return AppView;		
});
