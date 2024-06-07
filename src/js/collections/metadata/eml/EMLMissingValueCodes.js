"use strict";

define(["backbone", "models/metadata/eml211/EMLMissingValueCode"], function (
  Backbone,
  EMLMissingValueCode,
) {
  /**
   * @class EMLMissingValueCodes
   * @classdesc A collection of EMLMissingValueCodes.
   * @classcategory Collections/Metadata/EML
   * @since 2.26.0
   * @extends Backbone.Collection
   */
  var EMLMissingValueCodes = Backbone.Collection.extend(
    /** @lends EMLMissingValueCodes.prototype */
    {
      /**
       * The reference to the model class that this collection is made of.
       * @type {Backbone.Model}
       */
      model: EMLMissingValueCode,

      /**
       * Parse the incoming XML nodes
       * @param {jQuery|Element} objectDOM - The XML DOM element that represents
       */
      parse: function (objectDOM) {
        const collection = this;

        if (!objectDOM) return;
        const $objectDOM = $(objectDOM);

        // Get all of the missingValueCode nodes
        const nodeName = "missingvaluecode";
        const nodes = $objectDOM.filter(nodeName);
        // Loop through each missingValueCode node
        const opts = { parse: true };
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          // Create a new missingValueCode model & add it to the collection
          const attrs = { objectDOM: node };
          const missingValueCode = new EMLMissingValueCode(attrs, opts);
          collection.add(missingValueCode);
        }

        return collection;
      },

      /**
       * Update the DOM with the current model state for each model in the
       * collection, then return the set of updated DOMs.
       * @returns {Element[]} An array of updated DOM elements
       */
      updateDOM: function () {
        const objectDOMs = this.map((model) => model.updateDOM());
        return objectDOMs;
      },

      /**
       * Remove any empty models from the collection
       */
      removeEmptyModels: function () {
        this.remove(this.filter((model) => model.isEmpty()));
      },

      /**
       * Validate the collection of missing value codes. This will remove any
       * empty models from the collection.
       * @returns {Array} An array of error messages
       */
      validate: function () {
        const errors = [];
        this.forEach((model) => {
          if (!model.isValid()) {
            errors.push(model.validationError);
          }
        });
        // return errors.length ? errors : null;
        // For now, if there is at least one error, just return the first one
        return errors.length ? errors[0] : null;
      },
    },
  );

  return EMLMissingValueCodes;
});
