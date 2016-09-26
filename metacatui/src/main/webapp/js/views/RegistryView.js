/*global define */
define(['jquery', 'underscore', 'backbone', 'bootstrap', 'jqueryform', 'views/SignInView', 'text!templates/alert.html', 'text!templates/registryFields.html', 
        'text!templates/ldapAccountTools.html', 'text!templates/loading.html', 'text!templates/loginHeader.html', 'text!templates/insertProgress.html'], 				
	function($, _, Backbone, BootStrap, jQueryForm, SignInView, AlertTemplate, RegistryFields, LdapAccountToolsTemplate, LoadingTemplate, LoginHeaderTemplate, ProgressTemplate) {
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
		progressTemplate: _.template(ProgressTemplate),
				
		registryUrl: null,
		
		stage:  null,
		
		pid:  null,

		registryQueryString:  "cfg=metacatui",
		
		events: {
			"click #entryFormSubmit"        : "submitEntryForm",
			"click #entryReturnSubmit"      : "submitReturnForm",
			"click #dataCorrect"  		    : "submitConfirmYesForm",
			"click #dataWrongButton"   	    : "submitConfirmNoForm",
			"click .dataWrongButton"   	    : "submitConfirmNoForm",
			"click #loginButton"   	        : "submitLoginForm",
			"click #registerAnotherPackage" : "registerAnotherPackage",
			"click #createAccount"          : "createAccount",
			"click #lookupAccount" 			: "lookupAccount",
			"click #resetPassword"          : "resetPassword",
			"click #changePassword"           : "changePassword",
			"keypress input[name='password']" : "submitOnEnter",
			"keypress input[name='uid']"      : "submitOnEnter",
			"click .remove-award"             : "removeAward",
			"keypress #funding-visible"       : "addAwardOnEnter",
			"change #RegistryEntryForm :input" : "trackChange"
		},

		initialize: function () {
			
		},
				
		render: function () {
			
			// request a smaller header
			MetacatUI.appModel.set('headerType', 'default');
			
			// show the loading icon
			this.showLoading();

			//Are we using auth tokens?
			var tokenUrl = MetacatUI.appModel.get("tokenUrl");
			if((typeof tokenUrl != "undefined") && tokenUrl.length){
				
				//If our app user's status hasn't been checked yet, then wait...
				if(!MetacatUI.appUserModel.get("checked")){
					this.listenToOnce(MetacatUI.appUserModel, "change:checked", function(){
						MetacatUI.appView.currentView.loadRegistry.call(appView.currentView);
					});
					return this;
				}
				//If the user is not logged in, show the login form
				else if (!MetacatUI.appUserModel.get("loggedIn")){
					this.showSignInForm();
					return this;
				}
				//If the user is logged in and we're using tokens, verify the token first
				else if(MetacatUI.appUserModel.get("loggedIn")){
					MetacatUI.appUserModel.checkToken(function(){	//If the token is valid, load the registry.
												MetacatUI.appView.currentView.loadRegistry.call(MetacatUI.appView.currentView);
											},
											function(){ //If the token if not valid, load the sign in form	
												MetacatUI.appView.currentView.showSignInForm.call(MetacatUI.appView.currentView);
											});
					return this;
				}
			}
			//If we're not using tokens, load the registry and let the CGI script verify if the user is logged in
			else
				this.loadRegistry();
			
			return this;
		},
		
		/*
		 * Load the registry template from the register-dataset.cgi script in Metacat.
		 */
		loadRegistry: function(){
			var tokenUrl = MetacatUI.appModel.get("tokenUrl");
			if(((typeof tokenUrl != "undefined") && tokenUrl.length) && !MetacatUI.appUserModel.get("loggedIn")){
				this.showSignInForm();
				return false;
			}

			//Get the registry view
			var viewRef = this;

			// look up the url from the main application model
			this.registryUrl = MetacatUI.appModel.get('registryServiceUrl');
						
			var stageParams = '';
			if (this.stage) {
				stageParams = "&stage=" + this.stage + "&pid=" + this.pid;
			}
			
			// load all the registry content so all the js can run in what gets loaded
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
						
						//Check login one more time
						viewRef.verifyLoginStatus();
						
						//Add additional form elements
						viewRef.augementForm();
						
						viewRef.modifyLoginForm();
						viewRef.$el.hide();
						viewRef.$el.fadeIn('slow', function(){
							viewRef.trigger("postRender");
							viewRef.createAwardHelpers();
							window.onbeforeunload = function(){ viewRef.confirmClose() };
						});			
						
						//Start showing progress updates
						viewRef.listenForProgressUpdate();
					}
				}
	
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},
		
		verifyLoginStatus: function() { 
			// CGI can be logged in, but JSESSIONID has expired
			var registryEntryForm = $("#RegistryEntryForm");
			
			// if we have the registry form but it doesn't look like we are logged in, force a logout
			if (registryEntryForm.length && !MetacatUI.appUserModel.get('username')) {
				MetacatUI.uiRouter.navigate("signout", {trigger: true});
			}
		},
		
		augementForm: function() {
			// want to add fields to the form automatically
			var registryEntryForm = $("#RegistryEntryForm");
			var loginForm = $(this.loginEl);
			
			// if we have the registry form we can add to it
			if (registryEntryForm.length) {
				// pull from the model configuration
				var formFields = MetacatUI.registryModel.get("formFields");
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
				var formOptions = MetacatUI.registryModel.get("formOptions");
				registryEntryForm.find("#keyword").replaceWith(this.template({formOptions: formOptions}));
				
				this.watchForTimeOut();
				
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
		
		/*
		 * Set up an autocomplete and table for the award numbers field 
		 */
		createAwardHelpers: function() {			
			var view = this;
			
			//Get the award number input element
			var input = this.$("#funding-visible");
			if(!input || !input.length) return;
			
			//Add the "add" button
			var addBtn = $(document.createElement("a")).addClass("btn input-submit").text("Add").prepend("<i class='icon icon-plus icon-on-left'></i>");
			input.after(addBtn);
			//$(addBtn).on("click", this.addAward);
			
			//Check if there are award numbers entered into the field right now
			var currentAwards = $("#funding").val();
			if(currentAwards){
				//Add these awards to the list
				_.each(currentAwards.split(","), function(awardId){
					//See if there is a title for this award in the award lookup
					MetacatUI.appLookupModel.getGrant(awardId, function(award){
						//If a match is found, add it to the list
						view.addAward(award);						
					}, function(){
						//If no match is found, add it to the list without a title
						view.addAward({ id: awardId });
					});					
				});
			}
			
			//When the user is done entering a grant number, get the grant title from the API
			$(input).focusout(function(){
					
				if(MetacatUI.appModel.get("grantsUrl")){
					//Get the award title and id
					MetacatUI.appLookupModel.getGrant(
							input.val(), 
							function(award){							
								//Display this award							
								view.addAward(award);
							},
							function(){
								//Display this award as-is						
								view.addAward({ id: input.val() });
							}
					);
				}
				else{
					var award = {
							id: input.val()
					}
					if(!award.id) return;
					
					view.addAward(award);
				}
			});
			
			//Only proceed if we have configured this app with the grants API url
			if(!MetacatUI.appModel.get("grantsUrl")) return;	
			
			//Add help text when we can do a lookup
			input.siblings(".input-help-msg").text("Enter an award number or search for an NSF award by keyword.");
			
			//Setup the autocomplete widget
			$(input).hoverAutocomplete({
				source: MetacatUI.appLookupModel.getGrantAutocomplete,
				select: function(e, ui) {
					e.preventDefault();
										
					view.addAward({ title: ui.item.label, id: ui.item.value });
				},
				position: {
					my: "left top",
					at: "left bottom",
					of: "#funding-visible",
					collision: "fit"
				},
				appendTo: input.parent(),
				minLength: 3
			});
			input.parents(".accordion-body").addClass("ui-autocomplete-container");			
		},
		
		addAward: function(award){
			if(!award.id) return;
			
			//Don't add duplicates
			if($("#funding-list").find("[data-id='" + award.id + "']").length > 0){
				
				//Clear the input
				$("#funding-visible").val("");
				
				//Display an error msg
				var helpMsg = $("#funding").siblings(".input-help-msg"),
					originalMsg = helpMsg.text();				
				$(helpMsg).addClass('danger').text("That award was already added.");
				
				//Remove the message after some time
			    setTimeout(function(){
			    	helpMsg.removeClass('danger').text(originalMsg);
			      }, 2000);
			
				return;
			}
			
			//Display this award
			var title = award.title || (MetacatUI.appModel.get("grantsUrl")? "Award name unknown (this award number was not found in the NSF database.)" : null),
				titleEl = title? $(document.createElement("td")).text(title) : null,
				numberEl = $(document.createElement("td")).text(award.id),
				removeEl = $(document.createElement("td")).addClass("cell-icon").append('<a><i class="icon-remove-sign icon remove-award pointer" alt="Delete"></i></a>'),
				row = $(document.createElement("tr")).append(titleEl, numberEl, removeEl).attr("data-id", award.id).addClass("funding-list-item");							
			
			//Style as a warning if we are looking up awards and there is no match
			if(MetacatUI.appModel.get("grantsUrl") && !award.title)
				row.addClass("warning");
				
			//Add the row
			$("#funding-list").append(row);
			
			//Clear the input and add the new award number to the hidden input
			this.$("#funding-visible").val("");
			if($("#funding").val()){
				var ids = this.$("#funding").val().split(",");
				if(!_.contains(ids, award.id))
					$("#funding").val($("#funding").val() + "," + award.id);
			}
			else
				$("#funding").val(award.id);
		},
		
		removeAward: function(e){
			if(!e) return;
			
			//Get the remove link that was clicked
			var removeLink = e.target;
			if(!removeLink) return;
			
			//Get the id of the award that was removed
			var removeId = $(removeLink).parents("tr").attr("data-id");
			
			//Remove the table row that displays this award
			$("#funding-list [data-id='" + removeId + "']").remove();
			
			//Remove the award id from the hidden input value
			var ids = this.$("#funding").val().split(",");
			this.$("#funding").val(_.without(ids, removeId).toString());
		},
		
		addAwardOnEnter: function(e){
			if (e.keyCode != 13) return;
			
			var award = {
					id: $("#funding-visible").val()
			}
			
			this.addAward(award);			
		},
		
		modifyLoginForm: function() {
			// customize the login form to provide external links as needed
			var ldapAccountTools = $("#ldapAccountTools");
			
			// if we have the login form we can modify it
			if (ldapAccountTools.length) {
				var ldapwebServiceUrl = MetacatUI.appModel.get('ldapwebServiceUrl') + this.registryQueryString;

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
				uploadProgress: function(evt, position, total, percentComplete) {
					
					// note incoming total is in KB
					var byteLabel = "KB"; // Bytes
					var currentBytes = 0;
					var totalBytes = 0;
					
					if ( total > 0 ) {
						if ( total > Math.pow(2, 30) ) {
							// Gigabytes
							byteLabel = "GB";
							currentBytes = position/Math.pow(10, 9);
							totalBytes = total/Math.pow(10, 9);
							
						} else if ( total > Math.pow(2, 20) ) {
							// Megabytes
							byteLabel = "MB";
							currentBytes = position/Math.pow(10, 6);
							totalBytes = total/Math.pow(10, 6);
							
 						} else {
							// Kilobytes
							currentBytes = position;
							totalBytes = total;
							
						}
						
					}
					// Format to two significant figures
					totalBytes = totalBytes.toFixed(2);
					currentBytes = currentBytes.toFixed(2);
					
					var progressHTML = "<h2>Uploading data files and checking metadata</h2>";					
					progressHTML += "<p>";
					progressHTML += currentBytes;
					progressHTML += "&nbsp"; 
					progressHTML += byteLabel;
					progressHTML += "&nbsp; of &nbsp;";
					progressHTML += totalBytes;
					progressHTML += "&nbsp"; 
					progressHTML += byteLabel;
					progressHTML += "</p>";
					
					progressHTML += "<div class=\"progress progress-success progress-striped\">";
					progressHTML += "<div class=\"progress-bar progress-bar-success\"";
					progressHTML += " role=\"progressbar\" aria-valuenow=\"100\" aria-valuemin=\"0\" aria-valuemax=\"100\"";
					progressHTML += " style=\"color: #777777; width:";
					progressHTML += percentComplete; 
					progressHTML += "% \" />&nbsp;";
					progressHTML += percentComplete;
					progressHTML += " %</div></div>";
					contentArea.html(progressHTML);
					
				},
				success: function(data, textStatus, jqXHR) {

					contentArea.html(data);
					
					//Scroll to the top of the page
					view.scrollToTop();
				}
			}
			
			$('#entryForm').ajaxSubmit(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			
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
			var formData = $("#" + formId).serialize();
			
			// show the loading icon
			//var msg = (formId == "confirmForm")? "Uploading your data set ... this may take a few minutes." : "";		
			//this.showLoading(msg);
			
    		MetacatUI.registryModel.set("status", "processing");

			//Get some references to the view
			var viewRef = this;
			var contentArea = this.$el;
			
			// ajax call to submit the given form and then render the results in the content area
			var requestSettings = {
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: this.registryUrl,
					data: formData,
					success: function(data, textStatus, jqXHR) {

						//When the entry is successfully submitted, show a progress page
				    	if((formId == "confirmForm") && (data.indexOf("Success") > -1)){	
				    		//Get the id of the new metdata
				    		var id = data.substring(data.indexOf("#view/")+6);
				    		id = id.substring(0, id.indexOf('"'));
				    		MetacatUI.registryModel.set("id", id);
				    		//MetacatUI.registryModel.set("status", "processing");
				    		
				    		//Check the index for the new entry
				    		MetacatUI.registryModel.checkIndex();				    		
				    	}
				    	//Show the response from the registry script if there doesn't appear to be a success message
				    	else{
				    		contentArea.html(data);
							viewRef.augementForm();
							viewRef.createAwardHelpers();
				    	}
				    	
				    	//Scroll to the top of the page
				    	viewRef.scrollToTop();
					}
			};
			
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			
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
								MetacatUI.appUserModel.set("username", username);
								MetacatUI.appUserModel.set("loggedIn", true);
								MetacatUI.appUserModel.getInfo();
															
								viewRef.listenToOnce(MetacatUI.appUserModel, "change:loggedIn", function(){
									if(!MetacatUI.appUserModel.get("loggedIn")){
										viewRef.listenTo(viewRef, "postRender", function(){
											viewRef.$(viewRef.loginEl).children(".alert-container").detach();
											viewRef.$(viewRef.loginEl).prepend(viewRef.alertTemplate({ 
												msg: "Login failed. Please try again. ",
												classes: "alert-error"
											}));											
										});
									}
									
									//Rerender the page
									MetacatUI.uiRouter.navigate("share", {trigger: true});
									viewRef.render();
								});
								
								// then load the registry url again, now that we are logged in
								MetacatUI.uiRouter.navigate("share", {silent: true});
								viewRef.loadRegistry();
							}
						}
						
						$.ajax(_.extend(submitSettings, MetacatUI.appUserModel.createAjaxSettings()));
						
					} else {
						// just show what was returned (error message)
						viewRef.$el.html(data);
					}
					
					// clean up the temp area
					viewRef.$('#tempMetacatContainer').remove();
					
				}
			}
			
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			
			return true;
		},
		
		// this logout hits both the perl registry and the Metacat API
		logout: function () {
			
			// clear the search criteria in case we are filtering by username
			MetacatUI.appSearchModel.clear();
			
			// look up the url from the main application model
			this.registryUrl = MetacatUI.appModel.get('registryServiceUrl');
			
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
					var metacatUrl = MetacatUI.appModel.get("metacatUrl") || viewRef.$("form").attr("action");
					
					// Success?
					if (metacatUrl) {
						// submit the Metacat API logout form
						var logoutFormData = viewRef.$("form").serialize();
						var logoutSettings = {
							type: "POST",
							xhrFields: {
								withCredentials: true
							},
							url: metacatUrl,
							data: logoutFormData,
							success: function(data1, textStatus1, xhr1) {
								/*
								// Reset the user model username
								MetacatUI.appUserModel.set("username", null);
								
								// trigger the check for logged in user
								MetacatUI.appUserModel.checkStatus(function(){
									viewRef.render.call(viewRef);
								}, function(){
									viewRef.render.call(viewRef);
								});	*/
								MetacatUI.appUserModel.reset();
								viewRef.render();
								
							}
						}

						$.ajax(_.extend(logoutSettings, MetacatUI.appUserModel.createAjaxSettings()));

					} else {
						// just show what was returned (error message)
						viewRef.$el.html(data);
					}
					
					// clean up the temp area
					viewRef.$('#tempMetacatContainer').remove();

				}
			}
			
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

			return true;
		},
		
		registerAnotherPackage: function() {
			// just render the view from the beginning 
			this.render();
		},
		
		createAccount: function() {
			// just route to the signup view
			MetacatUI.uiRouter.navigate("signup", {trigger: true});
			
			// prevent click-through
			return false;
		},
		
		resetPassword: function() {
			// just route to the password reset view
			MetacatUI.uiRouter.navigate("account/resetpass", {trigger: true});
			
			// prevent click-through
			return false;
		},
		
		changePassword: function() {
			// just route to the password change view
			MetacatUI.uiRouter.navigate("account/changepass", {trigger: true});
			
			// prevent click-through
			return false;
		},
		
		lookupAccount: function() {
			// just route to the lookupname view
			MetacatUI.uiRouter.navigate("account/lookupname", {trigger: true});
			
			// prevent click-through
			return false;
		},

		trimString: function (stringToTrim) {
			return stringToTrim.replace(/^\s*/, '').replace(/\s*$/, '');
		},
		
		/*
		 * Displays the progress of this registry entry to the user when the model's status is updated
		 */
		listenForProgressUpdate: function(){
			var view = this;
			
			//Periodically check if the submission is indexed yet
			this.listenTo(MetacatUI.registryModel, "change:status", function(){
				view.showProgress();
			});
		},
		
		showProgress: function(){
			//Show the progress 
			this.$el.html(this.progressTemplate({
				status: MetacatUI.registryModel.get("status"),
				id:     MetacatUI.registryModel.get("id")
			}));
			
			//If the status is processing, animate the progress bar
			if(MetacatUI.registryModel.get("status") == "processing"){
				var fullWidth = this.$(".progress").width();
				this.$(".progress-bar").animate({
					width: fullWidth + "px"
				}, 1800000);
			}
		},
		
		/*
		 * Show the SignIn View (or auth tokens)
		 */
		showSignInForm: function(container){
			if(!MetacatUI.appModel.get("tokenUrl")) return;
			
			var signInBtns = new SignInView().render().el;
			
			if(typeof container == "undefined")
				var container = this.el;

			$(container).html("<h1 class='center'>Sign in to submit data</h1>");
			$(signInBtns).addClass("large center");
			$(container).append(signInBtns);
			
			$(signInBtns).find(".login").addClass("btn btn-primary").trigger("click");
		},
		
		watchForTimeOut: function(){
			//This only works with tokens
			if(!MetacatUI.appModel.get("tokenUrl")) return;
			
			var view = this,
				expires = MetacatUI.appUserModel.get("expires"),
				timeLeft = new Date() - expires,
				timeoutId = setTimeout(function(){
					if(MetacatUI.appUserModel.get("expires") <= new Date()){		
						MetacatUI.appUserModel.set("loggedIn", false);
						
						 var signInView = new SignInView({
							 inPlace: true,
							 topMessage: "Your session has timed out. Please sign-in in a new tab then come back to continue editing."
						 })
						 var signInForm = signInView.render().el;
						 
						 if(view.subviews && Array.isArray(view.subviews))
							 view.subviews.push(signInView);
						 else
							 view.subviews = [signInView];
						 						 						 
						$("body").append(signInForm);										
						$(signInForm).modal();		
						
						//When the user logged back in, listen again for the next timeout
						view.listenToOnce(MetacatUI.appUserModel, "change:checked", function(){
							if(MetacatUI.appUserModel.get("checked") && MetacatUI.appUserModel.get("loggedIn"))
								view.watchForTimeOut();
						});
					}
				}, timeLeft);
			
			MetacatUI.registryModel.set("timeout", timeoutId);			
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
		},
		
		trackChange: function(){
			MetacatUI.registryModel.set("changed", true);
		},
		
		confirmClose: function(){
			//If the user isn't logged in, we can leave this page
			if(!MetacatUI.appUserModel.get("loggedIn")) return true;
						
			//If the form hasn't been edited, we can close this view without confirmation
			if(!MetacatUI.registryModel.get("changed")) return true;
				
			//If the submission is complete, we can leave this page
			if(MetacatUI.registryModel.get("status") == "complete") return true;
			
			var isLeaving = confirm("Do you want to leave this page? All information you've entered will be lost.");
			return isLeaving;
		},
		
		onClose: function(){
			this.stopListening();
			
			//Clear the timeout listener
			if(MetacatUI.registryModel.get("timeout"))
				clearTimeout(MetacatUI.registryModel.get("timeout"));
			
			//Close the subviews
			_.each(this.subviews, function(i, view){
				if(typeof view.onClose == "function") view.onClose();
			});
			
			MetacatUI.registryModel.reset();
			window.onbeforeunload = null;
		}
				
	});
	return RegistryView;		
});
