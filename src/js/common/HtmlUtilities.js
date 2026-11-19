"use strict";

define([], () => {
  /**
   * Helpers for working with HTML strings.
   * @namespace HtmlUtilities
   * @classcategory Common
   * @since 2.41.0
   */
  const HtmlUtilities = {
    /**
     * Converts a string that may contain HTML (e.g. `CO<sub>2</sub>`) to plain
     * text. The string is parsed into an inert document, so no scripts run.
     * @param {*} html The string to convert.
     * @returns {string} The text content, with whitespace collapsed.
     */
    htmlToText(html) {
      if (html === null || html === undefined) return "";
      const text = new DOMParser().parseFromString(String(html), "text/html")
        .body.textContent;
      return text.replace(/\s+/g, " ").trim();
    },
  };

  return HtmlUtilities;
});
