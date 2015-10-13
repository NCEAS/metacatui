/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrResult'], 				
	function($, _, Backbone, SolrResult) {
	'use strict';

	// Package Model 
	// ------------------
	var PackageModel = Backbone.Model.extend({
		// This model contains information about a package/resource map
		defaults: function(){
			return {
				id: null, //The id of the resource map/package itself
				url: null, //the URL to retrieve this package
				memberId: null, //An id of a member of the data package
				indexDoc: null, //A SolrResult object representation of the resource map 
				size: 0, //The number of items aggregated in this package
				formattedSize: "",
				formatId: null,
				obsoletedBy: null,
				obsoletes: null,
				read_count_i: null,
				members: [],
				memberIds: [],
				sources: [],
				derivations: [],
				provenanceFlag: null,
				sourcePackages: [],
				derivationPackages: [],
				sourceDocs: [],
				derivationDocs: [],
				relatedModels: [], //A condensed list of all SolrResult models related to this package in some way
				parentPackage: null
			}
		},
		
		complete: false,
		
		pending: false,
		
		type: "Package",
		
		initialize: function(options){
		},
		
		/* Retrieve the id of the resource map/package that this id belongs to */
		getMembersByMemberID: function(id){
			this.pending = true;
			
			if((typeof id === "undefined") || !id) var id = this.memberId;
			
			var model = this;
			
			//Get the id of the resource map for this member
			var provFlList = appSearchModel.getProvFlList() + "prov_instanceOfClass,";
			var query = 'fl=resourceMap,read_count_i,obsoletedBy,size,formatType,formatId,id,datasource,title,origin,pubDate,dateUploaded,' + provFlList +
						'&rows=1' +
						'&q=id:%22' + encodeURIComponent(id) + '%22' +
						'&wt=json' +
						"&json.wrf=?";
						

			$.ajax({
				url: appModel.get("queryServiceUrl") + query,
				jsonp: "json.wrf",
				dataType: "jsonp",
				success: function(data, textStatus, xhr) {
					//There should be only one response since we searched by id
					if(typeof data.response.docs !== "undefined"){
						var doc = data.response.docs[0];
					
						//Is this document a resource map itself?
						if(doc.formatId == "http://www.openarchives.org/ore/terms"){
							model.set("id", doc.id); //this is the package model ID
							model.set("members", new Array()); //Reset the member list
							model.getMembers();
						}
						//If there is no resource map, then this is the only document to in this package
						else if((typeof doc.resourceMap === "undefined") || !doc.resourceMap){
							model.set('id', null);
							model.set('memberIds', new Array(doc.id));
							model.set('members', [new SolrResult(doc)]);
							model.trigger("change:members");
							model.flagComplete();
						}
						else{
							model.set('id', doc.resourceMap[0]);
							model.getMembers();
						}
					}
				}
			});
		},
		
		/* Get all the members of a resource map/package based on the id attribute of this model. 
		 * Create a SolrResult model for each member and save it in the members[] attribute of this model. */
		getMembers: function(){			
			this.pending = true;
			
			var model   = this,
				members = [],
				pids    = []; //Keep track of each object pid
			
			//*** Find all the files that are a part of this resource map and the resource map itself
			var provFlList = appSearchModel.getProvFlList();
			var query = 'fl=resourceMap,read_count_i,obsoletes,obsoletedBy,size,formatType,formatId,id,datasource,rightsHolder,dateUploaded,title,origin,prov_instanceOfClass,isDocumentedBy,' + provFlList +
						'&rows=100' +
						'&q=%28resourceMap:%22' + encodeURIComponent(this.id) + '%22%20OR%20id:%22' + encodeURIComponent(this.id) + '%22%29' +
						'&wt=json' +
						"&json.wrf=?";
			
			$.ajax({
				url: appModel.get("queryServiceUrl") + query, 
				jsonp: "json.wrf",
				dataType: "jsonp",
				success: function(data, textStatus, xhr) {
				
					//Separate the resource maps from the data/metadata objects
					_.each(data.response.docs, function(doc){
						if(doc.id == model.get("id")){											
							model.indexDoc = doc;
							model.set(doc);
						}
						else{
							pids.push(doc.id);
							
							if(doc.formatType == "RESOURCE"){
								var newPckg = new PackageModel(doc);
								newPckg.set("parentPackage", model);
								members.push(newPckg);
							}
							else
								members.push(new SolrResult(doc));
						}
					});
					
					model.set('memberIds', _.uniq(pids));
					model.set('members', members);
					
					if(model.getNestedPackages().length > 0)
						model.createNestedPackages();
					else
						model.flagComplete();
				}
			});				
			
			return this;
		},
		
		//Create the URL string that is used to download this package
		getURL: function(){
			var url = null;
			
			//If we haven't set a packageServiceURL upon app initialization and we are querying a CN, then the packageServiceURL is dependent on the MN this package is from
			if(!appModel.get("packageServiceUrl") && (appModel.get("d1Service").toLowerCase().indexOf("cn/") > -1) && nodeModel.get("members").length){
				var source = this.get("datasource"),
					node   = _.find(nodeModel.get("members"), {identifier: source});
				
				//If this node has MNRead v2 services...
				if(node && node.readv2)
					url = node.baseURL + "/v2/packages/application%2Fbagit-097/" + this.get("id");			
			}
			else if(appModel.get("packageServiceUrl"))
				url = appModel.get("packageServiceUrl") + this.get("id");
			
			this.set("url", url);
			return url;
		},
		
		createNestedPackages: function(){
			var parentPackage = this,
				nestedPackages = this.getNestedPackages(),
				numNestedPackages = nestedPackages.length,
				numComplete = 0;
			
			_.each(nestedPackages, function(nestedPackage, i, nestedPackages){
				//Only look one-level deep at all times to avoid going down a rabbit hole
				if(nestedPackage.parentPackage && nestedPackage.parentPackage.parentPackage) return;
				
				//Flag the parent model as complete when all the nested package info is ready
				nestedPackage.on("complete", function(){ 
					numComplete++;
					
					//This is the last package in this package - finish up details and flag as complete
					if(numNestedPackages == numComplete){
						var sorted = _.sortBy(parentPackage.get("members"), function(p){ return p.get("id") });
						parentPackage.set("members", sorted);
						parentPackage.flagComplete();
					}					
				});
				
				//Get the members of this nested package
				nestedPackage.getMembers();
			});			
		},
		
		getNestedPackages: function(){
			return _.where(this.get("members"), {type: "Package"});
		},
		
		getMemberNames: function(){
			var metadata = this.getMetadata();
			if(!metadata) return false;
			
			//Load the rendered metadata from the view service
			var viewService = appModel.get("viewServiceUrl") + metadata.get("id");
			$.get(viewService, function(data, response, xhr){
				if(solrResult.get("formatType") == "METADATA") 
					entityName = solrResult.get("title");
				else{
					var container = viewRef.findEntityDetailsContainer(solrResult.get("id"));
					if(container && container.length > 0){
						var entityName = $(container).find(".entityName").attr("data-entity-name");
						if((typeof entityName === "undefined") || (!entityName)){
							entityName = $(container).find(".control-label:contains('Entity Name') + .controls-well").text();
							if((typeof entityName === "undefined") || (!entityName)) 
								entityName = null;
						}
					}
					else
						entityName = null;
	
				}
			});
		},
		
		/*
		 * Will get the sources and derivations of each member of this dataset and group them into packages  
		 */
		getProvTrace: function(){
			var model = this;
			
			//See if there are any prov fields in our index before continuing
			if(!appSearchModel.getProvFields()) return this;
			
			var sources 		   = new Array(),
				derivations 	   = new Array();
			
			//Make arrays of unique IDs of objects that are sources or derivations of this package.
			_.each(this.get("members"), function(member, i){
				if(member.type == "Package") return;
				
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
			if(!externalProvEntities.length){
				//Save this prov trace on a package-member/document/object level.
				this.setMemberProvTrace();
				
				//Flag that the provenance trace is complete
				this.set("provenanceFlag", "complete");
				
				return this;
			}
			else{
				//Create a query where we retrieve the ID of the resource map of each source and derivation
				var idQuery = appSearchModel.getGroupedQuery("id", externalProvEntities, "OR");
				
				//TODO: Also create a query where we retrieve the metadata for this object (so we can know its title, authors, etc.)
				//TODO: Will look like "OR (documents:id OR id OR id)"
				var metadataQuery = appSearchModel.getGroupedQuery("documents", externalProvEntities, "OR");
			}
			
			//TODO: Find the products of programs/executions
		
			
			//Make a comma-separated list of the provenance field names 
			var provFieldList = "";
			_.each(appSearchModel.getProvFields(), function(fieldName, i, list){
				provFieldList += fieldName;
				if(i < list.length-1) provFieldList += ",";
			});
			
			//Combine the two queries with an OR operator
			if(idQuery.length && metadataQuery.length) var combinedQuery = idQuery + "%20OR%20" + metadataQuery;
			else return this;
			
			//the full and final query in Solr syntax
			var query = "q=" + combinedQuery + 
						"&fl=id,resourceMap,documents,isDocumentedBy,formatType,formatId,dateUploaded,rightsHolder,datasource,prov_instanceOfClass," + 
						provFieldList + 
						"&rows=100&wt=json&json.wrf=?";
			
			//Send the query to the query service
			$.ajax({
				url: appModel.get("queryServiceUrl") + query, 
				jsonp: "json.wrf",
				dataType: "jsonp",
				success: function(data, textStatus, xhr){	
								
					//Do any of our docs have multiple resource maps?
					var hasMultipleMaps = _.filter(data.response.docs, function(doc){ 
						return((typeof doc.resourceMap !== "undefined") && (doc.resourceMap.length > 1))
						});
					//If so, we want to find the latest version of each resource map and only represent that one in the Prov Chart
					if(typeof hasMultipleMaps !== "undefined"){
						var allMapIDs = _.uniq(_.flatten(_.pluck(hasMultipleMaps, "resourceMap")));
						if(allMapIDs.length){
							
							var query = "q=+-obsoletedBy:*+" + appSearchModel.getGroupedQuery("id", allMapIDs, "OR") + 
										"&fl=obsoletes,id" +
										"&wt=json&json.wrf=?";
							$.ajax({
								url: appModel.get("queryServiceUrl") + query, 
								jsonp: "json.wrf",
								dataType: "jsonp",
								success: function(mapData, textStatus, xhr){	
								
									//Create a list of resource maps that are not obsoleted by any other resource map retrieved
									var resourceMaps = mapData.response.docs;
									
									model.obsoletedResourceMaps = _.pluck(resourceMaps, "obsoletes");							
									model.latestResourceMaps    = _.difference(resourceMaps, model.obsoletedResourceMaps);
									
									model.sortProvTrace(data.response.docs);
								}
							});	
						}
						else
							model.sortProvTrace(data.response.docs);
					}
					else
						model.sortProvTrace(data.response.docs);
				
			}
		});
			
			return this;
		},
		
		sortProvTrace: function(docs){
			var model = this;
			
			//Start an array to hold the packages in the prov trace
			var sourcePackages   = new Array(),
				derPackages      = new Array(),
				sourceDocs		 = new Array(),
				derDocs	 		 = new Array(),
				sourceIDs        = this.get("sources"),
				derivationIDs    = this.get("derivations");
			
			//Separate the results into derivations and sources and group by their resource map.
			_.each(docs, function(doc, i){
				
				var docModel = new SolrResult(doc),
				      mapIds = docModel.get("resourceMap");

				
				if(((typeof mapIds === "undefined") || !mapIds) && (docModel.get("formatType") == "DATA") && (typeof docModel.get("isDocumentedBy") === "undefined")){
					//If this object is not in a resource map and does not have metadata, it is a "naked" data doc, so save it by itself
					if(_.contains(sourceIDs, doc.id))
						sourceDocs.push(docModel);
					if(_.contains(derivationIDs, doc.id))
						derDocs.push(docModel);
				}
				else if(((typeof mapIds === "undefined") || !mapIds) && (docModel.get("formatType") == "DATA") && docModel.get("isDocumentedBy")){
					//If this data doc does not have a resource map but has a metadata doc that documents it, create a blank package model and save it
					var p = new PackageModel({
						members: new Array(docModel)
					});
					//Add this package model to the sources and/or derivations packages list
					if(_.contains(sourceIDs, docModel.get("id")))
						sourcePackages[docModel.get("id")] = p;
					if(_.contains(derivationIDs, docModel.get("id")))
						derPackages[docModel.get("id")] = p;
				}
				else if(mapIds.length){						
					//If this doc has a resource map, create a package model and SolrResult model and store it
					var id     = docModel.get("id");

					//Some of these objects may have multiple resource maps
					_.each(mapIds, function(mapId, i, list){	
						
						if(!_.contains(model.obsoletedResourceMaps, mapId)){
							var documentsSource, documentsDerivation;
							if(docModel.get("formatType") == "METADATA"){
								if(_.intersection(docModel.get("documents"), sourceIDs).length)     documentsSource = true; 
								if(_.intersection(docModel.get("documents"), derivationIDs).length) documentsDerivation = true;
							}
							
							//Is this a source object or a metadata doc of a source object?
							if(_.contains(sourceIDs, id) || documentsSource){
								//Have we encountered this source package yet?
								if(!sourcePackages[mapId] && (mapId != model.get("id"))){
									//Now make a new package model for it
									var p = new PackageModel({
										id: mapId,
										members: new Array(docModel)
									});
									//Add to the array of source packages
									sourcePackages[mapId] = p;	
								}
								//If so, add this member to its package model
								else if(mapId != model.get("id")){
									var memberList = sourcePackages[mapId].get("members");
									memberList.push(docModel);
									sourcePackages[mapId].set("members", memberList);
								}
							}
							
							//Is this a derivation object or a metadata doc of a derivation object?
							if(_.contains(derivationIDs, id) || documentsDerivation){
								//Have we encountered this derivation package yet?
								if(!derPackages[mapId] && (mapId != model.get("id"))){
									//Now make a new package model for it
									var p = new PackageModel({
										id: mapId,
										members: new Array(docModel)
									});
									//Add to the array of source packages
									derPackages[mapId] = p;	
								}
								//If so, add this member to its package model
								else if(mapId != model.get("id")){
									var memberList = derPackages[mapId].get("members");
									memberList.push(docModel);
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
			var model = this,
				relatedModels = this.get("relatedModels"),
				relatedModelIDs = new Array();

			//Now for each doc, we want to find which member it is related to
			_.each(this.get("members"), function(member, i, members){
				if(member.type == "Package") return;
				
				//Get the sources and derivations of this member
				var memberSourceIDs = member.getSources();
				var memberDerIDs    = member.getDerivations();
				
				//Look through each source package, derivation package, source doc, and derivation doc.
				_.each(model.get("sourcePackages"), function(pkg, i){
					_.each(pkg.get("members"), function(sourcePkgMember, i){
						//Is this package member a direct source of this package member?
						if(_.contains(memberSourceIDs, sourcePkgMember.get("id")))
							//Save this source package member as a source of this member
							member.set("provSources", _.union(member.get("provSources"), [sourcePkgMember]));
						
						//Save this in the list of related models
						if(!_.contains(relatedModelIDs, sourcePkgMember.get("id"))){
							relatedModels.push(sourcePkgMember);
							relatedModelIDs.push(sourcePkgMember.get("id"));
						}
					});
				});
				_.each(model.get("derivationPackages"), function(pkg, i){
					_.each(pkg.get("members"), function(derPkgMember, i){
						//Is this package member a direct source of this package member?
						if(_.contains(memberDerIDs, derPkgMember.get("id")))
							//Save this derivation package member as a derivation of this member
							member.set("provDerivations", _.union(member.get("provDerivations"), [derPkgMember]));	
						
						//Save this in the list of related models
						if(!_.contains(relatedModelIDs, derPkgMember.get("id"))){
							relatedModels.push(derPkgMember);
							relatedModelIDs.push(derPkgMember.get("id"));
						}
					});
				});
				_.each(model.get("sourceDocs"), function(doc, i){
					//Is this package member a direct source of this package member?
					if(_.contains(memberSourceIDs, doc.get("id")))
						//Save this source package member as a source of this member
						member.set("provSources", _.union(member.get("provSources"), [doc]));
					
					//Save this in the list of related models
					if(!_.contains(relatedModelIDs, doc.get("id"))){
						relatedModels.push(doc);
						relatedModelIDs.push(doc.get("id"));
					}
				});
				_.each(model.get("derivationDocs"), function(doc, i){
					//Is this package member a direct derivation of this package member?
					if(_.contains(memberDerIDs, doc.get("id")))
						//Save this derivation package member as a derivation of this member
						member.set("provDerivations", _.union(member.get("provDerivations"), [doc]));
					
					//Save this in the list of related models
					if(!_.contains(relatedModelIDs, doc.get("id"))){
						relatedModels.push(doc);
						relatedModelIDs.push(doc.get("id"));
					}
				});
				_.each(members, function(doc, i){
					//Is this package member a direct derivation of this package member?
					if(_.contains(memberDerIDs, doc.get("id")))
						//Save this derivation package member as a derivation of this member
						member.set("provDerivations", _.union(member.get("provDerivations"), [doc]));
					//Is this package member a direct source of this package member?
					if(_.contains(memberSourceIDs, doc.get("id")))
						//Save this source package member as a source of this member
						member.set("provSources", _.union(member.get("provSources"), [doc]));
				});
				
				//Add this member to the list of related models
				if(!_.contains(relatedModelIDs, member.get("id"))){
					relatedModels.push(member);
					relatedModelIDs.push(member.get("id"));
				}

				//Clear out any duplicates
				member.set("provSources", _.uniq(member.get("provSources")));
				member.set("provDerivations", _.uniq(member.get("provDerivations")));
			});

			//Update the list of related models
			this.set("relatedModels", relatedModels);
			
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
		
		//Check authority of the Metadata SolrResult model instead
		checkAuthority: function(){
			return this.getMetadata().checkAuthority();
		},
		
		flagComplete: function(){
			this.complete = true;
			this.pending = false;
			this.trigger("complete", this);
		},
		
		/****************************/
		/**
		 * Convert number of bytes into human readable format
		 *
		 * @param integer bytes     Number of bytes to convert
		 * @param integer precision Number of digits after the decimal separator
		 * @return string
		 */
		bytesToSize: function(bytes, precision){  
		    var kilobyte = 1024;
		    var megabyte = kilobyte * 1024;
		    var gigabyte = megabyte * 1024;
		    var terabyte = gigabyte * 1024;
		    
		    if(typeof bytes === "undefined") var bytes = this.get("size");		    		    
		   
		    if ((bytes >= 0) && (bytes < kilobyte)) {
		        return bytes + ' B';
		 
		    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		        return (bytes / kilobyte).toFixed(precision) + ' KB';
		 
		    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		        return (bytes / megabyte).toFixed(precision) + ' MB';
		 
		    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		        return (bytes / gigabyte).toFixed(precision) + ' GB';
		 
		    } else if (bytes >= terabyte) {
		        return (bytes / terabyte).toFixed(precision) + ' TB';
		 
		    } else {
		        return bytes + ' B';
		    }
		}
		
	});
	return PackageModel;
});
