define(["jquery", "backbone", "common/EMLUtilities"], (
  $,
  Backbone,
  EMLUtilities,
) => {
  /**
   * @class EMLReferences
   * @classdesc A model for the EML <references> element.
   * See {@link https://eml.ecoinformatics.org/schema/eml-resource_xsd.html#ReferencesGroup}
   * @classcategory Models/Metadata/EML211
   * @constructs
   * @augments Backbone.Model
   * @since 2.34.0
   */
  const EMLReferences = Backbone.Model.extend(
    /** @lends EMLReferences.prototype */
    {
      /**
       * Default attributes for an EML <references> element.
       * @returns {object} - Default attributes for the model.
       * @property {string} references - The id of another element being
       * referenced.
       * @property {string | null} system - Optional system attribute for
       * external system scoping.
       * @property {string} objectDOM - The DOM representation of this
       * references element.
       * @property {string} modelType - The name of the backbone model that is
       * used to represent this the element that the reference points to. We
       * need this to be able to find the element in the EML document that
       * corresponds to this reference.
       * @property {Backbone.Model} parentModel - The parent EML model of this
       * references element, e.g. a EMLAttributeList.
       */
      defaults() {
        return {
          references: "",
          system: null,
          objectDOM: null,
          modelType: null,
          parentModel: null,
        };
      },

      // TODO... listen to change in xml id for linked model. Also if that model
      // is destroyed, this reference should be invalidated or removed....

      /**
       * Convert the references xml to model attributes.
       * @param {HTMLElement | jQuery} response - The XML response to parse.
       * @param {object} options - Options for parsing.
       * @param {Backbone.Model} options.parentModel - The parent model of
       * this references element, e.g. a EMLAttributeList.
       * @returns {object} - The parsed attributes.
       */
      parse(response, options = {}) {
        let references = response;
        if (!references) return {};

        // .get is a jQuery function
        if (typeof references.get === "function") {
          // if references is a jQuery object, get the first element
          references = references.get(0);
        }

        const system = references.getAttribute("system");
        const ref = references.textContent || references.innerHTML;

        return {
          references: ref || null,
          system: system || null,
          parentModel: options.parentModel || null,
          modelType: options.modelType || null,
          objectDOM: references,
        };
      },

      /**
       * Get the parent EML model of this references element.
       * @returns {EML} - The parent EML model.
       */
      getParentEML() {
        return EMLUtilities.getParentEML(this);
      },

      /**
       * Find the subtree in the EML document that corresponds to the references.
       * i.e. the element with the same id that the reference points to.
       * @returns {Backbone.Model | null} - The linked model or null if not found.
       */
      getLinkedModel() {
        const ref = this.get("references");
        const eml = this.getParentEML();
        const modelType = this.get("modelType");
        let found = null;

        if (!ref || !eml || !modelType) {
          // If no reference, parentEML, or modelType, return null
          return null;
        }

        switch (modelType) {
          // Check if the model is a DataONEObject
          case "EMLAttributeList": {
            const attributeLists = eml.get("entities").getAllAttributeLists();
            found = attributeLists.find((list) => list.get("xmlID") === ref);
            break;
          }
          // TODO: Add support for other models
          default:
            // If the model is not recognized, return null
            throw new Error(
              `Support for "${modelType}" is not implemented yet.`,
            );
        }

        return found || null;
      },

      /**
       * Get the linked DOM element in the EML document that corresponds to the
       * references. This is the element with the same id that the reference
       * points to.
       * @returns {jQuery | null} - The linked DOM element or null if not found.
       */
      getLinkedDOM() {
        const eml = this.getParentEML();
        if (!eml) return null;
        let emlDOM = eml.get("objectDOM");
        const ref = this.get("references");

        if (!ref || !emlDOM) return null;

        // if emlDOM is not a jQuery object, convert it to one
        emlDOM = $(emlDOM);

        // Find the element in the DOM with the matching ID
        const linkedElement = emlDOM.find(`[id="${ref}"]`);
        if (linkedElement.length) {
          // If found, return the linked element
          return linkedElement;
        }
        const linkedModel = this.getLinkedModel();
        if (linkedModel) {
          // If the model is found, return its DOM representation
          return linkedModel.get("objectDOM") || linkedModel.updateDOM();
        }
        // If not found, return null
        return null;
      },

      /**
       * Check if the references element is empty.
       * @returns {boolean} - True if the references element is empty, false
       * otherwise.
       */
      isEmpty() {
        // Even if there's a system attribute, if there is no reference, it's
        // empty
        return !this.get("references");
      },

      /**
       * Validate the attributes to ensure a valid <references> structure.
       * @returns {object} - An object containing validation errors, if any.
       */
      validate() {
        const errors = {};
        const ref = this.get("references");
        const system = this.get("system");

        if (this.isEmpty()) return false;

        if (!ref) {
          errors.references = "The ID of the referenced element is required.";
        }

        if (system && typeof system !== "string") {
          errors.system = "The 'system' attribute must be a string.";
        }

        // Check if there is either a node in the DOM with a matching ID
        // or a model in the EML model with a matching xmlID (since the refed
        // element may not be in the DOM yet)
        const linkedModel = this.getLinkedModel();
        const linkedDOM = this.getLinkedDOM();
        if (!linkedModel && !linkedDOM) {
          errors.references =
            "The referenced element must exist in the EML document.";
        }
        // Check if the linked model is valid
        if (linkedModel && !linkedModel.isValid()) {
          errors.references = "The referenced element is not valid.";
        }

        return errors;
      },

      /**
       * Serialize the model to an XML string.
       * @returns {string} - The XML representation of this <references> element.
       */
      updateDOM() {
        if (!this.get("references")) {
          const dom = this.get("objectDOM");
          if (dom) {
            dom.remove();
          }
          this.set("objectDOM", null);
          return null;
        }

        let dom = this.get("objectDOM");
        if (!dom) {
          dom = document.createElement("references");
        } else {
          dom = dom.cloneNode(true);
        }
        const ref = this.get("references");
        const system = this.get("system");

        dom.textContent = ref || "";
        if (system) {
          dom.setAttribute("system", system);
        } else {
          dom.removeAttribute("system");
        }
        this.set("objectDOM", dom);
        return dom;
      },
    },
  );

  return EMLReferences;
});
