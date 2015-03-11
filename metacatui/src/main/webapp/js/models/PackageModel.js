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
			derivationPackages: [],
			sourceDocs: [],
			derivationDocs: []
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
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,datasource,title,prov_instanceOfClass,' + provFlList +
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
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,datasource,title,prov_instanceOfClass,' + provFlList +
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
				derivations 	   = new Array();
			
			//Make arrays of unique IDs of objects that are sources or derivations of this package.
			_.each(this.get("members"), function(member, i){
				if(member.hasProvTrace()){
					sources 	= _.union(sources, member.getSources());					
					derivations = _.union(derivations, member.getDerivations());
				}
			});
			
			this.set("sources", sources);
			this.set("derivations", derivations);
			
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
			
			//TODO: Find the products of programs/executions
		
			
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
			var query = "q=" + combinedQuery + 
						"&fl=id,resourceMap,documents,isDocumentedBy,formatType,formatId,dateUploaded,rightsHolder,datasource,prov_instanceOfClass" + 
						provFieldList + 
						"&wt=json&rows=100";
			
			//Send the query to the query service
			$.get(appModel.get("queryServiceUrl") + query, function(data, textStatus, xhr){	
								
				//Do any of our docs have multiple resource maps?
				var hasMultipleMaps = _.filter(data.response.docs, function(doc){ 
					return((typeof doc.resourceMap !== "undefined") && (doc.resourceMap.length > 1))
					});
				//If so, we want to find the latest version of each resource map and only represent that one in the Prov Chart
				if(typeof hasMultipleMaps !== "undefined"){
					var allMapIDs = _.uniq(_.flatten(_.pluck(hasMultipleMaps, "resourceMap")));
					if(allMapIDs.length){
						
						var query = "q=+-obsoletedBy:*+" + searchModel.getGroupedQuery("id", allMapIDs, "OR") + 
									"&fl=obsoletes,id" +
									"&wt=json";
						$.get(appModel.get("queryServiceUrl") + query, function(mapData, textStatus, xhr){	
							
							//Create a list of resource maps that are not obsoleted by any other resource map retrieved
							var resourceMaps = mapData.response.docs;
							
							model.obsoletedResourceMaps = _.pluck(resourceMaps, "obsoletes");							
							model.latestResourceMaps    = _.difference(resourceMaps, model.obsoletedResourceMaps);
							
							model.sortProvTrace(data.response.docs);
						}, "json");	
					}	
				}
				else
					model.sortProvTrace(data.response.docs);
				
			}, "json");
			
			return this;
		},
		
		sortProvTrace: function(docs){
			var model = this;
			
			//Start an array to hold the packages in the prov trace
			var sourcePackages   = new Array(),
				derPackages      = new Array(),
				sourceDocs		 = new Array(),
				derDocs	 		 = new Array(),
				sources          = this.get("sources"),
				derivations      = this.get("derivations");
			
			//Separate the results into derivations and sources and group by their resource map.
			_.each(docs, function(doc, i){
				if((typeof doc.resourceMap === "undefined") && (doc.formatType == "DATA") && (typeof doc.isDocumentedBy === "undefined")){
					//If this object is not in a resource map and does not have metadata, it is a "naked" data doc, so save it by itself
					if(_.contains(sources, doc.id))
						sourceDocs.push(new SolrResult(doc));
					if(_.contains(derivations, doc.id))
						derDocs.push(new SolrResult(doc));
				}
				else if((typeof doc.resourceMap === "undefined") && (doc.formatType == "DATA") && doc.isDocumentedBy){
					//If this data doc has a resource map and has a metadata doc that documents it, create a blank package model and save it
					var p = new PackageModel({
						members: new Array(new SolrResult(doc))
					});
					//Add this package model to the sources and/or derivations packages list
					if(_.contains(sources, doc.id))
						sourcePackages[doc.id] = p;
					if(_.contains(derivations, doc.id))
						derPackages[doc.id] = p;
				}
				else if(doc.resourceMap){						
					//If this doc has a resource map, create a package model and SolrResult model and store it
					var id = doc.id,
						mapIds = doc.resourceMap;

					//Some of these objects may have multiple resource maps
					_.each(mapIds, function(mapId, i, list){	
						
						if(!_.contains(model.obsoletedResourceMaps, mapId)){
							var documentsSource, documentsDerivation;
							if(doc.formatType == "METADATA"){
								if(_.intersection(doc.documents, sources).length)     documentsSource = true; 
								if(_.intersection(doc.documents, derivations).length) documentsDerivation = true;
							}
							
							//Is this a source object?
							if(_.contains(sources, id) || documentsSource){
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
									var memberList = sourcePackages[mapId].get("members");
									memberList.push(new SolrResult(doc));
									sourcePackages[mapId].set("members", memberList);
								}
							}
							
							//Is this a derivation object?
							if(_.contains(derivations, id) || documentsDerivation){
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
									var memberList = derPackages[mapId].get("members");
									memberList.push(new SolrResult(doc));
									derPackages[mapId].set("members", memberList);
								}
							}	
						}
					});				
				}
			});
			
			//Transform our associative array (Object) of packages into an array
			var newArrays = new Array();
			_.each(new Array(sourcePackages, derPackages, sourceDocs, derDocs), function(provObject){
				var newArray = new Array(), key;
				for(key in provObject){
					newArray.push(provObject[key]);
				}					
				newArrays.push(newArray);
			});
			
			//We now have an array of source packages and an array of derivation packages.
			model.set("sourcePackages", newArrays[0]);
			model.set("derivationPackages", newArrays[1]);
			model.set("sourceDocs", newArrays[2]);
			model.set("derivationDocs", newArrays[3]);
			
			//Save this prov trace on a package-member/document/object level.
			model.setMemberProvTrace();
			
			//Flag that the provenance trace is complete
			model.set("provenanceFlag", "complete");
		},
		
		setMemberProvTrace: function(){
			var model = this;
			
			//Now for each doc, we want to find which member it is related to
			_.each(this.get("members"), function(member, i,members){
				//Get the sources and derivations of this member
				var memberSourceIDs = member.getSources();
				var memberDerIDs    = member.getDerivations();
				
				//Look through each source package, derivation package, source doc, and derivation doc.
				_.each(model.get("sourcePackages"), function(pkg, i){
					_.each(pkg.get("members"), function(sourcePkgMember, i){
						//Is this package member a direct source of this package member?
						if(_.contains(memberSourceIDs, sourcePkgMember.get("id")))
							//Save this source package member as a source of this member
							member.set("provSources", _.union(member.get("provSources"), sourcePkgMember));
					});
				});
				_.each(model.get("derivationPackages"), function(pkg, i){
					_.each(pkg.get("members"), function(derPkgMember, i){
						//Is this package member a direct source of this package member?
						if(_.contains(memberDerIDs, derPkgMember.get("id")))
							//Save this derivation package member as a derivation of this member
							member.set("provDerivations", _.union(member.get("provDerivations"), derPkgMember));								
					});
				});
				_.each(model.get("sourceDocs"), function(doc, i){
					//Is this package member a direct source of this package member?
					if(_.contains(memberSourceIDs, doc.get("id")))
						//Save this source package member as a source of this member
						member.set("provSources", _.union(member.get("provSources"), doc));
				});
				_.each(model.get("derivationDocs"), function(doc, i){
					//Is this package member a direct derivation of this package member?
					if(_.contains(memberSourceIDs, doc.get("id")))
						//Save this derivation package member as a derivation of this member
						member.set("provDerivations", _.union(member.get("provDerivations"), doc));
				});

				//Clear out any duplicates
				member.set("provSources", _.uniq(member.get("provSources")));
				member.set("provDerivations", _.uniq(member.get("provDerivations")));
			});
			
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
