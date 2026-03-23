define([
  "common/XMLUtilities",
  "models/sysmeta/AccessRule",
], (XMLUtilities, AccessRule) => {
  const ACCESS_POLICY_CHILD_SEQUENCE = [
    { name: "allow", minOccurs: 1, maxOccurs: Infinity },
  ];

  /**
   * Collection of access rules used by System Metadata.
   * @class AccessPolicy
   * @augments Array
   * @since 0.0.0
   */
  class AccessPolicy extends Array {
    /**
     * Create an AccessPolicy instance.
     * @param {Array<AccessRule|object>} [rules] Access rules to normalize.
     */
    constructor(rules = []) {
      super();

      Array.from(rules).forEach((rule) => {
        this.push(
          rule instanceof AccessRule
            ? new AccessRule(rule.toJSON())
            : new AccessRule(rule),
        );
      });
    }

    /**
     * Append one or more access rules to the policy.
     * @param {...(AccessRule|object)} rules Access rules to append.
     * @returns {number} The new array length.
     */
    push(...rules) {
      return super.push(
        ...rules.map((rule) =>
          rule instanceof AccessRule ? rule : new AccessRule(rule),
        ),
      );
    }

    /**
     * Create an AccessPolicy from an `accessPolicy` XML element.
     * @param {Element} element XML element to parse.
     * @returns {AccessPolicy} Parsed access policy instance.
     */
    static fromElement(element) {
      const context = "AccessPolicy XML";
      XMLUtilities.requireAllowedAttributeNames(element, [], context);
      XMLUtilities.requireDirectChildSequence(
        element,
        ACCESS_POLICY_CHILD_SEQUENCE,
        context,
      );

      return new AccessPolicy(
        XMLUtilities.findDirectChildElements(element, "allow").map(
          (ruleElement) => AccessRule.fromElement(ruleElement),
        ),
      );
    }

    /**
     * Coerce unknown input into an AccessPolicy instance.
     * @param {AccessPolicy|Array<AccessRule|object>|AccessRule|object|null|undefined} value
     * Access policy-like input.
     * @returns {AccessPolicy} Normalized access policy instance.
     */
    static fromValue(value) {
      if (value === undefined || value === null) return new AccessPolicy();
      if (value instanceof AccessPolicy) return new AccessPolicy(value);
      return new AccessPolicy(Array.isArray(value) ? value : [value]);
    }

    /**
     * Validate each access rule in the policy.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `accessPolicy`.
     * @returns {Array<object>} Validation errors for invalid rules.
     */
    validate(path = "accessPolicy") {
      const errors = [];
      this.forEach((rule, index) => {
        errors.push(...rule.validate(`${path}[${index}]`));
      });
      return errors;
    }

    /**
     * Serialize the access policy to XML.
     * @param {XMLDocument} doc XML document used to create elements.
     * @returns {Element|null} Serialized XML element, or `null` when empty.
     */
    toElement(doc) {
      if (!this.length) return null;

      const element = doc.createElement("accessPolicy");
      this.forEach((rule) => {
        const ruleElement = rule.toElement(doc);
        if (ruleElement) element.appendChild(ruleElement);
      });

      return element.childNodes.length ? element : null;
    }

    /**
     * Return a JSON-serializable representation of the access policy.
     * @returns {Array<object>} Plain access rule data.
     */
    toJSON() {
      return Array.from(this, (rule) => rule.toJSON());
    }
  }

  return AccessPolicy;
});
