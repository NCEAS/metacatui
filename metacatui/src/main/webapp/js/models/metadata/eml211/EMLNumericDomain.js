define(["jquery", "underscore", "backbone",
        "models/DataONEObject"],
    function($, _, Backbone, DataONEObject) {

        /**
         * EMLNumericDomain represents the measurement scale of an interval
         * or ratio measurement scale attribute, and is an extension of
         * EMLMeasurementScale.
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-attribute.xsd
         */
        var EMLNumericDomain = Backbone.Model.extend({

            /* Attributes of an EMLNonNumericDomain object */
            defaults: {
                /* Attributes from EML, extends attributes from EMLMeasurementScale */
                xmlID: null, // the id of the nonNumericDomain element
                measurementScale: null, // the required name of this measurement scale
                unit: null, // the required standard or custom unit definition
                precision: null, // the precision of the observed number
                numericDomain: [] // a required numeric domain object or its reference
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

                $objectDOM = $(attributes.objectXML);
                rootNodeName = $objectDOM[0].localName;

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
                var standardUnit;
                var customUnit;
                if ( unit.length ) {
                    standardUnit = $(unit).children("standardunit").text();
                    standardUnit = $(unit).children("standardunit").text();
                }

                if ( standardUnit ) {
                    unitObject.standardUnit = standardUnit;
                } else {
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
            updateDOM: function() {
                var objectDOM;

                if ( this.get("objectDOM") ) {
                    objectDOM = this.get("objectDOM").cloneNode(true);
                } else {
                    objectDOM = document.createElement(/*this.el*/);
                }

                // TODO: Populate the DOM with model values
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
                    return $(objectDOM).children().last();
                }

                // Otherwise, go through each node in the node list and find the
                // position where this node will be inserted after
                for ( var i = position - 1; i >= 0; i-- ) {
                    if ( $(objectDOM).find(nodeOrder[i]).length ) {
                        return $(objectDOM).find(nodeOrder[i].last());
                    }
                }
            },

            /* Let the top level package know of attribute changes from this object */
            trickleUpChange: function(){
                MetacatUI.rootDataPackage.packageModel.set("changed", true);
            }

        });

        return EMLNumericDomain;
    }
);
