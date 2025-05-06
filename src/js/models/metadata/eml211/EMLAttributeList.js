define([
  "backbone",
  "collections/metadata/eml/EMLAttributes",
  "models/metadata/eml211/EMLReferences",
  "models/DataONEObject",
], (Backbone, EMLAttributes, EMLReferences, DataONEObject) => {
  /**
   * @class EMLAttributeList
   * @classdesc A model representing the EML AttributeListType.
   * See {@link https://eml.ecoinformatics.org/schema/eml-attribute_xsd#AttributeListType}
   * @classcategory Models/Metadata/EML211
   * @constructs
   * @augments Backbone.Model
   */
  const EMLAttributeList = Backbone.Model.extend(
    /** @lends EMLAttributeList.prototype */
    {
      /**
       * Default attributes for this model
       * @returns {object} Default attributes
       * @property {string} xmlID - The XML ID of the attribute list
       * @property {EMLAttributes} emlAttributes - The collection of EML
       * attributes. Note: This cannot be called "attributes" because that
       * overrides the Backbone.Model.attributes property and causes unexpected
       * behaviour.
       * @property {EMLReferences} references - A reference to another
       * attributeList in the same EML document
       * @property {EMLEntity} parentModel - The parent model of this attribute
       * list
       */
      defaults() {
        return {
          xmlID: DataONEObject.generateId(),
          emlAttributes: new EMLAttributes(),
          references: new EMLReferences(),
          parentModel: null,
        };
      },

      /** @inheritdoc */
      initialize() {
        // Listen for both changes on the eml attributes collection and for
        // replacement of the collection itself, in which case we need to reset
        // listeners.
        this.listenTo(this, "change:emlAttributes", this.listenToAttributes);
        this.listenToAttributes();
      },

      /**
       * Trigger a change:emlAttributes event on this model when the
       * emlAttributes collection within this model adds, removes, or changes
       * one if it's models. This event can be used to notify other views/models
       * that the attributes collection has changed OR been replaced with a new
       * collection.
       */
      listenToAttributes() {
        const prevAttr = this.previous("emlAttributes");
        if (prevAttr) this.stopListening(prevAttr, "update");

        const attr = this.get("emlAttributes");
        this.stopListening(attr, "update change");

        this.listenToOnce(attr, "update change", () => {
          this.trigger("change:emlAttributes", this, this.get("emlAttributes"));
        });
      },

      /**
       * Node names as they appear in the XML document mapped to how they are
       * parsed using the jquery html parser (used for historical reasons).
       * @returns {object} A map of node names in lowercase to their
       * corresponding xml camelCase names.
       */
      nodeNameMap() {
        const nodeNames = ["attributeList", "attribute", "references"];
        // convert to lowercase : camelCase map
        return nodeNames.reduce((acc, nodeName) => {
          acc[nodeName.toLowerCase()] = nodeName;
          return acc;
        }, {});
      },

      /** @inheritdoc */
      parse(response, options = {}) {
        if (!response || !response.length) {
          return {};
        }

        // Convert the jquery object to a DOM element so we can use native DOM
        // methods. Note that this will add the HTML namespace to the element
        // (because it was originally parsed with jquery's HTMLparse) so we have
        // to remove it during serialization.
        const dom = response.get(0);
        const id = dom.getAttribute("id");
        const parentModel = options?.parentModel;

        let emlAttributes = new EMLAttributes();
        let references = null;

        // An attribute list may have references OR attributes, but not both.
        const referencesNode = dom.getElementsByTagName("references");
        if (referencesNode?.length) {
          // Only one reference is allowed
          references = new EMLReferences(referencesNode[0], {
            parentModel,
            parse: true,
            modelType: "EMLAttributeList",
          });
        } else {
          emlAttributes = new EMLAttributes(dom, {
            ...options,
            parentModel: this,
            parse: true,
          });
        }

        return {
          xmlID: id,
          emlAttributes,
          references,
          parentModel,
          objectDOM: dom,
        };
      },

      /**
       * Update the EML AttributeList DOM element with the current state of the
       * model.
       * @param {Element} [currentDOM] - The current DOM element to update. If
       * not provided, the model's objectDOM will be used, or a new element will
       * be created if none exists.
       * @returns {Element} The updated DOM element
       */
      updateDOM(currentDOM) {
        let dom = currentDOM || this.get("objectDOM");
        if (!dom) {
          dom = document.createElementNS(null, "attributeList");
        } else {
          dom = dom.cloneNode(true);
        }

        if (this.isEmpty()) {
          dom.remove();
          this.set("objectDOM", null);
          return null;
        }

        if (dom.childNodes.length) {
          // Remove all existing attributes
          while (dom.firstChild) {
            dom.removeChild(dom.firstChild);
          }
        }

        const refDom = this.get("references")?.updateDOM();

        if (refDom) {
          // replace the existing references node with the new one
          const oldRef = dom.getElementsByTagName("references");
          if (oldRef.length) {
            dom.replaceChild(refDom, oldRef[0]);
          } else {
            dom.appendChild(refDom);
          }
          // Can only have reference OR attributes, not both
        } else {
          // Add each attribute from the collection to the DOM
          this.get("emlAttributes")?.each((attribute) => {
            if (!attribute.isEmpty()) {
              const updatedAttrDOM = attribute.updateDOM();
              dom.append(updatedAttrDOM);
            }
          });
        }

        // Set the XML ID of the attribute list
        const xmlID = this.get("xmlID");
        if (xmlID) {
          dom.setAttribute("id", xmlID);
        } else {
          dom.removeAttribute("id");
        }

        this.set("objectDOM", dom);

        return dom;
      },

      /**
       * Serialize this model to EML XML
       * @returns {string} XML string representing the attribute list
       */
      serialize() {
        const dom = this.updateDOM();
        if (!dom) return null;

        // Convert the DOM element to a string
        const serializer = new XMLSerializer();
        let xmlString = serializer.serializeToString(dom);

        // Remove the XML declaration
        xmlString = xmlString.replace(/<\?xml.*?\?>/, "");

        // Remove the namespace uri
        xmlString = xmlString.replace(/xmlns="[^"]*"/, "");

        return DataONEObject.prototype.formatXML.call(this, xmlString);
      },

      /**
       * Check if the attribute list is empty. An attribute list is empty if
       * it has no attributes and no references.
       * @returns {boolean} True if the attribute list is empty, false
       * otherwise
       */
      isEmpty() {
        return !this.hasNonEmptyAttributes() && !this.hasReferences();
      },

      /**
       * Check if the attribute list has any attributes that have values other
       * than the default values.
       * @returns {boolean} False if the attribute list is empty or the attributes
       * are all empty, true otherwise.
       */
      hasNonEmptyAttributes() {
        return this.get("emlAttributes")?.hasNonEmptyAttributes();
      },

      /**
       * Check if the attribute list has a references element.
       * @returns {boolean} True if the attribute list has a references with a
       * value, false otherwise
       */
      hasReferences() {
        return this.get("references") && !this.get("references").isEmpty();
      },

      /**
       * Validate the model state to conform to the EML schema rules.
       * @returns {object|false} Validation errors or false if valid
       */
      validate() {
        if (this.isEmpty()) return false;

        const errors = {};
        const emlAttributes = this.get("emlAttributes");
        const references = this.get("references");
        const hasAttributes = emlAttributes?.hasNonEmptyAttributes();
        const hasReferences = references && !references.isEmpty();
        if (hasAttributes && hasReferences) {
          errors.attributes =
            "An attribute list must contain either attribute elements or references, not both.";
          errors.references =
            "An attribute list must contain either attribute elements or references, not both.";
          return errors;
        }

        const refErrors = references?.validate();
        const attributeErrors = emlAttributes?.validate();

        // if there are validation errors, add them to the errors object. An
        // empty object is valid.
        if (refErrors && Object.keys(refErrors).length) {
          errors.references = refErrors;
        }
        if (attributeErrors && Object.keys(attributeErrors).length) {
          errors.attributes = attributeErrors;
        }

        return Object.keys(errors).length ? errors : false;
      },

      /**
       * Get the EML document that contains this attribute list
       * @returns {EML} The EML document that contains this attribute list
       */
      getParentEML() {
        return this.get("parentModel")?.getParentEML();
      },
    },
  );

  return EMLAttributeList;
});
