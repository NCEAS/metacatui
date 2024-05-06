define(["jquery", "underscore", "backbone", "models/metadata/eml211/EMLEntity"],
    function($, _, Backbone, EMLEntity) {

        /**
        * @class EMLDataTable
         * @classdesc EMLDataTable represents a tabular data entity, corresponding
         * with the EML dataTable module.
         * @classcategory Models/Metadata/EML211
         * @see https://eml.ecoinformatics.org/schema/eml-datatable_xsd
         * @extends EMLEntity
         */
        var EMLDataTable = EMLEntity.extend(
          /** @lends EMLDataTable.prototype */{

            //The class name for this model
            type: "EMLDataTable",

            /* Attributes of any entity */
            defaults: function(){
                return    _.extend({

                        /* Attributes from EML */
                        caseSensitive: null, // The case sensitivity of the table records
                        numberOfRecords: null, // the number of records in the table
                        type: "dataTable",

                        /* Attributes not from EML */
                        nodeOrder: [ // The order of the top level XML element nodes
                            "caseSensitive",
                            "numberOfRecords",
                            "references"
                        ],

                    }, EMLEntity.prototype.defaults());
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: _.extend({
                "casesensitive" : "caseSensitive",
                "numberofrecords": "numberOfRecords"

            }, EMLEntity.prototype.nodeNameMap),

            /* Initialize an EMLDataTable object */
            initialize: function(attributes) {

                // if options.parse = true, Backbone will call parse()

                // Call super() first
                this.constructor.__super__.initialize.apply(this, [attributes]);

                // EMLDataTable-specific work
                this.set("type", "dataTable", {silent: true});

                // Register change events
                this.on( "change:caseSensitive change:numberOfRecords", EMLEntity.trickleUpChange);

            },

            /*
             * Parse the incoming other entity's XML elements
             */
            parse: function(attributes, options) {

                var attributes = attributes || {};

                // Call super() first
                attributes = this.constructor.__super__.parse.apply(this, [attributes, options]);

                // EMLDataTable-specific work
                var objectXML  = attributes.objectXML; // The dataTable XML fragment
                var objectDOM; // The W3C DOM of the object XML fragment
                var $objectDOM; // The JQuery object of the XML fragment

                // Use the updated objectDOM if we have it
                if ( attributes.objectDOM ) {
                    $objectDOM = $(attributes.objectDOM);
                } else {
                    // Hmm, oddly not there, start from scratch =/
                    $objectDOM = $(objectXML);
                }

                // Add the caseSensitive
                attributes.caseSensitive = $objectDOM.children("caseSensitive").text();

                // Add the numberOfRecords
                attributes.numberOfRecords = $objectDOM.children("numberOfRecords").text();

                // Add the references value
                attributes.references = $objectDOM.children("references").text();

                return attributes;
            },

            /* Copy the original XML and update fields in a DOM object */
            updateDOM: function(objectDOM) {
                var nodeToInsertAfter;
                var type = this.get("type") || "dataTable";
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

                // Now call the superclass
                objectDOM = this.constructor.__super__.updateDOM.apply(this, [objectDOM]);

                // And then update the EMLDataTable-specific fields
                // Update the caseSensitive field
                if ( this.get("caseSensitive") ) {
                    if ( $(objectDOM).find("caseSensitive").length ) {
                        $(objectDOM).find("caseSensitive").text(this.get("caseSensitive"));

                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "caseSensitive");

                        if ( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("casesensitive"))
                                .text(this.get("caseSensitive"))[0]);
                        } else {
                            $(nodeToInsertAfter).after($(document.createElement("casesensitive"))
                                .text(this.get("caseSensitive"))[0]);
                        }
                    }
                }

                // Update the numberOfRecords field
                if ( this.get("numberOfRecords") ) {
                    if ( $(objectDOM).find("numberOfRecords").length ) {
                        $(objectDOM).find("numberOfRecords").text(this.get("numberOfRecords"));

                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "numberOfRecords");

                        if ( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("numberofrecords"))
                                .text(this.get("numberOfRecords"))[0]);
                        } else {
                            $(nodeToInsertAfter).after($(document.createElement("numberofrecords"))
                                .text(this.get("numberOfRecords"))[0]);
                        }
                    }
                }

                return objectDOM;
            },

            /* Serialize the EML DOM to XML */
            serialize: function() {

                var xmlString = "";

                // Update the superclass fields in the objectDOM first
                var objectDOM = this.constructor.__super__.updateDOM.apply(this, []);

                // Then update the subclass fields in the objectDOM
                // TODO


                this.set("objectXML", xmlString);

                return xmlString;
            },

            /* Validate the datable's required fields */
            validate: function(){

              var errors = {};

              // Require the entity name
              if( !this.get("entityName") ) {
                  errors.entityName = "Please specify an data table name.";
              }

              //Validate the attributes
              var attributeErrors = this.validateAttributes();
              if(attributeErrors.length)
                errors.attributeList = errors;

              // Require the attribute list
              /*if( !this.get("attributeList").length ) {
                  errors.attributeList = "Please describe the table attributes (columns).";
              }*/

              if( Object.keys(errors).length ){
                return errors;
              }
              else{
                return false;
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

            }

        });

        return EMLDataTable;
    }
);
