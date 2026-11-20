"use strict";

/**
 * Constants for the map export tool. Lengths in `STYLE` are CSS pixels at
 * scale 1; the painters multiply them by the scale they are given.
 * @module views/maps/export/constants
 * @since 2.41.0
 */
define([], () => {
  /** @type {number} Times the on-screen drawing buffer. */
  const EXPORT_RESOLUTION_MULTIPLIER = 2;
  /** @type {number} Maximum pixels in the Cesium canvas or the output. */
  const EXPORT_MAX_PIXELS = 64e6;
  /** @type {number} Narrowest frame (CSS px) that can be exported. */
  const EXPORT_MIN_FRAME_PX = 320;
  /** @type {number} Longest total wait for the map data to load. */
  const EXPORT_SETTLE_TIMEOUT_MS = 180000;
  /** @type {number} How long loading may go without any progress. */
  const EXPORT_SETTLE_STALL_MS = 20000;
  const EXPORT_SETTLE_STABLE_FRAMES = 3;
  const EXPORT_QUIET_MS = 500;
  /** @type {number} Allowed pitch/roll deviation from top-down, in degrees. */
  const EXPORT_LEVEL_TOLERANCE_DEG = 0.5;
  /** @type {number} Heading change per horizontal pixel of a rotate drag. */
  const EXPORT_HEADING_RAD_PER_PX = 0.005;
  /** @type {number} Factor applied to the resolution multiplier on retry. */
  const EXPORT_RETRY_FACTOR = 0.75;
  const EXPORT_MAX_RETRIES = 2;
  const LEGEND_MAX_HEIGHT_FRACTION = 0.5;
  const LEGEND_MAX_WIDTH_FRACTION = 0.5;
  const LEGEND_MIN_FONT_PX = 10;

  const EXPORT_BACKGROUND_COLOR = "#ffffff";
  /** @type {number} Gap (CSS px) between the sidebar/edges and the frame. */
  const EXPORT_FRAME_INSET = 12;

  const FONT_FAMILY =
    'Barlow, "Helvetica Neue", Helvetica, Arial, sans-serif';

  const STYLE = {
    fontFamily: FONT_FAMILY,
    textColor: "#000000",
    outlineColor: "#ffffff",
    margin: 16,
    legend: {
      fontPx: 13,
      padding: 12,
      radius: 8,
      background: "#ffffff",
      maxEntryWidth: 240,
      // Spacing presets, tried in order before the font is reduced.
      spacing: {
        normal: { rowGap: 6, entryGap: 14, columnGap: 22 },
        tight: { rowGap: 2, entryGap: 6, columnGap: 14 },
      },
      swatchGap: 8,
      swatchToFont: 1.1,
      gradientRows: 4,
      lineHeight: 1.25,
    },
    scaleBar: {
      maxBarWidth: 150,
      tickHeight: 10,
      lineWidth: 2,
      outlineWidth: 3,
      fontPx: 13,
      textGap: 6,
      height: 24,
    },
    northArrow: {
      diameter: 44,
      background: "#ffffff",
      color: "#000000",
      gap: 12,
      fontPx: 14,
    },
    citations: {
      fontPx: 11,
      padding: 10,
      lineHeight: 1.35,
      background: "#ffffff",
      color: "#000000",
      title: "DATA CITATIONS",
    },
    legendBand: {
      padding: 12,
      background: "#ffffff",
      title: "Legend (continued)",
    },
    frameOutline: "rgba(255, 255, 255, 0.95)",
  };

  return {
    EXPORT_RESOLUTION_MULTIPLIER,
    EXPORT_MAX_PIXELS,
    EXPORT_MIN_FRAME_PX,
    EXPORT_SETTLE_TIMEOUT_MS,
    EXPORT_SETTLE_STALL_MS,
    EXPORT_SETTLE_STABLE_FRAMES,
    EXPORT_QUIET_MS,
    EXPORT_LEVEL_TOLERANCE_DEG,
    EXPORT_HEADING_RAD_PER_PX,
    EXPORT_RETRY_FACTOR,
    EXPORT_FRAME_INSET,
    EXPORT_MAX_RETRIES,
    EXPORT_BACKGROUND_COLOR,
    LEGEND_MAX_HEIGHT_FRACTION,
    LEGEND_MAX_WIDTH_FRACTION,
    LEGEND_MIN_FONT_PX,
    FONT_FAMILY,
    STYLE,
  };
});
