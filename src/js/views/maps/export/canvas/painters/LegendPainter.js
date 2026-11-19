"use strict";

/**
 * Draws a legend layout produced by `LegendLayout.layoutLegend`. Draws in CSS
 * pixels: the caller sets the context's transform to scale the drawing.
 * @module views/maps/export/canvas/painters/LegendPainter
 * @since 2.41.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { STYLE, FONT_FAMILY } = constants;

  const font = (px, bold) => `${bold ? "bold " : ""}${px}px ${FONT_FAMILY}`;

  /**
   * Adds a rounded rectangle to the current path.
   * @param {CanvasRenderingContext2D} ctx The context.
   * @param {number} x The left edge.
   * @param {number} y The top edge.
   * @param {number} w The width.
   * @param {number} h The height.
   * @param {number} r The corner radius.
   */
  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * Draws one layer's title and swatches.
   * @param {CanvasRenderingContext2D} ctx The context.
   * @param {object} block The measured block, from `ExportLayout`.
   * @param {number} x The left edge.
   * @param {number} y The top edge.
   * @param {object} style The style.
   */
  function paintBlock(ctx, block, x, y, style) {
    ctx.textBaseline = "top";
    ctx.fillStyle = style.textColor;
    ctx.font = font(block.fontPx, true);
    block.titleLines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * block.lineHeight);
    });

    const bodyY = y + block.bodyTop;
    ctx.font = font(block.fontPx, false);
    const textOffset = (height, lines) =>
      (height - lines * block.lineHeight) / 2;

    if (block.rows) {
      block.rows.forEach((row) => {
        const rowY = bodyY + row.y;
        ctx.fillStyle = row.css;
        ctx.fillRect(x, rowY, block.swatch, block.swatch);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, rowY, block.swatch, block.swatch);
        ctx.fillStyle = style.textColor;
        row.lines.forEach((line, i) => {
          ctx.fillText(
            line,
            x + row.labelX,
            rowY + textOffset(row.height, row.lines.length) +
              i * block.lineHeight,
          );
        });
      });
    } else if (block.gradient) {
      const g = block.gradient;
      const gradient = ctx.createLinearGradient(0, bodyY, 0, bodyY + g.height);
      g.stops.forEach((stop) => gradient.addColorStop(stop.offset, stop.css));
      ctx.fillStyle = gradient;
      ctx.fillRect(x, bodyY, g.width, g.height);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, bodyY, g.width, g.height);
      ctx.fillStyle = style.textColor;
      const lastY = bodyY + g.height - block.lineHeight;
      const ys = [bodyY, (bodyY + lastY) / 2, lastY];
      g.labels.forEach((label, i) => {
        ctx.fillText(label, x + g.labelX, ys[i]);
      });
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx The context.
   * @param {object} layout A legend layout.
   * @param {number} x Left edge.
   * @param {number} y Top edge.
   * @param {object} [options] Options.
   * @param {boolean} [options.background] Draw the rounded white panel.
   * @param {object} [options.style] The style.
   */
  function paintLegend(ctx, layout, x, y, options = {}) {
    const { background = true, style = STYLE } = options;
    if (!layout?.columns.length) return;
    ctx.save();
    if (background) {
      roundedRect(ctx, x, y, layout.width, layout.height, style.legend.radius);
      ctx.fillStyle = style.legend.background;
      ctx.fill();
    }
    layout.columns.forEach((column) => {
      column.items.forEach((item) => {
        paintBlock(
          ctx,
          item.block,
          x + layout.padding + column.x,
          y + layout.padding + item.y,
          style,
        );
      });
    });
    ctx.restore();
  }

  return { paintLegend, roundedRect };
});
