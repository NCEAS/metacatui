define([
  "common/XMLUtilities",
  "models/sysmeta/MediaTypeProperty",
  "common/ValueUtilities",
  "common/ValidationUtilities",
], (XMLUtilities, MediaTypeProperty, ValueUtilities, ValidationUtilities) => {
  const { normalizeText, isNonEmptyString, requireNonNegativeInteger } =
    ValueUtilities;
  const { fixParsedValue, createValidationIssue } = ValidationUtilities;
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
     * Append one media-type property.
     * @param {MediaTypeProperty|object} property Media-type property to append.
     * @returns {MediaType} The same media type instance.
     */
    add(property) {
      this.properties.push(
        property instanceof MediaTypeProperty
          ? property
          : new MediaTypeProperty(property),
      );
      return this;
    }

    /**
     * Replace one media-type property.
     * @param {number} index Property index to replace.
     * @param {MediaTypeProperty|object} property Replacement property.
     * @returns {MediaType} The same media type instance.
     */
    replace(index, property) {
      const normalizedIndex = requireNonNegativeInteger(index);
      if (normalizedIndex >= this.properties.length) {
        throw new Error(
          `MediaType.replace could not find property at index ${normalizedIndex}.`,
        );
      }
      this.properties[normalizedIndex] =
        property instanceof MediaTypeProperty
          ? property
          : new MediaTypeProperty(property);
      return this;
    }

    /**
     * Remove one media-type property.
     * @param {number} index Property index to remove.
     * @returns {MediaType} The same media type instance.
     */
    remove(index) {
      const normalizedIndex = requireNonNegativeInteger(index);
      if (normalizedIndex >= this.properties.length) {
        throw new Error(
          `MediaType.remove could not find property at index ${normalizedIndex}.`,
        );
      }
      this.properties.splice(normalizedIndex, 1);
      return this;
    }

    /**
     * Clear the full media type or only the properties list.
     * @param {"properties"} [scope] Optional scope to clear.
     * @returns {MediaType} The same media type instance.
     */
    clear(scope) {
      if (scope === undefined) {
        this.name = null;
        this.properties = [];
        return this;
      }
      if (scope !== "properties") {
        throw new Error(
          `MediaType.clear only supports scope "properties", got "${scope}".`,
        );
      }
      this.properties = [];
      return this;
    }

    /**
     * Normalize the media type in place.
     * @returns {MediaType} The same media type instance.
     */
    normalize() {
      this.name = normalizeText(this.name);
      this.properties = Array.from(this.properties || []).map((property) =>
        property instanceof MediaTypeProperty
          ? new MediaTypeProperty(property.toJSON())
          : new MediaTypeProperty(property),
      );
      return this;
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
        properties: XMLUtilities.findDirectChildElements(
          element,
          "property",
        ).map((property) => MediaTypeProperty.fromElement(property)),
      });
    }

    /**
     * Parse a `mediaType` XML element while salvaging valid properties.
     * Unknown child nodes and ordering issues are ignored silently.
     * @param {Element|null} element XML element to parse.
     * @param {Array<object>} [parseWarnings] Lossy parse warnings.
     * @param {string} [path] Field path used in warnings and validation.
     * @returns {MediaType} Parsed media type or an empty media type when
     * invalid.
     */
    static parse(element, parseWarnings = [], path = "mediaType") {
      if (!element) return new MediaType();

      const mediaType = new MediaType({
        name: element.getAttribute("name"),
        properties: XMLUtilities.findDirectChildElements(element, "property")
          .map((propertyElement, index) =>
            MediaTypeProperty.parse(
              propertyElement,
              parseWarnings,
              `${path}.properties[${index}]`,
            ),
          )
          .filter(Boolean),
      });
      return fixParsedValue({
        value: mediaType,
        path,
        parseWarnings,
        invalidMessage:
          "Ignored invalid mediaType content while parsing system metadata.",
        validate: (candidate) => candidate.validate(path),
        fallback: () => new MediaType(),
      });
    }

    /**
     * Coerce unknown input into a MediaType instance.
     * @param {MediaType|object|string|null|undefined} value Media type-like
     * input.
     * @returns {MediaType} Normalized media type.
     */
    static fromValue(value) {
      if (value === undefined || value === null) return new MediaType();
      return value instanceof MediaType
        ? new MediaType(value.toJSON())
        : new MediaType(value);
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
          createValidationIssue({
            field: `${path}.name`,
            message: "mediaType requires a non-empty name attribute.",
          }),
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
