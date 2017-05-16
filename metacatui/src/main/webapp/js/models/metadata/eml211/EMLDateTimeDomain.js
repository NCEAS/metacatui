define(["jquery", "underscore", "backbone",
        "models/DataONEObject"],
    function($, _, Backbone, DataONEObject) {

        /*
         * EMLDateTimeDomain represents the measurement scale of a date/time
         * attribute.
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-attribute.xsd
         */
        var EMLDateTimeDomain = Backbone.Model.extend({

        	type: "EMLDateTimeDomain",

            /* Attributes of an EMLDateTimeDomain object */
            el: "dateTime",

            defaults: {

                /* Attributes from EML */
                xmlID: null, // The XML id of the attribute
                formatString: null, // Required format string (e.g. YYYY)
                dateTimePrecision: null, // The precision of the date time value
                dateTimeDomain: null, // Zero or more bounds, or a references object
                /* Attributes not from EML */
                parentModel: null, // The parent model this attribute belongs to
                objectXML: null, // The serialized XML of this EML measurement scale
                objectDOM: null  // The DOM of this EML measurement scale
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
                "datetime": "dateTime",
                "formatstring": "formatString",
                "datetimeprecision": "dateTimePrecision",
                "datetimedomain": "dateTimeDomain"
            },

            /* Initialize an EMLDateTimeDomain object */
            initialize: function(attributes, options) {

                this.on(
                    "change:formatString " +
                    "change:dateTimePrecision " +
                    "change:dateTimeDomain",
                    this.trickleUpChange);
            },

            /*
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

                // If measurementScale is present, add it
                if ( rootNodeName == "measurementscale" ) {
                    attributes.measurementScale = $objectDOM.children().first()[0].localName;
                    $objectDOM = $objectDOM.children().first();
                } else {
                    attributes.measurementScale = $objectDOM.localName;
                }


                // Add the XML id
                if ( $objectDOM.attr("id") ) {
                    attributes.xmlID = $objectDOM.attr("id");
                }

                // Add the formatString
                attributes.formatString = $objectDOM.find("formatstring").text();

                // Add the dateTimePrecision
                attributes.dateTimePrecision = $objectDOM.find("datetimeprecision").text();

                // Add in the dateTimeDomain
                var dateTimeDomain = $objectDOM.find("datetimedomain");
                if ( dateTimeDomain.length ) {
                    attributes.dateTimeDomain = this.parseDateTimeDomain(dateTimeDomain);

                }
                attributes.objectDOM = $objectDOM[0];

                return attributes;
            },

            /*
             * Parse the attribute/measurementScale/dateTime/dateTimeDomain fragment
             * returning a domain object with a bounds attribute consisting of an array
             * of objects with optional minimum and maximum attributes
             * For example:
             * {
             *     bounds: [
             *         {minimum: 2015, maximum: 2016},
             *         {minimum: 2017, maximum: 2018}
             *     ]
             * }
             * TODO: Support the references element
             */
            parseDateTimeDomain: function(dateTimeDomainXML) {
                var domain = {
                    bounds: []
                }
                var bounds = $(dateTimeDomainXML).find("bounds");

                _.each(bounds, function(bound) {
                    var bnd = {};
                    // Get the minimum if available
                    var min = $(bound).find("minimum").text();
                    if ( min ) {
                        bnd.minimum = min;
                    }
                    // Get the maximum if available
                    var max = $(bound).find("maximum").text();
                    if ( max ) {
                        bnd.maximum = max;
                    }
                    domain.bounds.push(bnd);

                }, domain);

                return domain;
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
                    objectDOM = document.createElement(this.el);
                }

                // TODO: Populate the DOM with model values
            },

            formatXML: function(xmlString){
                return DataONEObject.prototype.formatXML.call(this, xmlString);
            },

            /**/
            getEMLPosition: function(objectDOM, nodeName) {
                var nodeOrder = ["formatString", "dateTimePrecision", "dateTimeDomain"];

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
            },

        });

        return EMLDateTimeDomain;
    }
);
