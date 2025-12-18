define([], () => {
  // Server error codes that should be retried by default: 408: Request Timeout
  // 429: Too Many Requests 500: Internal Server Error 502: Bad Gateway 503:
  // Service Unavailable 504: Gateway Timeout
  const DEFAULT_RETRY_ON = [408, 429, 500, 502, 503, 504];

  // Default retry configuration
  const DEFAULT_RETRY = {
    maxRetries: 2,
    baseDelayMs: 250,
    maxDelayMs: 4000,
    retryOn: DEFAULT_RETRY_ON,
    retryNetworkErrors: true,
  };

  // Convert a value to a non-negative integer, or return the fallback.
  const toNonNegativeInt = (value, fallback) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    if (num < 0) return 0;
    return Math.floor(num);
  };

  // Convert a value to a non-negative number, or return the fallback.
  const toNonNegativeNumber = (value, fallback) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    if (num < 0) return 0;
    return num;
  };

  /**
   * @class HttpRetryPolicy
   * @classdesc Configuration and logic for HTTP request retry policies.
   * @since 0.0.0
   * @example
   * const retryPolicy = new HttpRetryPolicy({
   *   maxRetries: 3,
   *   baseDelayMs: 500,
   *   retryOn: [500, 502, 503, 504],
   *   retryNetworkErrors: true,
   * });
   * retryPolicy.shouldRetry({
   *   attempt: 1,
   *   status: 500,
   *   isNetworkError: false,
   * });
   * // returns true
   */
  class HttpRetryPolicy {
    /**
     * @param {object} [options] Retry policy configuration.
     * @param {number} [options.maxRetries] Number of retry attempts (excludes
     * initial attempt).
     * @param {number} [options.baseDelayMs] Initial backoff delay in
     * milliseconds.
     * @param {number} [options.maxDelayMs] Maximum backoff delay in
     * milliseconds. Set to `null` to disable capping or 0 to retry immediately.
     * @param {number[]} [options.retryOn] Status codes that should be retried.
     * @param {boolean} [options.retryNetworkErrors] Whether to retry network
     * errors (such DNS failures or connection timeouts) when the status code is
     * not available.
     * @param {Function} [options.randomFn] Function used for jitter (useful for
     * testing). Should return a number between 0 and 1.
     */
    constructor(options = {}) {
      const {
        maxRetries = DEFAULT_RETRY.maxRetries,
        baseDelayMs = DEFAULT_RETRY.baseDelayMs,
        maxDelayMs = DEFAULT_RETRY.maxDelayMs,
        retryOn = DEFAULT_RETRY.retryOn,
        retryNetworkErrors = DEFAULT_RETRY.retryNetworkErrors,
        randomFn = Math.random,
      } = options || {};

      this.maxRetries = toNonNegativeInt(maxRetries, DEFAULT_RETRY.maxRetries);
      this.baseDelayMs = toNonNegativeNumber(
        baseDelayMs,
        DEFAULT_RETRY.baseDelayMs,
      );
      this.maxDelayMs =
        maxDelayMs === null
          ? null
          : toNonNegativeNumber(maxDelayMs, DEFAULT_RETRY.maxDelayMs);
      let normalizedRetryOn = Array.isArray(retryOn) ? [...retryOn] : [];
      normalizedRetryOn = normalizedRetryOn
        .map((code) => Number(code))
        .filter((code) => Number.isFinite(code) && code >= 100 && code <= 599);
      this.retryOn = normalizedRetryOn;
      this.retryNetworkErrors = retryNetworkErrors === true;
      this.randomFn = typeof randomFn === "function" ? randomFn : Math.random;
    }

    /**
     * Maximum number of attempts including the initial request.
     * @returns {number} Maximum attempts.
     */
    get maxAttempts() {
      return Math.max(1, this.maxRetries + 1);
    }

    /**
     * Normalize a status code to a valid HTTP status code number. Converts
     * strings to numbers. Returns `null` for invalid codes.
     * @param {number|string} status HTTP status code.
     * @returns {number|null} Normalized status code or `null` when invalid.
     */
    static normalizeStatus(status) {
      const code = Number(status);
      if (!Number.isFinite(code)) return null;
      if (code < 100 || code > 599) return null;
      return code;
    }

    /**
     * Create a new HttpRetryPolicy with some overridden options.
     * @param {object} overrides Options to override. See constructor for
     * details.
     * @returns {HttpRetryPolicy} New HttpRetryPolicy instance.
     */
    withOverrides(overrides = {}) {
      return new HttpRetryPolicy({
        maxRetries:
          overrides.maxRetries !== undefined
            ? overrides.maxRetries
            : this.maxRetries,
        baseDelayMs:
          overrides.baseDelayMs !== undefined
            ? overrides.baseDelayMs
            : this.baseDelayMs,
        maxDelayMs:
          overrides.maxDelayMs !== undefined
            ? overrides.maxDelayMs
            : this.maxDelayMs,
        retryOn:
          overrides.retryOn !== undefined ? overrides.retryOn : this.retryOn,
        retryNetworkErrors:
          overrides.retryNetworkErrors !== undefined
            ? overrides.retryNetworkErrors
            : this.retryNetworkErrors,
        randomFn:
          overrides.randomFn !== undefined ? overrides.randomFn : this.randomFn,
      });
    }

    /**
     * Determine if a status code is configured as retryable.
     * @param {number} status HTTP status code.
     * @param {number[]} [retryOn] Override array of status codes to check.
     * @returns {boolean} `true` when the status code should be retried.
     */
    shouldRetryStatus(status, retryOn = this.retryOn) {
      const normalizedStatus = this.constructor.normalizeStatus(status);
      if (!normalizedStatus) return false;
      if (!Array.isArray(retryOn)) return false;
      return retryOn.includes(normalizedStatus);
    }

    /**
     * Parse a `Retry-After` header into a millisecond delay. Accepts either a
     * Headers-like object with `.get()` or a plain object with a `Retry-After`
     * property.
     * @param {Headers|object|null} headers The headers returned from the
     * server. Can be a `Headers` instance or a plain object. Null/undefined if
     * no headers are available.
     * @param {number} [maxDelayMs] Override maximum delay cap in milliseconds.
     * @returns {number|null} Millisecond delay or `null` when the header is
     * missing or invalid.
     */
    parseRetryAfter(headers, maxDelayMs = this.maxDelayMs) {
      if (!headers) return null;
      let retryAfter = null;
      if (typeof headers.get === "function") {
        retryAfter = headers.get("Retry-After");
      } else if (typeof headers === "object") {
        retryAfter = headers["Retry-After"] ?? headers["retry-after"] ?? null;
      }
      // No Retry-After header
      if (!retryAfter) return null;
      // Retry-After can be either an integer number of seconds or a HTTP date.
      // First, try parsing as an integer number of seconds.
      const asInt = parseInt(retryAfter, 10);
      if (!Number.isNaN(asInt)) {
        const millis = asInt * 1000;
        return maxDelayMs !== null && maxDelayMs !== undefined
          ? Math.min(millis, maxDelayMs)
          : millis;
      }
      // Next, try parsing as a HTTP date.
      const dateDelay = Date.parse(retryAfter) - Date.now();
      if (dateDelay > 0) {
        return maxDelayMs !== null && maxDelayMs !== undefined
          ? Math.min(dateDelay, maxDelayMs)
          : dateDelay;
      }
      // Invalid Retry-After header
      return null;
    }

    /**
     * Compute the delay before the next retry attempt using exponential backoff
     * (double the delay after each failed attempt) and jitter.
     * @param {object} params Parameters object.
     * @param {number} params.attempt Current attempt number (1-based). Values
     * <1 are treated as the first attempt.
     * @param {number|null} [params.retryAfterMs] Explicit delay that overrides
     * backoff (e.g., already parsed from headers elsewhere) and takes
     * precedence over the `Retry-After` header.
     * @param {Headers|object|null} [params.headers] Optional headers object to
     * check for a `Retry-After` header. If present and valid, its value will be
     * used as the delay and will override the exponential backoff calculation.
     * @param {number} [params.baseDelayMs] Optional base delay override for the
     * backoff calculation.
     * @param {number|null} [params.maxDelayMs] Optional maximum delay cap; set
     * to null to disable capping.
     * @returns {number} Delay in milliseconds before the next retry attempt.
     */
    computeDelay({
      attempt,
      retryAfterMs = null,
      headers,
      baseDelayMs = this.baseDelayMs,
      maxDelayMs = this.maxDelayMs,
    } = {}) {
      // If valid retryAfterMs is provided, use it
      const retryAfterIsValid =
        retryAfterMs !== null &&
        retryAfterMs !== undefined &&
        Number.isFinite(retryAfterMs) &&
        retryAfterMs >= 0;
      if (retryAfterIsValid) {
        return retryAfterMs;
      }

      // Next, check for a Retry-After header
      const parsedRetryAfter = this.parseRetryAfter(headers, maxDelayMs);
      if (parsedRetryAfter !== null && parsedRetryAfter !== undefined) {
        return parsedRetryAfter;
      }

      // Otherwise, compute exponential backoff with jitter
      const standardizedBaseDelayMs = toNonNegativeNumber(
        baseDelayMs,
        this.baseDelayMs,
      );
      const standardizedMaxDelayMs = toNonNegativeNumber(
        maxDelayMs,
        this.maxDelayMs,
      );
      const attemptNumber = Math.max(1, Number(attempt) || 0);
      const exponential =
        standardizedBaseDelayMs * 2 ** Math.max(0, attemptNumber - 1);
      const capped =
        standardizedMaxDelayMs !== null && standardizedMaxDelayMs !== undefined
          ? Math.min(exponential, standardizedMaxDelayMs)
          : exponential;

      const rawRandom = Number(this.randomFn());
      const normalizedRandom = Number.isFinite(rawRandom)
        ? Math.min(1, Math.max(0, rawRandom))
        : 0.5;
      const jitter = capped * 0.2 * (normalizedRandom * 2 - 1);

      return Math.max(0, capped + jitter);
    }

    /**
     * Decide whether a request should be retried based on attempt count, status
     * code, and network errors.
     * @param {object} params Parameters object.
     * @param {number} params.attempt Current attempt number (1-based).
     * @param {number} [params.maxAttempts] Override the maximum attempts.
     * @param {number|string|null} params.status HTTP status code from the
     * response (if any).
     * @param {boolean} params.isNetworkError Whether the last attempt failed
     * due to a network issue.
     * @returns {boolean} `true` when the request should be retried.
     */
    shouldRetry({
      attempt,
      maxAttempts = this.maxAttempts,
      status,
      isNetworkError,
    } = {}) {
      const attemptNumber = Number.isFinite(attempt) ? attempt : 0;
      if (attemptNumber >= maxAttempts) return false;

      if (isNetworkError) {
        return this.retryNetworkErrors === true;
      }
      // some backbone versions pass status as a string
      const normalizedStatus = this.constructor.normalizeStatus(status);
      if (normalizedStatus) {
        return this.shouldRetryStatus(normalizedStatus, this.retryOn);
      }
      return false;
    }
  }

  HttpRetryPolicy.DEFAULT_RETRY_ON = DEFAULT_RETRY_ON;
  HttpRetryPolicy.DEFAULT_RETRY = DEFAULT_RETRY;

  return HttpRetryPolicy;
});
