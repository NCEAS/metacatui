"use strict";

/**
 * Draws the parts of the export that sit on top of the map: the legend, scale
 * bar and north arrow. Shared by the live preview and the saved image.
 * @module views/maps/export/canvas/painters/FramePainter
 * @since 2.41.0
 */
define([
  "views/maps/export/constants",
  "views/maps/export/canvas/painters/LegendPainter",
  "views/maps/export/canvas/painters/ScaleBarPainter",
  "views/maps/export/canvas/painters/NorthArrowPainter",
], (constants, LegendPainter, ScaleBarPainter, NorthArrowPainter) => {
  const { STYLE } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units, with
   * the origin at the frame's top left corner).
   * @param {object} content What to draw.
   * @param {object} content.layout The result of `ExportLayout.compute`.
   * @param {object|null} content.scaleBar The result of
   * `PlacementLayout.placeScaleBar`.
   * @param {object|null} content.northArrow The result of
   * `PlacementLayout.placeNorthArrow`.
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
