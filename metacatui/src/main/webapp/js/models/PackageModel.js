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
		
		initialize: function(options){
			this.on("change:id", this.getMembers, this);
		},
		
		/* Retrieve the id of the resource map/package that this id belongs to */
		getMembersByMemberID: function(id){
			var model = this;
			
			var query = 'fl=resourceMap' +
			'&wt=json' +
			'&rows=1' +
			'&q=-obsoletedBy:*+id:' + encodeURIComponent(id);

			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				var doc = data.response.docs[0];
				if(typeof doc != "undefined"){
					if(typeof doc.resourceMap == "undefined")
						model.set('id', null);
					else
						model.set('id', doc.resourceMap[0]);
				}
			});
		},
		
		getMembers: function(){
			var model = this,
				members = [],
				pids   = [], //Keep track of each object pid
				images = [], //Keep track of each data object that is an image
				pdfs   = [], //Keep track of each data object that is a PDF 
				other = []; //Keep track of all non-metadata and non-resource map objects
			
			//*** Find all the files that are a part of this resource map and the resource map itself
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,wasDerivedFrom,wasGeneratedBy,used,wasInformedBy' +
						'&wt=json' +
						'&rows=100' +
						'&q=-obsoletedBy:*+%28resourceMap:' + encodeURIComponent(this.id) + '%20OR%20id:"' + encodeURIComponent(this.id) + '"%29';
			
			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				
				//Separate the resource maps from the data/metadata objects
				_.each(data.response.docs, function(doc){
					if(doc.formatType == "RESOURCE"){											
						model.indexDoc = doc;
					}
					else{
						pids.push(doc.id);
						
						members.push(new SolrResult(doc));
						
						//Keep track of each data objects so we can display them later
						//if(view.isImage(doc)) images.push(doc);
						//else if(view.isPDF(doc)) pdfs.push(doc);
						//else if(doc.formatType != "METADATA") other.push(doc);
					}
				});
				
				model.set('members', members);
			});
			
			return this;
		}
		
	});
	return PackageModel;
});