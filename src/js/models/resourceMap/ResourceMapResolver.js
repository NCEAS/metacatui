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
    storageMatch: "Resource map pid found in local storage",
    smMatch: "Resource map pid found by walking sysmeta",
    guessMatch: "Resource map pid guessed based on naming convention",
    // misses
    indexMiss: "Resource map pid not found in index",
    storageMiss: "Resource map pid not found in local storage",
    smMiss: "Resource map pid not found by walking sysmeta",
    guessMiss: "Resource map pid not found by guessing",
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
  const DEFAULT_NODE_ID = MetacatUI.appModel.get("nodeId") || "unknown";

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
   * @since 0.0.0
   */
  class ResourceMapResolver {
    /**
     * @param {object} options - Options for the resolver
     * @param {string} [options.nodeId] - The node ID to use for the resolver.
     * @param {string} [options.metaServiceUrl] - The base URL for service to get
     * System Metadata
     * @param {object} [options.storage] - An instance of localForage to use for
     * storage. If not provided, a new instance will be created with the name
     * "ResourceMapResolver".
     * @param {object} [options.eventLog] - An instance of EventLog to use
     * for tracing the resolution process. If not provided, a new instance will
     * be created.
     * @param {number} [options.maxSteps] - The maximum number of steps to
     * walk back in the system metadata to find a resource map PID.
     * @param {number} [options.maxFetchTime] - The maximum time to wait for
     * fetching the resource map PID from the system metadata. Defaults to 45s.
     */
    constructor(options = {}) {
      this.options = options;
      this.nodeId = options.nodeId || DEFAULT_NODE_ID;
      // Storage to store obj:ResMap pid pairs.
      const normalNodeId = this.nodeId
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();
      this.storage =
        options.storage ||
        LocalForage.createInstance({
          name: `ResourceMapResolver_${normalNodeId}`,
        });
      this.index = new Solr();
      this.versionTracker = new VersionTracker({
        metaServiceUrl: options.metaServiceUrl,
      });
      this.eventLog = options.eventLog || new EventLog();
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
      const record = await this.versionTracker.getNth(sid, 0, false, true);
      const sysmeta = record.sysMeta;

      const pid = sysmeta?.identifier;
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

    /** Clears the saved resource map : pid pairs from the local storage. */
    async clearStorage() {
      await this.storage.clear().catch((e) => {
        this.eventLog.consoleLog(
          "Error clearing local storage",
          "ResourceMapResolver",
          "warning",
          e,
        );
      });
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
      const log = this.eventLog.getOrCreateLog(pid);
      this.eventLog.log(log, level, `Status: ${status}`, {
        ...meta,
        pid,
        rm,
      });
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
      if (rm) {
        this.storage.setItem(pid, rm).catch((e) => {
          // Storage should not block the resolution process.
          this.eventLog.consoleLog(
            "Error storing RM in local storage",
            "ResourceMapResolver",
            "warning",
            e,
          );
        });
      }

      return { success: !!rm, pid, rm, log };
    }
  }

  // Allow the class to trigger Backbone events
  Object.assign(ResourceMapResolver.prototype, Backbone.Events);

  // static map & accessor for singleton instances
  ResourceMapResolver.instances = new Map();

  ResourceMapResolver.get = function get(nodeId = DEFAULT_NODE_ID) {
    if (!ResourceMapResolver.instances.has(nodeId)) {
      ResourceMapResolver.instances.set(
        nodeId,
        new ResourceMapResolver({ nodeId }),
      );
    }
    return ResourceMapResolver.instances.get(nodeId);
  };

  return ResourceMapResolver;
});
