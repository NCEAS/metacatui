/*global define */
define(['jquery',
				'underscore', 
				'backbone',
				'views/NavbarView',
				'views/AltHeaderView',
				'views/FooterView',
				'text!templates/appHead.html',
				'text!templates/app.html'
				], 				
	function($, _, Backbone, NavbarView, AltHeaderView, FooterView, AppHeadTemplate, AppTemplate) {
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
			console.log('Rendering fixed subviews within the AppView');
			
			// set up the head - make sure to prepend, otherwise the CSS may be out of order!
			console.log("Setting up app head");
			$("head").prepend(this.appHeadTemplate({theme: theme}));
			
			// set up the body
			console.log("Setting up app body");
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
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {
			console.log('Rendering dynamic subviews within the AppView');
									
			return this;
		},
		
		// call Metacat to validate the session and tell us the user's name
		checkUserStatus: function() {
			
			// look up the URL
			var metacatUrl = appModel.get('metacatServiceUrl');
			
			console.log('Checking user status in AppView');

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
					console.log('fullName: ' + fullName);
					console.log('username: ' + username);
					// set in the model
					appModel.set('fullName', fullName);
					appModel.set('username', username);
					
				}
			});
			
			return false;
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
					console.log('complete with fadeout');
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
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		}
				
	});
	return AppView;		
});
