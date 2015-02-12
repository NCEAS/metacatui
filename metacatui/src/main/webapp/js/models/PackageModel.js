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
			members: [],
			memberIds: [],
			sources: [],
			derivations: [],
			provenanceFlag: null,
			sourcePackages: [],
			derivationPackages: []
		},
		
		complete: false,
		
		pending: false,
		
		type: "Package",
		
		initialize: function(options){
			//When the members attribute of this model is set, it is assumed to be complete. 
			//Since this attribute is an array, do not iteratively push new items to it or this will be triggered each time.
			this.on("change:members", this.flagComplete);	
		},
		
		/* Retrieve the id of the resource map/package that this id belongs to */
		getMembersByMemberID: function(id){
			this.pending = true;
			
			if((typeof id === "undefined") || !id) var id = this.memberId;
			
			var model = this;
			
			//Get the id of the resource map for this member
			var provFlList = searchModel.getProvFlList();
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,' + provFlList +
						'&wt=json' +
						'&rows=1' +
						'&q=id:%22' + encodeURIComponent(id) + '%22';

			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr) {
				//There should be only one response since we searched by id
				if(typeof data.response.docs !== "undefined"){
					var doc = data.response.docs[0];
				
					//If there is no resource map, then this is the only document to in this package
					if((typeof doc.resourceMap === "undefined") || !doc.resourceMap){
						model.set('id', null);
						model.set('memberIds', new Array(doc.id));
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
			this.pending = true;
			
			var model   = this,
				members = [],
				pids    = []; //Keep track of each object pid
			
			//*** Find all the files that are a part of this resource map and the resource map itself
			var provFlList = searchModel.getProvFlList();
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,' + provFlList +
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
				
				model.set('memberIds', _.uniq(pids));
				model.set('members', members);
			}, "json");
			
			return this;
		},
		
		/*
		 * Will get the sources and derivations of each member of this dataset and group them into packages  
		 */
		getProvTrace: function(){
			var model = this;
			
			//See if there are any prov fields in our index before continuing
			if(!searchModel.getProvFields()) return this;
			
			var sources 		   = new Array(),
				derivations 	   = new Array(),
				sourcePackages	   = new Array(),
				derivationPackages = new Array();
			
			//Make arrays of unique IDs of objects that are sources or derivations of this package.
			_.each(this.get("members"), function(member, i){
				if(member.hasProvTrace()){
					sources 	= _.union(sources, member.getSources());					
					derivations = _.union(derivations, member.getDerivations());
				}
			});
			//Compact our list of ids that are in the prov trace by combining the sources and derivations and removing ids of members of this package
			var externalProvEntities = _.difference(_.union(sources, derivations), this.get("memberIds"));
			
			//If there are no sources or derivations, then we do not need to find resource map ids for anything
			if(!externalProvEntities.length) return this;
			else{
				//Create a query where we retrieve the ID of the resource map of each source and derivation
				var idQuery = searchModel.getGroupedQuery("id", externalProvEntities, "OR");
				
				//TODO: Also create a query where we retrieve the metadata for this object (so we can know its title, authors, etc.)
				//TODO: Will look like "OR (documents:id OR id OR id)"
				var metadataQuery = searchModel.getGroupedQuery("documents", externalProvEntities, "OR");
			}
			
			//TODO: Once inverses are indexed, this may not be necessary
			//Create a query to find all the other objects in the index that have a provenance field pointing to a member of this package
		/*	var provQuery 	 = "",
				memberIds 	 = this.get("memberIds");
			_.each(searchModel.getProvFields(), function(fieldName, i, list){
				provQuery += searchModel.getGroupedQuery(fieldName, memberIds, "OR");
				if(i < list.length-1) provQuery += "%20OR%20";
			});
		*/
			
			//Make a comma-separated list of the provenance field names 
			var provFieldList = "";
			_.each(searchModel.getProvFields(), function(fieldName, i, list){
				provFieldList += fieldName;
				if(i < list.length-1) provFieldList += ",";
			});
			
			//Combine the two queries with an OR operator
			if(idQuery.length && metadataQuery.length) var combinedQuery = idQuery + "%20OR%20" + metadataQuery;
			else return this;
			
			//the full and final query in Solr syntax
			var query = "q=" + combinedQuery + "%20-obsoletedBy:*" + "&fl=id,resourceMap,documents,isDocumentedBy,formatType,formatId" + provFieldList + "&wt=json";
			
			//Start an array to hold the packages in the prov trace
			var sourcePackages   = new Array(),
				derPackages      = new Array();
			
			//Send the query to the query service
			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr){				
				
				//Separate the results into derivations and sources and group by their package.
				_.each(data.response.docs, function(doc, i){
					if(typeof doc.resourceMap === "undefined") return;
					else if(doc.resourceMap){						
						var id = doc.id,
							mapId = doc.resourceMap;
						
						//Is this a source object?
						if(_.contains(sources, id)){
							//Have we encountered this source package yet?
							if(!sourcePackages[mapId]){
								//Now make a new package model for it
								var p = new PackageModel({
									id: mapId,
									members: new Array(new SolrResult(doc))
								});
								//Add to the array of source packages
								sourcePackages[mapId] = p;	
							}
							//If so, add this member to its package model
							else{
								var currentMembers = sourcePackages[mapId].get("members");
								sourcePackages[mapId].set("members", currentMembers.push(new SolrResult(doc)));
							}
						}
						
						//Is this a derivation object?
						if(_.contains(derivations, id)){
							//Have we encountered this derivation package yet?
							if(!derPackages[mapId]){
								//Now make a new package model for it
								var p = new PackageModel({
									id: mapId,
									members: new Array(new SolrResult(doc))
								});
								//Add to the array of source packages
								derPackages[mapId] = p;	
							}
							//If so, add this member to its package model
							else{
								var currentMembers = derPackages[mapId].get("members");
								derPackages[mapId].set("members", currentMembers.push(new SolrResult(doc)));
							}
						}
					}
				});
				
				//We now have an array of source packages and an array of derivation packages.
				model.set("sourcePackages", sourcePackages);
				model.set("derivationPackages", derPackages);
				
				//Flag that the provenance trace is complete
				model.set("provenanceFlag", "complete");
				
			}, "json");
			
			return this;
		},
		
		/* Returns the SolrResult that represents the metadata doc */
		getMetadata: function(){
			var members = this.get("members");
			for(var i=0; i<members.length; i++){
				if(members[i].get("formatType") == "METADATA") return members[i];
			}
			
			//If there are no metadata objects in this package, make sure we have searched for them already
			if(!this.complete && !this.pending) this.getMembers();
			
			return false;
		},
		
		flagComplete: function(){
			this.complete = true;
			this.pending = false;
			this.trigger("complete");
		}
		
	});
	return PackageModel;
});
