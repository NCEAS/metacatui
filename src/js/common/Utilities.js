/*global define */
define(["jquery", "underscore"], function ($, _) {
  "use strict";

  /**
   * @namespace Utilities
   * @description A generic utility object that contains functions used throughout MetacatUI to perform useful functions,
   * but not used to store or manipulate any state about the application.
   * @type {object}
   * @since 2.14.0
   */
  var Utilities = /** @lends Utilities.prototype */ {
    /**
     * HTML-encodes the given string so it can be inserted into an HTML page without running
     * any embedded Javascript.
     * @param {string} s
     * @returns {string}
     */
    encodeHTML: function (s) {
      try {
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
      } catch (e) {
        console.error("Could not encode HTML: ", e);
        return "";
      }
    },

    /**
     * Validates that the given string is a valid DOI
     * @param {string} identifier
     * @returns {boolean}
     * @since 2.15.0
     */
    isValidDOI: function (identifier) {
      // generate doi regex
      var doiRGEX = new RegExp(
        /^\s*(http:\/\/|https:\/\/)?(doi.org\/|dx.doi.org\/)?(doi: ?|DOI: ?)?(10\.\d{4,}(\.\d)*)\/(\w+).*$/gi,
      );

      return doiRGEX.test(identifier);
    },

    /**
     * Read the first part of a file
     *
     * @param {File} file - A reference to a file
     * @param {Backbone.View} context - The View to bind `callback` to
     * @param {function} callback - A function to run after the read is
     *   complete. The function is bound to `context`.
     * @param {number} bytes - The number of bytes to read from the start of the
     *   file
     * @since 2.15.0
     */
    readSlice: function (file, context, callback, bytes = 1024) {
      if (typeof callback !== "function") {
        return;
      }

      var reader = new FileReader(),
        blob = file.slice(0, bytes);

      reader.onloadend = callback.bind(context);
      reader.readAsBinaryString(blob);
    },
    /**
     * Attempt to parse the header/column names from a chunk of a CSV file
     *
     * Doesn't handle:
     * - UTF BOM (garbles first col name)
     * - Commas inside quoted headers
     *
     * @param {string} text - A chunk of a file
     * @return {Array} A list of names
     * @since 2.15.0
     */
    tryParseCSVHeader: function (text) {
      // The order is important here
      var strategies = ["\r\\n", "\r", "\n"];

      var index = -1;

      for (var i = 1; i < strategies.length; i++) {
        var result = text.indexOf(strategies[i]);

        if (result >= 0) {
          index = result;

          break;
        }
      }

      if (index === -1) {
        return [];
      }

      var header_line = text.slice(0, index);
      var names = header_line.split(",");

      // Remove surrounding parens and double-quotes
      names = names.map(function (name) {
        return name.replaceAll(/^["']|["']$/gm, "");
      });

      // Filter out zero-length values (headers like a,b,c,,,,,)
      names = names.filter(function (name) {
        return name.length > 0;
      });

      return names;
    },
  };

  return Utilities;
});
