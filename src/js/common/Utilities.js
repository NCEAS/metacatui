"use strict";

define([
  "backbone",
  "collections/ObjectFormats",
  "common/ValueUtilities",
  "md5",
], (Backbone, ObjectFormats, ValueUtilities, md5) => {
  const DEFAULT_MAX_CONCURRENT = 4;
  const KIBIBYTE = 1024;
  const MEBIBYTE = KIBIBYTE * 1024;
  const GIBIBYTE = MEBIBYTE * 1024;
  const TEBIBYTE = GIBIBYTE * 1024;

  /**
   * @namespace Utilities
   * @description Miscellaneous app/browser helpers that do not yet fit better
   * specialized common modules.
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
        .replace(/"/g, "&quot;");
    },

    DEFAULT_MAX_CONCURRENT,

    /**
     * Run work with one concurrency limit and no batch abstraction.
     * @param {Array<*>} items Items to process.
     * @param {Function} worker Async item worker.
     * @param {object} [options] Processing options.
     * @param {number} [options.maxConcurrent] Worker limit.
     * @param {AbortSignal} [options.signal] Abort signal.
     * @param {boolean} [options.stopOnError] Stop scheduling after an error.
     * @param {Function} [options.onItemComplete] Called after each item
     *   settles.
     * @returns {Promise<object>} Collected errors.
     * @since 0.0.0
     */
    async processConcurrently(
      items,
      worker,
      {
        maxConcurrent = DEFAULT_MAX_CONCURRENT,
        signal,
        stopOnError = true,
        onItemComplete,
      } = {},
    ) {
      let nextIndex = 0;
      let stopScheduling = false;
      const errors = [];

      const runWorker = async () => {
        while (
          !signal?.aborted &&
          !stopScheduling &&
          nextIndex < items.length
        ) {
          const index = nextIndex;
          nextIndex += 1;
          try {
            // Workers in each slot run serially to enforce maxConcurrent.
            // eslint-disable-next-line no-await-in-loop
            await worker(items[index], index);
          } catch (error) {
            errors.push({ item: items[index], error, index });
            if (stopOnError) stopScheduling = true;
          } finally {
            if (typeof onItemComplete === "function") {
              onItemComplete(items[index], index);
            }
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(maxConcurrent, items.length) }, () =>
          runWorker(),
        ),
      );
      errors.sort((a, b) => a.index - b.index);
      return { errors };
    },

    /**
     * Resolve and validate a positive concurrency limit from a caller value, an
     * app setting, or the project default.
     * @param {"upload"|"fetch"} uploadOrFetch Whether limit is for uploads or
     * fetches
     * @param {number} [maxConcurrent] Preferred default limit. If 0 or unset,
     * falls back to the app setting, then
     * {@link Utilities.DEFAULT_MAX_CONCURRENT}
     * @returns {number} Positive integer limit.
     * @since 0.0.0
     */
    getMaxConcurrent(uploadOrFetch, maxConcurrent) {
      const key = ValueUtilities.requireStringChoice(uploadOrFetch, [
        "upload",
        "fetch",
      ]);
      const mappedKeys = {
        upload: "batchSizeUpload",
        fetch: "batchSizeFetch",
      };
      const normalizedMax =
        maxConcurrent ||
        ValueUtilities.normalizePositiveInteger(
          Utilities.getMetacatUIProperty(mappedKeys[key]),
          DEFAULT_MAX_CONCURRENT,
        );
      return ValueUtilities.requirePositiveInteger(
        normalizedMax,
        "maxConcurrent must be a positive integer",
      );
    },

    /**
     * Validates that the given string is a valid DOI
     * @param {string} identifier String to be validated.
     * @returns {boolean} True if identifier is a valid DOI.
     * @since 2.15.0
     */
    isValidDOI(identifier) {
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
     * - Commas inside quoted headers
     * @param {string} text - A chunk of a file
     * @returns {Array} A list of names
     * @since 2.15.0
     */
    tryParseCSVHeader(text) {
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

      names = names.map((name) => name.replaceAll(/^["']|["']$/gm, ""));
      names = names.filter((name) => name.length > 0);

      return names;
    },

    /**
     * Format the number into a string with better readability, based on the
     * magnitude of a range this number falls in.
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
     * Checks if two objects are deeply equal. Simpler than the _.isEqual function.
     * @param {object} a - The first object to compare
     * @param {object} b - The second object to compare
     * @returns {boolean} True if the objects are deeply equal
     * @since 2.31.0
     */
    deepEqual(a, b) {
      if (a === b) return true;

      if (Array.isArray(a) && Array.isArray(b)) {
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
     * result.
     * @param {*} val The value to stringify.
     * @param {object} [options] Options object.
     * @param {boolean} [options.ignoreCase] Whether to convert all string
     * values to lower case before stringifying.
     * @param {WeakSet} [options.processed] WeakSet tracking visited objects.
     * @param {boolean} [options.orderMatters] Whether to preserve array order
     * during stringification.
     * @returns {string} A stable string representation.
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
        return Utilities.stableStringify(`${type}:${newString}`, {
          ignoreCase,
          processed: seen,
        });
      }

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
      return urlString.replace(/\/+(?=($|[?#]))/, "");
    },

    /**
     * Build a unique string to represent a class instance or options set.
     * @param {object} options The object containing key values.
     * @param {string[]} keys Field names required to build the key.
     * @param {object} [normalizers] Optional field normalizers.
     * @param {string} [separator] Separator to use between key parts.
     * @param {boolean} [encode] Whether to md5-encode the key.
     * @returns {string} The generated instance key.
     * @throws {Error} If keys is not a non-empty array.
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
     * @param {object} [options] Options passed to the class constructor.
     * @param {Function} buildInstanceKey Function that builds a unique key.
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
     * Read a MetacatUI property directly, via Backbone's `get`, or from a
     * nested appModel.
     * @param {string} property Property name to retrieve.
     * @param {object} [app] MetacatUI object.
     * @returns {*} Property value, or `undefined` when not present.
     */
    getMetacatUIProperty(property, app) {
      const normalizedApp = app || globalThis.MetacatUI?.appModel;
      if (!normalizedApp || !property) return undefined;

      if (normalizedApp[property] !== undefined) {
        return normalizedApp[property];
      }

      if (typeof normalizedApp.get === "function") {
        const value = normalizedApp.get(property);
        if (value !== undefined) return value;
      }

      return normalizedApp.appModel
        ? Utilities.getMetacatUIProperty(property, normalizedApp.appModel)
        : undefined;
    },

    /**
     * Wait for the global MetacatUI object to be available, and optionally for
     * a specific property on it to be defined.
     * @param {object} [options] Options object.
     * @param {number} [options.maxAttempts] Maximum number of attempts.
     * @param {number} [options.delay] Delay between attempts in ms.
     * @param {string} [options.property] Optional property name to wait for.
     * @param {string} [options.appName] Optional MetacatUI property containing
     * the object to wait for.
     * @returns {Promise<*>} Promise resolving to the requested global object or
     * property value.
     * @throws {Error} If the requested value is not available in time.
     * @since 0.0.0
     */
    async awaitMetacatUI({
      maxAttempts = 20,
      delay = 200,
      property = "",
      appName = "",
    } = {}) {
      let attempts = 0;
      while (attempts < maxAttempts) {
        attempts += 1;
        const app = appName
          ? globalThis.MetacatUI?.[appName]
          : globalThis.MetacatUI;

        if (app != null) {
          if (!property) {
            return app;
          }

          const value = Utilities.getMetacatUIProperty(property, app);
          if (value !== undefined) {
            return value;
          }
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }

      let message = "Unable to retrieve MetacatUI";
      if (property) {
        message += `.${property}`;
      }
      throw new Error(message);
    },

    /**
     * Removes default values from a model's JSON representation
     * @param {Backbone.Model} model - The model to remove defaults from
     * @param {string[]} [removeProps] - Additional properties to remove
     * @returns {object} The JSON representation with defaults removed
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
     * Convert a wildcard pattern to a safe RegExp.
     * @param {string} pattern - A simple wildcard pattern
     * @returns {RegExp} Regex for case-insensitive matching
     */
    wildcardToRegex(pattern) {
      const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
      const regexString = `^${escaped.replace(/\*/g, ".*")}$`;
      return new RegExp(regexString, "i");
    },

    /**
     * Get a value from a plain object using a case-insensitive key.
     * @param {object} obj Source object
     * @param {string} keyName Key name to look up
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

    /**
     * Get the list of object formats from the Coordinating Node.
     * @returns {Promise<ObjectFormats>} Promise resolving to the object
     * formats collection.
     * @since 0.0.0
     */
    async awaitObjectFormats() {
      const app = await Utilities.awaitMetacatUI();
      if (!app.objectFormats) app.objectFormats = new ObjectFormats();
      const formats = app.objectFormats;
      if (formats.hasRemoteFormats || formats.isFetching) return formats;

      const listener = new Backbone.Model();
      const finish = () => {
        listener.stopListening();
        formats.isFetching = false;
      };

      listener.listenToOnce(formats, "sync", () => {
        Object.assign(formats, {
          hasRemoteFormats: true,
          usingFallback: false,
          lastFetchError: null,
        });
        finish();
      });
      listener.listenToOnce(formats, "error", (_collection, response) => {
        const errText =
          response?.responseText || response?.status || "Unknown error";
        formats.lastFetchError = new Error(
          `Failed to fetch object formats: ${errText}`,
        );
        finish();
      });

      if (typeof formats.fetch !== "function") {
        finish();
        return formats;
      }

      formats.isFetching = true;
      try {
        formats.fetch();
      } catch (error) {
        formats.lastFetchError = error;
        finish();
      }

      return formats;
    },
  };

  return Utilities;
});
