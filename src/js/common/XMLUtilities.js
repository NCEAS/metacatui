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
  };

  return XMLUtilities;
});
