define(["jquery", "underscore", "backbone",
        "models/DataONEObject"],
    function($, _, Backbone, DataONEObject) {

        /**
         * @classdesc EMLDateTimeDomain represents the measurement scale of a date/time
         * attribute.
         * @classcategory Models/Metadata/EML211
         * @see https://github.com/NCEAS/eml/blob/master/eml-attribute.xsd
         */
        var EMLDateTimeDomain = Backbone.Model.extend(
          /** @lends EMLDateTimeDomain.prototype */{

        	type: "EMLDateTimeDomain",

            /* Attributes of an EMLDateTimeDomain object */
            el: "datetime",

            defaults: function(){
                return {
                  /* Attributes from EML */
                  formatString: null, // Required format string (e.g. YYYY)
                  dateTimePrecision: null, // The precision of the date time value
                  dateTimeDomain: null, // Zero or more bounds, or a references object
                  /* Attributes not from EML */
                  type: "dateTime",
                  parentModel: null, // The parent model this attribute belongs to
                  objectXML: null, // The serialized XML of this EML measurement scale
                  objectDOM: null  // The DOM of this EML measurement scale
                }
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
              "alternativetimescale" : "alternativeTimeScale",
                "datetime": "dateTime",
                "formatstring": "formatString",
                "datetimeprecision": "dateTimePrecision",
                "datetimedomain": "dateTimeDomain",
                "timescalename" : "timeScaleName",
                "timescaleageestimate" : "timeScaleAgeEstimate",
                "timescaleageuncertainty" : "timeScaleAgeUncertainty",
                "timescaleageexplanation" : "timeScaleAgeExplanation",
                "timescalecitation" : "timeScaleCitation"
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
                        bnd.exclusive = $(bound).find("minimum").attr("exclusive");
                    }
                    // Get the maximum if available
                    var max = $(bound).find("maximum").text();
                    if ( max ) {
                        bnd.maximum = max;
                        bnd.exclusive = $(bound).find("maximum").attr("exclusive");
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
            updateDOM: function(objectDOM) {

                var nodeToInsertAfter;
                var type = this.get("type") || "datetime";
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

                // Update the formatString
                if ( this.get("formatString") ) {
                    if ( $(objectDOM).find("formatstring").length ) {
                        $(objectDOM).find("formatstring").text(this.get("formatString"));
                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "formatString");

                        if( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("formatstring"))
                                .text(this.get("formatString"))[0]);
                        } else {
                            $(nodeToInsertAfter).after(
                                $(document.createElement("formatstring"))
                                    .text(this.get("formatString"))[0]
                            );
                        }
                    }
                }
                /* TODO: Uncomment out when formatstrings are better supported
                else{
                  $(objectDOM).find("formatstring").remove();
                }
                */

                // Update the dateTimePrecision
                if ( this.get("dateTimePrecision") ) {
                    if ( $(objectDOM).find("datetimeprecision").length ) {
                        $(objectDOM).find("datetimeprecision").text(this.get("dateTimePrecision"));
                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "dateTimePrecision");

                        if( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("datetimeprecision"))
                                .text(this.get("dateTimePrecision"))[0]);
                        } else {
                            $(nodeToInsertAfter).after(
                                $(document.createElement("datetimeprecision"))
                                    .text(this.get("dateTimePrecision"))[0]
                            );
                        }
                    }
                }
                /* TODO: Uncomment out when datetimeprecision if better supported
                else{
                  $(objectDOM).find("datetimeprecision").remove();
                }
                */

                // Update the dateTimeDomain
                var dateTimeDomain = this.get("dateTimeDomain");
                var dateTimeDomainNode = $(objectDOM).find("datetimedomain")[0];
                var minBound;
                var maxBound;
                var boundsNode;
                var minBoundNode;
                var maxBoundNode;
                if ( dateTimeDomain ) {

                    // Remove the existing dateTimeDomain node
                    if ( typeof dateTimeDomainNode !== "undefined" ) {
                        dateTimeDomainNode.remove();
                    }

                    // Do we have bounds?
                    if ( typeof dateTimeDomain.bounds !== "undefined" &&
                         dateTimeDomain.bounds.length ) {
                        // Build the new dateTimeDomain node
                        dateTimeDomainNode = document.createElement("datetimedomain");

                        _.each(dateTimeDomain.bounds, function(bound) {
                            minBound = bound.minimum;
                            maxBound = bound.maximum;
                            boundsNode = document.createElement("bounds");
                            var hasBounds = typeof minBound !== "undefined" || typeof maxBound !== "undefined";
                            if ( hasBounds ) {
                                // Populate the minimum element
                                if ( typeof minBound !== "undefined" ) {
                                    minBoundNode = $(document.createElement("minimum"));
                                    minBoundNode.text(minBound);

                                    if(bound.exclusive === true || bound.exclusive == "true")
                                      minBoundNode.attr("exclusive", "true");
                                    else
                                      minBoundNode.attr("exclusive", "false");

                                    $(boundsNode).append(minBoundNode);
                                }

                                // Populate the maximum element
                                if ( typeof maxBound !== "undefined" ) {
                                    maxBoundNode = $(document.createElement("maximum"));
                                    maxBoundNode.text(maxBound);

                                    if(bound.exclusive === true || bound.exclusive == "true")
                                      maxBoundNode.attr("exclusive", "true");
                                    else
                                      maxBoundNode.attr("exclusive", "false");

                                    $(boundsNode).append(maxBoundNode);
                                }

                                //If the bounds are populated, append it to the date time domain node
                                if( $(boundsNode).children().length > 0 )
                                  $(dateTimeDomainNode).append(boundsNode);

                            } else {
                                // Do nothing. Content is missing, don't append the node
                            }
                        });
                    } else {
                        // Basically do nothing. Don't append the dateTimeDomain element
                        // TODO: handle dateTimeDomain.references

                    }
                    nodeToInsertAfter = this.getEMLPosition(objectDOM, "dateTimeDomain");

                    if( ! nodeToInsertAfter ) {
                        $(objectDOM).append(dateTimeDomainNode);
                    } else {
                        $(nodeToInsertAfter).after(dateTimeDomainNode);
                    }
                }
                return objectDOM;
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
            },

            /* Validate the values of this model */
            validate: function(){
            	if( !this.get("formatString") )
            		return { formatString: "Choose a date-time format." }
            	else{

            		this.trigger("valid");
            		return;

            	}
            }

        });

        return EMLDateTimeDomain;
    }
);
