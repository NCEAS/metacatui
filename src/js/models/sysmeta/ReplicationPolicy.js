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
    isNonNegativeInteger,
    normalizeText,
    requireNonNegativeInteger,
  } = ValueUtilities;
  const { fixParsedValue, createValidationIssue } = ValidationUtilities;
  const REPLICATION_POLICY_CHILD_SEQUENCE = [
    { name: "preferredMemberNode", minOccurs: 0, maxOccurs: Infinity },
    { name: "blockedMemberNode", minOccurs: 0, maxOccurs: Infinity },
  ];
  const NODE_TYPE_TO_FIELD = {
    preferred: "preferredNodes",
    blocked: "blockedNodes",
  };

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
     * Normalize and validate a replication-node type.
     * @param {string} type Node-list type.
     * @returns {"preferred"|"blocked"} Canonical node-list type.
     * @private
     */
    static requireNodeType(type) {
      const normalizedType = normalizeText(type)?.toLowerCase() || null;
      if (
        !Object.prototype.hasOwnProperty.call(
          NODE_TYPE_TO_FIELD,
          normalizedType,
        )
      ) {
        throw new Error(
          `ReplicationPolicy node type must be "preferred" or "blocked", got "${type}".`,
        );
      }
      return normalizedType;
    }

    /**
     * Resolve the array field for a replication-node type.
     * @param {"preferred"|"blocked"} type Node-list type.
     * @returns {"preferredNodes"|"blockedNodes"} Backing array field.
     * @private
     */
    static getNodeField(type) {
      return NODE_TYPE_TO_FIELD[this.requireNodeType(type)];
    }

    /**
     * Append one preferred or blocked member node.
     * @param {string} node Member node identifier.
     * @param {"preferred"|"blocked"} type Node-list type.
     * @returns {ReplicationPolicy} The same policy instance.
     */
    add(node, type) {
      this[ReplicationPolicy.getNodeField(type)].push(node);
      this[ReplicationPolicy.getNodeField(type)] = normalizeStringArray(
        this[ReplicationPolicy.getNodeField(type)],
      );
      return this;
    }

    /**
     * Replace one preferred or blocked member node.
     * @param {number} index Node index to replace.
     * @param {string} node Replacement member node.
     * @param {"preferred"|"blocked"} type Node-list type.
     * @returns {ReplicationPolicy} The same policy instance.
     */
    replace(index, node, type) {
      const normalizedIndex = requireNonNegativeInteger(index);
      const field = ReplicationPolicy.getNodeField(type);
      if (normalizedIndex >= this[field].length) {
        throw new Error(
          `ReplicationPolicy.replace could not find ${type} node at index ${normalizedIndex}.`,
        );
      }
      this[field][normalizedIndex] = node;
      this[field] = normalizeStringArray(this[field]);
      return this;
    }

    /**
     * Remove one preferred or blocked member node.
     * @param {number} index Node index to remove.
     * @param {"preferred"|"blocked"} type Node-list type.
     * @returns {ReplicationPolicy} The same policy instance.
     */
    remove(index, type) {
      const normalizedIndex = requireNonNegativeInteger(index);
      const field = ReplicationPolicy.getNodeField(type);
      if (normalizedIndex >= this[field].length) {
        throw new Error(
          `ReplicationPolicy.remove could not find ${type} node at index ${normalizedIndex}.`,
        );
      }
      this[field].splice(normalizedIndex, 1);
      return this;
    }

    /**
     * Clear one or both preferred/blocked node lists and optionally the
     * scalar policy values.
     * @param {"preferred"|"blocked"} [type] Node-list type to clear.
     * @returns {ReplicationPolicy} The same policy instance.
     */
    clear(type) {
      if (type === undefined) {
        this.replicationAllowed = null;
        this.numberReplicas = null;
        this.preferredNodes = [];
        this.blockedNodes = [];
        return this;
      }
      this[ReplicationPolicy.getNodeField(type)] = [];
      return this;
    }

    /**
     * Normalize the policy in place.
     * @returns {ReplicationPolicy} The same policy instance.
     */
    normalize() {
      this.replicationAllowed = normalizeBoolean(this.replicationAllowed);
      this.numberReplicas = normalizeInteger(this.numberReplicas);
      this.preferredNodes = normalizeStringArray(this.preferredNodes);
      this.blockedNodes = normalizeStringArray(this.blockedNodes);
      return this;
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
     * Parse a `replicationPolicy` XML element, dropping it when invalid.
     * Unknown child nodes and ordering issues are ignored silently.
     * @param {Element|null} element XML element to parse.
     * @param {Array<object>} [parseWarnings] Lossy parse warnings.
     * @param {string} [path] Field path used in warnings and validation.
     * @returns {ReplicationPolicy} Parsed policy or an empty policy when
     * invalid.
     */
    static parse(element, parseWarnings = [], path = "replicationPolicy") {
      if (!element) return new ReplicationPolicy();

      const policy = ReplicationPolicy.fromValue({
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
      return fixParsedValue({
        value: policy,
        path,
        parseWarnings,
        invalidMessage:
          "Ignored invalid replicationPolicy content while parsing system metadata.",
        validate: (candidate) => candidate.validate(path),
        fallback: () => new ReplicationPolicy(),
      });
    }

    /**
     * Coerce unknown input into a ReplicationPolicy instance.
     * @param {ReplicationPolicy|object|null|undefined} value Replication
     * policy-like input.
     * @returns {ReplicationPolicy} Normalized policy.
     */
    static fromValue(value) {
      if (value === undefined || value === null) return new ReplicationPolicy();
      return value instanceof ReplicationPolicy
        ? new ReplicationPolicy(value.toJSON())
        : new ReplicationPolicy(value);
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
          createValidationIssue({
            field: `${path}.replicationAllowed`,
            message: "replicationAllowed must be a boolean when present.",
          }),
        );
      }

      if (
        this.numberReplicas !== null &&
        !isNonNegativeInteger(this.numberReplicas)
      ) {
        errors.push(
          createValidationIssue({
            field: `${path}.numberReplicas`,
            message:
              "numberReplicas must be a non-negative integer when present.",
          }),
        );
      }

      this.preferredNodes.forEach((node, index) => {
        if (!isNonEmptyString(node)) {
          errors.push(
            createValidationIssue({
              field: `${path}.preferredNodes[${index}]`,
              message: "preferredMemberNode values must be non-empty strings.",
            }),
          );
        }
      });

      this.blockedNodes.forEach((node, index) => {
        if (!isNonEmptyString(node)) {
          errors.push(
            createValidationIssue({
              field: `${path}.blockedNodes[${index}]`,
              message: "blockedMemberNode values must be non-empty strings.",
            }),
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
        XMLUtilities.appendTextElement(
          doc,
          element,
          "preferredMemberNode",
          node,
        );
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
