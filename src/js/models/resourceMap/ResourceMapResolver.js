define([
  "backbone",
  "localforage",
  "models/sysmeta/VersionTracker",
  "models/PackageModel",
  "collections/SolrResults",
  "common/EventLog",
], (Backbone, LocalForage, VersionTracker, PackageModel, Solr, EventLog) => {
  // Index field names
  const RM_FIELD = "resourceMap";
  const FORMAT_ID_FIELD = "formatId";
  const FORMAT_TYPE_FIELD = "formatType";
  const SERIESID_FIELD = "seriesId";
  const ID_FIELD = "id";

  // Index values
  const DATA_TYPE = "DATA";
  const RM_FORMAT_ID = "http://www.openarchives.org/ore/terms";

  // Naming convention for resource map PIDs
  const RM_FILENAME_PREFIX = "resource_map_";

  // Status messages for the resolution process
  const STATUS = Object.freeze({
    // matches
    indexMatch: "Resource map pid found in index",
    multiRMMatch:
      "Multiple versions of resource map found in index and could resolve to the most recent",
    storageMatch: "Resource map pid found in local storage",
    smMatch: "Resource map pid found by walking sysmeta",
    guessMatch: "Resource map pid guessed based on naming convention",
    // misses
    indexMiss: "Resource map pid not found in index",
    storageMiss: "Resource map pid not found in local storage",
    smMiss: "Resource map pid not found by walking sysmeta",
    guessMiss: "Resource map pid not found by guessing",
    multiRMMiss:
      "Multiple resource maps found in index, but could not resolve to a single RM. They are either not versions of each other and/or are all are obsoleted.",
    // special cases
    pidIsSeriesId: "PID is a series ID, not an object PID",
    noPidForSeriesId: "PID not found for series ID",
    allMiss: "Resource map pid not found by any strategy",
    foundButNotValid:
      "Resource map pid found but does not link to the given PID",
    foundAndValid: "Resource map pid found and links to the given PID",
    rmFetchError: "Error fetching resource map via object API",
    unauthorized: "Stopped resolution: user not authorized to access sysmeta",
  });

  const DEFAULT_MAX_STEPS = 200; // Default max steps to walk back in sysmeta
  const DEFAULT_MAX_FETCH_TIME = 45000; // Default max time to fetch RM from sysmeta
  const DEFAULT_ID = MetacatUI.appModel.get("baseUrl") || "unknown";

  // The event name for tracking missing resource maps (used by analytics)
  const NO_RM_EVENT_NAME = "resource_map_missing";

  /**
   * @class ResourceMapResolver
   * @classdesc A multi-strategy resource map (RM) look-up tool. Searches for
   * the RM associated with a given PID and allows finding RMs when data
   * packages have not yet been indexed. Tries the following strategies in the
   * order listed: queries index, checks client-side storage, walks the system
   * metadata, and finally guesses the RM PID based on a naming convention. When
   * a match is found, the class stores the Obj-RM PID pair in the client-side
   * storage for future use. When a match is found from a source other than
   * index, the RM is verified to ensure it links to the pid. The history of the
   * resolution attempts is stored in an event log.
   * @classcategory Common
   * @since 2.34.0
   */
  class ResourceMapResolver {
    /**
     * @param {object} options - Options for the resolver
     * @param {string} [options.id] - The ID to use for the resolver.
     * @param {string} [options.metaServiceUrl] - The base URL for service to
     * get System Metadata
     * @param {object} [options.storage] - An instance of localForage to use for
     * storage. If not provided, a new instance will be created with the name
     * "ResourceMapResolver".
     * @param {object} [options.eventLog] - An instance of EventLog to use for
     * tracing the resolution process. If not provided, a new instance will be
     * created.
     * @param {number} [options.maxSteps] - The maximum number of steps to walk
     * back in the system metadata to find a resource map PID.
     * @param {number} [options.maxFetchTime] - The maximum time to wait for
     * fetching the resource map PID from the system metadata. Defaults to 45s.
     * @param {"info"|"warning"|"error"} [options.consoleLevel] - The level at
     * which to log messages to the console. Defaults to "warning". Set to false
     * to disable console logging.
     */
    constructor(options = {}) {
      this.options = options;
      this.id = options.id || DEFAULT_ID;
      // Storage to store obj:ResMap pid pairs.
      const normalId = this.id.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      this.storage =
        options.storage ||
        LocalForage.createInstance({
          name: `ResourceMapResolver_${normalId}`,
        });
      this.index = new Solr();
      this.versionTracker = new VersionTracker({
        metaServiceUrl: options.metaServiceUrl,
      });
      this.eventLog = options.eventLog || new EventLog();
      this.eventLog.setConsoleLogLevel(options.consoleLevel || "warning");
      this.maxSteps =
        Number.isInteger(options.maxSteps) && options.maxSteps > 0
          ? options.maxSteps
          : DEFAULT_MAX_STEPS;
      this.maxFetchTime =
        Number.isInteger(options.maxFetchTime) && options.maxFetchTime > 0
          ? options.maxFetchTime
          : DEFAULT_MAX_FETCH_TIME;
    }

    /**
     * An object representing the result of the resolution process.
     * @typedef {object} ResolveResult
     * @property {boolean} success - Whether the resolution was successful
     * @property {string} pid - The PID of the object to find a resource map for
     * (generally an EML PID)
     * @property {string} [rm] - The resolved resource map PID if successful
     * @property {Array} log - The event log for the resolution process,
     * including an array of events with timestamps, messages, and metadata.
     * @property {boolean} [unauthorized] - Set to true when the resolution
     * process was stopped due to unauthorized access to the system metadata
     * (possibly sysmeta for a previous version of the object).
     * @property {boolean} [multipleRMs] - Set to true when multiple resource
     * maps were found in the index for the given PID, but no single RM could be
     * attributed to the PID.
     */

    /**
     * The main method to resolve the resource map PID for a given PID.
     * It will try multiple strategies in order to find the resource map
     * associated with the PID.
     * @param {string} pid - The PID of the document to resolve
     * @returns {ResolveResult} - The result of the resolution process
     */
    async resolve(pid) {
      // ---- INDEX ----
      const indexResult = await this.searchIndex(pid);
      const foundRM = indexResult?.rm || null;
      if (foundRM) {
        return this.status(pid, STATUS.indexMatch, foundRM, indexResult.meta);
      }
      if (indexResult?.meta?.isSid) {
        // Either we find PID for SID and resolve with PID, or we fail here
        // (don't continue to storage, sysmeta, guess using SID)
        this.status(pid, STATUS.pidIsSeriesId, null, indexResult.meta);
        return this.resolveFromSeriesId(pid);
      }
      if (indexResult?.meta?.rms?.length > 1) {
        // Multiple resource maps found. If they are all versions of each other
        // and one is not yet obsoleted, then that is the one we want.
        const multiResult = await this.mutliRMCheck(pid, indexResult.meta.rms);
        const singleRM = multiResult.rm;
        if (singleRM) {
          return this.status(
            pid,
            STATUS.multiRMMatch,
            singleRM,
            multiResult.meta,
          );
        }
        // If not found, then continue with the resolution process
        this.status(pid, STATUS.multiRMMiss, null, multiResult.meta);
      }

      this.status(pid, STATUS.indexMiss, null, indexResult.meta);

      // ---- STORAGE ----
      const storageResult = await this.checkStorage(pid);
      if (storageResult.rm) {
        const valid = await this.verify(storageResult.rm, pid);
        if (valid) {
          return this.status(pid, STATUS.storageMatch, storageResult.rm);
        }
      }
      this.status(pid, STATUS.storageMiss, null);

      // ---- SYS META ----
      const smResult = await this.walkSysmeta(pid);
      if (smResult.rm) {
        const valid = await this.verify(smResult.rm, pid);
        if (valid) {
          return this.status(pid, STATUS.smMatch, smResult.rm, smResult.meta);
        }
      }
      if (smResult.meta?.unauthorized) {
        // If we got a 401 error, stop the resolution process
        return this.status(pid, STATUS.unauthorized, null, smResult.meta);
      }
      // Otherwise, we record that this step failed and continue to guess
      this.status(pid, STATUS.smMiss, null, smResult.meta);

      // ---- GUESS ----
      const guessedPid = await this.guessPid(pid);
      if (guessedPid) {
        const valid = await this.verify(guessedPid, pid);
        if (valid) {
          return this.status(pid, STATUS.guessMatch, guessedPid);
        }
      }
      this.status(pid, STATUS.guessMiss, null, { guessedPid });

      // ---- NOT FOUND ----
      return this.status(pid, STATUS.allMiss, null);
    }

    /**
     * Resolves the resource map PID from a series ID (SID). It first retrieves
     * the system metadata for the series ID to get the most up-to-date PID,
     * then starts the resolution process with the new PID. Called from
     * `resolve` when the index search returns a series ID.
     * @param {string} sid - The series ID to resolve
     * @returns {Promise<ResolveResult>} - The result of the resolution process
     */
    async resolveFromSeriesId(sid) {
      // Get sysmeta which will give the most up-to-date PID for a SID
      const pid = await this.getPidForSid(sid);
      if (!pid) return this.status(sid, STATUS.noPidForSeriesId, null);

      // Listen to every status update for the PID so we can add it to the
      // records for the SID (event log, local storage, other listeners, etc.)
      const eventName = `status:${pid}`;
      this.off(eventName);
      this.on(eventName, (event) => {
        // call status with the sid so we can add it to the event log
        this.status(sid, event.status, event.rm, {
          ...event.meta,
          sid,
        });
      });

      // Restart the resolution with the new PID
      let result = null;
      try {
        result = await this.resolve(pid);
      } finally {
        this.off(eventName); // Clean up the listener
      }
      return result;
    }

    /**
     * When 2 or more resource maps are found in the index for a PID, then this
     * method is called to check if they are all versions of each other and if
     * one is not yet obsoleted.
     * @param {string} pid - The PID to check for multiple resource maps
     * @param {Array<string>} rms - An array of resource map PIDs to check
     * @returns {Promise<object>} - An object containing the PID, the resolved
     * resource map PID if found, and metadata about the search.
     * @since 0.0.0
     */
    async mutliRMCheck(pid, rms) {
      const result = { pid, rm: null, meta: {} };

      // Get obsoletes and obsoletedBy from the sysMeta for each RM.
      const rmRecords = await Promise.all(
        rms.map((rm) => this.versionTracker.getAdjacent(rm, true)),
      );

      // Get a unique list of all PIDs from the records
      const allPids = new Set(
        rmRecords.flatMap((record) => [record.prev, record.next]),
      );

      // If any of the RM pids are not in the allPids set, then they are not
      // versions of each other, so we cannot resolve to a single RM.
      if (!rms.every((rm) => allPids.has(rm))) {
        result.meta.multipleRMsNotVersions = true;
        return result;
      }

      // All RMs are versions of each other, so find one that is not yet
      // obsoleted
      const validRms = rmRecords.filter((record) => !record.next?.length);

      if (validRms.length === 1) {
        result.rm = validRms[0].pid;
        return result;
      }

      // Otherwise, we have multiple RMs that are versions of each other but not
      // the most recent one, so we cannot resolve to a single RM.
      result.meta.multipleRMsAllObsoleted = true;
      return result;
    }

    /**
     * Gets the PID for a given series ID (SID) using sys metadata. Ensures that
     * the most recent PID is returned, even if indexing is not complete.
     * @param {string} sid - The series ID to get the PID for
     * @returns {Promise<string|null>} - The PID associated with the series ID,
     * or null if not found
     */
    async getPidForSid(sid) {
      const record = await this.versionTracker.getNth(sid, 0, false, true);
      const sysmeta = record.sysMeta;
      return sysmeta?.identifier;
    }

    /**
     * Logs all events for a given PID to the analytics service.
     * @param {string} pid - The PID of the object to log events for
     * @param {string} [eventName] - The name to use for the event in analytics.
     */
    logToAnalytics(pid, eventName = "resource_map_resolution") {
      const log = this.getLog(pid);
      if (log && log.events.length > 0) {
        this.eventLog.sendToAnalytics(log, eventName);
      } else {
        this.eventLog.consoleLog(
          `No events to send for PID: ${pid}`,
          "ResourceMapResolver",
          "info",
        );
      }
    }

    /**
     * Send any events logged for a PID to the analytics service.
     * @param {string} pid - The PID of the object to send logs for
     */
    trackMissingResourceMap(pid) {
      if (!pid) return;
      const params = { pid };
      this.eventLog.analytics?.trackCustomEvent(NO_RM_EVENT_NAME, params);
    }

    /**
     * Get the log of events for a given PID. If no log exists, a new one is
     * created.
     * @param {string} pid - The PID of the object to get the log for
     * @returns {object} - The event log for the PID, which includes an array of
     * events with timestamps, messages, and metadata.
     */
    getLog(pid) {
      if (!pid) return null;
      return this.eventLog.getOrCreateLog(pid);
    }

    /**
     * Checks the event log for unauthorized access events.
     * @param {object} log - The event log to check
     * @returns {boolean} - True if there are unauthorized access events, false
     * otherwise
     */
    static checkLogForUnauth(log) {
      const unauthorizedEvents = log.events?.filter(
        (event) => event.meta?.unauthorized,
      );
      if (unauthorizedEvents?.length) return true;
      return false;
    }

    /**
     * Checks the event log to see if multiple resource maps were found during
     * the index search.
     * @param {object} log - The event log to check
     * @returns {boolean} - True if multiple resource maps were found, false
     * otherwise
     */
    static checkLogForMultipleRMs(log) {
      const rmEvents = log.events?.filter((event) => event.meta?.rms);
      if (rmEvents?.length) return true;
      return false;
    }

    /**
     * Searches the index for a resource map associated with the given PID.
     * Returns an object containing the PID and metadata about the search.
     * @param {string} pid - The PID to search for in the index
     * @returns {Promise<object|null>} - An object containing the PID and
     * metadata if a resource map is found, null otherwise
     */
    async searchIndex(pid) {
      this.index.setQuery(`${ID_FIELD}:"${pid}" OR ${SERIESID_FIELD}:"${pid}"`);
      this.index.setfields([
        RM_FIELD,
        FORMAT_ID_FIELD,
        FORMAT_TYPE_FIELD,
        SERIESID_FIELD,
        ID_FIELD,
      ]);
      await this.index.queryPromise();
      const result = { pid, rm: null };

      const docs = this.index.toJSON() || [];

      const numDocs = this.index.getNumFound();
      if (numDocs === 0) return result;

      const meta = {
        isSid: docs.some((d) => d[SERIESID_FIELD] === pid),
        isData: docs.some((d) => d[FORMAT_TYPE_FIELD] === DATA_TYPE),
        isRM: docs?.some((d) => d[FORMAT_ID_FIELD] === RM_FORMAT_ID),
        rms: Array.from(new Set(docs.flatMap((d) => d[RM_FIELD] || []))),
      };
      result.meta = meta;

      if (meta.isRM) {
        result.rm = pid;
        return result;
      }

      if (meta.rms.length === 1 && !meta.isData && !meta.isSid) {
        [result.rm] = meta.rms;
        return result;
      }

      result.rm = result.rm || null;
      return result;
    }

    /**
     * Checks local storage / index DB for a resource map PID associated with
     * the given PID. Uses localForage to access the local storage.
     * @param {string} pid - The PID of the document to check
     * @returns {Promise<string|null>} - PID of RM if found, null otherwise
     */
    async checkStorage(pid) {
      return { rm: (await this.storage.getItem(pid)) || null };
    }

    /**
     * Clears the saved resource map : pid pairs from the local storage.
     * @returns {Promise<void>} - A promise that resolves when the storage is
     * cleared
     */
    clearStorage() {
      return this.storage.clear();
    }

    /**
     * Adds a resource map PID to the local storage for the given PID.
     * @param {string} pid - The PID of the document to add the RM for
     * @param {string} rm - The resource map PID to add
     * @returns {Promise<string|null>} - The PID of the resource map added to
     * storage, or null if the addition failed
     */
    async addToStorage(pid, rm) {
      if (!pid || !rm) {
        throw new Error("PID and RM are required to add to storage");
      }
      try {
        return await this.storage.setItem(pid, rm);
      } catch (err) {
        if (err.name === "QuotaExceededError") {
          await this.clearStorage();
          try {
            return await this.storage.setItem(pid, rm);
          } catch (retryErr) {
            this.eventLog.consoleLog(
              "Retry failed: Unable to add RM to local storage",
              "ResourceMapResolver",
              "warning",
              retryErr,
            );
            return null;
          }
        } else {
          // Unexpected error type
          this.eventLog.consoleLog(
            "Unexpected error adding RM to local storage",
            "ResourceMapResolver",
            "warning",
            err,
          );
          return null;
        }
      }
    }

    /**
     * Walks the system metadata to find the resource map PID associated with
     * the given PID. It starts from the given PID and walks backward
     * through the version history to find an old resource map PID. Then,
     * starting at the found RM pid, walks forward to find the current RM.
     * @param {string} pid - The PID of the document to walk sysmeta for
     * @returns {Promise<{rm: string|null, meta: object}>} - An object containing the
     * resource map PID if found, and metadata about the walk
     */
    async walkSysmeta(pid) {
      let steps = 0;
      let currentPid = pid;
      const pastPids = [];
      let rm = null;
      const meta = { stepsBack: 0, pastPids };

      /* eslint-disable no-await-in-loop */
      // The loop depends on the previous PID to find the next one,
      // so the loop must be synchronous (must await for each)
      while (steps < this.maxSteps && currentPid) {
        steps += 1;
        const offset = steps * -1; // Walk backward
        currentPid = await this.versionTracker.getNth(pid, offset);
        const record = await this.versionTracker.record(currentPid || pid);
        if (record?.unauthorized) meta.unauthorized = true;
        if (record?.errors) meta.errors = record.errors;
        if (currentPid) pastPids.push(currentPid);
        const indexResult = await this.searchIndex(currentPid);
        if (indexResult.rm) {
          rm = indexResult.rm;
          break;
        }
      }

      // Keep the meta/logs clean
      if (!meta.pastPids.length) delete meta.pastPids;

      /* eslint-enable no-await-in-loop */
      meta.stepsBack = steps;

      // If no prev. RM found, cannot walk forward to find current RM
      if (!rm) return { rm, meta };

      // Walk forward same # steps to find the current RM
      const currentRM = await this.versionTracker.getNth(rm, steps);
      return { rm: currentRM, meta };
    }

    /**
     * Guesses the resource map PID based on the PID. The guessed PID is
     * constructed by appending the PID to a predefined prefix.
     * @param {string} pid - The PID of the document to guess the RM PID for
     * @returns {Promise<string|null>} - The guessed resource map PID if it exists
     * and is linked to the PID, null otherwise
     */
    async guessPid(pid) {
      const guessed = `${RM_FILENAME_PREFIX}${pid}`;
      const isValid = await this.verify(guessed, pid);
      return isValid ? guessed : null;
    }

    /**
     * Verifies that the given resource map PID exists and contains the pid
     * as a member.
     * @param {string} rm - The PID of the resource map to verify
     * @param {string} pid - The PID of the document to check
     * @returns {Promise<boolean>} - True if the RM is valid and contains the PID,
     * false otherwise
     */
    async verify(rm, pid) {
      const rmFetchResults = await this.fetchResourceMap(rm);
      const rmModel = rmFetchResults?.model;
      const rmMembers = rmModel?.originalMembers;
      const isValid = ResourceMapResolver.containsPid(rmModel, pid);
      const meta = {};

      let status = STATUS.foundButNotValid;
      if (isValid) status = STATUS.foundAndValid;
      if (rmFetchResults?.status !== 200) {
        status = STATUS.rmFetchError;
        meta.error = rmFetchResults?.status || "Unknown error";
      } else {
        meta.rmMembers = rmMembers || [];
      }

      this.status(pid, status, isValid ? rm : null, meta);
      return isValid;
    }

    /**
     * Fetches the resource map model for the given resource map PID.
     * @param {string} rm - The PID of the resource map to fetch
     * @param {number} [timeout] - The maximum time to wait for the fetch
     * @returns {Promise<{model: PackageModel, status: number}>} - A promise
     * that resolves to an object containing the fetched resource map model and
     * the HTTP status code.
     */
    async fetchResourceMap(rm, timeout = this.maxFetchTime) {
      const rmModel = new PackageModel({ id: rm });
      return rmModel
        .fetchPromise(null, timeout)
        .catch((e) => ({ model: rmModel, status: e?.status || 500 }));
    }

    /**
     * Checks if the resource map model contains the given PID
     * as a member.
     * @param {PackageModel} rmModel - The resource map model to check
     * @param {string} pid - The PID to check for in the resource map
     * @returns {boolean} - True if the PID is found in the resource map,
     * false otherwise
     */
    static containsPid(rmModel, pid) {
      if (!rmModel || !pid) return false;
      const rmMembers = rmModel.get("memberIds") || [];
      return rmMembers.includes(pid);
    }

    /**
     * Logs an event for the resolution process.
     * @param {string} pid - The PID of the object being resolved
     * @param {string} rm - The resource map PID if found, null otherwise
     * @param {string} status - The human-readable status of the resolution
     * @param {object} [meta] - Additional metadata to include in the event
     * @param {string} [level] - The log level for the event
     * @returns {object} - The event log for the resolution process
     */
    log(pid, rm, status, meta = {}, level = "info") {
      const log = this.getLog(pid);

      // Remove redundant info to prevent logs from growing too large
      let info = { ...meta };
      delete info.pid; // pid is already in the log name
      info.rm = rm;

      // Delete any pairs with no value
      Object.keys(info).forEach((key) => {
        if (info[key] === null || info[key] === undefined || info[key] === "") {
          delete info[key];
        }
      });

      // Don't send an empty info object
      if (!Object.keys(info).length) info = null;

      this.eventLog.log(log, level, `Status: ${status}`, info);
      return log;
    }

    /**
     * Records the status of the resolution process for a given PID and triggers
     * Backbone events for the status update.
     * @param {string} pid - The PID of the object being resolved
     * @param {string} status - The human-readable status of the resolution
     * @param {string} [rm] - The resource map PID if found, null otherwise
     * @param {object} [meta] - Additional metadata to include in the status
     * @returns {ResolveResult} - An object with the result of the resolution
     */
    status(pid, status, rm, meta) {
      if (!pid) {
        throw new Error("PID is required for status updates");
      }
      const log = this.log(pid, rm, status, meta);

      // Publish events for status updates using Backbone events (added to the
      // prototype, below)
      this.trigger("update", { pid, rm, status, meta });
      this.trigger(`update:${pid}`, { pid, rm, status, meta });

      // Store the obj:rm pair in local storage if rm is found
      if (rm) this.addToStorage(pid, rm);

      const result = { success: !!rm, pid, log };
      if (rm) result.rm = rm;

      // If there are any unauthorized events in the log, add it to the result
      if (ResourceMapResolver.checkLogForUnauth(log))
        result.unauthorized = true;
      // If no rm, add a flag if there were multiple rms found in index
      if (!rm && ResourceMapResolver.checkLogForMultipleRMs(log))
        result.multipleRMs = true;

      return result;
    }
  }

  // Allow the class to trigger Backbone events
  Object.assign(ResourceMapResolver.prototype, Backbone.Events);

  // static map & accessor for singleton instances
  ResourceMapResolver.instances = new Map();

  ResourceMapResolver.get = function get(id = DEFAULT_ID) {
    if (!ResourceMapResolver.instances.has(id)) {
      ResourceMapResolver.instances.set(id, new ResourceMapResolver({ id }));
    }
    return ResourceMapResolver.instances.get(id);
  };

  return ResourceMapResolver;
});
