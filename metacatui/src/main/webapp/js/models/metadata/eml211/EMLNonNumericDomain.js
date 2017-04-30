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
                var nonNumericDomainNodeList;
                var domainNodeList; // the list of domain elements
                var domain; // the text or enumerated domain to parse
                var domainObject; // The parsed domain object to be added to attributes.nonNumericDomain

                /* JQuery seems to have a bug handling XML elements named "source"
                 * $objectDOM = $(attributes.objectDOM) gives us:
                 * <nominal>
                 * ....<nonnumericdomain>
                 * ........<textdomain>
                 * ............<definition>Any text</definition>
                 * ............<pattern>*</pattern>
                 * ............<source>Any source
                 * ........</textdomain>
                 * ....</nonnumericdomain>
                 * </nominal>
                 * Note the lost </source>. Changing the element name to "sourced" works fine.
                 * Use the DOMParser instead
                 */
                var parser = new DOMParser();
                var parsedDOM = parser.parseFromString(attributes.objectDOM, "text/xml");
                nonNumericDomainNodeList = $(parsedDOM).find("nonNumericDomain")

                if ( nonNumericDomainNodeList && nonNumericDomainNodeList.length > 0 ) {
                    domainNodeList = nonNumericDomainNodeList[0].children;

                } else {
                    // No content is available, return
                    return attributes;
                }

                // Initialize an array of nonNumericDomain objects
                attributes.nonNumericDomain = [];

                // Set each domain if we have it
                if ( domainNodeList && domainNodeList.length > 0 ) {

                    _.each(domainNodeList, function(domain) {
                        if ( domain ) {
                            switch ( domain.localName ) {
                                case "textDomain":
                                    domainObject = this.parseTextDomain(domain);
                                    break;
                                case "enumeratedDomain":
                                    domainObject = this.parseEnumeratedDomain(domain);
                                    break;
                                case "references":
                                    // TODO: Support references
                                    console.log("We don't support references yet.");
                                default:
                                    console.log("Unrecognized nonNumericDomain: " + domain.localName());
                            }
                        }
                        attributes.nonNumericDomain.push(domainObject);
                    }, this);

                }

                // Get the enumeratedDomain or textDomain fragments

                $objectDOM = $(attributes.objectDOM); // use $objectDOM, not parsedDOM, for the rest

                // Add the XML id
                if ( $objectDOM.attr("id") ) {
                    attributes.xmlID = $objectDOM.attr("id");
                }

                // Add in the textDomain content if present

                return attributes;
            },

            /* Parse the nonNumericDomain/textDomain fragment
             * returning an object with a textDomain attribute, like:
             * {
             *     textDomain: {
             *         definition: "Some definition",
             *         pattern: ["*", "\w", "[0-9]"],
             *         source: "Some source reference"
             *     }
             * }
             */
             parseTextDomain: function(domain) {
                 var domainObject = {};
                 domainObject.textDomain = {};
                 var definition;
                 var patterns = [];
                 var source;

                 // Add the definition
                 definition = $(domain).children("definition").text();
                 domainObject.textDomain.definition = definition;

                 // Add the pattern
                 _.each($(domain).children("pattern"), function(pattern) {
                     patterns.push(pattern.textContent);
                 });
                 domainObject.textDomain.pattern = patterns;

                 // Add the source
                 source = $(domain).children("source").text();
                 domainObject.textDomain.source = source;

                 return domainObject;
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
