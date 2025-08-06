define([
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "models/metadata/eml211/EMLAttribute",
  "models/metadata/eml211/EMLAttributeList",
  "common/EMLUtilities",
], (
  $,
  _,
  Backbone,
  DataONEObject,
  EMLAttribute,
  EMLAttributeList,
  EMLUtilities,
) => {
  /**
   * @class EMLEntity
   * @classdesc EMLEntity represents an abstract data entity, corresponding with
   * the EML EntityGroup and other elements common to all entity types,
   * including otherEntity, dataTable, spatialVector, spatialRaster, and
   * storedProcedure
   * @classcategory Models/Metadata/EML211
   * @see https://eml.ecoinformatics.org/schema/eml-entity_xsd
   * @augments Backbone.Model
   */
  const EMLEntity = Backbone.Model.extend(
    /** @lends EMLEntity.prototype */ {
      // The class name for this model
      type: "EMLEntity",

      /**
       * Attributes of any entity
       * @returns {object} - The default attributes
       * @property {string} xmlID - The XML id of the entity
       * @property {Array} alternateIdentifier - Zero or more alt ids
       * @property {string} entityName - Required, the name of the entity
       * @property {string} entityDescription - Description of the entity
       * @property {Array} physical - Zero to many EMLPhysical objects
       * @property {string} physicalMD5Checksum - The MD5 checksum of the
       * physical object
       * @property {string} physicalSize - The size of the physical object in
       * bytes
       * @property {string} physicalObjectName - The name of the physical object
       * @property {Array} coverage - Zero to many
       * EML{Geo|Taxon|Temporal}Coverage objects
       * @property {EMLMethod} methods - Zero or one EMLMethod object
       * @property {Array} additionalInfo - Zero to many EMLText objects
       * @property {EMLAttributes} attributeList - Zero to many EMLAttribute
       * objects as a collection
       * @property {Array} constraint - Zero to many EMLConstraint objects
       * @property {string} references - A reference to another EMLEntity by id
       * (needs work)
       * @property {string} downloadID - A temporary attribute until we
       * implement the eml-physical module
       * @property {string} formatName - A temporary attribute until we
       * implement the eml-physical module
       * @property {Array} nodeOrder - The order of the top level XML element
       * nodes
       * @property {EML211} parentModel - The parent model this entity belongs
       * to
       * @property {DataONEObject} dataONEObject - Reference to the
       * DataONEObject this EMLEntity describes
       * @property {string} objectXML - The serialized XML of this EML entity
       * @property {object} objectDOM - The DOM of this EML entity
       * @property {string} type - The type of entity
       */
      defaults() {
        return {
          // Attributes from EML
          xmlID: null,
          alternateIdentifier: [],
          entityName: null,
          entityDescription: null,
          physical: [],
          physicalMD5Checksum: null,
          physicalSize: null,
          physicalObjectName: null,
          coverage: [],
          methods: null,
          additionalInfo: [],
          attributeList: null,
          constraint: [],
          references: null,

          // Temporary attribute until we implement the eml-physical module
          downloadID: null,
          formatName: null,

          // Attributes not from EML
          nodeOrder: [
            // The order of the top level XML element nodes
            "alternateIdentifier",
            "entityName",
            "entityDescription",
            "physical",
            "coverage",
            "methods",
            "additionalInfo",
            "annotation",
            "attributeList",
            "constraint",
          ],
          parentModel: null,
          dataONEObject: null,
          objectXML: null,
          objectDOM: null,
          type: "otherentity",
        };
      },

      /**
       * The map of lower case to camel case node names needed to deal with
       * parsing issues with $.parseHTML(). Use this until we can figure out
       * issues with $.parseXML().
       */
      nodeNameMap: {
        alternateidentifier: "alternateIdentifier",
        entityname: "entityName",
        entitydescription: "entityDescription",
        additionalinfo: "additionalInfo",
        attributelist: "attributeList",
      },

      /** @inheritdoc */
      initialize(attributes = {}, _options = {}) {
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
            "change:constraint " +
            "change:references",
          EMLEntity.trickleUpChange,
        );

        // Listen to changes on the DataONEObject file name
        if (this.get("dataONEObject")) {
          this.listenTo(
            this.get("dataONEObject"),
            "change:fileName",
            this.updateFileName,
          );
        }

        // Listen to changes on the DataONEObject to reset the listener
        const model = this;
        this.on("change:dataONEObject", (_entity, dataONEObj) => {
          // Stop listening to the old DataONEObject
          if (model.previous("dataONEObject")) {
            model.stopListening(
              model.previous("dataONEObject"),
              "change:fileName",
            );
          }
          // Listen to changes on the file name
          model.listenTo(dataONEObj, "change:fileName", model.updateFileName);
        });

        if (!attributes?.attributeList && !this.get("attributeList")) {
          this.set(
            "attributeList",
            new EMLAttributeList({
              parentModel: this,
            }),
          );
        }

        this.listenToAttributeList();
      },

      /**
       * Listen to changes on the attributeList collection and trigger change
       * events on the parent model and collection
       */
      listenToAttributeList() {
        const prevAttrList = this.previous("attributeList");
        if (prevAttrList)
          this.stopListening(prevAttrList, "change:emlAttributes");

        const attrList = this.get("attributeList");
        if (!attrList) return;

        this.stopListening(attrList, "change:emlAttributes");

        this.listenTo(attrList, "change:emlAttributes", () => {
          this.trickleUpChange();
          this.trigger("change", this, attrList);
          this.trigger("change:attributeList", this, attrList);
          this.collection.trigger("update", this, attrList);
        });
      },

      /**
       * Parse the incoming entity's common XML elements Content example:
       * <otherEntity>
       * <alternateIdentifier>file-alt.1.1.txt</alternateIdentifier>
       * <alternateIdentifier>file-again.1.1.txt</alternateIdentifier>
       * <entityName>file.1.1.txt</entityName> <entityDescription>A file
       * summary</entityDescription> </otherEntity>
       * @param {object} attrs - The XML attributes
       * @param {object} options - Any options passed to the parse function
       * @returns {object} - The parsed attributes
       */
      parse(attrs, options) {
        const attributes = attrs || {};
        let $objectDOM;
        const { objectDOM } = attributes;
        const { objectXML } = attributes;

        // Use the cached object if we have it
        if (objectDOM) {
          $objectDOM = $(objectDOM);
        } else if (objectXML) {
          $objectDOM = $(objectXML);
        }

        // Add the XML id
        attributes.xmlID = $objectDOM.attr("id");

        // Add the alternateIdentifiers
        attributes.alternateIdentifier = [];
        const alternateIds = $objectDOM.children("alternateidentifier");
        _.each(alternateIds, (alternateId) => {
          attributes.alternateIdentifier.push(alternateId.textContent);
        });

        // Add the entityName
        attributes.entityName = $objectDOM.children("entityname").text();

        // Add the entityDescription
        attributes.entityDescription = $objectDOM
          .children("entitydescription")
          .text();

        // Get some physical attributes from the EMLPhysical module
        const physical = $objectDOM.find("physical");
        if (physical) {
          attributes.physicalSize = physical.find("size").text();
          attributes.physicalObjectName = physical.find("objectname").text();

          const checksumType = physical.find("authentication").attr("method");
          if (checksumType === "MD5")
            attributes.physicalMD5Checksum = physical
              .find("authentication")
              .text();
        }

        attributes.objectXML = objectXML;
        [attributes.objectDOM] = Array.from($objectDOM);

        // Find the id from the download distribution URL
        const urlNode = $objectDOM.find("url");
        if (urlNode.length) {
          const downloadURL = urlNode.text();
          let downloadID = "";

          if (downloadURL.indexOf("/resolve/") > -1)
            downloadID = downloadURL.substring(
              downloadURL.indexOf("/resolve/") + 9,
            );
          else if (downloadURL.indexOf("/object/") > -1)
            downloadID = downloadURL.substring(
              downloadURL.indexOf("/object/") + 8,
            );
          else if (downloadURL.indexOf("ecogrid") > -1) {
            const withoutEcoGridPrefix = downloadURL.substring(
              downloadURL.indexOf("ecogrid://") + 10,
            );
            downloadID = withoutEcoGridPrefix.substring(
              withoutEcoGridPrefix.indexOf("/") + 1,
            );
          }

          if (downloadID.length) attributes.downloadID = downloadID;
        }

        // Find the format name
        const formatNode = $objectDOM.find("formatName");
        if (formatNode.length) {
          attributes.formatName = formatNode.text();
        }

        let attributeList = $objectDOM.find("attributelist");
        attributeList = attributeList.length ? attributeList : null;

        const parentModel = this;
        const opts = {
          ...options,
          parse: true,
          parentModel,
        };

        attributes.attributeList = new EMLAttributeList(attributeList, opts);

        return attributes;
      },

      /**
       * Add an attribute to the attributeList, inserting it at the zero-based
       * index
       * @param {EMLAttribute} attribute - The EMLAttribute model to add
       * @param {number} index - The index to insert the attribute at
       */
      addAttribute(attribute, index) {
        const options = !index && index !== 0 ? {} : { at: index };
        const attrList = this.get("attributeList");
        attribute.set("parentModel", attrList);
        attrList.get("emlAttributes").addAttribute(attribute, options);
      },

      /**
       * Remove an EMLAttribute model from the attributeList array
       * @param {EMLAttribute} attribute - The EMLAttribute model to remove from
       * this model's attributeList
       */
      removeAttribute(attribute) {
        // Remove that index from the array
        this.get("attributeList").get("emlAttributes").remove(attribute);
      },

      /** @inheritdoc */
      validate() {
        const errors = {};

        // will be run by calls to isValid()
        if (!this.get("entityName")) {
          errors.entityName = "An entity name is required.";
        }

        // Validate the attributes
        const attributeErrors = this.validateAttributes();
        if (attributeErrors.length) errors.attributeList = attributeErrors;

        if (Object.keys(errors).length) return errors;

        this.trigger("valid");
        return false;
      },

      /**
       * Validates each of the EMLAttribute models in the attributeList
       * @returns {Array} - Returns an array of error messages for all the
       * EMlAttribute models
       */
      validateAttributes() {
        return this.get("attributeList").validate();
      },

      /**
       * Copy the original XML and update fields in a DOM object
       * @param {object} objectDOMOriginal - The original DOM object
       * @returns {object} - The updated DOM object
       */
      updateDOM(objectDOMOriginal) {
        // Copy the original DOM object
        let objectDOM = objectDOMOriginal?.cloneNode(true);
        let nodeToInsertAfter;
        const type = this.get("type") || "otherEntity";
        if (!objectDOM) {
          objectDOM = this.get("objectDOM");
        }
        const objectXML = this.get("objectXML");

        // If present, use the cached DOM
        if (objectDOM) {
          objectDOM = objectDOM.cloneNode(true);

          // otherwise, use the cached XML
        } else if (objectXML) {
          objectDOM = $(objectXML)[0].cloneNode(true);

          // This is new, create it
        } else {
          objectDOM = document.createElement(type);
        }

        // Update the id attribute on this XML node update the id attribute.
        // TODO: This could impact EML <references> that refer to the original
        // id.
        if (this.get("dataONEObject")) {
          // Ideally, the EMLEntity will use the object's id in it's id
          // attribute, so we wil switch them
          const xmlID = this.get("dataONEObject").getXMLSafeID();

          // Set the xml-safe id on the model and use it as the id attribute
          $(objectDOM).attr("id", xmlID);
          this.set("xmlID", xmlID);
        }
        // If there isn't a matching DataONEObject but there is an id set on
        // this model, use that id
        else if (this.get("xmlID")) {
          $(objectDOM).attr("id", this.get("xmlID"));
        }

        // Update the alternateIdentifiers
        let altIDs = this.get("alternateIdentifier");
        if (altIDs) {
          if (altIDs.length) {
            // Copy and reverse the array for prepending
            altIDs = Array.from(altIDs).reverse();
            // Remove all current alternateIdentifiers
            $(objectDOM).find("alternateIdentifier").remove();
            // Add the new list back in
            _.each(altIDs, (altID) => {
              $(objectDOM).prepend(
                $(document.createElement("alternateIdentifier")).text(altID),
              );
            });
          }
        } else {
          // Remove all current alternateIdentifiers
          $(objectDOM).find("alternateIdentifier").remove();
        }

        // Update the entityName
        if (this.get("entityName")) {
          if ($(objectDOM).find("entityName").length) {
            $(objectDOM).find("entityName").text(this.get("entityName"));
          } else {
            nodeToInsertAfter = this.getEMLPosition(objectDOM, "entityName");
            if (!nodeToInsertAfter) {
              $(objectDOM).append(
                $(document.createElement("entityName")).text(
                  this.get("entityName"),
                )[0],
              );
            } else {
              $(nodeToInsertAfter).after(
                $(document.createElement("entityName")).text(
                  this.get("entityName"),
                )[0],
              );
            }
          }
        }

        // Update the entityDescription
        if (this.get("entityDescription")) {
          if ($(objectDOM).find("entityDescription").length) {
            $(objectDOM)
              .find("entityDescription")
              .text(this.get("entityDescription"));
          } else {
            nodeToInsertAfter = this.getEMLPosition(
              objectDOM,
              "entityDescription",
            );
            if (!nodeToInsertAfter) {
              $(objectDOM).append(
                $(document.createElement("entityDescription")).text(
                  this.get("entityDescription"),
                )[0],
              );
            } else {
              $(nodeToInsertAfter).after(
                $(document.createElement("entityDescription")).text(
                  this.get("entityDescription"),
                )[0],
              );
            }
          }
        }
        // If there is no entity description
        else {
          // If there is an entity description node in the XML, remove it
          $(objectDOM).find("entityDescription").remove();
        }

        // TODO: Update the physical section

        // TODO: Update the coverage section

        // TODO: Update the methods section

        // Update the additionalInfo
        let addInfos = this.get("additionalInfo");
        if (addInfos) {
          if (addInfos.length) {
            // Copy and reverse the array for prepending
            addInfos = Array.from(addInfos).reverse();
            // Remove all current alternateIdentifiers
            $(objectDOM).find("additionalInfo").remove();
            // Add the new list back in
            _.each(addInfos, (additionalInfo) => {
              $(objectDOM).prepend(
                document.createElement("additionalInfo").text(additionalInfo),
              );
            });
          }
        }

        // Update the attributeList section
        const $attrList = $(objectDOM).find("attributelist");
        const attributeList = this.get("attributeList");

        // If the attributeList is empty, remove it from the DOM
        if (attributeList.isEmpty()) {
          $attrList.remove();
        } else {
          // Attribute list coll expects a DOM node not jQuery object
          const newAttrListDOM = attributeList.updateDOM($attrList.get(0));

          // If there wasn't already an attributeList in the DOM, add the new
          // one created by the collection
          if (!$attrList.length) {
            nodeToInsertAfter = this.getEMLPosition(objectDOM, "attributeList");
            if (!nodeToInsertAfter) {
              $(objectDOM).append(newAttrListDOM);
            } else {
              $(nodeToInsertAfter).after(newAttrListDOM);
            }
          } else {
            // Otherwise, update the existing attributeList
            $attrList.replaceWith(newAttrListDOM);
          }
        }

        return objectDOM;
      },

      /**
       * Update the file name in the EML
       */
      updateFileName() {
        const dataONEObj = this.get("dataONEObject");

        // Get the DataONEObject model associated with this EML Entity
        if (dataONEObj) {
          // If the last file name matched the EML entity name, then update it
          if (dataONEObj.previous("fileName") === this.get("entityName")) {
            this.set("entityName", dataONEObj.get("fileName"));
          }
          // If the DataONEObject doesn't have an old file name or entity name,
          // then update it
          else if (
            !dataONEObj.previous("fileName") ||
            !this.get("entityName")
          ) {
            this.set("entityName", dataONEObj.get("fileName"));
          }
        }
      },

      /**
       * Get the file name for the entity
       * @returns {string} - The file name for the entity
       */
      getFileName() {
        return (
          this.get("entityName") ||
          this.get("physicalObjectName") ||
          this.get("dataONEObject").get("fileName")
        );
      },

      /**
       * Get the id for the entity
       * @returns {string} - The id for the entity
       */
      getId() {
        return this.get("xmlID") || this.get("dataONEObject")?.get("id");
      },

      /**
       * Get the DOM node preceding the given nodeName to find what position in
       * the EML document the named node should be appended
       * @param {object} objectDOM - The DOM object to search
       * @param {string} nodeName - The name of the node to find
       * @returns {object} - The DOM node to insert after
       */
      getEMLPosition(objectDOM, nodeName) {
        const nodeOrder = this.get("nodeOrder");

        const position = _.indexOf(nodeOrder, nodeName);

        // Append to the bottom if not found
        if (position === -1) {
          return $(objectDOM).children().last()[0];
        }

        // Otherwise, go through each node in the node list and find the
        // position where this node will be inserted after
        for (let i = position - 1; i >= 0; i -= 1) {
          if ($(objectDOM).find(nodeOrder[i].toLowerCase()).length) {
            return $(objectDOM).find(nodeOrder[i].toLowerCase()).last()[0];
          }
        }

        // If no nodes are found, append to the bottom
        return $(objectDOM).children().last()[0];
      },

      /**
       * Climbs up the model heirarchy until it finds the EML model
       * @returns {EML211|false} - Returns the EML 211 Model or false if not
       * found
       */
      getParentEML() {
        return EMLUtilities.getParentEML(this);
      },

      /**
       * Format the EML XML for entities
       * @param {string} xmlString - The XML string to format
       * @returns {string} - The formatted XML string
       */
      formatXML(xmlString) {
        return DataONEObject.prototype.formatXML.call(this, xmlString);
      },

      /** Pass any change events up to the parent EML model */
      trickleUpChange() {
        MetacatUI.rootDataPackage?.packageModel?.set("changed", true);
      },
    },
  );

  return EMLEntity;
});
