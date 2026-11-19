"use strict";

/**
 * Draws the north arrow.
 * @module views/maps/export/canvas/painters/NorthArrowPainter
 * @since 2.41.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { STYLE, FONT_FAMILY } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units).
   * @param {object} placement The result of `PlacementLayout.placeNorthArrow`.
   * @param {number} rotation Clockwise rotation of north on screen, radians.
   * For a top-down camera this is the negative of the heading.
   * @param {object} [style] The style.
   */
  function paintNorthArrow(ctx, placement, rotation, style = STYLE) {
    if (!placement) return;
    const N = style.northArrow;
    const r = placement.diameter / 2;

    ctx.save();
    ctx.translate(placement.cx, placement.cy);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = N.background;
    ctx.fill();

    ctx.rotate(rotation);

    // A notched arrow head pointing to north.
    const tip = -r * 0.42;
    const tail = r * 0.55;
    const half = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, tip);
    ctx.lineTo(half, tail);
    ctx.lineTo(0, tail * 0.55);
    ctx.lineTo(-half, tail);
    ctx.closePath();
    ctx.fillStyle = N.color;
    ctx.fill();

    ctx.font = `bold ${N.fontPx}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 0, -r * 0.72);
    ctx.restore();
  }

  return { paintNorthArrow };
});
