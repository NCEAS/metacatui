/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrResult'], 				
	function($, _, Backbone, SolrResult) {
	'use strict';

	// Package Model 
	// ------------------
	var PackageModel = Backbone.Model.extend({
		// This model contains information about a package/resource map
		defaults: {
			id: null,
			indexDoc: null, //A SolrResult object representation of the resource map 
			size: 0, //The number of items aggregated in this package
			members: []
		},
		
		getPackage: function(){
			var model = this;
			
			//*** Find all the files that are a part of this resource map and the resource map itself
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,wasDerivedFrom,wasGeneratedBy,used,wasInformedBy' +
						'&wt=json' +
						'&rows=100' +
						'&q=-obsoletedBy:*+%28resourceMap:' + encodeURIComponent(this.id) + '%20OR%20id:"' + encodeURIComponent(this.id) + '"%29';
			
			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				var pids   = [], //Keep track of each object pid
					images = [], //Keep track of each data object that is an image
					pdfs   = [], //Keep track of each data object that is a PDF 
					other = []; //Keep track of all non-metadata and non-resource map objects
				
				//Separate the resource maps from the data/metadata objects
				_.each(data.response.docs, function(doc){
					if(doc.formatType == "RESOURCE"){											
						maps.push(doc);
						model.indexDoc = doc;
					}
					else{
						objects.push(doc);
						pids.push(doc.id);
						
						model.members.push(new SolrResult(doc));
						
						//Keep track of each data objects so we can display them later
						//if(view.isImage(doc)) images.push(doc);
						//else if(view.isPDF(doc)) pdfs.push(doc);
						//else if(doc.formatType != "METADATA") other.push(doc);
					}
				});
			});
			
			return this;
		}
		
	});
	return PackageModel;
});