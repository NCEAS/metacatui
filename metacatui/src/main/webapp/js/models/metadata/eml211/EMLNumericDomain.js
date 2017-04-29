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
                "numericdomain": "numericDomain",
                "numbertype": "numberType",
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

                $objectDOM = $(attributes.objectDOM);

                // Add the XML id
                if ( $objectDOM.attr("id") ) {
                    attributes.xmlID = $objectDOM.attr("id");
                }

                // TODO: parse the fields

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
