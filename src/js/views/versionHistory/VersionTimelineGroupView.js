/**
 * A Backbone view that renders a single date bucket within the version history
 * timeline, including the list of ObjectVersionView entries for that date.
 */
define([
  "backbone",
  "collections/DataONEObjects",
  "views/versionHistory/ObjectVersionsView",
], (Backbone, DataONEObjects, ObjectVersionsView) => {
  "use strict";

  // SVG for the timeline point, included inline to avoid an extra request and
  // allow CSS styling
  const TIMELINE_POINT_SVG = `<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`;

  // Base class for the timeline group, used in the className property and for
  // scoping styles
  const BASE_CLASS = "version-history__group";

  /**
   * @class VersionTimelineGroupView
   * @classdesc A group of object versions for a specific date within the
   * version history timeline.
   * @classcategory Views/VersionHistory
   * @augments Backbone.View
   * @screenshot views/VersionTimelineGroupView.png // TODO: add screenshot
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
      className: BASE_CLASS,

      /**
       * Format the date label for display.
       * @param {string|Date} date Date value to format.
       * @returns {string} Formatted date label.
       */
      formatDate(date) {
        const options = { year: "numeric", month: "short", day: "numeric" };
        let newDate = new Date(date).toLocaleDateString(undefined, options);
        if (newDate === "Invalid Date") {
          newDate = date;
        }
        return newDate;
      },

      /**
       * @param {object} [options] View options.
       * @param {string} [options.date] The display date for the group header.
       * @param {DataONEObjects|object[]} [options.collection] - Collection or
       * raw data for the versions on that date.
       */
      initialize(options = {}) {
        this.date = options.date || "";
        this.collection =
          options.collection instanceof DataONEObjects
            ? options.collection
            : new DataONEObjects(options.collection || []);
        this.referencePid = options.referencePid || null;
      },

      /**
       * Base markup for the timeline group.
       * @param {{date: string}} params Template parameters.
       * @param {string} params.date Human-readable date label.
       * @returns {string} HTML string for the timeline group shell.
       */
      template({ date }) {
        const formattedDate = this.formatDate(date);

        return `
          <div class="timeline-point">${TIMELINE_POINT_SVG}</div>
          <div class="timeline-content">
            <h3>${formattedDate}</h3>
            <ul class="object-versions"></ul>
          </div>
        `;
      },

      /**
       * Renders the timeline group shell and embeds an ObjectVersionsView.
       * @returns {this} The view instance.
       */
      render() {
        this.el.innerHTML = this.template({ date: this.date });
        const listEl = this.el.querySelector(".object-versions");

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
        this.collection.set(models, { parse: true, merge: true });
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
