define([
  "common/XMLUtilities",
  "common/DateUtility",
  "common/ValueUtilities",
  "common/ValidationUtilities",
  "models/sysmeta/SysMetaSchema",
], (XMLUtilities, DateUtilities, ValueUtilities, ValidationUtilities, SysMetaSchema) => {
  const {
    normalizeText,
    isNonEmptyString,
  } = ValueUtilities;
  const {
    normalizeReplicationStatus,
    REPLICATION_STATUSES,
  } = SysMetaSchema;
  const {
    createValidationError,
  } = ValidationUtilities;
  const REPLICA_CHILD_SEQUENCE = [
    { name: "replicaMemberNode", minOccurs: 1, maxOccurs: 1 },
    { name: "replicationStatus", minOccurs: 1, maxOccurs: 1 },
    { name: "replicaVerified", minOccurs: 1, maxOccurs: 1 },
  ];

  /**
   * Normalize replica verification input to a Date when possible.
   * @param {string|Date|null|undefined} value Replica verification value to
   * normalize.
   * @returns {Date|string|null} Normalized verification value.
   */
  function normalizeReplicaVerified(value) {
    if (value === undefined || value === null || value === "") return null;
    return DateUtilities.toDate(value) || value;
  }

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
      this.replicationStatus = normalizeReplicationStatus(data.replicationStatus);
      this.replicaVerified = normalizeReplicaVerified(data.replicaVerified);
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
     * Validate the replica state.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `replica`.
     * @returns {Array<object>} Validation errors for invalid fields.
     */
    validate(path = "replica") {
      const errors = [];

      if (!isNonEmptyString(this.replicaMemberNode)) {
        errors.push(
          createValidationError(
            `${path}.replicaMemberNode`,
            "replicaMemberNode is required and must be a non-empty string.",
          ),
        );
      }

      if (!isNonEmptyString(this.replicationStatus)) {
        errors.push(
          createValidationError(
            `${path}.replicationStatus`,
            "replicationStatus is required.",
          ),
        );
      } else if (
        !REPLICATION_STATUSES.includes(this.replicationStatus.toLowerCase())
      ) {
        errors.push(
          createValidationError(
            `${path}.replicationStatus`,
            `replicationStatus must be one of: ${REPLICATION_STATUSES.join(
              ", ",
            )}.`,
          ),
        );
      }

      if (!this.replicaVerified) {
        errors.push(
          createValidationError(
            `${path}.replicaVerified`,
            "replicaVerified is required.",
          ),
        );
      } else if (!DateUtility.isValidDate(this.replicaVerified)) {
        errors.push(
          createValidationError(
            `${path}.replicaVerified`,
            "replicaVerified must be a valid date.",
          ),
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
      return {
        replicaMemberNode: this.replicaMemberNode,
        replicationStatus: this.replicationStatus,
        replicaVerified: this.replicaVerified,
      };
    }
  }

  return Replica;
});
