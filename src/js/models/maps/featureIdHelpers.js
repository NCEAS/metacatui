"use strict";

/**
 * Pure helpers for extracting stable identifiers from feature property objects.
 * Used by map asset models (CesiumVectorData, Cesium3DTileset) to encode feature
 * IDs in the URL and restore them on page load.
 * @module featureIdHelpers
 * @classcategory Models/Maps
 * @since 0.0.0
 */
define([], () => {
  /** Property keys checked in priority order when deriving a stable feature ID. */
  const FEATURE_ID_KEYS = [
    "id",
    "identifier",
    "uuid",
    "name",
    "title",
    "label",
  ];

  /**
   * Convert all keys in an object to lowercase.
   * @param {object} props The object to convert.
   * @returns {object} copy with all keys lowercased
   */
  function toLowerCaseProps(props) {
    const lower = {};
    Object.keys(props || {}).forEach((k) => {
      lower[k.toLowerCase()] = props[k];
    });
    return lower;
  }

  /**
   * Return the first non-empty string value found under a FEATURE_ID_KEYS key.
   * @param {object} props Feature properties (any key casing).
   * @returns {string|null} The feature ID, or null if none is found.
   */
  function getIdFromProperties(props) {
    const lower = toLowerCaseProps(props);
    const key = FEATURE_ID_KEYS.find((k) => {
      const val = lower[k];
      return val != null && String(val).trim().length > 0;
    });
    return key != null ? String(lower[key]) : null;
  }

  /**
   * Return true if any FEATURE_ID_KEYS property in props equals id.
   * @param {object} props Feature properties (any key casing).
   * @param {string} id The feature ID to match.
   * @returns {boolean} True if a match is found, false otherwise.
   */
  function propertyMatchesId(props, id) {
    const lower = toLowerCaseProps(props);
    return FEATURE_ID_KEYS.some((key) => {
      const val = lower[key];
      return val != null && String(val) === id;
    });
  }

  return { FEATURE_ID_KEYS, getIdFromProperties, propertyMatchesId };
});
