define(["jquery", "underscore", "backbone",
        "models/metadata/eml211/EMLMeasurementScale",
        "models/DataONEObject"],
    function($, _, Backbone, EMLMeasurementScale, DataONEObject) {

        /*
         * EMLAttribute represents a data attribute within an entity, such as
         * a column variable in a data table, or a feature attribute in a shapefile.
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-attribute.xsd
         */
        var EMLAttribute = Backbone.Model.extend({

            /* Attributes of an EML attribute object */
            defaults: function(){
            	return {
	                /* Attributes from EML */
	                xmlID: null, // The XML id of the attribute
	                attributeName: null,
	                attributeLabel: [], // Zero or more human readable labels
	                attributeDefinition: null,
	                storageType: [], // Zero or more storage types
	                typeSystem: [], // Zero or more system types for storage type
	                measurementScale: null, // An EML{Non}NumericDomain or EMLDateTimeDomain object
	                missingValueCode: [], // Zero or more {code: value, definition: value} objects
	                accuracy: null, // An EMLAccuracy object
	                coverage: null, // an EMLCoverage object
	                methods: [], // Zero or more EMLMethods objects
	                references: null, // A reference to another EMLAttribute by id (needs work)
	
	                /* Attributes not from EML */
	                type: "attribute", // The element type in the DOM
	                parentModel: null, // The parent model this attribute belongs to
	                objectXML: null, // The serialized XML of this EML attribute
	                objectDOM: null,  // The DOM of this EML attribute
	                nodeOrder: [ // The order of the top level XML element nodes
	                    "attributeName",
	                    "attributeLabel",
	                    "attributeDefinition",
	                    "storageType",
	                    "measurementScale",
	                    "missingValueCode",
	                    "accuracy",
	                    "coverage",
	                    "methods"
	                ]
            	}
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
                    $objectDOM = $(attributes.objectXML);
                } else {
                    return {};
                }

                // Add the XML id
                if ( typeof $objectDOM.attr("id") !== "undefined" ) {
                    attributes.xmlID = $objectDOM.attr("id");
                }

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
                attributes.objectDOM = $objectDOM[0];

                return attributes;
            },
            
            serialize: function(){
            	var objectDOM = this.updateDOM(),
					xmlString = objectDOM.outerHTML;
		
				//Camel-case the XML
		    	xmlString = this.formatXML(xmlString);
	    	
		    	return xmlString;
            },
            
            /* Copy the original XML and update fields in a DOM object */
            updateDOM: function(objectDOM){
                
                var nodeToInsertAfter;
                var type = this.get("type") || "attribute";
                if ( ! objectDOM ) {
                    objectDOM = this.get("objectDOM");
                }
                var objectXML = this.get("objectXML");

                // If present, use the cached DOM
                if ( objectDOM ) {
                    objectDOM = objectDOM.cloneNode(true);

                // otherwise, use the cached XML
                } else if ( objectXML ){
                    objectDOM = $(objectXML)[0].cloneNode(true);

                // This is new, create it
                } else {
                    objectDOM = document.createElement(type);

                }

                // update the id attribute
                var xmlID = this.get("xmlID");
                if ( xmlID ) {
                    $(objectDOM).attr("id", xmlID);
                }

                // Update the attributeName
                if ( this.get("attributeName") ) {
                    if ( $(objectDOM).find("attributename").length ) {
                        $(objectDOM).find("attributename").text(this.get("attributeName"));
                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "attributeName");
                        
                        if( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("attributename"))
                                .text(this.get("attributeName"))[0]);
                        } else {
                            $(nodeToInsertAfter).after(
                                $(document.createElement("attributename")).text(this.get("attributeName"))[0]
                            );
                        }
                    }
                }

                // Update the attributeLabels
                nodeToInsertAfter = undefined;
                var attributeLabels = this.get("attributeLabel");
                if ( attributeLabels ) {
                    if ( attributeLabels.length ) {
                        // Copy and reverse the array for inserting
                        attributeLabels = Array.from(attributeLabels).reverse();
                        // Remove all current attributeLabels
                        $(objectDOM).find("attributelabel").remove();
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "attributeLabel");

                        if( ! nodeToInsertAfter ) {
                            // Add the new list back in
                            _.each(attributeLabels, function(attributeLabel) {
                                $(objectDOM).append(
                                    $(document.createElement("attributelabel"))
                                        .text(attributeLabel)[0]);
                            });
                        } else {
                            // Add the new list back in after its previous sibling
                            _.each(attributeLabels, function(attributeLabel) {
                                $(nodeToInsertAfter).after(
                                    $(document.createElement("attributelabel"))
                                        .text(attributeLabel)[0]);
                            });
                        }
                    }
                }

                // Update the attributeDefinition
                nodeToInsertAfter = undefined;
                if ( this.get("attributeDefinition") ) {
                    if ( $(objectDOM).find("attributedefinition").length ) {
                        $(objectDOM).find("attributedefinition").text(this.get("attributeDefinition"));
                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "attributeDefinition");
                        
                        if( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("attributedefinition"))
                                .text(this.get("attributeDefinition"))[0]);
                        } else {
                            $(nodeToInsertAfter).after($(document.createElement("attributedefinition"))
                                .text(this.get("attributeDefinition"))[0]);
                        }
                    }
                }

                // Update the storageTypes
                nodeToInsertAfter = undefined;
                var storageTypes = this.get("storageTypes");
                if ( storageTypes ) {
                    if ( storageTypes.length ) {
                        // Copy and reverse the array for inserting
                        storageTypes = Array.from(storageTypes).reverse();
                        // Remove all current attributeLabels
                        $(objectDOM).find("storagetype").remove();
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "storageType");

                        if( ! nodeToInsertAfter ) {
                            // Add the new list back in
                            _.each(storageTypes, function(storageType) {
                                $(objectDOM).append(
                                    $(document.createElement("storagetype"))
                                        .text(storageType)[0]);
                            });
                        } else {
                            // Add the new list back in after its previous sibling
                            _.each(storageTypes, function(storageType) {
                                $(nodeToInsertAfter).after(
                                    $(document.createElement("storagetype"))
                                        .text(storageType)[0]);
                            });
                        }
                    }
                }

                // Update the measurementScale
                nodeToInsertAfter = undefined;
                var measurementScale = this.get("measurementScale");
                var measurementScaleNodes;
                var measurementScaleNode;
                var domainNode;
                if ( typeof measurementScale !== "undefined" ) {
                    
                    // Find the measurementScale child or create a new one
                    measurementScaleNodes = $(objectDOM).children("measurementscale");
                    if ( measurementScaleNodes.length ) {
                        measurementScaleNode = measurementScaleNodes[0];
                        
                    } else {
                        measurementScaleNode = document.createElement("measurementscale");
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "measurementScale");
                        
                        if ( typeof nodeToInsertAfter === "undefined" ) {
                            $(objectDOM).append(measurementScaleNode);
                        } else {
                            $(nodeToInsertAfter).after(measurementScaleNode);
                        }
                    }
                    
                    // Append the measurementScale domain content
                    domainNode = measurementScale.updateDOM();
                    if (typeof domainNode !== "undefined" ) {
                        $(measurementScaleNode).children().remove();
                        $(measurementScaleNode).append(domainNode);
                    }

                } else {
                    console.log("No measurementScale object has been defined.");
                }
                return objectDOM;
            },
            
            /*
             * Get the DOM node preceding the given nodeName
             * to find what position in the EML document
             * the named node should be appended
             */
            getEMLPosition: function(objectDOM, nodeName) {
                var nodeOrder = this.get("nodeOrder");

                var position = _.indexOf(nodeOrder, nodeName);

                // Append to the bottom if not found
                if ( position == -1 ) {
                    return $(objectDOM).children().last()[0];
                }

                // Otherwise, go through each node in the node list and find the
                // position where this node will be inserted after
                for ( var i = position - 1; i >= 0; i-- ) {
                    if ( $(objectDOM).find(nodeOrder[i].toLowerCase()).length ) {
                        return $(objectDOM).find(nodeOrder[i].toLowerCase()).last()[0];
                    }
                }
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
