"use strict";

define(["common/ValueUtilities"], (ValueUtilities) => {
  const { nullIfEmpty, normalizeText, requireStringChoice } = ValueUtilities;
  const GROUPING_TIME_ZONES = ["local", "UTC"];
  const RELATIVE_DATE_UNITS = [
    { label: "year", ms: 365.25 * 24 * 60 * 60 * 1000 },
    { label: "month", ms: 30.44 * 24 * 60 * 60 * 1000 },
    { label: "day", ms: 24 * 60 * 60 * 1000 },
    { label: "hour", ms: 60 * 60 * 1000 },
    { label: "minute", ms: 60 * 1000 },
    { label: "second", ms: 1000 },
  ];
  const DEFAULT_LOCALE_DATE_OPTIONS = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  /**
   * Pad a numeric date/time fragment to two digits.
   * @param {number|string} value Numeric date/time fragment.
   * @returns {string} Two-digit string.
   */
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  /**
   * Normalize the day-grouping timezone option.
   * @param {*} groupingTimeZone Candidate grouping timezone.
   * @returns {"local"|"UTC"} Normalized grouping timezone.
   */
  function normalizeGroupingTimeZone(groupingTimeZone = "local") {
    return requireStringChoice(groupingTimeZone, GROUPING_TIME_ZONES, {
      fieldName: "groupingTimeZone",
      fallback: "local",
    });
  }

  /**
   * Utility helpers for parsing, grouping, and formatting dates.
   * @namespace DateUtilities
   * @since 0.0.0
   */
  const DateUtilities = {
    /**
     * Check if a value is a valid Date instance.
     * @param {*} value Candidate value.
     * @returns {boolean} True when value is a valid Date.
     */
    isValidDate(value) {
      return value instanceof Date && !Number.isNaN(value.getTime());
    },

    /**
     * Run a date formatter and normalize errors to an empty string.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @param {Function} formatter Formatter callback.
     * @returns {string} Formatted date string, or empty string when invalid.
     */
    formatDate(value, formatter) {
      const date = DateUtilities.toDate(value);
      if (!date || typeof formatter !== "function") return "";

      try {
        return formatter(date);
      } catch (_error) {
        return "";
      }
    },

    /**
     * Return day components for the requested timezone mode.
     * @param {Date} date Valid Date instance.
     * @param {("local"|"UTC")} [groupingTimeZone] Day boundary mode.
     * @returns {{year:number, monthIndex:number, day:number}} Day components.
     */
    getDateParts(date, groupingTimeZone = "local") {
      const normalizedGroupingTimeZone =
        normalizeGroupingTimeZone(groupingTimeZone);

      if (normalizedGroupingTimeZone === "UTC") {
        return {
          year: date.getUTCFullYear(),
          monthIndex: date.getUTCMonth(),
          day: date.getUTCDate(),
        };
      }

      return {
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
        day: date.getDate(),
      };
    },

    /**
     * Extract a short timezone token from a local time representation.
     * @param {Date} date Valid Date instance.
     * @returns {string} Local timezone token, or empty string when unavailable.
     */
    getLocalTimeZoneToken(date) {
      const formatter = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        timeZoneName: "short",
      });

      const zonePart = formatter
        .formatToParts(date)
        .find(({ type }) => type === "timeZoneName");

      return zonePart?.value || "";
    },

    /**
     * Format a relative-date difference string.
     * @param {number} diffMs Signed millisecond difference.
     * @param {object} words Relative-word configuration.
     * @param {string} [words.newerWord] Label for positive differences.
     * @param {string} [words.olderWord] Label for negative differences.
     * @param {string} [words.currentWord] Label for equal differences.
     * @returns {string} Human-readable relative date string.
     */
    formatRelativeDiff(
      diffMs,
      {
        newerWord = "newer",
        olderWord = "older",
        currentWord = "current",
      } = {},
    ) {
      if (diffMs === 0) return currentWord;

      const absDiffMs = Math.abs(diffMs);
      const directionWord = diffMs > 0 ? newerWord : olderWord;
      const unit = RELATIVE_DATE_UNITS.find(
        ({ ms }) => Math.round(absDiffMs / ms) >= 1,
      );

      if (!unit) {
        return `less than 1 second ${directionWord}`;
      }

      const diffInUnits = Math.round(absDiffMs / unit.ms);
      const pluralSuffix = diffInUnits === 1 ? "" : "s";
      return `${diffInUnits} ${unit.label}${pluralSuffix} ${directionWord}`;
    },

    /**
     * Convert a value into a Date.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @returns {Date|null} Parsed Date or null when invalid.
     */
    toDate(value) {
      if (nullIfEmpty(value) === null) return null;
      const date =
        value instanceof Date ? new Date(value.getTime()) : new Date(value);
      return DateUtilities.isValidDate(date) ? date : null;
    },

    /**
     * Build a Date for start-of-day in the requested timezone mode.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @param {("local"|"UTC")} [groupingTimeZone] Day boundary mode.
     * @returns {Date|null} Midnight Date or null when invalid.
     */
    toMidnightDate(value, groupingTimeZone = "local") {
      const date = DateUtilities.toDate(value);
      if (!date) return null;

      const normalizedGroupingTimeZone =
        normalizeGroupingTimeZone(groupingTimeZone);
      const { year, monthIndex, day } = DateUtilities.getDateParts(
        date,
        normalizedGroupingTimeZone,
      );

      if (normalizedGroupingTimeZone === "UTC") {
        return new Date(Date.UTC(year, monthIndex, day));
      }

      return new Date(year, monthIndex, day);
    },

    /**
     * Convert a date into a YYYY-MM-DD string.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @param {("local"|"UTC")} [groupingTimeZone] Day boundary mode.
     * @returns {string} Date-only string, or empty string when invalid.
     */
    toISODateOnly(value, groupingTimeZone = "local") {
      const date = DateUtilities.toDate(value);
      if (!date) return "";

      const { year, monthIndex, day } = DateUtilities.getDateParts(
        date,
        groupingTimeZone,
      );
      return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    },

    /**
     * Convert a date into a stable day identifier.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @param {("local"|"UTC")} [groupingTimeZone] Day boundary mode.
     * @param {string} [prefix] Prefix to include in ID.
     * @returns {string} Stable ID string.
     */
    toDayId(value, groupingTimeZone = "local", prefix = "date") {
      const normalizedPrefix = normalizeText(prefix) || "date";
      const dateOnly = DateUtilities.toISODateOnly(value, groupingTimeZone);
      return dateOnly
        ? `${normalizedPrefix}:${dateOnly}`
        : `${normalizedPrefix}:invalid`;
    },

    /**
     * Format a date using locale-aware date formatting.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @param {object} [options] Formatting options.
     * @param {string|null} [options.locale] Locale override. Set to `null` to
     * use the default locale.
     * @param {Intl.DateTimeFormatOptions} [options.formatOptions] Intl date
     * formatting options.
     * @returns {string} Formatted date or empty string when invalid.
     */
    toLocaleDateString(
      value,
      { locale, formatOptions = DEFAULT_LOCALE_DATE_OPTIONS } = {},
    ) {
      return DateUtilities.formatDate(value, (date) =>
        date.toLocaleDateString(locale ?? undefined, formatOptions),
      );
    },

    /**
     * Format a local timestamp with a short timezone token.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @returns {string} Formatted timestamp or empty string when invalid.
     */
    toLocalTimestampWithZone(value) {
      return DateUtilities.formatDate(value, (date) => {
        const timezoneToken = DateUtilities.getLocalTimeZoneToken(date);
        const suffix = timezoneToken ? ` ${timezoneToken}` : "";

        return (
          `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-` +
          `${pad2(date.getDate())} ${pad2(date.getHours())}:` +
          `${pad2(date.getMinutes())}${suffix}`
        );
      });
    },

    /**
     * Convert a date-ish value into an ISO-8601 timestamp.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @returns {string} ISO timestamp or empty string when invalid.
     */
    toISOString(value) {
      return DateUtilities.formatDate(value, (date) => date.toISOString());
    },

    /**
     * Convert a date-ish value into a DataONE-friendly XML timestamp. This
     * preserves the UTC instant but uses an explicit `+00:00` offset.
     * @param {string|number|Date|null|undefined} value Date-like value.
     * @returns {string} XML timestamp or empty string when invalid.
     */
    toXmlDateTimeString(value) {
      const isoString = DateUtilities.toISOString(value);
      return isoString ? isoString.replace(/Z$/, "+00:00") : "";
    },

    /**
     * Return a human-readable string describing how much newer or older a date
     * is compared to a reference date.
     * @param {string|number|Date|null|undefined} value Date-like value to
     * compare.
     * @param {string|number|Date|null|undefined} referenceValue Date-like
     * reference value.
     * @param {object} [options] Formatting options.
     * @param {string} [options.newerWord] Label for positive differences.
     * @param {string} [options.olderWord] Label for negative differences.
     * @param {string} [options.currentWord] Label for equal values.
     * @returns {string} Relative date string, or empty string when invalid.
     */
    getRelativeDateString(value, referenceValue, options = {}) {
      const date = DateUtilities.toDate(value);
      const referenceDate = DateUtilities.toDate(referenceValue);
      if (!date || !referenceDate) return "";

      return DateUtilities.formatRelativeDiff(
        date.getTime() - referenceDate.getTime(),
        options,
      );
    },
  };

  return DateUtilities;
});
