define(["jquery", "underscore", "backbone", "uuid", "models/DataONEObject",
        "models/metadata/eml211/EMLAttribute"],
    function($, _, Backbone, uuid, DataONEObject, EMLAttribute) {

        /**
         * @class EMLEntity
         * @classdesc EMLEntity represents an abstract data entity, corresponding
         * with the EML EntityGroup and other elements common to all
         * entity types, including otherEntity, dataTable, spatialVector,
         * spatialRaster, and storedProcedure
         * @classcategory Models/Metadata/EML211
         * @see https://eml.ecoinformatics.org/schema/eml-entity_xsd
         */
        var EMLEntity = Backbone.Model.extend(
          /** @lends EMLEntity.prototype */{

        	//The class name for this model
        	type: "EMLEntity",

            /* Attributes of any entity */
            defaults: function(){
            	return {
	                /* Attributes from EML */
	                xmlID: null, // The XML id of the entity
	                alternateIdentifier: [], // Zero or more alt ids
	                entityName: null, // Required, the name of the entity
	                entityDescription: null, // Description of the entity
	                physical: [], // Zero to many EMLPhysical objects
	                physicalMD5Checksum: null,
	                physicalSize: null,
	                physicalObjectName: null,
	                coverage: [], // Zero to many EML{Geo|Taxon|Temporal}Coverage objects
	                methods: null, // Zero or one EMLMethod object
	                additionalInfo: [], // Zero to many EMLText objects
	                attributeList: [], // Zero to many EMLAttribute objects
	                constraint: [], // Zero to many EMLConstraint objects
	                references: null, // A reference to another EMLEntity by id (needs work)

	                //Temporary attribute until we implement the eml-physical module
	                downloadID: null,
	                formatName: null,

	                /* Attributes not from EML */
	                nodeOrder: [ // The order of the top level XML element nodes
	                    "alternateIdentifier",
	                    "entityName",
	                    "entityDescription",
	                    "physical",
	                    "coverage",
	                    "methods",
	                    "additionalInfo",
	                    "annotation",
	                    "attributeList",
	                    "constraint"
	                ],
	                parentModel: null, // The parent model this entity belongs to
	                dataONEObject: null, //Reference to the DataONEObject this EMLEntity describes
	                objectXML: null, // The serialized XML of this EML entity
	                objectDOM: null,  // The DOM of this EML entity
                  type: "otherentity"
            	}
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

                //Listen to changes on the DataONEObject file name
                if(this.get("dataONEObject")){
                  this.listenTo(this.get("dataONEObject"), "change:fileName", this.updateFileName);
                }

                //Listen to changes on the DataONEObject to reset the listener
                this.on("change:dataONEObject", function(entity, dataONEObj){

                  //Stop listening to the old DataONEObject
                  if(this.previous("dataONEObject")){
                    this.stopListening(this.previous("dataONEObject"), "change:fileName");
                  }

                  //Listen to changes on the file name
                  this.listenTo(dataONEObj, "change:fileName", this.updateFileName);
                });

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
                var objectDOM = attributes.objectDOM;
                var objectXML = attributes.objectXML;

                // Use the cached object if we have it
                if ( objectDOM ) {
                    $objectDOM = $(objectDOM);
                } else if ( objectXML ) {
                    $objectDOM = $(objectXML);
                }

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

                //Get some physical attributes from the EMLPhysical module
                var physical = $objectDOM.find("physical");
                if(physical){
                	attributes.physicalSize = physical.find("size").text();
                	attributes.physicalObjectName = physical.find("objectname").text();

                	var checksumType = physical.find("authentication").attr("method");
                	if(checksumType == "MD5")
                		attributes.physicalMD5Checksum = physical.find("authentication").text();
                }

                attributes.objectXML = objectXML;
                attributes.objectDOM = $objectDOM[0];

                //Find the id from the download distribution URL
                var urlNode = $objectDOM.find("url");
                if(urlNode.length){
                	var downloadURL = urlNode.text(),
                		downloadID  = "";

                	if( downloadURL.indexOf("/resolve/") > -1 )
                		downloadID = downloadURL.substring( downloadURL.indexOf("/resolve/") + 9 );
                	else if( downloadURL.indexOf("/object/") > -1 )
                		downloadID = downloadURL.substring( downloadURL.indexOf("/object/") + 8 );
                	else if( downloadURL.indexOf("ecogrid") > -1 ){
                		var withoutEcoGridPrefix = downloadURL.substring( downloadURL.indexOf("ecogrid://") + 10 ),
							downloadID = withoutEcoGridPrefix.substring( withoutEcoGridPrefix.indexOf("/")+1 );
                	}


                	if(downloadID.length)
                        attributes.downloadID = downloadID;
                }

                //Find the format name
                var formatNode = $objectDOM.find("formatName");
                if(formatNode.length){
                	attributes.formatName = formatNode.text();
                }

                // Add the attributeList
                var attributeList = $objectDOM.find("attributelist");
                var attribute; // An individual EML attribute
                var options = {parse: true};
                attributes.attributeList = [];
                if ( attributeList.length ) {
                    _.each(attributeList[0].children, function(attr) {
                        attribute = new EMLAttribute(
                            {
                                objectDOM: attr,
                                objectXML: attr.outerHTML,
                                parentModel: this
                            }, options);
                        // Can't use this.addAttribute() here (no this yet)
                        attributes.attributeList.push(attribute);
                    }, this);

                }
                return attributes;
            },

            /*
             * Add an attribute to the attributeList, inserting it
             * at the zero-based index
             */
            addAttribute: function(attribute, index) {
                if ( typeof index == "undefined" ) {
                    this.get("attributeList").push(attribute);
                } else {
                    this.get("attributeList").splice(index, attribute);
                }

                this.trigger("change:attributeList");
            },

            /*
             * Remove an EMLAttribute model from the attributeList array
             *
             * @param {EMLAttribute} - The EMLAttribute model to remove from this model's attributeList
             */
            removeAttribute: function(attribute) {

              //Get the index of the EMLAttribute in the array
            	var attrIndex = this.get("attributeList").indexOf(attribute);

              //If this attribute model does not exist in the attribute list, don't do anything
              if( attrIndex == -1 ){
                return;
              }

              //Remove that index from the array
            	this.get("attributeList").splice(attrIndex, 1);

              //Trickle the change up the model chain
              this.trickleUpChange();
            },

            /* Validate the top level EMLEntity fields */
            validate: function() {
                var errors = {};

                // will be run by calls to isValid()
                if ( ! this.get("entityName") ) {
                    errors.entityName = "An entity name is required.";
                }

                //Validate the attributes
                var attributeErrors = this.validateAttributes();
                if(attributeErrors.length)
                  errors.attributeList = attributeErrors;

                if( Object.keys(errors).length )
                  return errors;
                else{
                  this.trigger("valid");
                  return false;
                }

            },

            /*
            * Validates each of the EMLAttribute models in the attributeList
            *
            * @return {Array} - Returns an array of error messages for all the EMlAttribute models
            */
            validateAttributes: function(){
              var errors = [];

              //Validate each of the EMLAttributes
              _.each( this.get("attributeList"), function(attribute){

                if( !attribute.isValid() ){
                  errors.push(attribute.validationError);
                }

              });

              return errors;
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

                //Update the id attribute on this XML node
                // update the id attribute
               if( this.get("dataONEObject") ){
                 //Ideally, the EMLEntity will use the object's id in it's id attribute, so we wil switch them
                 var xmlID = this.get("dataONEObject").getXMLSafeID();

                 //Set the xml-safe id on the model and use it as the id attribute
                 $(objectDOM).attr("id", xmlID);
                 this.set("xmlID", xmlID);
               }
               //If there isn't a matching DataONEObject but there is an id set on this model, use that id
               else if(this.get("xmlID")){
                $(objectDOM).attr("id", this.get("xmlID"));
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
                else{

                  // Remove all current alternateIdentifiers
                  $(objectDOM).find("alternateIdentifier").remove();

                }

                // Update the entityName
                if ( this.get("entityName") ) {
                    if ( $(objectDOM).find("entityName").length ) {
                        $(objectDOM).find("entityName").text(this.get("entityName"));

                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "entityName");
                        if ( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("entityName"))
                                .text(this.get("entityName"))[0]);
                        } else {
                            $(nodeToInsertAfter).after($(document.createElement("entityName"))
                                .text(this.get("entityName"))[0]);
                        }
                    }
                }

                // Update the entityDescription
                if ( this.get("entityDescription") ) {
                    if ( $(objectDOM).find("entityDescription").length ) {
                        $(objectDOM).find("entityDescription").text(this.get("entityDescription"));

                    } else {
                        nodeToInsertAfter = this.getEMLPosition(objectDOM, "entityDescription");
                        if ( ! nodeToInsertAfter ) {
                            $(objectDOM).append($(document.createElement("entityDescription"))
                                .text(this.get("entityDescription"))[0]);
                        } else {
                            $(nodeToInsertAfter).after($(document.createElement("entityDescription"))
                                .text(this.get("entityDescription"))[0]);
                        }
                    }
                }
                //If there is no entity description
                else{

                  //If there is an entity description node in the XML, remove it
                  $(objectDOM).find("entityDescription").remove();

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

                // Update the attributeList section
                let attributeList = this.get("attributeList");
                let attributeListInDOM = $(objectDOM).children("attributelist");
                let attributeListNode;
                if ( attributeListInDOM.length ) {
                    attributeListNode = attributeListInDOM[0];
                    $(attributeListNode).children().remove(); // Each attr will be replaced
                } else {
                    attributeListNode = document.createElement("attributeList");
                    nodeToInsertAfter = this.getEMLPosition(objectDOM, "attributeList");
                    if( ! nodeToInsertAfter ) {
                        $(objectDOM).append(attributeListNode);
                    } else {
                        $(nodeToInsertAfter).after(attributeListNode);
                    }
                }

                var updatedAttrDOM;
                if ( attributeList.length ) {
                    // Add each attribute
                    _.each(attributeList, function(attribute) {
                            updatedAttrDOM = attribute.updateDOM();
                            $(attributeListNode).append(updatedAttrDOM);
                    }, this);
                } else {
                    // Attributes are not defined, remove them from the DOM
                    attributeListNode.remove();
                }

                // TODO: Update the constraint section

                return objectDOM;
            },

            /**
            * Update the file name in the EML
            */
            updateFileName: function(){

              var dataONEObj = this.get("dataONEObject");

              //Get the DataONEObject model associated with this EML Entity
              if(dataONEObj){
                //If the last file name matched the EML entity name, then update it
                if( dataONEObj.previous("fileName") == this.get("entityName") ){
                  this.set("entityName", dataONEObj.get("fileName"));
                }
                //If the DataONEObject doesn't have an old file name or entity name, then update it
                else if( !dataONEObj.previous("fileName") || !this.get("entityName") ){
                  this.set("entityName", dataONEObj.get("fileName"));
                }
              }

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
                    return $(objectDOM).children().last()[0];
                }

                // Otherwise, go through each node in the node list and find the
                // position where this node will be inserted after
                for ( var i = position - 1; i >= 0; i-- ) {
                    if ( $(objectDOM).find( nodeOrder[i].toLowerCase() ).length ) {
                        return $(objectDOM).find(nodeOrder[i].toLowerCase()).last()[0];
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

            /*Format the EML XML for entities*/
            formatXML: function(xmlString){
                return DataONEObject.prototype.formatXML.call(this, xmlString);
            },

	        /* Let the top level package know of attribute changes from this object */
	        trickleUpChange: function(){
	            MetacatUI.rootDataPackage.packageModel.set("changed", true);
	        }
        });

        return EMLEntity;
    }
);
