/*global define */
define(['jquery', 'underscore', 'backbone', 'registry', 'bootstrap', 'jqueryform', 'views/SignInView', 'text!templates/alert.html', 'text!templates/registryFields.html', 'text!templates/ldapAccountTools.html', 'text!templates/loading.html', 'text!templates/loginHeader.html'], 				
	function($, _, Backbone, Registry, BootStrap, jQueryForm, SignInView, AlertTemplate, RegistryFields, LdapAccountToolsTemplate, LoadingTemplate, LoginHeaderTemplate) {
	'use strict';
	
	// Build the main header view of the application
	var RegistryView = Backbone.View.extend({

		el: '#Content',
		loginEl: '#RegistryLogin',
		
		template: _.template(RegistryFields),		
		alertTemplate: _.template(AlertTemplate),		
		loadingTemplate: _.template(LoadingTemplate),
		ldapAccountToolsTemplate: _.template(LdapAccountToolsTemplate),
		loginHeaderTemplate: _.template(LoginHeaderTemplate),
				
		registryUrl: null,
		
		stage:  null,
		
		pid:  null,

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
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			// show the loading icon
			this.showLoading();

			//Are we using auth tokens?
			var tokenUrl = appModel.get("tokenUrl");
			if((typeof tokenUrl != "undefined") && tokenUrl.length){
				
				//If our app user's status hasn't been checked yet, then wait...
				if(!appUserModel.get("checked")){
					this.listenToOnce(appUserModel, "change:checked", this.render);
					return;
				}
				//If the user is not logged in, show the login form
				else if (!appUserModel.get("loggedIn")){
					var signInBtns = new SignInView().render().el;

					this.$el.html("<h1 class='center'>Sign in to submit data</h1>");
					$(signInBtns).addClass("large center");
					this.$el.append(signInBtns);
					
					
					$(signInBtns).find(".login").addClass("btn btn-primary").trigger("click");
					return;
				}
			}
			
			//Otherwise...
			//If we are using auth tokens and the user is logged in, load the registry. 
			//If we are not using auth tokens, load the registry
				
			// look up the url from the main application model
			this.registryUrl = appModel.get('registryServiceUrl');
			
			var stageParams = '';
			if (this.stage) {
				stageParams = "&stage=" + this.stage + "&pid=" + this.pid;
			}
			
			// load all the registry content so all the js can run in what gets loaded
			var viewRef = this;
			var requestSettings = {
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: this.registryUrl,
					data: this.registryQueryString + stageParams,
					success: function(data, textStatus, jqXHR) {
							
						viewRef.$el.html(data);
						
						//If this is the login page, prepend some header HTML
						if(data.indexOf('id="RegistryLogin"') != -1) viewRef.$el.prepend(viewRef.loginHeaderTemplate);
						
						viewRef.verifyLoginStatus();
						viewRef.augementForm();
						viewRef.fixModalLinks();
						viewRef.modifyLoginForm();
						viewRef.$el.hide();
						viewRef.$el.fadeIn('slow', function(){
							viewRef.trigger("postRender");
						});						
					}
				};
	
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
			
			return this;
		},
		
		loadRegistryTemplate: function(){
			
		},
		
		verifyLoginStatus: function() { 
			// CGI can be logged in, but JSESSIONID has expired
			var registryEntryForm = $("#RegistryEntryForm");
			
			// if we have the registry form but it doesn't look like we are logged in, force a logout
			if (registryEntryForm.length && !appUserModel.get('username')) {
				uiRouter.navigate("logout", {trigger: true});
			}
		},
		
		fixModalLinks: function() {
			var baseUrl = appModel.get("baseUrl");
			$("#myModal").each(function(index, element) {
				var href = baseUrl + $(element).attr('data-remote');
				$(element).attr('data-remote', href);
			});
			// disable the pointer to old api
			$("a[href*='metacat?action=read&qformat=']").removeAttr("href");
		},
		
		augementForm: function() {
			// want to add fields to the form automatically
			var registryEntryForm = $("#RegistryEntryForm");
			var loginForm = $(this.loginEl);
			
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
			else if(loginForm.length){
				//Enter help items for login inputs
				var orgLabel = this.$("form div.text-left:contains('Organization')");
				if(!orgLabel) return;
				
				//Choose unaffiliated as the default, to help the user
				if($("select[name='organization']").children("option[value='unaffiliated']").length)
					$("select[name='organization']").val("unaffiliated");
				
				var helpIcon = $(document.createElement("i"))
									.addClass("tooltip-this icon icon-question-sign")
									.attr("data-title", "If you signed up for an account here, or you're unsure what to choose, choose 'unaffiliated'")
									.attr("data-placement", "top")
									.attr("data-trigger", "hover click");
				orgLabel.append(helpIcon);
				helpIcon.tooltip();
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
			
			var contentArea = this.$el;
			var view = this;
						
			//We need to use the jQuery plugin jQuery.form so we can submit files in older browsers
			var requestSettings = {
			    url: this.registryUrl,
			    cache: false,
			    contentType: false,
			    processData: false,
			    type: 'POST',
				xhrFields: {
					withCredentials: true
				},
			    success: function(data, textStatus, jqXHR) {
					contentArea.html(data);
					view.scrollToTop();
				}
			}
			
			$('#entryForm').ajaxSubmit(_.extend(requestSettings, appUserModel.createAjaxSettings()));
			
			// prepend the loading icon because we need to keep our form element in the DOM for the jQuery.form plugin to work
			this.scrollToTop();
			$('#RegistryEntryForm').addClass("hidden");
			this.$el.prepend(this.loadingTemplate());						
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
			if(formId == "confirmForm"){
				var msg = "Uploading your data set ... this may take a few minutes.";
			}
			else var msg = "";
			
			this.showLoading(msg);
			
			// ajax call to submit the given form and then render the results in the content area
			var viewRef = this;
			var contentArea = this.$el;
			var requestSettings = {
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
			};
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
			
		},
		
		// ported the login.js to this view
		submitLoginForm: function (e) {
			
			var formObj = ($("#loginForm").length > 0) ? $("#loginForm")[0] : null;
			if(!formObj) return false;
			
			//Remove the alert message
			this.$(this.loginEl).children(".alert-container").detach();
			this.$(".has-error").removeClass("has-error");
			
			// trim username & passwd:
			var username = this.trimString(formObj.elements["uid"].value);
			var organization = this.trimString(formObj.elements["organization"].value);
			var password = this.trimString(formObj.elements["password"].value);

			if (username == "") {
				this.showAlert(formObj.elements["uid"], "Please enter a username.");			
				return false;
			}
			if (organization == "") {
				this.showAlert(formObj.elements["organization"], "You must select an organization.");
				return false;
			}
			if (password == "") {
				this.showAlert(formObj.elements["password"], "You must type a password.");
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
			var requestSettings = {
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
						var submitSettings = {
							type: "POST",
							xhrFields: {
								withCredentials: true
							},
							url: metacatUrl,
							data: loginFormData,
							success: function(data1, textStatus1, xhr1) {
								// browser has the JSESSIONID cookie now
								//var allHeaders = xhr1.getAllResponseHeaders();
								
								// set the username in the appModel, that's all we have
								appUserModel.set("username", username);
															
								viewRef.listenToOnce(appUserModel, "change:loggedIn", function(){
									if(!appUserModel.get("loggedIn")){
										viewRef.listenTo(viewRef, "postRender", function(){
											viewRef.$(viewRef.loginEl).children(".alert-container").detach();
											viewRef.$(viewRef.loginEl).prepend(viewRef.alertTemplate({ 
												msg: "Login failed. Please try again. ",
												classes: "alert-error"
											}));											
										});
									}
									
									//Rerender the page
									uiRouter.navigate("share", {trigger: true});
									viewRef.render();
								});
								
								// trigger the check for logged in user
								appUserModel.checkStatus();
								
								// then load the registry url again, now that we are logged in
								//uiRouter.navigate("share", {trigger: true});
								//viewRef.render();
							}
						}
						
						$.ajax(_.extend(submitSettings, appUserModel.createAjaxSettings()));
						
					} else {
						// just show what was returned (error message)
						viewRef.$el.html(data);
					}
					
					// clean up the temp area
					viewRef.$('#tempMetacatContainer').remove();
					
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
			
			return true;
		},
		
		// this logout hits both the perl registry and the Metacat API
		logout: function () {
			
			// clear the search criteria in case we are filtering by username
			appSearchModel.clear();
			
			// look up the url from the main application model
			this.registryUrl = appModel.get('registryServiceUrl');
			
			// show the loading icon
			this.showLoading();
			
			// reference to this view for callback functions
			var viewRef = this;
			
			// create an area for temporarily stashing returned form
			viewRef.$el.append("<div id='tempMetacatContainer' />");
			
			// ajax call to logout, only want the form object
			var requestSettings = {
				type: "GET",
				xhrFields: {
					withCredentials: true
				},
				url: this.registryUrl + "?" + this.registryQueryString + "&stage=logout",
				data: null, // params are in the URL
				success: function(data, textStatus, xhr) {
					
					viewRef.$('#tempMetacatContainer').html(data);
					
					// the Metacat logout form is now in the main content for us to work with
					var metacatUrl = appModel.get("metacatUrl") || viewRef.$("form").attr("action");
					
					// Success?
					if (metacatUrl) {
						// submit the Metacat API login form
						var logoutFormData = viewRef.$("form").serialize();
						var loginSettings = {
							type: "POST",
							xhrFields: {
								withCredentials: true
							},
							url: metacatUrl,
							data: logoutFormData,
							success: function(data1, textStatus1, xhr1) {
								// don't really do anything with this - browser has the JSESSIONID cookie now
								
								// Reset the user model username
								appUserModel.set("username", null);
								
								// trigger the check for logged in user
								appUserModel.checkStatus();
							}
						}

						$.ajax(_.extend(loginSettings, appUserModel.createAjaxSettings()));

					} else {
						// just show what was returned (error message)
						viewRef.$el.html(data);
					}
					
					// clean up the temp area
					viewRef.$('#tempMetacatContainer').remove();
					
					// do we want to load the registry, or just let other controller decide the next view?
					viewRef.render();

				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));

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
		
		showLoading: function(msg) {
			//Keep the form HTML element in place or the upload won't work on IE 8
			this.scrollToTop();
			
			if(typeof msg == "undefined"){
				var msg = "";
			}
			
			this.$el.html(this.loadingTemplate({
				msg: msg
			}));
		},
		
		showAlert: function(input, message){
			var msg = message || "Please enter all required fields.";
			
			this.$(this.loginEl).prepend(this.alertTemplate({ 
				msg: msg,
				classes: "alert-error"
			}));
			
			//Style the input as an error.
			$(input).parent().parent(".row-fluid").addClass("has-error"); //For Metacat 2.4.X and before
			
			//Focus on the input
			$(input).focus();			
		},
		
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		},
		
		submitOnEnter: function(e) {
			if (e.keyCode != 13) return;
			this.submitLoginForm();
		}
				
	});
	return RegistryView;		
});
