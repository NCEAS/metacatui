/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLTaxonCoverage = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			parentModel: null,
			taxonomicClassification: []
		},
		
		initialize: function(attributes){
			if(attributes.objectDOM) 
				this.set(this.parse(attributes.objectDOM));

			this.on("change:taxonomicClassification", this.trickleUpChange);
		},
		
		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
        nodeNameMap: function(){
        	return {
            	"generaltaxonomiccoverage" : "generalTaxonomicCoverage",
            	"taxonomicclassification" : "taxonomicClassification",
            	"taxonrankname" : "taxonRankName",
            	"taxonrankvalue" : "taxonRankValue",
            	"taxonomiccoverage" : "taxonomicCoverage",
				"taxonomicsystem" : "taxonomicSystem",
				"classificationsystem" : "classificationSystem",
				"classificationsystemcitation" : "classificationSystemCitation",
				"classificationsystemmodifications" : "classificationSystemModifications",
				"identificationreference": "identificationReference",
				"identifiername": "identifierName",
				"taxonomicprocedures": "taxonomicProcedures",
				"taxonomiccompleteness":"taxonomicCompleteness"
            };
        },
		
		parse: function(objectDOM){
			if(!objectDOM)
				var xml = this.get("objectDOM");

			var model = this,
			    taxonomicClassifications = $(objectDOM).children('taxonomicclassification'),
			    modelJSON = {
					taxonomicClassification: _.map(taxonomicClassifications, function(tc) { return model.parseTaxonomicClassification(tc); })
				};

			return modelJSON;
		},
		
		parseTaxonomicClassification: function(classification) {
			var rankName = $(classification).children("taxonrankname");
			var rankValue = $(classification).children("taxonrankvalue");
			var commonName = $(classification).children("commonname");
			var taxonomicClassification = $(classification).children("taxonomicclassification");

			var model = this,
			    modelJSON = {
				taxonRankName: $(rankName).text().trim(),
				taxonRankValue: $(rankValue).text().trim(),
				commonName: _.map(commonName, function(cn) { 
					return $(cn).text().trim(); 
				}),
				taxonomicClassification: _.map(taxonomicClassification, function(tc) {
					return model.parseTaxonomicClassification(tc); 
				})
			};

			return modelJSON;
		},

		serialize: function(){
			var objectDOM = this.updateDOM(),
				xmlString = objectDOM.outerHTML;
		
			//Camel-case the XML
	    	xmlString = this.formatXML(xmlString);
	    	
	    	return xmlString;
		},
		
		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			 var objectDOM = this.get("objectDOM").cloneNode(true),
			     taxonCoverageEl;

			 $(objectDOM).empty();
			 
			 var classifications = this.get('taxonomicClassification');

			 if (typeof classifications === "undefined" ||
			     classifications.length === 0) {
					 return objectDOM;
			}

			 for (var i = 0; i < classifications.length; i++) {
				$(objectDOM).append(this.updateTaxonomicClassification(classifications[i]));
			 } 

			 return objectDOM;
		},
		
		updateTaxonomicClassification: function(classification) {
			var taxonRankName = classification.taxonRankName || "",
			    taxonRankValue = classification.taxonRankValue || "",
			    commonName = classification.commonName || "",
				taxonomicClassification = classification.taxonomicClassification || [],
				finishedEl,
				model = this;


			finishedEl = $(document.createElement("taxonomicClassification"));

			if (taxonRankName && taxonRankName.length > 0) {
				$(finishedEl).append($("<taxonRankName>" + taxonRankName + "</taxonRankName>"));
			}

			if (taxonRankValue && taxonRankValue.length > 0) {
				$(finishedEl).append($("<taxonRankValue>" + taxonRankValue + "</taxonRankValue>"));
			}

			if (commonName && commonName.length > 0) {
				$(finishedEl).append($("<commonName>" + commonName + "</commonName>"));
			}

			if (taxonomicClassification) {
				_.each(taxonomicClassification, function(tc) {
					$(finishedEl).append(model.updateTaxonomicClassification(tc));
				});
			}
			
			return finishedEl;
		},

		trickleUpChange: function(){
			this.get("parentModel").trigger("change");
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLTaxonCoverage;
});