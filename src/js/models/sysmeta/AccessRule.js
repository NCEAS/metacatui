define([
  "common/XMLUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
  "models/sysmeta/SysMetaSchema",
], (XMLUtilities, ValueUtilities, ValidationUtilities, SysMetaSchema) => {
  const { normalizeStringArray, dedupeArray, isNonEmptyString } =
    ValueUtilities;
  const { PERMISSIONS, normalizePermission } = SysMetaSchema;
  const { fixParsedValue, createValidationIssue } = ValidationUtilities;
  // Define the expected child element sequence for an `allow` element in the
  // access policy XML.
  const ACCESS_RULE_CHILD_SEQUENCE = [
    { name: "subject", minOccurs: 1, maxOccurs: Infinity },
    { name: "permission", minOccurs: 1, maxOccurs: Infinity },
  ];

  /**
   * Access control rule that binds one or more subjects to one or more
   * permissions.
   * @class AccessRule
   * @since 0.0.0
   */
  class AccessRule {
    /**
     * Create an AccessRule instance.
     * @param {object} [data] Initial access rule values.
     * @param {Array<string>} [data.subjects] Subjects granted access.
     * @param {Array<string>} [data.permissions] Granted permissions.
     */
    constructor(data = {}) {
      this.subjects = normalizeStringArray(data.subjects);
      this.permissions = dedupeArray(
        normalizeStringArray(data.permissions)
          .map((permission) => normalizePermission(permission))
          .filter((permission) => permission !== null),
      );
    }

    /**
     * Create an AccessRule from an `allow` XML element.
     * @param {Element} element XML element to parse.
     * @returns {AccessRule} Parsed access rule instance.
     */
    static fromElement(element) {
      const context = "AccessRule XML";
      XMLUtilities.requireAllowedAttributeNames(element, [], context);
      XMLUtilities.requireDirectChildSequence(
        element,
        ACCESS_RULE_CHILD_SEQUENCE,
        context,
      );

      return new AccessRule({
        subjects: XMLUtilities.getDirectChildTexts(element, "subject"),
        permissions: XMLUtilities.getDirectChildTexts(element, "permission"),
      });
    }

    /**
     * Parse an `allow` XML element, dropping it when invalid.
     * Unknown child nodes and ordering issues are ignored silently.
     * @param {Element|null} element XML element to parse.
     * @param {Array<object>} [parseWarnings] Lossy parse warnings.
     * @param {string} [path] Field path used in warnings and validation.
     * @returns {AccessRule|null} Parsed access rule or null when invalid.
     */
    static parse(element, parseWarnings = [], path = "accessPolicy") {
      if (!element) return null;

      const rule = new AccessRule({
        subjects: XMLUtilities.getDirectChildTexts(element, "subject"),
        permissions: XMLUtilities.getDirectChildTexts(element, "permission"),
      });
      return fixParsedValue({
        value: rule,
        path,
        parseWarnings,
        invalidMessage:
          "Ignored invalid accessPolicy rule while parsing system metadata.",
        validate: (candidate) => candidate.validate(path),
        fallback: () => null,
      });
    }

    /**
     * Return the first subject in the rule.
     * @returns {string|null} First subject value, if present.
     */
    get subject() {
      return this.subjects[0] ?? null;
    }

    /**
     * Whether the rule grants read access.
     * @returns {boolean} `true` when read permission is present.
     */
    get read() {
      return this.permissions.includes("read");
    }

    /**
     * Whether the rule grants write access.
     * @returns {boolean} `true` when write permission is present.
     */
    get write() {
      return this.permissions.includes("write");
    }

    /**
     * Whether the rule grants change-permission access.
     * @returns {boolean} `true` when changePermission is present.
     */
    get changePermission() {
      return this.permissions.includes("changePermission");
    }

    /**
     * Validate the access rule state.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `accessPolicy`.
     * @returns {Array<object>} Validation errors for invalid fields.
     */
    validate(path = "accessPolicy") {
      const errors = [];

      if (!this.subjects.length) {
        errors.push(
          createValidationIssue({
            field: `${path}.subjects`,
            message: "At least one subject is required.",
          }),
        );
      }

      this.subjects.forEach((subject, index) => {
        if (!isNonEmptyString(subject)) {
          errors.push(
            createValidationIssue({
              field: `${path}.subjects[${index}]`,
              message: "Subjects must be non-empty strings.",
            }),
          );
        }
      });

      if (!this.permissions.length) {
        errors.push(
          createValidationIssue({
            field: `${path}.permissions`,
            message: "At least one permission is required.",
          }),
        );
      }

      this.permissions.forEach((permission, index) => {
        if (!PERMISSIONS.includes(permission)) {
          errors.push(
            createValidationIssue({
              field: `${path}.permissions[${index}]`,
              message: `Permissions must be one of: ${PERMISSIONS.join(", ")}.`,
            }),
          );
        }
      });

      return errors;
    }

    /**
     * Serialize the access rule to an `allow` XML element.
     * @param {XMLDocument} doc XML document used to create elements.
     * @returns {Element|null} Serialized XML element, or `null` when empty.
     */
    toElement(doc) {
      if (!this.subjects.length && !this.permissions.length) return null;

      const element = doc.createElement("allow");

      this.subjects.forEach((subject) => {
        XMLUtilities.appendTextElement(doc, element, "subject", subject);
      });

      this.permissions.forEach((permission) => {
        XMLUtilities.appendTextElement(doc, element, "permission", permission);
      });

      return element;
    }

    /**
     * Return a JSON-serializable representation of the access rule.
     * @returns {object} Plain access rule data.
     */
    toJSON() {
      return {
        subjects: [...this.subjects],
        permissions: [...this.permissions],
      };
    }
  }

  return AccessRule;
});
