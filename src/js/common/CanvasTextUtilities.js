"use strict";

define([], () => {
  /**
   * Helpers for measuring and wrapping text drawn on a canvas.
   * @namespace CanvasTextUtilities
   * @classcategory Common
   * @since 2.41.0
   */
  const CanvasTextUtilities = {
    /**
     * @param {CanvasRenderingContext2D} ctx A 2D context.
     * @param {string} fontFamily The CSS font family to measure with.
     * @returns {function(string, number, boolean): number} A function that
     * takes `(text, fontPx, bold)` and returns the text's width.
     */
    createMeasurer(ctx, fontFamily) {
      return (text, fontPx, bold = false) => {
        // eslint-disable-next-line no-param-reassign
        ctx.font = `${bold ? "bold " : ""}${fontPx}px ${fontFamily}`;
        return ctx.measureText(text).width;
      };
    },

    /**
     * Splits text into lines no wider than `maxWidth`. Breaks at spaces, and
     * inside words that are too long to fit on a line.
     * @param {string} text The text.
     * @param {number} maxWidth The width limit.
     * @param {function(string): number} measure Returns the width of a string.
     * @returns {string[]} The lines. Always at least one.
     */
    wrapText(text, maxWidth, measure) {
      const words = String(text ?? "")
        .split(/\s+/)
        .filter(Boolean);
      const lines = [];
      let line = "";
      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate) <= maxWidth) {
          line = candidate;
          return;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        if (measure(word) <= maxWidth) {
          line = word;
          return;
        }
        let chunk = "";
        Array.from(word).forEach((char) => {
          if (chunk && measure(chunk + char) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        });
        line = chunk;
      });
      if (line) lines.push(line);
      return lines.length ? lines : [""];
    },
  };

  return CanvasTextUtilities;
});
