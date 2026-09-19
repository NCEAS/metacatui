"use strict";

define([
  "backbone",
  "views/maps/ScaleBarView",
  "views/maps/LayerLoadingIndicatorView",
], (Backbone, ScaleBarView, LayerLoadingIndicatorView) => {
  /**
   * The loading row only expands into view once a layer has been loading longer
   * than this, so brief loads never cause a visible flash.
   * @type {number}
   */
  const REVEAL_DELAY_MS = 1000;

  /**
   * Once expanded, the loading row stays open at least this long, so it never
   * collapses right after opening (which would look jerky).
   * @type {number}
   */
  const MIN_OPEN_DURATION_MS = 1000;

  /**
   * Message shown briefly when loading finishes while the row is still open.
   * @type {string}
   */
  const COMPLETED_MESSAGE = "Loading completed!";

  /**
   * Minimum time between visible message text updates. Layer status can churn
   * (e.g. several layers finishing/starting within milliseconds of each other),
   * so updates are throttled to this rate rather than applied as soon as they
   * happen, which would make the message flicker between different layer
   * names/counts.
   * @type {number}
   */
  const MESSAGE_UPDATE_INTERVAL_MS = 400;

  const CLASS_NAMES = {
    expanded: "map-status-bar--loading-expanded",
  };

  /**
   * @class MapStatusBarView
   * @classdesc Combines the map's {@link ScaleBarView} with a
   * {@link LayerLoadingIndicatorView} that expands beneath it while layers are
   * loading. This view owns all of the timing/animation logic that decides *when*
   * the loading row is shown, so that neither of its children need to know about
   * delays, minimum open durations, or the "completed" message.
   * @classcategory Views/Maps
   * @name MapStatusBarView
   * @augments Backbone.View
   * @since 0.0.0
   * @constructs
   */
  const MapStatusBarView = Backbone.View.extend(
    /** @lends MapStatusBarView.prototype */ {
      /** @inheritdoc */
      className: "map-status-bar",

      /**
       * @param {object} options The options for this view.
       * @param {Map} options.model The map model that provides the aggregate
       * `isLoadingLayers`/`loadingLayersMessage` loading state.
       * @param {GeoScale} options.scaleModel Passed through to the ScaleBarView.
       * @param {GeoPoint} options.pointModel Passed through to the ScaleBarView.
       */
      initialize(options = {}) {
        this.model = options.model;
        this.scaleModel = options.scaleModel;
        this.pointModel = options.pointModel;
        this.revealTimer = null;
        this.collapseTimer = null;
        this.messageUpdateTimer = null;
        this.lastMessageUpdateAt = 0;
        this.pendingMessage = null;
        this.expandedAt = null;
        this.isCurrentlyLoading = false;
      },

      /** @inheritdoc */
      render() {
        this.scaleBar = new ScaleBarView({
          scaleModel: this.scaleModel,
          pointModel: this.pointModel,
        });
        // Attach before rendering so the initial update:barWidth (fired during
        // render) is caught and the CSS variable starts in sync.
        this.listenTo(
          this.scaleBar,
          "update:barWidth",
          this.handleBarWidthChange,
        );
        this.scaleBar.render();
        this.$el.append(this.scaleBar.el);

        this.loadingIndicator = new LayerLoadingIndicatorView().render();
        this.$el.append(this.loadingIndicator.el);

        this.stopListening(this.model);
        this.listenTo(
          this.model,
          "change:isLoadingLayers change:loadingLayersMessage",
          this.handleLoadingStateChange,
        );
        this.handleLoadingStateChange();

        return this;
      },

      /**
       * Mirror the scale bar's live pixel width onto this element's own style so
       * this box's width (see `.map-status-bar` in map-view.css) can track it via a
       * plain CSS calc(), growing/shrinking by the same amount.
       * @param {number} barWidth The scale bar graphic's current width, in pixels.
       */
      handleBarWidthChange(barWidth) {
        this.el.style.setProperty(
          "--map-status-bar-bar-width",
          `${barWidth}px`,
        );
      },

      /**
       * React to changes in the map's aggregate layer-loading state.
       */
      handleLoadingStateChange() {
        const isLoading = this.model.get("isLoadingLayers") === true;

        if (!isLoading) {
          this.isCurrentlyLoading = false;
          this.handleLoadingFinished();
          return;
        }

        const message =
          this.model.get("loadingLayersMessage") || "Loading layers";
        const justStarted = !this.isCurrentlyLoading;
        this.isCurrentlyLoading = true;

        if (justStarted) {
          // A fresh loading start (or resume right after finishing) is a
          // meaningful transition, not churn, so show it immediately instead
          // of waiting out the throttle window below.
          this.clearMessageUpdateTimer();
          this.pendingMessage = message;
          this.flushMessageUpdate();
        } else {
          this.scheduleMessageUpdate(message);
        }

        if (this.isExpanded()) {
          // Loading resumed/changed while already open; keep it open.
          this.clearCollapseTimer();
          return;
        }

        this.scheduleReveal();
      },

      /**
       * Show the latest message, but no more than once every
       * {@link MESSAGE_UPDATE_INTERVAL_MS}, so a burst of near-simultaneous
       * layer status changes settles into a single visible update instead of
       * flickering through every intermediate value. Always resolves to the
       * most recent message once the interval has elapsed.
       * @param {string} message The latest message to (eventually) display.
       */
      scheduleMessageUpdate(message) {
        this.pendingMessage = message;

        const elapsed = Date.now() - this.lastMessageUpdateAt;
        if (elapsed >= MESSAGE_UPDATE_INTERVAL_MS) {
          this.flushMessageUpdate();
          return;
        }

        if (this.messageUpdateTimer) return;
        this.messageUpdateTimer = setTimeout(() => {
          this.messageUpdateTimer = null;
          this.flushMessageUpdate();
        }, MESSAGE_UPDATE_INTERVAL_MS - elapsed);
      },

      /** Render the currently pending message and record the update time. */
      flushMessageUpdate() {
        this.lastMessageUpdateAt = Date.now();
        this.loadingIndicator.setMessage(this.pendingMessage);
      },

      /** @returns {boolean} Whether the loading row is currently expanded. */
      isExpanded() {
        return this.el.classList.contains(CLASS_NAMES.expanded);
      },

      /**
       * Wait for {@link REVEAL_DELAY_MS} before expanding, so brief loads never
       * cause the loading row to flash open then closed.
       */
      scheduleReveal() {
        if (this.revealTimer || this.isExpanded()) return;
        this.revealTimer = setTimeout(() => {
          this.revealTimer = null;
          if (this.model.get("isLoadingLayers") === true) this.expand();
        }, REVEAL_DELAY_MS);
      },

      /** Expand the status bar to reveal the loading row. */
      expand() {
        this.expandedAt = Date.now();
        this.el.classList.add(CLASS_NAMES.expanded);
      },

      /** Collapse the status bar back down to just the scale bar. */
      collapse() {
        this.clearRevealTimer();
        this.clearCollapseTimer();
        this.expandedAt = null;
        this.el.classList.remove(CLASS_NAMES.expanded);
      },

      /**
       * Handle loading having finished, whether or not the row ever opened. If it
       * finished before it was ever revealed, this is a no-op (no flash). If it
       * finished before the minimum open duration elapsed, show a brief "completed"
       * message before collapsing; otherwise collapse right away.
       */
      handleLoadingFinished() {
        this.clearRevealTimer();
        this.clearMessageUpdateTimer();
        if (!this.isExpanded()) return;

        const remaining = MIN_OPEN_DURATION_MS - (Date.now() - this.expandedAt);
        if (remaining <= 0) {
          this.collapse();
          return;
        }

        // Completion is a definitive, one-time change, so it bypasses the
        // message throttle rather than waiting for it.
        this.pendingMessage = COMPLETED_MESSAGE;
        this.flushMessageUpdate();
        this.clearCollapseTimer();
        this.collapseTimer = setTimeout(() => {
          this.collapseTimer = null;
          this.collapse();
        }, remaining);
      },

      /** Clear the pending reveal timer, if any. */
      clearRevealTimer() {
        if (!this.revealTimer) return;
        clearTimeout(this.revealTimer);
        this.revealTimer = null;
      },

      /** Clear the pending collapse timer, if any. */
      clearCollapseTimer() {
        if (!this.collapseTimer) return;
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      },

      /** Clear the pending message-update timer, if any. */
      clearMessageUpdateTimer() {
        if (!this.messageUpdateTimer) return;
        clearTimeout(this.messageUpdateTimer);
        this.messageUpdateTimer = null;
      },

      /** @inheritdoc */
      onClose() {
        this.clearRevealTimer();
        this.clearCollapseTimer();
        this.clearMessageUpdateTimer();
        this.stopListening(this.model);
        if (this.scaleBar?.onClose) this.scaleBar.onClose();
      },
    },
  );

  return MapStatusBarView;
});
