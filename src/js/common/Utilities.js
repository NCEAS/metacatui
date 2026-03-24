"use strict";

define(["collections/ObjectFormats"], (ObjectFormats) => {
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
        .replace(/\//g, "/")
        .replace(/"/g, "&quot;");
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
     * @since 0.0.0
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
     * Get the list of object formats from the Coordinating Node, which can be
     * used to validate media types against known formats.
     * @returns {Promise<Array>} Promise resolving to the list of object
     *  formats.
     * @throws {Error} If the object formats cannot be retrieved.
     * @since 0.0.0
     */
    async getObjectFormats() {
      const MetacatUI = await this.awaitMetacatUI();
      // Ensure the object formats are cached
      if (!MetacatUI.objectFormats) {
        MetacatUI.objectFormats = new ObjectFormats();
      }

      const listener = new Backbone.Model();

      const fetchFormats = new Promise((resolve, reject) => {
        if (MetacatUI.objectFormats.length) {
          resolve();
        }
        listener.listenToOnce(MetacatUI.objectFormats, "sync", () => {
          listener.stopListening();
          resolve();
        });
        listener.listenToOnce(
          MetacatUI.objectFormats,
          "error",
          (_collection, response) => {
            listener.stopListening();
            reject(
              new Error(
                `Failed to fetch object formats: ${response.status} ${response.statusText}`,
              ),
            );
          },
        );
        // eslint-disable-next-line no-underscore-dangle
        if (!MetacatUI.objectFormats._events?.sync) {
          MetacatUI.objectFormats.fetch();
        }
      });
      await fetchFormats;
      return MetacatUI.objectFormats.toJSON();
    },
  };

  return Utilities;
});
