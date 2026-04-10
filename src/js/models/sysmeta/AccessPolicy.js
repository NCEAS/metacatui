define([
  "common/XMLUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
  "models/sysmeta/AccessRule",
], (XMLUtilities, ValueUtilities, ValidationUtilities, AccessRule) => {
  const { requireNonNegativeInteger } = ValueUtilities;
  const { fixParsedValue } = ValidationUtilities;
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
     * Append one access rule to the policy.
     * @param {AccessRule|object} rule Access rule to append.
     * @returns {AccessPolicy} The same policy instance.
     */
    add(rule) {
      this.push(rule);
      return this;
    }

    /**
     * Replace one access rule.
     * @param {number} index Rule index to replace.
     * @param {AccessRule|object} rule Replacement rule.
     * @returns {AccessPolicy} The same policy instance.
     */
    replace(index, rule) {
      const normalizedIndex = requireNonNegativeInteger(index);
      if (normalizedIndex >= this.length) {
        throw new Error(
          `AccessPolicy.replace could not find rule at index ${normalizedIndex}.`,
        );
      }
      this[normalizedIndex] =
        rule instanceof AccessRule ? rule : new AccessRule(rule);
      return this;
    }

    /**
     * Remove one access rule.
     * @param {number} index Rule index to remove.
     * @returns {AccessPolicy} The same policy instance.
     */
    remove(index) {
      const normalizedIndex = requireNonNegativeInteger(index);
      if (normalizedIndex >= this.length) {
        throw new Error(
          `AccessPolicy.remove could not find rule at index ${normalizedIndex}.`,
        );
      }
      this.splice(normalizedIndex, 1);
      return this;
    }

    /**
     * Remove all access rules.
     * @returns {AccessPolicy} The same policy instance.
     */
    clear() {
      this.length = 0;
      return this;
    }

    /**
     * Normalize the policy in place.
     * @returns {AccessPolicy} The same policy instance.
     */
    normalize() {
      const normalizedRules = Array.from(this, (rule) =>
        rule instanceof AccessRule
          ? new AccessRule(rule.toJSON())
          : new AccessRule(rule),
      );
      this.length = 0;
      super.push(...normalizedRules);
      return this;
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
     * Parse an `accessPolicy` XML element while salvaging valid rules.
     * Unknown child nodes and ordering issues are ignored silently.
     * @param {Element|null} element XML element to parse.
     * @param {Array<object>} [parseWarnings] Lossy parse warnings.
     * @param {string} [path] Field path used in warnings and validation.
     * @returns {AccessPolicy} Parsed access policy instance.
     */
    static parse(element, parseWarnings = [], path = "accessPolicy") {
      if (!element) return new AccessPolicy();

      const rules = XMLUtilities.findDirectChildElements(element, "allow")
        .map((ruleElement, index) =>
          AccessRule.parse(ruleElement, parseWarnings, `${path}[${index}]`),
        )
        .filter(Boolean);

      const policy = new AccessPolicy(rules);
      return fixParsedValue({
        value: policy,
        path,
        parseWarnings,
        invalidMessage:
          "Ignored invalid accessPolicy content while parsing system metadata.",
        validate: (candidate) => candidate.validate(path),
        fallback: () => new AccessPolicy(),
      });
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
