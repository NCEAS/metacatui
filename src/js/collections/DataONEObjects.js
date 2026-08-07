"use strict";

define(["backbone", "models/DataONEObject", "common/DateUtilities"], (
  Backbone,
  DataONEObject,
  DateUtilities,
) => {
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
     * Determine if all models in the collection are hidden by the UI based on
     * the `hiddenByUI` property.
     * @returns {boolean} True if all models are hidden, false otherwise.
     */
    allHidden() {
      return (
        this.length > 0 &&
        this.every((model) => model.get("hiddenByUI") === true)
      );
    },

    /**
     * Return models ordered by version-chain position relative to a reference
     * PID, newest to oldest. Models without a valid chain index are placed at
     * the end in deterministic identifier order.
     * @param {string} referencePid PID used as the versionHistory index key.
     * @returns {Backbone.Model[]} Ordered model array (new array).
     */
    getChainOrdered(referencePid) {
      if (!referencePid) {
        throw new Error("referencePid is required to order by version chain");
      }

      const getIndex = (model) => {
        const index = model.get("versionHistory")?.[referencePid];
        return Number.isFinite(index) ? index : null;
      };

      return [...this.models].sort((a, b) => {
        const indexA = getIndex(a);
        const indexB = getIndex(b);
        const hasIndexA = Number.isFinite(indexA);
        const hasIndexB = Number.isFinite(indexB);

        if (hasIndexA && hasIndexB && indexA !== indexB) {
          return indexB - indexA; // newer (+) first, older (-) last
        }
        if (hasIndexA !== hasIndexB) {
          return hasIndexA ? -1 : 1;
        }

        const idA = a.get("identifier") || "";
        const idB = b.get("identifier") || "";
        if (idA === idB) return 0;
        return idA < idB ? -1 : 1;
      });
    },

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
     * Get the date range of the collection based on the `dateUploaded`
     * property. Returns null if there are no valid dates.
     * @param {object} [options] Options for calculating date range.
     * @param {string} [options.dateProp] Model property to read.
     * @returns {{minDate: Date, maxDate: Date, minModel: Backbone.Model,
     * maxModel: Backbone.Model}|null} Date range info or null if no valid
     * dates.
     */
    getDateRange({ dateProp = "dateUploaded" } = {}) {
      if (!this.length) return null;

      let minDate = null;
      let maxDate = null;
      let idMinDate = null;
      let idMaxDate = null;

      // Pluck the date & id for all models
      this.each((model) => {
        const dateValue = model.get(dateProp);
        const date = DateUtilities.toDate(dateValue);
        if (date) {
          if (!minDate || date < minDate) {
            minDate = date;
            idMinDate = model.get("identifier");
          }
          if (!maxDate || date > maxDate) {
            maxDate = date;
            idMaxDate = model.get("identifier");
          }
        }
      });

      const minModel = this.get(idMinDate);
      const maxModel = this.get(idMaxDate);

      if (minDate && maxDate) {
        return {
          minDate,
          maxDate,
          minModel,
          maxModel,
        };
      }
      return null;
    },

    /**
     * Group models by calendar day in the chosen timezone.
     * @param {object} [options] Options for grouping
     * @param {string} [options.dateProp] Model property to read.
     * @param {("local"|"UTC")} [options.groupingTimeZone] Timezone used
     * to determine day boundaries.
     * @returns {Array.<{date: (Date|null), models: Array.<Backbone.Model>}>}
     * Grouped models
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
            const parsedDate = DateUtilities.toDate(rawDate);
            if (!parsedDate) {
              throw new Error("Invalid Date");
            }
            groupDate = DateUtilities.toMidnightDate(
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
