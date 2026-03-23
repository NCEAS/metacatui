define([
  "common/XMLUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
], (XMLUtilities, ValueUtilities, ValidationUtilities) => {
  const {
    normalizeBoolean,
    normalizeInteger,
    normalizeStringArray,
    isNonEmptyString,
    isUnsignedInteger,
  } = ValueUtilities;
  const {
    createValidationError,
  } = ValidationUtilities;
  const REPLICATION_POLICY_CHILD_SEQUENCE = [
    { name: "preferredMemberNode", minOccurs: 0, maxOccurs: Infinity },
    { name: "blockedMemberNode", minOccurs: 0, maxOccurs: Infinity },
  ];

  /**
   * Replication policy value object for System Metadata.
   * @class ReplicationPolicy
   * @since 0.0.0
   */
  class ReplicationPolicy {
    /**
     * Create a ReplicationPolicy instance.
     * @param {object} [data] Initial replication policy values.
     * @param {boolean|string|number|null} [data.replicationAllowed] Whether
     * replication is allowed.
     * @param {number|string|null} [data.numberReplicas] Requested replica
     * count.
     * @param {Array<string>} [data.preferredNodes] Preferred member nodes.
     * @param {Array<string>} [data.blockedNodes] Blocked member nodes.
     */
    constructor(data = {}) {
      this.replicationAllowed = normalizeBoolean(data.replicationAllowed);
      this.numberReplicas = normalizeInteger(data.numberReplicas);
      this.preferredNodes = normalizeStringArray(data.preferredNodes);
      this.blockedNodes = normalizeStringArray(data.blockedNodes);
    }

    /**
     * Create a ReplicationPolicy from a `replicationPolicy` XML element.
     * @param {Element} element XML element to parse.
     * @returns {ReplicationPolicy} Parsed replication policy instance.
     */
    static fromElement(element) {
      const context = "ReplicationPolicy XML";
      XMLUtilities.requireAllowedAttributeNames(
        element,
        ["replicationAllowed", "numberReplicas"],
        context,
      );
      XMLUtilities.requireDirectChildSequence(
        element,
        REPLICATION_POLICY_CHILD_SEQUENCE,
        context,
      );

      return new ReplicationPolicy({
        replicationAllowed: element.getAttribute("replicationAllowed"),
        numberReplicas: element.getAttribute("numberReplicas"),
        preferredNodes: XMLUtilities.getDirectChildTexts(
          element,
          "preferredMemberNode",
        ),
        blockedNodes: XMLUtilities.getDirectChildTexts(
          element,
          "blockedMemberNode",
        ),
      });
    }

    /**
     * Coerce unknown input into a ReplicationPolicy instance.
     * @param {ReplicationPolicy|object|null|undefined} value Replication
     * policy-like input.
     * @returns {ReplicationPolicy|null} Normalized policy or `null` when empty.
     */
    static fromValue(value) {
      if (value === undefined || value === null) return null;

      const policy =
        value instanceof ReplicationPolicy
          ? new ReplicationPolicy(value.toJSON())
          : new ReplicationPolicy(value);

      return policy.hasValues() ? policy : null;
    }

    /**
     * Whether the policy contains any serialized values.
     * @returns {boolean} `true` when any field is populated.
     */
    hasValues() {
      return (
        this.replicationAllowed !== null ||
        this.numberReplicas !== null ||
        this.preferredNodes.length > 0 ||
        this.blockedNodes.length > 0
      );
    }

    /**
     * Validate the replication policy state.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `replicationPolicy`.
     * @returns {Array<object>} Validation errors for invalid fields.
     */
    validate(path = "replicationPolicy") {
      const errors = [];

      if (
        this.replicationAllowed !== null &&
        typeof this.replicationAllowed !== "boolean"
      ) {
        errors.push(
          createValidationError(
            `${path}.replicationAllowed`,
            "replicationAllowed must be a boolean when present.",
          ),
        );
      }

      if (
        this.numberReplicas !== null &&
        !isUnsignedInteger(this.numberReplicas)
      ) {
        errors.push(
          createValidationError(
            `${path}.numberReplicas`,
            "numberReplicas must be an unsigned integer when present.",
          ),
        );
      }

      this.preferredNodes.forEach((node, index) => {
        if (!isNonEmptyString(node)) {
          errors.push(
            createValidationError(
              `${path}.preferredNodes[${index}]`,
              "preferredMemberNode values must be non-empty strings.",
            ),
          );
        }
      });

      this.blockedNodes.forEach((node, index) => {
        if (!isNonEmptyString(node)) {
          errors.push(
            createValidationError(
              `${path}.blockedNodes[${index}]`,
              "blockedMemberNode values must be non-empty strings.",
            ),
          );
        }
      });

      return errors;
    }

    /**
     * Serialize the replication policy to XML.
     * @param {XMLDocument} doc XML document used to create elements.
     * @returns {Element|null} Serialized XML element, or `null` when empty.
     */
    toElement(doc) {
      if (!this.hasValues()) return null;

      const element = doc.createElement("replicationPolicy");

      if (this.replicationAllowed !== null) {
        element.setAttribute(
          "replicationAllowed",
          String(this.replicationAllowed),
        );
      }

      if (this.numberReplicas !== null) {
        element.setAttribute("numberReplicas", String(this.numberReplicas));
      }

      this.preferredNodes.forEach((node) => {
        XMLUtilities.appendTextElement(doc, element, "preferredMemberNode", node);
      });

      this.blockedNodes.forEach((node) => {
        XMLUtilities.appendTextElement(doc, element, "blockedMemberNode", node);
      });

      return element;
    }

    /**
     * Return a JSON-serializable representation of the replication policy.
     * @returns {object} Plain replication policy data.
     */
    toJSON() {
      return {
        replicationAllowed: this.replicationAllowed,
        numberReplicas: this.numberReplicas,
        preferredNodes: [...this.preferredNodes],
        blockedNodes: [...this.blockedNodes],
      };
    }
  }

  return ReplicationPolicy;
});
