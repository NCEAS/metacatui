"use strict";

/**
 * Converts a string that may contain HTML (e.g. `CO<sub>2</sub>`) to plain
 * text. The string is parsed into an inert document, so no scripts run.
 * @module mapExport/htmlText
 * @since 2.41.0
 */
define([], () => {
  /**
   * @param {*} html The string to convert.
   * @returns {string} The text content, with whitespace collapsed.
   */
  function htmlToText(html) {
    if (html === null || html === undefined) return "";
    const text = new DOMParser().parseFromString(String(html), "text/html")
      .body.textContent;
    return text.replace(/\s+/g, " ").trim();
  }

  return htmlToText;
});
