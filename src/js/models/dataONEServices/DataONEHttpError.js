define([
  "models/dataONEServices/HttpRetryPolicy",
  "common/DataONEXmlUtilities",
], (HttpRetryPolicy, DataONEXmlUtilities) => {
  // The max length for error body text to retain.
  const DEFAULT_MAX_ERROR_BODY = 8192;

  /**
   * @class DataONEHttpError
   * @classdesc Normalized transport error for DataONEHttpClient. Accepts any
   * available metadata (response, status, body text, network error, etc.) and
   * derives a consistent error shape.
   */
  class DataONEHttpError extends Error {
    /**
     * Build a normalized HTTP error.
     * @param {object} options An options object.
     * @param {string} [options.message] Error message; when omitted a sensible
     * default is derived.
     * @param {number|string|null} [options.status] HTTP status code.
     * @param {string} [options.url] Request URL.
     * @param {number} [options.attempt] Attempt number (1-based).
     * @param {boolean} [options.networkError] Whether the failure was a network
     * error.
     * @param {Headers|object|null} [options.headers] Response headers when
     * available.
     * @param {object|null} [options.response] Response-like object with
     * `status`, `url`, `headers`, and `data` or `bodyText`.
     * @param {string|null} [options.bodyText] Response body to attach
     * (truncated).
     * @param {Error} [options.error] Original thrown error for context.
     * @param {number} [options.maxErrorBody] Body truncation limit.
     */
    constructor({
      message = "",
      status = undefined,
      url = "",
      attempt = 1,
      networkError = undefined,
      headers = null,
      response = null,
      bodyText = null,
      error = null,
      maxErrorBody = DEFAULT_MAX_ERROR_BODY,
    }) {
      // Ensure status is numeric and valid
      const resolvedStatus = HttpRetryPolicy.normalizeStatus(
        status ?? response?.status,
      );

      // Get url & headers from options or response
      const resolvedUrl = url || response?.url || "";
      const resolvedHeaders = headers ?? response?.headers ?? null;

      // Determine if this was a network error
      const explicitNetwork =
        typeof networkError === "boolean" ? networkError : undefined;
      const inferredNetwork =
        (error instanceof TypeError && !resolvedStatus) ||
        error?.networkError === true;
      const resolvedNetworkError = explicitNetwork ?? inferredNetwork ?? false;

      // Get and truncate body text
      let rawBody = null;
      if (typeof bodyText === "string") {
        rawBody = bodyText;
      } else if (response) {
        if (typeof response.data === "string") {
          rawBody = response.data;
        } else if (typeof response.bodyText === "string") {
          rawBody = response.bodyText;
        }
      }

      const bodyLimit =
        Number.isFinite(maxErrorBody) && maxErrorBody >= 0
          ? Math.floor(maxErrorBody)
          : DEFAULT_MAX_ERROR_BODY;
      const resolvedBodyText = DataONEHttpError.truncateBody(
        rawBody,
        bodyLimit,
      );
      const dataONEError = resolvedBodyText
        ? DataONEXmlUtilities.parseErrorXml(
            resolvedBodyText,
            "DataONE error response",
          )
        : null;
      const parsedDataONEError =
        dataONEError?.status === "invalid_xml" ? null : dataONEError;

      // Derive a sensible message if none was provided
      let resolvedMessage = "";
      if (typeof message === "string" && message.length > 0) {
        resolvedMessage = message;
      } else if (parsedDataONEError?.message) {
        resolvedMessage = parsedDataONEError.message;
      } else if (error?.message) {
        resolvedMessage = error.message;
      } else if (resolvedNetworkError) {
        resolvedMessage = "Network error";
      } else if (typeof resolvedStatus === "number") {
        resolvedMessage = `Request failed with status ${resolvedStatus}`;
      } else {
        resolvedMessage = "Request failed";
      }

      // Call the parent constructor and set properties
      super(resolvedMessage);
      this.name = "DataONEHttpError";
      this.status = resolvedStatus;
      this.url = resolvedUrl;
      this.bodyText = resolvedBodyText;
      const resolvedAttempt =
        Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
      this.attempt = resolvedAttempt;
      this.networkError = resolvedNetworkError;
      this.headers = resolvedHeaders;
      this.originalError = error || null;
      this.dataONEErrorName = parsedDataONEError?.name || null;
      this.errorCode = parsedDataONEError?.status || null;
      this.detailCode = parsedDataONEError?.detailCode || null;
    }

    /**
     * Truncate a response body string.
     * @param {string} text Text to truncate.
     * @param {number} [maxChars] Maximum length.
     * @returns {string|null} Truncated text or null.
     */
    static truncateBody(text, maxChars = DEFAULT_MAX_ERROR_BODY) {
      if (typeof text !== "string") return null;
      if (text.length > maxChars) {
        return text.slice(0, maxChars);
      }
      return text;
    }
  }

  DataONEHttpError.DEFAULT_MAX_ERROR_BODY = DEFAULT_MAX_ERROR_BODY;

  return DataONEHttpError;
});
