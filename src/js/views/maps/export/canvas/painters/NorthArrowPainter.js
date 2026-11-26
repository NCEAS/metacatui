"use strict";

/**
 * Draws the north arrow.
 * @module NorthArrowPainter
 * @classcategory Views/Maps/Export/Canvas/Painters
 * @since 0.0.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { STYLE, FONT_FAMILY } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units).
   * @param {object} placement The north arrow from
   * `PlacementLayout.placeControls`.
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

    // The N and the triangle above it turn together so they point to north.
    ctx.rotate(rotation);

    ctx.font = `bold ${N.fontPx}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = N.color;
    ctx.fillText("N", 0, 0);

    const tip = -r * 0.94;
    const base = -r * 0.5;
    const half = r * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, tip);
    ctx.lineTo(half, base);
    ctx.lineTo(-half, base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { paintNorthArrow };
});
