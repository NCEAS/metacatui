define(["backbone", "common/DateUtility"], (Backbone, DateUtility) => {
  "use strict";

  const NO_DATE_LABEL = "Unknown Date";

  /**
   * Normalize a model date into a grouping key and display values.
   * @param {Backbone.Model} model Version model.
   * @param {("local"|"UTC")} groupingTimeZone Day-boundary timezone.
   * @returns {{key: string, date: Date|null, label: string|null}} Normalized
   * date info for grouping and display.
   */
  const toSegmentDateInfo = (model, groupingTimeZone = "local") => {
    const rawDate = model.get("dateUploaded");
    const parsedDate = DateUtility.toDate(rawDate);
    if (!parsedDate) {
      return {
        key: "unknown",
        date: null,
        label: NO_DATE_LABEL,
      };
    }

    const normalizedDate = DateUtility.toMidnightDate(
      parsedDate,
      groupingTimeZone,
    );
    return {
      key: DateUtility.toDayId(normalizedDate, groupingTimeZone, "date"),
      date: normalizedDate,
      label: null,
    };
  };

  /**
   * Backbone collection representing grouped timeline entries for the version
   * history view. Each group is a contiguous segment of versions in chain order
   * that share the same calendar day (or "Unknown Date" label).
   * @since 0.0.0
   * @class VersionTimelineGroups
   * @classdesc A collection of Backbone models, each representing a contiguous
   * segment of versions for a specific date label/date.
   * @classcategory Collections/VersionHistory
   */
  const VersionTimelineGroups = Backbone.Collection.extend(
    /** @lends VersionTimelineGroups.prototype */ {
      type: "VersionTimelineGroups",

      /**
       * The model representing a group of versions for a specific date segment.
       */
      model: Backbone.Model.extend(
        /** @lends VersionTimelineGroupModel.prototype */ {
          type: "VersionTimelineGroupModel",
          idAttribute: "id",
          defaults() {
            return {
              id: "",
              sequence: 0,
              date: null,
              label: null,
              models: [],
            };
          },
        },
      ),

      /**
       * Sort groups strictly by their segment sequence in chain order.
       * @param {Backbone.Model} modelA First model.
       * @param {Backbone.Model} modelB Other model.
       * @returns {number} Comparator result.
       */
      comparator(modelA, modelB) {
        const seqA = modelA.get("sequence");
        const seqB = modelB.get("sequence");
        const finiteA = Number.isFinite(seqA);
        const finiteB = Number.isFinite(seqB);

        if (finiteA && finiteB) {
          if (seqA === seqB) return 0;
          return seqA < seqB ? -1 : 1;
        }
        if (finiteA !== finiteB) {
          return finiteA ? -1 : 1;
        }

        const idA = modelA.get("id") || "";
        const idB = modelB.get("id") || "";
        if (idA === idB) return 0;
        return idA < idB ? -1 : 1;
      },

      /**
       * Populate the collection from a DataONEObjects collection using strict
       * obsolescence-chain order, segmented into contiguous date buckets.
       * @param {DataONEObjects} collection DataONEObjects collection to group.
       * @param {object} [options] Options passed to `set`.
       * @param {boolean} [options.remove] Whether to remove existing models.
       * @param {string} options.referencePid Reference PID used to order the
       * chain via versionHistory indexes.
       * @param {("local"|"UTC")} [options.groupingTimeZone] Timezone
       * used to determine day boundaries.
       */
      fromDataONEObjects(collection, options = {}) {
        const {
          remove = true,
          referencePid = null,
          groupingTimeZone = "local",
          ...setOptions
        } = options;

        if (!referencePid) {
          throw new Error(
            "VersionTimelineGroups.fromDataONEObjects requires referencePid",
          );
        }

        const orderedModels = collection.getChainOrdered(referencePid);
        const groupedModels = [];

        let currentGroup = null;
        let currentKey = null;
        let sequence = 0;

        orderedModels.forEach((model) => {
          const dateInfo = toSegmentDateInfo(model, groupingTimeZone);
          const identifier = model.get("identifier") || `unknown-${sequence}`;
          const isNewGroup =
            currentGroup == null || dateInfo.key !== currentKey;

          if (isNewGroup) {
            currentKey = dateInfo.key;
            currentGroup = {
              // Keep group ids stable across incremental loads so Backbone can
              // merge/reorder existing groups instead of tearing them down.
              id: `segment:${dateInfo.key}:${identifier}`,
              sequence,
              date: dateInfo.date,
              label: dateInfo.label,
              models: [],
            };
            groupedModels.push(currentGroup);
            sequence += 1;
          }

          currentGroup.models.push(model);
        });

        this.set(groupedModels, { ...setOptions, remove });
      },
    },
  );

  VersionTimelineGroups.NO_DATE_LABEL = NO_DATE_LABEL;

  return VersionTimelineGroups;
});
