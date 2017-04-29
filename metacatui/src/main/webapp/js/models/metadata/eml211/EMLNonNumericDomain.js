define(["jquery", "underscore", "backbone",
        "models/DataONEObject"],
    function($, _, Backbone, DataONEObject) {

        /**
         * EMLNonNumericDomain represents the measurement scale of a nominal
         * or ordinal measurement scale attribute, and is an extension of
         * EMLMeasurementScale.
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-attribute.xsd
         */
        var EMLNonNumericDomain = Backbone.Model.extend({

            /* Attributes of an EMLNonNumericDomain object */
            defaults: {
                /* Attributes from EML, extends attributes from EMLMeasurementScale */
                xmlID: null, // the id of the nonNumericDomain element
                measurementScale: null, // the name of this measurement scale
                nonNumericDomain: [] // One or more of enumeratedDomain, textDomain, references
            },

            /**
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
                "nonnumericdomain": "nonNumericDomain",
                "enumerateddomain": "enumeratedDomain",
                "textdomain": "textDomain",
                "externalcodeset": "externalCodeSet",
                "codesetname": "codesetName",
                "codeseturl": "codesetURL",
                "entityCodeList": "entityCodeList",
                "entityreference": "entityReference",
                "valueattributereference": "valueAttributeReference",
                "definitionattributereference": "definitionAttributeReference",
                "orderattributereference": "orderAttributeReference",
            },

            /* Initialize an EMLNonNumericDomain object */
            initialize: function(attributes, options) {

                this.on("change:nonNumericDomain", this.trickleUpChange);
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
                var nodeOrder = ["enumeratedDomain", "textDomain"];

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

        return EMLNonNumericDomain;
    }
);
