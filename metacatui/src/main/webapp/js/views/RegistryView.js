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

		initialize: function () {
			this.baseUrl = window.location.origin;
			this.registryUrl = this.baseUrl + "/knb/cgi-bin/register-dataset.cgi";
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			console.log('Calling the registry to display');
			var fragment = "article";
			var registryQueryString =  "?cfg=metacatui";
			console.log('Calling the registry URL: ' + this.registryUrl);
			//this.$el.load(registryUrl + " " + fragment);
			// just load it all so all the js can run in what gets loaded
			this.$el.load(this.registryUrl + registryQueryString);
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the registry view');
		},
		
		events: {
			"click #entryFormSubmit"   : "submitEntryForm",
			"click #entryReturnSubmit"   : "submitReturnForm",
			"click #dataCorrect"  		 : "submitConfirmYesForm",
			"click #dataWrongButton"   	: "submitConfirmNoForm"
		},
		
		submitEntryForm: function() {
			// handle the multi-part file upload
//			var data = new FormData();
//			jQuery.each($('input[type="file"]')[0].files, function(i, file) {
//			    data.append('file_'+i, file);
//			});
			
			// use FormData for the file upload to work
			var data = new FormData($('#entryForm'));
			
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
			// ajax call to submit the given form and then render the results in the content area
			var contentArea = this.$el;
			$.post(
					this.registryUrl,
					$("#" + formId).serialize(),
					function(data, textStatus, jqXHR) {
						contentArea.html(data);
					}
			);
			
		}
				
	});
	return RegistryView;		
});
