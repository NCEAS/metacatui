/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';
	
	// Build the main header view of the application
	var AboutView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		initialize: function () {
			
		},
				
		render: function () {
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			console.log('Calling the registry to display');
			var baseurl = window.location.origin;
			var fragment = "#container";
			var registryUrl = baseurl + "/knb/cgi-bin/register-dataset.cgi?cfg=metacatui";
			console.log('Calling the registry URL: ' + registryUrl);
			this.$el.load(registryUrl + " " + fragment);
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the registry view');
		}
				
	});
	return AboutView;		
});
