﻿/*global define */
define(['jquery',
		'underscore',
		'backbone',
		'views/AltHeaderView',
		'views/NavbarView',
		'views/FooterView',
		'text!templates/alert.html',
		'text!templates/appHead.html',
		'text!templates/app.html',
		'text!templates/loading.html'
	    ],
	function($, _, Backbone, AltHeaderView, NavbarView, FooterView, AlertTemplate, AppHeadTemplate, AppTemplate, LoadingTemplate) {
	'use strict';

	var app = app || {};

	var theme = document.getElementById("loader").getAttribute("data-theme");

	// Our overall **AppView** is the top-level piece of UI.
	var AppView = Backbone.View.extend({

		// Instead of generating a new element, bind to the existing skeleton of
		// the App already present in the HTML.
		el: '#metacatui-app',

		//Templates
		template: _.template(AppTemplate),
		alertTemplate: _.template(AlertTemplate),
		appHeadTemplate: _.template(AppHeadTemplate),
		loadingTemplate: _.template(LoadingTemplate),

		events: {
											 "click" : "closePopovers",
	 		              'click .btn.direct-search' : 'routeToMetadata',
		 	          'keypress input.direct-search' : 'routeToMetadataOnEnter',
		 	                 "click .toggle-slide"   : "toggleSlide",
				 		 	      "click input.copy" : "higlightInput",
					 		 	  "focus input.copy" : "higlightInput",
					 		   "click textarea.copy" : "higlightInput",
					 		   "focus textarea.copy" : "higlightInput",
					 		 	  "click .open-chat" : "openChatWithMessage",
					 		 "click .login.redirect" : "sendToLogin",
					 	   "focus .jump-width-input" : "widenInput",
					 	"focusout .jump-width-input" : "narrowInput"
		},

		initialize: function () {

			if(window.location.search.indexOf("error=Unable%20to%20authenticate%20LDAP%20user") > -1){
				window.location = window.location.origin + window.location.pathname + "#signinldaperror";
			}

			//Is there a logged-in user?
			MetacatUI.appUserModel.checkStatus();

			// set up the head - make sure to prepend, otherwise the CSS may be out of order!
			$("head").prepend(this.appHeadTemplate({
				theme: MetacatUI.theme,
				themeTitle: MetacatUI.themeTitle,
				googleAnalyticsKey: MetacatUI.appModel.get("googleAnalyticsKey")
				}));

			// set up the body
			this.$el.append(this.template());

			// render the nav
			MetacatUI.navbarView = new NavbarView();
			MetacatUI.navbarView.setElement($('#Navbar')).render();

			MetacatUI.altHeaderView = new AltHeaderView();
			MetacatUI.altHeaderView.setElement($('#HeaderContainer')).render();

			MetacatUI.footerView = new FooterView();
			MetacatUI.footerView.setElement($('#Footer')).render();

			//Load the Slaask chat widget if it is enabled in this theme
			if(MetacatUI.appModel.get("slaaskKey") && window._slaask)
		    	_slaask.init(MetacatUI.appModel.get("slaaskKey"));

			//Change the document title when the app changes the MetacatUI.appModel title at any time
			this.listenTo(MetacatUI.appModel, "change:title", this.changeTitle);

			this.listenForActivity();

			this.initializeWidgets();
		},

		//Changes the web document's title
		changeTitle: function(){
			document.title = MetacatUI.appModel.get("title");
		},

		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering
		// and event handling to sub views
		render: function () {

			return this;
		},

		// the currently rendered view
		currentView: null,

		// Our view switcher for the whole app
		showView: function(view, viewOptions) {

			//reference to appView
			var thisAppViewRef = this;

			// Change the background image if there is one
			MetacatUI.navbarView.changeBackground();


			// close the current view
			if (this.currentView){

				//Check if the view will need to cancel the close
				if((typeof this.currentView.confirmClose == "function") && (this.currentView != view)){
					if(!this.currentView.confirmClose()){
						MetacatUI.uiRouter.undoLastRoute();
						return;
					}
				}

				// need reference to the old/current view for the callback method
				var oldView = this.currentView;

				this.currentView.$el.fadeOut('slow', function() {
					// clean up old view
					if (oldView.onClose)
						oldView.onClose();

					// render the new view
					view.$el.hide();
					view.render(viewOptions);
					view.$el.fadeIn('slow', function() {

						// after fade in, do postRender()
						if (view.postRender)
							view.postRender();
						// force scroll to top if no custom scrolling is implemented
						else
							thisAppViewRef.scrollToTop();
					});
				});
			} else {

				// just show the view without transition
				view.render(viewOptions);

				if (view.postRender)
					view.postRender();
				// force scroll to top if no custom scrolling is implemented
				else
					thisAppViewRef.scrollToTop();
			}


			// track the current view
			this.currentView = view;
			this.sendAnalytics();

			this.trigger("appRenderComplete");
		},

		sendAnalytics: function(){
			if(!MetacatUI.appModel.get("googleAnalyticsKey") || (typeof ga === "undefined")) return;

			var page = window.location.hash || "/";
			page = page.replace("#", ""); //remove the leading pound sign

			ga('send', 'pageview', {'page':  page});
		},

		routeToMetadata: function(e){
			e.preventDefault();

			//Get the value from the input element
			var form = $(e.target).attr("form") || null,
				val = this.$("#" + form).find("input[type=text]").val();

			//Remove the text from the input
			this.$("#" + form).find("input[type=text]").val("");

			if(!val) return false;

			MetacatUI.uiRouter.navigate('view/'+ val, {trigger: true});
		},

		routeToMetadataOnEnter: function(e){
			//If the user pressed a key inside a text input, we only want to proceed if it was the Enter key
			if((e.type == "keypress") && (e.keycode != 13))
				return;
			else
				this.routeToMetadata(e);
		},

		sendToLogin: function(e){
			if(e) e.preventDefault();

			var url = $(e.target).attr("href");
			url = url.substring(0, url.indexOf("target=")+7);
			url += window.location.href;

			window.location.href = url;
		},

		resetSearch: function(){
			// Clear the search and map model to start a fresh search
			MetacatUI.appSearchModel.clear();
			MetacatUI.appSearchModel.set(MetacatUI.appSearchModel.defaults);
			MetacatUI.mapModel.clear();
			MetacatUI.mapModel.set(MetacatUI.mapModel.defaults);

			//Clear the search history
			MetacatUI.appModel.set("searchHistory", new Array());

			MetacatUI.uiRouter.navigate('data', {trigger: true});
		},

		closePopovers: function(e){
			if(this.currentView && this.currentView.closePopovers)
				this.currentView.closePopovers(e);
		},

		toggleSlide: function(e){
			if(e) e.preventDefault();
			else return false;

			var clickedOn   = $(e.target),
				toggleElId  = clickedOn.attr("data-slide-el") || clickedOn.parents("[data-slide-el]").attr("data-slide-el"),
				toggleEl    = $("#" + toggleElId);

			toggleEl.slideToggle("fast", function(){
				//Toggle the display of the link if it has the right class
				if(clickedOn.is(".toggle-display-on-slide")){
					clickedOn.siblings(".toggle-display-on-slide").toggle();
					clickedOn.toggle();
				}
			});
		},

		showAlert: function(msg, classes, container, delay, options) {
			if(!classes)
				var classes = 'alert-success';
			if(!container || !$(container).length)
				var container = this.$el;

			//Remove any alerts that are already in this container
			if($(container).children(".alert-container").length > 0)
				$(container).children(".alert-container").remove();

			//Allow messages to be HTML or strings
			if(typeof msg != "string")
				msg = $(document.createElement("div")).append($(msg)).html();

			var emailOptions = "";

			//Check for more options
			if(typeof options != "undefined" && options.emailBody)
				emailOptions += "?body=" + options.emailBody;

			//Allow error messages to be removed
			var remove = options? options.remove : false;

			var alert = $.parseHTML(this.alertTemplate({
				msg: msg,
				classes: classes,
				emailOptions: emailOptions,
				remove: remove
			}).trim());

			if(delay){
				$(alert).hide();
				$(container).prepend(alert);
				$(alert).show().delay(typeof delay == "number"? delay : 3000).fadeOut();
			}
			else
				$(container).prepend(alert);
		},

		// Listens to the focus event on the window to detect when a user switches back to this browser tab from somewhere else
		// When a user checks back, we want to check for log-in status
		listenForActivity: function(){
			MetacatUI.appUserModel.on("change:loggedIn", function(){
				if(!MetacatUI.appUserModel.get("loggedIn")) return;

				//Check the user's token on focus
				$(window).focus(function(){
					if(!MetacatUI.appUserModel.get("loggedIn")) return;

					if(MetacatUI.appModel.get("tokenUrl")){
						//If the user's token is no longer valid, then refresh the page
						MetacatUI.appUserModel.checkToken();
					}
					else{
						MetacatUI.appUserModel.checkStatus();
					}
				});
			});
		},

		openChatWithMessage: function(){
			if(!_slaask) return;

	    	$("#slaask-input").val(MetacatUI.appModel.get("defaultSupportMessage"));
	    	$("#slaask-button").trigger("click");

		},

		initializeWidgets: function(){
			 // Autocomplete widget extension to provide description tooltips.
 		    $.widget( "app.hoverAutocomplete", $.ui.autocomplete, {

 		        // Set the content attribute as the "item.desc" value.
 		        // This becomes the tooltip content.
 		        _renderItem: function( ul, item ) {
 		        	// if we have a label, use it for the title
 		        	var title = item.value;
 		        	if (item.label) {
 		        		title = item.label;
 		        	}
 		        	// if we have a description, use it for the content
 		        	var content = item.value;
 		        	if (item.desc) {
 		        		content = item.desc;
 		        		if (item.desc != item.value) {
 			        		content += " (" + item.value + ")";
 		        		}
 		        	}
 		        	var element = this._super( ul, item )
 	                .attr( "data-title", title )
 	                .attr( "data-content", content );
 		        	element.popover(
 		        			{
 		        				placement: "right",
 		        				trigger: "hover",
 		        				container: 'body'

 		        			});
 		            return element;
 		        }
 		    });
		},

		/********************** Utilities ********************************/
		// Various utility functions to use across the app //
		/************ Function to add commas to large numbers ************/
		commaSeparateNumber: function(val){
			if(!val) return 0;

			if(val < 1) return  Math.round(val * 100) / 100;

		    while (/(\d+)(\d{3})/.test(val.toString())){
		      val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
		    }
		    return val;
		 },
		higlightInput: function(e){
			if(!e) return;

			e.preventDefault();
			e.target.setSelectionRange(0, 9999);
		},

		widenInput: function(e){
			$(e.target).css("width", "200px");
		},

		narrowInput: function(e){
			$(e.target).delay(500).animate({"width": "60px"});
		},

		// scroll to top of page
		scrollToTop: function() {
			$("body,html").stop(true,true) //stop first for it to work in FF
						  .animate({ scrollTop: 0 }, "slow");
			return false;
		},

		scrollTo: function(pageElement, offsetTop){
			//Find the header height if it is a fixed element
			var headerOffset = (this.$("#Header").css("position") == "fixed") ? this.$("#Header").outerHeight() : 0;
			var navOffset    = (this.$("#Navbar").css("position") == "fixed") ? this.$("#Navbar").outerHeight() : 0;
			var totalOffset = headerOffset + navOffset;

			$("body,html").stop(true,true) //stop first for it to work in FF
						  .animate({ scrollTop: $(pageElement).offset().top - 40 - totalOffset}, 1000);
			return false;
		},

		//Will pop up an alert asking if the user wants to leave the page or not.
		confirmLeave: function(e){
			var decision = confirm("Do you want to leave this page? All information you've entered will be lost.");
			return decision;
		}

	});
	return AppView;
});
