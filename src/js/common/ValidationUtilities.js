"use strict";

define(["common/ValueUtilities", "common/DateUtilities"], (
  ValueUtilities,
  DateUtilities,
) => {
  const { isNonEmptyString, isNonNegativeInteger } = ValueUtilities;
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
     * Append one parse warning in the shared validation-error shape.
     * @param {Array<object>} parseWarnings Target parse-warning array.
     * @param {string} field Field path.
     * @param {string} message Warning message.
     * @param {object} [extra] Additional warning fields.
     * @returns {object|null} The warning that was pushed, or null when the
     * target is not an array.
     */
    addParseWarning(parseWarnings, field, message, extra = {}) {
      if (!Array.isArray(parseWarnings)) return null;
      const warning = ValidationUtilities.createValidationError(
        field,
        message,
        extra,
      );
      parseWarnings.push(warning);
      return warning;
    },

    /**
     * Return a parsed value when valid, otherwise push one parse warning and
     * fall back to a safe replacement.
     * @param {object} options Salvage options.
     * @param {*} options.value Parsed candidate value.
     * @param {string} options.path Field path used in warnings and validation.
     * @param {Array<object>} [options.parseWarnings] Lossy parse warnings.
     * @param {string} options.invalidMessage Warning message for invalid input.
     * @param {Function} options.validate Validation callback that returns
     * issues.
     * @param {Function} options.fallback Fallback callback that returns the
     * replacement value.
     * @returns {*} The original value when valid, otherwise the fallback value.
     */
    fixParsedValue({
      value,
      path,
      parseWarnings = [],
      invalidMessage,
      validate,
      fallback,
    } = {}) {
      const issues = typeof validate === "function" ? validate(value) : [];
      if (!issues?.length) return value;

      ValidationUtilities.addParseWarning(parseWarnings, path, invalidMessage);
      return typeof fallback === "function" ? fallback() : undefined;
    },

    /**
     * Validate a text value.
     * @param {*} value Candidate value.
     * @param {object} [options] Validation options.
     * @param {string} [options.field] Field path.
     * @param {boolean} [options.required] Whether the value is required.
     * @param {boolean} [options.nonEmptyWhenPresent] Whether present values
     * must be non-empty strings.
     * @param {string} [options.requiredMessage] Optional required-field message.
     * @param {string} [options.invalidMessage] Optional invalid-field message.
     * @returns {Array<object>} Validation issues.
     */
    validateText(
      value,
      {
        field = "value",
        required = false,
        nonEmptyWhenPresent = true,
        requiredMessage = `${field} is required and must be a non-empty string.`,
        invalidMessage = `${field} must be a non-empty string when present.`,
      } = {},
    ) {
      const issues = [];

      if (required && !isNonEmptyString(value)) {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: requiredMessage,
          }),
        );
        return issues;
      }

      if (
        nonEmptyWhenPresent &&
        value !== null &&
        value !== undefined &&
        !isNonEmptyString(value)
      ) {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: invalidMessage,
          }),
        );
      }

      return issues;
    },

    /**
     * Validate a boolean value.
     * @param {*} value Candidate value.
     * @param {object} [options] Validation options.
     * @param {string} [options.field] Field path.
     * @param {boolean} [options.required] Whether the value is required.
     * @param {string} [options.requiredMessage] Optional required-field message.
     * @param {string} [options.invalidMessage] Optional invalid-field message.
     * @returns {Array<object>} Validation issues.
     */
    validateBoolean(
      value,
      {
        field = "value",
        required = false,
        requiredMessage = `${field} is required and must be a boolean.`,
        invalidMessage = `${field} must be a boolean when present.`,
      } = {},
    ) {
      const issues = [];

      if (required && typeof value !== "boolean") {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: requiredMessage,
          }),
        );
        return issues;
      }

      if (value !== null && value !== undefined && typeof value !== "boolean") {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: invalidMessage,
          }),
        );
      }

      return issues;
    },

    /**
     * Validate a non-negative integer value.
     * @param {*} value Candidate value.
     * @param {object} [options] Validation options.
     * @param {string} [options.field] Field path.
     * @param {boolean} [options.required] Whether the value is required.
     * @param {string} [options.requiredMessage] Optional required-field message.
     * @param {string} [options.invalidMessage] Optional invalid-field message.
     * @returns {Array<object>} Validation issues.
     */
    validateInteger(
      value,
      {
        field = "value",
        required = false,
        requiredMessage = `${field} is required and must be a non-negative integer.`,
        invalidMessage = `${field} must be a non-negative integer when present.`,
      } = {},
    ) {
      const issues = [];

      if (required && !isNonNegativeInteger(value)) {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: requiredMessage,
          }),
        );
        return issues;
      }

      if (
        value !== null &&
        value !== undefined &&
        !isNonNegativeInteger(value)
      ) {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: invalidMessage,
          }),
        );
      }

      return issues;
    },

    /**
     * Validate a date value.
     * @param {*} value Candidate value.
     * @param {object} [options] Validation options.
     * @param {string} [options.field] Field path.
     * @param {boolean} [options.required] Whether the value is required.
     * @param {string} [options.requiredMessage] Optional required-field message.
     * @param {string} [options.invalidMessage] Optional invalid-field message.
     * @returns {Array<object>} Validation issues.
     */
    validateDate(
      value,
      {
        field = "value",
        required = false,
        requiredMessage = `${field} is required and must be a valid date.`,
        invalidMessage = `${field} must be a valid date.`,
      } = {},
    ) {
      const issues = [];

      if (required && !DateUtilities.isValidDate(value)) {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: requiredMessage,
          }),
        );
        return issues;
      }

      if (
        value !== null &&
        value !== undefined &&
        !DateUtilities.isValidDate(value)
      ) {
        issues.push(
          ValidationUtilities.createValidationIssue({
            field,
            message: invalidMessage,
          }),
        );
      }

      return issues;
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
