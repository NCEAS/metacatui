define([
  "models/dataONEServices/DataONEService",
  "models/dataONEServices/DataONEHttpError",
  "common/Utilities",
  "common/ValueUtilities",
], (DataONEService, DataONEHttpError, Utilities, ValueUtilities) => {
  const VALID_ACTIONS = Object.freeze(["read", "write", "changePermission"]);
  const FALSE_STATUSES = Object.freeze([401, 403, 404]);

  /**
   * Service for DataONE MNAuthorization.isAuthorized checks.
   * @class AuthorizationService
   * @augments DataONEService
   * @since 0.0.0
   */
  class AuthorizationService extends DataONEService {
    /**
     * @param {object} [options] Options for the AuthorizationService. See
     * {@link DataONEService.optionsFromDescriptor} for the shared option shape
     * @param {string} [options.baseUrl] Endpoint-qualified isAuthorized URL
     */
    constructor(options = {}) {
      super(AuthorizationService.optionsFromDescriptor(options));
    }

    /**
     * Check whether the current user can perform an action on a PID.
     * @param {string} pid DataONE PID or SID
     * @param {string} [action] Permission action
     * @param {object} [options] Request options
     * @returns {Promise<boolean>} Authorization result
     */
    async check(pid, action = "write", options = {}) {
      const normalizedPid = this.constructor.normalizePid(
        pid,
        "pid",
        "AuthorizationService.check requires a PID",
      );
      const normalizedAction = this.constructor.normalizeAction(action);
      const path = this.constructor.buildPidPath(normalizedPid, {
        query: `action=${normalizedAction}`,
      });

      try {
        const response = await this.request(
          this.constructor.buildRequestOptions({
            options,
            path,
            method: "GET",
            accept: "text/plain, text/xml, application/xml, */*",
          }),
        );

        return this.constructor.parseAuthorizationResponse(response.data);
      } catch (error) {
        if (
          error instanceof DataONEHttpError &&
          FALSE_STATUSES.includes(error.status)
        ) {
          return false;
        }
        throw error;
      }
    }

    /**
     * Check write permission for a PID.
     * @param {string} pid DataONE PID or SID
     * @param {object} [options] Request options
     * @returns {Promise<boolean>} Authorization result
     */
    checkWrite(pid, options = {}) {
      return this.check(pid, "write", options);
    }

    /**
     * Check read permission for a PID.
     * @param {string} pid DataONE PID or SID
     * @param {object} [options] Request options
     * @returns {Promise<boolean>} Authorization result
     */
    canView(pid, options = {}) {
      return this.check(pid, "read", options);
    }

    /**
     * Check changePermission access for a PID.
     * @param {string} pid DataONE PID or SID
     * @param {object} [options] Request options
     * @returns {Promise<boolean>} Authorization result
     */
    canChangePermission(pid, options = {}) {
      return this.check(pid, "changePermission", options);
    }

    /**
     * Check one action for multiple PIDs.
     * @param {string[]} pids DataONE PIDs or SIDs
     * @param {string} [action] Permission action
     * @param {object} [options] Request options
     * @param {Function} [options.onProgress] Progress callback
     * @returns {Promise<object>} Object keyed by PID
     */
    async checkAll(pids = [], action = "write", options = {}) {
      const normalizedPids = ValueUtilities.normalizeStringList(pids);
      const { maxConcurrent = 4, onProgress, ...requestOptions } = options;
      const limit = ValueUtilities.requirePositiveInteger(
        maxConcurrent,
        "AuthorizationService.checkAll maxConcurrent must be a positive integer",
      );
      const results = {};
      let completed = 0;
      if (normalizedPids.length && typeof onProgress === "function") {
        onProgress({ completed, total: normalizedPids.length });
      }

      const { errors } = await Utilities.processConcurrently(
        normalizedPids,
        async (pid) => {
          results[pid] = await this.check(pid, action, requestOptions);
        },
        {
          maxConcurrent: limit,
          stopOnError: true,
          onItemComplete: (pid) => {
            completed += 1;
            if (typeof onProgress === "function") {
              onProgress({
                action,
                completed,
                pid,
                total: normalizedPids.length,
              });
            }
          },
        },
      );
      if (errors.length) throw errors[0].error;

      return results;
    }

    /**
     * Resolve the current permission cache key.
     * @returns {Promise<string>} Current user subject, or "public"
     */
    async getUserKey() {
      return (await this.getUserName()) || "public";
    }

    /**
     * Normalize and validate a permission action.
     * @param {*} action Candidate action
     * @returns {string} Canonical action
     */
    static normalizeAction(action = "write") {
      return ValueUtilities.requireStringChoice(action, VALID_ACTIONS, {
        fieldName: "authorization action",
      });
    }

    /**
     * Parse DataONE authorization response bodies.
     * @param {*} value Response body
     * @returns {boolean} Authorization result
     */
    static parseAuthorizationResponse(value) {
      const text = ValueUtilities.normalizeText(value);
      if (!text) return true;

      const normalized = text.toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
      if (/<[^>]*false[^>]*>/i.test(text) || />\s*false\s*</i.test(text)) {
        return false;
      }
      if (/<[^>]*true[^>]*>/i.test(text) || />\s*true\s*</i.test(text)) {
        return true;
      }

      return false;
    }
  }

  /** @type {DataONEService#DataONEServiceConfig} */
  AuthorizationService.config = {
    endpoint: "isAuthorized",
    appModelKeys: ["authServiceUrl"],
    client: {
      timeoutMs: 60 * 1000,
      methods: ["GET"],
      responseTypes: ["text"],
      dedupeHeaders: ["Authorization", "Accept"],
    },
    persistPrivate: false,
    defaultAuth: true,
  };
  AuthorizationService.actions = VALID_ACTIONS;

  return AuthorizationService;
});
