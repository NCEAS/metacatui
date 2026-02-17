"use strict";

define(["backbone", "models/DataONEObject"], (Backbone, DataONEObject) => {
  /**
   * @class DataONEObjects
   * @classdesc A collection of DataONEObject models.
   * @classcategory Collections/SearchSelect
   * @since 0.0.0
   */
  const DataONEObjects = Backbone.Collection.extend({
    /** @lends DataONEObjects.prototype */

    /** @inheritdoc */
    model: DataONEObject,

    /** @inheritdoc */
    comparator: "dateUploaded",

    /**
     * Determine if the object with the given identifier is the newest in the
     * collection based on the `dateUploaded` property.
     * @param {string} identifier - The identifier of the object to check.
     * @returns {boolean} True if the object is the newest, false otherwise.
     */
    isNewest(identifier) {
      if (
        !identifier ||
        !this.length ||
        this.findWhere({ identifier }) == null
      ) {
        throw new Error("Identifier not found in collection");
      }
      const sorted = this.sortBy((obj) => obj.get("dateUploaded"));
      const newest = sorted[sorted.length - 1];
      return newest.get("identifier") === identifier;
    },

    /**
     * Determine if the object with the given identifier is the oldest in the
     * collection based on the `dateUploaded` property.
     * @param {string} identifier - The identifier of the object to check.
     * @returns {boolean} True if the object is the oldest, false otherwise.
     */
    isOldest(identifier) {
      if (
        !identifier ||
        !this.length ||
        this.findWhere({ identifier }) == null
      ) {
        throw new Error("Identifier not found in collection");
      }
      const sorted = this.sortBy((obj) => obj.get("dateUploaded"));
      const oldest = sorted[0];
      return oldest.get("identifier") === identifier;
    },

    /**
     * Group the models in the collection by their `dateUploaded` property.
     * @returns {object} An object where the keys are dates (YYYY-MM-DD) and the
     * values are arrays of DataONEObject models uploaded on that date.
     */
    groupByDate() {
      const dateProp = "dateUploaded";
      if (!this.length) return {};

      // group by date (YYYY-MM-DD)
      const groups = this.models.reduce((acc, obj) => {
        const dateUploaded = obj.get(dateProp);
        let dateKey;
        if (dateUploaded) {
          try {
            const date = new Date(dateUploaded);
            const dateParts = date.toISOString().split("T");
            [dateKey] = dateParts;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(
              "Error parsing dateUploaded for grouping:",
              dateUploaded,
              e,
            );
            dateKey = "";
          }
        } else {
          dateKey = "";
        }
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(obj);
        return acc;
      }, {});

      return groups;
    },
  });

  return DataONEObjects;
});
