/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// SolrResult Model
	// ------------------
	var SolrResult = Backbone.Model.extend({
		// This model contains all of the attributes found in the SOLR 'docs' field inside of the SOLR response element
		defaults: {
			abstract: null,
			entityName: null,
			origin: '',
			title: '',
			pubDate: '',
			id: '',
			resourceMap: null,
			downloads: null,
			citations: 0,
			selected: false,
			formatId: null,
			formatType: null,
			datasource: null,
			rightsHolder: null,
			size: 0,
			type: null,
			url: null,
			obsoletedBy: null,
			provSources: [],
			provDerivations: [],
			//Provenance index fields
			prov_generated: null,
			prov_generatedByDataONEDN: null,
			prov_generatedByExecution: null,
			prov_generatedByFoafName: null,
			prov_generatedByOrcid: null,
			prov_generatedByProgram: null,
			prov_generatedByUser: null,
 			prov_hasDerivations: null,
			prov_hasSources: null,
			prov_used: null,
			prov_usedByDataONEDN: null,
			prov_usedByExecution: null,
			prov_usedByFoafName: null,
			prov_usedByOrcid: null,
			prov_usedByProgram: null,
			prov_usedByUser: null,
			prov_wasDerivedFrom: null,
			prov_wasExecutedByExecution: null,
			prov_wasExecutedByUser: null,
			prov_wasGeneratedBy: null,
			prov_wasInformedBy: null
		},
		
		initialize: function(){
			this.setURL();
			this.set("type", this.getType());
		},
		
		type: "SolrResult",
		
		// Toggle the `selected` state of the result
		toggle: function () {
			this.selected = !this.get('selected');
		},
		
		//Returns a plain-english version of the formatType and formatId
		getType: function(){
			//The list of formatIds that are images
			var imageIds = ["image/gif",
			                "image/jp2",
			                "image/jpeg",
			                "image/png",
			                "image/svg xml",
			                "image/svg+xml",
			                "image/bmp"];
			//The list of formatIds that are images
			var pdfIds = ["application/pdf"];	
			
			//Determine the type via provONE
			var instanceOfClass = this.get("prov_instanceOfClass");
			if(typeof instanceOfClass !== "undefined"){
				var programClass = _.filter(instanceOfClass, function(className){
					return (className.indexOf("#Program") > -1);
				});
				if((typeof programClass !== "undefined") && programClass.length) 
					return "program";		
			}
			else{
				if(this.get("prov_generated") || this.get("prov_used"))
					return "program";					
			}
			
			//Determine the type via file format
			if(this.get("formatType") == "METADATA") return "metadata";
			if(_.contains(imageIds, this.get("formatId"))) return "image";
			if(_.contains(pdfIds, this.get("formatId")))   return "PDF";
						
			else return "data";
		},
		
		setURL: function(){			
			if(appModel.get("resolveServiceUrl"))
				this.set("url", appModel.get("resolveServiceUrl") + this.get("id"));
			else
				this.set("url", appModel.get("objectServiceUrl") + this.get("id"));		
		},
		
		// checks if the pid is already a DOI
		isDOI: function() {
			var DOI_PREFIXES = ["doi:10.", "http://dx.doi.org/10.", "http://doi.org/10."];
			for (var i=0; i < DOI_PREFIXES.length; i++) {
				if (this.get("id").toLowerCase().indexOf(DOI_PREFIXES[i].toLowerCase()) == 0)
					return true;
			}
			return false;
		},

		/* 
		 * Checks if the currently-logged-in user is authorized to change permissions on this doc 
		 */
		checkAuthority: function(){
			var authServiceUrl = appModel.get('authServiceUrl');
			if(!authServiceUrl) return false;
			
			var model = this;
			
			$.ajax({
				url: authServiceUrl + encodeURIComponent(this.get("id")) + "?action=changePermission",
				type: "GET",
				xhrFields: {
					withCredentials: true
				},
				success: function(data, textStatus, xhr) {
					model.set("isAuthorized", true);
					model.trigger("change:isAuthorized");
				},
				error: function(xhr, textStatus, errorThrown) {
					model.set("isAuthorized", false);
				}
			});
		},
		
		getInfo: function(){
			if(!this.get("id")) return false;
			
			var model = this;
			
			var fields = "id,resourceMap,formatType,formatId,isDocumentedBy,documents,title,origin,pubDate,dateUploaded,datasource,isAuthorized" 
				
			$.get(appModel.get("queryServiceUrl") + 'q=id:"' + this.get("id") + '"&fl='+fields+'&wt=json',
				  function(data, response, xhr){
					if(data.response.docs.length > 0)
						model.set(data.response.docs[0]);
					else
						model.trigger("404");
			});
		},
		
		
		/**** Provenance-related functions ****/
		/*
		 * Returns true if this provenance field points to a source of this data or metadata object 
		 */
		isSourceField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!_.contains(appSearchModel.getProvFields(), field)) return false;			
			
			if(field == "prov_generatedByExecution" ||
			   field == "prov_generatedByProgram"   ||
			   field == "prov_used" 		  		||
			   field == "prov_wasDerivedFrom" 		||
			   field == "prov_wasInformedBy") 
				return true;
			else
				return false;
		},
		
		/*
		 * Returns true if this provenance field points to a derivation of this data or metadata object 		 
		 */		
		isDerivationField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!_.contains(appSearchModel.getProvFields(), field)) return false;
			
			if(field == "prov_usedByExecution" ||
			   field == "prov_usedByProgram"   ||
			   field == "prov_generated")
				return true;
			else
				return false;			
		},
		
		/*
		 * Returns true if this SolrResult has a provenance trace (i.e. has either sources or derivations)
		 */
		hasProvTrace: function(){
			if(this.get("formatType") == "METADATA"){
				if(this.get("prov_hasSources") || this.get("prov_hasDerivations"))
					return true;
			}
				
			var fieldNames = appSearchModel.getProvFields(),
				currentField = "";
			
			for(var i=0; i<= fieldNames.length; i++){
				currentField = fieldNames[i];
				if(this.has(currentField)) return true;
			}
			
			return false;
		},
		
		/* 
		 * Returns an array of all the IDs of objects that are sources of this object 
		 */
		getSources: function(){
			var sources = new Array(),
				model = this;
			
			_.each(appSearchModel.getProvFields(), function(provField, i){
				if(model.isSourceField(provField) && model.has(provField))
					sources.push(model.get(provField));
			});
			
			return _.uniq(_.flatten(sources));
		},
		
		/* 
		 * Returns an array of all the IDs of objects that are derivations of this object 
		 */		
		getDerivations: function(){
			var derivations = new Array(),
				model = this;
		
			_.each(appSearchModel.getProvFields(), function(provField, i){
				if(model.isDerivationField(provField) && model.get(provField))
					derivations.push(model.get(provField));
			});	
			
			return _.uniq(_.flatten(derivations));
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
	return SolrResult;
});
