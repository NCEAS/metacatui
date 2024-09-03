"use strict";

define([], () => {
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
     * @since 0.0.0
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
     * Removes default values from a model's JSON representation
     * @param {Backbone.Model} model - The model to remove defaults from
     * @param {string[]} [removeProps] - An array of additional properties to remove from the model
     * @returns {object} The JSON representation of the model with defaults removed
     * @since 0.0.0
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
  };

  return Utilities;
});
