"use strict";

define(["backbone", "collections/ObjectFormats", "common/ValueUtilities"], (
  Backbone,
  ObjectFormats,
  ValueUtilities,
) => {
  const DEFAULT_MAX_CONCURRENT = 4;

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
     * @param {string} appModelKey App model setting key (e.g. "batchSizeFetch").
     * @param {number} [maxConcurrent] Caller-provided limit; falls back to the
     *   app setting, then {@link Utilities.DEFAULT_MAX_CONCURRENT}.
     * @returns {number} Positive integer limit.
     * @since 0.0.0
     */
    resolveMaxConcurrent(
      appModelKey,
      maxConcurrent = ValueUtilities.normalizePositiveInteger(
        globalThis.MetacatUI?.appModel?.get?.(appModelKey),
        DEFAULT_MAX_CONCURRENT,
      ),
    ) {
      return ValueUtilities.requirePositiveInteger(
        maxConcurrent,
        "maxConcurrent must be a positive integer",
      );
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
          // If we're just waiting for the global object, return it now
          if (!property) {
            return app;
          }

          const value = Utilities.getMetacatUIProperty(property, app);
          // If we're waiting for a specific property, check if it's defined
          // yet and if not, continue waiting
          if (value !== undefined) {
            return value;
          }
        }
        // Otherwise, wait the attempt delay and try again.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
      }

      // If we reach here, we failed to get the requested MetacatUI value.
      let message = "Unable to retrieve MetacatUI";
      if (property) {
        message += `.${property}`;
      }
      throw new Error(message);
    },

    /**
     * Get the list of object formats from the Coordinating Node, which can be
     * used to validate media types against known formats.
     * @returns {Promise<ObjectFormats>} Promise resolving to the local object
     *  formats collection. The collection starts with built-in fallback formats
     *  and starts a background refresh from the formats service when possible.
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

    /**
     * Convert a format ID into a human-readable format name, if possible. If
     * the format ID is not in the map, returns the original format ID.
     * @param {string} formatId Format ID to convert.
     * @returns {string} Human-readable format name, or original format ID if
     * not found in the map.
     * @since 0.0.0
     */
    getFriendlyFormat(formatId) {
      return ObjectFormats.getFriendlyFormat(formatId);
    },
  };

  return Utilities;
});
