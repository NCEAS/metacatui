"use strict";

/**
 * Pure layout math for the legend: measures each entry and packs the entries
 * into columns. Text is measured through a `measure(text, fontPx, bold)`
 * function so the logic can be tested without a canvas.
 * @module views/maps/export/canvas/layout/LegendLayout
 * @since 2.41.0
 */
define([
  "common/CanvasTextUtilities",
  "views/maps/export/constants",
], (CanvasTextUtilities, constants) => {
  const { wrapText } = CanvasTextUtilities;
  const { STYLE, LEGEND_MIN_FONT_PX } = constants;

  /**
   * Measures one legend entry.
   * @param {LegendEntry} entry The entry.
   * @param {object} options Options.
   * @param {number} options.fontPx The font size.
   * @param {number} options.maxWidth The widest the entry may be.
   * @param {object} options.spacing A spacing preset.
   * @param {object} options.style The style.
   * @param {Function} options.measure The `measure` function.
   * @returns {object} The measured block.
   */
  function measureEntry(entry, { fontPx, maxWidth, spacing, style, measure }) {
    const L = style.legend;
    const lineHeight = fontPx * L.lineHeight;
    const bold = (text) => measure(text, fontPx, true);
    const regular = (text) => measure(text, fontPx, false);
    const swatch = Math.round(fontPx * L.swatchToFont);

    const titleLines = wrapText(entry.name, maxWidth, bold);
    const titleWidth = Math.max(...titleLines.map(bold));
    const titleHeight = titleLines.length * lineHeight;
    const bodyTop = titleHeight + spacing.rowGap;

    const block = {
      entry,
      fontPx,
      lineHeight,
      swatch,
      titleLines,
      titleHeight,
      bodyTop,
    };

    let bodyWidth = 0;
    let bodyHeight = 0;
    if (entry.type === "continuous") {
      const labelWidth = Math.max(...entry.labels.map(regular));
      bodyHeight = lineHeight * L.gradientRows;
      bodyWidth = swatch + L.swatchGap + labelWidth;
      block.gradient = {
        width: swatch,
        height: bodyHeight,
        stops: entry.stops,
        labels: entry.labels,
        labelX: swatch + L.swatchGap,
      };
    } else {
      const labelMax = Math.max(maxWidth - swatch - L.swatchGap, fontPx * 4);
      let y = 0;
      block.rows = entry.categories.map((category) => {
        const lines = wrapText(category.label, labelMax, regular);
        const height = Math.max(swatch, lines.length * lineHeight);
        const row = {
          css: category.css,
          lines,
          y,
          height,
          labelX: swatch + L.swatchGap,
        };
        bodyWidth = Math.max(
          bodyWidth,
          swatch + L.swatchGap + Math.max(...lines.map(regular)),
        );
        y += height + spacing.rowGap;
        return row;
      });
      bodyHeight = Math.max(y - spacing.rowGap, 0);
    }

    block.width = Math.min(Math.max(titleWidth, bodyWidth), maxWidth);
    block.height = bodyTop + bodyHeight;
    return block;
  }

  /**
   * Flows blocks into columns, in order, stopping at the first block that does
   * not fit.
   * @param {object[]} blocks The measured blocks.
   * @param {number} innerWidth The width available.
   * @param {number} innerHeight The height available to each column.
   * @param {object} spacing A spacing preset.
   * @returns {{columns: object[], used: number}} The columns, and how many of
   * the blocks were placed.
   */
  function packBlocks(blocks, innerWidth, innerHeight, spacing) {
    const { entryGap, columnGap } = spacing;
    const columns = [];
    const totalWidth = () =>
      columns.reduce((sum, c) => sum + c.width, 0) +
      columnGap * Math.max(columns.length - 1, 0);

    let used = 0;
    for (; used < blocks.length; used += 1) {
      const block = blocks[used];
      const column = columns[columns.length - 1];
      let placed = false;
      if (column && column.height + entryGap + block.height <= innerHeight) {
        const newWidth = Math.max(column.width, block.width);
        if (totalWidth() - column.width + newWidth <= innerWidth) {
          column.items.push({ block, y: column.height + entryGap });
          column.height += entryGap + block.height;
          column.width = newWidth;
          placed = true;
        }
      }
      if (!placed) {
        const fitsHeight = block.height <= innerHeight;
        const fitsWidth =
          totalWidth() + (columns.length ? columnGap : 0) + block.width <=
          innerWidth;
        if (!fitsHeight || !fitsWidth) break;
        columns.push({
          width: block.width,
          height: block.height,
          items: [{ block, y: 0 }],
        });
      }
    }

    let x = 0;
    columns.forEach((column) => {
      // eslint-disable-next-line no-param-reassign
      column.x = x;
      x += column.width + columnGap;
    });
    return { columns, used };
  }

  /**
   * Lays out legend entries in columns. In the default mode the entries are
   * packed into `maxWidth` x `maxHeight`, trying looser spacing and a larger
   * font first and shrinking until they fit. Entries that still do not fit are
   * returned in `overflow`. In `band` mode there is no height limit, and the
   * entries are balanced across as many columns as fit in `maxWidth`.
   * @param {object} options Options.
   * @param {LegendEntry[]} options.entries The entries.
   * @param {number} options.maxWidth The widest the legend may be.
   * @param {number} [options.maxHeight] The tallest the legend may be.
   * @param {boolean} [options.band] Balance the columns instead.
   * @param {number} [options.padding] Padding around the content.
   * @param {object} [options.style] The style.
   * @param {Function} options.measure The `measure` function.
   * @returns {{columns: object[], width: number, height: number,
   * padding: number, fontPx: number, overflow: LegendEntry[]}} The layout.
   */
  function layoutLegend({
    entries,
    maxWidth,
    maxHeight = Infinity,
    band = false,
    padding,
    style = STYLE,
    measure,
  }) {
    const L = style.legend;
    const pad = padding ?? L.padding;
    const innerWidth = maxWidth - 2 * pad;
    const innerHeight = maxHeight - 2 * pad;

    const attempts = [];
    if (band) {
      attempts.push({ fontPx: L.fontPx, spacing: L.spacing.normal });
    } else {
      attempts.push({ fontPx: L.fontPx, spacing: L.spacing.normal });
      for (let px = L.fontPx; px >= LEGEND_MIN_FONT_PX; px -= 1) {
        attempts.push({ fontPx: px, spacing: L.spacing.tight });
      }
    }

    let result = null;
    let last = null;
    for (let i = 0; i < attempts.length && !result; i += 1) {
      const { fontPx, spacing } = attempts[i];
      const blocks = entries.map((entry) =>
        measureEntry(entry, {
          fontPx,
          maxWidth: Math.min(L.maxEntryWidth, Math.max(innerWidth, 0)),
          spacing,
          style,
          measure,
        }),
      );

      let packed;
      if (band && blocks.length) {
        const tallest = Math.max(...blocks.map((b) => b.height));
        const widest = Math.max(...blocks.map((b) => b.width));
        const total =
          blocks.reduce((sum, b) => sum + b.height, 0) +
          spacing.entryGap * (blocks.length - 1);
        const maxColumns = Math.max(
          Math.floor((innerWidth + spacing.columnGap) / (widest + spacing.columnGap)),
          1,
        );
        let limit = Math.max(tallest, total / maxColumns + tallest / 2);
        packed = packBlocks(blocks, innerWidth, limit, spacing);
        for (
          let n = 0;
          n < 200 && packed.used < blocks.length;
          n += 1
        ) {
          limit *= 1.1;
          packed = packBlocks(blocks, innerWidth, limit, spacing);
        }
      } else {
        packed = packBlocks(blocks, innerWidth, innerHeight, spacing);
      }

      last = { fontPx, spacing, packed };
      if (packed.used === blocks.length) result = last;
    }
    result = result || last;

    const { columns, used } = result?.packed || { columns: [], used: 0 };
    const contentWidth = columns.length
      ? columns[columns.length - 1].x + columns[columns.length - 1].width
      : 0;
    const contentHeight = Math.max(0, ...columns.map((c) => c.height));
    return {
      columns,
      padding: pad,
      fontPx: result?.fontPx ?? L.fontPx,
      spacing: result?.spacing ?? L.spacing.normal,
      width: columns.length ? contentWidth + 2 * pad : 0,
      height: columns.length ? contentHeight + 2 * pad : 0,
      overflow: entries.slice(used),
    };
  }

  return { measureEntry, packBlocks, layoutLegend };
});
