define(["jquery", "underscore", "backbone",
        "models/DataONEObject"],
    function($, _, Backbone, DataONEObject) {

        /**
         * @class EMLNumericDomain
         * @classdesc EMLNumericDomain represents the measurement scale of an interval
         * or ratio measurement scale attribute, and is an extension of
         * EMLMeasurementScale.
         * @classcategory Models/Metadata/EML211
         * @see https://github.com/NCEAS/eml/blob/master/eml-attribute.xsd
         */
        var EMLNumericDomain = Backbone.Model.extend(
            /** @lends EMLNumericDomain.prototype */{

        	type: "EMLNumericDomain",

            /* Attributes of an EMLNonNumericDomain object */
            defaults: function(){
              return {
                /* Attributes from EML, extends attributes from EMLMeasurementScale */
                measurementScale: null, // the required name of this measurement scale
                unit: null, // the required standard or custom unit definition
                precision: null, // the precision of the observed number
                numericDomain: {} // a required numeric domain object or its reference
              }
            },

            /**
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
                "standardunit": "standardUnit",
                "customunit": "customUnit",
                "numericdomain": "numericDomain",
                "numbertype": "numberType"
            },

            /* Initialize an EMLNonNumericDomain object */
            initialize: function(attributes, options) {

                this.on("change:numericDomain", this.trickleUpChange);

            },

            /**
             * Parse the incoming measurementScale's XML elements
             */
            parse: function(attributes, options) {

                var $objectDOM;
                var measurementScale;
                var rootNodeName;

                if ( attributes.objectDOM ) {
                    rootNodeName = $(attributes.objectDOM)[0].localName;
                    $objectDOM = $(attributes.objectDOM);
                } else if ( attributes.objectXML ) {
                    rootNodeName = $(attributes.objectXML)[0].localName;
                    $objectDOM = $($(attributes.objectXML)[0]);
                } else {
                    return {};
                }

                // do we have an appropriate measurementScale tree?
                var index = _.indexOf(["measurementscale","interval", "ratio"], rootNodeName);
                if ( index == -1 ) {
                    throw new Error("The measurement scale XML does not have a root " +
                        "node of 'measurementScale', 'interval', or 'ratio'.");
                }

                // If measurementScale is present, add it
                if ( rootNodeName == "measurementscale" ) {
                    attributes.measurementScale = $objectDOM.children().first()[0].localName;
                    $objectDOM = $objectDOM.children().first();
                } else {
                    attributes.measurementScale = $objectDOM.localName;
                }


                // Add the unit
                var unitObject = {};
                var unit = $objectDOM.children("unit");
                var standardUnitNodes = unit.children("standardunit"),
                    customUnitNodes   = unit.children("customunit"),
                    standardUnit,
                    customUnit;

                if ( standardUnitNodes.length ) {
                    standardUnit = standardUnitNodes.text();

                    if( standardUnit )
                      unitObject.standardUnit = standardUnit;
                }
                else if( customUnitNodes.length ){
                    customUnit = customUnitNodes.text();

                    if( customUnit )
                      unitObject.customUnit = customUnit;
                }

                attributes.unit = unitObject;

                // Add the precision
                var precision = $objectDOM.children("precision").text();
                if ( precision ) {
                    attributes.precision = precision;
                }

                // Add the numericDomain
                var numericDomainObject = {};
                var numericDomain = $objectDOM.children("numericdomain");
                var numberType;
                var boundsArray = [];
                var boundsObject;
                var bounds;
                var minimum;
                var maximum;
                var references;
                if ( numericDomain ) {
                    // Add the XML id of the numeric domain
                    if ( $(numericDomain).attr("id") ) {
                        numericDomainObject.xmlID = $(numericDomain).attr("id");
                    }

                    // Add the numberType
                    numberType = $(numericDomain).children("numbertype");

                    if ( numberType ) {
                        numericDomainObject.numberType = numberType.text();

                        // Add optional bounds
                        bounds = $(numericDomain).children("bounds");
                        if ( bounds.length ) {
                            _.each(bounds, function(bound) {
                                boundsObject = {}; // initialize on each
                                minimum = $(bound).children("minimum").text();
                                maximum = $(bound).children("maximum").text();
                                if ( minimum && maximum ) {
                                    boundsObject.minimum = minimum;
                                    boundsObject.maximum = maximum;
                                } else if ( minimum ) {
                                    boundsObject.minimum = minimum;
                                } else if ( maximum ) {
                                    boundsObject.maximum = maximum;
                                }
                                // If one of min or max is defined, add to the bounds array
                                if ( boundsObject.minimum || boundsObject.maximum ) {
                                    boundsArray.push(boundsObject);
                                }
                            });
                        }
                        numericDomainObject.bounds = boundsArray;

                    } else {
                        // Otherwise look for references
                        references = $(numericDomain).children("references");
                        if ( references ) {
                            numericDomainObject.references = references.text();
                        }
                    }
                    attributes.numericDomain = numericDomainObject;
                }
                attributes.objectDOM = $objectDOM[0];

                return attributes;
            },

            /* Serialize the model to XML */
            serialize: function() {
                var objectDOM = this.updateDOM();
                var xmlString = objectDOM.outerHTML;

                // Camel-case the XML
                xmlString = this.formatXML(xmlString);

                return xmlString;
            },

            /* Copy the original XML DOM and update it with new values from the model */
            updateDOM: function(objectDOM) {
                var nodeToInsertAfter;
                var type = this.get("measurementScale");
                if ( typeof type === "undefined") {
                    console.warn("Defaulting to an interval measurementScale.");
                    type = "interval";
                }
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

                // Update the unit
                var unit = this.get("unit");
                var unitNode;
                var unitTypeNode;
                if ( unit ) {
                    // Remove any existing unit
                    $(objectDOM).find("unit").remove();

                    // Build a unit element, and populate a standard or custom child
                    unitNode = document.createElement("unit");

                    if ( typeof unit.standardUnit !== "undefined") {
                        unitTypeNode = document.createElement("standardUnit");
                        $(unitTypeNode).text(unit.standardUnit);
                    } else if ( typeof unit.customUnit !== "undefined" ) {
                        unitTypeNode = document.createElement("customUnit");
                        $(unitTypeNode).text(unit.customUnit);
                    } else {
                        // Hmm, unit isn't an object?
                        // Default to a standard unit
                        unitTypeNode = document.createElement("standardUnit");
                        if ( typeof unit === "string") {
                            $(unitTypeNode).text(unit);
                            console.warn("EMLNumericDomain.unit should be an object.");
                        } else {
                            // We're really striking out. Default to dimensionless.
                            $(unitTypeNode).text("dimensionless");
                            console.warn("Defaulting EMLNumericDomain.unit to dimensionless.");
                        }
                    }
                    $(unitNode).append(unitTypeNode);

                    // Add the unit to the DOM
                    nodeToInsertAfter = this.getEMLPosition(objectDOM, "unit");

                    if( ! nodeToInsertAfter ) {
                        $(objectDOM).prepend(unitNode);
                    } else {
                        $(nodeToInsertAfter).after(unitNode);
                    }
                }

                // Update the precision
                if ( this.get("precision") ) {
                    if ( $(objectDOM).find("precision").length ) {
                        $(objectDOM).find("precision").text(this.get("precision"));
                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "precision");

                        if( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("precision"))
                                .text(this.get("precision"))[0]);
                        } else {
                            $(nodeToInsertAfter).after(
                                $(document.createElement("precision"))
                                    .text(this.get("precision"))[0]
                            );
                        }
                    }
                }

                // Update the numericDomain
                var numericDomain = this.get("numericDomain");
                var numericDomainNode = $(objectDOM).find("numericdomain")[0];
                var numberType;
                var numberTypeNode;
                var minBound;
                var maxBound;
                var boundsNode;
                var minBoundNode;
                var maxBoundNode;
                if ( numericDomain ) {

                	var oldNumericDomainNode = $(numericDomainNode).clone();

                    // Remove the existing numericDomainNode node
                    if ( typeof numericDomainNode !== "undefined" ) {
                        numericDomainNode.remove();
                    }

                    // Build the new numericDomain node
                    numericDomainNode = document.createElement("numericdomain");

                    // Do we have numberType?
                    if ( typeof numericDomain.numberType !== "undefined" ) {
                        numberTypeNode = document.createElement("numbertype");
                        $(numberTypeNode).text(numericDomain.numberType);
                        $(numericDomainNode).append(numberTypeNode);
                    }

                    // Do we have bounds?
                    if ( typeof numericDomain.bounds !== "undefined" &&
                         numericDomain.bounds.length ) {

                        _.each(numericDomain.bounds, function(bound) {
                            minBound = bound.minimum;
                            maxBound = bound.maximum;
                            boundsNode = document.createElement("bounds");

                            var hasBounds = typeof minBound !== "undefined" || typeof maxBound !== "undefined";

                            if ( hasBounds ) {
                                // Populate the minimum element
                                if ( typeof minBound !== "undefined" ) {
                                    minBoundNode = $(document.createElement("minimum"));
                                    minBoundNode.text(minBound);

                                    var existingExclusive = oldNumericDomainNode.find("minimum").attr("exclusive");

                                    if( !existingExclusive || existingExclusive === "false" )
                                    	minBoundNode.attr("exclusive", "false");
                                    else
                                    	minBoundNode.attr("exclusive", "true");
                                }

                                // Populate the maximum element
                                if ( typeof maxBound !== "undefined" ) {
                                    maxBoundNode = $(document.createElement("maximum"));
                                    maxBoundNode.text(maxBound);

                                    var existingExclusive = oldNumericDomainNode.find("maximum").attr("exclusive");

                                    if( !existingExclusive || existingExclusive === "false" )
                                    	maxBoundNode.attr("exclusive", "false");
                                    else
                                    	maxBoundNode.attr("exclusive", "true");
                                }

                                $(boundsNode).append(minBoundNode, maxBoundNode);
                                $(numericDomainNode).append(boundsNode);

                            } else {
                                // Do nothing. Content is missing, don't append the node
                            }
                        });
                    } else {
                        // Basically do nothing. Don't append the numericDomain element
                        // TODO: handle numericDomain.references

                    }
                    nodeToInsertAfter = this.getEMLPosition(objectDOM, "numericDomain");

                    if( ! nodeToInsertAfter ) {
                        $(objectDOM).append(numericDomainNode);
                    } else {
                        $(nodeToInsertAfter).after(numericDomainNode);
                    }
                }
                return objectDOM;
            },

            formatXML: function(xmlString){
                return DataONEObject.prototype.formatXML.call(this, xmlString);
            },

            /**/
            getEMLPosition: function(objectDOM, nodeName) {
                // TODO: set the node order
                var nodeOrder = ["unit", "precision", "numericDomain"];

                var position = _.indexOf(nodeOrder, nodeName);

                // Append to the bottom if not found
                if ( position == -1 ) {
                    return $(objectDOM).children().last()[0];
                }

                // Otherwise, go through each node in the node list and find the
                // position where this node will be inserted after
                for ( var i = position - 1; i >= 0; i-- ) {
                    if ( $(objectDOM).find(nodeOrder[i]).length ) {
                        return $(objectDOM).find(nodeOrder[i]).last()[0];
                    }
                }
            },

            validate: function(){
            	var errors = {};

            	if(!this.get("unit"))
            		errors.unit = "Choose a unit.";

            	if( Object.keys(errors).length )
            		return errors;
            	else{

            		this.trigger("valid");
            		return;

            	}

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

            /* Let the top level package know of attribute changes from this object */
            trickleUpChange: function(){
                MetacatUI.rootDataPackage.packageModel.set("changed", true);
            }

        });

        return EMLNumericDomain;
    }
);
