/*global define */
define(['jquery', 'underscore', 'backbone', 'registry'], 				
	function($, _, Backbone, Registry) {
	'use strict';
	
	// Build the main header view of the application
	var RegistryView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		baseUrl: null,
		
		registryUrl: null,
		
		registryQueryString:  "?cfg=metacatui",

		initialize: function () {
			this.baseUrl = window.location.origin;
			this.registryUrl = this.baseUrl + "/knb/cgi-bin/register-dataset.cgi";
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			console.log('Calling the registry to display');
			console.log('Calling the registry URL: ' + this.registryUrl);
			// show the progress bar
			this.showProgressBar();
			// just load it all so all the js can run in what gets loaded
			this.$el.load(this.registryUrl + this.registryQueryString);
			
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
			"click #loginButton"   	: "submitLoginForm"

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
			$.post(
				this.registryUrl,
				formData,
				function(data, textStatus, jqXHR) {
					// TODO: check for success
					
					// then load the registry url again, now that we are logged in
					viewRef.render();
				}
			);
			
			return true;
		},

		trimString: function (stringToTrim) {
			return stringToTrim.replace(/^\s*/, '').replace(/\s*$/, '');
		},
		
		showProgressBar: function() {
			this.$el.html('<div class="progress progress-striped active"><div class="bar" style="width: 100%"></div></div>');
		}
				
	});
	return RegistryView;		
});
