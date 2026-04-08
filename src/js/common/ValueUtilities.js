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
     * Normalize any value into an array of trimmed strings.
     * @param {*} value Value or array of values.
     * @returns {Array<string|null>} Normalized string array.
     */
    normalizeStringArray(value) {
      const list = ValueUtilities.listify(value);
      return list
        .map((entry) => ValueUtilities.normalizeText(entry))
        .filter((entry) => entry !== null);
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
     * Deduplicate values by a derived key while preserving first-seen order.
     * @param {Array<*>} values Values to dedupe.
     * @param {Function} keyFn Function that returns a unique key per value.
     * @returns {Array<*>} Deduplicated values.
     */
    dedupeBy(values, keyFn) {
      const list = Array.isArray(values) ? values : [];
      if (typeof keyFn !== "function") {
        return ValueUtilities.dedupeArray(list);
      }

      const seen = new Set();
      const deduped = [];
      list.forEach((value) => {
        const key = keyFn(value);
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(value);
      });

      return deduped;
    },

    /**
     * Return a sorted copy of string-like values.
     * @param {Array<*>} values Values to sort as strings.
     * @returns {Array<*>} Sorted values.
     */
    sortStrings(values) {
      return [...(Array.isArray(values) ? values : [])].sort((a, b) =>
        String(a).localeCompare(String(b)),
      );
    },

    /**
     * Return a sorted copy of values using a derived string key.
     * @param {Array<*>} values Values to sort.
     * @param {Function} keyFn Function that returns a comparable key.
     * @returns {Array<*>} Sorted values.
     */
    sortBy(values, keyFn) {
      const getKey = typeof keyFn === "function" ? keyFn : (value) => value;
      return [...(Array.isArray(values) ? values : [])].sort((a, b) =>
        String(getKey(a)).localeCompare(String(getKey(b))),
      );
    },

    /**
     * Return a shallow copy of an object with keys sorted alphabetically.
     * @param {object} record Source object.
     * @returns {object} Object copy with sorted keys.
     */
    sortObjectKeys(record) {
      const source = ValueUtilities.isPlainObject(record) ? record : {};
      return Object.fromEntries(
        ValueUtilities.sortStrings(Object.keys(source)).map((key) => [
          key,
          source[key],
        ]),
      );
    },

    /**
     * Return a shallow copy of an object, cloning any array values.
     * @param {object} record Source object whose array values should be copied.
     * @returns {object} Shallow object copy with cloned arrays.
     */
    cloneObjectWithArrayValues(record) {
      const source = ValueUtilities.isPlainObject(record) ? record : {};
      return Object.fromEntries(
        Object.entries(source).map(([key, value]) => [
          key,
          Array.isArray(value) ? [...value] : value,
        ]),
      );
    },

    /**
     * Ensure a value is an array, wrapping it if necessary.
     * @param {*} value Value or array of values.
     * @returns {Array<*>} Array of values, or empty array for nullish input.
     * @example
     * ValueUtilities.listify("a"); // ["a"]
     * ValueUtilities.listify(["a", "b"]); // ["a", "b"]
     * ValueUtilities.listify(null); // []
     * ValueUtilities.listify(undefined); // []
     */
    listify(value) {
      if (value === undefined || value === null) return [];
      if (Array.isArray(value)) return value;
      return [value];
    },

    /**
     * Convert an array of strings into a human-readable list with separators.
     * @param {Array<*>} array Values to format as a list.
     * @param {object} [options] Formatting options.
     * @param {string} [options.separator] Separator between items (default: ",
     * ").
     * @param {string} [options.finalSeparator] Separator before the last item
     * (default: " and ").
     * @param {boolean} [options.oxfordComma] Whether to include a separator
     * before the final separator in lists of 3 or more items (default: true).
     * @param {boolean} [options.quoteStrings] Whether to wrap items in quotes
     * @returns {string} Formatted list string.
     */
    arrayToString(
      array,
      {
        separator = ",",
        finalSeparator = "and",
        oxfordComma = true,
        quoteStrings = false,
      } = {},
    ) {
      const list = ValueUtilities.normalizeStringArray(array);
      const displayList = quoteStrings ? list.map((item) => `"${item}"`) : list;

      if (displayList.length === 0) return "";
      if (displayList.length === 1) return String(displayList[0]);
      if (displayList.length === 2) {
        return `${displayList[0]} ${finalSeparator} ${displayList[1]}`;
      }
      const allButLast = displayList.slice(0, -1).join(`${separator} `);
      const last = displayList[displayList.length - 1];
      const oxford = oxfordComma ? "," : "";
      return `${allButLast}${oxford} ${finalSeparator} ${last}`;
    },

    /**
     * Normalize a string-like value and require that it matches one allowed
     * choice.
     * @param {*} value Candidate value.
     * @param {string[]} allowedValues Canonical allowed string values.
     * @param {object} [options] Validation options.
     * @param {string} [options.fieldName] Field name used in error messages.
     * @param {boolean} [options.caseInsensitive] Whether to match choices
     * case-insensitively.
     * @param {*} [options.fallback] Optional fallback value returned when input
     * is empty or invalid, after normalization. Must be one of the allowed
     * values when defined.
     * @returns {string} Matching canonical allowed value.
     * @throws {Error} When the value is missing or not one of the allowed
     * choices.
     * @example
     * ValueUtilities.requireStringChoice(
     *   " Sources ",
     *   ["sources", "derivations"],
     *   { fieldName: "chartType" }
     * );
     * // "sources"
     */
    requireStringChoice(
      value,
      allowedValues,
      {
        fieldName = "value",
        caseInsensitive = true,
        fallback = undefined,
      } = {},
    ) {
      const normalizedAllowedValues =
        ValueUtilities.normalizeStringArray(allowedValues);
      if (!normalizedAllowedValues.length) {
        throw new Error(
          "ValueUtilities.requireStringChoice: allowedValues must include at least one non-empty string",
        );
      }

      const allowedText = ValueUtilities.arrayToString(
        normalizedAllowedValues,
        { finalSeparator: "or", quoteStrings: true },
      );
      const normalizeChoice = (entry) =>
        caseInsensitive ? entry.toLowerCase() : entry;

      let normalizedFallback = null;

      // Fallback must also be an allowed value when defined
      if (fallback !== undefined) {
        try {
          normalizedFallback = ValueUtilities.requireStringChoice(
            fallback,
            normalizedAllowedValues,
            { fieldName, caseInsensitive, fallback: undefined },
          );
        } catch (error) {
          throw new Error(`Invalid Fallback: ${error.message}`);
        }
      }

      let normalizedValue;
      try {
        normalizedValue = ValueUtilities.requireNonEmptyString(value);
      } catch (error) {
        if (fallback !== undefined) {
          normalizedValue = normalizedFallback;
        } else {
          throw error;
        }
      }

      const comparableValue = normalizeChoice(normalizedValue);
      const matchedValue = normalizedAllowedValues.find(
        (allowedValue) => normalizeChoice(allowedValue) === comparableValue,
      );

      if (matchedValue !== undefined) {
        return matchedValue;
      }

      if (normalizedFallback !== null) {
        return normalizedFallback;
      }

      throw new Error(
        `"${value}" is not a valid ${fieldName}. Must be ${allowedText}.`,
      );
    },

    /**
     * Check whether a value is a plain non-array object.
     * @param {*} value Candidate value.
     * @returns {boolean} True when the value is a plain object.
     */
    isPlainObject(value) {
      return (
        value !== null && typeof value === "object" && !Array.isArray(value)
      );
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
     * Require a non-empty string value and throw when missing.
     * @param {*} value Candidate value.
     * @param {string} [message] Error message to throw when invalid.
     * @returns {string} Original value when valid.
     * @throws {Error} When value is not a non-empty string.
     */
    requireNonEmptyString(
      value,
      message = "ValueUtilities: value must be a non-empty string",
    ) {
      const normalized = ValueUtilities.normalizeText(value);
      if (!ValueUtilities.isNonEmptyString(value)) {
        throw new Error(message);
      }
      return normalized;
    },

    /**
     * Check whether a value is a non-negative integer (aka unsigned integer).
     * @param {*} value Candidate value.
     * @returns {boolean} True when value is an unsigned integer.
     */
    isNonNegativeInteger(value) {
      return Number.isInteger(value) && value >= 0;
    },

    /**
     * Require a non-negative integer and throw when invalid.
     * @param {*} value Candidate index value.
     * @param {string} [message] Error message to throw when invalid.
     * @returns {number} Original integer index when valid.
     * @throws {Error} When the value is not a non-negative integer.
     */
    requireNonNegativeInteger(
      value,
      message = "Value must be a non-negative integer index",
    ) {
      if (!ValueUtilities.isNonNegativeInteger(value)) {
        throw new Error(message);
      }
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
     * Normalize positive integer-like values while falling back when invalid.
     * @param {*} value Value to normalize.
     * @param {number} fallback Fallback returned for invalid input.
     * @returns {number} Positive integer or fallback.
     */
    normalizePositiveInteger(value, fallback) {
      if (Number.isInteger(value) && value > 0) {
        return value;
      }

      const normalized = ValueUtilities.normalizeInteger(value);
      if (Number.isInteger(normalized) && normalized > 0) {
        return normalized;
      }

      return fallback;
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
        return a.every((value, index) =>
          ValueUtilities.deepEqual(value, b[index]),
        );
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
     * @param {boolean} [options.ignoreCase] Normalize strings to lowercase.
     * @param {boolean} [options.orderMatters] Preserve array order.
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
      /* eslint-disable-next-line no-param-reassign */
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
