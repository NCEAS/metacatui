define([
  "md5",
  "models/dataONEServices/DataONEHttpClient",
  "models/PersistentStorage",
  "common/Utilities",
], (md5, DataONEHttpClient, PersistentStorage, Utilities) => {
  /**
   * Extensible base class for DataONE API services, e.g. the System Metadata
   * service. It includes in-memory and persistent caching scoped by user
   * authentication, deduplication of in-flight requests handled by the
   * DataONEHttpClient, and utility methods for making requests. This class
   * always uses singleton instances of DataONEHttpClient and PersistentStorage
   * to ensure that deduplication and caching work properly across all service
   * instances with the same configuration.
   * @class DataONEService
   * @since 2.37.0
   * @classcategory Models/DataONEServices
   */
  class DataONEService {
    /**
     * @param {object} [options] Options for the service instance.
     * @param {string} options.baseUrl Base URL for the DataONE endpoint, e.g.
     * https://cn.dataone.org/cn/v2
     * @param {DataONEHttpClient#DataONEHttpClientOptions} [options.clientConfig]
     * DataONEHttpClient options
     * @param {PersistentStorage#PersistentStorageOptions} [options.storageConfig]
     * Storage options, plus DataONEService namespace
     * fields (e.g. `domain`, `endpoint`, `app`, `scope`, `baseUrl`).
     * @param {boolean} [options.persistPrivate] Whether or not to persist
     * private (authenticated) data in storage. Defaults to false.
     * @param {Function} [options.getToken] A function that returns a Promise
     * that resolves to an auth token string.
     * @param {Function} [options.getUserName] A function that returns a Promise
     * that resolves to the current username string.
     * @param {boolean} [options.defaultAuth] Whether or not to send requests
     * with authorization by default, when no auth option is provided, and when
     * a user token is available. Defaults to true.
     */
    constructor(options) {
      const sourceOptions = options || {};
      const normalized = this.constructor.normalizeOptions(sourceOptions);

      this.persistPrivate = normalized.persistPrivate;
      this.defaultAuth = normalized.defaultAuth;
      this.client = DataONEHttpClient.get(normalized.clientConfig);
      this.storageConfig = normalized.storageConfig;

      // functions get lost during normalization, use originals
      if (typeof sourceOptions.getToken === "function") {
        this.getToken = sourceOptions.getToken;
      }
      if (typeof sourceOptions.getUserName === "function") {
        this.getUserName = sourceOptions.getUserName;
      }
    }

    /**
     * Normalize the options used to construct a new instance.
     * @param {object} options Options paseed to the constructor.
     * @returns {object} Normalized options.
     */
    static normalizeOptions(options = {}) {
      const normalized = JSON.parse(JSON.stringify(options));
      if (!normalized.baseUrl) {
        throw new Error("DataONEService: baseUrl is required");
      }
      normalized.baseUrl = Utilities.normalizeUrl(normalized.baseUrl);

      normalized.clientConfig = {
        ...normalized.clientConfig,
        baseUrl: normalized.baseUrl,
      };

      normalized.storageConfig = normalized.storageConfig || {};
      if (!normalized.storageConfig.instanceKeys?.length) {
        normalized.storageConfig.instanceKeys = [];
        normalized.storageConfig.instanceKeys.push(normalized.baseUrl);
      }

      // if persistPrivate is not a boolean, default to false
      normalized.persistPrivate =
        typeof normalized.persistPrivate === "boolean"
          ? normalized.persistPrivate
          : false;

      // if defaultAuth is not a boolean, default to true
      normalized.defaultAuth =
        typeof normalized.defaultAuth === "boolean"
          ? normalized.defaultAuth
          : true;
      return normalized;
    }

    /**
     * If user is logged in, get a key based on their username; otherwise,
     * return a "public" scope key.
     * @returns {Promise<string>} Promise resolving to the scope key.
     */
    async scopeKey() {
      const userName = await this.getUserName();
      return `auth:${md5(userName || "public")}`;
    }

    /**
     * Get a PersistentStorage instance automatically scoped by the logged in
     * user, using the configuration options provided to the constructor.
     * @returns {PersistentStorage} Storage instance.
     */
    async getStore() {
      const scopeKey = await this.scopeKey();
      const options = JSON.parse(JSON.stringify(this.storageConfig));
      options.instanceKeys = options.instanceKeys || [];
      options.instanceKeys.push(scopeKey);
      return PersistentStorage.get(options);
    }

    /**
     * Wait for the MetacatUI app user model to be available, and return it.
     * @returns {Promise<Backbone.Model>} Promise resolving to the user model.
     */
    static async awaitUserModel() {
      return Utilities.awaitMetacatUI({ property: "appUserModel" });
    }

    /**
     * Resolve the current username from the MetacatUI app user model.
     * @returns {Promise<string|null>} Promise resolving to the username, or
     * null if unavailable.
     */
    async getUserName() {
      const userModel = await this.constructor.awaitUserModel();
      let userName = userModel.get("username");
      if (!userName) {
        try {
          await this.getToken(); // Parses token and sets username
          // small pause to ensure parsing is complete and username is set
          await new Promise((resolve) => {
            setTimeout(resolve, 10);
          });
          userName = userModel.get("username");
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(
            "Failed to get username from token, assuming anonymous user.",
            e,
          );
        }
      }
      return userName || null;
    }

    /**
     * Resolve an auth token from MetacatUI when available.
     * @returns {Promise<string>} Promise resolving to an auth token.
     */
    async getToken() {
      const userModel = await this.constructor.awaitUserModel();
      let token = userModel.get("token");
      if (!token && userModel.get("tokenChecked") !== true) {
        try {
          token = await userModel.getTokenPromise();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("Failed to get token from MetacatUI user model.", e);
        }
      }
      return token || null;
    }

    /**
     * Determine the token to use, if any, for a request.
     * @param {boolean} [auth] Whether to use authentication for this request.
     * If set to false, no token will be used. If true, getToken() will be
     * called. When undefined, defaultAuth is used.
     * @returns {Promise<string|null>} Promise resolving to the token, or null
     * if no auth.
     */
    async resolveToken(auth) {
      // If auth is explicitly set to false, don't use a token
      const useAuth = typeof auth === "boolean" ? auth : this.defaultAuth;
      if (!useAuth) return null;
      // If auth is true (or defaultAuth is true), resolve the token
      // automatically. This will return null if user is not logged in.
      return this.getToken();
    }

    /**
     * Use the path as the cache key by default, but allow an override if
     * desired.
     * @param {string} path Path relative to baseUrl.
     * @param {string|null|undefined} [cacheKey] Cache key override.
     * @returns {string} Resolved cache key.
     */
    static resolveCacheKey(path, cacheKey) {
      return cacheKey !== undefined && cacheKey !== null ? cacheKey : path;
    }

    /**
     * Determine whether caching is allowed for the current user scope.
     * @returns {Promise<boolean>} Promise resolving to whether caching is
     * allowed.
     */
    async shouldUseCache() {
      // If we always persist private data, caching is allowed in all cases
      if (this.persistPrivate) {
        return true;
      }
      // otherwise, if user is not logged in (public data) allow caching
      const user = await this.getUserName();
      return !user;
    }

    /**
     * Send a request via the DataONEHttpClient.
     * @param {object} [options] Request options passed to
     * {@link DataONEHttpClient#request}, plus auth controls.
     * @param {string} options.path Path relative to baseUrl.
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the
     * response.
     */
    async request(options = {}) {
      const { auth, ...clientOptions } = options;
      const resolvedToken = await this.resolveToken(auth);
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
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @param {boolean} [options.useCache] Whether to cache responses, default
     * true.
     * @param {string} [options.cacheKey] Cache key override.
     * @param {number|null} [options.cacheTtlMs] Cache TTL override.
     * @returns {Promise<*>} Promise resolving to response data.
     */
    async download(path, options = {}) {
      const {
        useCache = true,
        cacheKey,
        cacheTtlMs,
        ...clientOptions
      } = options;

      const resolvedCacheKey = this.constructor.resolveCacheKey(path, cacheKey);
      const cacheAllowed = useCache !== false;

      if (cacheAllowed) {
        const cached = await this.getCached(resolvedCacheKey);
        if (cached !== null && cached !== undefined) {
          return cached;
        }
      }

      const response = await this.request({
        ...clientOptions,
        path,
        method: clientOptions.method || "GET",
      });

      if (cacheAllowed) {
        await this.setCached(resolvedCacheKey, response.data, {
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
     * @param {boolean} [options.auth] Whether to resolve a token automatically.
     * @param {string} [options.cacheKey] Cache key override.
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the
     * response.
     */
    async upload(path, options = {}) {
      const { cacheKey, ...clientOptions } = options;

      const response = await this.request({
        ...clientOptions,
        path,
        method: clientOptions.method || "PUT",
      });

      // If successful uploaded, update the cache with the new data
      const resolvedCacheKey = this.constructor.resolveCacheKey(path, cacheKey);
      if (options.useCache !== false) {
        await this.setCached(resolvedCacheKey, clientOptions.body);
      }

      return response;
    }

    /**
     * Get a cached value scoped by the current user.
     * @param {string} key Cache key.
     * @returns {Promise<*>} Promise resolving to the cached value.
     */
    async getCached(key) {
      if (!key) return null;
      if (!(await this.shouldUseCache())) return null;
      const store = await this.getStore();
      const found = await store.getItem(key);
      return found;
    }

    /**
     * Check whether a value exists in the cache for the current user scope.
     * @param {string} key Cache key.
     * @returns {Promise<boolean>} Promise resolving to whether the value is
     * cached.
     */
    async isCached(key) {
      const value = await this.getCached(key);
      return value !== null && value !== undefined;
    }

    /**
     * Store a value in the cache for the current user scope.
     * @param {string} key Cache key.
     * @param {*} value Value to store.
     * @param {object} [options] Cache scope options.
     * @param {number|null} [options.ttlMs] Override cache TTL in ms.
     * @returns {Promise<*>} Promise resolving to the stored value.
     */
    async setCached(key, value, { ttlMs } = {}) {
      if (!key) return value;
      if (!(await this.shouldUseCache())) return value;
      const store = await this.getStore();
      await store.setItem(key, value, { ttlMs });
      return value;
    }

    /**
     * Remove a cached value for the current user scope.
     * @param {string} key Cache key.
     * @returns {Promise<void>} Promise resolving when removal completes.
     */
    async removeCached(key) {
      if (!key) return;
      const store = await this.getStore();
      await store.removeItem(key);
    }

    /**
     * Clear the cache for the current user scope.
     * @returns {Promise<void>} Promise resolving when the cache is cleared.
     */
    async clearCache() {
      const store = await this.getStore();
      await store.clear();
    }
  }

  return DataONEService;
});
