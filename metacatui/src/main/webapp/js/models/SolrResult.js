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

		//Returns true if this provenance field points to a source of this data or metadata object 
		isSourceField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!_.contains(this.getProvFields(), field)) return false;			
			
			if(field.indexOf("generatedBy") > -1)    return true;
			if(field.indexOf("wasDerivedFrom") > -1) return true;
			if(field.indexOf("wasExecutedBy") > -1)  return true;

			return false;
		},
		
		//Returns true if this provenance field points to a derivation of this data or metadata object 		
		isDerivationField: function(field){
			if((typeof field == "undefined") || !field) return false;
			if(!!_.contains(this.getProvFields(), field)) return false;
			
			if(field.indexOf("usedBy") > -1) return true;
			
			return false;
		},
		
		hasProvTrace: function(){
			var model = this,
				fieldNames = this.getProvFields();
			
			for(var i=0; i<= fieldNames.length; i++){
				if(model.get(fieldNames[i])) return true;
			}
			
			return false;
		}
		/****************************/

	});
	return SolrResult;
});
