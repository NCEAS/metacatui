define([
  "common/XMLUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
], (XMLUtilities, ValueUtilities, ValidationUtilities) => {
  const { normalizeText, isNonEmptyString } = ValueUtilities;
  const { fixParsedValue, addParseWarning, createValidationIssue } =
    ValidationUtilities;
  const MEDIA_TYPE_PROPERTY_CHILD_SEQUENCE = [];

  /**
   * Media type property value object for System Metadata.
   * @class MediaTypeProperty
   * @since 0.0.0
   */
  class MediaTypeProperty {
    /**
     * Create a MediaTypeProperty instance.
     * @param {object} [data] Initial property values.
     * @param {string|null} [data.name] Property name.
     * @param {string|null} [data.value] Property value.
     */
    constructor(data = {}) {
      this.name = normalizeText(data.name);
      this.value = normalizeText(data.value);
    }

    /**
     * Create a MediaTypeProperty from a `property` XML element.
     * @param {Element} element XML element to parse.
     * @returns {MediaTypeProperty} Parsed media type property instance.
     */
    static fromElement(element) {
      const context = "MediaTypeProperty XML";
      XMLUtilities.requireAllowedAttributeNames(element, ["name"], context);
      XMLUtilities.getRequiredAttribute(element, "name", context);
      XMLUtilities.requireDirectChildSequence(
        element,
        MEDIA_TYPE_PROPERTY_CHILD_SEQUENCE,
        context,
      );

      return new MediaTypeProperty({
        name: element.getAttribute("name"),
        value: element?.textContent?.trim() || null,
      });
    }

    /**
     * Parse a `property` XML element, dropping it when invalid.
     * Nested child elements are not supported and are treated as lossy input.
     * @param {Element|null} element XML element to parse.
     * @param {Array<object>} [parseWarnings] Lossy parse warnings.
     * @param {string} [path] Field path used in warnings and validation.
     * @returns {MediaTypeProperty|null} Parsed property or null when invalid.
     */
    static parse(element, parseWarnings = [], path = "mediaType.properties") {
      if (!element) return null;

      if (Array.from(element?.children || []).length > 0) {
        addParseWarning(
          parseWarnings,
          path,
          "Ignored invalid mediaType property while parsing system metadata.",
        );
        return null;
      }

      const property = new MediaTypeProperty({
        name: element.getAttribute("name"),
        value: element?.textContent?.trim() || null,
      });
      return fixParsedValue({
        value: property,
        path,
        parseWarnings,
        invalidMessage:
          "Ignored invalid mediaType property while parsing system metadata.",
        validate: (candidate) => candidate.validate(path),
        fallback: () => null,
      });
    }

    /**
     * Validate the media type property state.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `mediaType.property`.
     * @returns {Array<object>} Validation errors for invalid fields.
     */
    validate(path = "mediaType.property") {
      const errors = [];
      if (!isNonEmptyString(this.name)) {
        errors.push(
          createValidationIssue({
            field: `${path}.name`,
            message: "Media type property names are required.",
          }),
        );
      }
      return errors;
    }

    /**
     * Serialize the media type property to XML.
     * @param {XMLDocument} doc XML document used to create elements.
     * @returns {Element} Serialized XML element.
     */
    toElement(doc) {
      const element = doc.createElement("property");
      if (this.name !== null) {
        element.setAttribute("name", this.name);
      }
      if (this.value !== null) {
        element.textContent = XMLUtilities.removeInvalidXmlCharacters(
          this.value,
        );
      }
      return element;
    }

    /**
     * Return a JSON-serializable representation of the media type property.
     * @returns {object} Plain media type property data.
     */
    toJSON() {
      return {
        name: this.name,
        value: this.value,
      };
    }
  }

  return MediaTypeProperty;
});
