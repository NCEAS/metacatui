/**
 * A Backbone view that renders a single date bucket within the version history
 * timeline, including the list of ObjectVersionView entries for that date.
 */
define([
  "backbone",
  "collections/DataONEObjects",
  "common/DateUtility",
  "views/versionHistory/ObjectVersionsView",
], (Backbone, DataONEObjects, DateUtility, ObjectVersionsView) => {
  "use strict";

  // SVG for the timeline point, included inline to avoid an extra request and
  // allow CSS styling
  const TIMELINE_POINT_SVG = `<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`;

  // Base class for the timeline group, used in the className property and for
  // scoping styles
  const BASE_CLASS = "version-history-group";

  // All class names used in this view, for easy reference and to avoid typos
  const CLASS_NAMES = {
    container: BASE_CLASS,
    hidden: `version-history--hidden`,
    dateConflict: `${BASE_CLASS}--date-conflict`,
    timelinePoint: `${BASE_CLASS}__timeline-point`,
    timelineContent: `${BASE_CLASS}__timeline-content`,
    header: `${BASE_CLASS}__header`,
    dateTitle: `${BASE_CLASS}__date-title`,
    anomalyChip: `${BASE_CLASS}__date-conflict-chip`,
    anomalyChipIcon: `${BASE_CLASS}__date-conflict-icon`,
    objectVersionsList: `object-versions`,
  };

  /**
   * @class VersionTimelineGroupView
   * @classdesc A group of object versions for a specific date within the
   * version history timeline.
   * @classcategory Views/VersionHistory
   * @augments Backbone.View
   * @screenshot views/versionHistory/VersionTimelineGroupView.png
   * @since 0.0.0
   */
  const VersionTimelineGroupView = Backbone.View.extend(
    /** @lends VersionTimelineGroupView.prototype */ {
      /**
       * Identifier used when the application inspects view types.
       * @type {string}
       */
      type: "VersionTimelineGroupView",

      /** @inheritdoc */
      tagName: "div",

      /** @inheritdoc */
      className: CLASS_NAMES.container,

      /**
       * @param {object} [options] View options.
       * @param {Backbone.Model} [options.model] VersionTimeLineGroup model
       * (defined in VersionTimelineGroups collection).
       * @param {string} [options.referencePid] PID used for badge context.
       */
      initialize(options = {}) {
        this.referencePid = options.referencePid || null;

        this.model = options.model || null;
        if (!this.model) {
          this.model = new Backbone.Model({
            models: new DataONEObjects(),
          });
        }

        const models = this.model.get("models");

        this.date = this.model.get("date") ?? null;
        this.label = this.model.get("label") ?? null;
        this.collection =
          models instanceof DataONEObjects
            ? models
            : new DataONEObjects(models || [], { sort: false });
        this.model.set("models", this.collection);
      },

      /**
       * Base markup for the timeline group.
       * @param {{date: Date|null, label: string|null}} params Template parameters.
       * @param {Date|null} params.date Group date at midnight.
       * @param {string|null} params.label Human-readable label for synthetic groups.
       * @returns {string} HTML string for the timeline group shell.
       */
      template({ date, label }) {
        let displayDate =
          label ||
          DateUtility.toLocaleDateString(date, {
            formatOptions: {
              year: "numeric",
              month: "long",
              day: "numeric",
            },
          });
        // If it's a date and not e.g. "unknown" label, wrap it in <time>
        if (DateUtility.isValidDate(date)) {
          const dateAttr = DateUtility.toISODateOnly(date);
          displayDate = `<time datetime="${dateAttr}">${displayDate}</time>`;
        }

        return `
          <div class="${CLASS_NAMES.timelinePoint}">${TIMELINE_POINT_SVG}</div>
          <div class="${CLASS_NAMES.timelineContent}">
            <div class="${CLASS_NAMES.header}">
              <h3 class="${CLASS_NAMES.dateTitle}">${displayDate}</h3>\
            </div>
            <ul class="${CLASS_NAMES.objectVersionsList}"></ul>
          </div>
        `;
      },

      /**
       * Count visible versions in this group that have a date-vs-chain anomaly
       * annotation.
       * @returns {number} Number of visible anomalous versions.
       */
      getVisibleDateChainAnomalyCount() {
        if (!this.collection?.length) return 0;
        return this.collection.reduce((count, model) => {
          if (model.get("hiddenByUI") === true) return count;
          if (model.get("versionDateConflict")) return count + 1;
          return count;
        }, 0);
      },

      /**
       * Renders the timeline group shell and embeds an ObjectVersionsView.
       * @returns {this} The view instance.
       */
      render() {
        // Hide the group if there are no versions to show, or if all versions
        // are hidden by the UI (e.g. filtered out by the DOI toggle)
        if (this.collection.length === 0 || this.collection.allHidden()) {
          this.el.innerHTML = "";
          this.el.classList.add(`${CLASS_NAMES.hidden}`);
          this.el.classList.remove(`${CLASS_NAMES.dateConflict}`);
          return this;
        }
        this.el.classList.remove(`${CLASS_NAMES.hidden}`);
        this.stopListening(this.collection);
        this.listenTo(
          this.collection,
          "change:hiddenByUI change:versionDateConflict",
          this.render,
        );

        // If there is a date jump, make the timeline point visually distinct
        const conflictCount = this.getVisibleDateChainAnomalyCount();
        this.el.classList.toggle(
          `${CLASS_NAMES.dateConflict}`,
          conflictCount > 0,
        );

        this.el.innerHTML = this.template({
          date: this.date,
          label: this.label,
        });
        const listEl = this.el.querySelector(
          `.${CLASS_NAMES.objectVersionsList}`,
        );

        if (this.objectVersionsView) {
          this.objectVersionsView.remove();
        }

        this.objectVersionsView = new ObjectVersionsView({
          collection: this.collection,
          el: listEl,
          referencePid: this.referencePid,
        }).render();

        return this;
      },

      /**
       * Replace the models backing this group while keeping the same collection
       * reference.
       * @param {object[]} models - Plain model attributes grouped for the date.
       */
      setModels(models) {
        this.collection.set(models, { parse: true, merge: true, sort: false });
      },

      /**
       * Update the group header date/label and re-render this group.
       * @param {Date|null} date Group date.
       * @param {string|null} label Group label.
       */
      setDateAndLabel(date, label) {
        this.date = date ?? null;
        this.label = label ?? null;
        this.render();
      },

      /**
       * Tears down nested views and clears the collection when the group is
       * removed.
       */
      onClose() {
        this.collection.reset();
        this.objectVersionsView?.remove();
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return VersionTimelineGroupView;
});
