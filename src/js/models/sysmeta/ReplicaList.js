define(["models/sysmeta/Replica"], (Replica) => {
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
