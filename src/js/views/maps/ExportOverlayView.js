"use strict";

define([
  "underscore",
  "backbone",
  "common/mapExport/constants",
  "common/mapExport/ExportLayout",
  "common/mapExport/legendEntries",
  "common/mapExport/citations",
  "common/mapExport/scaleBar",
  "common/mapExport/painters/FramePainter",
], (
  _,
  Backbone,
  constants,
  ExportLayout,
  getLegendEntries,
  getCitations,
  ScaleBar,
  FramePainter,
) => {
  const BLOCK = "map-export-overlay";

  const TEMPLATE = `
          <div class="${BLOCK}__frame"></div>
          <canvas class="${BLOCK}__preview" aria-hidden="true"></canvas>
          <div class="${BLOCK}__mask" hidden role="alertdialog" aria-label="Preparing export">
            <div class="${BLOCK}__mask-box">
              <p class="${BLOCK}__mask-message"></p>
              <button class="map-view__button" type="button" data-action="cancel">Cancel</button>
            </div>
          </div>`;;

  const { STYLE } = constants;

  /**
   * @class ExportOverlayView
   * @classdesc Shows, on top of the map, what the exported image will contain:
   * a dashed outline of the frame, and a preview of the legend, scale bar and
   * north arrow drawn with the same code that draws the saved image. Also
   * provides the mask that covers the map while the image is being created.
   * @classcategory Views/Maps
   * @name ExportOverlayView
   * @augments Backbone.View
   * @since 2.41.0
   * @constructs
   * @fires ExportOverlayView#summary
   * @fires ExportOverlayView#cancel
   */
  const ExportOverlayView = Backbone.View.extend(
    /** @lends ExportOverlayView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ExportOverlayView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: BLOCK,

      /**
       * The Map model.
       * @type {Map}
       */
      model: null,

      /**
       * The map widget.
       * @type {CesiumWidgetView}
       */
      widget: null,

      /** @inheritdoc */
      events: {
        "click [data-action='cancel']": "handleMaskCancel",
      },

      /**
       * @param {object} options Options.
       * @param {Map} options.model The Map model.
       * @param {CesiumWidgetView} options.widget The map widget.
       */
      initialize(options) {
        this.model = options.model;
        this.widget = options.widget;
        this.frame = null;
        this.layout = null;
        this.entries = [];
        this.citationTexts = [];
        this.contentSignature = null;
        this.summary = null;
        this.frameRedrawRequest = null;
        // A debounce would never fire while tiles load, since the scene keeps
        // rendering; a throttle still runs every interval.
        this.refreshContentThrottled = _.throttle(
          () => this.refreshContent(),
          150,
        );
        this.onPostRender = () => {
          if (this.frameRedrawRequest !== null) return;
          this.frameRedrawRequest = window.requestAnimationFrame(() => {
            this.frameRedrawRequest = null;
            this.redraw();
          });
          this.refreshContentThrottled();
        };
      },

      /**
       * Renders this view
       * @returns {ExportOverlayView} Returns the rendered view
       */
      render() {
        this.el.innerHTML = TEMPLATE;
        this.frameEl = this.el.querySelector(`.${BLOCK}__frame`);
        this.canvas = this.el.querySelector(`.${BLOCK}__preview`);
        this.maskEl = this.el.querySelector(`.${BLOCK}__mask`);
        this.maskMessageEl = this.el.querySelector(`.${BLOCK}__mask-message`);
        this.measure = ExportLayout.createMeasurer(
          document.createElement("canvas").getContext("2d"),
        );
        return this;
      },

      /**
       * Start redrawing the preview whenever the map renders.
       */
      start() {
        this.stop();
        this.removeRenderListener = this.widget.scene.postRender.addEventListener(
          this.onPostRender,
        );
        // Layer changes update the preview immediately instead of waiting for
        // the next rendered frame.
        const layers = this.model.get("allLayers");
        if (layers) {
          this.listenTo(
            layers,
            "change:visible add remove reset change:colorPalette appearanceChanged",
            this.refreshContent,
          );
        }
        this.refreshContent();
        this.widget.scene.requestRender();
      },

      /**
       * Stop redrawing the preview.
       */
      stop() {
        this.stopListening(this.model.get("allLayers"));
        if (this.removeRenderListener) {
          this.removeRenderListener();
          this.removeRenderListener = null;
        }
        if (this.frameRedrawRequest !== null) {
          window.cancelAnimationFrame(this.frameRedrawRequest);
          this.frameRedrawRequest = null;
        }
        this.refreshContentThrottled.cancel?.();
      },

      /**
       * Set the frame, in CSS pixels relative to the top left of the map, and
       * redraw the preview.
       * @param {object} frame The frame (`left`, `top`, `width` and `height`).
       */
      setFrame(frame) {
        this.frame = frame;
        Object.assign(this.frameEl.style, {
          left: `${frame.left}px`,
          top: `${frame.top}px`,
          width: `${frame.width}px`,
          height: `${frame.height}px`,
        });
        const ratio = window.devicePixelRatio || 1;
        Object.assign(this.canvas.style, {
          left: `${frame.left}px`,
          top: `${frame.top}px`,
          width: `${frame.width}px`,
          height: `${frame.height}px`,
        });
        this.canvas.width = Math.max(Math.round(frame.width * ratio), 1);
        this.canvas.height = Math.max(Math.round(frame.height * ratio), 1);
        this.updateLayout();
        this.redraw();
      },

      /**
       * Read the legend and citations from the map model, and redraw if they
       * have changed.
       */
      refreshContent() {
        const entries = getLegendEntries(this.model);
        const citations = getCitations(this.model).map(
          getCitations.formatCitation,
        );
        const signature = JSON.stringify([entries, citations]);
        if (signature === this.contentSignature) return;
        this.contentSignature = signature;
        this.entries = entries;
        this.citationTexts = citations;
        this.updateLayout();
        this.redraw();
      },

      /**
       * Recompute the layout of the legend and the bands.
       */
      updateLayout() {
        if (!this.frame) return;
        this.layout = ExportLayout.compute({
          frame: this.frame,
          entries: this.entries,
          citations: this.citationTexts,
          measure: this.measure,
        });
        this.updateSummary({});
      },

      /**
       * @returns {{entries: LegendEntry[], citations: string[]}} The content
       * that will be exported.
       */
      getContent() {
        this.refreshContent();
        return { entries: this.entries, citations: this.citationTexts };
      },

      /**
       * Redraw the preview of the legend, scale bar and north arrow.
       */
      redraw() {
        if (!this.frame || !this.layout || !this.widget?.scene) return;
        const ratio = window.devicePixelRatio || 1;
        const ctx = this.canvas.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        const info = this.widget.getExportViewInfo(this.frame);
        const choice = ScaleBar.chooseScaleBar(
          info.metersPerPixel,
          STYLE.scaleBar.maxBarWidth,
        );
        const frameSize = { width: this.frame.width, height: this.frame.height };
        const scaleBar = ExportLayout.placeScaleBar({
          frame: frameSize,
          choice,
          measure: this.measure,
        });
        const northArrow = ExportLayout.placeNorthArrow({
          frame: frameSize,
          scaleBar,
        });
        FramePainter.paintFrame(ctx, {
          layout: this.layout,
          scaleBar,
          northArrow,
          northRotation: info.northRotation,
        });
        this.updateSummary({ scaleBarShown: Boolean(scaleBar) });
      },

      /**
       * Remember what the export will contain, and tell listeners if it changed.
       * @param {object} changes The values to update.
       */
      updateSummary(changes) {
        const previous = this.summary || {};
        const next = {
          scaleBarShown: previous.scaleBarShown ?? true,
          ...previous,
          ...changes,
          overflowCount: this.layout?.overflowCount ?? 0,
          extraHeight: this.layout?.extraHeight ?? 0,
        };
        this.summary = next;
        if (JSON.stringify(previous) === JSON.stringify(next)) return;
        /**
         * @event ExportOverlayView#summary
         * @property {object} summary `overflowCount` (layers that move to the
         * band below the image), `extraHeight` (the height of the bands, in
         * CSS pixels) and `scaleBarShown`.
         */
        this.trigger("summary", next);
      },

      /**
       * Cover the map with a message and a Cancel button.
       * @param {string} message The message.
       */
      showMask(message) {
        this.maskMessageEl.textContent = message;
        this.maskEl.hidden = false;
        this.maskEl.querySelector("button")?.focus();
      },

      /**
       * Remove the mask.
       */
      hideMask() {
        this.maskEl.hidden = true;
      },

      /**
       * Called when the Cancel button on the mask is clicked.
       * @param {Event} event The click event.
       */
      handleMaskCancel(event) {
        event.preventDefault();
        /**
         * @event ExportOverlayView#cancel
         */
        this.trigger("cancel");
      },

      /** Stop listening and remove the view. */
      onClose() {
        this.stop();
        this.stopListening();
        this.remove();
      },
    },
  );

  return ExportOverlayView;
});
