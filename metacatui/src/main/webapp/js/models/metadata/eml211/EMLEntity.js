define(["jquery", "underscore", "backbone", "models/DataONEObject"],
    function($, _, Backbone, DataONEObject) {

        /*
         * EMLEntity represents an abstract data entity, corresponding
         * with the EML EntityGroup and other elements common to all
         * entity types, including otherEntity, dataTable, spatialVector,
         * spatialRaster, and storedProcedure
         *
         * @see https://github.com/NCEAS/eml/blob/master/eml-entity.xsd
         */
        var EMLEntity = Backbone.Model.extend({

            /* Attributes of any entity */
            defaults: {

                /* Attributes from EML */
                xmlID: null, // The XML id of the entity
                alternateIdentifier: [], // Zero or more alt ids
                entityName: null, // Required, the name of the entity
                entityDescription: null, // Description of the entity
                physical: [], // Zero to many EMLPhysical objects
                coverage: [], // Zero to many EML{Geo|Taxon|Temporal}Coverage objects
                methods: null, // Zero or one EMLMethod object
                additionalInfo: [], // Zero to many EMLText objects
                attributeList: [], // Zero to many EMLAttribute objects
                constraint: [], // Zero to many EMLConstraint objects
                references: null, // A reference to another EMLEntity by id (needs work)

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
                    "constraint"
                ],
                parentModel: null, // The parent model this entity belongs to
                objectXML: null, // The serialized XML of this EML entity
                objectDOM: null  // The DOM of this EML entity
            },

            /*
             * The map of lower case to camel case node names
             * needed to deal with parsing issues with $.parseHTML().
             * Use this until we can figure out issues with $.parseXML().
             */
            nodeNameMap: {
                "alternateidentifier": "alternateIdentifier",
                "entityname": "entityName",
                "entitydescription": "entityDescription",
                "additionalinfo": "additionalInfo",
                "attributelist": "attributeList"
            },

            /* Initialize an EMLEntity object */
            initialize: function(attributes, options) {

                // if options.parse = true, Backbone will call parse()

                // Register change events
                this.on(
                    "change:alternateIdentifier " +
                    "change:entityName " +
                    "change:entityDescription " +
                    "change:physical " +
                    "change:coverage " +
                    "change:methods " +
                    "change:additionalInfo " +
                    "change:attributeList " +
                    "change:constraint " +
                    "change:references",
                    EMLEntity.trickleUpChange);
            },

            /*
             * Parse the incoming entity's common XML elements
             * Content example:
             * <otherEntity>
             *     <alternateIdentifier>file-alt.1.1.txt</alternateIdentifier>
             *     <alternateIdentifier>file-again.1.1.txt</alternateIdentifier>
             *     <entityName>file.1.1.txt</entityName>
             *     <entityDescription>A file summary</entityDescription>
             * </otherEntity>
             */
            parse: function(attributes, options) {
                var $objectDOM;
                var objectXML = attributes.objectXML;

                // Use the cached object if we have it
                if ( ! objectXML ) {
                    if ( this.get("objectXML") ) {
                        objectXML = this.get("objectXML");

                    } else {
                        return {};
                    }
                }

                $objectDOM = $(objectXML);

                // Add the XML id
                attributes.xmlID = $objectDOM.attr("id");

                // Add the alternateIdentifiers
                attributes.alternateIdentifier = [];
                var alternateIds = $objectDOM.children("alternateidentifier");
                _.each(alternateIds, function(alternateId) {
                    attributes.alternateIdentifier.push(alternateId.textContent);
                });

                // Add the entityName
                attributes.entityName = $objectDOM.children("entityname").text();

                // Add the entityDescription
                attributes.entityDescription = $objectDOM.children("entitydescription").text();

                attributes.objectXML = objectXML;
                attributes.objectDOM = $objectDOM[0];

                return attributes;
            },

            /*
             * Add an attribute to the attributeList, inserting it
             * at the zero-based index
             */
            addAttribute: function(attribute, index) {
                if ( ! index ) {
                    this.attributeList.push(attribute);
                } else {
                    this.attributeList.splice(index, attribute);
                }
            },

            /*
             * Remove an attribute from the attributeList
             */
            removeAttribute: function(attribute) {
                var attrIndex = this.attributeList.indexOf(attribute);
                this.attributelist.splice(attrIndex, 1);
            },

            /* Validate the top level EMLEntity fields */
            validate: function() {
                var errorMap = {};
                // will be run by calls to isValid()
                if ( ! this.get("entityName") ) {
                    errorMap.entityName = new Error("An entity name is required.");
                }

                return errorMap;
            },

            /* Copy the original XML and update fields in a DOM object */
            updateDOM: function() {
                var type = this.get("type") || "otherEntity";
                var objectDOM = this.get("objectDOM");
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
                
                // Update the alternateIdentifiers
                var altIDs = this.get("alternateIdentifier");
                if ( altIDs ) {
                    if ( altIDs.length ) {
                        // Copy and reverse the array for prepending
                        altIDs = Array.from(altIDs).reverse();
                        // Remove all current alternateIdentifiers
                        $(objectDOM).find("alternateIdentifier").remove();
                        // Add the new list back in
                        _.each(altIDs, function(altID) {
                            $(objectDOM).prepend(
                                $(document.createElement("alternateIdentifier"))
                                    .text(altID));
                        });
                    }
                }

                // Update the entityName
                if ( this.get("entityName") ) {
                    if( $(objectDOM).find("entityName").length ) {
                        $(objectDOM).find("entityName").text(this.get("entityName"));

                    } else {
                        this.getEMLPosition(objectDOM, "entityName")
                            .after($(document.createElement("entityName"))
                            .text(this.get("entityName"))
                        );
                    }
                }

                // Update the entityDescription
                if ( this.get("entityDescription") ) {
                    if( $(objectDOM).find("entityDescription").length ) {
                        $(objectDOM).find("entityDescription").text(this.get("entityDescription"));

                    } else {
                        this.getEMLPosition(objectDOM, "entityDescription")
                            .after($(document.createElement("entityDescription"))
                            .text(this.get("entityName"))
                        );
                    }
                }

                // TODO: Update the physical section

                // TODO: Update the coverage section

                // TODO: Update the methods section


                // Update the additionalInfo
                var addInfos = this.get("additionalInfo");
                if ( addInfos ) {
                    if ( addInfos.length ) {
                        // Copy and reverse the array for prepending
                        addInfos = Array.from(addInfos).reverse();
                        // Remove all current alternateIdentifiers
                        $(objectDOM).find("additionalInfo").remove();
                        // Add the new list back in
                        _.each(addInfos, function(additionalInfo) {
                            $(objectDOM).prepend(
                                document.createElement("additionalInfo")
                                    .text(additionalInfo));
                        });
                    }
                }

                // TODO: Update the attributeList section

                // TODO: Update the constraint section

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

            /*Format the EML XML for entities*/
            formatXML: function(xmlString){
                return DataONEObject.prototype.formatXML.call(this, xmlString);
            }


        },

        {
            /* Let the top level package know of attribute changes from this object */
            trickleUpChange: function(){
                MetacatUI.rootDataPackage.packageModel.set("changed", true);
            },

            /* Create a random id for entities */
            createID: function(){
                this.set("xmlID",
                 Math.ceil(Math.random() *
                 (9999999999999999 - 1000000000000000) + 1000000000000000));
            }

        });

        return EMLEntity;
    }
);
