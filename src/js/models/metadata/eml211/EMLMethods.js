/* global define */
define(['jquery',
		'underscore',
		'backbone',
		'models/DataONEObject',
		'models/metadata/eml211/EMLText'],
    function($, _, Backbone, DataONEObject, EMLText) {

	var EMLMethods = Backbone.Model.extend({

		defaults: function(){
			return {
				objectXML: null,
				objectDOM: null,
				methodStepDescription: [],
				studyExtentDescription: null,
				samplingDescription: null
			}
		},

		initialize: function(attributes){
			attributes = attributes || {};

			if(attributes.objectDOM) this.parse(attributes.objectDOM);

			//specific attributes to listen to
			this.on("change:methodStepDescription change:studyExtentDescription change:samplingDescription",
					this.trickleUpChange);
		},

		/*
     * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
     * Used during parse() and serialize()
     */
    nodeNameMap: function(){
    	return {
    		"methodstep" : "methodStep",
				"substep" : "subStep",
				"datasource" : "dataSource",
				"studyextent" : "studyExtent",
				"samplingdescription" : "samplingDescription",
				"spatialsamplingunits" : "spatialSamplingUnits",
				"referencedentityid" : "referencedEntityId",
				"qualitycontrol" : "qualityControl"
        }
    },

		parse: function(objectDOM) {
			var modelJSON = {};

			if (!objectDOM) var objectDOM = this.get("objectDOM");

			var model = this;

			this.set('methodStepDescription', _.map($(objectDOM).find('methodstep description'), function(el, i) {
				return new EMLText({
					objectDOM: el,
					type: 'description',
					parentModel: model
				 });
			}));

			if ($(objectDOM).find('sampling studyextent description').length > 0) {
				this.set('studyExtentDescription', new EMLText({
					objectDOM: $(objectDOM).find('sampling studyextent description').get(0),
					type: 'description',
					parentModel: model
				}));
			}

			if ($(objectDOM).find('sampling samplingdescription').length > 0) {
				this.set('samplingDescription', new EMLText({
					objectDOM: $(objectDOM).find('sampling samplingdescription').get(0),
					type: 'samplingDescription',
					parentModel: model
			 	}));
			}

			return modelJSON;
		},

		serialize: function(){
			var objectDOM = this.updateDOM();

			if(!objectDOM)
				return "";

			var xmlString = objectDOM.outerHTML;

			//Camel-case the XML
	    xmlString = this.formatXML(xmlString);

  		return xmlString;
		},

		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			var objectDOM;

			if (this.get("objectDOM")) {
				objectDOM = this.get("objectDOM").cloneNode(true);
			} else {
				objectDOM = $(document.createElement("methods"));
			}

			objectDOM = $(objectDOM);

			var methodStepsFromModel = this.get('methodStepDescription'),
					methodStepsFromDOM   = $(objectDOM).find("methodstep"),
					numMethods           = methodStepsFromModel.length;

			//If there are no method steps or they are all empty...
			if ( methodStepsFromModel.length == 0 || _.every(methodStepsFromModel, function(step){ return step.isEmpty(); }) ){

				//Remove all existing method steps from the EML
				methodStepsFromDOM.remove();

				// If there are no method steps but there is sampling metadata, then insert an empty method step
				if( (this.get('samplingDescription') && !this.get('samplingDescription').isEmpty()) ||
						(this.get('studyExtentDescription') && !this.get('studyExtentDescription').isEmpty()) ){

					objectDOM.prepend("<methodstep><description><para>No method step description provided.</para></description></methodstep>");
					numMethods = 0;

				}
			}
			else{
				//Update the method step descriptions
				_.each(methodStepsFromModel, function(stepDescription, i) {

					//If there is a method step node in the DOM at this position, then update it
					if( methodStepsFromDOM[i] ){

						if( stepDescription.isEmpty() || stepDescription.get("text") == "No method step description provided." ){
							$(methodStepsFromDOM[i]).remove();
						}
						else{
							$(methodStepsFromDOM[i]).children("description")
													 .replaceWith( stepDescription.updateDOM() );
						}

					}
					//Otherwise, create a new method step node
					else if( !stepDescription.isEmpty() ){
						var lastMethodStep = objectDOM.find("methodstep").last();

						//If there is already one method step, insert this one after it
						if( lastMethodStep.length ){
							lastMethodStep.after( $(document.createElement('methodStep'))
																	.append( stepDescription.updateDOM() ) );
						}
						//Otherwise if there is no existing method step, append it to the parent DOM element
						else{
							objectDOM.append( $(document.createElement('methodStep'))
																	.append( stepDescription.updateDOM() ) );
						}
					}

				});
			}

			// Update the sampling metadata
			if (this.get('samplingDescription') || this.get('studyExtentDescription')) {

				var samplingEl    = $(document.createElement('sampling')),
				    studyExtentEl = $(document.createElement('studyExtent')),
						missingStudyExtent = false,
						missingDescription = false;

				//If there is a study extent description, then create a DOM element for it and append it to the parent node
				if (this.get('studyExtentDescription') && !this.get('studyExtentDescription').isEmpty()) {
					$(studyExtentEl).append(this.get('studyExtentDescription').updateDOM());

					//If the text matches the default "filler" text, then mark it as missing
					if( this.get('studyExtentDescription').get("text")[0] == "No study extent description provided."){
						missingStudyExtent = true;
					}

				}
				//If there isn't a study extent description, then mark it as missing and append the default "filler" text
				else {
					missingStudyExtent = true;
					$(studyExtentEl).append($(document.createElement('description')).html("<para>No study extent description provided.</para>"));
				}


				//Add the study extent element to the sampling element
				$(samplingEl).append(studyExtentEl);

				//If there is a sampling description, then create a DOM element for it and append it to the parent node
				if (this.get('samplingDescription') && !this.get('samplingDescription').isEmpty()) {
					$(samplingEl).append(this.get('samplingDescription').updateDOM());

					//If the text matches the default "filler" text, then mark it as missing
					if( this.get('samplingDescription').get("text")[0] == "No sampling description provided."){
						missingDescription = true;
					}

				}
				//If there isn't a study extent description, then mark it as missing and append the default "filler" text
				else {
					missingDescription = true;
					$(samplingEl).append($(document.createElement('samplingDescription')).html("<para>No sampling description provided.</para>"));
				}

				//Find the existing <sampling> element
				var existingSampling = objectDOM.find("sampling");

				//Remove all the sampling nodes if there is no study extent and no description
				if(missingStudyExtent && missingDescription){
					existingSampling.remove();

					//If there are no method steps either, make sure their DOM elements are removed
					if(numMethods == 0){
						objectDOM.find("methodstep").remove();
					}
				}
				//Replace the existing sampling element, if it exists
				else if( existingSampling.length > 0 ){
					existingSampling.replaceWith(samplingEl);
				}
				//Or append a new one
				else{
					objectDOM.append(samplingEl);
				}

			}

			// Remove empty (zero-length or whitespace-only) nodes
			objectDOM.find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();

			//Check if all the content is filler content. This means there are no method steps, no sampling description, and
			// no study extent description.
			if( objectDOM.find("methodstep").length == 1 &&
					objectDOM.find("methodstep description para").text() == "No method step description provided." &&
					objectDOM.find("samplingdescription").length == 1 &&
					objectDOM.find("samplingdescription para").text() == "No sampling description provided." &&
					objectDOM.find("studyextent").length == 1 &&
					objectDOM.find("studyextent description para").text() == "No study extent description provided." ){

					//If it is all empty / filler content, then totally remove the methods
					return "";

			}

			//If there are sampling nodes listed before methodStep nodes, then reorder them
			if( objectDOM.children().index(objectDOM.find("methodstep").last()) >
						objectDOM.children().index(objectDOM.find("sampling").last()) ){

				//Detach all the sampling nodes and append them to the parent node
				objectDOM.append( objectDOM.children("sampling").detach() );

			}

			//If there is more than one method step, remove any that have the default filler text
			if( objectDOM.find("methodstep").length > 1 ){
				objectDOM.find("methodstep:contains('No method step description provided.')").remove();
			}

			//If there are sampling nodes but no method nodes, make method nodes
			if( objectDOM.find("samplingdescription").length > 0 &&
					objectDOM.find("studyextent").length > 0 &&
					objectDOM.find("methodstep").length == 0){
						objectDOM.prepend("<methodstep><description><para>No method step description provided.</para></description></methodstep>");
			}

			 return objectDOM;
		},

		/*
		*  function isEmpty() - Will check if there are any values set on this model
		* that are different than the default values and would be serialized to the EML.
		*
		* @return {boolean} - Returns true is this model is empty, false if not
		*/
		isEmpty: function(){

			var methodsStepsEmpty = false,
					studyExtentEmpty = false,
					samplingEmpty = false;

			if( !this.get("methodStepDescription").length || !this.get("methodStepDescription") ||
					(this.get("methodStepDescription").length == 1 &&
					 this.get("methodStepDescription")[0].get("text").length == 1 &&
					 this.get("methodStepDescription")[0].get("text")[0] == "No method step description provided.") ||
					 (this.get("methodStepDescription").length && _.every(this.get("methodStepDescription"), function(emlText){
		 					if(emlText.isEmpty()){
								return true;
							}
							else if(_.every(emlText.get("text"), function(text){
									return (text.trim() == "No method step description provided." || text.trim().length == 0);
								})){
								return true;
							}
		 				})) ){

						methodsStepsEmpty = true;

			}

			if( this.get("studyExtentDescription") == this.defaults().studyExtentDescription ||
					!this.get("studyExtentDescription") ||
					(this.get("studyExtentDescription").isEmpty && this.get("studyExtentDescription").isEmpty()) ||
					(Array.isArray(this.get("studyExtentDescription")) && !this.get("studyExtentDescription").length ) ||
					(Array.isArray(this.get("studyExtentDescription")) &&
					 this.get("studyExtentDescription").length == 1 &&
					 this.get("studyExtentDescription")[0].get("text").length == 1 &&
					 this.get("studyExtentDescription")[0].get("text")[0] == "No study extent description provided.") ){

					studyExtentEmpty = true;

			}

			if( this.get("samplingDescription") == this.defaults().samplingDescription ||
					!this.get("samplingDescription") ||
					(this.get("samplingDescription").isEmpty && this.get("samplingDescription").isEmpty()) ||
					(Array.isArray(this.get("samplingDescription")) && !this.get("samplingDescription").length ) ||
					(Array.isArray(this.get("samplingDescription")) &&
					 this.get("samplingDescription").length == 1 &&
					 this.get("samplingDescription")[0].get("text").length == 1 &&
					 this.get("samplingDescription")[0].get("text")[0] == "No sampling description provided.") ){

					samplingEmpty = true;

			}

			if( methodsStepsEmpty && studyExtentEmpty && samplingEmpty )
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

	return EMLMethods;
});
