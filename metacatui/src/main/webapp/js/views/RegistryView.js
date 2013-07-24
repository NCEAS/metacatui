/*global define */
define(['jquery', 'underscore', 'backbone', 'registry', 'bootstrap'], 				
	function($, _, Backbone, Registry, BootStrap) {
	'use strict';
	
	// Build the main header view of the application
	var RegistryView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
				
		registryUrl: null,
		
		registryQueryString:  "?cfg=metacatui",

		initialize: function () {
			
		},
				
		render: function () {
			
			// look up the url from the main application model
			this.registryUrl = appModel.get('registryServiceUrl');
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			console.log('Calling the registry to display');
			console.log('Calling the registry URL: ' + this.registryUrl);
			// show the progress bar
			this.showProgressBar();
			
			// load all the registry content so all the js can run in what gets loaded
			var viewRef = this;
			this.$el.load(
					this.registryUrl + this.registryQueryString,
					function() {
						viewRef.$el.hide();
						viewRef.$el.fadeIn('slow');
					});
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the registry view');
		},
		
		events: {
			"click #entryFormSubmit"   : "submitEntryForm",
			"click #entryReturnSubmit"   : "submitReturnForm",
			"click #dataCorrect"  		 : "submitConfirmYesForm",
			"click #dataWrongButton"   	: "submitConfirmNoForm",
			"click #loginButton"   	: "submitLoginForm",
			"click #registerAnotherPackage" : "registerAnotherPackage"

		},
		
		submitEntryForm: function() {

			// use FormData for the file upload to work
			var data = new FormData($('#entryForm')[0]);
			
			// show the progress bar
			this.showProgressBar();
			
			var contentArea = this.$el;
			$.ajax({
			    url: this.registryUrl,
			    data: data,
			    cache: false,
			    contentType: false,
			    processData: false,
			    type: 'POST',
			    success: function(data, textStatus, jqXHR) {
					contentArea.html(data);
				}
			});
			
			
		},
		
		submitReturnForm: function() {
			this.submitForm('editForm');
		},
		
		submitConfirmYesForm: function() {
			this.submitForm('confirmForm');
		},
		
		submitConfirmNoForm: function() {
			// set the form param to indicate such - VERY specific string!
			$('#dataWrong').val("No, go back to editing");
			this.submitForm('confirmForm');
		},
		
		submitForm: function(formId) {
			
			// get the form data before replacing everything with the progressbar!
			var formData = $("#" + formId).serialize()
			
			// show the progress bar
			this.showProgressBar();
			
			// ajax call to submit the given form and then render the results in the content area
			var contentArea = this.$el;
			$.post(
					this.registryUrl,
					formData,
					function(data, textStatus, jqXHR) {
						contentArea.html(data);
					}
			);
			
		},
		
		// ported the login.js to this view
		submitLoginForm: function () {

			var formObj = $("#loginForm")[0];
			if (this.trimString(formObj.elements["loginAction"].value) != "Login")
				return true;
			// trim username & passwd:
			var username = this.trimString(formObj.elements["uid"].value);
			var organization = this.trimString(formObj.elements["organization"].value);
			var password = this.trimString(formObj.elements["password"].value);

			if (username == "") {
				alert("You must type a username. \n" + popupMsg);
				formObj.elements["uid"].focus();
				return false;
			}

			if (organization == "") {
				alert("You must select an organization. \n" + popupMsg);
				formObj.elements["organization"].focus();
				return false;
			}

			if (password == "") {
				alert("You must type a password. \n" + popupMsg);
				formObj.elements["password"].focus();
				return false;
			}

			formObj.username.value = "uid=" + formObj.elements["uid"].value + ",o="
					+ formObj.elements["organization"].value
					+ ",dc=ecoinformatics,dc=org";
			
			// get the form data before replacing everything with the progressbar!
			var formData = $("#loginForm").serialize();
			
			// show the progress bar
			this.showProgressBar();
			
			// ajax call to submit the given form and then render the results in the content area
			var viewRef = this;
			this.$el.load(
				this.registryUrl + " form",
				formData,
				function(data, textStatus, xhr) {
					// TODO: check for success from Perl
					
					// the Metacat login form is now in the main content for us to work with
					var loginForm = viewRef.$("form")[0];
					var metacatUrl = viewRef.$("form").attr("action");
					
					// submit the Metacat API login form
					var loginFormData = viewRef.$("form").serialize();
					$.post(metacatUrl,
							loginFormData,
							function(data1, textStatus1, xhr1) {
								// extract the JSESSIONID cookie
								// don't really do anything with this - browser has the JSESSIONID cookie
								var allHeaders = xhr1.getAllResponseHeaders();
								console.log("Got headers: " + allHeaders);
								var cookieHeader = xhr1.getResponseHeader('Set-Cookie');
								console.log("Got cookie header: " + cookieHeader);
								
								// set the username in the appModel
								appModel.set("username", username);
							}
						);
					
					// then load the registry url again, now that we are logged in
					viewRef.render();
				}
			);
			
			return true;
		},
		
		// this logout hits both the perl registry and the Metacat API
		logout: function () {
			
			// look up the url from the main application model
			this.registryUrl = appModel.get('registryServiceUrl');
			
			// show the progress bar
			this.showProgressBar();
			
			// ajax call to logout, only want the form object
			var viewRef = this;
			this.$el.load(
				this.registryUrl + this.registryQueryString + "&stage=logout form",
				null,
				function(data, textStatus, xhr) {
					// TODO: check for success from Perl
					
					// the Metacat logout form is now in the main content for us to work with
					var loginForm = viewRef.$("form")[0];
					var metacatUrl = viewRef.$("form").attr("action");
					
					// submit the Metacat API login form
					var logoutFormData = viewRef.$("form").serialize();
					$.post(metacatUrl,
							logoutFormData,
							function(data1, textStatus1, xhr1) {
								// extract the JSESSIONID cookie
								// don't really do anything with this - browser has the JSESSIONID cookie now
								var allHeaders = xhr1.getAllResponseHeaders();
								console.log("Got headers: " + allHeaders);
								var cookieHeader = xhr1.getResponseHeader('Set-Cookie');
								console.log("Got cookie header: " + cookieHeader);
								// set the username to null in the appModel
								appModel.set("username", null);
							}
						);
					
					// do we want to load the registry, or just let other controller decide the next view?
					//viewRef.render();
				}
			);
			
			return true;
		},
		
		registerAnotherPackage: function() {
			// just render the view from the beginning 
			this.render();
		},

		trimString: function (stringToTrim) {
			return stringToTrim.replace(/^\s*/, '').replace(/\s*$/, '');
		},
		
		showProgressBar: function() {
			this.scrollToTop();
			this.$el.html('<div class="progress progress-striped active"><div class="bar" style="width: 100%"></div></div>');
		},
		
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
				return false;
		}
				
	});
	return RegistryView;		
});
