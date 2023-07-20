define(["backbone"], function (Backbone) {
  /**
   * @class EMLMissingValueCode
   * @classdesc A missing value code is a code that is used to indicate
   * that a value is missing from the data.
   * @see https://eml.ecoinformatics.org/schema/eml-attribute_xsd.html
   * @classcategory Models/Metadata/EML211
   * @since x.x.x
   */
  var EMLMissingValueCode = Backbone.Model.extend(
    /** @lends EMLMissingValueCode.prototype */ {
      /**
       * The default attributes for an EMLMissingValueCode model.
       * @returns {object} The default attributes
       * @property {string} type - The element type in the DOM
       * @property {string} code - The missing value code
       * @property {string} codeExplanation - The explanation for the missing value code
       * @property {string[]} nodeOrder - The order of the EML nodes in this object
       */
      defaults: function () {
        return {
          type: "missingValueCode",
          code: "",
          codeExplanation: "",
          nodeOrder: ["code", "codeExplanation"],
        };
      },

      /*
       * Parse the incoming attribute's XML elements.
       */
      parse: function (attributes, options) {
        if (!attributes) return {};
        const objectDOM = attributes.objectDOM || attributes.objectXML;
        if (!objectDOM) return {};
        const $objectDOM = $(objectDOM);

        this.defaults().nodeOrder.forEach((node) => {
          attributes[node] = $objectDOM.children(node.toLowerCase()).text();
        });

        attributes.objectDOM = $objectDOM[0];
        return attributes;
      },

      /**
       * Create an XML string from the model's attributes.
       * @return {string} The XML string
       */
      serialize: function () {
        const xml = this.updateDOM().outerHTML;
        const nodes = this.get("nodeOrder");
        // replace lowercase node names with camelCase
        nodes.forEach((node) => {
          xml.replace(`<${node.toLowerCase()}>`, `<${node}>`);
          xml.replace(`</${node.toLowerCase()}>`, `</${node}>`);
        });
        return xml;
      },

      /**
       * Copy the original XML and update fields in a DOM object
       * @param {object} objectDOM - The DOM object to update
       */
      updateDOM: function (objectDOM) {
        const type = this.get("type") || "missingValueCode";
        if (!objectDOM) {
          objectDOM = this.get("objectDOM") || this.get("objectXML");
        }
        if (!objectDOM) {
          objectDOM = document.createElement(type);
        }
        const $objectDOM = $(objectDOM);

        this.get("nodeOrder").forEach((nodeName) => {
          // Remove any existing nodes
          $objectDOM.children(nodeName.toLowerCase()).remove();

          const newValue = this.get(nodeName)?.trim();

          // Add the new node
          if (newValue) {
            const node = document.createElement(nodeName);
            $(node).text(newValue);
            $objectDOM.append(node);
          }
        });

        return $objectDOM[0];
      },

      /**
       * Return true if all of the model's attributes are empty
       * @return {boolean}
       */
      isEmpty: function () {
        return !this.get("code") && !this.get("codeExplanation");
      },

      /**
       * Validate the model attributes
       * @return {object} The validation errors, if any
       */
      validate: function () {
        if (this.isEmpty()) return undefined;

        const errors = [];

        // Need a code and an explanation. Both must be non-empty strings.
        let code = this.get("code");
        let codeExplanation = this.get("codeExplanation");
        if (
          !code ||
          !codeExplanation ||
          typeof code !== "string" ||
          typeof codeExplanation !== "string"
        ) {
          errors.missingValueCode =
            "Missing value code and explanation are required.";
          return errors;
        }
        code = code.trim();
        codeExplanation = codeExplanation.trim();
        this.set("code", code);
        this.set("codeExplanation", codeExplanation);

        // Code must be a non-empty string
        if (!code || !codeExplanation) {
          errors.missingValueCode =
            "Missing value code and explanation are required.";
          return errors;
        }

        return errors.length > 0 ? errors : undefined;
      },
    }
  );

  return EMLMissingValueCode;
});
