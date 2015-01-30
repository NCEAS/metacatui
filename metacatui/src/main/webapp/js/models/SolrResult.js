/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// SolrResult Model
	// ------------------
	var SolrResult = Backbone.Model.extend({
		// This model contains all of the attributes found in the SOLR 'docs' field inside of the SOLR response element
		defaults: {
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
			memberNode: null,
			instanceOfClass: null,
			//Provenance index fields
			generatedByDataONEDN: null,
			generatedByExecution: null,
			generatedByFoafName: null,
			generatedByOrcid: null,
			generatedByProgram: null,
			generatedByUser: null,
			hasDerivation: null,
			used: null,
			usedByDataONEDN: null,
			usedByExecution: null,
			usedByFoafName: null,
			usedByOrcid: null,
			usedByProgram: null,
			usedByUser: null,
			wasDerivedFrom: null,
			wasExecutedBy: null
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
			                "image/tiff",
			                "image/bmp"];
			//The list of formatIds that are images
			var pdfIds = ["application/pdf"];
			
			if(this.get("formatType") == "METADATA") return "metadata";
			if(_.contains(imageIds, this.get("id"))) return "image";
			if(_.contains(pdfIds, this.get("id")))   return "PDF";
			else return "data";
		},
		
		/**** Provenance-related functions ****/
		// Returns which fields are provenance-related in this model
		// Useful for querying the index and such
		getProvFields: function(){
			return new Array(			
				"generatedByDataONEDN",
				"generatedByExecution",
				"generatedByFoafName",
				"generatedByOrcid",
				"generatedByProgram",
				"generatedByUser",
				"usedByDataONEDN",
				"usedByExecution",
				"usedByFoafName",
				"usedByOrcid",
				"usedByProgram",
				"usedByUser",
				"wasDerivedFrom",
				"wasExecutedBy");		
		},

		/*
		 * Returns true if this provenance field points to a source of this data or metadata object 
		 */
		isSourceField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!_.contains(this.getProvFields(), field)) return false;			
			
			if(field.indexOf("generatedBy") > -1)    return true;
			if(field.indexOf("wasDerivedFrom") > -1) return true;
			if(field.indexOf("wasExecutedBy") > -1)  return true;

			return false;
		},
		
		/*
		 * Returns true if this provenance field points to a derivation of this data or metadata object 		 
		 */		
		isDerivationField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!!_.contains(this.getProvFields(), field)) return false;
			
			if(field.indexOf("usedBy") > -1) return true;
			
			return false;
		},
		
		/*
		 * Returns true if this SolrResult has a provenance trace (i.e. has either sources or derivations)
		 */
		hasProvTrace: function(){
			var model = this,
				fieldNames = this.getProvFields();
			
			for(var i=0; i<= fieldNames.length; i++){
				if(model.has(fieldNames[i])) return true;
			}
			
			return false;
		},
		
		/* 
		 * Returns an array of all the IDs of objects that are sources of this object 
		 */
		getSources: function(){
			var sources = new Array(),
				model = this;
			
			_.each(this.getProvFields(), function(provField, i){
				if(model.isSourceField(provField))
					sources.push(model.get(provField));
			});
			
			return sources;
		},
		
		/* 
		 * Returns an array of all the IDs of objects that are derivations of this object 
		 */		
		getDerivations: function(){
			var derivations = new Array(),
				model = this;
		
			_.each(this.getProvFields(), function(provField, i){
				if(model.isDerivationField(provField))
					derivations.push(model.get(provField));
			});	
			
			return derivations;
		}
		/****************************/

	});
	return SolrResult;
});
