"use strict";

define([], () => {
  /**
   * @namespace EMLUtilities
   * @description A generic utility object that contains functions used
   * throughout MetacatUI to perform useful functions related to EML, but not
   * used to store or manipulate any state about the application.
   * @type {object}
   * @since 2.34.0
   */
  const EMLUtilities = /** @lends EMLUtilities.prototype */ {
    /**
     * Climbs up the model hierarchy until it finds the EML model
     * @param {Backbone.Model} model - The starting model
     * @param {number} [maxTries] - The maximum number of levels to climb
     * @returns {EML211|false} - Returns the EML 211 Model or null if not found
     */
    getParentEML(model, maxTries = 6) {
      let emlModel = model.get("parentModel");
      let tries = 0;

      while (emlModel && emlModel.type !== "EML" && tries < maxTries) {
        emlModel = emlModel.get("parentModel");
        tries += 1;
      }

      return emlModel && emlModel.type === "EML" ? emlModel : false;
    },

    /**
     * Serialize a DOM element to a string, removing the XML declaration and any
     * namespace declarations. Namespaces are added to the elements because the
     * codebase currently combines older ways of handling XML (using jQuery's
     * parseHTML and document.createElement) with newer ways (using DOMParser).
     * While we transition to using modern methods, this function can be used to
     * clean up the serialized XML.
     * @param {Element} dom - The DOM element to serialize
     * @returns {string} The serialized XML string
     * @since 0.0.0
     */
    serializeDOM(dom) {
      const serializer = new XMLSerializer();
      let str = serializer.serializeToString(dom);
      // Remove the XML declaration if it exists
      str = str.replace(/<\?xml.*?\?>/g, "");
      // Remove any namespace declarations
      str = str.replace(/xmlns(:\w+)?="[^"]*"/g, "");
      return str;
    },
  };

  return EMLUtilities;
});
