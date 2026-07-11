define([
  "md5",
  "models/dataONEServices/UrlBuilder",
  "models/dataONEServices/HttpRetryPolicy",
  "models/dataONEServices/DataONEHttpError",
  "common/Utilities",
], (md5, UrlBuilder, HttpRetryPolicy, DataONEHttpError, Utilities) => {
  const { buildUrl } = UrlBuilder;
  const { getCaseInsensitive } = Utilities;

  /**
   * Header names that affect request deduplication. Defaults.
   * @type {string[]}
   */
  const DEFAULT_HEADER_NAMES_DEDUP = [
    "Content-Type",
    "Accept",
    "Authorization",
    // Note we don't use range or conditional get requests yet, but including
    // them here for future-proofing.
    "Range",
    "If-Match",
    "If-Modified-Since",
    "If-None-Match",
  ];

  /**
   * Default allowed HTTP methods.
   * @type {string[]}
   */
  const DEFAULT_ALLOWED_HTTP_METHODS = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
  ];

  /**
   * Default supported response types.
   * @type {string[]}
   */
  const DEFAULT_RESPONSE_TYPES = ["json", "arrayBuffer", "blob", "text"];

  /**
   * Default options for DataONEHttpClient instances.
   * @type {DataONEHttpClientOptions}
   */
  const DEFAULT_OPTIONS = {
    baseUrl: "",
    defaultHeaders: {},
    timeoutMs: null,
    retry: {},
    dedupe: true,
    allowedHttpMethods: DEFAULT_ALLOWED_HTTP_METHODS,
    headerNamesForDedup: DEFAULT_HEADER_NAMES_DEDUP,
    responseTypes: DEFAULT_RESPONSE_TYPES,
  };

  /**
   * Create an AbortError with the provided reason.
   * @param {string} [reason] Abort reason, defaults to "Aborted"
   * @returns {Error} Error with name set to AbortError
   */
  const abortError = (reason = "Aborted") => {
    const err = new Error(reason);
    err.name = "AbortError";
    return err;
  };

  /**
   * Create a TimeoutError with the provided reason.
   * @param {string} [reason] Timeout reason, defaults to "Request timed out"
   * @returns {Error} Error with name set to TimeoutError
   */
  const timeoutError = (reason = "Request timed out") => {
    const err = new Error(reason);
    err.name = "TimeoutError";
    err.code = "ETIMEDOUT";
    err.isTimeout = true;
    return err;
  };

  /**
   * Delay for a specified duration with optional abort support.
   * @param {number} ms Delay duration in milliseconds
   * @param {AbortSignal} [signal] Abort signal to cancel the delay
   * @returns {Promise<void>} Resolves after the delay or rejects on abort
   */
  const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
      if (!Number.isFinite(ms) || ms <= 0) {
        if (signal?.aborted) {
          reject(abortError(signal.reason));
        } else {
          resolve();
        }
        return;
      }

      let timeoutId;

      let onAbort; // To avoid defined before use eslint error

      const cleanup = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
      };

      onAbort = () => {
        cleanup();
        reject(abortError(signal.reason));
      };

      if (signal?.aborted) {
        reject(abortError(signal.reason));
        return;
      }

      signal?.addEventListener("abort", onAbort, { once: true });

      timeoutId = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
    });

  /**
   * Configuration options for {@link DataONEHttpClient}.
   * @typedef {object} DataONEHttpClientOptions
   * @property {string} [baseUrl] Base URL for relative requests, e.g.
   * "https://arcticdata.io/metacat/d1/mn/v2/"
   * @property {object} [defaultHeaders] Headers applied to every request
   * @property {number|null} [timeoutMs] Default timeout per request (ms). Set
   * to null for no timeout.
   * @property {object} [retry] Retry configuration, see
   * {@link HttpRetryPolicy}
   * @property {boolean} [dedupe] Enable in-flight deduplication. If
   * true, when an identical request has already been sent and not yet
   * returned, the promise for that request will be returned instead of
   * creating a new one.
   * @property {string[]} [allowedHttpMethods] List of allowed HTTP
   * methods
   * @property {string[]} [headerNamesForDedup] List of headers to
   * include when generating deduplication keys.
   * @property {string[]} [responseTypes] List of supported response
   * types.
   */

  /**
   * Options accepted by {@link DataONEHttpClient#request}.
   * @typedef {object} DataONEHttpRequestOptions
   * @property {string} path Path relative to `baseUrl` (e.g. "/v2/meta/{pid}")
   * @property {"text"|"json"|"arrayBuffer"|"blob"} [responseType="text"]
   * Expected response type, used for parsing.
   * @property {boolean} [encodePath=true] Whether to URL-encode path segments.
   * @property {string} [method="GET"] HTTP method.
   * @property {object} [headers] Per-request headers, to be merged with
   * `defaultHeaders`. `headers` must be a plain object (not a `Headers`
   * instance).
   * @property {*} [body] Request body.
   * @property {string|null} [token] Optional auth token (Bearer).
   * @property {AbortSignal} [signal] AbortSignal to cancel the request.
   * @property {number|null} [timeoutMs] Override timeout in milliseconds.
   * @property {object} [retry] Override retry configuration for this request.
   */

  /**
   * Normalized request options used internally after defaults and normalization
   * have been applied.
   * @typedef {object} NormalizedDataONEHttpRequestOptions
   * @property {string} url Full request URL.
   * @property {string} method Normalized HTTP method.
   * @property {"text"|"json"|"arrayBuffer"|"blob"} responseType Normalized
   * response type.
   * @property {object} headers Effective headers passed to `fetch()` (merged +
   * auth).
   * @property {*} [body] Request body.
   * @property {string|null} [token] Optional auth token (Bearer).
   * @property {AbortSignal} [signal] AbortSignal to cancel the request.
   * @property {number|null} timeoutMs Effective timeout in milliseconds.
   * @property {object} retry Retry overrides for this request.
   * @property {HttpRetryPolicy} retryPolicy Effective retry policy for this
   * request.
   */

  /**
   * Normalized HTTP response returned by the client.
   * @typedef {object} DataONEHttpResponse
   * @property {boolean} ok Whether the HTTP status is in the 200-299 range.
   * @property {number} status HTTP status code.
   * @property {Headers} headers Response headers.
   * @property {string} url Final response URL.
   * @property {*} data Parsed response data.
   */

  /**
   * @class DataONEHttpClient
   * @classcategory  Models/DataONEServices
   * @classdesc Generic HTTP client for DataONE APIs. Handles auth headers,
   * retries with backoff, optional in-flight deduplication, abort support,
   * normalized responses/errors, and timeouts. It does not know about app
   * models or TTLs; it only handles transport concerns.
   * @since 2.37.0
   */
  class DataONEHttpClient {
    /**
     * @param {DataONEHttpClientOptions} [options] Client configuration
     */
    constructor(options = {}) {
      const {
        baseUrl,
        defaultHeaders,
        timeoutMs,
        retry,
        dedupe,
        allowedHttpMethods,
        headerNamesForDedup,
        responseTypes,
      } = this.constructor.normalizeOptions(options);
      this.baseUrl = baseUrl;
      this.defaultHeaders = defaultHeaders;
      this.timeoutMs = timeoutMs;
      this.retryPolicy = new HttpRetryPolicy(retry);
      this.dedupe = dedupe;

      // Map of dedupeKey -> Promise for in-flight requests
      this.inFlight = new Map();
      // For request deduplication, objects that can't be serialized will be
      // assigned unique IDs
      this.bodyIds = new WeakMap();
      this.bodyIdSeq = 0;

      this.allowedHttpMethods = allowedHttpMethods;
      this.headerNamesForDedup = headerNamesForDedup;
      this.responseTypes = responseTypes;
    }

    /**
     * Normalize options for instance keys and default values.
     * @param {DataONEHttpClientOptions} [options] Client configuration
     * @returns {object} Normalized options
     */

    static normalizeOptions(options = {}) {
      const source =
        options && typeof options === "object" ? options : DEFAULT_OPTIONS;
      const copyObject = (value, fallback = {}) =>
        value && typeof value === "object" ? { ...value } : { ...fallback };
      const copyArray = (value, fallback = []) =>
        Array.isArray(value) ? [...value] : [...fallback];
      const toUpper = (item) => String(item).toUpperCase();
      const toLower = (item) => String(item).toLowerCase();

      const dedupe =
        source.dedupe === undefined ? DEFAULT_OPTIONS.dedupe : source.dedupe;
      if (typeof dedupe !== "boolean") {
        throw new Error("dedupe must be a boolean");
      }

      const rawTimeoutMs =
        source.timeoutMs === undefined
          ? DEFAULT_OPTIONS.timeoutMs
          : source.timeoutMs;
      const timeoutMs = this.normalizeTimeoutMs(rawTimeoutMs);

      return {
        ...DEFAULT_OPTIONS,
        ...source,
        baseUrl: source.baseUrl
          ? Utilities.normalizeUrl(source.baseUrl)
          : DEFAULT_OPTIONS.baseUrl,
        timeoutMs,
        dedupe,
        // For arrays and objects, we want to ensure we create new instances so
        // that they can be safely mutated without affecting the defaults or
        // other instances that use the same defaults.
        defaultHeaders: copyObject(
          source.defaultHeaders,
          DEFAULT_OPTIONS.defaultHeaders,
        ),
        retry: copyObject(source.retry, DEFAULT_OPTIONS.retry),
        allowedHttpMethods: copyArray(
          source.allowedHttpMethods,
          DEFAULT_OPTIONS.allowedHttpMethods,
        ).map(toUpper),
        headerNamesForDedup: copyArray(
          source.headerNamesForDedup,
          DEFAULT_OPTIONS.headerNamesForDedup,
        ).map(toLower),
        responseTypes: copyArray(
          source.responseTypes,
          DEFAULT_OPTIONS.responseTypes,
        ).map(toLower),
      };
    }

    /**
     * Normalize a timeout value to either a valid number or null.
     * @param {number|null|undefined} timeoutMs Timeout in milliseconds
     * @returns {number|null} Normalized timeout
     * @throws {Error} If timeout is not null/undefined and not a non-negative number
     * @private
     */
    static normalizeTimeoutMs(timeoutMs) {
      if (timeoutMs === null || timeoutMs === undefined) return null;
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        throw new Error("timeoutMs must be a non-negative number or null");
      }
      return timeoutMs;
    }

    /**
     * Build a unique instance key based on client options.
     * @param {DataONEHttpClientOptions} [options] Client configuration
     * @returns {string} Instance key
     */
    static buildInstanceKey(options = {}) {
      const normalizedOptions = this.normalizeOptions(options);
      const keyFields = [
        "baseUrl",
        "timeoutMs",
        "dedupe",
        "defaultHeaders",
        "retry",
        "allowedHttpMethods",
        "headerNamesForDedup",
        "responseTypes",
      ];
      const normalizers = {
        baseUrl: Utilities.normalizeUrl,
        defaultHeaders: Utilities.stableStringify,
        retry: Utilities.stableStringify,
        allowedHttpMethods: Utilities.stableStringify,
        headerNamesForDedup: Utilities.stableStringify,
        responseTypes: Utilities.stableStringify,
      };
      return Utilities.buildInstanceKey(
        normalizedOptions,
        keyFields,
        normalizers,
      );
    }

    /**
     * Get a singleton DataONEHttpClient instance for the provided options.
     * @param {DataONEHttpClientOptions} [options] Client configuration
     * @returns {DataONEHttpClient} Client instance
     */
    static get(options = {}) {
      return Utilities.getSingleton(
        this,
        options,
        this.buildInstanceKey.bind(this),
      );
    }

    /**
     * Normalize and merge request options with client defaults. Also check for
     * required options.
     * @param {DataONEHttpRequestOptions} options Raw request options
     * @returns {NormalizedDataONEHttpRequestOptions} Normalized request options
     * @private
     */
    normalizeRequestOptions(options = {}) {
      const {
        path,
        method = "GET",
        responseType = "text",
        encodePath = true,
        headers,
        body,
        token = null,
        signal,
        timeoutMs: requestTimeoutMs,
        retry: retryOverrides = {},
      } = options;

      if (typeof path !== "string") {
        throw new Error("A request path is required");
      }

      const normalizedMethod = this.normalizeMethod(method);
      const normalizedResponseType = this.normalizeResponseType(responseType);
      const url = buildUrl(this.baseUrl, path, encodePath);

      const mergedHeaders = this.constructor.mergeHeaders(
        this.defaultHeaders,
        headers,
      );

      if (token && !getCaseInsensitive(mergedHeaders, "Authorization")) {
        mergedHeaders.Authorization = `Bearer ${token}`;
      }

      const hasRequestTimeoutOverride =
        requestTimeoutMs !== undefined && requestTimeoutMs !== null;
      const timeoutSource = hasRequestTimeoutOverride
        ? requestTimeoutMs
        : this.timeoutMs;
      const normalizedTimeoutMs =
        this.constructor.normalizeTimeoutMs(timeoutSource);
      const retry =
        retryOverrides && typeof retryOverrides === "object"
          ? retryOverrides
          : {};
      const retryPolicy = this.retryPolicy.withOverrides(retry);

      return {
        url,
        method: normalizedMethod,
        responseType: normalizedResponseType,
        headers: mergedHeaders,
        body,
        token,
        signal,
        timeoutMs: normalizedTimeoutMs,
        retry,
        retryPolicy,
      };
    }

    /**
     * Normalize a responseType option to a supported value.
     * @param {string} responseType Raw response type
     * @returns {"json"|"arrayBuffer"|"blob"|"text"} Normalized response type
     * @private
     */
    normalizeResponseType(responseType) {
      if (typeof responseType !== "string") {
        throw new Error("responseType must be a string");
      }
      const normalizedResponseType = responseType.toLowerCase();
      if (this.responseTypes.includes(normalizedResponseType))
        return normalizedResponseType;
      // Otherwise throw an error
      throw new Error(
        `Invalid responseType: ${responseType}. ` +
          `Allowed types: ${this.responseTypes.join(", ")}`,
      );
    }

    /**
     * Merge two header objects case-insensitively. Headers in requestHeaders
     * override defaults regardless of key casing.
     * @param {object} defaultHeaders Default headers
     * @param {object} requestHeaders Request-specific headers
     * @returns {object} Merged headers object
     * @private
     */
    static mergeHeaders(defaultHeaders = {}, requestHeaders = {}) {
      const merged = {};
      const keyByLower = Object.create(null);

      const addHeaders = (headers) => {
        if (!headers || typeof headers !== "object") return;
        Object.entries(headers).forEach(([key, value]) => {
          const normalizedKey = String(key).toLowerCase();
          const existingKey = keyByLower[normalizedKey];
          if (existingKey && existingKey !== key) {
            delete merged[existingKey];
          }
          keyByLower[normalizedKey] = key;
          merged[key] = value;
        });
      };

      addHeaders(defaultHeaders);
      addHeaders(requestHeaders);

      return merged;
    }

    /**
     * Normalize an HTTP method to an allowed uppercase value.
     * @param {string} method Raw HTTP method
     * @returns {string} Normalized HTTP method
     * @throws {Error} If method is not provided or invalid
     * @private
     */
    normalizeMethod(method) {
      if (typeof method !== "string") {
        throw new Error("method must be provided");
      }
      const normalizedMethod = method.toUpperCase();
      if (this.allowedHttpMethods.includes(normalizedMethod)) {
        return normalizedMethod;
      }
      throw new Error(
        `Invalid HTTP method: ${method}. ` +
          `Allowed methods: ${this.allowedHttpMethods.join(", ")}`,
      );
    }

    /**
     * Perform an HTTP request.
     * @param {DataONEHttpRequestOptions} options Request options
     * @returns {Promise<DataONEHttpResponse>} A promise that resolves to a
     * normalized response object.
     */
    async request(options = {}) {
      const requestOptions = this.normalizeRequestOptions(options);

      let dedupKey = null;
      if (this.dedupe) {
        dedupKey = this.generateRequestKey(requestOptions);
        const inFlight = this.checkForInFlightRequest(dedupKey);
        if (inFlight) return inFlight;
      }

      const job = this.executeRequest(requestOptions);
      if (this.dedupe) {
        this.addToInFlight(dedupKey, job);
      }

      try {
        return await job;
      } finally {
        this.removeFromInFlight(dedupKey);
      }
    }

    /**
     * Return an in-flight request promise for a dedupe key, if present.
     * @param {string|null} dedupKey Dedupe key for the request
     * @returns {Promise<DataONEHttpResponse>|null} In-flight promise or null
     * @private
     */
    checkForInFlightRequest(dedupKey) {
      if (this.dedupe === false || this.inFlight.size === 0) return null;
      return this.inFlight.get(dedupKey) || null;
    }

    /**
     * Store an in-flight request promise for deduplication.
     * @param {string|null} dedupKey Dedupe key for the request
     * @param {Promise<DataONEHttpResponse>} promise Request promise
     * @private
     */
    addToInFlight(dedupKey, promise) {
      if (!dedupKey || !promise || this.dedupe === false) return;
      this.inFlight.set(dedupKey, promise);
    }

    /**
     * Remove a request from the in-flight map.
     * @param {string|null} dedupKey Dedupe key for the request
     * @private
     */
    removeFromInFlight(dedupKey) {
      if (!dedupKey) return;
      if (this.inFlight.size === 0) return;
      this.inFlight.delete(dedupKey);
    }

    /**
     * Fetch with retry and timeouts. Do not call directly; use
     * {@link DataONEHttpClient#request} instead.
     * @param {NormalizedDataONEHttpRequestOptions} options Request options
     * @returns {Promise<DataONEHttpResponse>} A promise that resolves to a
     * normalized response object.
     * @private
     */
    async executeRequest(options = {}) {
      const { url, retryPolicy, signal } = options;
      const { maxAttempts } = retryPolicy;

      let attempt = 0;
      let lastError;

      /* eslint-disable no-await-in-loop */
      while (attempt < maxAttempts) {
        attempt += 1;

        try {
          const response = await this.performFetch(options);
          if (response.ok) return response;

          // Convert non-OK HTTP into a normalized error path
          throw new DataONEHttpError({
            response,
            attempt,
            url,
            message: `Request failed with status ${response.status}`,
            status: response.status,
          });
        } catch (err) {
          // Stop all processing and throw immediately if the request was
          // aborted by the caller
          if (signal?.aborted && err?.name !== "TimeoutError") {
            throw abortError(signal.reason);
          }

          const normalized =
            err instanceof DataONEHttpError
              ? err
              : new DataONEHttpError({
                  error: err,
                  url,
                  attempt,
                  networkError: err?.name === "TimeoutError" || undefined,
                });

          lastError = normalized;

          const shouldRetry = retryPolicy.shouldRetry({
            attempt,
            maxAttempts,
            status: normalized.status,
            isNetworkError: normalized.networkError === true,
          });

          if (!shouldRetry) throw normalized;

          const retryAfterMs = retryPolicy.parseRetryAfter(normalized.headers);
          const delay = retryPolicy.computeDelay({ attempt, retryAfterMs });
          await sleep(delay, signal);
        }
      }
      /* eslint-enable no-await-in-loop */

      throw lastError;
    }

    /**
     * Performs the actual fetch call. Handles timeouts and aborts. Do not call
     * directly; use {@link DataONEHttpClient#request} instead.
     * @param {NormalizedDataONEHttpRequestOptions} options Request options
     * @returns {Promise<DataONEHttpResponse>} A promise that resolves to a
     * normalized response object.
     * @private
     */
    async performFetch(options = {}) {
      const { url, method, headers, body, responseType, signal, timeoutMs } =
        options;
      // Enable fetch to be aborted via AbortController. We track whether an
      // abort came from the caller's signal vs an internal timeout, so we can
      // reliably convert timeouts into TimeoutError.
      const controller = new AbortController();
      let abortedByCaller = false;

      const onAbort = () => {
        abortedByCaller = true;
        controller.abort();
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      // Abort the fetch if it exceeds the timeout
      let timeoutId = null;
      let timedOut = false;
      let timeoutErr = null;

      const effectiveTimeout =
        timeoutMs !== undefined ? timeoutMs : this.timeoutMs;

      if (effectiveTimeout && effectiveTimeout > 0) {
        timeoutErr = timeoutError();
        timeoutId = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, effectiveTimeout);
      }

      try {
        const res = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        const data = await this.constructor.readBody(res, responseType);
        return {
          ok: res.ok,
          status: res.status,
          headers: res.headers,
          url: res.url,
          data,
        };
      } catch (error) {
        // Guarantee that internal timeouts surface as TimeoutError.
        if (timedOut) {
          timeoutErr.cause = error;
          throw timeoutErr;
        }

        // If the caller aborted, preserve abort semantics.
        if (abortedByCaller) {
          throw abortError(signal?.reason);
        }

        throw error;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
      }
    }

    /**
     * Generate a key to differentiate requests for deduplication. The strategy
     * veers towards less deduplication in favour of ensureing we don't
     * incorrectly dedupe requests that are actually different. For example, a
     * request that sets the token via headers will be considered different from
     * one that sets it via the token option, for simplicity.
     * @param {NormalizedDataONEHttpRequestOptions} options Request options
     * @returns {string} A hash key representing the request
     * @private
     */
    generateRequestKey({
      token,
      url,
      method,
      body,
      headers,
      responseType,
      timeoutMs,
      retry,
      signal,
    }) {
      // Generate scope based on token or Authorization header
      let scope = token ? `auth:${md5(String(token))}` : null;
      if (!scope) {
        const authHeader = getCaseInsensitive(headers, "Authorization");
        if (authHeader) {
          scope = `auth:${md5(authHeader)}`;
        } else {
          scope = "public";
        }
      }

      const bodyNormalized = this.normalizeBodyForKey(body);
      const headerRepresentation = this.normalizeHeadersForKey(headers);
      const timeoutKey =
        timeoutMs === null || timeoutMs === undefined
          ? "none"
          : String(timeoutMs);
      const retryKey = Utilities.stableStringify(retry);
      const signalKey = signal ? this.getBodyId(signal) : "none";

      const keyParts = [
        scope,
        String(method).toUpperCase(),
        url,
        responseType,
        headerRepresentation,
        `timeout:${timeoutKey}`,
        `retry:${retryKey}`,
        `signal:${signalKey}`,
        bodyNormalized,
      ];

      return md5(keyParts.join("|"));
    }

    /**
     * Read a response body according to the requested response type.
     * @param {Response} response Fetch response
     * @param {"text"|"json"|"arrayBuffer"|"blob"} responseType Expected body
     * type
     * @returns {Promise<*>} Parsed response data
     * @private
     */
    static async readBody(response, responseType) {
      const responseCopy = response.clone();
      try {
        switch (responseType.toLocaleLowerCase()) {
          case "json":
            return await response.json();
          case "arraybuffer":
            return await response.arrayBuffer();
          case "blob":
            return await response.blob();
          case "text":
          default:
            return await response.text();
        }
      } catch (e) {
        // If parsing fails, fall back to text where possible
        if (responseType !== "text") {
          return responseCopy.text();
        }
        throw e;
      }
    }

    /**
     * Convert a body sent with a request into a string suitable for generating
     * a deduplication key. It will be assigned an ID if it's a non-serializable
     * type. If the same object is used in multiple requests, it will have the
     * same ID.
     * @param {*} body Request body
     * @returns {string} Normalized body representation
     * @private
     */
    normalizeBodyForKey(body) {
      if (body === null || body === undefined) return "";
      if (typeof body === "string") return `str:${md5(body)}`;

      if (body instanceof URLSearchParams) {
        // Stable string representation
        return `usp:${body.toString()}`;
      }

      // Non-serializable / potentially large bodies: use identity
      if (body instanceof FormData) {
        return `fd:${this.getBodyId(body)}`;
      }

      let prefix = "";

      if (body instanceof Blob || body instanceof File) {
        const type = body.type || "unknown";
        const size = typeof body.size === "number" ? body.size : 0;
        prefix = `blob:${type}:${size}`;
      }

      // Binary views / buffers: avoid hashing bytes
      if (ArrayBuffer?.isView?.(body) || body instanceof ArrayBuffer) {
        const byteLength =
          typeof body.byteLength === "number" ? body.byteLength : 0;
        prefix = `bin:${byteLength}`;
      }

      if (prefix) {
        return `${prefix}:${this.getBodyId(body)}`;
      }

      // Try to JSON serialize other body types with stable key ordering.
      try {
        const json = Utilities.stableStringify(body, {
          ignoreCase: false,
          orderMatters: true,
        });
        return `json:${md5(json)}`;
      } catch (e) {
        return `obj:${this.getBodyId(body)}`;
      }
    }

    /**
     * Return a stable ID for non-serializable bodies.
     * @param {*} value Request body value
     * @returns {string} Stable object ID
     * @private
     */
    getBodyId(value) {
      if (!this.bodyIds.has(value)) {
        this.bodyIds.set(value, `obj:${this.bodyIdSeq + 1}`);
        this.bodyIdSeq += 1;
      }
      return this.bodyIds.get(value);
    }

    /**
     * Generate a string representation of headers suitable for generating a
     * deduplication key. Avoid too much deduplication by only including certain
     * headers.
     * @param {object} headers Request headers
     * @returns {string} Normalized headers representation
     * @private
     */
    normalizeHeadersForKey(headers) {
      if (!headers || typeof headers !== "object") return "";
      const parts = this.headerNamesForDedup.map((name) => {
        let value = getCaseInsensitive(headers, name) || "";
        if (Array.isArray(value)) value = value.join(",");
        else if (typeof value === "object") {
          try {
            value = Utilities.stableStringify(value);
          } catch (e) {
            value = this.getBodyId(value);
          }
        }
        value = String(value).trim();
        if (!value) return "";
        return `${name.toLowerCase()}:${value}`;
      });

      return parts.join("|");
    }
  }

  DataONEHttpClient.DEFAULT_RETRY = HttpRetryPolicy.DEFAULT_RETRY;
  DataONEHttpClient.DEFAULT_RETRY_ON = HttpRetryPolicy.DEFAULT_RETRY_ON;
  DataONEHttpClient.DEFAULT_HEADER_NAMES_DEDUP = DEFAULT_HEADER_NAMES_DEDUP;
  DataONEHttpClient.ALLOWED_HTTP_METHODS = DEFAULT_ALLOWED_HTTP_METHODS;
  DataONEHttpClient.RESPONSE_TYPES = DEFAULT_RESPONSE_TYPES;
  DataONEHttpClient.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
  DataONEHttpClient.Error = DataONEHttpError;
  DataONEHttpClient.instances = new Map();

  return DataONEHttpClient;
});
