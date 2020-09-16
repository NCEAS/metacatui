/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'],
    function($, _, Backbone, DataONEObject) {

	var EMLTaxonCoverage = Backbone.Model.extend({

		defaults: {
			objectXML: null,
			objectDOM: null,
			parentModel: null,
			taxonomicClassification: [],
			generalTaxonomicCoverage: null
		},

		initialize: function(attributes){
			if(attributes.objectDOM)
				this.set(this.parse(attributes.objectDOM));

			this.on("change:taxonomicClassification", this.trickleUpChange);
			this.on("change:taxonomicClassification", this.updateDOM);
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
				"taxonomiccompleteness":"taxonomicCompleteness",
				"taxonid": "taxonId",
				"commonname": "commonName"
            };
        },

		parse: function(objectDOM){
			if(!objectDOM)
				var xml = this.get("objectDOM");

			var model = this,
			    taxonomicClassifications = $(objectDOM).children('taxonomicclassification'),
			    modelJSON = {
					taxonomicClassification: _.map(taxonomicClassifications, function(tc) { return model.parseTaxonomicClassification(tc); }),
					generalTaxonomicCoverage: $(objectDOM).children('generaltaxonomiccoverage').first().text()
				};

			return modelJSON;
		},

		parseTaxonomicClassification: function(classification) {
			var id = $(classification).attr("id");
			var rankName = $(classification).children("taxonrankname");
			var rankValue = $(classification).children("taxonrankvalue");
			var commonName = $(classification).children("commonname");
			var taxonId = $(classification).children("taxonId");
			var taxonomicClassification = $(classification).children("taxonomicclassification");

			var model = this,
			    modelJSON = {
				id: id,
				taxonRankName: $(rankName).text().trim(),
				taxonRankValue: $(rankValue).text().trim(),
				commonName: _.map(commonName, function(cn) {
					return $(cn).text().trim();
				}),
				taxonId: _.map(taxonId, function(tid) {
					return {
						provider: $(tid).attr("provider").trim(),
						value: $(tid).text().trim()
					}
				}),
				taxonomicClassification: _.map(taxonomicClassification, function(tc) {
					return model.parseTaxonomicClassification(tc);
				})
			};

			if(Array.isArray(modelJSON.taxonomicClassification) && !modelJSON.taxonomicClassification.length)
				modelJSON.taxonomicClassification = {};

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
			 var objectDOM = this.get("objectDOM") ? this.get('objectDOM').cloneNode(true) : document.createElement('taxonomiccoverage');

			 $(objectDOM).empty();

			 // generalTaxonomicCoverage
			 var generalCoverage = this.get('generalTaxonomicCoverage');
			 if (_.isString(generalCoverage) && generalCoverage.length > 0) {
				 $(objectDOM).append($(document.createElement('generaltaxonomiccoverage')).text(this.get('generalTaxonomicCoverage')));
			 }

			 // taxonomicClassification(s)
			 var classifications = this.get('taxonomicClassification');

			 if (typeof classifications === "undefined" ||
			     classifications.length === 0) {
					 return objectDOM;
			}

			 for (var i = 0; i < classifications.length; i++) {
				$(objectDOM).append(this.createTaxonomicClassificationDOM(classifications[i]));
			 }

			// Remove empty (zero-length or whitespace-only) nodes
			$(objectDOM).find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();

			 return objectDOM;
		},

		/* Create the DOM for a single EML taxonomicClassification.

		This function is currently recursive!
		*/
		createTaxonomicClassificationDOM: function(classification) {
			var id = classification.id,
				  taxonRankName = classification.taxonRankName || "",
			    taxonRankValue = classification.taxonRankValue || "",
					commonName = classification.commonName || "",
					taxonId = classification.taxonId,
  				finishedEl;

			if(!taxonRankName || !taxonRankValue) return "";

			finishedEl = $(document.createElement("taxonomicclassification"));

			if (typeof id === "string" && id.length > 0) {
				$(finishedEl).attr("id", id);
			}

			if (taxonRankName && taxonRankName.length > 0) {
				$(finishedEl).append($(document.createElement("taxonrankname")).text(taxonRankName));
			}

			if (taxonRankValue && taxonRankValue.length > 0) {
				$(finishedEl).append($(document.createElement("taxonrankvalue")).text(taxonRankValue));
			}

			if (commonName && commonName.length > 0) {
				$(finishedEl).append($(document.createElement("commonname")).text(commonName));
			}
			
			if (taxonId && taxonId.length > 0) {
				_.each(taxonId, function(el) {
					var taxonIdEl = $(document.createElement("taxonId")).text(el.value);

					if (el.provider) {
						$(taxonIdEl).attr("provider", el.provider);
					}

					$(finishedEl).append(taxonIdEl);
				});
			}


			if (classification.taxonomicClassification) {
				_.each(classification.taxonomicClassification, function(tc) {
				    $(finishedEl).append(this.createTaxonomicClassificationDOM(tc));
				}, this);
				
			}

			return finishedEl;
		},

		/* Validate this model */
		validate: function(){
			var errors = {};

			if(!this.get("generalTaxonomicCoverage") && MetacatUI.appModel.get("emlEditorRequiredFields").generalTaxonomicCoverage)
				errors.generalTaxonomicCoverage = "Provide a description of the taxonomic coverage.";

      //If there are no taxonomic classifications and it is either required in
      // the AppModel OR a general coverage was given, then require it
			if( !this.get("taxonomicClassification").length &&
            (MetacatUI.appModel.get("emlEditorRequiredFields").taxonCoverage || this.get("generalTaxonomicCoverage")) ){
				errors.taxonomicClassification = "Provide at least one complete taxonomic classification.";
      }
			else{
				//Every taxonomic classification should be valid
				if(!_.every(this.get("taxonomicClassification"), this.isClassificationValid, this))
					errors.taxonomicClassification = "Every classification row should have a rank and value.";
			}

			if(Object.keys(errors).length)
				return errors;

		},

		isEmpty: function(){
			return (!this.get("generalTaxonomicCoverage") && !this.get("taxonomicClassification").length)
		},

		isClassificationValid: function(taxonomicClassification){

			if( ! Object.keys(taxonomicClassification).length )
				return true;
			if(Array.isArray(taxonomicClassification)) {
				if(!taxonomicClassification[0].taxonRankName || !taxonomicClassification[0].taxonRankValue) {
					return false;
				}
			} else if(!taxonomicClassification.taxonRankName || !taxonomicClassification.taxonRankValue) {
				return false;
			}

			if(taxonomicClassification.taxonomicClassification)
				return this.isClassificationValid(taxonomicClassification.taxonomicClassification);
			else
				return true;
		},

    /*
    * Climbs up the model heirarchy until it finds the EML model
    *
    * @return {EML211 or false} - Returns the EML 211 Model or false if not found
    */
    getParentEML: function(){
      var emlModel = this.get("parentModel"),
          tries = 0;

      while (emlModel.type !== "EML" && tries < 6){
        emlModel = emlModel.get("parentModel");
        tries++;
      }

      if( emlModel && emlModel.type == "EML")
        return emlModel;
      else
        return false;

    },

		trickleUpChange: function(){
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},

		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});

	return EMLTaxonCoverage;
});
