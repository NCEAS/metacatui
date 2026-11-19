"use strict";

/**
 * Pure geometry for the export frame: where it sits, how much the drawing
 * buffer is enlarged, and which part of it is kept. Nothing here touches the
 * DOM. All lengths are CSS pixels unless stated otherwise.
 * @module views/maps/export/canvas/layout/FrameLayout
 * @since 2.41.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { EXPORT_FRAME_INSET, EXPORT_MAX_PIXELS } = constants;

  /**
   * Finds the part of the map widget that is not covered by the sidebar.
   * @param {{left: number, right: number}|null} sidebarRect The sidebar's
   * bounding rect (viewport coordinates), or null when there is no sidebar.
   * @param {object} containerRect The map widget container's bounding rect
   * (`left`, `top`, `width` and `height`).
   * @param {number} [inset] The gap kept between the frame and its neighbors.
   * @returns {{left: number, top: number, width: number, height: number}} The
   * frame, relative to the container's top left corner.
   */
  function computeFrameRect(
    sidebarRect,
    containerRect,
    inset = EXPORT_FRAME_INSET,
  ) {
    const sidebarRight = sidebarRect
      ? Math.max(sidebarRect.right - containerRect.left, 0)
      : 0;
    const left = sidebarRight + inset;
    return {
      left,
      top: inset,
      width: Math.max(containerRect.width - left - inset, 0),
      height: Math.max(containerRect.height - 2 * inset, 0),
    };
  }

  /**
   * Chooses the factor by which to enlarge the drawing buffer.
   * @param {object} options Options.
   * @param {number} options.desired The preferred factor.
   * @param {number} options.baseRatio The drawing buffer pixels per CSS pixel
   * before enlarging.
   * @param {{width: number, height: number}} options.container The map widget
   * container, in CSS pixels. The whole widget is rendered, not just the frame.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {number} [options.extraHeight] Height of the bands below the frame.
   * @param {object} [options.limits] The GPU limits.
   * @param {number} [options.limits.maxViewportWidth] Max viewport width.
   * @param {number} [options.limits.maxViewportHeight] Max viewport height.
   * @param {number} [options.limits.maxRenderbufferSize] Max renderbuffer size.
   * @param {number} [options.maxPixels] The most pixels allowed in either the
   * buffer or the output.
   * @returns {{scale: number, reduced: boolean, outputWidth: number,
   * outputHeight: number}} The factor, whether it is below the desired factor,
   * and the output size in pixels.
   */
  function computeResolutionScale({
    desired,
    baseRatio,
    container,
    frame,
    extraHeight = 0,
    limits = {},
    maxPixels = EXPORT_MAX_PIXELS,
  }) {
    const maxDim = Math.min(
      limits.maxViewportWidth || Infinity,
      limits.maxViewportHeight || Infinity,
      limits.maxRenderbufferSize || Infinity,
    );
    const bufferW = container.width * baseRatio;
    const bufferH = container.height * baseRatio;
    const outW = frame.width * baseRatio;
    const outH = (frame.height + extraHeight) * baseRatio;

    let scale = desired;
    scale = Math.min(scale, maxDim / Math.max(bufferW, bufferH, 1));
    scale = Math.min(scale, Math.sqrt(maxPixels / Math.max(bufferW * bufferH, 1)));
    scale = Math.min(scale, Math.sqrt(maxPixels / Math.max(outW * outH, 1)));
    // Keep a tidy value so that pixel sizes stay stable between calls.
    scale = Math.floor(scale * 100) / 100;

    return {
      scale,
      reduced: scale < desired,
      outputWidth: Math.round(outW * scale),
      outputHeight: Math.round(outH * scale),
    };
  }

  /**
   * Finds the region of the enlarged canvas that holds the frame.
   * @param {object} options Options.
   * @param {object} options.frame The frame (`left`, `top`, `width` and
   * `height`), in CSS pixels relative to the container.
   * @param {{width: number, height: number}} options.container The container,
   * in CSS pixels.
   * @param {{width: number, height: number}} options.canvas The canvas
   * drawing buffer, in pixels.
   * @returns {{sx: number, sy: number, sw: number, sh: number}} The source
   * rectangle, in canvas pixels.
   */
  function computeCrop({ frame, container, canvas }) {
    const ratioX = canvas.width / container.width;
    const ratioY = canvas.height / container.height;
    const sx = Math.max(Math.round(frame.left * ratioX), 0);
    const sy = Math.max(Math.round(frame.top * ratioY), 0);
    const sw = Math.min(Math.round(frame.width * ratioX), canvas.width - sx);
    const sh = Math.min(Math.round(frame.height * ratioY), canvas.height - sy);
    return { sx, sy, sw, sh };
  }

  return { computeFrameRect, computeResolutionScale, computeCrop };
});
