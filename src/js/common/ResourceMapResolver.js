define(["localforage", "models/sysmeta/SysMeta", "models/PackageModel"], (
  LocalForage,
  SysMeta,
  PackageModel,
) => {
  // Index field names (resource map, format ID, format type)
  const RM_FIELD = "resourceMap";
  const FORMAT_ID_FIELD = "formatId";
  const FORMAT_TYPE_FIELD = "formatType";

  // Index values (format type = metadata, format ID for RM)
  const METADATA_TYPE = "METADATA";
  const RM_FORMAT_ID = "http://www.openarchives.org/ore/terms";

  // The prefix conventionally added to the resource map PIDs
  const RM_FILENAME_PREFIX = "resource_map_";

  /**
   * An array of strategies to resolve the resource map PID.
   * @type {Array}
   */
  const STRATEGY_ORDER = [
    { strategy: "index", fn: "searchIndex" },
    { strategy: "storage", fn: "checkStorage" },
    { strategy: "sysmeta", fn: "walkSysmeta" },
    { strategy: "guess", fn: "guessPid" },
  ];

  /**
   * The maximum length of the trace log. If the trace exceeds this length,
   * older entries will be removed.
   */
  const MAX_TRACE_LENGTH = 1000;

  /**
   * @class ResourceMapResolver
   * @classdesc A multi-strategy resource map (RM) look-up tool. Searches for
   * the RM associated with a given EML PID and allows finding RMs when data
   * packages have not yet been indexed. Tries the following strategies in the
   * order listed: queries index, checks client-side storage, walks the system
   * metadata, and finally guesses the RM PID based on a naming convention. When
   * a match is found, the class stores the EML-RM PID pair in the client-side
   * storage for future use. When a match is found from a source other than
   * index, the RM is verified to ensure it links to the EML pid. The history of
   * the resolution attempts is stored in an internal trace log.
   * @classcategory Common
   * @since 0.0.0
   */
  class ResourceMapResolver {
    /**
     * @param {object} options - Options for the resolver
     * @param {string} options.queryServiceUrl - The base URL for the Solr
     * service
     * @param {string} options.metaServiceUrl - The base URL for service to get
     * System Metadata
     * @param {string} [options.token] - The token for authentication
     * @param {object} [options.storage] - An instance of localForage to use for
     * storage. If not provided, a new instance will be created with the name
     * "ResourceMapResolver".
     */
    constructor(options = {}) {
      this.traceLog = [];
      this.options = options;
      // To store RM-EML pid pairs
      this.storage =
        options.storage ||
        LocalForage.createInstance({
          name: "ResourceMapResolver",
        });
    }

    /**
     * An object representing the result of the resolution process.
     * @typedef {object} ResolveResult
     * @property {Array} trace - An array of trace entries for debugging and diagnostics
     * @property {string} emlPid - The PID of the EML document that was resolved
     * @property {boolean} success - Whether the resolution was successful
     * @property {string} [rmPid] - The resolved resource map PID if successful
     * @property {string} [source] - The source of the resolution (e.g.,
     * "index", "storage", "sysmeta", "guessed")
     * @property {string} [reason] - The reason for failure if not successful
     * @property {Error} [error] - The error object if an error occurred
     */

    /**
     * The main method to resolve the resource map PID for a given EML PID.
     * It will try multiple strategies in order to find the resource map
     * associated with the EML PID.
     * @param {string} emlPid - The PID of the EML document to resolve
     * @returns {ResolveResult} - The result of the resolution process
     */
    async resolve(emlPid) {
      try {
        // Run each strategy in the defined order,
        for (let i = 0; i < STRATEGY_ORDER.length; i += 1) {
          const { strategy, fn } = STRATEGY_ORDER[i];
          // eslint-disable-next-line no-await-in-loop
          const result = await this[fn](emlPid);
          if (result) return this.success(emlPid, result, strategy);
          this.traceAttempt(emlPid, strategy);
        }

        this.trace({
          emlPid,
          strategy: "all",
          success: false,
          message: "No resource map found using any strategy.",
        });
        return this.failure(emlPid, "not found");
      } catch (e) {
        this.trace({
          emlPid,
          strategy: "resolve",
          success: false,
          error: e,
          message: "Unexpected error during resolution.",
        });
        return this.failure(emlPid, "error", e);
      }
    }

    /**
     * Checks index for the EML PID and returns the resource map PID if found.
     * @param {string} emlPid - The PID of the EML document to search for
     * @returns {Promise<string|null>} - PID of RM if found, null otherwise
     */
    async searchIndex(emlPid) {
      const q = `id:"${emlPid}"`;
      const fl = `${RM_FIELD},${FORMAT_ID_FIELD},${FORMAT_TYPE_FIELD}`;
      const wt = "json";
      const query = encodeURIComponent(`q=${q}&fl=${fl}&wt=${wt}`);
      const url = `${this.options.queryServiceUrl}${query}`;

      const fetchOptions = { method: "GET" };
      if (this.options.token) {
        fetchOptions.headers = {
          Authorization: `Bearer ${this.options.token}`,
        };
        fetchOptions.credentials = "include";
      }

      const data = await fetch(url, fetchOptions)
        .then((res) => res.json())
        .catch((err) => {
          this.trace({
            emlPid,
            strategy: "index",
            success: false,
            error: err,
          });
          return null;
        });

      const results = data?.response?.docs;
      const numResults = results?.length;

      // Case 1: No results found in index
      if (!numResults) {
        this.trace({
          emlPid,
          strategy: "index",
          success: false,
          message: `No results from index for PID ${emlPid}.`,
        });
        return null;
      }

      // Case 2: Multiple results found (>1 objects with same ID unlikely)
      if (numResults > 1) {
        this.trace({
          emlPid,
          strategy: "index",
          success: false,
          message: `Multiple results found in index for PID ${emlPid} (${numResults}).`,
        });
        return null;
      }

      // At this point we've confirmed there's only 1 result. (!0 and <=1)
      const result = numResults ? results[0] : null;
      const rms = result?.[RM_FIELD] || [];
      const numRMs = result.length || 0;
      const formatType = result[FORMAT_TYPE_FIELD];
      const formatId = result[FORMAT_ID_FIELD];

      // Case 3: Resource map found for given EML PID
      if (numRMs === 1) return rms[0];

      // Case 4: Multiple resource maps found in index for the same EML PID
      if (numRMs > 1) {
        this.trace({
          emlPid,
          strategy: "index",
          success: false,
          message: `Multiple resource maps found in index for PID ${emlPid} (${numRMs}).`,
        });
        return null;
      }

      // Case 5: PID is for a non-Metadata object
      if (formatType && formatType !== METADATA_TYPE) {
        //  Case 5A: PID is for a resource map
        if (formatId === RM_FORMAT_ID) {
          this.trace({
            emlPid,
            strategy: "index",
            success: true,
            message: `The given PID ${emlPid} is not a metadata type, but it is a resource map.`,
          });
          return emlPid;
        }
        // Case 5B: PID is not a metadata type and not a resource map
        this.trace({
          emlPid,
          strategy: "index",
          success: false,
          message: `The given PID ${emlPid} is not a metadata type and not a resource map.`,
        });
        return null;
      }

      // Case 6: All other cases, including no RM found for an EML PID
      this.trace({
        emlPid,
        strategy: "index",
        success: false,
        message: `No resource map found in index for PID ${emlPid}.`,
      });
      return null;
    }

    /**
     * Checks local storage / index DB for a resource map PID associated with
     * the given EML PID. Uses localForage to access the local storage.
     * @param {string} emlPid - The PID of the EML document to check
     * @returns {Promise<string|null>} - PID of RM if found, null otherwise
     */
    async checkStorage(emlPid) {
      const rmPid = await this.storage.getItem(emlPid);
      // verify that the rmPid is a valid resource map
      if (rmPid) {
        const validRMPid = await this.verifyAndCleanStorage(
          emlPid,
          rmPid,
          "storage",
        );
        if (!validRMPid) this.storage.removeItem(emlPid);
        return validRMPid;
      }
      return null;
    }

    /**
     * Walks backward through EML version history to find a previous RM, then
     * forward to find the current RM.
     * @param {string} emlPid - The PID of the EML document to walk sysmeta for
     * @param {number} [maxDepth] - The maximum number of versions to walk
     * @returns {Promise<string|null>} - The PID of the current RM if found
     */
    async walkSysmeta(emlPid, maxDepth = 20) {
      // First walk backward to find a previous RM and collect EML history
      const { history, prevRMPid } = await this.walkBackToPrevRM(
        emlPid,
        maxDepth,
      );
      if (!prevRMPid) return null;

      // Then walk forward through RM versions to find the current RM
      const currentRMPid = await this.walkForwardToCurrentRM(
        emlPid,
        prevRMPid,
        history.length,
        maxDepth,
      );
      if (!currentRMPid) return null;

      // Step 3: Verify the current RM links to the original EML PID
      return this.verifyAndCleanStorage(emlPid, currentRMPid, "sysmeta");
    }

    /**
     * Walk backward through EML versions to find a previous RM. Returns the
     * history and the found RM PID.
     * @param {string} emlPid - The PID of the EML document to walk sysmeta for
     * @param {number} maxDepth - The maximum number of versions to walk
     * @returns {Promise<{history: Array, prevRMPid: string|null}>} - An object
     * containing the history of EML PIDs and the previous RM PID if found
     */
    async walkBackToPrevRM(emlPid, maxDepth) {
      let currentEmlPid = emlPid;
      const history = [];
      let prevRMPid = null;
      for (let i = 0; i < maxDepth; i += 1) {
        history.push(currentEmlPid);
        // eslint-disable-next-line no-await-in-loop
        const sysmeta = await this.getSysMeta(currentEmlPid);
        if (!sysmeta) {
          this.trace({
            emlPid,
            strategy: "sysmeta",
            success: false,
            message: `No sysmeta found for EML PID ${currentEmlPid} during backward walk.`,
          });
          return { history, prevRMPid: null };
        }
        const prevEmlPid = sysmeta.obsoletes;
        if (!prevEmlPid) {
          this.trace({
            emlPid,
            strategy: "sysmeta",
            success: false,
            message: `No previous EML PID found for ${currentEmlPid}. Stopping backward walk.`,
          });
          return { history, prevRMPid: null };
        }
        // eslint-disable-next-line no-await-in-loop
        prevRMPid = await this.searchIndex(prevEmlPid);
        // eslint-disable-next-line no-await-in-loop
        if (!prevRMPid) prevRMPid = await this.checkStorage(prevEmlPid);
        // TODO: verify linkage here for older pids?
        if (prevRMPid) break;
        currentEmlPid = prevEmlPid;
      }
      return { history, prevRMPid };
    }

    /**
     * Walk forward through RM versions to find the current RM.
     * @param {string} emlPid - The PID of the EML document to walk sysmeta for
     * @param {string} prevRMPid - The PID of the prev. RM to start walking from
     * @param {number} steps - The number of steps to walk forward
     * @param {number} maxDepth - The maximum number of versions to walk
     * @returns {Promise<string|null>} - The PID of the current RM if found
     */
    async walkForwardToCurrentRM(emlPid, prevRMPid, steps, maxDepth) {
      let currentRMPid = prevRMPid;
      for (let i = 0; i < steps && i < maxDepth; i += 1) {
        if (!currentRMPid && i < steps) return null;
        // eslint-disable-next-line no-await-in-loop
        const sysmeta = await this.getSysMeta(currentRMPid);
        if (!sysmeta) {
          this.trace({
            emlPid,
            strategy: "sysmeta",
            success: false,
            message: `No sysmeta found for current RM PID ${currentRMPid} during forward walk.`,
          });
          return null;
        }
        currentRMPid = sysmeta.obsoletedBy;
      }
      return currentRMPid;
    }

    /**
     * Fetches the system metadata for a given PID.
     * @param {string} pid - The PID of the object to fetch sysmeta for
     * @returns {Promise<SysMeta|null>} - The SysMeta object if successful, null
     * if not
     */
    async getSysMeta(pid) {
      const sysmeta = new SysMeta({
        identifier: pid,
        metaServiceUrl: this.options.metaServiceUrl,
      });
      return sysmeta
        .fetch({ parse: true })
        .then((data) => data)
        .catch((err) => {
          this.trace({
            emlPid: pid,
            strategy: "sysmeta",
            success: false,
            error: err,
          });
          return null;
        });
    }

    /**
     * Gets the previous version of the object
     * @param {string} pid - The PID of the object to get the prev. version for
     * @returns {Promise<string|null>} - The PID of the previous version if it
     * exists, null otherwise
     */
    async getPreviousVersion(pid) {
      const sysmeta = await this.getSysMeta(pid);
      return sysmeta?.obsoletes || null;
    }

    /**
     * Gets the next most recent version of the object
     * @param {string} pid - The PID of the object to get the next version for
     * @returns {Promise<string|null>} - The PID of the next version if it
     * exists, null otherwise
     */
    async getNextVersion(pid) {
      const sysmeta = await this.getSysMeta(pid);
      return sysmeta?.obsoletedBy || null;
    }

    /**
     * Guesses the resource map PID based on the EML PID. The guessed PID is
     * constructed by appending the EML PID to a predefined prefix.
     * @param {string} emlPid - The PID of the EML document to guess the RM PID for
     * @returns {Promise<string|null>} - The guessed resource map PID if it exists
     * and is linked to the EML PID, null otherwise
     */
    async guessPid(emlPid) {
      const guessed = `${RM_FILENAME_PREFIX}${emlPid}`;
      return this.verifyAndCleanStorage(emlPid, guessed, "guess");
    }

    /**
     * Verifies that the given resource map PID exists and contains the EML pid
     * as a member.
     * @param {string} rmPid - The PID of the resource map to verify
     * @param {string} emlPid - The PID of the EML document to check
     * @param {number} [timeout] - The timeout for the verification request
     * @returns {Promise<boolean>} - True if the RM is valid and contains the EML PID,
     * false otherwise
     */
    async verifyRM(rmPid, emlPid, timeout = 30000) {
      const rmObj = new PackageModel({ id: rmPid });

      return new Promise((resolve) => {
        rmObj.listenToOnce(rmObj, "sync", () => {
          rmObj.stopListening();
          const members = rmObj.get("memberIds") || [];
          const isValid = members.includes(emlPid);
          resolve(isValid);
        });

        rmObj.listenToOnce(rmObj, "error", (_model, response) => {
          rmObj.stopListening();
          if (response.status === 404) {
            resolve(false);
            return;
          }

          if (response.status === 401 || response.status === 403) {
            this.trace({
              pid: emlPid,
              strategy: "guess",
              success: false,
              message: `Access denied to resource map ${rmPid}.`,
            });
            resolve(false);
            return;
          }

          this.trace({
            emlPid,
            strategy: "guess",
            success: false,
            error: response,
          });
          resolve(false); // Instead of reject(response)
        });

        // timeout the request if it takes too long
        setTimeout(() => {
          rmObj.stopListening();
          this.trace({
            emlPid,
            strategy: "guess",
            success: false,
            message: `Verification of resource map ${rmPid} timed out.`,
          });
          resolve(false);
        }, timeout);

        rmObj.fetch();
      });
    }

    /**
     * Verifies that the given resource map PID includes the EML PID as a
     * member, and removes the pairing from storage if it does not.
     * @param {string} emlPid - The PID of the EML document to verify
     * @param {string} rmPid - The PID of the resource map to verify
     * @param {string} strategy - The strategy used to find the RM
     * @returns {Promise<string|null>} - The verified resource map PID if valid,
     * null if not valid or if the RM does not link to the EML PID.
     */
    async verifyAndCleanStorage(emlPid, rmPid, strategy) {
      const valid = await this.verifyRM(rmPid, emlPid);
      if (!valid) {
        this.trace({
          emlPid,
          strategy,
          success: false,
          message: `Found ${rmPid}, but it does not link to EML ${emlPid}`,
        });
        // if storage contains the eml pid linked to rmPid, remove it
        const storedRmPid = await this.storage.getItem(emlPid);
        if (storedRmPid === rmPid) this.storage.removeItem(emlPid);
        return null;
      }
      return rmPid;
    }

    /**
     * Adds a trace entry to the internal trace log for debugging and diagnostics.
     * @param {object} entry - The trace entry to log
     * @param {string} entry.emlPid - The PID involved in the operation
     * @param {string} entry.strategy - The name of the strategy or operation
     * @param {boolean} entry.success - Whether the operation was successful
     * @param {object} [entry.error] - The error object or response
     * @param {string} [entry.message] - Optional summary message
     */
    trace(entry) {
      if (!this.traceLog) this.traceLog = [];

      const log = {
        time: new Date().toISOString(),
        emlPid: entry.emlPid,
        strategy: entry.strategy,
        success: entry.success,
      };

      if (entry.error) {
        log.error = {
          name: entry.error.name || "Error",
          message: entry.error.message || String(entry.error),
          stack: entry.error.stack || null,
        };
      }

      if (entry.message) {
        log.message = entry.message;
      }

      // Limit the trace log length
      if (this.traceLog.length >= MAX_TRACE_LENGTH) {
        this.traceLog.shift(); // Remove the oldest entry
      }

      this.traceLog.push(log);
    }

    /**
     * Retrieves the trace log for debugging and diagnostics.
     * @param {string} [emlPid] - Optional EML PID to filter the trace log
     * @returns {Array} - An array of trace entries
     */
    getTrace(emlPid) {
      if (!this.traceLog || this.traceLog.length === 0) {
        return [];
      }
      // If emlPid is provided, filter the trace for that PID
      if (emlPid) {
        return this.traceLog.filter((entry) => entry.emlPid === emlPid);
      }
      // Otherwise, return the full trace
      return this.traceLog;
    }

    /**
     * Logs a trace entry when a strategy completes without finding a result.
     * @param {string} emlPid - The PID of the EML document
     * @param {string} strategy - The name of the strategy that completed
     */
    traceAttempt(emlPid, strategy) {
      this.trace({
        emlPid,
        strategy,
        success: false,
        message: "Strategy completed but returned no result.",
      });
    }

    /**
     * Saves the resolved resource map PID in the browser storage and returns an
     * object with the result.
     * @param {string} emlPid - The PID of the EML document
     * @param {string} rmPid - The resolved resource map PID
     * @param {string} source - The source of the resolution (e.g., "index",
     * "storage", "sysmeta", "guessed")
     * @returns {ResolveResult} - An object with the result of the resolution
     */
    success(emlPid, rmPid, source) {
      this.storage.setItem(emlPid, rmPid);
      this.trace({ emlPid, strategy: source, success: true });
      return {
        success: true,
        emlPid,
        rmPid,
        source,
        trace: this.getTrace(emlPid),
      };
    }

    /**
     * Returns an object representing a failure in the resolution process.
     * @param {string} emlPid - The PID of the EML document that failed to resolve
     * @param {string} reason - The reason for the failure
     * @param {Error} [error] - The error object if an error occurred
     * @returns {ResolveResult} - An object with the failure details
     */
    failure(emlPid, reason, error = null) {
      return {
        emlPid,
        success: false,
        reason,
        error,
        trace: this.getTrace(emlPid),
      };
    }
  }

  return ResourceMapResolver;
});
