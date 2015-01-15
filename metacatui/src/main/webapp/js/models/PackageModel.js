/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrResult'], 				
	function($, _, Backbone, SolrResult) {
	'use strict';

	// Package Model 
	// ------------------
	var PackageModel = Backbone.Model.extend({
		// This model contains information about a package/resource map
		defaults: {
			id: null, //The id of the resource map/package itself
			memberId: null, //An id of a member of the data package
			indexDoc: null, //A SolrResult object representation of the resource map 
			size: 0, //The number of items aggregated in this package
			formattedSize: "",
			members: []
		},
		
		complete: false,
		
		initialize: function(options){
			//When the members attribute of this model is set, it is assumed to be complete. 
			//Since this attribute is an array, do not iteratively push new items to it or this will be triggered each time.
			this.on("change:members", this.flagComplete);
		},
		
		/* Retrieve the id of the resource map/package that this id belongs to */
		getMembersByMemberID: function(id){
			if((typeof id === "undefined") || !id) var id = this.memberId;
			
			var model = this;
			
			//Get the id of the resource map for this member
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,wasDerivedFrom,wasGeneratedBy,used,wasInformedBy' +
						'&wt=json' +
						'&rows=1' +
						'&q=-obsoletedBy:*+id:%22' + encodeURIComponent(id) + '%22';

			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				//There should be only one response since we searched by id
				if(typeof data.response.docs !== "undefined"){
					var doc = data.response.docs[0];
				
					//If there is no resource map, then this is the only document to in this package
					if((typeof doc.resourceMap === "undefined") || !doc.resourceMap){
						model.set('id', null);
						model.set('members', [new SolrResult(doc)]);
					}
					else{
						model.set('id', doc.resourceMap[0]);
						model.getMembers();
					}
				}
			}, "json");
		},
		
		/* Get all the members of a resource map/package based on the id attribute of this model. 
		 * Create a SolrResult model for each member and save it in the members[] attribute of this model. */
		getMembers: function(){
			var model   = this,
				members = [],
				pids    = []; //Keep track of each object pid
			
			//*** Find all the files that are a part of this resource map and the resource map itself
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,wasDerivedFrom,wasGeneratedBy,used,wasInformedBy' +
						'&wt=json' +
						'&rows=100' +
						'&q=-obsoletedBy:*+%28resourceMap:%22' + encodeURIComponent(this.id) + '%22%20OR%20id:%22' + encodeURIComponent(this.id) + '%22%29';
			
			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				
				//Separate the resource maps from the data/metadata objects
				_.each(data.response.docs, function(doc){
					if(doc.formatType == "RESOURCE"){											
						model.indexDoc = doc;
					}
					else{
						pids.push(doc.id);
						
						members.push(new SolrResult(doc));
					}
				});
				
				model.set('members', members);
			}, "json");
			
			return this;
		},
		
		flagComplete: function(){
			this.complete = true;
			this.trigger("complete");
		}
		
	});
	return PackageModel;
});