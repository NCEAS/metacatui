define(["localforage"], (localforage) => {
  // Default TTL: 1 hour
  const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
  // Change this when making breaking schema changes
  const DEFAULT_SCHEMA_VERSION = 1;
  // Default localforage DB name
  const DEFAULT_NAME = "MetacatUI_Persistent";
  // The default memory cache setting
  const DEFAULT_MEMORY_ENABLED = true;
  // Convert a string to alphanumeric + underscores (localforage requirement)
  const toAlphanumUnderscore = (str) => str.replace(/[^a-z0-9]/gi, "_");

  /**
   * Options for PersistentStorage
   * @typedef {object} PersistentStorageOptions
   * @property {string} namespace Logical namespace for the store
   * @property {number|null} [ttlMs] Default TTL in milliseconds. Null
   * disables expiration. Defaults to 24h.
   * @property {number} [schemaVersion] Schema version for the store
   * @property {string} [name] localforage DB name
   * @property {boolean} [memory] Enable in-memory cache layer
   * @property {object} [localforageConfig] Extra config passed to
   * localforage.createInstance
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
    constructor({
      namespace,
      ttlMs = DEFAULT_TTL_MS,
      schemaVersion = DEFAULT_SCHEMA_VERSION,
      name = DEFAULT_NAME,
      memory = DEFAULT_MEMORY_ENABLED,
      localforageConfig = {},
    } = {}) {
      if (typeof namespace !== "string" || !namespace.length) {
        throw new Error("A namespace is required for PersistentStorage");
      }

      this.namespace = namespace;
      this.ttlMs = typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : null;
      this.schemaVersion = schemaVersion;
      this.memoryEnabled = !!memory;
      this.memoryCache = this.memoryEnabled ? new Map() : null;
      this.locks = new Map();

      this.lf = localforage.createInstance({
        name,
        storeName: this.constructor.createStoreName(namespace, schemaVersion),
        version: this.schemaVersion,
        ...localforageConfig,
      });
    }

    /**
     * Create a valid store name for localforage based on namespace + schema.
     * @param {string} namespace Logical namespace
     * @param {number} [schemaVersion] Schema version
     * @returns {string} Store name
     */
    static createStoreName(namespace, schemaVersion = DEFAULT_SCHEMA_VERSION) {
      const safeNamespace = toAlphanumUnderscore(namespace);
      return `${safeNamespace}_v${schemaVersion}`;
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
      // localForage: "Must be alphanumeric, with underscores."
      return toAlphanumUnderscore(strPart);
    }

    /**
     * Build a consistent namespace string for a given service/context.
     * Suggested convention: <app>__<domain>__<endpoint>__<scope>__[baseUrl]
     * @param {object} options Options for building the namespace
     * @param {string} [options.app] Application/product identifier
     * @param {string} options.domain Logical domain (e.g. "dataone",
     * "bioportal")
     * @param {string} options.endpoint Logical endpoint name (e.g. "sysmeta")
     * @param {string} [options.scope] Authorization scope (e.g. "public",
     * "auth:<hash>")
     * @param {string} [options.baseUrl] Base URL for the upstream service
     * @returns {string} Namespace string
     */
    static buildNamespace({
      app = "metacatui",
      domain,
      endpoint,
      scope = "public",
      baseUrl = "",
    } = {}) {
      if (!domain)
        throw new Error("PersistentStorage.buildNamespace: domain is required");
      if (!endpoint)
        throw new Error(
          "PersistentStorage.buildNamespace: endpoint is required",
        );

      const parts = [
        this.sanitizeNamespacePart(app),
        this.sanitizeNamespacePart(domain),
        this.sanitizeNamespacePart(endpoint),
        this.sanitizeNamespacePart(scope || "public"),
        this.sanitizeNamespacePart(baseUrl),
      ];

      // '__' separator for readability
      return parts.filter(Boolean).join("__");
    }

    /**
     * Get a singleton PersistentStorage instance for the provided namespace and
     * schema version. Important: the singleton key is name + storeName
     * (namespace + schemaVersion). If you call `get()` again with the same key
     * but different config (ttlMs, memory, localforageConfig), the function
     * throws to avoid silently reusing a store with unexpected behavior.
     * @param {object} options Options for the PersistentStorage instance
     * @param {object} [options.namespaceOptions] Options passed to
     * buildNamespace()
     * @returns {PersistentStorage} The PersistentStorage instance
     */
    static get(options = {}) {
      const {
        namespace: explicitNamespace,
        namespaceOptions,
        schemaVersion = DEFAULT_SCHEMA_VERSION,
        name = DEFAULT_NAME,
      } = options;

      const normalizedOptions = { ...options };

      const namespace =
        explicitNamespace ??
        (namespaceOptions ? this.buildNamespace(namespaceOptions) : null);

      if (!namespace) {
        throw new Error(
          "PersistentStorage.get: namespace or namespaceOptions is required",
        );
      }

      normalizedOptions.namespace = namespace;
      normalizedOptions.schemaVersion = schemaVersion;

      if (!this.instances) this.instances = new Map();

      const storeName = this.createStoreName(namespace, schemaVersion);
      const key = `${name}__${storeName}`;

      if (!this.instances.has(key)) {
        this.instances.set(key, new PersistentStorage(normalizedOptions));
        return this.instances.get(key);
      }

      const instance = this.instances.get(key);

      // Guard against subtle bugs where callers assume `get()` will honor new
      // options. If you want a different config, use a different namespace
      // and/or schemaVersion.
      const requestedTtlMs =
        typeof normalizedOptions.ttlMs === "number" &&
        normalizedOptions.ttlMs > 0
          ? normalizedOptions.ttlMs
          : DEFAULT_TTL_MS;
      const requestedMemoryEnabled =
        normalizedOptions.memory !== undefined
          ? !!normalizedOptions.memory
          : DEFAULT_MEMORY_ENABLED;

      if (requestedTtlMs !== instance.ttlMs) {
        throw new Error(
          `PersistentStorage.get: Conflicting ttlMs for "${key}". ` +
            `Existing instance ttlMs=${instance.ttlMs}, requested ttlMs=${requestedTtlMs}. ` +
            `Use a different namespace or schemaVersion if you need different TTL behavior.`,
        );
      }

      if (requestedMemoryEnabled !== instance.memoryEnabled) {
        throw new Error(
          `PersistentStorage.get: Conflicting memory setting for "${key}". ` +
            `Existing instance memory=${instance.memoryEnabled}, requested memory=${requestedMemoryEnabled}. ` +
            `Use a different namespace or schemaVersion if you need different memory behavior.`,
        );
      }

      // Don't deep compare localforageConfig since it be
      // complex/non-serializable.
      return instance;
    }

    /**
     * Detect quota errors across storage backends.
     * @param {Error|string} e The error to check
     * @returns {boolean} True if the error indicates a quota/exceeded storage
     * condition
     */
    static isQuotaError(e) {
      const quotaMessages = [
        "QuotaExceededError",
        "QUOTA_EXCEEDED_ERR",
        "QUOTA_BYTES_EXCEEDED",
        "quota",
        "exceeded",
      ];
      let msg = typeof e === "string" ? e : e?.message || "";
      msg = msg.toLowerCase();
      return quotaMessages.some((qm) => msg.includes(qm.toLowerCase()));
    }

    /**
     * Determine if a record is expired.
     * @param {object} record The record to check
     * @returns {boolean} True if expired
     */
    isExpired(record) {
      const ttl = typeof record?.ttlMs === "number" ? record.ttlMs : this.ttlMs;
      if (!ttl) return false;
      if (typeof record?.updatedAt !== "number") return false;
      return Date.now() - record.updatedAt > ttl;
    }

    /**
     * Normalize a raw stored value to a record with metadata.
     * @param {*} raw The raw stored value
     * @returns {{value: *, updatedAt: number, ttlMs: number|null}} The record
     * @private
     */
    static decodeRecord(raw) {
      if (
        raw &&
        typeof raw === "object" &&
        Object.prototype.hasOwnProperty.call(raw, "value")
      ) {
        return {
          value: raw.value,
          updatedAt: raw.updatedAt ?? 0,
          ttlMs: raw.ttlMs ?? null,
        };
      }
      return { value: raw, updatedAt: 0, ttlMs: null };
    }

    /**
     * Build the record envelope to persist.
     * @param {*} value The value to store
     * @param {number|null|undefined} ttlMs TTL in milliseconds
     * @returns {{value: *, updatedAt: number, ttlMs: number|null}} The record
     * @private
     */
    static encodeRecord(value, ttlMs) {
      return {
        value,
        updatedAt: Date.now(),
        ttlMs: typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : null,
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

      const previous = locks.get(key) || Promise.resolve();

      const job = previous
        .catch((err) => {
          if (typeof onPreviousError === "function") {
            onPreviousError(err);
          }
        })
        .then(fn);

      locks.set(key, job);

      try {
        return await job;
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

      const raw = await this.lf.getItem(key);
      if (raw === null || raw === undefined) return null;

      const record = this.constructor.decodeRecord(raw);
      if (this.isExpired(record)) {
        await this.removeItem(key);
        return null;
      }

      if (this.memoryEnabled) this.memoryCache.set(key, record);
      return record;
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
    async setItem(key, value, { ttlMs } = {}) {
      if (!key) throw new Error("A key is required");
      const record = this.constructor.encodeRecord(value, ttlMs);
      await this.withLock(key, async () => {
        try {
          await this.lf.setItem(key, record);
        } catch (e) {
          if (this.constructor.isQuotaError(e)) {
            await this.clear();
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
        try {
          await this.lf.removeItem(key);
        } catch (e) {
          // Failing to remove an item is not a critical error.
          // eslint-disable-next-line no-console
          console.error(`PersistentStorage: Failed to remove key "${key}":`, e);
        }
      });
    }

    /**
     * Clear the entire store.
     * @returns {Promise<void>}
     */
    async clear() {
      if (this.memoryEnabled) this.memoryCache.clear();
      this.locks.clear();
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
     * Check if a key exists and is not expired.
     * @param {string} key The storage key
     * @returns {Promise<boolean>} True if the key exists and is valid
     */
    async hasKey(key) {
      return this.getItem(key).then(
        (value) => value !== null && value !== undefined,
      );
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

  return PersistentStorage;
});
