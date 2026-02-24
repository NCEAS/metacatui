"use strict";

// TODO:
// - pagination if too many versions

define([
  "backbone",
  "models/sysmeta/VersionTracker",
  "collections/DataONEObjects",
  "models/SolrResult",
  "collections/versionHistory/VersionTimelineGroups",
  "views/versionHistory/VersionTimelineGroupsView",
  "views/CitationView",
  "views/uiElements/ToggleView",
  "common/Utilities",
  "common/DateUtility",
  // CSS
  `text!${MetacatUI.root}/css/version-history/version-history.css`,
], (
  Backbone,
  VersionTracker,
  DataONEObjects,
  SolrResult,
  VersionTimelineGroups,
  VersionTimelineGroupsView,
  CitationView,
  ToggleView,
  Utilities,
  DateUtility,
  VersionHistoryCSS,
) => {
  const SPINNER = `<i class="icon-spinner icon-spin icon-large loading icon"></i>`;

  // Friendly text to explain common server errors
  const ERROR_TEXT = {
    401: "You do not have permission to view the full version history. This means some versions may be private. Please log in with an account that has access rights.",
    All404: "No versions in the history were found in this data repository.",
    Some404:
      "Some versions in the history were not found in this data repository.",
    Next404:
      "At least one newer version was not found in this data repository.",
    Prev404:
      "At least one older version was not found in this data repository.",
    nextMaxHopsReached:
      "The search for newer versions was stopped after reaching the maximum steps allowed for a single search. To see more newer versions, please view the version history for the newest version found.",
    prevMaxHopsReached:
      "The search for older versions was stopped after reaching the maximum steps allowed for a single search. To see more older versions, please view the version history for the oldest version found.",
    bothMaxHopsReached:
      "The search for newer and older versions was stopped after reaching the maximum steps allowed for a single search. To see more versions, please view the version history for the newest and oldest versions found.",
    500: "An internal server error occurred while trying to retrieve the version history. Please try again later.",
    DEFAULT: "An unknown error occurred while retrieving the version history.",
  };

  const BASE_CLASS = "version-history";

  /**
   * Resolve singular/plural label for version counts.
   * @param {number} num Count to evaluate.
   * @returns {string} "version" or "versions".
   */
  const VERSIONS = (num) => (num === 1 ? "version" : "versions");

  /**
   * Build a summary string for a version count and direction.
   * @param {number} num Number of versions.
   * @param {boolean} [next] True for newer direction, false for older.
   * @returns {string} HTML string summarizing the version count and direction,
   * e.g. "<strong>3</strong> newer versions".
   */
  const VERSION_STR = (num, next = true) => {
    const numStr = num === 0 ? "no" : num;
    const direction = next ? "newer" : "older";
    return `<strong>${numStr}</strong> ${direction} ${VERSIONS(num)}`;
  };

  /**
   * CSS class names used throughout the VersionHistoryView.
   * @enum {string}
   */
  const CLASS_NAMES = {
    base: BASE_CLASS,
    header: `${BASE_CLASS}__header`,
    subtitle: `${BASE_CLASS}__subtitle`,
    status: `${BASE_CLASS}__status alert alert-info`,
    dateConflictSummary: `alert alert-warning ${BASE_CLASS}__date-conflict-summary`,
    dateConflictHidden: `version-history--hidden`,
    history: `${BASE_CLASS}__history`,
    toggle: `${BASE_CLASS}__toggle`,
  };

  /**
   * Backbone view that orchestrates fetching the version chain for a PID and
   * visualizing it as a grouped timeline with citations and status updates.
   * @class VersionHistoryView
   * @classdesc A view that renders the version history for a given PID, showing
   * progress as it is fetched and summarizing the results once complete.
   * @classcategory Views/VersionHistory
   * @augments Backbone.View
   * @screenshot views/versionHistory/VersionHistoryView.png
   * @since 0.0.0
   */
  const VersionHistoryView = Backbone.View.extend(
    /** @lends VersionHistoryView.prototype */ {
      /**
       * Identifier used when the application inspects view types.
       * @type {string}
       */
      type: "VersionHistoryView",

      /**
       * Root element tag for the view.
       * @type {string}
       */
      tagName: "section",

      /**
       * CSS class names applied to the view's root element.
       * @type {string}
       */
      className: CLASS_NAMES.base,

      /**
       * Initializes the VersionHistoryView and prepares the version tracker.
       * @param {object} [options] - Configuration options for the view.
       * @param {string} [options.pid] - The PID whose history should be shown.
       */
      initialize(options = {}) {
        this.pid = options.pid?.trim() || "";
        this.collection = new DataONEObjects();
        this.timelineGroups = new VersionTimelineGroups();
        this.chainAbortController = null;
        this.completed = false;
        MetacatUI.appModel.addCSS(VersionHistoryCSS, "versionHistoryView");
      },

      /**
       * Template for the static layout of the view.
       * @returns {string} HTML string representing the view skeleton.
       */
      template() {
        return `
        <header class="${CLASS_NAMES.header}" data-role="header">
          <h1>Version History</h1>
        </header>
        <div class="${CLASS_NAMES.status}" data-role="status" role="status"></div>
        <div class="${CLASS_NAMES.dateConflictSummary} ${CLASS_NAMES.dateConflictHidden}" data-role="date-conflict-summary"></div>
        <div class="${CLASS_NAMES.toggle}" data-role="toggle"></div>
        <div class="${CLASS_NAMES.history}" data-role="list"></div>
        `.trim();
      },

      /**
       * Renders the base markup and loads version history for the current PID.
       * @returns {VersionHistoryView} The current view instance.
       */
      async render() {
        // Clean up any previous listeners & subviews
        this.onClose();

        // Begin with the toggle defaulted to "all" so all versions are shown as
        // they are found
        this.showDOIOnly = false;

        if (!MetacatUI.appUserModel.get("loggedIn")) {
          this.listenToOnce(MetacatUI.appUserModel, "change:loggedIn", () =>
            this.render(),
          );
        }

        if (!this.versionTracker) {
          const metaServiceUrl = await Utilities.awaitMetacatUI({
            property: "metaServiceUrl",
          });
          this.versionTracker = new VersionTracker({
            metaServiceUrl,
          });
        }

        this.el.innerHTML = this.template();
        this.statusEl = this.el.querySelector('[data-role="status"]');
        this.listEl = this.el.querySelector('[data-role="list"]');
        this.pidEl = this.el.querySelector('[data-role="pid"]');
        this.headerEl = this.el.querySelector(`[data-role="header"]`);
        this.dateConflictSummaryEl = this.el.querySelector(
          `[data-role="date-conflict-summary"]`,
        );
        this.toggleEl = this.el.querySelector(`[data-role="toggle"]`);

        this.timelineGroupsView?.remove();
        this.timelineGroupsView = new VersionTimelineGroupsView({
          el: this.listEl,
          collection: this.timelineGroups,
          referencePid: this.pid,
        }).render();

        if (!this.pid) {
          this.showError(
            'No document ID ("PID") was provided. Search for a dataset to see its version history.',
          );
          return this;
        }

        this.renderToggle();
        this.showLoading();
        this.renderHeader();
        this.listenToVersionsFound();
        this.findVersions();

        return this;
      },

      /**
       * Fetches additional Solr metadata so the citation header can be
       * rendered.
       */
      renderHeader() {
        // temporarily show the PID until Solr data is fetched
        const pidHeader = document.createElement("h4");
        pidHeader.className = CLASS_NAMES.subtitle;
        // Avoid injecting unsanitized string into DOM (users could create
        // malicious versionHistory/<payload> URL)
        const htmlPid = Utilities.encodeHTML(this.pid);
        pidHeader.textContent = `ID: ${htmlPid}`;
        this.headerEl.appendChild(pidHeader);
        this.solrResultModel = new SolrResult({
          id: this.pid,
        });
        this.citationView = new CitationView({
          model: this.solrResultModel,
          createLink: false,
          createTitleLink: true,
        });

        this.listenToOnce(this.solrResultModel, "sync", () => {
          // remove the temporary PID header
          this.headerEl.removeChild(pidHeader);
          // render the citation view
          this.headerEl.appendChild(this.citationView.el);
          this.citationView.render();
        });
        this.solrResultModel.getInfo();
      },

      /**
       * Create the toggle view for showing all versions vs. DOI-only versions,
       * and listen for changes to update the timeline groups accordingly.
       */
      renderToggle() {
        this.toggle = new ToggleView({
          disabled: true, // start disabled until versions are loaded
          selected: "all",
          options: [
            {
              value: "all",
              label: "All Versions",
              tooltip: "Show all versions regardless of DOI status",
              icon: "list",
            },
            {
              value: "doi",
              label: "DOI Only",
              tooltip: "Only show versions published with a DOI",
              icon: "star",
            },
          ],
        }).render();
        this.toggleEl.appendChild(this.toggle.el);
        this.listenTo(this.toggle, "toggle:change", this.onToggle);
      },

      /**
       * When the toggle is changed, update the "hiddenByUI" attribute on each object
       * model to control whether it is shown in the timeline groups.
       * @param {"all"|"doi"} value The currently selected toggle value.
       */
      onToggle(value) {
        const showDOIOnly = value === "doi";
        if (this.showDOIOnly === showDOIOnly) return; // No change
        this.showDOIOnly = showDOIOnly;
        let anyChanged = false;
        this.collection.each((model) => {
          const hidden = showDOIOnly && !model.isDOI();
          if (model.get("hiddenByUI") !== hidden) {
            model.set("hiddenByUI", hidden, { silent: true });
            anyChanged = true;
          }
        });
        if (!anyChanged) return;
        this.timelineGroupsView.updateVisualState();
      },

      /**
       * Sets up listeners to respond to VersionTracker updates and to mirror
       * the fetched collection into the timeline groups collection.
       */
      listenToVersionsFound() {
        const { pid, versionTracker } = this;
        // when the version tracker finds a new version, update collection & UI
        this.stopListening(versionTracker.events, `versionFound:${pid}`);
        this.listenTo(
          versionTracker.events,
          `versionFound:${pid}`,
          (sysMeta) => {
            this.onVersionFound(sysMeta);
          },
        );
        // When the collection updates, keep the timeline collection in sync
        this.stopListening(this.collection, "update reset");
        this.listenTo(this.collection, "update reset", () =>
          this.timelineGroups?.fromDataONEObjects(this.collection, {
            remove: true,
            referencePid: this.pid,
          }),
        );
      },

      /**
       * Requests the full version chain for the view's PID.
       * @returns {Promise<void>}
       */
      async findVersions() {
        this.completed = false;
        if (this.toggle) {
          this.toggle.disable();
        }
        let controller = null;
        try {
          const { pid, versionTracker } = this;
          // Stop any ongoing fetches
          this.abortChainFetch(
            "VersionHistoryView: Starting new version fetch",
          );
          // Make a new abort controller for this fetch
          controller =
            typeof AbortController === "function"
              ? new AbortController()
              : null;
          this.chainAbortController = controller;
          const signal = controller?.signal;

          // Mock a record update for the current PID to show initial progress
          const thisSysMeta = new VersionTracker.SysMeta({
            identifier: pid,
            versionHistory: { [pid]: 0 },
          });
          this.onVersionFound(thisSysMeta);

          const record = await versionTracker.getAllVersions(pid, { signal });

          // If the fetch was aborted, don't update the view with any results
          const isCurrent = this.chainAbortController === controller;
          if (!isCurrent) return;

          this.completed = true;

          if (!record) {
            throw new Error(
              `No version history found for the document with ID: <strong>${pid}</strong>.`,
            );
          }

          // Once all versions are found, show summary status
          const errorMessage = this.getErrorMessage(record);
          const { next, prev } = record;

          this.numNext = next.completedSteps || 0;
          this.numPrev = Math.abs(prev.completedSteps || 0);

          // If there were no errors and the full chain was traversed
          if (next.chainComplete && prev.chainComplete) {
            this.showComplete(errorMessage);
          } else {
            this.showPartial(errorMessage);
          }

          // Render any detected version date conflicts in the summary
          const dateConflicts = [
            ...record.next.dateConflicts,
            ...record.prev.dateConflicts,
          ];
          this.showDateConflicts(dateConflicts);
        } catch (error) {
          this.completed = true;
          if (error?.name === "AbortError") {
            return;
          }

          this.showError(error.message || error);
        } finally {
          const isCurrent = this.chainAbortController === controller;
          if (isCurrent) {
            this.completed = true;
            this.chainAbortController = null;
            // Enable the toggle now that versions have loaded (even if there was
            // an error, some versions may have been found)
            if (this.toggle) this.toggle.enable();
            this.addTooltips();
          }
        }
      },

      /** Add tooltips to Version views once they're rendered and in the DOM. */
      addTooltips() {
        this.timelineGroupsView?.addTooltips();
      },

      /**
       * Presents a loading message in the status region.
       */
      showLoading() {
        this.updateStatus(
          `${SPINNER} Getting versions for the document with ID: <strong>${this.pid}</strong>...`,
        );
      },

      /**
       * Updates the status region to show progress as versions are found.
       * @param {string} [message] - Custom progress message. If not provided, a
       * default message based on the number of versions found will be shown.
       */
      showProgress(message) {
        // Don't update the progress message if we've already found all
        // versions, or else we might overwrite the status message set in
        // showComplete or showPartial (or error)
        if (this.completed) return;
        const defaultMessage =
          `Found ${this.numNext} newer versions and ${this.numPrev} older ` +
          `versions for the document with ID: <strong>${this.pid}</strong>. Still searching...`;
        this.updateStatus(`${SPINNER} ${message || defaultMessage}`);
      },

      /**
       * Displays an error banner in the status region.
       * @param {string} message The error message to display.
       */
      showError(message) {
        this.updateStatus(
          `<p class="text-danger">❌ Error: ${message}</p>`,
          "danger",
        );
      },

      /**
       * Displays a warning banner in the status region.
       * @param {string} message The warning message to display.
       */
      showWarning(message) {
        this.updateStatus(`<b>⚠️ Warning:</b> ${message}`, "warning");
      },

      /**
       * Displays a success banner once the VersionTracker finishes traversing.
       * @param {string} [error] An optional error message to append.
       */
      showComplete(error) {
        let type = "success";
        let message = this.getVersionSummaryMessage();
        if (this.numNext === 0 && this.numPrev === 0) {
          message += ` This document is the first and only version so far.`;
        }
        if (error) {
          message += `. ${error}`;
          type = "warning";
        }
        this.updateStatus(message, type);
      },

      /**
       * Displays a warning banner if the VersionTracker could not fully
       * traverse the version chain.
       * @param {string} [error] An optional error message to append.
       */
      showPartial(error) {
        let message = "Incomplete version history. ";
        if (error) {
          message += ` ${error}`;
        }
        if (this.numNext === 0 && this.numPrev === 0) {
          message += `No other versions of the document with ID <strong>${this.pid}</strong> were found.`;
        } else {
          message += " ";
          message += this.getVersionSummaryMessage();
        }
        this.showWarning(message);
      },

      /**
       * Generates HTML strings for the number of next and previous versions.
       * @returns {string} A string summarizing the number of versions found for
       * the current PID.
       */
      getVersionSummaryMessage() {
        const { numNext, numPrev, pid } = this;
        const htmlPid = Utilities.encodeHTML(pid);
        const nextStr = VERSION_STR(numNext, true);
        const prevStr = VERSION_STR(numPrev, false);
        const dateRange = this.collection.getDateRange();
        let dateStr = "";
        if (dateRange) {
          dateStr = DateUtility.getRelativeDateString(
            dateRange.minDate,
            dateRange.maxDate,
            { newerWord: "", olderWord: "", currentWord: "" },
          ).trim();
          if (dateStr) {
            dateStr = ` spanning <b>${dateStr}</b>`;
          }
        }
        return `Found ${nextStr} and ${prevStr}${dateStr} for the document with ID: <strong>${htmlPid}</strong>.`;
      },

      /**
       * Updates the status alert with the provided HTML payload.
       * @param {string} message - HTML string.
       * @param {"info"|"danger"|"success"|"warning"} [type] Type of alert to
       * show.
       */
      updateStatus(message, type = "info") {
        this.statusEl.innerHTML = message;
        this.statusEl.classList.remove(
          "alert-info",
          "alert-danger",
          "alert-success",
          "alert-warning",
        );
        this.statusEl.classList.add(`alert-${type}`);
      },

      /** Remove date conflicts flags from models and clear the summary. */
      clearDateConflicts() {
        if (this.collection) {
          this.collection.each((model) => {
            if (model.has("versionDateConflict")) {
              model.unset("versionDateConflict");
            }
          });
        }
        if (this.dateConflictSummaryEl) {
          this.dateConflictSummaryEl.classList.add(
            CLASS_NAMES.dateConflictHidden,
          );
          this.dateConflictSummaryEl.innerHTML = "";
        }
      },

      /**
       * Render a page-level summary for detected version date conflicts, i.e.
       * cases where the date a obsoleting version was uploaded is *earlier*
       * than the date of the version it obsoletes.
       * @param {VersionTracker.DateConflict[]} conflicts An array of
       * detected version date conflicts to summarize. If not provided, the
       * summary will be cleared.
       */
      showDateConflicts(conflicts = []) {
        this.clearDateConflicts();
        const count = Array.isArray(conflicts) ? conflicts.length : 0;
        if (!this.dateConflictSummaryEl || !count || !this.collection) {
          return;
        }
        if (count === 0) return;
        this.dateConflictSummaryEl.classList.remove(
          CLASS_NAMES.dateConflictHidden,
        );
        const s = count > 1 ? "s" : "";
        const be = count > 1 ? "were" : "was";
        const replace = count > 1 ? "they replace" : "it replaces";
        // TODO: fix wording, make configurable...
        this.dateConflictSummaryEl.innerHTML =
          `<strong>⏰ Date Conflict${s} Detected:</strong> The dates ` +
          `in the version history are not strictly chronological. ${count} ` +
          `version${s} ${be} uploaded after the version${s} ${replace},` +
          ` which can happen when records are added or corrected at a later date.`;

        conflicts.forEach((conflict) => {
          // Just mark the previous version in the conflict because that is the
          // one with the anomalous upload date (i.e. it was uploaded after the
          // version that obsoletes it)
          const { prevPid } = conflict;
          const prevModel = this.collection.get(prevPid);
          prevModel?.set("versionDateConflict", conflict);
        });
      },

      /**
       * Runs when the VersionTracker notifies the view that a new version
       * of the PID has been found.
       * @param {object} sysMeta The system metadata object for the found
       * version.
       */
      onVersionFound(sysMeta) {
        if (!sysMeta || !sysMeta?.data?.identifier) {
          return;
        }

        // When requesting sysMeta for a series ID, Metacat will return the latest
        // version in that series.
        if (sysMeta.seriesId === this.pid) {
          // Delete the record with the series ID because we don't want it to
          // appear as a separate version in the timeline
          this.collection.remove(this.pid);
          if (this.pid !== sysMeta.data.identifier) {
            this.pid = sysMeta.data.identifier;
            this.render();
          }
          return;
        }

        const index = sysMeta.versionHistory?.[this.pid];
        if (index > 0) {
          this.numNext = index;
        } else if (index < 0) {
          this.numPrev = Math.abs(index);
        }
        const sysMetaData = sysMeta.toJSON(true, ["versionHistory", "errors"]);
        // For merging purposes, ensure id is set to identifier
        sysMetaData.id = sysMetaData.identifier;
        this.collection.add(sysMetaData, { merge: true });
        this.showProgress();
      },

      /**
       * Generates an error message based on the obsolescence chain record.
       * @param {object} record The version tracker record for the current PID.
       * @returns {string} A concatenated error message based on the record's
       * properties.
       */
      getErrorMessage(record) {
        const messages = [];
        const { next, prev } = record;

        // If versions in the obsolesence chain are private
        const nextPrivate = next.endIsPrivate || false;
        const prevPrivate = prev.endIsPrivate || false;
        if (nextPrivate || prevPrivate) {
          messages.push(ERROR_TEXT["401"]);
        }

        // If versions in the obsolesence chain dont have associated sysmeta
        const next404 = next.endNotFound || false;
        const prev404 = prev.endNotFound || false;
        if (next404 && prev404) {
          if (next.completedSteps === 0 && prev.completedSteps === 0) {
            return ERROR_TEXT.All404;
          }
          messages.push(ERROR_TEXT.Some404);
        } else if (next404) {
          messages.push(ERROR_TEXT.Next404);
        } else if (prev404) {
          messages.push(ERROR_TEXT.Prev404);
        }

        const nextMaxed = next.maxHopsReached || false;
        const prevMaxed = prev.maxHopsReached || false;
        if (nextMaxed && prevMaxed) {
          messages.push(ERROR_TEXT.bothMaxHopsReached);
        } else if (nextMaxed) {
          messages.push(ERROR_TEXT.nextMaxHopsReached);
        } else if (prevMaxed) {
          messages.push(ERROR_TEXT.prevMaxHopsReached);
        }

        return messages.join(" ");
      },

      /**
       * Cleans up listeners, nested views, and collections before re-rendering
       * or destroying the view.
       */
      onClose() {
        this.completed = false;
        this.numNext = 0;
        this.numPrev = 0;
        this.clearDateConflicts();
        this.abortChainFetch(
          "VersionHistoryView: Cleaning up before re-render or destroy",
        );
        if (this.versionTracker?.events) {
          this.stopListening(this.versionTracker?.events);
        }
        if (this.solrResultModel) {
          this.stopListening(this.solrResultModel);
        }
        if (this.collection) {
          this.stopListening(this.collection);
        }
        this.citationView?.remove();
        this.timelineGroupsView?.remove();
        this.timelineGroupsView = null;
        this.timelineGroups?.reset();
        this.citationView = null;
        this.solrResultModel = null;
        this.dateConflictSummaryEl = null;
        this.collection?.reset();
      },

      /**
       * Abort the current request to find all versions
       * @param {string} [reason] Optional reason for aborting, useful for
       * debugging.
       */
      abortChainFetch(reason) {
        if (this.chainAbortController) {
          this.chainAbortController.abort(reason);
          this.chainAbortController = null;
        }
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return VersionHistoryView;
});
