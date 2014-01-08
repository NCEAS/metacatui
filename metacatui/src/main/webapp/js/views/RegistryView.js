/*global define */
define(['jquery', 'underscore', 'backbone', 'registry', 'bootstrap', 'text!templates/registryFields.html', 'text!templates/ldapAccountTools.html', 'text!templates/loading.html'], 				
	function($, _, Backbone, Registry, BootStrap, RegistryFields, LdapAccountToolsTemplate, LoadingTemplate) {
	'use strict';
	
	// Build the main header view of the application
	var RegistryView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(RegistryFields),
		
		loadingTemplate: _.template(LoadingTemplate),
		
		ldapAccountToolsTemplate: _.template(LdapAccountToolsTemplate),
				
		registryUrl: null,
		
		registryQueryString:  "cfg=metacatui",
		
		events: {
			"click #entryFormSubmit"   : "submitEntryForm",
			"click #entryReturnSubmit"   : "submitReturnForm",
			"click #dataCorrect"  		 : "submitConfirmYesForm",
			"click #dataWrongButton"   	: "submitConfirmNoForm",
			"click #loginButton"   	: "submitLoginForm",
			"click #registerAnotherPackage" : "registerAnotherPackage",
			"click #createAccount" : "createAccount",
			"click #lookupAccount" : "lookupAccount",
			"click #resetPassword" : "resetPassword",
			"click #changePassword" : "changePassword",
			"keypress input[name='password']" : "submitOnEnter",
			"keypress input[name='uid']" : "submitOnEnter"

		},

		initialize: function () {
			
		},
				
		render: function () {
			
			// look up the url from the main application model
			this.registryUrl = appModel.get('registryServiceUrl');
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			console.log('Calling the registry to display');
			console.log('Calling the registry URL: ' + this.registryUrl);
			
			// show the loading icon
			this.showLoading();
			
			// load all the registry content so all the js can run in what gets loaded
			var viewRef = this;
			$.ajax({
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: this.registryUrl,
					data: this.registryQueryString,
					success: function(data, textStatus, jqXHR) {
						viewRef.$el.html(data);
						viewRef.verifyLoginStatus();
						viewRef.augementForm();
						viewRef.modifyLoginForm();
						viewRef.$el.hide();
						viewRef.$el.fadeIn('slow');
					}
				});
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the registry view');
		},
		
		verifyLoginStatus: function() {
			// CGI can be logged in, but JSESSIONID has expired
			var registryEntryForm = $("#RegistryEntryForm");
			
			// if we have the registry form but it doesn't look like we are logged in, force a logout
			if (registryEntryForm.length && !appModel.get('username')) {
				uiRouter.navigate("logout", {trigger: true});
			}
		},
		
		augementForm: function() {
			// want to add fields to the form automatically
			var registryEntryForm = $("#RegistryEntryForm");
			
			// if we have the registry form we can add to it
			if (registryEntryForm.length) {
				// pull from the model configuration
				var formFields = registryModel.get("formFields");
				_.each(formFields, function(value, key, list) {
					// check if it exists yet
					if (registryEntryForm.find("input[name='" + key + "'][value='" + value +"']").length > 0) {
						return;
					}
					// set in the form
					registryEntryForm.find("#" + key).attr("value", value);

					// add to the form
					addKeyword();
				});
				
				// replace keywords with this widget
				// use configuration from model for the selection
				var formOptions = registryModel.get("formOptions");
				registryEntryForm.find("#keyword").replaceWith(this.template({formOptions: formOptions}));
				
			}
		},
		
		modifyLoginForm: function() {
			// customize the login form to provide external links as needed
			var ldapAccountTools = $("#ldapAccountTools");
			
			// if we have the login form we can modify it
			if (ldapAccountTools.length) {
				var ldapwebServiceUrl = appModel.get('ldapwebServiceUrl') + this.registryQueryString;

				var templateContent = this.ldapAccountToolsTemplate({ldapwebServiceUrl: ldapwebServiceUrl});
				if (templateContent.length) {
					ldapAccountTools.replaceWith(templateContent);				
				}
			}
		},
		
		submitEntryForm: function() {

			// use FormData for the file upload to work
			var data = new FormData($('#entryForm')[0]);
			
			// show the loading icon
			this.showLoading();
			
			var contentArea = this.$el;
			$.ajax({
			    url: this.registryUrl,
			    data: data,
			    cache: false,
			    contentType: false,
			    processData: false,
			    type: 'POST',
				xhrFields: {
					withCredentials: true
				},
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
			
			// get the form data before replacing everything with the loading icon
			var formData = $("#" + formId).serialize()
			
			// show the loading icon
			this.showLoading();
			
			// ajax call to submit the given form and then render the results in the content area
			var viewRef = this;
			var contentArea = this.$el;
			$.ajax({
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: this.registryUrl,
					data: formData,
					success: function(data, textStatus, jqXHR) {
						contentArea.html(data);
						viewRef.augementForm();
					}
			});
			
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
				alert("You must type a username. \n");
				formObj.elements["uid"].focus();
				return false;
			}

			if (organization == "") {
				alert("You must select an organization. \n");
				formObj.elements["organization"].focus();
				return false;
			}

			if (password == "") {
				alert("You must type a password. \n");
				formObj.elements["password"].focus();
				return false;
			}

			formObj.username.value = "uid=" + formObj.elements["uid"].value + ",o="
					+ formObj.elements["organization"].value
					+ ",dc=ecoinformatics,dc=org";
			
			// get the form data before replacing everything with the loading icon!
			var formData = $("#loginForm").serialize();
			
			// show the loading icon
			this.showLoading();

			// reference to this view for callback functions
			var viewRef = this;

			// create an area for temporarily stashing returned form
			viewRef.$el.append("<div id='tempMetacatContainer' />");
			
			// ajax call to submit the given form and then render the results in the content area
			// use post to prevent passwords in the URL
			$.ajax({
				type: "POST",
				xhrFields: {
					withCredentials: true
				},
				url: this.registryUrl,
				data: formData,
				success: function(data, textStatus, xhr) {
					
					// stash the form content
					viewRef.$('#tempMetacatContainer').html(data);
							
					// the Metacat login form is now in the main content for us to work with
					var metacatUrl = viewRef.$("form").attr("action");
					
					// success from Perl?
					if (metacatUrl) {
						// submit the Metacat API login form
						var loginFormData = viewRef.$("form").serialize();
						$.ajax({
							type: "POST",
							xhrFields: {
								withCredentials: true
							},
							url: metacatUrl,
							data: loginFormData,
							success: function(data1, textStatus1, xhr1) {
								// browser has the JSESSIONID cookie now
								//var allHeaders = xhr1.getAllResponseHeaders();
								console.log("Got headers, JSESSIONID cookie");
								
								// set the username in the appModel, that's all we have
								appModel.set("username", username);
								
								// trigger the check for logged in user
								appView.checkUserStatus();
								
								// then load the registry url again, now that we are logged in
								viewRef.render();
							}
						});
					} else {
						// just show what was returned (error message)
						viewRef.$el.html(data);
					}
					
					// clean up the temp area
					viewRef.$('#tempMetacatContainer').remove();
					
				}
		});
			
			return true;
		},
		
		// this logout hits both the perl registry and the Metacat API
		logout: function () {
			
			// clear the search criteria in case we are filtering by username
			searchModel.clear();
			
			// look up the url from the main application model
			this.registryUrl = appModel.get('registryServiceUrl');
			
			// show the loading icon
			this.showLoading();
			
			// reference to this view for callback functions
			var viewRef = this;
			
			// create an area for temporarily stashing returned form
			viewRef.$el.append("<div id='tempMetacatContainer' />");
			
			// ajax call to logout, only want the form object
			$.ajax({
				type: "GET",
				xhrFields: {
					withCredentials: true
				},
				url: this.registryUrl + "?" + this.registryQueryString + "&stage=logout",
				data: null, // params are in the URL
				success: function(data, textStatus, xhr) {
					
					viewRef.$('#tempMetacatContainer').html(data);
					
					// the Metacat logout form is now in the main content for us to work with
					var metacatUrl = viewRef.$("form").attr("action");
					
					// Success?
					if (metacatUrl) {
						// submit the Metacat API login form
						var logoutFormData = viewRef.$("form").serialize();
						$.ajax({
							type: "POST",
							xhrFields: {
								withCredentials: true
							},
							url: metacatUrl,
							data: logoutFormData,
							success: function(data1, textStatus1, xhr1) {
								// don't really do anything with this - browser has the JSESSIONID cookie now
								console.log("Logged out, this JSESSIONID cookie is invalid now");
								
								// set the username to null in the appModel
								appModel.set("username", null);
								
								// trigger the check for logged in user
								appView.checkUserStatus();
							}
						});
					} else {
						// just show what was returned (error message)
						viewRef.$el.html(data);
					}
					
					// clean up the temp area
					viewRef.$('#tempMetacatContainer').remove();
					
					// do we want to load the registry, or just let other controller decide the next view?
					viewRef.render();

				}
			});
			
			return true;
		},
		
		registerAnotherPackage: function() {
			// just render the view from the beginning 
			this.render();
		},
		
		createAccount: function() {
			// just route to the signup view
			uiRouter.navigate("signup", {trigger: true});
			
			// prevent click-through
			return false;
		},
		
		resetPassword: function() {
			// just route to the password reset view
			uiRouter.navigate("account/resetpass", {trigger: true});
			
			// prevent click-through
			return false;
		},
		
		changePassword: function() {
			// just route to the password change view
			uiRouter.navigate("account/changepass", {trigger: true});
			
			// prevent click-through
			return false;
		},
		
		lookupAccount: function() {
			// just route to the lookupname view
			uiRouter.navigate("account/lookupname", {trigger: true});
			
			// prevent click-through
			return false;
		},

		trimString: function (stringToTrim) {
			return stringToTrim.replace(/^\s*/, '').replace(/\s*$/, '');
		},
		
		showLoading: function() {
			this.scrollToTop();
			this.$el.html(this.loadingTemplate());
		},
		
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		},
		
		submitOnEnter: function(e) {
			console.log('Pressed enter');
			if (e.keyCode != 13) return;
			this.submitLoginForm();
		}
				
	});
	return RegistryView;		
});
