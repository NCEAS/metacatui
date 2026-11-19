"use strict";

/**
 * Pure layout math for the sources text below the frame.
 * @module views/maps/export/canvas/layout/CitationsLayout
 * @since 2.41.0
 */
define([
  "common/CanvasTextUtilities",
  "views/maps/export/constants",
], (CanvasTextUtilities, constants) => {
  const { wrapText } = CanvasTextUtilities;
  const { STYLE } = constants;

  /**
   * Lays out the sources text.
   * @param {object} options Options.
   * @param {string[]} options.citations One string per source.
   * @param {number} options.width The band width.
   * @param {object} [options.style] The style.
   * @param {Function} options.measure The `measure` function.
   * @returns {{title: string, lines: string[], fontPx: number,
   * lineHeight: number,
   * padding: number, height: number}|null} The layout, or null when there are
   * no sources.
   */
  function layoutCitations({ citations, width, style = STYLE, measure }) {
    if (!citations?.length) return null;
    const C = style.citations;
    const text = citations.join("  \u2022  ");
    const lines = wrapText(
      text,
      Math.max(width - 2 * C.padding, C.fontPx * 4),
      (t) => measure(t, C.fontPx, false),
    );
    const lineHeight = C.fontPx * C.lineHeight;
    return {
      title: C.title,
      lines,
      fontPx: C.fontPx,
      lineHeight,
      padding: C.padding,
      height: (lines.length + 1) * lineHeight + 2 * C.padding,
    };
  }

  return { layoutCitations };
});
