"use strict";

define([], () => {
  /**
   * Shared helpers for working with simple validation error objects.
   * @namespace ValidationUtilities
   * @since 0.0.0
   */
  const ValidationUtilities = {
    /**
     * Validate that a string is a DOI.
     * @param {string} identifier Candidate DOI string.
     * @returns {boolean} True when the identifier matches the DOI pattern.
     */
    isValidDOI(identifier) {
      const doiRGEX =
        /^\s*(http:\/\/|https:\/\/)?(doi.org\/|dx.doi.org\/)?(doi: ?|DOI: ?)?(10\.\d{4,}(\.\d)*)\/(\w+).*$/i;

      return doiRGEX.test(identifier);
    },

    /**
     * Create a validation error object.
     * @param {string} field Field path.
     * @param {string} message Error message.
     * @returns {{field:string, message:string}} Validation error.
     */
    createValidationError(field, message) {
      return { field, message };
    },

    /**
     * Clone validation error objects.
     * @param {Array<object>} errors Error objects to clone.
     * @returns {Array<object>} Cloned validation errors.
     */
    cloneValidationErrors(errors) {
      if (!Array.isArray(errors)) return [];
      return errors.map((error) => ({ ...error }));
    },
  };

  return ValidationUtilities;
});
