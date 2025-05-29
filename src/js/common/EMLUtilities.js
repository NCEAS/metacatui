"use strict";

define([], () => {
  /**
   * @namespace EMLUtilities
   * @description A generic utility object that contains functions used
   * throughout MetacatUI to perform useful functions related to EML, but not
   * used to store or manipulate any state about the application.
   * @type {object}
   * @since 0.0.0
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
  };

  return EMLUtilities;
});
