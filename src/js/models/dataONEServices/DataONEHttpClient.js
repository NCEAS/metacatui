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
   * Header names that affect request deduplication. Defaults for the client.
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
   * @property {number|null} [timeoutMs] Default timeout per request (ms)
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
   * @classdesc Generic HTTP client for DataONE APIs. Handles auth headers,
   * retries with backoff, optional in-flight deduplication, abort support,
   * normalized responses/errors, and timeouts. It does not know about app
   * models or TTLs; it only handles transport concerns.
   */
  class DataONEHttpClient {
    /**
     * @param {DataONEHttpClientOptions} [options] Client configuration
     */
    constructor({
      baseUrl = "",
      defaultHeaders = {},
      timeoutMs = null,
      retry = {},
      dedupe = true,
      allowedHttpMethods = DEFAULT_ALLOWED_HTTP_METHODS,
      headerNamesForDedup = DEFAULT_HEADER_NAMES_DEDUP,
      responseTypes = DEFAULT_RESPONSE_TYPES,
    } = {}) {
      this.baseUrl = baseUrl;
      this.defaultHeaders = { ...defaultHeaders };
      this.timeoutMs = timeoutMs;
      this.retryPolicy = new HttpRetryPolicy(retry);
      this.dedupe = dedupe;
      // Map of dedupeKey -> Promise for in-flight requests
      this.inFlight = new Map();
      // For request deduplication, objects that can't be serialized will be
      // assigned unique IDs
      this.bodyIds = new WeakMap();
      this.bodyIdSeq = 0;
      // Set of allowed HTTP methods and headers which affect deduplication
      this.allowedHttpMethods = allowedHttpMethods;
      this.headerNamesForDedup = headerNamesForDedup.map((h) =>
        String(h).toLowerCase(),
      );
      // Supported response types
      this.responseTypes = responseTypes.map((rt) => String(rt).toLowerCase());
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
        timeoutMs,
        retry = {},
      } = options;

      if (typeof path !== "string") {
        throw new Error("A request path is required");
      }

      const normalizedMethod = this.normalizeMethod(method);
      const normalizedResponseType = this.normalizeResponseType(responseType);
      const url = buildUrl(this.baseUrl, path, encodePath);

      const mergedHeaders = {
        ...this.defaultHeaders,
        ...(headers || {}),
      };

      if (token && !getCaseInsensitive(mergedHeaders, "Authorization")) {
        mergedHeaders.Authorization = `Bearer ${token}`;
      }

      const effectiveTimeout =
        timeoutMs !== undefined ? timeoutMs : this.timeoutMs;
      const retryPolicy = this.retryPolicy.withOverrides(retry);

      return {
        url,
        method: normalizedMethod,
        responseType: normalizedResponseType,
        headers: mergedHeaders,
        body,
        token,
        signal,
        timeoutMs: effectiveTimeout,
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
      if (this.responseTypes.includes(responseType.toLowerCase()))
        return responseType.toLowerCase();
      // Otherwise throw an error
      throw new Error(
        `Invalid responseType: ${responseType}. ` +
          `Allowed types: ${this.responseTypes.join(", ")}`,
      );
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
          // If performFetch guarantees TimeoutError vs AbortError vs other, this is simple:
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
      const retryKey = this.normalizeBodyForKey(retry);
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
     * a deduplication key.
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

      if (body instanceof Blob || body instanceof File) {
        const type = body.type || "unknown";
        const size = typeof body.size === "number" ? body.size : 0;
        return `blob:${type}:${size}:${this.getBodyId(body)}`;
      }

      // Binary views / buffers: avoid hashing bytes
      if (body instanceof ArrayBuffer) {
        return `bin:${body.byteLength}:${this.getBodyId(body)}`;
      }

      if (ArrayBuffer?.isView?.(body)) {
        const byteLength =
          typeof body.byteLength === "number" ? body.byteLength : 0;
        return `bin:${byteLength}:${this.getBodyId(body)}`;
      }

      // Try to JSON serialize other body types. May fail for circular refs. May
      // not produce stable results for objects with different key orders.
      try {
        const json = JSON.stringify(body);
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
            value = JSON.stringify(value);
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
  DataONEHttpClient.Error = DataONEHttpError;

  return DataONEHttpClient;
});
