"use strict";

define([], () => {
  /**
   * @namespace XMLUtilities
   * @description A generic utility object that contains functions used
   * throughout MetacatUI to perform useful functions related to XML, but not
   * used to store or manipulate any state about the application.
   * @type {object}
   * @since 2.33.0
   */
  const XMLUtilities = /** @lends XMLUtilities.prototype */ {
    /**
     * Cleans up the given text so that it is XML-valid by escaping reserved
     * characters, trimming white space, etc.
     * @param {string} textString - The string to clean up
     * @returns {string} - The cleaned up string
     */
    cleanXMLText(textString) {
      if (typeof textString !== "string") return null;

      let cleanedText = textString.trim();

      // Check for XML/HTML elements
      const xmlNodes = cleanedText.match(/<\s*[^>]*>/g);
      xmlNodes?.forEach((xmlNode) => {
        // Encode <, >, and </ substrings
        let tagName = xmlNode.replace(/>/g, "&gt;");
        tagName = tagName.replace(/</g, "&lt;");

        // Replace the xmlNode in the full text string
        cleanedText = cleanedText.replace(xmlNode, tagName);
      });

      // Remove Unicode characters that are not valid XML characters Create a
      // regular expression that matches any character that is not a valid XML
      // character (see https://www.w3.org/TR/xml/#charsets)

      const invalidCharsRegEx =
        // eslint-disable-next-line no-control-regex
        /[^\u0009\u000a\u000d\u0020-\uD7FF\uE000-\uFFFD]/g;
      cleanedText = cleanedText.replace(invalidCharsRegEx, "");

      return cleanedText;
    },

    /**
     * Parses the given XML string into an XML Document object
     * @param {string} xmlString - The XML string to parse
     * @returns {Document|null} - The parsed XML Document, or null if parsing
     * failed
     */
    parseXml(xmlString) {
      if (!xmlString) return null;
      try {
        const doc = new DOMParser().parseFromString(
          xmlString,
          "application/xml",
        );
        if (doc.querySelector("parsererror")) return null;
        return doc;
      } catch (_error) {
        return null;
      }
    },

    /**
     * Extracts text content from the given XML string using the provided CSS
     * selectors
     * @param {string} xmlString - The XML string to extract text from
     * @param {string[]} selectors - An array of CSS selectors to use for
     * extracting text. The first selector that matches will be used.
     * @returns {string} - The extracted text, or an empty string if no text
     * was found
     */
    extractText(xmlString, selectors) {
      const xmlDoc = this.parseXml(xmlString);

      // Check for parser errors
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Invalid XML:", parserError.textContent);
      }

      if (!xmlDoc || !Array.isArray(selectors)) return "";

      // Return the first non-empty text found for any selector
      let foundText = "";
      selectors.some((selector) => {
        const text = xmlDoc.querySelector(selector)?.textContent?.trim();
        if (text) {
          foundText = text;
          return true; // exit loop once found
        }
        return false;
      });
      return foundText;
    },
  };

  return XMLUtilities;
});
