"use strict";

define([
  "jquery",
  "backbone",
  "models/metadata/eml211/EMLAttribute",
  "models/DataONEObject",
], ($, Backbone, EMLAttribute, DataONEObject) => {
  /**
   * @class EMLAttributes
   * @classdesc A collection of EMLAttributes.
   * @classcategory Collections/Metadata/EML
   * @since 2.33.0
   * @augments Backbone.Collection
   */
  const EMLAttributes = Backbone.Collection.extend(
    /** @lends EMLAttributes.prototype */
    {
      /** @inheritdoc */
      model: EMLAttribute,

      /** @inheritdoc */
      parse(response, options) {
        const attributeListDOM = response;
        if (!attributeListDOM) return [];
        const attributeNodes =
          attributeListDOM.getElementsByTagName("attribute");
        return Array.from(attributeNodes).map((attr) => ({
          objectDOM: attr,
          objectXML: attr.outerHTML,
          parentModel: options.parentModel,
        }));
      },

      /**
       * Ensure new models are always at the end of the collection.
       * @param {EMLAttribute} model - The model to compare
       * @returns {number} A value greater than 0 if the model is new, 0
       * otherwise
       */
      comparator(model) {
        // If the model is new, return a value greater than 0 to sort it to the end
        if (model.get("isNew")) {
          return 1;
        }
        // Otherwise, return 0 to keep the order of the existing models
        return 0;
      },

      /**
       * Get the model that contains this collection. Searches through all of
       * the attributes in the collection to find the one that has the
       * parentModel set.
       * @returns {EMLEntity} The model that contains this collection or null if
       * no parent model is found
       */
      getParentModel() {
        // Iterate through the collection until the parent model is found
        const attrWithParent = this.find((attr) => attr.get("parentModel"));
        return attrWithParent ? attrWithParent.get("parentModel") : null;
      },

      /**
       * Add an attribute to the collection. Will try to set the parentModel
       * if it is not already set.
       * @param {object} attributes - The model attributes of the new EML
       * attribute, optional. May include the parentModel
       * @param {object} options - Options to pass to the add method
       * @returns {EMLAttribute} The newly added attribute
       */
      addAttribute(attributes = {}, options = {}) {
        // A parent (entity) model is required for some of Attribute's methods
        const modifiedAttrs = { ...attributes };
        if (!modifiedAttrs.parentModel) {
          modifiedAttrs.parentModel = this.getParentModel();
        }
        if (!modifiedAttrs.xmlID) {
          modifiedAttrs.xmlID = DataONEObject.generateId();
        }
        return this.add(modifiedAttrs, options);
      },

      /**
       * Find the first attribute in the collection that is marked as new
       * @returns {EMLAttribute} The new attribute model or null if none found
       */
      getNewAttribute() {
        return this.find((model) => model.get("isNew"));
      },

      /**
       * Add a new attribute to the collection. Only allows one new attribute to
       * be added at a time (unless allowMultiple is true). Returns the existing
       * new attribute if one is already present.
       * @param {EMLEntity} parentModel The model that contains this collection,
       * optional
       * @param {boolean} allowMultiple - If true, allows multiple new
       * attributes to be added. If false, only one new attribute can be added
       * at a time. Defaults to false.
       * @returns {EMLAttribute} The newly added attribute model
       */
      addNewAttribute(parentModel, allowMultiple = false) {
        if (!allowMultiple) {
          const existingNewAttribute = this.getNewAttribute();
          if (existingNewAttribute) {
            return existingNewAttribute;
          }
        }
        return this.addAttribute({
          parentModel,
          isNew: true,
        });
      },

      /**
       * Check that the collection has at least one attribute that has data.
       * @returns {boolean} True if the collection has at least one attribute
       * that is not empty, false otherwise
       */
      hasNonEmptyAttributes() {
        return this.some((attr) => !attr.isEmpty());
      },

      /**
       * Remove all attributes that are empty
       * @returns {EMLAttribute[]} The removed attributes
       */
      removeEmptyAttributes() {
        const emptyAttributes = this.filter((attr) => attr.isEmpty());
        return this.remove(emptyAttributes);
      },

      /**
       * Given an array of strings, update the names of the attributes in the
       * collection to match the array. If the number of names in the array
       * exceeds the number of attributes in the collection, new attributes will
       * be added to the collection. If the number of names is less than the
       * number of attributes in the collection, the extra attributes will be
       * removed.
       * @param {string[]} names - An array of new attribute names
       * @param {EMLEntity} parentModel - The model that contains this
       * collection
       * @param {object} options - Options to pass to the add, remove, and set
       * methods
       */
      updateNames(names, parentModel, options = {}) {
        const modelsToRemove = this.models.slice(names.length);
        // Remove extra attributes
        this.remove(modelsToRemove, options);
        // Update the names of the existing attributes
        this.each((attribute, index) => {
          attribute.set("attributeName", names[index], options);
        });
        // Add new attributes
        names.slice(this.length).forEach((name) => {
          this.add({ attributeName: name, parentModel }, options);
        });
        this.trigger("namesUpdated");
      },

      /** @inheritdoc */
      validate() {
        const errors = [];

        // Validate each of the EMLAttributes
        this.each((attribute) => {
          if (!attribute.isValid()) {
            errors.push(attribute.validationError);
          }
        });
        return errors;
      },

      /**
       * Check if the collection is valid. If not, set the validationError
       * property to the validation errors.
       * @returns {boolean} True if the collection is valid, false otherwise
       */
      isValid() {
        const errors = this.validate();
        if (errors.length) {
          this.validationError = errors;
          return false;
        }
        return true;
      },

      /**
       * Serialize the collection of attributes to an XML string
       * @returns {string} The XML string representing the collection of
       * attributes
       */
      serialize() {
        const newDOM = this.updateDOM();
        const serializer = new XMLSerializer();
        return serializer.serializeToString(newDOM);
      },
    },
  );

  return EMLAttributes;
});
