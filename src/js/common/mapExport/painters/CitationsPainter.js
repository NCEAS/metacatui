"use strict";

/**
 * Draws the white bands below the exported frame: the overflowed legend and
 * the data citations.
 * @module mapExport/painters/CitationsPainter
 * @since 2.41.0
 */
define([
  "common/mapExport/constants",
  "common/mapExport/painters/LegendPainter",
], (constants, LegendPainter) => {
  const { STYLE, FONT_FAMILY } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units).
   * @param {object} band `layout.overflowBand` from `ExportLayout.compute`.
   * @param {number} width The band width.
   * @param {object} [style] The style.
   */
  function paintLegendBand(ctx, band, width, style = STYLE) {
    if (!band) return;
    ctx.save();
    ctx.fillStyle = style.legendBand.background;
    ctx.fillRect(0, band.y, width, band.height);
    ctx.fillStyle = style.textColor;
    ctx.textBaseline = "top";
    ctx.font = `bold ${style.legend.fontPx}px ${FONT_FAMILY}`;
    ctx.fillText(band.title, style.legendBand.padding, band.y + band.titleY);
    LegendPainter.paintLegend(ctx, band.layout, 0, band.y + band.layoutY, {
      background: false,
      style,
    });
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units).
   * @param {object} band `layout.citationsBand` from `ExportLayout.compute`.
   * @param {number} width The band width.
   * @param {object} [style] The style.
   */
  function paintCitations(ctx, band, width, style = STYLE) {
    if (!band) return;
    const C = style.citations;
    const { layout } = band;
    ctx.save();
    ctx.fillStyle = C.background;
    ctx.fillRect(0, band.y, width, band.height);
    ctx.fillStyle = C.color;
    ctx.textBaseline = "top";
    ctx.font = `bold ${layout.fontPx}px ${FONT_FAMILY}`;
    ctx.fillText(layout.title, layout.padding, band.y + layout.padding);
    ctx.font = `${layout.fontPx}px ${FONT_FAMILY}`;
    layout.lines.forEach((line, i) => {
      ctx.fillText(
        line,
        layout.padding,
        band.y + layout.padding + (i + 1) * layout.lineHeight,
      );
    });
    ctx.restore();
  }

  return { paintLegendBand, paintCitations };
});
