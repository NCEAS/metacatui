"use strict";

define([
  "backbone",
  "models/metadata/eml211/EMLEntity",
  "models/metadata/eml211/EMLDataTable",
  "models/metadata/eml211/EMLOtherEntity",
], (Backbone, EMLEntity, EMLDataTable, EMLOtherEntity) => {
  // The names of the nodes that are considered entities in EML
  const ENTITY_NODE_NAMES = [
    "otherEntity",
    "dataTable",
    "spatialRaster",
    "spatialVector",
    "storedProcedure",
    "view",
  ];

  /**
   * @class InvalidAttributeListError
   * @classdesc An error that is thrown when an invalid attribute list is
   * encountered.
   * @classcategory Errors
   */
  class InvalidAttributeListError extends Error {
    constructor(message) {
      super(message);
      this.name = "InvalidAttributeListError";
    }
  }

  /**
   * @class EMLEntities
   * @classdesc A collection of EMLEntities.
   * @classcategory Collections/Metadata/EML
   * @since 0.0.0
   * @augments Backbone.Collection
   */
  const EMLEntities = Backbone.Collection.extend(
    /** @lends EMLEntities.prototype */
    {
      /** @inheritdoc */
      // eslint-disable-next-line object-shorthand, func-names
      model: function (attrs, options = {}) {
        // the name of the eml node determines the model to use
        const objDOM = attrs.objectDOM;
        const type =
          attrs.type?.toLowerCase() ||
          objDOM?.localName?.toLowerCase() ||
          objDOM?.nodeName?.toLowerCase();
        // the parent model is needed for functionality in the model
        const modifiedAttrs = { ...attrs };
        if (!attrs?.parentModel && options?.parentModel) {
          modifiedAttrs.parentModel = options.parentModel;
        }
        switch (type) {
          case "otherentity":
            return new EMLOtherEntity(modifiedAttrs, options);
          case "datatable":
            return new EMLDataTable(modifiedAttrs, options);
          default:
            return new EMLEntity(
              {
                entityType: "application/octet-stream",
                type,
                ...modifiedAttrs,
              },
              options,
            );
        }
      },

      /** @inheritdoc */
      parse(response, _options) {
        const entities =
          response.datasetNode?.querySelectorAll(ENTITY_NODE_NAMES.join(",")) ||
          [];
        return Array.from(entities).map((entity) => ({
          objectDOM: entity,
          parentModel: response.parentModel,
        }));
      },

      /** @inheritdoc */
      validate() {
        const errors = [];

        // Validate each of the EMLEntities
        this.each((model) => {
          if (!model.isValid()) {
            errors.push(model.validationError);
          }
        });
        return errors;
      },

      /**
       * Update an EML dataset node with the entities in this collection. Will
       * add, remove, or update entities and re-order according to the order in
       * this collection.
       * @param {Element} datasetNode The dataset node to update
       * @param {EML211} eml The EML model that contains the dataset node
       */
      updateDatasetDOM(datasetNode, eml) {
        const existingEntities = Array.from(
          datasetNode.querySelectorAll(ENTITY_NODE_NAMES.join(",")),
        );
        const emlModel = this.getParentModel();

        this.each((entity, i) => {
          // Replace or append node
          const existingEntity = existingEntities[i];
          if (existingEntity) existingEntity.remove();

          const nodeName = entity.get("type").toLowerCase();
          const position = emlModel.getEMLPosition(eml, nodeName);
          const updatedEntityDOM = entity.updateDOM();
          if (position?.length) {
            // position is a jQuery object
            position.after(updatedEntityDOM);
          } else {
            datasetNode.appendChild(updatedEntityDOM);
          }
        });

        // Remove extra nodes if any
        const extraEntities = existingEntities.length - this.length;
        if (extraEntities > 0) {
          const startIndex = existingEntities.length - extraEntities;
          existingEntities.slice(startIndex).forEach((node) => node.remove());
        }
      },

      /**
       * Add a new entity to the collection using info from a DataONE object.
       * Sets listeners to remove the entity if the DataONE object fails to
       * save, and to add it back if it later saves successfully.
       * @param {DataONEObject} dataONEObject DataONE object model
       * @param {object} options Options for the entity
       * @param {EMLModel} options.parentModel The parent model of the entity
       * @returns {EMLEntity} The new entity that was added to the collection
       */
      addFromDataONEObject(dataONEObject, options = {}) {
        const entity = this.add({
          entityName: dataONEObject.get("fileName"),
          entityType:
            dataONEObject.get("formatId") ||
            dataONEObject.get("mediaType") ||
            "application/octet-stream",
          dataONEObject,
          parentModel: options.parentModel || this.getParentModel(),
          xmlID: dataONEObject.getXMLSafeID(),
          // Important: Adding as a generic entity creates invalid EML
          type: "otherEntity",
        });
        this.stopListening(dataONEObject);
        this.listenTo(dataONEObject, "errorSaving", () => {
          this.remove(entity);
          // Listen for a successful save so the entity can be added back
          this.listenToOnce(dataONEObject, "successSaving", () => {
            this.add(entity);
          });
        });
        return entity;
      },

      /**
       * Search the collection for an entity that matches the given DataONE
       * object. Matches are made based on the DataONE object's identifier,
       * checksum, file name, or format type. Optionally, a DataPackage
       * collection can be provided to assess whether the entity is the only one
       * in the package, and therefore must be the entity for the given DataONE
       * object.
       * @param {DataONEObject} dataONEObject The DataONE object to match
       * @param {DataPackage} [dataPackage] The DataPackage collection to check
       * @returns {EMLEntity|boolean} The matching EMLEntity model or false if
       * no match is found
       */
      getByDataONEObject(dataONEObject, dataPackage) {
        // If an EMLEntity model has been found for this object before, consider
        // it a match.
        let foundEntity =
          dataONEObject.get("metadataEntity") ||
          this.find((ent) => ent.get("dataONEObject") === dataONEObject);

        const objFormatName =
          dataONEObject.get("formatId")?.toLowerCase() ||
          dataONEObject.get("mediaType")?.toLowerCase();

        if (!foundEntity) {
          // Gather information about the DataONE object
          const objID = dataONEObject.get("id");
          const objXMLID = dataONEObject.getXMLSafeID();
          const objCheckSum = dataONEObject.get("checksum");
          const objCheckSumIsMD5 =
            dataONEObject.get("checksumAlgorithm")?.toUpperCase() === "MD5";
          const objFileName = dataONEObject.get("fileName")?.toLowerCase();

          foundEntity = this.find((ent) => {
            // Matches of the checksum or identifier are definite matches
            if (objXMLID && objXMLID === ent.get("xmlID")) return true;

            const entCheckSum = ent.get("physicalMD5Checksum");
            if (objCheckSumIsMD5 && objCheckSum && objCheckSum === entCheckSum)
              return true;

            if (objID && objID === ent.get("downloadID")) return true;

            // If this entity name matches the dataone object file name, AND no
            // other dataone object file name matches, then we can assume this
            // is the entity element for this file.
            if (objFileName) {
              const fileNameMatches = this.getByFileName(objFileName);
              if (fileNameMatches?.length === 1 && fileNameMatches[0] === ent) {
                return true;
              }
            }

            return false;
          });
        }

        // Check if one data object is of this type in the package
        if (!foundEntity) {
          const formatMatches = this.getByFormatName(objFormatName);
          if (formatMatches?.length === 1) [foundEntity] = formatMatches;
        }

        // If this EML is in a DataPackage with only one other DataONEObject,
        // and there is only one entity in the EML, then we can assume they are
        // the same entity
        if (
          !foundEntity &&
          this.length === 1 &&
          dataPackage?.length === 2 &&
          dataPackage.models.includes(dataONEObject)
        ) {
          foundEntity = this.at(0);
          // TODO: Should we ensure that the entity is in this collection?
        }

        // If this entity has been matched to a different DataONEObject already,
        // then don't match it again. i.e. We will not override existing
        // entity<->DataONEObject pairings
        const entityDataONEObj = foundEntity?.get("dataONEObject");
        if (entityDataONEObj && entityDataONEObj !== dataONEObject) {
          foundEntity = false;
        }

        if (foundEntity) {
          foundEntity.set("dataONEObject", dataONEObject);
          // TODO: why are we setting an xmlID here? Should we check if it's
          // already set?
          const xmlID =
            this.getParentModel()?.getUniqueEntityId(dataONEObject) ||
            dataONEObject.getXMLSafeID();
          // TODO: should we check if these attrs are already set before
          // replacing?
          foundEntity.set("xmlID", xmlID);
          dataONEObject.set("metadataEntity", foundEntity);
        }

        return foundEntity || false;
      },

      /**
       * Get all entities in the collection that have the given format name set
       * as the entity type.
       * @param {string} formatName The format name to search for
       * @returns {EMLEntity[]} The entities that have the given format name
       */
      getByFormatName(formatName) {
        if (!formatName) return null;
        return this.filter((entity) => {
          const entFormatName = entity.get("entityType")?.toLowerCase();
          return entFormatName === formatName.toLowerCase();
        });
      },

      /**
       * Get all entities in the collection that have the given file name set as
       * the entity name or physical object name.
       * @param {string} fileName The file name to search for
       * @returns {EMLEntity[]} The entities that have the given file name
       */
      getByFileName(fileName) {
        const standardFileName = fileName.toLowerCase();
        return this.filter((entity) => {
          // Get the entity's file name in a standard format
          const entFileName = (
            entity.get("physicalObjectName") || entity.get("entityName")
          )?.toLowerCase();
          if (!entFileName) return false;
          const entFileNameUnderscored = entFileName?.replace(/ /g, "_");
          // Check if the entity's file name matches the given file name
          return (
            entFileName === standardFileName ||
            entFileNameUnderscored === standardFileName
          );
        });
      },

      /**
       * Get the model that contains this collection. Searches through all of
       * the entities in the collection to find the one that has the parentModel
       * set.
       * @returns {EMLEntity} The model that contains this collection or null if
       * no parent model is found
       */
      getParentModel() {
        // Iterate through the collection until the parent model is found
        const attrWithParent = this.find((attr) => attr.get("parentModel"));
        return attrWithParent ? attrWithParent.get("parentModel") : null;
      },

      /**
       * Check that the collection has at least one entity that has data.
       * @returns {boolean} True if the collection has at least one entity that
       * is not empty, false otherwise
       */
      hasNonEmptyEntity() {
        return this.some((model) => !model.isEmpty());
      },

      /**
       * Get the names of all the entities in the collection.
       * @returns {string[]} The names of all the entities in the collection,
       * either the entityName or physicalObjectName for each entity
       */
      getAllFileNames() {
        return this.map(
          (entity) =>
            entity.get("entityName") || entity.get("physicalObjectName"),
        );
      },

      /**
       * Duplicate the attribute list from a source entity to given target
       * entities in this collection. Any attributes in the target entities will
       * be removed and replaced with the source attributes. Remove events will
       * be triggered on the target entities. The attributes are copied over as
       * a deep copy, so changes to the new target attributes will not affect
       * the source attributes. If any xmlIDs are present in the copied
       * attributes, they will be removed.
       * @param {EMLEntity} source - The entity to copy attributes from. Must
       * contain at least one non-empty attribute.
       * @param {EMLEntity[]} targets - The entities to copy attributes to
       * @param {boolean} [errorIfInvalid] - If true (default), an error will be
       * thrown if any attributes from the source entity are invalid. If set to
       * false, only valid attributes will be copied over, and invalid
       * attributes will be ignored.
       */
      copyAttributeList(source, targets, errorIfInvalid = true) {
        if (!source || !targets) return;

        const sourceAttrs = source.get("attributeList");
        if (!sourceAttrs?.length || !sourceAttrs?.hasNonEmptyAttributes())
          return;

        // Invalid attributes can't be serialized and so can't be copied. Must
        // serialize to create deep copies of the attributes.
        if (
          errorIfInvalid &&
          source.get("attributeList").all((attr) => !attr.isValid())
        ) {
          const errors = source.get("attributeList").validate();
          throw new InvalidAttributeListError(
            errors.join ? errors.join("\n") : "Invalid attribute list",
          );
        }
        const attrsStr = source.get("attributeList").serialize();
        targets.forEach((entity) => {
          const attrList = entity.get("attributeList");
          // Use remove rather than reset to trigger events
          attrList.remove(attrList.models);
          attrList.add(attrsStr, { parse: true });
          // remove xmlID from the target attributes
          attrList.each((attr) => attr.unset("xmlID"));
        });
      },
    },
  );

  return EMLEntities;
});
