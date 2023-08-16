"use strict";

define(["backbone", "models/metadata/eml211/EMLDistribution"], function (
  Backbone,
  EMLDistribution
) {
  /**
   * @class EMLDistributions
   * @classdesc A collection of EMLDistributions.
   * @classcategory Collections/Metadata/EML
   * @since x.x.x
   */
  var EMLDistributions = Backbone.Collection.extend(
    /** @lends EMLDistributions.prototype */
    {
      /**
       * The reference to the model class that this collection is made of.
       * @type EMLDistribution
       */
      model: EMLDistribution,

      /**
       * Find the distribution that has all of the matching attributes. This
       * will return true if the distribution has all of the attributes, even if
       * it has more attributes than the ones passed in. Only the first matching
       * distribution will be returned.
       * @param {object} attributes - The attributes to match
       * @param {boolean} partialMatch - If true, then the attribute values in
       * the distribution models only need to partially match the attribute
       * values given. If false, then the attributes must match exactly.
       * @return {EMLDistribution|undefined} The matching distribution, or
       * undefined if there is no match.
       */
      findByAttributes: function (attributes, partialMatch = false) {
        return this.find((d) => {
          return Object.keys(attributes).every((key) => {
            const val = d.get(key);
            if (partialMatch) {
              return val.includes(attributes[key]);
            }
            return val === attributes[key];
          });
        });
      },

      /**
       * Remove the distribution that has all of the matching attributes. This
       * will remove the first distribution that has all of the attributes, even
       * if it has more attributes than the ones passed in.
       * @param {object} attributes - The attributes to match
       * @param {boolean} partialMatch - If true, then the attribute values in
       * the distribution models only need to partially match the attribute
       * values given. If false, then the attributes must match exactly.
       * @return {EMLDistribution|undefined} The matching distribution, or
       * undefined if there is no match.
       */
      removeByAttributes: function (attributes, partialMatch = false) {
        const dist = this.findByAttributes(attributes, partialMatch);
        if (dist) {
          return this.remove(dist);
        }
      },

      /**
       * Make sure that the EML dataset element has a distribution node with the
       * location where the data package can be viewed. This will be either the
       * view URL for the member node being used or the DOI.org URL if the
       * dataset has one. This method will look for the old distribution URL and
       * update it if it exists, or add a new distribution node if it doesn't.
       * @param {string} url - The URL to add to the dataset distribution
       * @param {string[]} oldIDs - The old PIDs, seriesIds, or current PID to
       * remove from the dataset distribution
       * @return {EMLDistribution} The distribution that was added or updated
       */
      addDatasetDistributionURL: function (url, oldIDs = []) {
        if (!url) {
          console.warn("No URL given to addDatasetDistributionURL");
          return;
        }

        // Reference to this collection
        const dists = this;
        // The URL function used for dataset distribution URLs
        const func = "information";

        // Remove any distribution models with the old PID, seriesId, or current
        // PID in the URL (only if the URL function is "information")
        if (dists.length && oldIDs.length) {
          oldIDs.forEach((url) => {
            dists.removeByAttributes({ url: id, urlFunction: func }, true);
          });
        }

        // Add a new distribution with the view URL
        return dists.add({ url: url, urlFunction: urlFunction });
      },

      /**
       * Update the DOM for each distribution in this collection with the
       * current model state.
       * @return {object[]} An array of jQuery DOM objects for each distribution
       * in this collection.
       */
      updateDOMs: function (doms) {
        const objectDOMs = this.map((model) => model.updateDOM());
        return objectDOMs;
      },
    }
  );

  return EMLDistributions;
});
