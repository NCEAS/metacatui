"use strict";

define([], () => {
  const pad2 = (value) => String(value).padStart(2, "0");

  /**
   * @class DateUtility
   * @classdesc Utility helpers for parsing, grouping, and formatting dates.
   * @since 2.37.0
   */
  class DateUtility {
    /**
     * Check if a value is a valid Date instance.
     * @param {*} value Candidate value.
     * @returns {boolean} True when value is a valid Date.
     */
    static isValidDate(value) {
      return value instanceof Date && !Number.isNaN(value.getTime());
    }

    /**
     * Convert a value into a Date.
     * @param {string|number|Date} value Date-like value.
     * @returns {Date|null} Parsed Date or null when invalid.
     */
    static toDate(value) {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      const date =
        value instanceof Date ? new Date(value.getTime()) : new Date(value);
      return DateUtility.isValidDate(date) ? date : null;
    }

    /**
     * Build a Date for start-of-day in the requested timezone mode.
     * @param {string|number|Date} value Date-like value.
     * @param {("local"|"UTC")} [groupingTimeZone] Day boundary mode.
     * @returns {Date|null} Midnight Date or null when invalid.
     */
    static toMidnightDate(value, groupingTimeZone = "local") {
      const date = DateUtility.toDate(value);
      if (!date) return null;
      if (groupingTimeZone === "UTC") {
        return new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
          ),
        );
      }
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    /**
     * Convert a date into a YYYY-MM-DD string.
     * @param {string|number|Date} value Date-like value.
     * @param {("local"|"UTC")} [groupingTimeZone] Day boundary mode.
     * @returns {string} Date-only string, or empty string when invalid.
     */
    static toISODateOnly(value, groupingTimeZone = "local") {
      const date = DateUtility.toDate(value);
      if (!date) return "";
      const useUTC = groupingTimeZone === "UTC";
      const year = useUTC ? date.getUTCFullYear() : date.getFullYear();
      const month = useUTC ? date.getUTCMonth() + 1 : date.getMonth() + 1;
      const day = useUTC ? date.getUTCDate() : date.getDate();
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }

    /**
     * Convert a date into a stable day identifier.
     * @param {string|number|Date} value Date-like value.
     * @param {("local"|"UTC")} [groupingTimeZone] Day boundary mode.
     * @param {string} [prefix] Prefix to include in ID.
     * @returns {string} Stable ID string.
     */
    static toDayId(value, groupingTimeZone = "local", prefix = "date") {
      const dateOnly = DateUtility.toISODateOnly(value, groupingTimeZone);
      return dateOnly ? `${prefix}:${dateOnly}` : `${prefix}:invalid`;
    }

    /**
     * Format a date using locale-aware date formatting.
     * @param {string|number|Date} value Date-like value.
     * @param {object} [options] Formatting options.
     * @param {string} [options.locale] Locale override. Set to null to use the
     * default locale.
     * @param {Intl.DateTimeFormatOptions} [options.formatOptions] Options for
     * date formatting. Defaults to { year: "numeric", month: "long", day: "numeric" }.
     * @returns {string} Formatted date or empty string when invalid.
     */
    static toLocaleDateString(
      value,
      {
        locale,
        formatOptions = { year: "numeric", month: "long", day: "numeric" },
      } = {},
    ) {
      const date = DateUtility.toDate(value);
      if (!date) return "";
      return date.toLocaleDateString(locale, formatOptions);
    }

    /**
     * Format a local timestamp with a short timezone token.
     * @param {string|number|Date} value Date-like value.
     * @returns {string} Formatted timestamp or empty string when invalid.
     */
    static toLocalTimestampWithZone(value) {
      const date = DateUtility.toDate(value);
      if (!date) return "";

      const y = date.getFullYear();
      const m = pad2(date.getMonth() + 1);
      const d = pad2(date.getDate());
      const hours24 = date.getHours();
      const minutes = pad2(date.getMinutes());

      const tz = date
        .toLocaleTimeString(undefined, { timeZoneName: "short" })
        .split(" ")
        .pop();

      return `${y}-${m}-${d} ${hours24}:${minutes} ${tz}`;
    }

    /**
     * Convert a date-ish value into an ISO-8601 timestamp.
     * @param {string|number|Date} value Date-like value.
     * @returns {string} ISO timestamp or empty string when invalid.
     */
    static toISOString(value) {
      const date = DateUtility.toDate(value);
      if (!date) return "";
      try {
        return date.toISOString();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Error converting date to ISO string:", e);
        return "";
      }
    }

    /**
     * Return a human-readable string describing how much newer or older a date
     * is compared to a reference date, e.g. "one day newer" or "two days
     * older". It will resolve to seconds, minutes, hours, days, months, or
     * years as appropriate. If the date is the same as the reference date,
     * return "current".
     * @param {string|number|Date} value Date-like value to compare.
     * @param {string|number|Date} referenceValue Date-like reference value.
     * @param {object} [options] Formatting options.
     * @param {string} [options.newerWord] Set to customize the "newer" label,
     * for example, "before". Defaults to "newer".
     * @param {string} [options.olderWord] Set to customize the "older" label,
     * for example, "after". Defaults to "older".
     * @param {string} [options.currentWord] Set to customize the "current"
     * label. For example, "right now". Defaults to "current".
     * @returns {string} Relative date string, or empty string when invalid.
     */
    static getRelativeDateString(
      value,
      referenceValue,
      {
        newerWord = "newer",
        olderWord = "older",
        currentWord = "current",
      } = {},
    ) {
      const date = DateUtility.toDate(value);
      const referenceDate = DateUtility.toDate(referenceValue);
      if (!date || !referenceDate) return "";

      const diffMs = date.getTime() - referenceDate.getTime();
      if (diffMs === 0) return currentWord;

      const absDiffMs = Math.abs(diffMs);
      const isNewer = diffMs > 0;

      const units = [
        { label: "year", ms: 365.25 * 24 * 60 * 60 * 1000 },
        { label: "month", ms: 30.44 * 24 * 60 * 60 * 1000 },
        { label: "day", ms: 24 * 60 * 60 * 1000 },
        { label: "hour", ms: 60 * 60 * 1000 },
        { label: "minute", ms: 60 * 1000 },
        { label: "second", ms: 1000 },
      ];

      const unit = units.find((u) => {
        const diffInUnits = Math.round(absDiffMs / u.ms);
        return diffInUnits >= 1;
      });

      if (unit) {
        const diffInUnits = Math.round(absDiffMs / unit.ms);
        return `${diffInUnits} ${unit.label}${diffInUnits > 1 ? "s" : ""} ${
          isNewer ? newerWord : olderWord
        }`;
      }

      return `less than 1 second ${isNewer ? newerWord : olderWord}`;
    }
  }

  return DateUtility;
});
