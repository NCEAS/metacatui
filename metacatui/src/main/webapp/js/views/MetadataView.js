/*global define */
define(['jquery',
		'underscore', 
		'backbone'
		], 				
	function($, _, Backbone) {
	'use strict';
	
	var MetadataView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		// Delegated events for creating new items, and clearing completed ones.
		events: {

		},
		
		initialize: function () {
			this.$baseurl = window.location.origin;
			this.$view_service = '/knb/d1/mn/v1/views/metacatui/';
			this.$package_service = this.$baseurl + '/knb/d1/mn/v1/package/';
		},
				
		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering 
		// and event handling to sub views
		render: function () {

			console.log('Rendering the Metadata view');
			appModel.set('headerType', 'default');
			
			// get the pid to render
			var pid = appModel.get('pid');
			
			// put the container on the page
			// Get the view of the document from the server and load it
			//var endpoint = '/knb/d1/mn/v1/views/metacatui/' + pid + ' #Metadata';
			var endpoint = this.$view_service + pid + ' #Metadata';
			var viewRef = this;
			this.$el.load(endpoint,
					function() {
						viewRef.$el.fadeIn('slow');
					});
			
			return this;
		},
		
		onClose: function () {			
			console.log('Closing the metadata view');
		}				
	});
	return MetadataView;		
});
