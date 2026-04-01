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
     * @param {object} [extra] Additional fields to include on the error.
     * @returns {{field:string, message:string}} Validation error.
     */
    createValidationError(field, message, extra = {}) {
      return { field, message, ...extra };
    },

    /**
     * Create a structured validation issue with optional metadata such as
     * severity, code, and field name.
     * @param {object} [options] Validation issue options.
     * @param {string|null} [options.field] Field path related to the issue.
     * @param {string} [options.message] Human-readable issue message.
     * @param {string} [options.severity] Severity label.
     * @param {string|null} [options.code] Stable issue code.
     * @returns {object} Validation issue object.
     */
    createValidationIssue({
      field = null,
      message = "",
      severity = "error",
      code = null,
      ...extra
    } = {}) {
      return {
        field,
        message,
        severity,
        code,
        ...extra,
      };
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

    /**
     * Build a report object from validation issues.
     * @param {Array<object>} issues Validation issues.
     * @returns {{valid:boolean, issues:Array<object>, errors:Array<object>,
     * warnings:Array<object>}} Validation report.
     */
    createValidationReport(issues) {
      const normalizedIssues =
        ValidationUtilities.cloneValidationErrors(issues);
      const errors = normalizedIssues.filter(
        (issue) => (issue?.severity || "error") === "error",
      );
      const warnings = normalizedIssues.filter(
        (issue) => issue?.severity === "warning",
      );

      return {
        valid: errors.length === 0,
        issues: normalizedIssues,
        errors,
        warnings,
      };
    },

    /**
     * Create an Error that carries cloned validation errors.
     * @param {string} message Error message.
     * @param {Array<object>} [validationErrors] Validation errors to attach.
     * @param {object} [extra] Additional fields to assign to the error.
     * @returns {Error} Error with `validationErrors`.
     */
    createValidationException(message, validationErrors = [], extra = {}) {
      const error = new Error(message);
      Object.assign(error, extra);
      error.validationErrors =
        ValidationUtilities.cloneValidationErrors(validationErrors);
      return error;
    },
  };

  return ValidationUtilities;
});
