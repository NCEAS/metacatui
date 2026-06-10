"use strict";

define(["backbone", "collections/ObjectFormats"], (Backbone, ObjectFormats) => {
  const FORMAT_MAP = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "Microsoft Excel OpenXML",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "Microsoft Word OpenXML",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12":
      "Microsoft Office Excel 2007 binary workbooks",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "Microsoft Office OpenXML Presentation",
    "application/vnd.ms-excel": "Microsoft Excel",
    "application/msword": "Microsoft Word",
    "application/vnd.ms-powerpoint": "Microsoft Powerpoint",
    "text/html": "HTML",
    "text/plain": "plain text (.txt)",
    "video/avi": "Microsoft AVI file",
    "video/x-ms-wmv": "Windows Media Video (.wmv)",
    "audio/x-ms-wma": "Windows Media Audio (.wma)",
    "application/vnd.google-earth.kml xml":
      "Google Earth Keyhole Markup Language (KML)",
    "http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html":
      "annotation",
    "application/mathematica": "Mathematica Notebook",
    "application/postscript": "Postscript",
    "application/rtf": "Rich Text Format (RTF)",
    "application/xml": "XML Application",
    "text/xml": "XML",
    "application/x-fasta": "FASTA sequence file",
    "nexus/1997": "NEXUS File Format for Systematic Information",
    "anvl/erc-v02":
      "Kernel Metadata and Electronic Resource Citations (ERCs), 2010.05.13",
    "http://purl.org/dryad/terms/":
      "Dryad Metadata Application Profile Version 3.0",
    "http://datadryad.org/profile/v3.1":
      "Dryad Metadata Application Profile Version 3.1",
    "application/pdf": "PDF",
    "application/zip": "ZIP file",
    "http://www.w3.org/TR/rdf-syntax-grammar": "RDF/XML",
    "http://www.w3.org/TR/rdfa-syntax": "RDFa",
    "application/rdf xml": "RDF",
    "text/turtle": "TURTLE",
    "text/n3": "N3",
    "application/x-gzip": "GZIP Format",
    "application/x-python": "Python script",
    "http://www.w3.org/2005/Atom": "ATOM-1.0",
    "application/octet-stream": "octet stream (application file)",
    "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd":
      "Darwin Core, v2.0",
    "http://rs.tdwg.org/dwc/xsd/simpledarwincore/": "Simple Darwin Core",
    "eml://ecoinformatics.org/eml-2.1.0": "EML v2.1.0",
    "eml://ecoinformatics.org/eml-2.1.1": "EML v2.1.1",
    "eml://ecoinformatics.org/eml-2.0.1": "EML v2.0.1",
    "eml://ecoinformatics.org/eml-2.0.0": "EML v2.0.0",
    "https://eml.ecoinformatics.org/eml-2.2.0": "EML v2.2.0",
  };
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
     * @returns {Promise<Array>} Promise resolving to the list of object
     *  formats.
     * @throws {Error} If the object formats cannot be retrieved.
     * @since 0.0.0
     */
    async awaitObjectFormats() {
      const app = await this.awaitMetacatUI();
      // Ensure the object formats are cached
      if (!app.objectFormats) {
        app.objectFormats = new ObjectFormats();
      }

      if (app.objectFormats.length) {
        return app.objectFormats.toJSON();
      }

      const listener = new Backbone.Model();
      const fetchFormats = new Promise((resolve, reject) => {
        listener.listenToOnce(app.objectFormats, "sync", () => {
          listener.stopListening();
          resolve();
        });
        listener.listenToOnce(
          app.objectFormats,
          "error",
          (_collection, response) => {
            listener.stopListening();
            reject(
              new Error(
                `Failed to fetch object formats: ${response?.status || ""} ${response?.statusText || ""}`.trim(),
              ),
            );
          },
        );
        // eslint-disable-next-line no-underscore-dangle
        if (!app.objectFormats._events?.sync) {
          app.objectFormats.fetch();
        }
      });
      await fetchFormats;
      return app.objectFormats.toJSON();
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
      return FORMAT_MAP[formatId] || formatId;
    },
  };

  return Utilities;
});
