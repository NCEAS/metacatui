"use strict";

/**
 * Draws the parts of the export that sit on top of the map: the legend, scale
 * bar and north arrow. Shared by the live preview and the saved image.
 * @module mapExport/painters/FramePainter
 * @since 2.41.0
 */
define([
  "common/mapExport/constants",
  "common/mapExport/painters/LegendPainter",
  "common/mapExport/painters/ScaleBarPainter",
  "common/mapExport/painters/NorthArrowPainter",
], (constants, LegendPainter, ScaleBarPainter, NorthArrowPainter) => {
  const { STYLE } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units, with
   * the origin at the frame's top left corner).
   * @param {object} content What to draw.
   * @param {object} content.layout The result of `ExportLayout.compute`.
   * @param {object|null} content.scaleBar The result of
   * `ExportLayout.placeScaleBar`.
   * @param {object|null} content.northArrow The result of
   * `ExportLayout.placeNorthArrow`.
   * @param {number} content.northRotation Clockwise angle to north, radians.
   * @param {object} [style] The style.
   */
  function paintFrame(
    ctx,
    { layout, scaleBar, northArrow, northRotation },
    style = STYLE,
  ) {
    if (layout?.legend) {
      LegendPainter.paintLegend(
        ctx,
        layout.legend.layout,
        layout.legend.x,
        layout.legend.y,
        { style },
      );
    }
    ScaleBarPainter.paintScaleBar(ctx, scaleBar, style);
    NorthArrowPainter.paintNorthArrow(ctx, northArrow, northRotation, style);
  }

  return { paintFrame };
});
