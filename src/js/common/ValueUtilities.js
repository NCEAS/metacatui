"use strict";

define(["md5"], (md5) => {
  const KIBIBYTE = 1024;
  const MEBIBYTE = KIBIBYTE * 1024;
  const GIBIBYTE = MEBIBYTE * 1024;
  const TEBIBYTE = GIBIBYTE * 1024;

  /**
   * Generic helpers for normalizing, comparing, and serializing values.
   * @namespace ValueUtilities
   * @since 0.0.0
   */
  const ValueUtilities = {
    /**
     * Return the first value that is not `undefined`.
     * @param {...*} values Candidate values.
     * @returns {*} First defined value, or `undefined`.
     */
    firstDefined(...values) {
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] !== undefined) return values[i];
      }
      return undefined;
    },

    /**
     * Collapse `undefined`, `null`, and the empty string to `null`.
     * @param {*} value Value to normalize.
     * @returns {*|null} `null` for empty input, otherwise the original value.
     */
    nullIfEmpty(value) {
      return value === undefined || value === null || value === ""
        ? null
        : value;
    },

    /**
     * Normalize a value to trimmed text.
     * @param {*} value Value to normalize.
     * @returns {string|null} Trimmed string or `null` for nullish values.
     */
    normalizeText(value) {
      if (value === undefined || value === null) return null;
      return String(value).trim();
    },

    /**
     * Normalize boolean-like values while preserving invalid non-empty input.
     * @param {*} value Value to normalize.
     * @returns {boolean|null|*} Boolean, `null`, or original invalid value.
     */
    normalizeBoolean(value) {
      if (ValueUtilities.nullIfEmpty(value) === null) return null;
      if (typeof value === "boolean") return value;

      const normalized = ValueUtilities.normalizeText(value)?.toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;

      return value;
    },

    /**
     * Normalize integer-like values while preserving invalid non-empty input.
     * @param {*} value Value to normalize.
     * @returns {number|null|*} Integer, `null`, or original invalid value.
     */
    normalizeInteger(value) {
      if (ValueUtilities.nullIfEmpty(value) === null) return null;
      if (typeof value === "number") return value;

      const normalized = ValueUtilities.normalizeText(value);
      if (/^-?\d+$/.test(normalized)) {
        return Number.parseInt(normalized, 10);
      }

      return value;
    },

    /**
     * Normalize any value into an array of trimmed strings.
     * @param {*} value Value or array of values.
     * @returns {Array<string|null>} Normalized string array.
     */
    normalizeStringArray(value) {
      if (value === undefined || value === null) return [];
      const list = Array.isArray(value) ? value : [value];
      return list
        .filter((entry) => entry !== undefined && entry !== null)
        .map((entry) => ValueUtilities.normalizeText(entry));
    },

    /**
     * Deduplicate array values while preserving first-seen order.
     * @param {Array<*>} values Values to dedupe.
     * @returns {Array<*>} Deduplicated array.
     */
    dedupeArray(values) {
      return Array.from(new Set(Array.isArray(values) ? values : []));
    },

    /**
     * Check whether a value is a non-empty string.
     * @param {*} value Candidate value.
     * @returns {boolean} True when value is a non-empty string.
     */
    isNonEmptyString(value) {
      return typeof value === "string" && value.trim().length > 0;
    },

    /**
     * Check whether a value is an unsigned integer.
     * @param {*} value Candidate value.
     * @returns {boolean} True when value is an unsigned integer.
     */
    isUnsignedInteger(value) {
      return Number.isInteger(value) && value >= 0;
    },

    /**
     * Format a number for display based on the magnitude of its range.
     * @param {number} value Number to format.
     * @param {number} range Data range used to pick precision.
     * @returns {string} Formatted number string.
     */
    formatNumber(value, range) {
      if (typeof value !== "number") {
        return "";
      }
      if (typeof range !== "number") {
        return value.toString();
      }

      const numDecimalPlaces = ValueUtilities.getNumDecimalPlaces(range);
      if (numDecimalPlaces !== null) {
        return value.toFixed(numDecimalPlaces);
      }
      return value.toExponential(2).toString();
    },

    /**
     * Calculate display precision based on numeric range.
     * @param {number} range The range of values.
     * @returns {number|null} Decimal places or null for scientific notation.
     */
    getNumDecimalPlaces(range) {
      if (range < 0.0001 || range > 100000) {
        return null;
      }
      if (range < 0.001) {
        return 5;
      }
      if (range < 0.01) {
        return 4;
      }
      if (range < 0.1) {
        return 3;
      }
      if (range < 1) {
        return 2;
      }
      if (range <= 100) {
        return 1;
      }
      return 0;
    },

    /**
     * Convert bytes to a human-readable size string.
     * @param {number} bytes Number of bytes.
     * @param {number} [precision] Decimal places to include.
     * @returns {string} Formatted size string.
     */
    bytesToSize(bytes, precision = 0) {
      if (typeof bytes === "undefined") return "0 B";

      if (bytes >= 0 && bytes < KIBIBYTE) {
        return `${bytes} B`;
      }
      if (bytes >= KIBIBYTE && bytes < MEBIBYTE) {
        return `${(bytes / KIBIBYTE).toFixed(precision)} KiB`;
      }
      if (bytes >= MEBIBYTE && bytes < GIBIBYTE) {
        return `${(bytes / MEBIBYTE).toFixed(precision)} MiB`;
      }
      if (bytes >= GIBIBYTE && bytes < TEBIBYTE) {
        return `${(bytes / GIBIBYTE).toFixed(precision)} GiB`;
      }
      if (bytes >= TEBIBYTE) {
        return `${(bytes / TEBIBYTE).toFixed(precision)} TiB`;
      }
      return `${bytes} B`;
    },

    /**
     * Check if two values are deeply equal.
     * @param {*} a First value.
     * @param {*} b Second value.
     * @returns {boolean} True when values are deeply equal.
     */
    deepEqual(a, b) {
      if (a === b) return true;

      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length === 0 && b.length === 0) return true;
        if (a.length !== b.length) return false;
        return a.every((value, index) => ValueUtilities.deepEqual(value, b[index]));
      }

      if (
        typeof a === "object" &&
        a !== null &&
        typeof b === "object" &&
        b !== null
      ) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        if (keysA.length !== keysB.length) return false;

        return keysA.every(
          (key) =>
            keysB.includes(key) && ValueUtilities.deepEqual(a[key], b[key]),
        );
      }

      return false;
    },

    /**
     * Deterministically stringify a value so order does not affect the result.
     * @param {*} val Value to stringify.
     * @param {object} [options] Stringification options.
     * @param {boolean} [options.ignoreCase=true] Normalize strings to lowercase.
     * @param {boolean} [options.orderMatters=false] Preserve array order.
     * @param {WeakSet} [options.processed] Internal set of seen objects.
     * @returns {string} Stable string representation.
     * @throws {Error} Throws on circular references.
     */
    stableStringify(
      val,
      options = {
        ignoreCase: true,
        orderMatters: false,
        processed: new WeakSet(),
      },
    ) {
      const { ignoreCase = true, orderMatters = false, processed } = options;
      const seen = processed instanceof WeakSet ? processed : new WeakSet();
      const nextOpts = { ignoreCase, orderMatters, processed: seen };
      const rawTag = Object.prototype.toString.call(val);
      const type = rawTag.slice(8, -1).toLowerCase();
      let newString;

      if (val === undefined || val === null) {
        return "null";
      }
      if (type === "string") {
        const trimmed = val.trim();
        return ignoreCase ? trimmed.toLowerCase() : trimmed;
      }

      switch (type) {
        case "number":
        case "boolean":
        case "bigint":
          newString = String(val);
          break;
        case "function":
        case "generatorfunction":
        case "asyncfunction":
          newString = `${md5(Function.prototype.toString.call(val))}`;
          break;
        case "symbol": {
          const key = Symbol.keyFor(val);
          const desc = val.description || "";
          newString = key ? `global:${key}` : `local:${desc}`;
          break;
        }
        case "date":
          newString = val.toISOString();
          break;
        case "regexp":
        case "url":
          newString = val.toString();
          break;
        case "error":
          newString = val.toString();
          newString = newString.toLowerCase().startsWith("error:")
            ? newString.slice(6).trim()
            : newString;
          break;
        default:
          if (typeof val !== "object") {
            newString =
              typeof val.toString === "function" ? val.toString() : String(val);
          }
      }

      if (newString && newString !== "[object Object]") {
        return ValueUtilities.stableStringify(`${type}:${newString}`, {
          ignoreCase,
          processed: seen,
        });
      }

      if (seen.has(val)) {
        throw new Error("ValueUtilities.stableStringify: circular reference");
      }

      seen.add(val);

      let normalized;
      if (val instanceof Map) {
        const entries = [];
        val.forEach((mapValue, mapKey) => {
          entries.push([
            ValueUtilities.stableStringify(mapKey, nextOpts),
            ValueUtilities.stableStringify(mapValue, nextOpts),
          ]);
        });
        entries.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );
        normalized = { type: "Map", entries };
      } else if (val instanceof Set) {
        const values = Array.from(val, (item) =>
          ValueUtilities.stableStringify(item, nextOpts),
        );
        values.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );
        normalized = { type: "Set", values };
      } else if (Array.isArray(val)) {
        const normalizedItems = val.map((item) =>
          ValueUtilities.stableStringify(item, nextOpts),
        );
        if (!orderMatters) {
          normalizedItems.sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b)),
          );
        }
        normalized = normalizedItems;
      } else {
        const keys = Object.keys(val).sort();
        const result = {};
        keys.forEach((key) => {
          const newKey = ValueUtilities.stableStringify(key, nextOpts);
          result[newKey] = ValueUtilities.stableStringify(val[key], nextOpts);
        });
        normalized = result;
      }

      seen.delete(val);
      return JSON.stringify(normalized);
    },

    /**
     * Decode a URI component safely and fall back to the original value when
     * decoding fails.
     * @param {*} value Encoded value.
     * @returns {string|null} Decoded value, original string, or null.
     */
    safeDecodeURIComponent(value) {
      if (value === undefined || value === null) return null;
      const normalized = String(value);
      try {
        return decodeURIComponent(normalized);
      } catch (_error) {
        return normalized;
      }
    },

    /**
     * Build a unique key from selected fields in an options object.
     * @param {object} options Source object.
     * @param {string[]} keys Field names to include.
     * @param {object} [normalizers] Optional field normalizers.
     * @param {string} [separator] Separator between key parts.
     * @param {boolean} [encode] Whether to md5-hash the result.
     * @returns {string} Generated key.
     */
    buildInstanceKey(
      options = {},
      keys = [],
      normalizers = {},
      separator = "|",
      encode = true,
    ) {
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error(
          "ValueUtilities.buildInstanceKey: keys must be a non-empty array",
        );
      }
      const parts = keys.map((field) => {
        const normalizer = normalizers[field];
        const raw = options?.[field];
        const value =
          typeof normalizer === "function" ? normalizer(raw, options) : raw;
        let normalizedValue = value;
        if (typeof normalizedValue === "string") {
          normalizedValue = normalizedValue.trim();
        }
        if (normalizedValue !== null && normalizedValue !== undefined) {
          return `${field}:${String(normalizedValue)}`;
        }
        return null;
      });
      const longKey = parts.filter(Boolean).join(separator);
      if (encode) return md5(longKey);
      return longKey;
    },

    /**
     * Get or create a singleton instance keyed by normalized options.
     * @param {Function} ClassRef Class constructor.
     * @param {object} [options] Options passed to the constructor.
     * @param {Function} buildInstanceKey Function that builds a unique key.
     * @returns {object} Singleton instance.
     */
    getSingleton(ClassRef, options, buildInstanceKey) {
      if (!ClassRef) {
        throw new Error("ValueUtilities.getSingleton: ClassRef is required");
      }
      if (!ClassRef.instances) ClassRef.instances = new Map();
      if (!(ClassRef.instances instanceof Map)) {
        throw new Error("ValueUtilities.getSingleton: instances must be a Map");
      }
      if (typeof buildInstanceKey !== "function") {
        throw new Error(
          "ValueUtilities.getSingleton: buildInstanceKey must be a function",
        );
      }
      const key = buildInstanceKey(options);
      if (!ClassRef.instances.has(key)) {
        const instance = new ClassRef(options);
        instance.singletonInstanceKey = key;
        ClassRef.instances.set(key, instance);
      }
      return ClassRef.instances.get(key);
    },

    /**
     * Remove default values from a model's JSON representation.
     * @param {Backbone.Model} model Source model.
     * @param {string[]} [removeProps] Additional properties to remove.
     * @returns {object} JSON with default-valued fields removed.
     */
    toJSONWithoutDefaults(model, removeProps = []) {
      const json = model.toJSON();
      const defaults = model.defaults();

      Object.keys(defaults).forEach((key) => {
        if (removeProps.includes(key)) {
          delete json[key];
        } else if (ValueUtilities.deepEqual(json[key], defaults[key])) {
          delete json[key];
        }
      });

      return json;
    },

    /**
     * Convert a wildcard pattern such as `eml*` to a RegExp.
     * @param {string} pattern Wildcard pattern.
     * @returns {RegExp} Case-insensitive regex.
     */
    wildcardToRegex(pattern) {
      const escaped = String(pattern).replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
      const regexString = `^${escaped.replace(/\*/g, ".*")}$`;
      return new RegExp(regexString, "i");
    },

    /**
     * Get a value from an object using a case-insensitive key lookup.
     * @param {object} obj Source object.
     * @param {string} keyName Target key name.
     * @param {Function} [normalizeValue] Optional value normalizer.
     * @returns {*} Matched value or undefined.
     */
    getCaseInsensitive(obj, keyName, normalizeValue) {
      if (!obj || !keyName) return undefined;

      const target = String(keyName).toLowerCase();
      const key = Object.keys(obj).find(
        (candidateKey) => String(candidateKey).toLowerCase() === target,
      );

      if (!key) return undefined;

      const value = obj[key];
      return normalizeValue ? normalizeValue(value) : value;
    },
  };

  return ValueUtilities;
});
