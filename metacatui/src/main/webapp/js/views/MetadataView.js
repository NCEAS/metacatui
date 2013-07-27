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
			
		},
				
		// Render the main metadata view
		render: function () {

			console.log('Rendering the Metadata view');
			appModel.set('headerType', 'default');
			
			// get the pid to render
			var pid = appModel.get('pid');
			
			// load the document view from the server
			var endpoint = appModel.get('viewServiceUrl') + pid + ' #Metadata';
			console.log('calling view endpoint: ' + endpoint);

			var viewRef = this;
			this.$el.load(endpoint,
					function(response, status, xhr) {
				
						if (status == "error") {
							viewRef.showMessage(response);
						} else {
							viewRef.insertResourceMapLink(pid);
						}
						console.log('Loaded metadata, now fading in MetadataView');
						viewRef.$el.fadeIn('slow');
						
					});
			
			return this;
		},
		
		// this will insert the ORE package download link if available
		insertResourceMapLink: function(pid) {
			var resourceMapId = null;
			// look up the resourceMapId[s]
			var queryServiceUrl = appModel.get('queryServiceUrl');
			var packageServiceUrl = appModel.get('packageServiceUrl');

			var query = 'fl=id,resourceMap&wt=xml&q=formatType:METADATA+-obsoletedBy:*+resourceMap:*+id:' + pid;
			$.get(
					queryServiceUrl + query,
					function(data, textStatus, xhr) {
						
						// the response should have a resourceMap element
						resourceMapId = $(data).find("arr[name='resourceMap'] str").text();
						console.log('resourceMapId: ' + resourceMapId);
						
						if (resourceMapId) {
														
							$("#downloadPackage").html(
								'<a class="btn" href="' 
									+ packageServiceUrl + resourceMapId + '">' 
									+ 'Download Package <i class="icon-arrow-down"></i>'
								+ '</a>'
							);
						}
						
					}
				);
				
		},
		
		showMessage: function(msg) {
			this.$el.html('<section id="Notification"><div class="alert"><h4>Oops!</h4>' + msg + '</div></section>');
		},
		
		onClose: function () {			
			console.log('Closing the metadata view');
		}				
	});
	return MetadataView;		
});
