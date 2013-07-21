/*global define */
define(['jquery', 'underscore', 'backbone', 'registry'], 				
	function($, _, Backbone, Registry) {
	'use strict';
	
	// Build the main header view of the application
	var RegistryView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		baseUrl: window.location.origin,
		
		registryUrl: this.baseUrl + "/knb/cgi-bin/register-dataset.cgi",

		initialize: function () {
			
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			console.log('Calling the registry to display');
			var fragment = "article";
			var registryQueryString =  "?cfg=metacatui";
			console.log('Calling the registry URL: ' + registryUrl);
			//this.$el.load(registryUrl + " " + fragment);
			// just load it all so all the js can run in what gets loaded
			this.$el.load(registryUrl + registryQueryString);
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the registry view');
		},
		
		submitForm: function(formId) {
			// ajax call to submit the given form and then render the results in the content area
			$.post(
					this.registryUrl,
					$("#" + formId).serialize(),
					function(data, textStatus, jqXHR) {
						this.$el.html(data);
					},
					'html'
			);
			
		}
				
	});
	return RegistryView;		
});
