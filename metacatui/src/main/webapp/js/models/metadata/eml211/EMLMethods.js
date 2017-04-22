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

			this.set('methodStepDescription', _.map($(objectDOM).find('methodstep description'), function(el) {
				return new EMLText({
					objectDOM: $(el).get(),
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
				objectDOM = $("<methods></methods>");
			}
			
			_.each(this.get('methodStepDescription'), function(step) {
				$(objectDOM).append($(document.createElement('methodStep')).append(step.updateDOM()));
			});

			// Insert a blank methodStep if none are set but one of the sampling elements is
			if (this.get('methodStepDescription').length == 0 && (this.get('samplingDescription') || this.get('studyExtentDescription'))) {
				$(objectDOM).append("<methodStep><description><para>No method step description provided.</para></description></methodStep>");
			}
			
			if (this.get('samplingDescription') || this.get('studyExtentDescription')) {
				var samplingEl = $(document.createElement('sampling')),
				    studyExtentEl = $(document.createElement('studyExtent'))

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

				$(objectDOM).append(samplingEl);
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