define([
  "md5",
  "models/dataONEServices/DataONEHttpClient",
  "models/PersistentStorage",
  "common/DataONEXmlUtilities",
  "common/ErrorUtilities",
  "common/UrlUtilities",
  "common/Utilities",
  "common/ValueUtilities",
], (
  md5,
  DataONEHttpClient,
  PersistentStorage,
  DataONEXmlUtilities,
  ErrorUtilities,
  UrlUtilities,
  Utilities,
  ValueUtilities,
) => {
  /**
   * Extensible base class for DataONE API services, e.g. the System Metadata
   * service. It includes in-memory and persistent caching scoped by user
   * authentication, deduplication of in-flight requests handled by the
   * DataONEHttpClient, and utility methods for making requests. This class
   * always uses singleton instances of DataONEHttpClient and PersistentStorage
   * to ensure that deduplication and caching work properly across all service
   * instances with the same configuration.
   * Subclasses describe themselves with a static {@link DataONEService.config}
   * descriptor (endpoint name, the AppModel URL keys used to resolve a base
   * URL, default HTTP client options, storage defaults, and auth defaults).
   * The base class turns that descriptor into the constructor options via
   * {@link DataONEService.optionsFromDescriptor}, so most subclasses only need
   * a one-line constructor plus their domain methods.
   * @class DataONEService
   * @since 0.0.0
   * @classcategory Models/DataONEServices
   */
  class DataONEService {
    /**
     * Declarative service descriptor. Subclasses override this (assigned after
     * the class body) to standardize endpoint, base-URL resolution, client and
     * storage defaults, and auth behavior.
     * @typedef {object} DataONEServiceConfig
     * @property {string} [endpoint] Short DataONE endpoint name, e.g. `object`.
     * @property {string[]} [appModelKeys] AppModel config keys tried in order
     * to resolve a base URL when one is not passed explicitly.
     * @property {object} [client] Default HTTP client options, using friendly
     * names: `timeoutMs`, `retry`, `methods`, `responseTypes`, `dedupeHeaders`.
     * @property {object} [storage] Default PersistentStorage options.
     * @property {boolean} [persistPrivate] Default private-cache behavior.
     * @property {boolean} [defaultAuth] Default auth behavior.
     */

    /** @returns {string} Service name used in errors and storage scoping. */
    static get serviceName() {
      return this.name || "DataONEService";
    }

    /** @returns {string|null} Configured DataONE endpoint name. */
    static get endpoint() {
      return this.config?.endpoint ?? null;
    }

    /**
     * @param {object} [options] Options for the service instance
     * @param {string} options.baseUrl Base URL for the DataONE endpoint, e.g
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
     * that resolves to the current username string, used by cache-scoped
     * services.
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
      this.endpoint = this.constructor.config?.endpoint ?? null;

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
     * @param {object} options Options passed to the constructor
     * @returns {object} Normalized options
     */
    static normalizeOptions(options = {}) {
      const normalized = JSON.parse(JSON.stringify(options));
      normalized.baseUrl = UrlUtilities.normalizeUrl(normalized.baseUrl);
      ValueUtilities.requireNonEmptyString(
        normalized.baseUrl,
        "DataONEService: baseUrl is required",
      );

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
     * Merge default and caller-provided client options. The method, response
     * type, and dedupe-header lists are merged as a union (defaults are always
     * preserved; overrides can only add), so service defaults double as the
     * required set and never need to be re-declared.
     * @param {object} [params] Client configuration params
     * @param {object} [params.defaults] Default client options
     * @param {object} [params.overrides] Caller-provided client options
     * @param {string} [params.baseUrl] Base URL for the client
     * @returns {object} Normalized client configuration
     */
    static buildClientConfig({ defaults = {}, overrides = {}, baseUrl } = {}) {
      const normalizeArray = (value, mapper) =>
        (Array.isArray(value) ? value : [])
          .map((entry) => ValueUtilities.normalizeText(entry))
          .filter(Boolean)
          .map((entry) => mapper(entry));

      const resolvedBaseUrl = UrlUtilities.normalizeUrl(
        ValueUtilities.firstDefined(
          baseUrl,
          overrides.baseUrl,
          defaults.baseUrl,
        ),
      );

      const config = { ...defaults, ...overrides, baseUrl: resolvedBaseUrl };
      const applyArray = (key, values) => {
        const deduped = ValueUtilities.dedupeArray(values);
        // Omit empty lists so DataONEHttpClient falls back to its own defaults.
        if (deduped.length) {
          config[key] = deduped;
        } else {
          delete config[key];
        }
      };

      applyArray("allowedHttpMethods", [
        ...normalizeArray(defaults.allowedHttpMethods, (v) => v.toUpperCase()),
        ...normalizeArray(overrides.allowedHttpMethods, (v) => v.toUpperCase()),
      ]);
      applyArray("responseTypes", [
        ...normalizeArray(defaults.responseTypes, (v) => v.toLowerCase()),
        ...normalizeArray(overrides.responseTypes, (v) => v.toLowerCase()),
      ]);
      applyArray("headerNamesForDedup", [
        ...normalizeArray(defaults.headerNamesForDedup, (v) => v),
        ...normalizeArray(overrides.headerNamesForDedup, (v) => v),
      ]);
      return config;
    }

    /**
     * Translate the friendly {@link DataONEServiceConfig} `client` block into
     * DataONEHttpClient option names.
     * @returns {object} Default client options for {@link buildClientConfig}
     */
    static clientDefaults() {
      const client = this.config?.client || {};
      const defaults = {};
      if (client.timeoutMs !== undefined) defaults.timeoutMs = client.timeoutMs;
      if (client.retry !== undefined) defaults.retry = client.retry;
      if (client.methods) defaults.allowedHttpMethods = client.methods;
      if (client.responseTypes) defaults.responseTypes = client.responseTypes;
      if (client.dedupeHeaders) {
        defaults.headerNamesForDedup = client.dedupeHeaders;
      }
      return defaults;
    }

    /**
     * Resolve a base URL from an explicit value, then the descriptor's
     * `appModelKeys` in order. Subclasses with composite URLs override this.
     * @param {string} [explicitBaseUrl] Caller-provided base URL
     * @returns {string} Normalized base URL, or an empty string when unresolved
     */
    static resolveBaseUrl(explicitBaseUrl = "") {
      const explicit = UrlUtilities.normalizeUrl(explicitBaseUrl);
      if (explicit) return explicit;

      const appModel = globalThis.MetacatUI?.appModel;
      const keys = this.config?.appModelKeys || [];
      for (let i = 0; i < keys.length; i += 1) {
        const url = UrlUtilities.normalizeUrl(appModel?.get?.(keys[i]));
        if (url) return url;
      }
      return "";
    }

    /**
     * Build a PersistentStorage config namespaced by service name and base URL.
     * @param {object} [callerStorageConfig] Caller-provided storage options
     * @param {string} baseUrl Resolved base URL
     * @returns {object} Storage config with namespaced instance keys
     */
    static buildStorageConfig(callerStorageConfig = {}, baseUrl = "") {
      const source =
        callerStorageConfig && typeof callerStorageConfig === "object"
          ? callerStorageConfig
          : {};
      const callerKeys = Array.isArray(source.instanceKeys)
        ? [...source.instanceKeys]
        : [];
      return {
        ...(this.config?.storage || {}),
        ...source,
        instanceKeys: [...callerKeys, this.serviceName, baseUrl],
      };
    }

    /**
     * Build {@link DataONEService} constructor options from the static
     * descriptor and caller options. Subclasses pass the result to `super()`.
     * @param {object} [options] Caller-provided service options
     * @returns {object} Normalized constructor options
     */
    static optionsFromDescriptor(options = {}) {
      const source = options && typeof options === "object" ? options : {};
      const config = this.config || {};
      const baseUrl = this.resolveBaseUrl(source.baseUrl);
      ValueUtilities.requireNonEmptyString(
        baseUrl,
        `${this.serviceName}: baseUrl is required`,
      );

      return {
        baseUrl,
        clientConfig: this.buildClientConfig({
          defaults: this.clientDefaults(),
          overrides: source.clientConfig,
          baseUrl,
        }),
        storageConfig: this.buildStorageConfig(source.storageConfig, baseUrl),
        persistPrivate:
          typeof source.persistPrivate === "boolean"
            ? source.persistPrivate
            : config.persistPrivate,
        defaultAuth:
          typeof source.defaultAuth === "boolean"
            ? source.defaultAuth
            : config.defaultAuth,
        getToken: source.getToken,
        getUserName: source.getUserName,
      };
    }

    /**
     * Pick defined request options from a candidate options object.
     * @param {object} [options] Candidate options
     * @param {string[]} [keys] Keys to retain when defined
     * @returns {object} Selected options
     */
    static pickRequestOptions(
      options = {},
      keys = [
        "auth",
        "signal",
        "timeoutMs",
        "retry",
        "headers",
        "transport",
        "onUploadProgress",
      ],
    ) {
      const source = options && typeof options === "object" ? options : {};
      const picked = {};
      (Array.isArray(keys) ? keys : []).forEach((key) => {
        if (source[key] !== undefined) {
          picked[key] = source[key];
        }
      });
      return picked;
    }

    /**
     * Whether a DataONE write failure may have committed remotely.
     * @param {Error|object} error Service error
     * @returns {boolean} True when the write result must be verified
     */
    static isAmbiguousWriteError(error) {
      const status = Number(error?.status);
      return (
        ErrorUtilities.isAbortError(error) ||
        ErrorUtilities.isTimeoutError(error) ||
        error?.networkError === true ||
        error?.name === "TypeError" ||
        error?.code === "NETWORK_ERROR" ||
        Number.isNaN(status) ||
        status === 0 ||
        status === 408 ||
        status >= 500
      );
    }

    /**
     * Normalize and validate a PID-like identifier.
     * @param {*} pid Candidate identifier
     * @param {string} [label] Field label for error reporting
     * @param {string} [message] Error message override
     * @returns {string} Trimmed PID
     */
    static normalizePid(
      pid,
      label = "pid",
      message = `${this?.name || "DataONEService"}: ${label} is required`,
    ) {
      return ValueUtilities.requireNonEmptyString(pid, message);
    }

    /**
     * Encode a PID as a single URL path segment.
     * @param {*} pid Candidate identifier
     * @param {string} [label] Field label for error reporting
     * @param {string} [message] Error message override
     * @returns {string} Encoded PID path segment
     */
    static encodePidPath(pid, label = "pid", message = undefined) {
      return UrlUtilities.encodeDataONEPidForPath(
        this.normalizePid(pid, label, message),
      );
    }

    /**
     * Build a request path from a PID, encoded as a single path segment, with
     * an optional query string. Always pair with `encodePath: false`.
     * @param {*} pid Candidate identifier
     * @param {object} [options] Path options
     * @param {string} [options.query] Query string appended after `?`
     * @returns {string} Encoded PID path
     */
    static buildPidPath(pid, { query } = {}) {
      const encoded = this.encodePidPath(pid);
      return query ? `${encoded}?${query}` : encoded;
    }

    /**
     * If user is logged in, get a key based on their username; otherwise,
     * return a "public" scope key.
     * @returns {Promise<string>} Promise resolving to the scope key
     */
    async scopeKey() {
      const userName = await this.getUserName();
      return `auth:${md5(userName || "public")}`;
    }

    /**
     * Get a PersistentStorage instance automatically scoped by the logged in
     * user, using the configuration options provided to the constructor.
     * @returns {PersistentStorage} Storage instance
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
     * @returns {Promise<Backbone.Model>} Promise resolving to the user model
     */
    static async awaitUserModel() {
      await Utilities.awaitMetacatUI({ appName: "appUserModel" });
      return globalThis.MetacatUI?.appUserModel || null;
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
     * @returns {Promise<string>} Promise resolving to an auth token
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
     * @param {boolean} [auth] Whether to use authentication for this request
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
     * Send a request through a specific DataONEHttpClient instance.
     * @param {DataONEHttpClient} client Client instance to use
     * @param {object} [options] Request options
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the
     * response.
     */
    async requestWithClient(client, options = {}) {
      if (!client || typeof client.request !== "function") {
        throw new Error("DataONEService: client is required");
      }

      const { auth, ...clientOptions } = options;
      const resolvedToken = await this.resolveToken(auth);
      return client.request({
        ...clientOptions,
        token: resolvedToken,
      });
    }

    /**
     * Send a request whose body is a DataONE identifier response and parse the
     * returned XML. Shared by services that POST/PUT and read back an
     * identifier (e.g. IdentifierService, ObjectService).
     * @param {object} params Request params
     * @param {DataONEHttpClient} [params.client] Client to use. Defaults to the
     * service's primary client when omitted.
     * @param {object} params.requestOptions Options from
     * {@link DataONEService.buildRequestOptions}.
     * @param {string} params.context Error/parse context label
     * @returns {Promise<DataONEHttpResponse>} Response with parsed identifier
     * data.
     */
    async sendParsedIdentifierRequest({
      client,
      requestOptions,
      context,
    } = {}) {
      const response = client
        ? await this.requestWithClient(client, requestOptions)
        : await this.request(requestOptions);

      return {
        ...response,
        data: DataONEXmlUtilities.parseIdentifierResponse(
          response?.data,
          context,
        ),
      };
    }

    /**
     * Use the path as the cache key by default, but allow an override if
     * desired.
     * @param {string} path Path relative to baseUrl
     * @param {string|null|undefined} [cacheKey] Cache key override
     * @returns {string} Resolved cache key
     */
    static resolveCacheKey(path, cacheKey) {
      return cacheKey !== undefined && cacheKey !== null ? cacheKey : path;
    }

    /**
     * Merge request headers with defaults case-insensitively. Caller-provided
     * headers always win, while preserving caller casing.
     * @param {object} [requestHeaders] Headers for the request
     * @param {object} [defaultHeaders] Default headers to apply when missing
     * @returns {object} Merged headers
     */
    static mergeHeadersWithDefaults(requestHeaders = {}, defaultHeaders = {}) {
      const merged = {};
      const keyByLower = Object.create(null);

      const addHeaders = (headers, onlyIfMissing = false) => {
        if (!headers || typeof headers !== "object") return;
        Object.entries(headers).forEach(([key, value]) => {
          const normalizedKey = String(key).toLowerCase();
          const existingKey = keyByLower[normalizedKey];
          if (existingKey) {
            if (onlyIfMissing) {
              return;
            }
            if (existingKey !== key) {
              delete merged[existingKey];
            }
          }
          keyByLower[normalizedKey] = key;
          merged[key] = value;
        });
      };

      addHeaders(requestHeaders, false);
      addHeaders(defaultHeaders, true);

      return merged;
    }

    /**
     * Apply a default Accept header when one is not already provided.
     * @param {object} [options] Request options
     * @param {string} [accept] Default Accept header value
     * @returns {object} Options object with merged headers
     */
    static withDefaultAccept(options = {}, accept = "text/xml") {
      const normalizedOptions =
        options && typeof options === "object" ? { ...options } : {};
      const normalizedAccept =
        typeof accept === "string"
          ? accept.trim()
          : String(accept || "").trim();
      if (!normalizedAccept) {
        return normalizedOptions;
      }

      normalizedOptions.headers = this.mergeHeadersWithDefaults(
        normalizedOptions.headers,
        {
          Accept: normalizedAccept,
        },
      );

      return normalizedOptions;
    }

    /**
     * Build normalized request options for a single DataONE call. Centralizes
     * the option-picking, default Accept header, path encoding, and the common
     * `responseType`/`dedupe`/`auth`/`body` wiring shared by the services.
     * @param {object} params Request params
     * @param {object} [params.options] Caller request options to forward
     * @param {string} params.path Path relative to baseUrl
     * @param {string} params.method HTTP method
     * @param {string} [params.accept] Default Accept header value
     * @param {string} [params.responseType] Response type, defaults to `text`
     * @param {*} [params.body] Request body
     * @param {boolean} [params.dedupe] Dedupe override
     * @param {boolean} [params.auth] Auth override
     * @param {boolean} [params.encodePath] Whether the client should re-encode
     * the path. Defaults to false because callers pass pre-encoded PID paths.
     * @param {object} [params.extra] Additional request options to merge in,
     * e.g. `transport`.
     * @returns {object} Normalized request options
     */
    static buildRequestOptions({
      options = {},
      path,
      method,
      accept,
      responseType = "text",
      body,
      dedupe,
      auth,
      encodePath = false,
      extra = {},
    } = {}) {
      const built = {
        ...this.pickRequestOptions(options),
        path,
        method,
        responseType,
        encodePath,
        ...extra,
      };
      if (body !== undefined) built.body = body;
      if (dedupe !== undefined) built.dedupe = dedupe;
      if (auth !== undefined) built.auth = auth;

      return accept ? this.withDefaultAccept(built, accept) : built;
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
     * @param {string} options.path Path relative to baseUrl
     * @param {boolean} [options.auth] Whether to resolve a token automatically
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the
     * response.
     */
    async request(options = {}) {
      return this.requestWithClient(this.client, options);
    }

    /**
     * Download data from a path with optional caching.
     * @param {string} path Path relative to baseUrl
     * @param {object} [options] Options passed to
     * {@link DataONEHttpClient#request} (except `path`), plus cache controls.
     * @param {boolean} [options.auth] Whether to resolve a token automatically
     * @param {boolean} [options.useCache] Whether to cache responses, default
     * true.
     * @param {string} [options.cacheKey] Cache key override
     * @param {number|null} [options.cacheTtlMs] Cache TTL override
     * @returns {Promise<*>} Promise resolving to response data
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
     * @param {string} path Path relative to baseUrl
     * @param {object} [options] Options passed to
     * {@link DataONEHttpClient#request} (except `path`), plus cache controls.
     * @param {boolean} [options.auth] Whether to resolve a token automatically
     * @param {string} [options.cacheKey] Cache key override
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
     * @param {string} key Cache key
     * @returns {Promise<*>} Promise resolving to the cached value
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
     * @param {string} key Cache key
     * @returns {Promise<boolean>} Promise resolving to whether the value is
     * cached.
     */
    async isCached(key) {
      const value = await this.getCached(key);
      return value !== null && value !== undefined;
    }

    /**
     * Store a value in the cache for the current user scope.
     * @param {string} key Cache key
     * @param {*} value Value to store
     * @param {object} [options] Cache scope options
     * @param {number|null} [options.ttlMs] Override cache TTL in ms
     * @returns {Promise<*>} Promise resolving to the stored value
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
     * @param {string} key Cache key
     * @returns {Promise<void>} Promise resolving when removal completes
     */
    async removeCached(key) {
      if (!key) return;
      const store = await this.getStore();
      await store.removeItem(key);
    }

    /**
     * Clear the cache for the current user scope.
     * @returns {Promise<void>} Promise resolving when the cache is cleared
     */
    async clearCache() {
      const store = await this.getStore();
      await store.clear();
    }
  }

  /** @type {DataONEServiceConfig} Base descriptor; subclasses override. */
  DataONEService.config = {};

  return DataONEService;
});
