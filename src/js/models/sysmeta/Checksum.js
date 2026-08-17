define([
  "common/XMLUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
], (XMLUtilities, ValueUtilities, ValidationUtilities) => {
  const { normalizeText, isNonEmptyString } = ValueUtilities;
  const { createValidationIssue } = ValidationUtilities;

  /**
   * Checksum value object for System Metadata.
   * @class Checksum
   * @since 0.0.0
   */
  class Checksum {
    /**
     * Create a Checksum instance.
     * @param {object} [data] Initial checksum values.
     * @param {string|null} [data.value] Checksum value.
     * @param {string|null} [data.algorithm] Checksum algorithm.
     */
    constructor(data = {}) {
      this.value = normalizeText(data.value);
      this.algorithm = normalizeText(data.algorithm);
    }

    /**
     * Create a Checksum from a `checksum` XML element.
     * @param {Element} element XML element to parse.
     * @returns {Checksum} Parsed checksum instance.
     */
    static fromElement(element) {
      const context = "Checksum XML";
      XMLUtilities.requireAllowedAttributeNames(
        element,
        ["algorithm"],
        context,
      );
      return new Checksum({
        value: element?.textContent?.trim() || null,
        algorithm: XMLUtilities.getRequiredAttribute(
          element,
          "algorithm",
          context,
        ),
      });
    }

    /**
     * Parse a `checksum` XML element.
     * @param {Element|null} element XML element to parse.
     * @returns {Checksum} Parsed checksum instance.
     */
    static parse(element) {
      if (!element) return new Checksum();
      return Checksum.fromElement(element);
    }

    /**
     * Coerce unknown input into a Checksum instance.
     * @param {Checksum|object|null|undefined} value Checksum-like input.
     * @returns {Checksum} Normalized checksum instance.
     */
    static fromValue(value) {
      if (value === undefined || value === null) return new Checksum();
      return value instanceof Checksum
        ? new Checksum(value.toJSON() || {})
        : new Checksum(value);
    }

    /**
     * Set the checksum value and algorithm.
     * @param {string|null} value Checksum value.
     * @param {string|null} algorithm Checksum algorithm.
     * @returns {Checksum} The same checksum instance.
     */
    set(value, algorithm) {
      this.value = normalizeText(value);
      this.algorithm = normalizeText(algorithm);
      return this;
    }

    /**
     * Clear the checksum value and algorithm.
     * @returns {Checksum} The same checksum instance.
     */
    clear() {
      this.value = null;
      this.algorithm = null;
      return this;
    }

    /**
     * Normalize the checksum in place.
     * @returns {Checksum} The same checksum instance.
     */
    normalize() {
      this.value = normalizeText(this.value);
      this.algorithm = normalizeText(this.algorithm);
      return this;
    }

    /**
     * Whether the checksum is empty.
     * @returns {boolean} `true` when neither value nor algorithm is present.
     */
    isEmpty() {
      return this.value === null && this.algorithm === null;
    }

    /**
     * Validate the checksum state.
     * @param {string} [path] Base path used in validation errors.
     * @returns {Array<object>} Validation errors for invalid fields.
     */
    validate(path = "checksum") {
      const errors = [];

      if (!isNonEmptyString(this.value)) {
        errors.push(
          createValidationIssue({
            field: `${path}.value`,
            message:
              "checksum value is required and must be a non-empty string.",
          }),
        );
      }

      if (!isNonEmptyString(this.algorithm)) {
        errors.push(
          createValidationIssue({
            field: `${path}.algorithm`,
            message:
              "checksum algorithm is required and must be a non-empty string.",
          }),
        );
      }

      return errors;
    }

    /**
     * Serialize the checksum to XML.
     * @param {XMLDocument} doc XML document used to create elements.
     * @returns {Element|null} Serialized XML element, or `null` when empty.
     */
    toElement(doc) {
      if (this.isEmpty()) return null;

      const element = doc.createElement("checksum");
      if (this.algorithm !== null) {
        element.setAttribute("algorithm", this.algorithm);
      }
      if (this.value !== null) {
        element.textContent = XMLUtilities.removeInvalidXmlCharacters(
          this.value,
        );
      }
      return element;
    }

    /**
     * Return a JSON-serializable representation of the checksum.
     * @returns {object|null} Plain checksum data, or `null` when empty.
     */
    toJSON() {
      if (this.isEmpty()) return null;
      return {
        value: this.value,
        algorithm: this.algorithm,
      };
    }
  }

  return Checksum;
});
