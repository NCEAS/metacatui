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
   * @since 0.0.0
   * @augments Backbone.Collection
   */
  const EMLAttributes = Backbone.Collection.extend(
    /** @lends EMLAttributes.prototype */
    {
      /** @inheritdoc */
      model: EMLAttribute,

      /** @inheritdoc */
      parse(response, options) {
        let attributeListDOM = response;
        if (!attributeListDOM) return [];
        if (typeof attributeListDOM === "string") {
          // parse with jquery so node names are lowercase as expected by the
          // attribute model
          attributeListDOM = $.parseHTML(response)[0];
        }
        const attributeNodes =
          attributeListDOM.getElementsByTagName("attribute");
        return Array.from(attributeNodes).map((attr) => ({
          objectDOM: attr,
          objectXML: attr.outerHTML,
          parentModel: options.parentModel,
        }));
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
       * Add an attribute to the collection
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
       * Add a new attribute to the collection. Only allows one new attribute
       * to be added at a time. Returns the existing new attribute if one is
       * already present.
       * @param {EMLEntity} parentModel The model that contains this
       * collection, optional
       * @returns {EMLAttribute} The newly added attribute model
       */
      addNewAttribute(parentModel) {
        const existingNewAttribute = this.getNewAttribute();
        if (existingNewAttribute) {
          return existingNewAttribute;
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
       * Update the XML DOM object with the collection's attributes
       * @param {HTMLElement} currentDOM - The current XML DOM object
       * representing the collection of attributes. If not provided, a new XML
       * DOM object will be created.
       * @returns {object} The updated XML DOM object
       */
      updateDOM(currentDOM) {
        const dom = currentDOM
          ? currentDOM.cloneNode(true)
          : document.createElement("attributeList");

        if (dom.childNodes.length) {
          // Remove all existing attributes
          while (dom.firstChild) {
            dom.removeChild(dom.firstChild);
          }
        }

        // Add each attribute from the collection to the DOM
        this.each((attribute) => {
          if (!attribute.isEmpty()) {
            const updatedAttrDOM = attribute.updateDOM();
            dom.append(updatedAttrDOM);
          }
        });

        return dom;
      },
    },
  );

  return EMLAttributes;
});
