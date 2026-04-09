define([
  "common/ValueUtilities",
  "common/ValidationUtilities",
  "models/sysmeta/Replica",
], (ValueUtilities, ValidationUtilities, Replica) => {
  const { requireNonNegativeInteger } = ValueUtilities;
  const { fixParsedValue } = ValidationUtilities;
  /**
   * Collection of replica entries used by System Metadata.
   * @class ReplicaList
   * @augments Array
   * @since 0.0.0
   */
  class ReplicaList extends Array {
    /**
     * Create a ReplicaList instance.
     * @param {Array<Replica|object>} [replicas] Replica entries to normalize.
     */
    constructor(replicas = []) {
      super();

      Array.from(replicas).forEach((replica) => {
        this.push(
          replica instanceof Replica
            ? new Replica(replica.toJSON())
            : new Replica(replica),
        );
      });
    }

    /**
     * Append one or more replicas to the list.
     * @param {...(Replica|object)} replicas Replica entries to append.
     * @returns {number} The new array length.
     */
    push(...replicas) {
      return super.push(
        ...replicas.map((replica) =>
          replica instanceof Replica ? replica : new Replica(replica),
        ),
      );
    }

    /**
     * Append one replica entry.
     * @param {Replica|object} replica Replica entry to append.
     * @returns {ReplicaList} The same list instance.
     */
    add(replica) {
      this.push(replica);
      return this;
    }

    /**
     * Replace one replica entry.
     * @param {number} index Replica index to replace.
     * @param {Replica|object} replica Replacement replica.
     * @returns {ReplicaList} The same list instance.
     */
    replace(index, replica) {
      const normalizedIndex = requireNonNegativeInteger(index);
      if (normalizedIndex >= this.length) {
        throw new Error(
          `ReplicaList.replace could not find replica at index ${normalizedIndex}.`,
        );
      }
      this[normalizedIndex] =
        replica instanceof Replica ? replica : new Replica(replica);
      return this;
    }

    /**
     * Remove one replica entry.
     * @param {number} index Replica index to remove.
     * @returns {ReplicaList} The same list instance.
     */
    remove(index) {
      const normalizedIndex = requireNonNegativeInteger(index);
      if (normalizedIndex >= this.length) {
        throw new Error(
          `ReplicaList.remove could not find replica at index ${normalizedIndex}.`,
        );
      }
      this.splice(normalizedIndex, 1);
      return this;
    }

    /**
     * Remove all replicas.
     * @returns {ReplicaList} The same list instance.
     */
    clear() {
      this.length = 0;
      return this;
    }

    /**
     * Normalize the replica list in place.
     * @returns {ReplicaList} The same list instance.
     */
    normalize() {
      const normalizedReplicas = Array.from(this, (replica) =>
        replica instanceof Replica
          ? new Replica(replica.toJSON())
          : new Replica(replica),
      );
      this.length = 0;
      super.push(...normalizedReplicas);
      return this;
    }

    /**
     * Coerce unknown input into a ReplicaList instance.
     * @param {ReplicaList|Array<Replica|object>|Replica|object|null|undefined} value
     * Replica-like input.
     * @returns {ReplicaList} Normalized replica list instance.
     */
    static fromValue(value) {
      if (value === undefined || value === null) return new ReplicaList();
      if (value instanceof ReplicaList) return new ReplicaList(value);
      return new ReplicaList(Array.isArray(value) ? value : [value]);
    }

    /**
     * Parse replica elements while salvaging valid entries.
     * @param {Element[]|null|undefined} elements Replica XML elements.
     * @param {Array<object>} [parseWarnings] Lossy parse warnings.
     * @param {string} [path] Field path used in warnings and validation.
     * @returns {ReplicaList} Parsed replica list instance.
     */
    static parse(elements, parseWarnings = [], path = "replica") {
      console.log("rep parse", elements);

      const replicas = Array.from(elements || [])
        .map((element, index) =>
          Replica.parse(element, parseWarnings, `${path}[${index}]`),
        )
        .filter(Boolean);

      const replicaList = new ReplicaList(replicas);
      return fixParsedValue({
        value: replicaList,
        path,
        parseWarnings,
        invalidMessage:
          "Ignored invalid replica content while parsing system metadata.",
        validate: (candidate) => candidate.validate(path),
        fallback: () => new ReplicaList(),
      });
    }

    /**
     * Validate each replica in the list.
     * @param {string} [path] Base path used in validation errors. Defaults to
     * `replica`.
     * @returns {Array<object>} Validation errors for invalid replicas.
     */
    validate(path = "replica") {
      const errors = [];
      this.forEach((replica, index) => {
        errors.push(...replica.validate(`${path}[${index}]`));
      });
      return errors;
    }

    /**
     * Return a JSON-serializable representation of the replica list.
     * @returns {Array<object>} Plain replica data.
     */
    toJSON() {
      return Array.from(this, (replica) => replica.toJSON());
    }
  }

  return ReplicaList;
});
