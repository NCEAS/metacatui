define([
  "common/XMLUtilities",
  "common/DateUtilities",
  "common/ValueUtilities",
  "common/ValidationUtilities",
  "models/sysmeta/SysMetaSchema",
], (
  XMLUtilities,
  DateUtilities,
  ValueUtilities,
  ValidationUtilities,
  SysMetaSchema,
) => {
  const { nullIfEmpty, normalizeText, isNonEmptyString } = ValueUtilities;
  const { normalizeReplicationStatus, REPLICATION_STATUSES } = SysMetaSchema;
  const { fixParsedValue, createValidationIssue } = ValidationUtilities;
  const REPLICA_CHILD_SEQUENCE = [
    { name: "replicaMemberNode", minOccurs: 1, maxOccurs: 1 },
    { name: "replicationStatus", minOccurs: 1, maxOccurs: 1 },
    { name: "replicaVerified", minOccurs: 1, maxOccurs: 1 },
  ];

  /**
   * Replica entry value object for System Metadata.
   * @class Replica
   * @since 0.0.0
   */
  class Replica {
    /**
     * Create a Replica instance.
     * @param {object} [data] Initial replica values.
     * @param {string|null} [data.replicaMemberNode] Replica member node
     * identifier.
     * @param {string|null} [data.replicationStatus] Replica replication status.
     * @param {string|Date|null} [data.replicaVerified] Replica verification
     * timestamp.
     */
    constructor(data = {}) {
      this.replicaMemberNode = normalizeText(data.replicaMemberNode);
      this.replicationStatus = normalizeReplicationStatus(
        data.replicationStatus,
      );
      this.replicaVerified =
        DateUtilities.toDate(nullIfEmpty(data.replicaVerified)) ||
        nullIfEmpty(data.replicaVerified);
    }

    /**
     * Create a Replica from a `replica` XML element.
     * @param {Element} element XML element to parse.
     * @returns {Replica} Parsed replica instance.
     */
    static fromElement(element) {
      const context = "Replica XML";
      XMLUtilities.requireAllowedAttributeNames(element, [], context);
      XMLUtilities.requireDirectChildSequence(
        element,
        REPLICA_CHILD_SEQUENCE,
        context,
      );

      return new Replica({
        replicaMemberNode: XMLUtilities.getDirectChildText(
          element,
          "replicaMemberNode",
        ),
        replicationStatus: XMLUtilities.getDirectChildText(
          element,
          "replicationStatus",
        ),
        replicaVerified: XMLUtilities.getDirectChildText(
          element,
          "replicaVerified",
        ),
      });
    }

    /**
     * Parse a `replica` XML element, dropping it when invalid.
     * Unknown child nodes and ordering issues are ignored silently.
     * @param {Element|null} element XML element to parse.
     * @param {Array<object>} [parseWarnings] Lossy parse warnings.
     * @param {string} [path] Field path used in warnings and validation.
     * @returns {Replica|null} Parsed replica or null when invalid.
     */
    static parse(element, parseWarnings = [], path = "replica") {
      if (!element) return null;

      const replica = new Replica({
        replicaMemberNode: XMLUtilities.getDirectChildText(
          element,
          "replicaMemberNode",
        ),
        replicationStatus: XMLUtilities.getDirectChildText(
          element,
          "replicationStatus",
        ),
        replicaVerified: XMLUtilities.getDirectChildText(
          element,
          "replicaVerified",
        ),
      });
      return fixParsedValue({
        value: replica,
        path,
        parseWarnings,
        invalidMessage:
          "Ignored invalid replica while parsing system metadata.",
        validate: (candidate) => candidate.validate(path),
        fallback: () => null,
      });
    }

    /**
     * Validate the replica state.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `replica`.
     * @returns {Array<object>} Validation errors for invalid fields.
     */
    validate(path = "replica") {
      const errors = [];

      if (!isNonEmptyString(this.replicaMemberNode)) {
        errors.push(
          createValidationIssue({
            field: `${path}.replicaMemberNode`,
            message:
              "replicaMemberNode is required and must be a non-empty string.",
          }),
        );
      }

      if (!isNonEmptyString(this.replicationStatus)) {
        errors.push(
          createValidationIssue({
            field: `${path}.replicationStatus`,
            message: "replicationStatus is required.",
          }),
        );
      } else if (
        !REPLICATION_STATUSES.includes(this.replicationStatus.toLowerCase())
      ) {
        errors.push(
          createValidationIssue({
            field: `${path}.replicationStatus`,
            message: `replicationStatus must be one of: ${REPLICATION_STATUSES.join(
              ", ",
            )}.`,
          }),
        );
      }

      if (!this.replicaVerified) {
        errors.push(
          createValidationIssue({
            field: `${path}.replicaVerified`,
            message: "replicaVerified is required.",
          }),
        );
      } else if (!DateUtilities.isValidDate(this.replicaVerified)) {
        errors.push(
          createValidationIssue({
            field: `${path}.replicaVerified`,
            message: "replicaVerified must be a valid date.",
          }),
        );
      }

      return errors;
    }

    /**
     * Serialize the replica to XML.
     * @param {XMLDocument} doc XML document used to create elements.
     * @returns {Element|null} Serialized XML element, or `null` when empty.
     */
    toElement(doc) {
      const element = doc.createElement("replica");
      XMLUtilities.appendTextElement(
        doc,
        element,
        "replicaMemberNode",
        this.replicaMemberNode,
      );
      XMLUtilities.appendTextElement(
        doc,
        element,
        "replicationStatus",
        this.replicationStatus,
      );
      XMLUtilities.appendTextElement(
        doc,
        element,
        "replicaVerified",
        DateUtilities.toXmlDateTimeString(this.replicaVerified) || null,
      );

      return element.childNodes.length ? element : null;
    }

    /**
     * Return a JSON-serializable representation of the replica.
     * @returns {object} Plain replica data.
     */
    toJSON() {
      const { replicaMemberNode, replicationStatus, replicaVerified } = this;
      return {
        replicaMemberNode,
        replicationStatus,
        replicaVerified: DateUtilities.toISOString(replicaVerified) || null,
      };
    }
  }

  return Replica;
});
