define(["backbone"], (Backbone) => {
  "use strict";

  // Labels used for undated version groups (e.g. those where sysMeta is
  // private)
  const FUTURE_DATE_LABEL = "Future Date (Newer)";
  const PAST_DATE_LABEL = "Unknown Date (Older)";
  const NO_DATE_LABEL = "Unknown Date";

  /**
   * Converts a date label into a sortable value so the collection can remain in
   * descending chronological order regardless of the input format.
   * @param {string} date - Human-readable date string (e.g., "Jan 1, 2024").
   * @returns {number|string} Timestamp when parseable, otherwise a string
   * value.
   */
  const toSortValue = (date) => {
    const parsed = Date.parse(date);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    return date || "";
  };

  /**
   * Backbone collection representing the set of grouped timeline entries, where
   * each model corresponds to all object versions that share the same date.
   * @since 0.0.0
   * @class VersionTimelineGroups
   * @classdesc A collection of Backbone models, each representing a group of
   * versions for a specific date.
   * @classcategory Collections/VersionHistory
   */
  const VersionTimelineGroups = Backbone.Collection.extend(
    /** @lends VersionTimelineGroups.prototype */ {
      type: "VersionTimelineGroups",

      /**
       * The model representing a group of versions for a specific date.
       */
      model: Backbone.Model.extend(
        /** @lends VersionTimelineGroupModel.prototype */ {
          type: "VersionTimelineGroupModel",
          idAttribute: "date",
          defaults() {
            return {
              date: "",
              models: [],
            };
          },
        },
      ),

      /**
       * Ensures the collection stays sorted newest-to-oldest whenever models
       * are added or reset.
       * @param {Backbone.Model} modelA The first VersionTimelineGroup model to
       * compare.
       * @param {Backbone.Model} modelB The other model to compare.
       * @returns {number} Comparator result for Backbone's sorting.
       */
      comparator(modelA, modelB) {
        const a = toSortValue(modelA.get("date"));
        const b = toSortValue(modelB.get("date"));

        // Numbers (timestamps) are sorted numerically
        if (typeof a === "number" && typeof b === "number") {
          if (a === b) {
            return 0;
          }
          if (a < b) {
            return 1;
          }
          return -1;
        }

        // If labeled as Future or Past, those always go to the top or bottom
        if (a === FUTURE_DATE_LABEL) return -1;
        if (b === FUTURE_DATE_LABEL) return 1;
        if (a === PAST_DATE_LABEL) return 1;
        if (b === PAST_DATE_LABEL) return -1;
        // If labeled as No Date, those always go to the bottom
        if (a === NO_DATE_LABEL) return 1;
        if (b === NO_DATE_LABEL) return -1;

        // Otherwise, sort as strings
        const aStr = String(a);
        const bStr = String(b);
        if (aStr === bStr) return 0;
        return aStr < bStr ? 1 : -1;
      },

      /**
       * Populate the collection from a DataONEObjects collection, grouped by
       * upload date.
       * @param {DataONEObjects} collection DataONEObjects collection to group.
       * @param {object} [options] Options passed to `set`.
       * @param {boolean} [options.remove] Whether to remove existing models.
       * @param {string|null} [options.referencePid] Reference PID used to split
       * undated models into future/past groups.
       */
      fromDataONEObjects(
        collection,
        options = { remove: true, referencePid: null },
      ) {
        const groupedByDate = collection.groupByDate();
        const noDates = groupedByDate[""];

        // If there are undated models and a reference PID is provided, we can
        // separate them into future and past versions, relative to that PID.
        if (noDates && options.referencePid) {
          const futureModels = [];
          const pastModels = [];
          const noRefModels = [];
          const noDateModels = groupedByDate[""];
          noDateModels.forEach((model) => {
            const versionHistory = model.get("versionHistory");
            const refIndex = versionHistory?.[options.referencePid];
            if (refIndex === 0 || refIndex === undefined) {
              noRefModels.push(model);
            } else if (refIndex > 0) {
              futureModels.push(model);
            } else {
              // Lump truly undated models with past versions
              pastModels.push(model);
            }
          });
          if (futureModels.length > 0) {
            groupedByDate[FUTURE_DATE_LABEL] = futureModels;
          }
          if (pastModels.length > 0) {
            groupedByDate[PAST_DATE_LABEL] = pastModels;
          }
          if (noRefModels.length > 0) {
            groupedByDate[NO_DATE_LABEL] = noRefModels;
          }
          delete groupedByDate[""];
        }

        const groupedModels = Object.keys(groupedByDate).map((date) => {
          const models = groupedByDate[date];
          return { date, models };
        });

        this.set(groupedModels, options);
      },
    },
  );

  return VersionTimelineGroups;
});
