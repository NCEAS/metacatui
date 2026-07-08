"use strict";

define(["md5"], (md5) => {
  const KIBIBYTE = 1024;
  const MEBIBYTE = KIBIBYTE * 1024;
  const GIBIBYTE = MEBIBYTE * 1024;
  const TEBIBYTE = GIBIBYTE * 1024;

  /**
   * @namespace Utilities
   * @description A generic utility object that contains functions used throughout MetacatUI to perform useful functions,
   * but not used to store or manipulate any state about the application.
   * @type {object}
   * @since 2.14.0
   */
  const Utilities = /** @lends Utilities.prototype */ {
    /**
     * HTML-encodes the given string so it can be inserted into an HTML page without running
     * any embedded Javascript.
     * @param {string} s String to be encoded.
     * @returns {string} HTML encoded string.
     */
    encodeHTML(s) {
      if (!s || typeof s !== "string") {
        return "";
      }

      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&apos;")
        .replace(/\//g, "/")
        .replace(/"/g, "&quot;");
    },

    /**
     * Validates that the given string is a valid DOI
     * @param {string} identifier String to be validated.
     * @returns {boolean} True if identifier is a valid DOI.
     * @since 2.15.0
     */
    isValidDOI(identifier) {
      // generate doi regex
      const doiRGEX =
        /^\s*(http:\/\/|https:\/\/)?(doi.org\/|dx.doi.org\/)?(doi: ?|DOI: ?)?(10\.\d{4,}(\.\d)*)\/(\w+).*$/gi;

      return doiRGEX.test(identifier);
    },

    /**
     * Read the first part of a file
     * @param {File} file - A reference to a file
     * @param {Backbone.View} context - The View to bind `callback` to
     * @param {Function} callback - A function to run after the read is
     *   complete. The function is bound to `context`.
     * @param {number} bytes - The number of bytes to read from the start of the
     *   file
     * @since 2.15.0
     */
    readSlice(file, context, callback, bytes = 1024) {
      if (typeof callback !== "function") {
        return;
      }

      const reader = new FileReader();
      const blob = file.slice(0, bytes);

      reader.onloadend = callback.bind(context);
      reader.readAsBinaryString(blob);
    },
    /**
     * Attempt to parse the header/column names from a chunk of a CSV file
     *
     * Doesn't handle:
     * - UTF BOM (garbles first col name)
     * - Commas inside quoted headers
     * @param {string} text - A chunk of a file
     * @returns {Array} A list of names
     * @since 2.15.0
     */
    tryParseCSVHeader(text) {
      // The order is important here
      const strategies = ["\r\\n", "\r", "\n"];

      let index = -1;

      for (let i = 1; i < strategies.length; i += 1) {
        const result = text.indexOf(strategies[i]);

        if (result >= 0) {
          index = result;

          break;
        }
      }

      if (index === -1) {
        return [];
      }

      const headerLine = text.slice(0, index);
      let names = headerLine.split(",");

      // Remove surrounding parens and double-quotes
      names = names.map((name) => name.replaceAll(/^["']|["']$/gm, ""));

      // Filter out zero-length values (headers like a,b,c,,,,,)
      names = names.filter((name) => name.length > 0);

      return names;
    },

    /**
     * Format the number into a string with better readability, based on the manitude of a
     * range this number falls in.
     * @param {number} value The number value to be formatted.
     * @param {number} range The range of numerics this value can fall in.
     * @returns {string} A formatted number based on the magnitude of `range`.
     * @since 2.30.0
     */
    formatNumber(value, range) {
      if (typeof value !== "number") {
        return "";
      }
      if (typeof range !== "number") {
        return value.toString();
      }

      const numDecimalPlaces = Utilities.getNumDecimalPlaces(range);
      if (numDecimalPlaces !== null) {
        return value.toFixed(numDecimalPlaces);
      }
      return value.toExponential(2).toString();
    },

    /**
     * Format a finite number using a fixed number of decimal places.
     * @param {number} value The number value to be formatted.
     * @param {number} [digits=2] The number of decimal places to display.
     * @param {string} [fallback=""] The value to return when `value` is not finite.
     * @returns {string} A fixed-decimal number string or the fallback value.
     * @since 2.37.0
     */
    formatFixedNumber(value, digits = 2, fallback = "") {
      return Number.isFinite(value) ? value.toFixed(digits) : fallback;
    },

    /**
     * Calculate the number of decimal places we should use based on the range of the data.
     * @param {number} range The range of data values.
     * @returns {number} The number of decimal places we should use.
     * @since 2.30.0
     */
    getNumDecimalPlaces(range) {
      if (range < 0.0001 || range > 100000) {
        return null; // Will use scientific notation
      }
      if (range < 0.001) {
        return 5; // Allow 5 decimal places
      }
      if (range < 0.01) {
        return 4; // Allow 4 decimal places
      }
      if (range < 0.1) {
        return 3; // Allow 3 decimal places
      }
      if (range < 1) {
        return 2; // Allow 2 decimal places
      }
      if (range <= 100) {
        return 1; // Allow 1 decimal places
      }
      return 0; // No decimal places
    },

    /**
     * Checks if two objects are deeply equal. Simpler than the _.isEqual function.
     * @param {object} a - The first object to compare
     * @param {object} b - The second object to compare
     * @returns {boolean} True if the objects are deeply equal
     * @since 2.31.0
     */
    deepEqual(a, b) {
      if (a === b) return true;

      if (Array.isArray(a) && Array.isArray(b)) {
        // Quick check for empty arrays
        if (a.length === 0 && b.length === 0) return true;
        if (a.length !== b.length) return false;
        return a.every((value, index) => this.deepEqual(value, b[index]));
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
          (key) => keysB.includes(key) && this.deepEqual(a[key], b[key]),
        );
      }

      return false;
    },

    /**
     * Stringify any value deterministically, where order doesn't impact the
     * result. All object keys and array items are sorted in a consistent way.
     * Normalizes undefined to null. Useful for creating unique keys based on
     * the content of an object, e.g. for keying a cache or singleton instance.
     * @param {*} val The value to stringify.
     * @param {object} [options] Options object.
     * @param {boolean} [options.ignoreCase] Whether to convert all string
     * values to lower case before stringifying, for case-insensitive
     * comparisons. Default is true. Note when ignoreCase is true, normalized
     * object keys can collide (e.g., "A" and "a").
     * @param {WeakSet} [options.processed] WeakSet tracking visited objects.
     * @param {boolean} [options.orderMatters] Whether to preserve array order
     * during stringification. Default is false (arrays are sorted).
     * @returns {string} A string that is consistent regardless of the order of
     * keys in objects or items in arrays, etc.
     * @throws {Error} If a circular reference is detected.
     * @since 2.37.0
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
      // Object.prototype.toString (-> e.g., "[object Date]") is more reliable
      // than typeof or val.constructor.name, e.g. when minified
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
          // Errors get prefixed with "Error:" in toString
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
        return Utilities.stableStringify(`${type}:${newString}`, {
          ignoreCase,
          processed: seen,
        });
      }

      // For objects, we need to recursively normalize properties/items. We also
      // need to track seen objects to detect circular references and avoid
      // infinite recursion.
      if (seen.has(val)) {
        throw new Error("Utilities.stableStringify: circular reference");
      }

      seen.add(val);

      let normalized;
      if (val instanceof Map) {
        const entries = [];
        val.forEach((mapValue, mapKey) => {
          entries.push([
            Utilities.stableStringify(mapKey, nextOpts),
            Utilities.stableStringify(mapValue, nextOpts),
          ]);
        });
        entries.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );
        normalized = { type: "Map", entries };
      } else if (val instanceof Set) {
        const values = Array.from(val, (item) =>
          Utilities.stableStringify(item, nextOpts),
        );
        values.sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );
        normalized = { type: "Set", values };
      } else if (Array.isArray(val)) {
        const normalizedItems = val.map((item) =>
          Utilities.stableStringify(item, nextOpts),
        );
        if (!orderMatters) {
          normalizedItems.sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b)),
          );
        }
        normalized = normalizedItems;
      } else {
        // Plain object
        const keys = Object.keys(val).sort();
        const result = {};
        keys.forEach((key) => {
          const newKey = Utilities.stableStringify(key, nextOpts);
          result[newKey] = Utilities.stableStringify(val[key], nextOpts);
        });
        normalized = result;
      }

      seen.delete(val);
      return JSON.stringify(normalized);
    },

    /**
     * Normalize a URL string by trimming whitespace and removing trailing slashes.
     * @param {string} url The URL to normalize.
     * @param {string} [fallback] A fallback URL to use if url is empty.
     * @returns {string} Normalized URL, or empty string if not available.
     * @since 2.37.0
     */
    normalizeUrl(url, fallback = "") {
      let resolved = url;
      if (typeof resolved === "string" && !resolved.trim()) {
        resolved = "";
      }
      if (!resolved) {
        resolved = fallback;
      }
      if (!resolved) return "";
      let urlString =
        typeof resolved === "string" ? resolved : String(resolved);
      urlString = urlString.trim();
      if (!urlString) return "";
      // Remove trailing slashes (including before query/hash)
      return urlString.replace(/\/+(?=($|[?#]))/, "");
    },

    /**
     * Build a unique string to represent an instance of a class, or generally,
     * to uniquely identify a set of options or properties. The key is built
     * from an object (e.g. config options for a class instance) by
     * concatenating the values of specified fields. Only includes fields that
     * have non-null/undefined values.
     * @param {object} options The object containing the keys and values to
     * build the key from.
     * @param {string[]} keys The names of fields required to build the instance
     * key. If a value for the key is available, it will be included. Otherwise
     * it will be skipped.
     * @param {object} [normalizers] Optional object mapping field names to
     * normalizer functions that take the raw value and return a normalized
     * value to use for the key, for example, to normalize URLs or make strings
     * case-insensitive.
     * @param {string} [separator] Separator to use between key parts. Default
     * is "|".
     * @param {boolean} [encode] If true, the resulting key will be run through
     * md5 to shorten it and ensure it's a valid string for use as a key.
     * Default is true.
     * @returns {string} The generated instance key, which is a concatenation of
     * the specified fields and their values, with non-string values converted
     * to strings. If encode is true, this will be an md5 hash of the
     * concatenated string.
     * @throws {Error} If keys is not a non-empty array, or if buildInstanceKey
     * is not a function.
     * @since 2.37.0
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
          "Utilities.buildInstanceKey: keys must be a non-empty array",
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
     * Get or create a singleton instance for a class.
     * @param {Function} ClassRef Class reference.
     * @param {object} [options] Options passed to the class constructor for
     * this instance.
     * @param {Function} buildInstanceKey Function that builds a unique key for
     * the instance based on the options. This is used to allow multiple
     * singletons for the same class with different options. The function will
     * be passed the options object and should return a string key.
     * @returns {object} The singleton instance.
     * @since 2.37.0
     */
    getSingleton(ClassRef, options, buildInstanceKey) {
      if (!ClassRef) {
        throw new Error("Utilities.getSingleton: ClassRef is required");
      }
      // eslint-disable-next-line no-param-reassign
      if (!ClassRef.instances) ClassRef.instances = new Map();
      if (!(ClassRef.instances instanceof Map)) {
        throw new Error("Utilities.getSingleton: instances must be a Map");
      }
      if (typeof buildInstanceKey !== "function") {
        throw new Error(
          "Utilities.getSingleton: buildInstanceKey must be a function",
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
     * Wait for the global MetacatUI object to be available, and optionally for
     * a specific property on it to be defined. Useful when needing to access
     * the app user model or other properties that may not be available
     * immediately when a module is loaded.
     * @param {object} [options] Options object.
     * @param {number} [options.maxAttempts] Maximum number of attempts.
     * @param {number} [options.delay] Delay between attempts in ms.
     * @param {string} [options.property] Optional property name to wait for on
     * the MetacatUI object. If provided, the Promise won't resolve until that
     * property is available and not undefined. Otherwise, just waits for the
     * global MetacatUI object itself.
     * @returns {Promise<object>} Promise resolving to the app user model.
     * @throws {Error} If the user model is not available in time.
     * @since 2.37.0
     */
    async awaitMetacatUI({
      maxAttempts = 20,
      delay = 200,
      property = "",
    } = {}) {
      let attempts = 0;
      while (attempts < maxAttempts) {
        attempts += 1;
        if (typeof MetacatUI !== "undefined" && MetacatUI !== null) {
          // If we're just waiting for the global object, return it now
          if (!property) {
            return MetacatUI;
          }
          const value =
            MetacatUI[property] || (MetacatUI.get && MetacatUI.get(property));
          // If we're waiting for a specific property, check if it's defined
          // yet and if not, continue waiting
          if (value !== "undefined") {
            return value;
          }
        }
        // Otherwise, wait the attempt delay and try again.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }

      // If we reach here, we failed to get the appUserModel
      let message = "Unable to retrieve MetacatUI";
      if (property) {
        message += `.${property}`;
      }
      throw new Error(message);
    },

    /**
     * Removes default values from a model's JSON representation
     * @param {Backbone.Model} model - The model to remove defaults from
     * @param {string[]} [removeProps] - An array of additional properties to remove from the model
     * @returns {object} The JSON representation of the model with defaults removed
     * @since 2.31.0
     */
    toJSONWithoutDefaults(model, removeProps = []) {
      const json = model.toJSON();
      const defaults = model.defaults();

      Object.keys(defaults).forEach((key) => {
        if (removeProps.includes(key)) {
          delete json[key];
        } else if (this.deepEqual(json[key], defaults[key])) {
          delete json[key];
        }
      });

      return json;
    },

    /**
     * Convert number of bytes into human readable format
     * @param {number} bytes - The number of bytes
     * @param {number} [precision] - The number of decimal places to include
     * @returns {string} The formatted size string
     */
    bytesToSize(bytes, precision = 0) {
      if (typeof bytes === "undefined") return `0 B`;

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
     * Convert a wildcard pattern (e.g. "eml*", "*iso*") to a safe RegExp.
     * Escapes all regex special chars except '*' which becomes '.*'
     * @param {string} pattern - A simple wildcard pattern
     * @returns {RegExp} Regex for case-insensitive matching
     */
    wildcardToRegex(pattern) {
      // Escape regex special characters, except "*"
      const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
      // Replace "*" with ".*" for multi-character wildcard
      const regexString = `^${escaped.replace(/\*/g, ".*")}$`;
      return new RegExp(regexString, "i"); // "i" = case-insensitive, if desired
    },

    /**
     * Get a value from a plain object using a case-insensitive key.
     * @param {object} obj Source object
     * @param {string} keyName Key name to look up (case-insensitive)
     * @param {Function} [normalizeValue] Optional value normalizer
     * @returns {*} The matched value, or undefined if not found
     * @since 2.37.0
     */
    getCaseInsensitive(obj, keyName, normalizeValue) {
      if (!obj || !keyName) return undefined;

      const target = String(keyName).toLowerCase();
      const key = Object.keys(obj).find(
        (k) => String(k).toLowerCase() === target,
      );

      if (!key) return undefined;

      const value = obj[key];
      return normalizeValue ? normalizeValue(value) : value;
    },
  };

  return Utilities;
});
