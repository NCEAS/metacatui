"use strict";

/**
 * Combines the frame, legend and citations layouts into everything that is
 * drawn for an export. Nothing here touches the DOM; text is measured through
 * a `measure(text, fontPx, bold)` function so the logic can be tested without
 * a canvas. All lengths are CSS pixels unless stated otherwise.
 * @module views/maps/export/canvas/layout/ExportLayout
 * @since 2.41.0
 */
define([
  "views/maps/export/constants",
  "views/maps/export/canvas/layout/LegendLayout",
  "views/maps/export/canvas/layout/CitationsLayout",
], (constants, LegendLayout, CitationsLayout) => {
  const { STYLE, LEGEND_MAX_HEIGHT_FRACTION, LEGEND_MAX_WIDTH_FRACTION } =
    constants;
  const { layoutLegend } = LegendLayout;
  const { layoutCitations } = CitationsLayout;

  /**
   * Computes everything that is drawn for an export, except the scale bar and
   * north arrow, which depend on the camera.
   * @param {object} options Options.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {LegendEntry[]} options.entries The legend entries.
   * @param {string[]} options.citations One string per source.
   * @param {Function} options.measure The `measure` function.
   * @param {object} [options.style] The style.
   * @returns {object} The layout: `legend` (in the frame, or null),
   * `overflowBand` and `citationsBand` (below the frame, or null),
   * `extraHeight` (the height of the bands) and `overflowCount`.
   */
  function compute({ frame, entries, citations, measure, style = STYLE }) {
    const { margin } = style;
    const maxWidth = Math.max(
      0,
      Math.min(
        frame.width * LEGEND_MAX_WIDTH_FRACTION,
        frame.width - 3 * margin - style.scaleBar.maxBarWidth,
      ),
    );
    const maxHeight = Math.max(
      0,
      Math.min(
        frame.height * LEGEND_MAX_HEIGHT_FRACTION,
        frame.height - 2 * margin,
      ),
    );

    const legendLayout = layoutLegend({
      entries,
      maxWidth,
      maxHeight,
      style,
      measure,
    });
    const legend = legendLayout.columns.length
      ? {
          layout: legendLayout,
          x: margin,
          y: frame.height - margin - legendLayout.height,
        }
      : null;

    let overflowBand = null;
    if (legendLayout.overflow.length) {
      const B = style.legendBand;
      const titleHeight = style.legend.fontPx * style.legend.lineHeight;
      const layout = layoutLegend({
        entries: legendLayout.overflow,
        maxWidth: frame.width,
        band: true,
        padding: B.padding,
        style,
        measure,
      });
      overflowBand = {
        title: B.title,
        titleY: B.padding,
        titleHeight,
        layout,
        layoutY: B.padding + titleHeight,
        y: frame.height,
        height: B.padding + titleHeight + layout.height,
      };
    }

    const citationsLayout = layoutCitations({
      citations,
      width: frame.width,
      style,
      measure,
    });
    const citationsBand = citationsLayout
      ? {
          layout: citationsLayout,
          y: frame.height + (overflowBand?.height ?? 0),
          height: citationsLayout.height,
        }
      : null;

    return {
      frame: { width: frame.width, height: frame.height },
      legend,
      overflowBand,
      citationsBand,
      overflowCount: legendLayout.overflow.length,
      extraHeight: (overflowBand?.height ?? 0) + (citationsBand?.height ?? 0),
    };
  }

  return { compute };
});
