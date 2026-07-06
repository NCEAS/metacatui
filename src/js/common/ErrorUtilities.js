"use strict";

define([], () => {
  const ERROR_NAMES = {
    ABORT: "AbortError",
    TIMEOUT: "TimeoutError",
  };
  const QUOTA_ERROR_PATTERNS = [
    "QuotaExceededError",
    "QUOTA_EXCEEDED_ERR",
    "QUOTA_BYTES_EXCEEDED",
    "quota",
    "exceeded",
  ];

  /**
   * Generic helpers for creating and identifying error types that are generic
   * enough to be used across different parts of MetacatUI.
   * @namespace ErrorUtilities
   * @since 0.0.0
   */
  const ErrorUtilities = {
    /**
     * Create an Error with a stable name and optional extra fields.
     * @param {string} name Error name.
     * @param {string} [message] Error message.
     * @param {object} [extra] Additional fields to assign to the error.
     * @returns {Error} Named error.
     */
    createNamedError(name, message = name || "Error", extra = {}) {
      const error = new Error(message);
      error.name = name || "Error";
      Object.assign(error, extra);
      return error;
    },

    /**
     * Create a standard abort error.
     * @param {*} [reason] Abort reason.
     * @returns {Error} Abort error.
     */
    createAbortError(reason = "Aborted") {
      return ErrorUtilities.createNamedError(
        ERROR_NAMES.ABORT,
        reason || "Aborted",
      );
    },

    /**
     * Whether an error represents an aborted operation.
     * @param {*} error Error to check.
     * @returns {boolean} True when the error is an AbortError.
     */
    isAbortError(error) {
      return error?.name === ERROR_NAMES.ABORT;
    },

    /**
     * Throw a standard abort error when a signal has already been aborted.
     * @param {AbortSignal} [signal] Abort signal.
     * @param {*} [reason] Abort reason.
     * @returns {void}
     * @throws {Error} AbortError when the signal is aborted.
     */
    throwIfAborted(signal, reason = signal?.reason || "Aborted") {
      if (!signal?.aborted) return;
      throw ErrorUtilities.createAbortError(reason);
    },

    /**
     * Wait for a delay, rejecting immediately if the signal aborts.
     * @param {number} ms Delay in milliseconds.
     * @param {AbortSignal} [signal] Abort signal.
     * @param {*} [reason] Abort reason override.
     * @returns {Promise<void>} Resolves after the delay, rejects on abort.
     */
    abortableDelay(ms, signal, reason = signal?.reason) {
      return new Promise((resolve, reject) => {
        const abortReason = () =>
          reason === undefined ? signal?.reason : reason;
        if (!Number.isFinite(ms) || ms <= 0) {
          if (signal?.aborted) {
            reject(ErrorUtilities.createAbortError(abortReason()));
          } else {
            resolve();
          }
          return;
        }

        let timeoutId;
        let onAbort;
        const cleanup = () => {
          clearTimeout(timeoutId);
          signal?.removeEventListener("abort", onAbort);
        };
        onAbort = () => {
          cleanup();
          reject(ErrorUtilities.createAbortError(abortReason()));
        };

        if (signal?.aborted) {
          reject(ErrorUtilities.createAbortError(abortReason()));
          return;
        }

        signal?.addEventListener("abort", onAbort, { once: true });
        timeoutId = setTimeout(() => {
          cleanup();
          resolve();
        }, ms);
      });
    },

    /**
     * Create a standard timeout error.
     * @param {string} [reason] Timeout reason.
     * @returns {Error} Timeout error.
     */
    createTimeoutError(reason = "Request timed out") {
      return ErrorUtilities.createNamedError(ERROR_NAMES.TIMEOUT, reason, {
        code: "ETIMEDOUT",
        isTimeout: true,
      });
    },

    /**
     * Whether an error represents a timeout.
     * @param {*} error Error to check.
     * @returns {boolean} True when the error is a TimeoutError.
     */
    isTimeoutError(error) {
      return error?.name === ERROR_NAMES.TIMEOUT || error?.isTimeout === true;
    },

    /**
     * Whether an error indicates browser or storage quota exhaustion.
     * @param {Error|string} error Error to check.
     * @returns {boolean} True when the error looks like a quota error.
     */
    isQuotaError(error) {
      const message =
        typeof error === "string"
          ? error
          : [error?.name, error?.code, error?.message]
              .filter(Boolean)
              .join(" ");
      const normalized = String(message || "").toLowerCase();
      return QUOTA_ERROR_PATTERNS.some((pattern) =>
        normalized.includes(pattern.toLowerCase()),
      );
    },
  };

  return ErrorUtilities;
});
