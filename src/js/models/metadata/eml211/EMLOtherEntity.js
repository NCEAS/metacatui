define(["jquery", "underscore", "backbone", "models/metadata/eml211/EMLEntity"],
    function($, _, Backbone, EMLEntity) {

        /**
        * @class EMLOtherEntity
         * @classdesc EMLOtherEntity represents a generic data entity, corresponding
         * with the EML otherEntity module.
         * @classcategory Models/Metadata/EML211
         * @see https://eml.ecoinformatics.org/schema/eml-dataset_xsd.html#DatasetType_otherEntity
         * @extends EMLEntity
         */
        var EMLOtherEntity = EMLEntity.extend(
          /** @lends EMLOtherEntity.prototype */{

        	//The class name for this model
        	type: "EMLOtherEntity",

            /* Attributes of any entity */
            defaults: function(){
	            return	_.extend({

		                /* Attributes from EML */
		                entityType: "otherEntity", // The type of the entity

		                /* Attributes not from EML */
		                nodeOrder: [ // The order of the top level XML element nodes
		                    "alternateIdentifier",
		                    "entityName",
		                    "entityDescription",
		                    "physical",
		                    "coverage",
		                    "methods",
		                    "additionalInfo",
		                    "attributeList",
		                    "constraint",
		                    "entityType"
		                ],

	            	}, EMLEntity.prototype.defaults());
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: _.extend({
                "entitytype": "entityType"

            }, EMLEntity.prototype.nodeNameMap),

            /* Initialize an EMLOtherEntity object */
            initialize: function(attributes) {

                // if options.parse = true, Backbone will call parse()

                // Call super() first
                this.constructor.__super__.initialize.apply(this, [attributes]);

                // EMLOtherEntity-specific work
                this.set("type", "otherEntity", {silent: true});

                // Register change events
                this.on( "change:entityType", EMLEntity.trickleUpChange);

            },

            /*
             * Parse the incoming other entity's XML elements
             */
            parse: function(attributes, options) {

                var attributes = attributes || {};

                // Call super() first
                attributes = this.constructor.__super__.parse.apply(this, [attributes, options]);

                // EMLOtherEntity-specific work
                var objectXML  = attributes.objectXML; // The otherEntity XML fragment
                var objectDOM; // The W3C DOM of the object XML fragment
                var $objectDOM; // The JQuery object of the XML fragment

                // Use the updated objectDOM if we have it
                if ( attributes.objectDOM ) {
                    $objectDOM = $(attributes.objectDOM);
                } else {
                    // Hmm, oddly not there, start from scratch =/
                    $objectDOM = $(objectXML);
                }

                // Add the entityType
                attributes.entityType = $objectDOM.children("entitytype").text();

                return attributes;
            },

            /* Copy the original XML and update fields in a DOM object */
            updateDOM: function(objectDOM) {
                var nodeToInsertAfter;
                var type = this.get("type") || "otherEntity";
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

                // And then update the EMLOtherEntity-specific fields
                // Update the entityName
                if ( this.get("entityType") ) {
                    if ( $(objectDOM).find("entityType").length ) {
                        $(objectDOM).find("entityType").text(this.get("entityType"));

                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "entityType");

                        if ( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("entitytype"))
                                .text(this.get("entityType"))[0]);
                        } else {
                            $(nodeToInsertAfter).after($(document.createElement("entitytype"))
                                .text(this.get("entityType"))[0]);
                        }
                    }
                }

                return objectDOM;
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

            /* Serialize the EML DOM to XML */
            serialize: function() {

                var xmlString = "";

                // Update the superclass fields in the objectDOM first
                var objectDOM = this.constructor.__super__.updateDOM.apply(this, []);

                // Then update the subclass fields in the objectDOM
                // TODO


                this.set("objectXML", xmlString);

                return xmlString;
            }

        });

        return EMLOtherEntity;
    }
);
