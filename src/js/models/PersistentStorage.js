define(["localforage", "common/ErrorUtilities", "common/ValueUtilities"], (
  localforage,
  ErrorUtilities,
  ValueUtilities,
) => {
  // Default TTL: 1 hour
  const DEFAULT_TTL_MS = 60 * 60 * 1000;
  // Change this when making breaking schema changes
  const DEFAULT_SCHEMA_VERSION = 1;
  // The default memory cache setting
  const DEFAULT_MEMORY_ENABLED = true;
  // Convert a string to alphanumeric + underscores (localforage requirement)
  const toAlphanumUnderscore = (str) => str.replace(/[^a-z0-9]/gi, "_");

  /**
   * Options for PersistentStorage
   * @typedef {object} PersistentStorageOptions
   * @property {number|null} [ttlMs] Default TTL in milliseconds. Null, 0, or
   * other falsey value disables automatic TTL-based record expiration. Defaults
   * to 1 hour.
   * @property {number} [schemaVersion] Schema version for the store
   * @property {boolean} [memory] Enable in-memory cache layer
   * @property {string[]} [instanceKeys] A list of strings to include in the
   * namespace for the store and the key/is for this instance. Use this to
   * ensure the store is unique to your the case (e.g., baseUrl, authorization,
   * endpoint, etc). Other options like ttlMs, schemaVersion, etc. are
   * automatically included in the instance key and store namespace.
   * @property {object} [localforageConfig] Extra config passed to
   * localforage.createInstance. If a name or storeName is provided here, it
   * will override the generated instance key.
   */

  /**
   * PersistentStorage is a small wrapper around localforage that adds TTL
   * expiration, optional in-memory caching, and per-key locking to prevent
   * concurrent writes from stepping on each other. Use the static `get()`
   * helper to ensure a single instance per namespace and schema version is
   * used.
   * @class PersistentStorage
   * @since 0.0.0
   */
  class PersistentStorage {
    /**
     * @param {PersistentStorageOptions} options Options for the store
     */
    constructor(options) {
      const { ttlMs, schemaVersion, memory, localforageConfig } =
        this.constructor.normalizeOptions(options);

      this.schemaVersion = schemaVersion;
      this.memoryEnabled = memory;
      this.memoryCache = this.memoryEnabled ? new Map() : null;
      this.locks = new Map();
      this.ttlMs = ttlMs;

      // Use the same instanceKey that we generate for the singleton map
      // for the local forage store name and DB name.
      const instanceKey = this.constructor.buildInstanceKey(options);
      this.instanceKey = instanceKey;

      this.lf = localforage.createInstance({
        // Unless overwritten by localforageConfig, create one object store per
        // database instance for simplicity (name === storeName)
        name: instanceKey,
        storeName: instanceKey,
        version: schemaVersion,
        ...localforageConfig,
      });
    }

    /**
     * Normalize the options for creating a PersistentStorage instance.
     * @param {PersistentStorageOptions} options Options passed to the
     * constructor for this instance
     * @returns {object} Options with defaults applied and values standardized
     */
    static normalizeOptions(options = {}) {
      const {
        instanceKeys = ["default"],
        ttlMs = DEFAULT_TTL_MS,
        schemaVersion = DEFAULT_SCHEMA_VERSION,
        memory = DEFAULT_MEMORY_ENABLED,
        localforageConfig = {},
      } = options;

      // Use a falsey value to disable TTL
      let ttlMsNormalized = DEFAULT_TTL_MS;
      if (!ttlMs) {
        ttlMsNormalized = null;
      } else if (typeof ttlMs !== "number" || ttlMs < 0) {
        throw new Error(
          "ttlMs must be a non-negative number or null/0 to disable",
        );
      } else {
        ttlMsNormalized = ttlMs;
      }

      const memoryEnabled = !!memory;

      let instanceKeySuffix = "";
      if (instanceKeys && instanceKeys.length > 0) {
        const suffixParts = instanceKeys.reduce((acc, part) => {
          const sanitized = this.sanitizeNamespacePart(part);
          if (sanitized.length > 0) acc.push(sanitized);
          return acc;
        }, []);
        instanceKeySuffix = suffixParts.join("|");
      }

      return {
        ttlMs: ttlMsNormalized,
        schemaVersion,
        memory: memoryEnabled,
        localforageConfig,
        instanceKeySuffix,
      };
    }

    /**
     * Normalize a string so it is safe to use in a PersistentStorage namespace.
     * @param {string} part A part of a namespace
     * @returns {string} Sanitized part
     */
    static sanitizeNamespacePart(part) {
      if (part === null || part === undefined) return "";
      let strPart = String(part).trim();
      // Just remove http(s):// and www. for URLs
      const urlPattern = /^(https?:\/\/)?(www\.)?/i;
      strPart = strPart.replace(urlPattern, "");
      // Remove any trailing slashes, incase it's a URL
      strPart = strPart.replace(/\/+$/i, "");
      // Make the case the same for all
      strPart = strPart.toLowerCase();
      // localForage: "Must be alphanumeric, with underscores."
      return toAlphanumUnderscore(strPart);
    }

    /**
     * Build a unique namespace string for the PersistentStorage instance based
     * on the options provided to the constructor. This is used to create
     * singleton instances of PersistentStorage, so that different parts of the
     * app can share the same store if they use the same options.
     * @param {object} options Options for the PersistentStorage instance
     * @returns {string} The namespace string
     */
    static buildInstanceKey(options) {
      const normalizedOptions = PersistentStorage.normalizeOptions(options);
      const keyFields = [
        "ttlMs",
        "schemaVersion",
        "memory",
        "instanceKeySuffix",
        "localforageConfig",
      ];
      const normalizers = {
        localforageConfig: ValueUtilities.stableStringify,
      };
      return ValueUtilities.buildInstanceKey(
        normalizedOptions,
        keyFields,
        normalizers,
      );
    }

    /**
     * Get a singleton PersistentStorage instance for the provided namespace and
     * schema version.
     * @param {object} options Options for the PersistentStorage instance
     * @returns {PersistentStorage} The PersistentStorage instance
     */
    static get(options = {}) {
      return ValueUtilities.getSingleton(this, options, this.buildInstanceKey);
    }

    /**
     * Detect quota errors across storage backends.
     * @param {Error|string} e The error to check
     * @returns {boolean} True if the error indicates a quota/exceeded storage
     * condition
     */
    static isQuotaError(e) {
      return ErrorUtilities.isQuotaError(e);
    }

    /**
     * Determine if a record is expired. (Instance method version that calls the
     * static method for convenience.)
     * @param {object} record The record to check
     * @returns {boolean} True if expired
     */
    isExpired(record) {
      return this.constructor.isExpired(record);
    }

    /**
     * Determine if a record is expired.
     * @param {object} record The record to check
     * @returns {boolean} True if expired
     */
    static isExpired(record) {
      const { expiresAt } = record || {};
      // If no expiration time is set, it never expires
      if (expiresAt === null || expiresAt === undefined) return false;
      if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
        // Invalid expiresAt value, treat as expired to be safe
        return true;
      }
      return Date.now() > expiresAt;
    }

    /**
     * Normalize a raw stored value to a record with metadata.
     * @param {*} raw The raw stored value
     * @returns {{value: *, expiresAt: number|null}} The record
     * @private
     */
    static decodeRecord(raw) {
      if (
        raw &&
        typeof raw === "object" &&
        Object.prototype.hasOwnProperty.call(raw, "value")
      ) {
        if (typeof raw.expiresAt === "number") {
          return {
            value: raw.value,
            expiresAt: raw.expiresAt,
          };
        }
        return {
          value: raw.value,
          expiresAt: null,
        };
      }
      return { value: raw, expiresAt: null };
    }

    /**
     * Build the record envelope to persist.
     * @param {*} value The value to store
     * @param {number|null|undefined} ttlMs TTL in milliseconds
     * @returns {{value: *, expiresAt: number|null}} The record
     * @private
     */
    static encodeRecord(value, ttlMs) {
      return {
        value,
        expiresAt:
          typeof ttlMs === "number" && ttlMs > 0 ? Date.now() + ttlMs : null,
      };
    }

    /**
     * Serialize otherwise async operations for a given key. For example, use
     * this to avoid concurrent writes to IndexedDB/localForage for the same
     * PID. Each new job is chained onto the promise of the previous job for
     * that key. Calls for different keys run independently.
     *
     * Important:
     *   - Concurrency is only controlled within the same JS environment (same
     *     tab, worker, or process). This does not synchronize work across
     *     multiple browser tabs or windows.
     *   - You must pass a shared locks Map instance. If each caller creates its
     *     own Map, locking will not work.
     *  @param {string} key The lock name. All calls sharing this key are
     *  serialized.
     *  @param {Function} fn The async or sync function to run once any previous
     *  jobs for this key complete. May return a value or a Promise.
     *  @param {Function} [onPreviousError] - Callback invoked with errors from
     *  earlier jobs in the chain.
     *  @returns {Promise<*>} The resolved value of fn.
     */
    async withLock(key, fn, onPreviousError = null) {
      const { locks } = this;
      const existingJob = locks.get(key);
      const previous = existingJob || Promise.resolve();

      const job = previous
        .catch((err) => {
          if (typeof onPreviousError === "function") {
            onPreviousError(err);
          }
        })
        .then(fn);

      locks.set(key, job);

      try {
        const result = await job;
        return result;
      } finally {
        // Clean up the lock if it's still pointing to this job
        if (locks.get(key) === job) {
          locks.delete(key);
        }
      }
    }

    /**
     * Get the full record (value + metadata) for a key.
     * @param {string} key The storage key
     * @returns {Promise<object|null>} The record, or null if not found/expired
     */
    async getRecord(key) {
      if (!key) throw new Error("A key is required");

      if (this.memoryEnabled && this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        if (!this.isExpired(cached)) return cached;
        this.memoryCache.delete(key);
      }

      return this.withLock(key, async () => {
        const raw = await this.lf.getItem(key);
        if (raw === null || raw === undefined) return null;

        const record = this.constructor.decodeRecord(raw);
        if (this.isExpired(record)) {
          if (this.memoryEnabled) this.memoryCache.delete(key);
          await this.lf.removeItem(key);
          return null;
        }

        if (this.memoryEnabled) this.memoryCache.set(key, record);
        return record;
      });
    }

    /**
     * Get only the stored value for a key.
     * @param {string} key The storage key
     * @returns {Promise<*|null>} The stored value, or null if not found/expired
     */
    async getItem(key) {
      const record = await this.getRecord(key);
      return record ? record.value : null;
    }

    /**
     * Persist a value with optional TTL override.
     * @param {string} key The storage key
     * @param {*} value The value to store
     * @param {object} [options] Optional settings
     * @param {number|null} [options.ttlMs] TTL in milliseconds. Null disables
     * expiration.
     * @returns {Promise<*>} The saved value
     */
    async setItem(key, value, options = {}) {
      if (!key) throw new Error("A key is required");
      const normalizedOptions =
        options && typeof options === "object" ? options : {};
      const { ttlMs } = normalizedOptions;
      const effectiveTtlMs = ttlMs === undefined ? this.ttlMs : ttlMs;
      const record = this.constructor.encodeRecord(value, effectiveTtlMs);
      await this.withLock(key, async () => {
        try {
          await this.lf.setItem(key, record);
        } catch (e) {
          if (this.constructor.isQuotaError(e)) {
            await this.clear({ awaitLocks: false });
            await this.lf.setItem(key, record);
          } else {
            throw e;
          }
        }
      });
      if (this.memoryEnabled) this.memoryCache.set(key, record);
      return value;
    }

    /**
     * Remove a key from storage.
     * @param {string} key The storage key
     * @returns {Promise<void>}
     */
    async removeItem(key) {
      if (!key) return;
      if (this.memoryEnabled) this.memoryCache.delete(key);
      await this.withLock(key, async () => {
        await this.lf.removeItem(key);
      });
    }

    /**
     * Clear the entire store.
     * @param {object} [options] Optional settings
     * @param {boolean} [options.awaitLocks] Wait for in-flight lock operations
     * before clearing. Defaults to true.
     * @returns {Promise<void>}
     */
    async clear({ awaitLocks = true } = {}) {
      if (awaitLocks && this.locks.size > 0) {
        await Promise.allSettled(Array.from(this.locks.values()));
      }
      if (this.memoryEnabled) this.memoryCache.clear();
      // Preserve in-flight lock tracking when awaitLocks is false so new jobs
      // for the same key continue to serialize behind active jobs.
      if (awaitLocks) {
        this.locks.clear();
      }
      await this.lf.clear();
    }

    /**
     * Clear all expired records from the store.
     * @returns {Promise<string[]>} Array of removed keys
     */
    async clearExpired() {
      const keysToRemove = [];
      await this.lf.iterate((value, key) => {
        const record = this.constructor.decodeRecord(value);
        if (this.isExpired(record)) {
          keysToRemove.push(key);
        }
      });
      await Promise.all(keysToRemove.map((key) => this.removeItem(key)));
      return keysToRemove;
    }

    /**
     * Check if a record exists and is not expired for a given key. It will
     * return true for non-expired records even when the value is falsey
     * @param {string} key The storage key
     * @returns {Promise<boolean>} True if the record exists
     */
    async hasRecord(key) {
      const record = await this.getRecord(key);
      return !!record;
    }

    /**
     * Get all keys in the store.
     * @returns {Promise<string[]>} Array of keys
     */
    keys() {
      return this.lf.keys();
    }

    /**
     * Get the number of keys in the store.
     * @returns {Promise<number>} Number of keys
     */
    length() {
      return this.lf.length();
    }
  }

  // Map of singleton PersistentStorage instances
  PersistentStorage.instances = new Map();

  // Add the defaults for reference
  PersistentStorage.DEFAULT_TTL_MS = DEFAULT_TTL_MS;
  PersistentStorage.DEFAULT_SCHEMA_VERSION = DEFAULT_SCHEMA_VERSION;
  PersistentStorage.DEFAULT_MEMORY_ENABLED = DEFAULT_MEMORY_ENABLED;

  return PersistentStorage;
});
