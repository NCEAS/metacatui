// TODO:
// - pagination if too many versions

/**
 * Backbone view that orchestrates fetching the version chain for a PID and
 * visualizing it as a grouped timeline with citations and status updates.
 */
define([
  "backbone",
  "models/sysmeta/VersionTracker",
  "collections/DataONEObjects",
  "models/SolrResult",
  "collections/versionHistory/VersionTimelineGroups",
  "views/versionHistory/VersionTimelineGroupsView",
  "views/CitationView",
  "common/Utilities",
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
  Utilities,
  VersionHistoryCSS,
) => {
  "use strict";

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
    summary: `${BASE_CLASS}__summary`,
    status: `${BASE_CLASS}__status alert alert-info`,
    history: `${BASE_CLASS}__history`,
  };

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
        <p class="${CLASS_NAMES.summary}" data-role="summary"></p>
        <div class="${CLASS_NAMES.status}" data-role="status" role="status"></div>
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
        this.summaryEl = this.el.querySelector('[data-role="summary"]');
        this.headerEl = this.el.querySelector(`[data-role="header"]`);

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
        this.stopListening(this.collection, "update reset sort");
        this.listenTo(this.collection, "update reset sort", () =>
          this.timelineGroups.fromDataONEObjects(this.collection, {
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
          if (!record) {
            throw new Error(
              `No version history found for the document with ID: <strong>${pid}</strong>.`,
            );
          }

          // Once all versions are found, show summary status
          const errorMessage = this.getErrorMessage(record);
          this.numNext = record.next.completedSteps || 0;
          this.numPrev = Math.abs(record.prev.completedSteps || 0);
          const { next, prev } = record;

          // If there were no errors and the full chain was traversed
          if (next.chainComplete && prev.chainComplete) {
            this.showComplete(errorMessage);
          } else {
            this.showPartial(errorMessage);
          }
        } catch (error) {
          if (error?.name === "AbortError") {
            return;
          }
          this.showError(error.message || error);
        } finally {
          if (this.chainAbortController === controller) {
            this.chainAbortController = null;
          }
        }
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
        this.updateStatus(
          `<p class="text-warning">⚠️ Warning: ${message}</p>`,
          "warning",
        );
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
        if (this.numNext === 0 && this.numPrev === 0) {
          message += `No other versions of the document with ID <strong>${this.pid}</strong> were found.`;
        } else {
          message += this.getVersionSummaryMessage();
        }
        if (error) {
          message += ` ${error}`;
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
        const nextStr = VERSION_STR(numNext, true);
        const prevStr = VERSION_STR(numPrev, false);
        return `Found ${nextStr} and ${prevStr} for the document with ID: <strong>${pid}</strong>.`;
      },

      /**
       * Updates the status alert with the provided HTML payload.
       * @param {string} message - HTML string.
       * @param {"info"|"danger"|"success"} [type] Type of alert to show.
       */
      updateStatus(message, type = "info") {
        this.statusEl.innerHTML = message;
        this.statusEl.classList.remove(
          "alert-info",
          "alert-danger",
          "alert-success",
        );
        this.statusEl.classList.add(`alert-${type}`);
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
        const sysMetaData = sysMeta.toJSON(true, ["versionHistory"]);
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

        return messages.join(" ");
      },

      /**
       * Cleans up listeners, nested views, and collections before re-rendering
       * or destroying the view.
       */
      onClose() {
        this.numNext = 0;
        this.numPrev = 0;
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
