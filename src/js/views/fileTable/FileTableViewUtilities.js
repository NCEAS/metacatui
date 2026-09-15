"use strict";

define(["underscore", "semantic"], (_, Semantic) => {
  /**
   * @namespace FileTableViewUtilities
   * @description Shared render helpers for generic file table views
   * @classcategory Views/FileTable
   * @since 0.0.0
   */

  /**
   * Escape text before inserting it into inline template strings.
   * @param {*} value Value to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(value) {
    if (value == null) return "";
    return _.escape(String(value));
  }

  /**
   * Join truthy CSS class names.
   * @param {Array<string>} values CSS class names
   * @returns {string} Class string
   */
  function classNames(values = []) {
    return values.filter(Boolean).join(" ");
  }

  /**
   * Set or remove an attribute based on whether a value is present.
   * @param {jQuery} element Element to update
   * @param {string} name Attribute name
   * @param {*} value Attribute value
   */
  function setOptionalAttribute(element, name, value) {
    if (value == null || value === "") element.removeAttr(name);
    else element.attr(name, value);
  }

  const SEM_VARIATIONS = Semantic.CLASS_NAMES.variations;

  /**
   * Settings passed to the Fomantic UI popup module for file table tooltips.
   * Shared by the row and action views so every tooltip looks and behaves the
   * same.
   * @see https://fomantic-ui.com/modules/popup.html#/settings
   * @type {object}
   */
  const TOOLTIP_SETTINGS = {
    position: "top center",
    on: "hover",
    variation: `${SEM_VARIATIONS.mini} ${SEM_VARIATIONS.inverted}`,
    delay: {
      show: 250,
      hide: 40,
    },
  };

  return {
    classNames,
    escapeHtml,
    setOptionalAttribute,
    TOOLTIP_SETTINGS,
  };
});
