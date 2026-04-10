"use strict";

define([
  "common/DateUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
], (DateUtilities, ValueUtilities, ValidationUtilities) => {
  const {
    normalizeBoolean,
    normalizeInteger,
    normalizeText,
    serializeBoolean,
    serializeInteger,
    serializeText,
  } = ValueUtilities;
  const { validateBoolean, validateDate, validateInteger, validateText } =
    ValidationUtilities;

  /**
   * Shared type registry for basic XML value fields.
   * @namespace XMLTypes
   * @since 0.0.0
   */
  return {
    text: {
      normalize: normalizeText,
      serialize: serializeText,
      validate(value, options = {}) {
        return validateText(value, options);
      },
    },

    integer: {
      normalize: normalizeInteger,
      serialize: serializeInteger,
      validate(value, options = {}) {
        return validateInteger(value, options);
      },
    },

    boolean: {
      normalize: normalizeBoolean,
      serialize: serializeBoolean,
      validate(value, options = {}) {
        return validateBoolean(value, options);
      },
    },

    date: {
      normalize(value) {
        return DateUtilities.toDate(value) || value;
      },
      serialize(value) {
        return DateUtilities.toXmlDateTimeString(value) || null;
      },
      validate(value, options = {}) {
        return validateDate(value, options);
      },
    },
  };
});
