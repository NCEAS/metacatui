"use strict";

define(
  ["backbone", "models/DataONEObject", "common/DateUtility"],
  (Backbone, DataONEObject, DateUtility) => {
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
     * Group models by calendar day in the chosen timezone.
     * @param {object} [options]
     * @param {string} [options.dateProp="dateUploaded"] Model property to read.
     * @param {("local"|"UTC")} [options.groupingTimeZone="local"] Timezone used
     * to determine day boundaries.
     * @returns {{date: Date|null, models: Backbone.Model[]}[]} Grouped models.
     */
    groupByDate({
      dateProp = "dateUploaded",
      groupingTimeZone = "local",
    } = {}) {
      if (!this.length) return [];

      const normalizedTimeZone = groupingTimeZone === "UTC" ? "UTC" : "local";
      const groups = new Map();

      this.models.forEach((obj) => {
        const rawDate = obj.get(dateProp);
        let dateKey = null;
        let groupDate = null;

        if (rawDate) {
          try {
            const parsedDate = DateUtility.toDate(rawDate);
            if (!parsedDate) {
              throw new Error("Invalid Date");
            }
            groupDate = DateUtility.toMidnightDate(
              parsedDate,
              normalizedTimeZone,
            );
            dateKey = groupDate.getTime();
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(
              "Error parsing dateUploaded for grouping:",
              rawDate,
              e,
            );
          }
        }

        if (!groups.has(dateKey)) {
          groups.set(dateKey, { date: groupDate, models: [] });
        }
        groups.get(dateKey).models.push(obj);
      });

      return Array.from(groups.values());
    },
  });

  return DataONEObjects;
});
