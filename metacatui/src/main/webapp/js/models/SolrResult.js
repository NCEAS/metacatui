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
			provSources: [],
			provDerivations: [],
			//Provenance index fields
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
			if((typeof this.get("prov_instanceOfClass") != "undefined") && (this.get("prov_instanceOfClass").indexOf("#Program") > -1)) return "program";
			else return "data";
		},

		/**** Provenance-related functions ****/
		/*
		 * Returns true if this provenance field points to a source of this data or metadata object 
		 */
		isSourceField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!_.contains(searchModel.getProvFields(), field)) return false;			
			
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
			if(!!_.contains(searchModel.getProvFields(), field)) return false;
			
			if(field == "prov_usedByExecution" ||
			   field == "prov_usedByProgram")
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
				
			var fieldNames = searchModel.getProvFields(),
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
			
			_.each(searchModel.getProvFields(), function(provField, i){
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
		
			_.each(searchModel.getProvFields(), function(provField, i){
				if(model.isDerivationField(provField))
					derivations.push(model.get(provField));
			});	
			
			return _.uniq(_.flatten(derivations));
		}
		/****************************/

	});
	return SolrResult;
});
