define([
  "md5",
  "models/dataONEServices/DataONEHttpClient",
  "models/PersistentStorage",
], (md5, DataONEHttpClient, PersistentStorage) => {
  const DEFAULT_STORAGE_DOMAIN = "dataone";
  const DEFAULT_STORAGE_ENDPOINT = "generic";
  const DEFAULT_SCHEMA_VERSION = 1;

  /**
   * Base DataONE service with transport + persistent storage helpers.
   */
  class DataONEService {
    /**
     * @param {object} [options] Options for the service instance.
     * @param {string} options.baseUrl Base URL for the DataONE endpoint, e.g.
     * https://cn.dataone.org/cn/v2
     * @param {DataONEHttpClient#DataONEHttpClientOptions} [options.clientConfig]
     * DataONEHttpClient options
     * @param {PersistentStorage#PersistentStorageOptions} [options.storageConfig] Storage
     * options, plus DataONEService namespace fields (e.g. `domain`,
     * `endpoint`, `namespaceOptions`).
     * @param {boolean} [options.persistPrivate] Whether or not to persist
     * private (authenticated) data in storage. Defaults to false.
     * @param {Function} [options.getToken] A function that returns a Promise
     * that resolves to an auth token string.
     * @param {boolean} [options.defaultAuth] Whether or not to send requests
     * with authorization by default, when no auth option is provided, and when
     * a user token is available. Defaults to true.
     */
    constructor({
      baseUrl = "",
      clientConfig = {},
      storageConfig = {},
      persistPrivate = false,
      defaultAuth = true,
      getToken,
    } = {}) {
      if (!baseUrl) throw new Error("DataONEService: baseUrl is required");

      this.baseUrl = baseUrl;
      this.persistPrivate = !!persistPrivate;
      this.defaultAuth = !!defaultAuth;

      this.client = new DataONEHttpClient({
        ...clientConfig,
        baseUrl,
      });

      this.storageConfig = {
        ...storageConfig,
        endpoint: storageConfig.endpoint || DEFAULT_STORAGE_ENDPOINT,
        domain: storageConfig.domain || DEFAULT_STORAGE_DOMAIN,
        schemaVersion:
          storageConfig.schemaVersion && storageConfig.schemaVersion !== 0
            ? storageConfig.schemaVersion
            : DEFAULT_SCHEMA_VERSION,
      };

      if (typeof getToken === "function") {
        this.getToken = getToken;
      }
    }

    /**
     * Build a singleton key for this service. Override in subclasses to
     * include additional options.
     * @param {object} [options] Options used to build the instance key.
     * @returns {string} Singleton key.
     */
    static buildInstanceKey(options = {}) {
      return options?.baseUrl || "";
    }

    /**
     * Get a singleton instance of the service (per key).
     * @param {object} [options] Options used to build the instance key and
     * initialize the service.
     * @returns {DataONEService} Service instance.
     */
    static get(options = {}) {
      if (!this.instances) this.instances = new Map();
      const key = this.buildInstanceKey(options);
      if (!key) {
        throw new Error(`${this.name}.get: baseUrl is required`);
      }
      if (!this.instances.has(key)) {
        this.instances.set(key, new this(options));
      }
      return this.instances.get(key);
    }

    /**
     * Build a cache scope key for a token.
     * @param {string|null|undefined} [token] Token to scope the cache.
     * @returns {string} Cache scope key.
     */
    static scopeKey(token) {
      if (!token) return "public";
      return `auth:${md5(String(token))}`;
    }

    /**
     * Get a PersistentStorage instance scoped by token.
     * @param {string|null|undefined} [token] Token used for cache scoping.
     * @returns {PersistentStorage} Storage instance.
     */
    getStore(token) {
      const {
        namespace,
        namespaceOptions,
        app,
        domain,
        endpoint,
        schemaVersion,
        ttlMs,
        memory,
        name,
      } = this.storageConfig;

      const options = { schemaVersion, ttlMs, memory };
      if (name) options.name = name;

      if (namespace) {
        options.namespace = namespace;
      } else {
        const baseNamespaceOptions = {
          app,
          domain,
          endpoint,
          scope: this.constructor.scopeKey(token),
          baseUrl: this.baseUrl,
        };
        options.namespaceOptions = {
          ...baseNamespaceOptions,
          ...(namespaceOptions || {}),
        };
      }

      return PersistentStorage.get(options);
    }

    /**
     * Resolve an auth token from MetacatUI when available.
     * @returns {Promise<string>} Promise resolving to an auth token.
     */
    static async getToken() {
      const maxAttempts = 25;
      const attemptDelayMs = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        attempts += 1;
        if (typeof MetacatUI !== "undefined" && MetacatUI?.appUserModel) {
          return MetacatUI.appUserModel.getTokenPromise();
        }
        // Otherwise, wait the attempt delay and try again.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, attemptDelayMs);
        });
      }
      // If we reach here, we failed to get the token
      throw new Error("DataONEService: Unable to retrieve auth token");
    }

    /**
     * Determine the token to use, if any, for a request.
     * @param {object} [options] Token resolution options.
     * @param {string|null} [options.token] Specific token to use for this
     * request.
     * If provided, this token will be used instead of calling getToken().
     * @param {boolean} [options.auth] Whether to use authentication for this
     * request. If set to false, no token will be used. If true, getToken() will
     * be called. When undefined, defaultAuth is used.
     * @returns {Promise<string|null>} Promise resolving to the token, or null
     * if no auth.
     */
    async resolveToken({ token, auth } = {}) {
      if (token !== undefined) return token;
      const useAuth = auth !== undefined ? auth : this.defaultAuth;
      if (!useAuth) return null;
      return this.getToken();
    }

    /**
     * Resolve the cache key for a request.
     * @param {string} path Path relative to baseUrl.
     * @param {string|null|undefined} [cacheKey] Cache key override.
     * @returns {string} Resolved cache key.
     */
    static resolveCacheKey(path, cacheKey) {
      return cacheKey !== undefined && cacheKey !== null ? cacheKey : path;
    }

    /**
     * Determine whether caching is allowed for a given token scope.
     * @param {string|null|undefined} [token] Token used for cache scoping.
     * @returns {boolean} Whether caching is allowed.
     */
    shouldUseCache(token) {
      return !token || this.persistPrivate;
    }

    /**
     * Send a request via the DataONEHttpClient.
     * @param {object} [options] Request options passed to
     * {@link DataONEHttpClient#request}, plus auth controls.
     * @param {string} options.path Path relative to baseUrl.
     * @param {string|null} [options.token] Token to use for this request.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the
     * response.
     */
    async request(options = {}) {
      const { auth, token, ...clientOptions } = options;
      const resolvedToken = await this.resolveToken({ token, auth });
      return this.client.request({
        ...clientOptions,
        token: resolvedToken,
      });
    }

    /**
     * Download data from a path with optional caching.
     * @param {string} path Path relative to baseUrl.
     * @param {object} [options] Options passed to
     * {@link DataONEHttpClient#request} (except `path`), plus cache controls.
     * @param {string|null} [options.token] Token to use for this request.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @param {boolean} [options.useCache] Whether to cache responses, default
     * true.
     * @param {string} [options.cacheKey] Cache key override.
     * @param {number|null} [options.cacheTtlMs] Cache TTL override.
     * @returns {Promise<*>} Promise resolving to response data.
     */
    async download(path, options = {}) {
      const {
        auth,
        token,
        useCache = true,
        cacheKey,
        cacheTtlMs,
        ...clientOptions
      } = options;

      const resolvedToken = await this.resolveToken({ token, auth });
      const cacheAllowed = useCache && this.shouldUseCache(resolvedToken);
      const resolvedCacheKey = cacheKey !== undefined ? cacheKey : path;

      if (cacheAllowed && resolvedCacheKey) {
        const store = this.getStore(resolvedToken);
        const cached = await store.getItem(resolvedCacheKey);
        if (cached !== null && cached !== undefined) {
          return cached;
        }
      }

      const response = await this.client.request({
        ...clientOptions,
        path,
        method: clientOptions.method || "GET",
        token: resolvedToken,
      });

      if (cacheAllowed && resolvedCacheKey) {
        const store = this.getStore(resolvedToken);
        await store.setItem(resolvedCacheKey, response.data, {
          ttlMs: cacheTtlMs,
        });
      }

      return response.data;
    }

    /**
     * Upload data to a path.
     * @param {string} path Path relative to baseUrl.
     * @param {object} [options] Options passed to
     * {@link DataONEHttpClient#request} (except `path`), plus cache controls.
     * @param {string|null} [options.token] Token to use for this request.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @param {string} [options.cacheKey] Cache key override.
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the
     * response.
     */
    async upload(path, options = {}) {
      const { auth, token, cacheKey, ...clientOptions } = options;
      const resolvedToken = await this.resolveToken({ token, auth });

      const response = await this.client.request({
        ...clientOptions,
        path,
        method: clientOptions.method || "PUT",
        token: resolvedToken,
      });

      // If successful uploaded, update the cache with the new data
      const resolvedCacheKey = this.constructor.resolveCacheKey(path, cacheKey);
      const cacheAllowed = this.shouldUseCache(resolvedToken);
      if (cacheAllowed && resolvedCacheKey) {
        const store = this.getStore(resolvedToken);
        // TODO: consider fire & forget to avoid slowing down upload. Not
        // essential that cache is updated.
        await store.setItem(resolvedCacheKey, clientOptions.body);
      }

      return response;
    }

    /**
     * Get a cached value scoped by the resolved token.
     * @param {string} key Cache key.
     * @param {object} [options] Cache scope options.
     * @param {string|null} [options.token] Token to use for cache scope.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @returns {Promise<*>} Promise resolving to the cached value.
     */
    async getCached(key, { token, auth } = {}) {
      if (!key) return null;
      const resolvedToken = await this.resolveToken({ token, auth });
      if (!this.shouldUseCache(resolvedToken)) return null;
      const store = this.getStore(resolvedToken);
      return store.getItem(key);
    }

    /**
     * Check whether a value exists in the cache for the resolved token scope.
     * @param {string} key Cache key.
     * @param {object} [options] Cache scope options.
     * @param {string|null} [options.token] Token to use for cache scope.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @returns {Promise<boolean>} Promise resolving to whether the value is
     * cached.
     */
    async isCached(key, { token, auth } = {}) {
      const value = await this.getCached(key, { token, auth });
      return value !== null && value !== undefined;
    }

    /**
     * Store a value in the cache for the resolved token scope.
     * @param {string} key Cache key.
     * @param {*} value Value to store.
     * @param {object} [options] Cache scope options.
     * @param {string|null} [options.token] Token to use for cache scope.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @param {number|null} [options.ttlMs] Override cache TTL in ms.
     * @returns {Promise<*>} Promise resolving to the stored value.
     */
    async setCached(key, value, { token, auth, ttlMs } = {}) {
      if (!key) return value;
      const resolvedToken = await this.resolveToken({ token, auth });
      if (!this.shouldUseCache(resolvedToken)) return value;
      const store = this.getStore(resolvedToken);
      await store.setItem(key, value, { ttlMs });
      return value;
    }

    /**
     * Remove a cached value for the resolved token scope.
     * @param {string} key Cache key.
     * @param {object} [options] Cache scope options.
     * @param {string|null} [options.token] Token to use for cache scope.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @returns {Promise<void>} Promise resolving when removal completes.
     */
    async removeCached(key, { token, auth } = {}) {
      if (!key) return;
      const resolvedToken = await this.resolveToken({ token, auth });
      const store = this.getStore(resolvedToken);
      await store.removeItem(key);
    }

    /**
     * Clear the cache for the resolved token scope.
     * @param {object} [options] Cache scope options.
     * @param {string|null} [options.token] Token to use for cache scope.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @returns {Promise<void>} Promise resolving when the cache is cleared.
     */
    async clearCache({ token, auth } = {}) {
      const resolvedToken = await this.resolveToken({ token, auth });
      const store = this.getStore(resolvedToken);
      await store.clear();
    }
  }

  DataONEService.DEFAULT_STORAGE_DOMAIN = DEFAULT_STORAGE_DOMAIN;
  DataONEService.DEFAULT_STORAGE_ENDPOINT = DEFAULT_STORAGE_ENDPOINT;
  DataONEService.DEFAULT_SCHEMA_VERSION = DEFAULT_SCHEMA_VERSION;

  return DataONEService;
});
