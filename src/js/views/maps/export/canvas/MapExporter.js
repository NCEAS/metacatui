"use strict";

/**
 * Captures the map as a PNG: renders the Cesium scene at a higher resolution,
 * crops it to the export frame, and draws the legend, scale bar, north arrow
 * and the white bands below the frame.
 * @module views/maps/export/canvas/MapExporter
 * @since 2.41.0
 */
define([
  "common/CanvasTextUtilities",
  "views/maps/export/constants",
  "views/maps/export/canvas/layout/ExportLayout",
  "views/maps/export/canvas/layout/FrameLayout",
  "views/maps/export/canvas/layout/PlacementLayout",
  "models/maps/export/scaleBar",
  "views/maps/export/canvas/painters/FramePainter",
  "views/maps/export/canvas/painters/CitationsPainter",
], (
  CanvasTextUtilities,
  constants,
  ExportLayout,
  FrameLayout,
  PlacementLayout,
  ScaleBar,
  FramePainter,
  CitationsPainter,
) => {
  const {
    STYLE,
    FONT_FAMILY,
    EXPORT_BACKGROUND_COLOR,
    EXPORT_RESOLUTION_MULTIPLIER,
    EXPORT_MAX_RETRIES,
    EXPORT_RETRY_FACTOR,
  } = constants;

  const toBlob = (canvas) =>
    new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

  const abortError = () => new DOMException("Aborted", "AbortError");

  /**
   * @typedef {object} ExportResult
   * @property {Blob} blob The PNG.
   * @property {number} width The image width, in pixels.
   * @property {number} height The image height, in pixels.
   * @property {number} scale The factor the resolution was multiplied by.
   * @property {boolean} reducedResolution True if the factor is lower than
   * requested, because of memory limits.
   * @property {boolean} settled False if the map was still loading data when
   * the time limit was reached.
   * @property {boolean} scaleBarShown False if the scale could not be
   * determined, so the scale bar was left out.
   */

  /**
   * Renders and draws one image.
   * @param {object} options See {@link exportMap}.
   * @param {number} scale The resolution factor.
   * @param {object} layout The result of `ExportLayout.compute`.
   * @param {Function} measure The `measure` function.
   * @returns {Promise<object>} The blob and image details.
   */
  async function captureOnce(options, scale, layout, measure) {
    const { widget, frame, signal, onStatus } = options;
    const container = {
      width: widget.scene.canvas.clientWidth,
      height: widget.scene.canvas.clientHeight,
    };

    // The preview's own tiles load first, at the resolution already on screen.
    onStatus("loadingPreview");
    await widget.whenSceneSettled({ signal });
    if (signal?.aborted) throw abortError();

    widget.setResolutionScale(scale);
    onStatus("loadingDetail");
    const { settled } = await widget.whenSceneSettled({ signal });
    if (signal?.aborted) throw abortError();
    onStatus("rendering");

    const viewInfo = widget.getExportViewInfo(frame);
    const choice = ScaleBar.chooseScaleBar(
      viewInfo.metersPerPixel,
      STYLE.scaleBar.maxBarWidth,
    );
    const frameSize = { width: frame.width, height: frame.height };
    const scaleBar = PlacementLayout.placeScaleBar({
      frame: frameSize,
      choice,
      measure,
    });
    const northArrow = PlacementLayout.placeNorthArrow({
      frame: frameSize,
      scaleBar,
    });

    const out = document.createElement("canvas");
    let drawn = false;
    widget.renderTo((source) => {
      if (!source.width || !source.height) return;
      const crop = FrameLayout.computeCrop({
        frame,
        container,
        canvas: { width: source.width, height: source.height },
      });
      const s = crop.sw / frame.width;
      out.width = crop.sw;
      out.height = crop.sh + Math.round(layout.extraHeight * s);
      const ctx = out.getContext("2d");
      ctx.fillStyle = EXPORT_BACKGROUND_COLOR;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);

      ctx.save();
      ctx.scale(s, s);
      FramePainter.paintFrame(ctx, {
        layout,
        scaleBar,
        northArrow,
        northRotation: viewInfo.northRotation,
      });
      CitationsPainter.paintLegendBand(ctx, layout.overflowBand, frame.width);
      CitationsPainter.paintCitations(ctx, layout.citationsBand, frame.width);
      ctx.restore();
      drawn = true;
    });
    if (!drawn) throw new Error("The map could not be rendered.");

    const {width} = out;
    const {height} = out;
    const blob = await toBlob(out);
    out.width = 0;
    out.height = 0;
    if (!blob) throw new Error("The image could not be created.");
    return {
      blob,
      width,
      height,
      scale,
      settled,
      scaleBarShown: Boolean(scaleBar),
    };
  }

  /**
   * Exports the map as a PNG. The scene is rendered at up to
   * `EXPORT_RESOLUTION_MULTIPLIER` times its on-screen resolution, less if
   * the GPU or memory limits require. If rendering fails, it is retried at a
   * lower resolution. The widget's resolution is always restored.
   * @param {object} options Options.
   * @param {CesiumWidgetView} options.widget The map widget.
   * @param {object} options.frame The frame (`left`, `top`, `width` and
   * `height`), in CSS pixels relative to the widget's top left.
   * @param {LegendEntry[]} options.entries The legend entries.
   * @param {string[]} options.citations The citations, one string each.
   * @param {AbortSignal} [options.signal] Aborts the export.
   * @param {function(string): void} [options.onStatus] Called with
   * "loadingPreview", "loadingDetail" and "rendering".
   * @param {number} [options.multiplier] The preferred resolution factor.
   * @returns {Promise<ExportResult>} The image. Rejects with an AbortError if
   * aborted.
   */
  async function exportMap(options) {
    const opts = { onStatus: () => {}, ...options };
    const { widget, frame, entries, citations } = opts;
    const desired = opts.multiplier || EXPORT_RESOLUTION_MULTIPLIER;

    const measure = CanvasTextUtilities.createMeasurer(
      document.createElement("canvas").getContext("2d"),
      FONT_FAMILY,
    );
    const layout = ExportLayout.compute({
      frame: { width: frame.width, height: frame.height },
      entries,
      citations,
      measure,
    });

    const container = {
      width: widget.scene.canvas.clientWidth,
      height: widget.scene.canvas.clientHeight,
    };
    const baseRatio = widget.getPixelRatio();
    const limits = widget.getRenderLimits();

    let multiplier = desired;
    let lastError = null;
    for (let attempt = 0; attempt <= EXPORT_MAX_RETRIES; attempt += 1) {
      const { scale } = FrameLayout.computeResolutionScale({
        desired: multiplier,
        baseRatio,
        container,
        frame,
        extraHeight: layout.extraHeight,
        limits,
      });
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await captureOnce(opts, scale, layout, measure);
        return { ...result, reducedResolution: scale < desired };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
        multiplier = scale * EXPORT_RETRY_FACTOR;
      } finally {
        widget.setResolutionScale(1);
      }
    }
    throw lastError;
  }

  return { exportMap };
});
