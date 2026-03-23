define([
  "common/XMLUtilities",
  "models/sysmeta/MediaTypeProperty",
  "common/ValueUtilities",
  "common/ValidationUtilities",
], (
  XMLUtilities,
  MediaTypeProperty,
  ValueUtilities,
  ValidationUtilities,
) => {
  const { normalizeText, isNonEmptyString } = ValueUtilities;
  const { createValidationError } = ValidationUtilities;
  const MEDIA_TYPE_CHILD_SEQUENCE = [
    { name: "property", minOccurs: 0, maxOccurs: Infinity },
  ];

  /**
   * Media type value object for System Metadata.
   * @class MediaType
   * @since 0.0.0
   */
  class MediaType {
    /**
     * Create a MediaType instance.
     * @param {object|string} [data] Initial media type values or name.
     * @param {string|null} [data.name] Media type name.
     * @param {Array<MediaTypeProperty|object>} [data.properties] Media type
     * properties.
     */
    constructor(data = {}) {
      const normalizedData =
        typeof data === "string" ? { name: data } : { ...data };
      const properties = Array.isArray(normalizedData.properties)
        ? normalizedData.properties
        : [];

      this.name = normalizeText(normalizedData.name);
      this.properties = Array.from(properties).map((property) =>
        property instanceof MediaTypeProperty
          ? new MediaTypeProperty(property.toJSON())
          : new MediaTypeProperty(property),
      );
    }

    /**
     * Create a MediaType from a `mediaType` XML element.
     * @param {Element} element XML element to parse.
     * @returns {MediaType} Parsed media type instance.
     */
    static fromElement(element) {
      const context = "MediaType XML";
      XMLUtilities.requireAllowedAttributeNames(element, ["name"], context);
      XMLUtilities.getRequiredAttribute(element, "name", context);
      XMLUtilities.requireDirectChildSequence(
        element,
        MEDIA_TYPE_CHILD_SEQUENCE,
        context,
      );

      return new MediaType({
        name: element.getAttribute("name"),
        properties: XMLUtilities.findDirectChildElements(element, "property").map(
          (property) => MediaTypeProperty.fromElement(property),
        ),
      });
    }

    /**
     * Coerce unknown input into a MediaType instance.
     * @param {MediaType|object|string|null|undefined} value Media type-like
     * input.
     * @returns {MediaType|null} Normalized media type or `null` when empty.
     */
    static fromValue(value) {
      if (value === undefined || value === null) return null;

      const mediaType =
        value instanceof MediaType
          ? new MediaType(value.toJSON())
          : new MediaType(value);

      return mediaType.isEmpty() ? null : mediaType;
    }

    /**
     * Return the media type properties array for legacy callers.
     * @returns {Array<MediaTypeProperty>} Media type properties.
     */
    get property() {
      return this.properties;
    }

    /**
     * Whether the media type has any serializable values.
     * @returns {boolean} `true` when the media type is empty.
     */
    isEmpty() {
      return this.name === null && this.properties.length === 0;
    }

    /**
     * Validate the media type state.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `mediaType`.
     * @returns {Array<object>} Validation errors for invalid fields.
     */
    validate(path = "mediaType") {
      const errors = [];

      if (!isNonEmptyString(this.name)) {
        errors.push(
          createValidationError(
            `${path}.name`,
            "mediaType requires a non-empty name attribute.",
          ),
        );
      }

      this.properties.forEach((property, index) => {
        errors.push(...property.validate(`${path}.property[${index}]`));
      });

      return errors;
    }

    /**
     * Serialize the media type to XML.
     * @param {XMLDocument} doc XML document used to create elements.
     * @returns {Element|null} Serialized XML element, or `null` when empty.
     */
    toElement(doc) {
      if (this.isEmpty()) return null;

      const element = doc.createElement("mediaType");
      if (this.name !== null) {
        element.setAttribute("name", this.name);
      }

      this.properties.forEach((property) => {
        element.appendChild(property.toElement(doc));
      });

      return element;
    }

    /**
     * Return a JSON-serializable representation of the media type.
     * @returns {object} Plain media type data.
     */
    toJSON() {
      return {
        name: this.name,
        properties: this.properties.map((property) => property.toJSON()),
      };
    }
  }

  return MediaType;
});
