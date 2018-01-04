/* global define */
define(['jquery', 
		'underscore', 
		'backbone', 
		'models/DataONEObject', 
		'models/metadata/eml211/EMLText'], 
    function($, _, Backbone, DataONEObject, EMLText) {

	var EMLMethods = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			methodStepDescription: [],
			studyExtentDescription: null,
			samplingDescription: null
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

			this.set('methodStepDescription', _.map($(objectDOM).find('methodstep description'), function(el, i) {
				return new EMLText({
					objectDOM: el,
					type: 'description'
				 });
			}));

			if ($(objectDOM).find('sampling studyextent description').length > 0) {
				this.set('studyExtentDescription', new EMLText({ 
					objectDOM: $(objectDOM).find('sampling studyextent description').get(0),
					type: 'description'
				}));
			}
			
			if ($(objectDOM).find('sampling samplingdescription').length > 0) {
				this.set('samplingDescription', new EMLText({ 
					objectDOM: $(objectDOM).find('sampling samplingdescription').get(0),
					type: 'samplingDescription'
			 	}));
			}
			
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
			var objectDOM;

			if (this.get("objectDOM")) {
				objectDOM = this.get("objectDOM").cloneNode(true);
			} else {
				objectDOM = $(document.createElement("methods"));
			}
			
			//Update the method step descriptions
			var existingMethodSteps = $(objectDOM).find("methodstep");
			_.each(this.get('methodStepDescription'), function(stepDescription, i) {
				
				if( existingMethodSteps[i] ){
					$(existingMethodSteps[i]).children("description")
											 .replaceWith( stepDescription.updateDOM() );
				}					
				else{
					$(objectDOM).append( $(document.createElement('methodStep'))
							    				    .append( stepDescription.updateDOM() ) );
				}
							
				
			});

			
			//If there are no method steps...
			if ( this.get('methodStepDescription').length == 0 ) {
				
				//Remove any existing method steps from the EML
				if(existingMethodSteps.length){
					existingMethodSteps.remove();
				}
				
				// If there are no method steps but there is sampling metadata, then insert an empty method step
				if( this.get('samplingDescription') || this.get('studyExtentDescription') )
					$(objectDOM).append("<methodStep><description><para>No method step description provided.</para></description></methodStep>");
			}

			
			// Update the sampling metadata
			if (this.get('samplingDescription') || this.get('studyExtentDescription')) {
				
				var samplingEl    = $(document.createElement('sampling')),
				    studyExtentEl = $(document.createElement('studyExtent'));

				if (this.get('studyExtentDescription') && !this.get('studyExtentDescription').isEmpty()) {
					$(studyExtentEl).append(this.get('studyExtentDescription').updateDOM());
				} else {
					$(studyExtentEl).append($(document.createElement('description')).html("<para>No study extent description provided.</para>"));
				}

				$(samplingEl).append(studyExtentEl);

				if (this.get('samplingDescription') && !this.get('samplingDescription').isEmpty()) {
					$(samplingEl).append(this.get('samplingDescription').updateDOM());
				} else {
					$(samplingEl).append($(document.createElement('samplingDescription')).html("<para>No sampling description provided.</para>"));
				}
				
				//Find the existing <sampling> element
				var existingSampling = $(objectDOM).find("sampling");
				
				//Replace the existing sampling element, if it exists
				if( existingSampling.length > 0 ){
					existingSampling.replaceWith(samplingEl);
				}
				//Or append a new one
				else{
					$(objectDOM).append(samplingEl);
				}
				
			}

			// Remove empty (zero-length or whitespace-only) nodes
			$(objectDOM).find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();
			
			 return objectDOM;
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