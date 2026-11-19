"use strict";

/**
 * Pure layout math for the map export: frame geometry, resolution limits, text
 * wrapping and legend packing. Nothing here touches the DOM; text is measured
 * through a `measure(text, fontPx, bold)` function so the logic can be tested
 * without a canvas. All lengths are CSS pixels unless stated otherwise.
 * @module mapExport/ExportLayout
 * @since 2.41.0
 */
define(["common/mapExport/constants"], (constants) => {
  const {
    STYLE,
    FONT_FAMILY,
    EXPORT_FRAME_INSET,
    EXPORT_MAX_PIXELS,
    LEGEND_MAX_HEIGHT_FRACTION,
    LEGEND_MAX_WIDTH_FRACTION,
    LEGEND_MIN_FONT_PX,
  } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx A 2D context.
   * @returns {function(string, number, boolean): number} A `measure` function.
   */
  function createMeasurer(ctx) {
    return (text, fontPx, bold = false) => {
      // eslint-disable-next-line no-param-reassign
      ctx.font = `${bold ? "bold " : ""}${fontPx}px ${FONT_FAMILY}`;
      return ctx.measureText(text).width;
    };
  }

  /**
   * Finds the part of the map widget that is not covered by the sidebar.
   * @param {{left: number, right: number}|null} sidebarRect The sidebar's
   * bounding rect (viewport coordinates), or null when there is no sidebar.
   * @param {object} containerRect The map widget container's bounding rect
   * (`left`, `top`, `width` and `height`).
   * @param {number} [inset] The gap kept between the frame and its neighbors.
   * @returns {{left: number, top: number, width: number, height: number}} The
   * frame, relative to the container's top left corner.
   */
  function computeFrameRect(
    sidebarRect,
    containerRect,
    inset = EXPORT_FRAME_INSET,
  ) {
    const sidebarRight = sidebarRect
      ? Math.max(sidebarRect.right - containerRect.left, 0)
      : 0;
    const left = sidebarRight + inset;
    return {
      left,
      top: inset,
      width: Math.max(containerRect.width - left - inset, 0),
      height: Math.max(containerRect.height - 2 * inset, 0),
    };
  }

  /**
   * Chooses the factor by which to enlarge the drawing buffer.
   * @param {object} options Options.
   * @param {number} options.desired The preferred factor.
   * @param {number} options.baseRatio The drawing buffer pixels per CSS pixel
   * before enlarging.
   * @param {{width: number, height: number}} options.container The map widget
   * container, in CSS pixels. The whole widget is rendered, not just the frame.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {number} [options.extraHeight] Height of the bands below the frame.
   * @param {object} [options.limits] The GPU limits.
   * @param {number} [options.limits.maxViewportWidth] Max viewport width.
   * @param {number} [options.limits.maxViewportHeight] Max viewport height.
   * @param {number} [options.limits.maxRenderbufferSize] Max renderbuffer size.
   * @param {number} [options.maxPixels] The most pixels allowed in either the
   * buffer or the output.
   * @returns {{scale: number, reduced: boolean, outputWidth: number,
   * outputHeight: number}} The factor, whether it is below the desired factor,
   * and the output size in pixels.
   */
  function computeResolutionScale({
    desired,
    baseRatio,
    container,
    frame,
    extraHeight = 0,
    limits = {},
    maxPixels = EXPORT_MAX_PIXELS,
  }) {
    const maxDim = Math.min(
      limits.maxViewportWidth || Infinity,
      limits.maxViewportHeight || Infinity,
      limits.maxRenderbufferSize || Infinity,
    );
    const bufferW = container.width * baseRatio;
    const bufferH = container.height * baseRatio;
    const outW = frame.width * baseRatio;
    const outH = (frame.height + extraHeight) * baseRatio;

    let scale = desired;
    scale = Math.min(scale, maxDim / Math.max(bufferW, bufferH, 1));
    scale = Math.min(scale, Math.sqrt(maxPixels / Math.max(bufferW * bufferH, 1)));
    scale = Math.min(scale, Math.sqrt(maxPixels / Math.max(outW * outH, 1)));
    // Keep a tidy value so that pixel sizes stay stable between calls.
    scale = Math.floor(scale * 100) / 100;

    return {
      scale,
      reduced: scale < desired,
      outputWidth: Math.round(outW * scale),
      outputHeight: Math.round(outH * scale),
    };
  }

  /**
   * Finds the region of the enlarged canvas that holds the frame.
   * @param {object} options Options.
   * @param {object} options.frame The frame (`left`, `top`, `width` and
   * `height`), in CSS pixels relative to the container.
   * @param {{width: number, height: number}} options.container The container,
   * in CSS pixels.
   * @param {{width: number, height: number}} options.canvas The canvas
   * drawing buffer, in pixels.
   * @returns {{sx: number, sy: number, sw: number, sh: number}} The source
   * rectangle, in canvas pixels.
   */
  function computeCrop({ frame, container, canvas }) {
    const ratioX = canvas.width / container.width;
    const ratioY = canvas.height / container.height;
    const sx = Math.max(Math.round(frame.left * ratioX), 0);
    const sy = Math.max(Math.round(frame.top * ratioY), 0);
    const sw = Math.min(Math.round(frame.width * ratioX), canvas.width - sx);
    const sh = Math.min(Math.round(frame.height * ratioY), canvas.height - sy);
    return { sx, sy, sw, sh };
  }

  /**
   * Splits text into lines no wider than `maxWidth`. Breaks at spaces, and
   * inside words that are too long to fit on a line.
   * @param {string} text The text.
   * @param {number} maxWidth The width limit.
   * @param {function(string): number} measure Returns the width of a string.
   * @returns {string[]} The lines. Always at least one.
   */
  function wrapText(text, maxWidth, measure) {
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
  }

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

  /**
   * @param {object} options Options.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {ScaleBarChoice|null} options.choice The scale bar, or null.
   * @param {Function} options.measure The `measure` function.
   * @param {object} [options.style] The style.
   * @returns {object|null} The scale bar's box (`x`, `y`, `width`, `height`),
   * the `barWidth` and the `label`, in the lower right corner of the frame.
   */
  function placeScaleBar({ frame, choice, measure, style = STYLE }) {
    if (!choice) return null;
    const S = style.scaleBar;
    const width = Math.max(choice.widthPx, measure(choice.label, S.fontPx, false));
    return {
      x: frame.width - style.margin - width,
      y: frame.height - style.margin - S.height,
      width,
      height: S.height,
      barWidth: choice.widthPx,
      label: choice.label,
    };
  }

  /**
   * @param {object} options Options.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {object|null} options.scaleBar The result of `placeScaleBar`.
   * @param {object} [options.style] The style.
   * @returns {{cx: number, cy: number, diameter: number}} The north arrow's
   * center, above the scale bar and aligned with the frame's right margin.
   */
  function placeNorthArrow({ frame, scaleBar, style = STYLE }) {
    const N = style.northArrow;
    const bottom = scaleBar
      ? scaleBar.y - N.gap
      : frame.height - style.margin;
    return {
      cx: frame.width - style.margin - N.diameter / 2,
      cy: bottom - N.diameter / 2,
      diameter: N.diameter,
    };
  }

  return {
    createMeasurer,
    computeFrameRect,
    computeResolutionScale,
    computeCrop,
    wrapText,
    measureEntry,
    packBlocks,
    layoutLegend,
    layoutCitations,
    compute,
    placeScaleBar,
    placeNorthArrow,
  };
});
