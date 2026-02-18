define(["backbone", "common/DateUtility"], (Backbone, DateUtility) => {
  "use strict";

  // Labels used for undated version groups (e.g. those where sysMeta is
  // private)
  const FUTURE_DATE_LABEL = "Future Date (Newer)";
  const PAST_DATE_LABEL = "Unknown Date (Older)";
  const NO_DATE_LABEL = "Unknown Date";
  const LABEL_SORT_RANK = {
    [FUTURE_DATE_LABEL]: 0,
    [NO_DATE_LABEL]: 2,
    [PAST_DATE_LABEL]: 3,
  };

  // Convert a label and set of models into attrs for a VersionTimelineGroup
  // model
  const toLabelGroup = (label, models) => {
    return {
      id: label, // for Backbone
      date: null,
      label,
      models,
    };
  };

  const sortRank = (model) => {
    if (DateUtility.isValidDate(model.get("date"))) return 1;
    return LABEL_SORT_RANK[model.get("label")] ?? 2;
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
          idAttribute: "id",
          defaults() {
            return {
              id: "",
              date: null,
              label: null,
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
        const rankA = sortRank(modelA);
        const rankB = sortRank(modelB);

        if (rankA !== rankB) {
          return rankA < rankB ? -1 : 1;
        }

        if (rankA === 1) {
          const dateA = modelA.get("date");
          const dateB = modelB.get("date");
          const timeA = dateA.getTime();
          const timeB = dateB.getTime();
          if (timeA === timeB) return 0;
          return timeA < timeB ? 1 : -1;
        }

        const labelA = modelA.get("label") || "";
        const labelB = modelB.get("label") || "";
        if (labelA === labelB) return 0;
        return labelA < labelB ? -1 : 1;
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
      fromDataONEObjects(collection, options = {}) {
        const {
          remove = true,
          referencePid = null,
          groupingTimeZone = "local",
          ...setOptions
        } = options;

        const groupedByDate = collection.groupByDate({
          groupingTimeZone,
        });
        const groupedModels = [];
        const noDateModels = [];

        groupedByDate.forEach((group) => {
          if (DateUtility.isValidDate(group.date)) {
            groupedModels.push({
              id: DateUtility.toDayId(group.date, groupingTimeZone, "date"),
              date: group.date,
              label: null,
              models: group.models,
            });
          } else {
            noDateModels.push(...group.models);
          }
        });

        // If there are undated models and a reference PID is provided, we can
        // separate them into future and past versions, relative to that PID.
        if (noDateModels.length > 0 && referencePid) {
          const futureModels = [];
          const pastModels = [];
          const noRefModels = [];

          noDateModels.forEach((model) => {
            const versionHistory = model.get("versionHistory");
            const refIndex = versionHistory?.[referencePid];
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
            groupedModels.push(toLabelGroup(FUTURE_DATE_LABEL, futureModels));
          }
          if (pastModels.length > 0) {
            groupedModels.push(toLabelGroup(PAST_DATE_LABEL, pastModels));
          }
          if (noRefModels.length > 0) {
            groupedModels.push(toLabelGroup(NO_DATE_LABEL, noRefModels));
          }
        } else if (noDateModels.length > 0) {
          groupedModels.push(toLabelGroup(NO_DATE_LABEL, noDateModels));
        }

        this.set(groupedModels, { ...setOptions, remove });
      },
    },
  );

  return VersionTimelineGroups;
});
