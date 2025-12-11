define(["localforage"], (localforage) => {
  // Minified storage keys to save browser space
  const KEY_MAP = {
    prev: "p",
    next: "n",
    updatedAt: "u",
  };

  // Default schema version for storage. Update this if the storage format
  // changes in a non-backwards-compatible way.
  const DEFAULT_SCHEMA_VERSION = 1;

  /**
   * All stored versions reachable from a given starting ID.
   * @typedef {object} VersionChain
   * @property {string} id The starting record ID.
   * @property {string[]} prev Array of previous version IDs, ordered from
   * newest to oldest.
   * @property {string[]} next Array of next version IDs, ordered from oldest to
   * newest.
   * @property {string} [head] The ID of the latest version in the chain.
   * @property {string} [tail] The ID of the earliest version in the chain.
   */

  /**
   * VersionStorage an offline-capable cache for DataONE version chains that
   * uses localforage to persist record obsolescence relationships in the
   * browser. It includes automatic expiration and concurrency locking to handle
   * race conditions (i.e. avoids lost updates in the case where multiple calls
   * are made to update the same record before the first has completed).
   *
   * IMPORTANT: Always access the class via VersionStorage.get(), which returns
   * an instance that is unique per coordinating node ID and schema version.
   */
  class VersionStorage {
    /**
     * @param {object} options Initialization options
     * @param {string} options.cnId Coordinating node identifier to be used to
     * segregate storage per CN.
     * @param {number|null} [options.ttlMs] TTL in ms; if exceeded, whole chain
     * is expired for any record in it. Set to null for no expiration. Defaults
     * to 24 hours.
     * @param {number} [options.schemaVersion] Schema version for stored records
     * @param {object} [options.localforageConfig] Extra config passed to
     * localforage.createInstance
     */
    constructor(options = {}) {
      const {
        cnId,
        ttlMs = 24 * 60 * 60 * 1000,
        schemaVersion = DEFAULT_SCHEMA_VERSION,
        localforageConfig = {},
      } = options;

      if (typeof cnId !== "string" || !cnId.length) {
        throw new Error("Coordinating node ID is required");
      }

      this.cnId = cnId;
      this.locks = new Map();
      this.ttlMs = ttlMs;
      this.schemaVersion = schemaVersion;

      this.lf = localforage.createInstance({
        name: "DataONE_VersionStore",
        storeName: this.constructor.createStoreName(cnId, schemaVersion),
        version: this.schemaVersion,
        ...localforageConfig,
      });
    }

    /**
     * Create a valid localforage store name for the given CN ID and schema
     * version.
     * @param {string} cnId The coordinating node ID.
     * @param {number} [schemaVersion] The schema version.
     * @returns {string} The store name.
     * @private
     */
    static createStoreName(cnId, schemaVersion = DEFAULT_SCHEMA_VERSION) {
      const cnIdNormal = cnId.toLowerCase().replace(/[^a-z0-9]/g, "_");
      return `versions_${cnIdNormal}_v${schemaVersion}`;
    }

    /**
     * Check if a record is expired based on TTL.
     * @param {object} record The record to check.
     * @returns {boolean} True if the record is expired, false otherwise.
     * @private
     */
    isExpired(record) {
      if (!this.ttlMs) return false;
      if (!record || (!record.updatedAt && record.updatedAt !== 0))
        return false;
      return Date.now() - record.updatedAt > this.ttlMs;
    }

    /**
     * Decode stored compact record into a normalized record object.
     * @param {object} raw The raw stored record.
     * @returns {object} The decoded record object.
     * @private
     */
    static decodeRecord(raw) {
      if (!raw || typeof raw !== "object") {
        throw new Error("A raw record is required");
      }

      const record = {};
      Object.keys(KEY_MAP).forEach((key) => {
        const compactKey = KEY_MAP[key];
        if (Object.prototype.hasOwnProperty.call(raw, compactKey)) {
          record[key] = raw[compactKey];
        }
      });

      return record;
    }

    /**
     * Encode normalized record back to compact storage format.
     * @param {object} record The record to encode.
     * @returns {object} The encoded raw record.
     * @private
     */
    static encodeRecord(record) {
      if (!record) {
        throw new Error("A record is required");
      }

      const raw = {};
      Object.keys(KEY_MAP).forEach((key) => {
        const compactKey = KEY_MAP[key];
        if (Object.prototype.hasOwnProperty.call(record, key)) {
          raw[compactKey] = record[key];
        }
      });

      return raw;
    }

    /**
     * Save a record to storage.
     * @param {string} id The record ID.
     * @param {object} record The record to save.
     * @returns {Promise<object>} The saved record.
     * @private
     */
    async saveRecord(id, record) {
      const recordToSave = { ...record };
      recordToSave.updatedAt = Date.now();
      const raw = this.constructor.encodeRecord(recordToSave);
      try {
        await this.lf.setItem(id, raw);
      } catch (e) {
        // Quota will rarely be hit and version history is not critical
        if (this.constructor.isQuotaError(e)) {
          await this.clearAll();
          await this.lf.setItem(id, raw);
        } else {
          throw e;
        }
      }
      return recordToSave;
    }

    /**
     * Detect quota errors. Local forage does not standardize error messages,
     * and uses different storage backends, so we check for common substrings.
     * @param {Error|string} e The error to check.
     * @returns {boolean} True if the error indicates a quota exceeded
     * condition.
     * @private
     */
    static isQuotaError(e) {
      const quotaMessages = [
        "QuotaExceededError",
        "QUOTA_EXCEEDED_ERR",
        "QUOTA_BYTES_EXCEEDED",
        "quota",
        "exceeded",
      ];
      let msg = typeof e === "string" ? e : e.message || "";
      msg = msg.toLowerCase();
      return quotaMessages.some((qm) => msg.includes(qm.toLowerCase()));
    }

    /**
     * Run a function with a lock for the given ID to prevent concurrent
     * modifications to the same record.
     * @param {string} id The record ID.
     * @param {Function} fn The async function to run.
     * @returns {Promise<*>} The result of the function.
     * @private
     */
    async withLock(id, fn) {
      // Get the promise that represents the last job for this id
      const prev = this.locks.get(id) || Promise.resolve();

      // Define the new job to run after the previous one
      const job = prev
        .catch(() => {}) // ignore previous failure so we don't block the queue
        .then(fn);

      // Track this job as the latest for the id
      this.locks.set(id, job);

      try {
        return await job;
      } finally {
        // Only clear if we're still the latest job for this id
        if (this.locks.get(id) === job) {
          this.locks.delete(id);
        }
      }
    }

    /**
     * Create or update a record. Merges existing data if present.
     * @param {string} id The record ID.
     * @param {object} record The data to set on the record.
     * @returns {Promise<object>} The saved record.
     * @private
     */
    async upsertRecord(id, record) {
      if (!record || typeof record !== "object") {
        throw new Error("A record object is required");
      }
      if (!id || typeof id !== "string") {
        throw new Error("A record ID is required");
      }
      return this.withLock(id, async () => {
        const existing = await this.getRecord(id);
        const base = existing || {};
        const merged = { ...base, ...record };
        return this.saveRecord(id, merged);
      });
    }

    /**
     * Get the full record for a PID, or null if not found or expired. If
     * expired, the record will be removed from storage.
     * @param {string} id The record ID.
     * @returns {Promise<object|null>} The record, or null if not found/expired.
     */
    async getRecord(id) {
      const raw = await this.lf.getItem(id);
      if (!raw) return null;

      const record = this.constructor.decodeRecord(raw);
      if (this.isExpired(record)) {
        await this.lf.removeItem(id);
        return null;
      }

      record.id = id;
      return record;
    }

    /**
     * Given a version triple (for example, as found in a retrieved record
     * object), add or update records for the central, previous, and next
     * versions as applicable.
     * @param {object} data The version data.
     * @param {string} data.id The central record ID (required).
     * @param {string|null} [data.prev] The previous version ID, if any.
     * @param {string|null} [data.next] The next version ID, if any.
     * @returns {Promise<Array>} Array of all saved records.
     */
    async addVersions({ id, prev, next } = {}) {
      if (!id) {
        throw new Error("ID is required to add versions");
      }

      const promises = [];

      promises.push(this.upsertRecord(id, { prev, next }));

      // Update neighbour records if applicable
      if (typeof prev === "string" && prev.length) {
        promises.push(this.upsertRecord(prev, { next: id }));
      }

      if (typeof next === "string" && next.length) {
        promises.push(this.upsertRecord(next, { prev: id }));
      }

      return Promise.all(promises);
    }

    /**
     * Get the neighbour ID in the specified direction.
     * @param {string} id The record ID.
     * @param {"prev"|"next"} [direction] The direction to get the neighbour.
     * @returns {Promise<string|null>} The neighbour ID, or null if not found.
     */
    async getNeighbour(id, direction = "prev") {
      const record = await this.getRecord(id);
      return record?.[direction] || null;
    }

    /**
     * Get all neighbours in the specified direction by following stored
     * prev/next.
     * @param {string} id The starting record ID.
     * @param {"prev"|"next"} [direction] The direction to get neighbours.
     * @returns {Promise<string[]>} Array of neighbour IDs.
     */
    async getAllNeighbours(id, direction = "prev") {
      if (!id) {
        throw new Error("ID is required to get neighbours");
      }
      const results = [];
      let currentId = id;

      while (currentId) {
        // eslint-disable-next-line no-await-in-loop
        const neighbourId = await this.getNeighbour(currentId, direction);
        if (neighbourId) {
          results.push(neighbourId);
          currentId = neighbourId;
        } else {
          break;
        }
      }

      return results;
    }

    /**
     * Get the entire chain of versions reachable from `startId` by following
     * stored prev/next.
     * @param {string} startId The starting record ID.
     * @returns {Promise<VersionChain>} The version chain.
     */
    async getChain(startId) {
      const chain = {
        id: startId,
        prev: [],
        next: [],
        head: startId,
        tail: startId,
      };

      const startRecord = await this.getRecord(startId);

      if (!startRecord || (!startRecord.prev && !startRecord.next)) {
        return chain;
      }

      let prevPromise = Promise.resolve([]);
      if (startRecord.prev) {
        chain.prev.push(startRecord.prev);
        prevPromise = this.getAllNeighbours(startRecord.prev, "prev");
      }
      let nextPromise = Promise.resolve([]);
      if (startRecord.next) {
        chain.next.push(startRecord.next);
        nextPromise = this.getAllNeighbours(startRecord.next, "next");
      }

      const [prev, next] = await Promise.all([prevPromise, nextPromise]);

      chain.prev.push(...prev);
      chain.next.push(...next);

      chain.tail = chain.prev.length
        ? chain.prev[chain.prev.length - 1]
        : startId;
      chain.head = chain.next.length
        ? chain.next[chain.next.length - 1]
        : startId;

      return chain;
    }

    /**
     * Clear all cached records for this CN and schema version.
     * @returns {Promise<void>}
     */
    async clearAll() {
      await this.lf.clear();
    }
  }

  // Save the key map as a static property
  VersionStorage.KEY_MAP = KEY_MAP;

  // Singleton instances per CN ID and schema version
  VersionStorage.instances = new Map();

  /**
   * Get the singleton VersionStorage instance for the given CN ID and schema
   * version. This is the preferred way to get a VersionStorage instance to
   * prevent concurrent writes to the same PID from different instances.
   * @param {object} options Initialization options
   * @returns {VersionStorage} The VersionStorage instance.
   */
  VersionStorage.get = (options = {}) => {
    const { cnId, schemaVersion = DEFAULT_SCHEMA_VERSION } = options;
    const key = VersionStorage.createStoreName(cnId, schemaVersion);

    let inst = VersionStorage.instances.get(key);
    if (!inst) {
      inst = new VersionStorage(options);
      VersionStorage.instances.set(key, inst);
    }
    return inst;
  };

  return VersionStorage;
});
