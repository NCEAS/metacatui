define(["jquery", "underscore", "backbone",
        "models/metadata/eml211/EMLMeasurementScale"],
    function($, _, Backbone, EMLMeasurementScale) {

        /*
         * EMLAttribute represents a data attribute within an entity, such as
         * a column variable in a data table, or a feature attribute in a shapefile.
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-attribute.xsd
         */
        var EMLAttribute = Backbone.Model.extend({

            /* Attributes of an EML attribute object */
            defaults: {

                /* Attributes from EML */
                xmlID: null, // The XML id of the attribute
                attributeName: null,
                attributeLabel: [], // Zero or more human readable labels
                attributeDefinition: null,
                storageType: [], // Zero or more storage types
                typeSystem: [], // Zero or more system types for storage type
                measurementScale: null, // An EMLMeasurementScale object (nominal, ordinal, interval, ratio, datetime)
                missingValueCode: [], // Zero or more {code: value, definition: value} objects
                accuracy: null, // An EMLAccuracy object
                coverage: null, // an EMLCoverage object
                methods: [], // Zero or more EMLMethods objects
                references: null, // A reference to another EMLAttribute by id (needs work)

                /* Attributes not from EML */
                parentModel: null, // The parent model this attribute belongs to
                objectXML: null, // The serialized XML of this EML attribute
                objectDOM: null  // The DOM of this EML attribute
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
                "attributename": "attributeName",
                "attributelabel": "attributeLabel",
                "attributedefinition": "attributeDefinition",
                "sourced" : "source",
                "storagetype": "storageType",
                "typesystem": "typeSystem",
                "measurementscale": "measurementScale",
                "missingvaluecode": "missingValueCode"
            },

            /* Initialize an EMLAttribute object */
            initialize: function(attributes, options) {

                this.on(
                    "change:attributeName " +
                    "change:attributeLabel " +
                    "change:attributeDefinition " +
                    "change:storageType " +
                    "change:measurementScale " +
                    "change:missingValueCode " +
                    "change:accuracy " +
                    "change:coverage " +
                    "change:methods " +
                    "change:references",
                    this.trickleUpChange);
            },

            /*
             * Parse the incoming attribute's XML elements
             */
            parse: function(attributes, options) {
                var $objectDOM;

                if ( attributes.objectDOM ) {
                    $objectDOM = $(attributes.objectDOM);
                } else if ( attributes.objectXML ) {
                    $objectDOM = $($(attributes.objectXML)[0]);
                } else {
                    return {};
                }

                // Add the XML id
                attributes.xmlID = $objectDOM.attr("id");

                // Add the attributeName
                attributes.attributeName = $objectDOM.children("attributename").text();

                // Add the attributeLabel
                attributes.attributeLabel = [];
                var attributeLabels = $objectDOM.children("attributelabel");
                _.each(attributeLabels, function(attributeLabel) {
                    attributes.attributeLabel.push(attributeLabel.textContent);
                });

                // Add the attributeDefinition
                attributes.attributeDefinition = $objectDOM.children("attributedefinition").text();

                // Add the storageType
                attributes.storageType = [];
                attributes.typeSystem = [];
                var storageTypes = $objectDOM.children("storagetype");
                _.each(storageTypes, function(storageType) {
                    attributes.storageType.push(storageType.textContent);
                    var type = $(storageType).attr("typesystem");
                    attributes.typeSystem.push(type || null);
                });


                var measurementScale = $objectDOM.find("measurementscale")[0];
                if ( measurementScale ) {
                    attributes.measurementScale =
                        EMLMeasurementScale.getInstance(measurementScale.outerHTML);
                    attributes.measurementScale.set("parentModel", this);
                }
                attributes.objectDOM = $objectDOM;

                return attributes;
            },
            
            serialize: function(){
            	var objectDOM = this.updateDOM(),
					xmlString = objectDOM.outerHTML;
		
				//Camel-case the XML
		    	xmlString = this.formatXML(xmlString);
	    	
		    	return xmlString;
            },
            
            updateDOM: function(){
            	
            },
            
            formatXML: function(xmlString){
            	return DataONEObject.prototype.formatXML.call(this, xmlString);
            },

            validate: function(){
            	var errors = {};

            	if(!this.get("attributeName"))
            		errors.attributeName = "Provide a name for this attribute.";
            	
            	if(!this.get("attributeDefinition"))
            		errors.attributeDefinition = "Provide a definition for this attribute.";
            	
            	if(!this.get("measurementScale"))
            		errors.measurementScale = "Choose a category.";

            	if(Object.keys(errors).length)
            		return errors;
            	else{
            		this.trigger("valid", this);
            	}
            },

            /* Let the top level package know of attribute changes from this object */
            trickleUpChange: function(){
                MetacatUI.rootDataPackage.packageModel.set("changed", true);
            },

        });

        return EMLAttribute;
    }
);
