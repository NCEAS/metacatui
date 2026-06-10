define([
  "backbone",
  "models/PersistentStorage",
  "models/sysmeta/VersionTracker",
  "models/PackageModel",
  "common/EventLog",
  "common/QueryService",
  "common/UrlUtilities",
  "common/ValueUtilities",
], (
  Backbone,
  PersistentStorage,
  VersionTracker,
  PackageModel,
  EventLog,
  QueryService,
  UrlUtilities,
  ValueUtilities,
) => {
  // Index field names
  const FIELDS = Object.freeze({
    RM: "resourceMap",
    FORMAT_ID: "formatId",
    FORMAT_TYPE: "formatType",
    IS_DOCUMENTED_BY: "isDocumentedBy",
    OBSOLETED_BY: "obsoletedBy",
    SERIESID: "seriesId",
    ID: "id",
    DATE_UPLOADED: "dateUploaded",
  });

  const QUERY_FIELDS = [
    FIELDS.RM,
    FIELDS.FORMAT_ID,
    FIELDS.FORMAT_TYPE,
    FIELDS.IS_DOCUMENTED_BY,
    FIELDS.OBSOLETED_BY,
    FIELDS.SERIESID,
    FIELDS.ID,
    FIELDS.DATE_UPLOADED,
  ];

  // Index values
  const RM_FORMAT_ID = "http://www.openarchives.org/ore/terms";
  const { FORMAT_TYPES } = QueryService;

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
      "Multiple resource maps found in index, but could not resolve to a single RM." +
      " They are either not versions of each other and/or are all are obsoleted.",
    // special cases
    pidIsSeriesId: "PID is a series ID, not an object PID",
    noPidForSeriesId: "PID not found for series ID",
    allMiss: "Resource map pid not found by any strategy",
    foundButNotValid:
      "Resource map pid found but does not link to the given PID",
    foundAndValid: "Resource map pid found and links to the given PID",
    rmFetchError: "Error fetching resource map via object API",
    unauthorized: "Stopped resolution: user not authorized to access sysmeta",
    multiResultSamePid:
      "Multiple documents were found in index with the same PID. This should not happen and indicates an issue with the index.",
  });

  const DEFAULT_MAX_STEPS = 200; // Default max steps to walk back in sysmeta
  const DEFAULT_MAX_FETCH_TIME = 45 * 1000; // Default max time to fetch RM: 45s

  // The event name for tracking missing resource maps (used by analytics)
  const NO_RM_EVENT_NAME = "resource_map_missing";

  // Default options for PersistentStorage
  const DEFAULT_STORAGE_OPTIONS = {
    ttlMs: 60 * 60 * 1000, // 1 hour
    memory: true,
  };

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
     * @param {object} options Options for the resolver
     * @param {string} [options.metaServiceUrl] The base URL for service to get
     * System Metadata
     * @param {PersistentStorage} [options.storage] An instance of
     * PersistentStorage to use for storing obj:resMap PID pairs. If not
     * provided, a new instance will be created.
     * @param {PersistentStorage#PersistentStorageOptions} [options.storageOptions]
     * Options for creating the PersistentStorage instance if one is not provided.
     * See {@link PersistentStorage#PersistentStorageOptions}
     * @param {object} [options.eventLog] An instance of EventLog to use for
     * tracing the resolution process. If not provided, a new instance will be
     * created.
     * @param {number} [options.maxSteps] The maximum number of steps to walk
     * back in the system metadata to find a resource map PID.
     * @param {number} [options.maxFetchTime] The maximum time to wait for
     * fetching the resource map PID from the system metadata. Defaults to 45s.
     * @param {"info"|"warning"|"error"} [options.consoleLevel] The level at
     * which to log messages to the console. Defaults to "warning". Set to false
     * to disable console logging.
     */
    constructor(options = {}) {
      this.options = options;

      const url =
        options.metaServiceUrl ||
        globalThis.MetacatUI?.appModel?.get("metaServiceUrl");
      const normalizedUrl = UrlUtilities.normalizeUrl(url);

      // Storage to store obj:ResMap pid pairs.
      const storageOptions = {
        ...DEFAULT_STORAGE_OPTIONS,
        ...(options.storageOptions || {}),
      };
      storageOptions.instanceKeys = storageOptions.instanceKeys || [];
      storageOptions.instanceKeys.push(normalizedUrl, "ResourceMapResolver");
      this.storage = options.storage || PersistentStorage.get(storageOptions);

      // Event log to trace the resolution process
      this.eventLog = options.eventLog || new EventLog();
      const consoleLevel =
        options.consoleLevel === false
          ? false
          : options.consoleLevel || "warning";
      this.eventLog.setConsoleLogLevel(consoleLevel);

      // Max steps to walk back in sysmeta
      this.maxSteps =
        Number.isInteger(options.maxSteps) && options.maxSteps > 0
          ? options.maxSteps
          : DEFAULT_MAX_STEPS;

      // Max time to fetch RM
      this.maxFetchTime =
        Number.isInteger(options.maxFetchTime) && options.maxFetchTime > 0
          ? options.maxFetchTime
          : DEFAULT_MAX_FETCH_TIME;

      // VersionTracker instance to walk sysmeta
      this.versionTracker = new VersionTracker({
        metaServiceUrl: normalizedUrl,
        maxChainHops: this.maxSteps,
      });
    }

    /**
     * Extracts a useful error message or status code from an error object, if
     * possible.
     * @param {Error|object|string} error The error to extract the message from
     * @returns {string|number} The extracted error message or status code, or
     * the original error if no message or status code could be extracted
     * @since 0.0.0
     * @private
     */
    static errorValue(error) {
      return error?.status || error?.message || error;
    }

    /**
     * Logs a warning message to the event log and console (if console logging
     * is enabled).
     * @param {string} message The warning message to log
     * @param {Error|object|string} [error] An optional error object
     * @since 0.0.0
     */
    warn(message, error) {
      this.eventLog.consoleLog(
        message,
        "ResourceMapResolver",
        "warning",
        error,
      );
    }

    /**
     * An object representing the result of the resolution process.
     * @typedef {object} ResolveResult
     * @property {boolean} success Whether the resolution was successful
     * @property {string} pid The PID of the object to find a resource map for
     * (generally an EML PID)
     * @property {string} [rm] The resolved resource map PID if successful
     * @property {Array} log The event log for the resolution process,
     * including an array of events with timestamps, messages, and metadata.
     * @property {boolean} [unauthorized] Set to true when the resolution
     * process was stopped due to unauthorized access to the system metadata
     * (possibly sysmeta for a previous version of the object).
     * @property {boolean} [multipleRMs] Set to true when multiple resource
     * maps were found in the index for the given PID, but no single RM could be
     * attributed to the PID.
     */

    /**
     * The main method to resolve the resource map PID for a given PID. It will
     * try multiple strategies in order to find the resource map associated with
     * the PID.
     * @param {string} pid The PID of the document to resolve
     * @param {object} [options] Resolution options.
     * @param {string[]} [options.fields] An array of index fields to query in
     * addition to the default fields. This can be used to get additional
     * metadata about the PID from the index to reduce queries by the consumer.
     * @returns {Promise<ResolveResult>} The result of the resolution process
     */
    async resolve(pid, options = {}) {
      // ---- INDEX ----
      let indexResult = null;
      try {
        indexResult = await this.constructor.searchIndex(pid, options);
      } catch (error) {
        indexResult = {
          pid,
          rm: null,
          meta: {
            indexError: true,
            error: this.constructor.errorValue(error),
          },
        };
        // Don't stop resolution process if index search fails for some reason
        // (e.g. Solr is down).
        this.warn(`Error searching index for PID ${pid}`, error);
      }

      let resolutionMeta = { ...(indexResult?.meta || {}) };
      const foundRM = indexResult?.rm || null;
      if (foundRM) {
        return this.status(pid, STATUS.indexMatch, foundRM, {
          ...resolutionMeta,
          source: "index",
        });
      }

      // -- Special case: PID is a series ID --
      if (indexResult?.meta?.isSid) {
        // Either we find PID for SID and resolve with PID, or we fail here
        // (don't continue to storage, sysmeta, guess using SID)
        this.status(pid, STATUS.pidIsSeriesId, null, resolutionMeta);
        return this.resolveFromSeriesId(pid);
      }

      // -- Special case: PID a data object and has isDocumentedBy metadata PIDs --
      if (
        indexResult?.meta?.isData &&
        indexResult.meta.isDocumentedBy?.length
      ) {
        const metadataSearchResult = await this.resolveFromMetadataPids(
          indexResult.meta.isDocumentedBy,
        );
        resolutionMeta = { ...resolutionMeta, ...metadataSearchResult.meta };
        if (metadataSearchResult.rm) {
          // First verify
          const valid = await this.verify(metadataSearchResult.rm, pid);
          if (valid) {
            return this.status(
              pid,
              STATUS.indexMatch,
              metadataSearchResult.rm,
              {
                ...resolutionMeta,
                source: "isDocumentedBy",
              },
            );
          }
        }
      }

      // -- Special case: more than 1 resource map found in index --
      const rmCandidates = ValueUtilities.normalizeStringList(
        resolutionMeta?.rms || [],
      );
      if (rmCandidates.length > 1) {
        // Multiple resource maps found. If they are all versions of each other
        // and one is not yet obsoleted, then that is the one we want.
        const multiResult = await this.multiRMCheck(pid, rmCandidates);
        const singleRM = multiResult.rm;
        const multiMeta = {
          ...resolutionMeta,
          ...multiResult.meta,
          rms: rmCandidates,
        };
        if (singleRM) {
          return this.status(pid, STATUS.multiRMMatch, singleRM, {
            ...multiMeta,
            source: "index",
            multipleRMsResolvedToSingleRoot: true,
          });
        }
        // If not found, then continue with the resolution process
        this.status(pid, STATUS.multiRMMiss, null, multiMeta);
      }

      this.status(pid, STATUS.indexMiss, null, resolutionMeta);

      // ---- STORAGE ----
      const storageResult = await this.checkStorage(pid);
      if (storageResult.rm) {
        const valid = await this.verify(storageResult.rm, pid);
        if (valid) {
          return this.status(pid, STATUS.storageMatch, storageResult.rm, {
            ...resolutionMeta,
            source: "storage",
          });
        }
      }
      this.status(pid, STATUS.storageMiss, null);

      // ---- SYS META ----
      const smResult = await this.walkSysmeta(pid);
      if (smResult.rm) {
        const valid = await this.verify(smResult.rm, pid);
        if (valid) {
          return this.status(pid, STATUS.smMatch, smResult.rm, {
            ...resolutionMeta,
            ...(smResult.meta || {}),
            source: "sysMeta",
          });
        }
      }
      if (smResult.meta?.unauthorized) {
        // If we got a 401 error, stop the resolution process
        return this.status(pid, STATUS.unauthorized, null, {
          ...resolutionMeta,
          ...smResult.meta,
          source: "sysMeta",
        });
      }
      // Otherwise, we record that this step failed and continue to guess
      this.status(pid, STATUS.smMiss, null, smResult.meta);

      // ---- GUESS BY NAMING CONVENTION ----
      const guessedPid = await this.guessPid(pid);
      if (guessedPid) {
        // Already verified in guessPid, so just return the result
        return this.status(pid, STATUS.guessMatch, guessedPid, {
          ...resolutionMeta,
          source: "guess",
        });
      }
      this.status(pid, STATUS.guessMiss, null, { guessedPid });

      // ---- NOT FOUND ----
      return this.status(pid, STATUS.allMiss, null, resolutionMeta);
    }

    /**
     * Given a list of metadata PIDs, collapse them by version chain, then
     * resolve a resource map for each unique version chain.
     * @param {string[]} metadataPids An array of metadata PIDs, e.g. the
     * documentedBy PIDs returned from the index for a data PID.
     * @returns {Promise<{rm: (string|null), meta: object}>} The resolved RM PID
     * if found, and metadata about the resolution attempt
     */
    async resolveFromMetadataPids(metadataPids = []) {
      const inputMetadataPids =
        ValueUtilities.normalizeStringList(metadataPids);
      const result = {
        rm: null,
        meta: {
          inputMetadataPids,
          metadataCandidates: [],
          resolvedMetadataPids: [],
          rms: [],
        },
      };
      if (!inputMetadataPids.length) return result;

      // First, reduce the list of metadata PIDs to the latest reachable PIDs
      // from each version chain. This avoids redundant resolution attempts for
      // metadata that are just older versions of each other.
      result.meta.metadataCandidates =
        await this.reducePidsToLatest(inputMetadataPids);

      // Next, resolve the RM for each metadata PID candidate.
      const metadataResults = await Promise.all(
        result.meta.metadataCandidates.map(async (metadataPid) => {
          try {
            return {
              metadataPid,
              result: await this.resolve(metadataPid),
            };
          } catch (error) {
            this.warn(`Error resolving metadata PID ${metadataPid}`, error);
            return { metadataPid, result: null };
          }
        }),
      );

      const resolvedMetadataPids = metadataResults.map(
        (metadataResult) => metadataResult.metadataPid,
      );
      const rmCandidates = ValueUtilities.normalizeStringList(
        metadataResults.map((metadataResult) => metadataResult.result?.rm),
      );

      result.meta.resolvedMetadataPids =
        ValueUtilities.normalizeStringList(resolvedMetadataPids);
      result.meta.rms = rmCandidates;

      if (rmCandidates.length === 1) {
        [result.rm] = rmCandidates;
      }

      return result;
    }

    /**
     * Collapse a list of PIDs to only the most one for its version chain. For
     * example, if given 3 PIDs that are all part of the same version chain, it
     * will remove the two older versions. If given PIDs that are part of
     * different version chains, it will return the most recent PID from each
     * chain.
     * @param {string[]} pids PIDs to group by version chain
     * @returns {Promise<string[]>} Latest PID from each discovered chain
     */
    async reducePidsToLatest(pids = []) {
      let remainingPids = ValueUtilities.normalizeStringList(pids);
      const latestPids = [];

      while (remainingPids.length) {
        let chainDetails;
        try {
          chainDetails =
            /* eslint-disable no-await-in-loop */
            await this.versionTracker.checkPidsInSameVersionChain(
              remainingPids,
            );
        } catch (error) {
          return remainingPids; // If we can't get version info, just return the original list
        }

        if (chainDetails.sameChain) {
          latestPids.push(chainDetails.newestPid);
          break;
        }

        const chain = new Set(chainDetails.chain || []);
        latestPids.push(chainDetails.newestPid || remainingPids[0]);
        remainingPids = remainingPids.filter((pid) => !chain.has(pid));
      }

      return ValueUtilities.normalizeStringList(latestPids);
    }

    /**
     * Resolves the resource map PID from a series ID (SID). It first retrieves
     * the system metadata for the series ID to get the most up-to-date PID,
     * then starts the resolution process with the new PID. Called from
     * `resolve` when the index search returns a series ID.
     * @param {string} sid The series ID to resolve
     * @returns {Promise<ResolveResult>} The result of the resolution process
     */
    async resolveFromSeriesId(sid) {
      // Get sysmeta which will give the most up-to-date PID for a SID
      const pid = await this.getPidForSid(sid);
      if (!pid) return this.status(sid, STATUS.noPidForSeriesId, null);

      // Listen to every status update for the PID so we can add it to the
      // records for the SID (event log, local storage, other listeners, etc.)
      const eventName = `update:${pid}`;
      const sidStatusForwarder = (event) => {
        // call status with the sid so we can add it to the event log
        this.status(sid, event.status, event.rm, {
          ...event.meta,
          sid,
        });
      };
      this.off(eventName, sidStatusForwarder);
      this.on(eventName, sidStatusForwarder);

      // Restart the resolution with the new PID
      let result = null;
      try {
        result = await this.resolve(pid);
      } finally {
        // Remove only this listener so existing subscribers are preserved.
        this.off(eventName, sidStatusForwarder);
      }
      return result;
    }

    /**
     * When 2 or more resource maps are found in the index for a PID, then this
     * method is called to check if they are all versions of each other. If so,
     * it returns the most recent resource map PID, but only if that PID is not
     * obsoleted.
     * @param {string} pid The PID to check for multiple resource maps
     * @param {Array<string>} rms An array of resource map PIDs to check
     * @returns {Promise<object>} An object containing the PID, the resolved
     * resource map PID if found, and metadata about the search.
     * @since 2.34.1
     */
    async multiRMCheck(pid, rms) {
      const result = { pid, rm: null, meta: {} };

      if (!Array.isArray(rms) || rms.length === 0) {
        result.meta.multipleRMsNotVersions = true;
        return result;
      }
      let versionChain;
      try {
        versionChain =
          await this.versionTracker.checkPidsInSameVersionChain(rms);
      } catch (e) {
        result.meta.error = this.constructor.errorValue(e);
        this.warn(`Error fetching version chain for PID ${rms[0]}`, e);
        return result;
      }
      const { newestInChain, newestPid: newestRm, sameChain } = versionChain;

      // If the next chain is incomplete, we cannot be sure we have the most
      // recent RM
      if (!versionChain.chainComplete) {
        result.meta.chainIncomplete = true;
        if (versionChain.endIsPrivate) {
          result.meta.unauthorized = true;
        }
        if (versionChain.endNotFound) {
          result.meta.notFound = true;
        }
        return result;
      }

      // If the version history of one RM contains all of the others, then they
      // are all versions of each other. If not, we cannot resolve to a single RM.
      if (!sameChain) {
        result.meta.multipleRMsNotVersions = true;
        return result;
      }

      if (newestRm !== newestInChain) {
        result.meta.multipleRMsAllObsoleted = true;
        return result;
      }

      if (newestRm) {
        result.rm = newestRm;
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
     * @param {string} sid The series ID to get the PID for
     * @returns {Promise<string|null>} The PID associated with the series ID,
     * or null if not found
     */
    async getPidForSid(sid) {
      try {
        const sysMeta = await this.getSysMeta(sid);
        return sysMeta?.identifier || null;
      } catch (error) {
        if (error?.status) {
          this.warn(`Failed to resolve PID for SID ${sid}`, error);
        }
        return null;
      }
    }

    /**
     * Gets the system metadata for a given PID.
     * @param {string} pid The PID to get the system metadata for
     * @param {object} [options] Options to SysMeta service
     * @returns {Promise<SystemMetadata>} The sysMeta for the PID
     */
    async getSysMeta(pid, options = {}) {
      return this.versionTracker.getSysMeta(pid, options);
    }

    /**
     * Logs all events for a given PID to the analytics service.
     * @param {string} pid The PID of the object to log events for
     * @param {string} [eventName] The name to use for the event in analytics.
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
     * @param {string} pid The PID of the object to send logs for
     */
    trackMissingResourceMap(pid) {
      if (!pid) return;
      const params = { pid };
      this.eventLog.analytics?.trackCustomEvent(NO_RM_EVENT_NAME, params);
    }

    /**
     * Get the log of events for a given PID. If no log exists, a new one is
     * created.
     * @param {string} pid The PID of the object to get the log for
     * @returns {object} The event log for the PID, which includes an array of
     * events with timestamps, messages, and metadata.
     */
    getLog(pid) {
      if (!pid) return null;
      return this.eventLog.getOrCreateLog(pid);
    }

    /**
     * Checks the event log for unauthorized access events.
     * @param {object} log The event log to check
     * @returns {boolean} True if there are unauthorized access events, false
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
     * @param {object} log The event log to check
     * @returns {boolean} True if multiple resource maps were found, false
     * otherwise
     */
    static checkLogForMultipleRMs(log) {
      const rmEvents = log.events?.filter(
        (event) => Array.isArray(event.meta?.rms) && event.meta.rms.length > 1,
      );
      if (rmEvents?.length) return true;
      return false;
    }

    /**
     * Return the most recent PID represented by a set of Solr docs.
     * @param {object[]} docs Solr docs
     * @returns {string|null} Latest PID if available
     */
    static selectLatestPidFromDocs(docs = []) {
      const getDateUploadedTime = (doc) => {
        const dateValue = ValueUtilities.listify(
          doc?.[FIELDS.DATE_UPLOADED],
        )[0];
        const time = Date.parse(dateValue);
        return Number.isNaN(time) ? null : time;
      };
      const compareDateUploadedDesc = (a, b) => {
        const aTime = getDateUploadedTime(a);
        const bTime = getDateUploadedTime(b);
        if (aTime === bTime) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        return bTime - aTime;
      };
      const validDocs = docs
        .filter((doc) => typeof doc?.[FIELDS.ID] === "string")
        .sort(compareDateUploadedDesc);
      if (!validDocs.length) return null;

      const docPidSet = new Set(validDocs.map((doc) => doc[FIELDS.ID]));
      const latestDocs = validDocs.filter((doc) => {
        const obsoletedBy = ValueUtilities.listify(doc?.[FIELDS.OBSOLETED_BY]);
        return !obsoletedBy.some((value) => docPidSet.has(value));
      });

      if (latestDocs.length) return latestDocs[0][FIELDS.ID];
      return validDocs[0][FIELDS.ID];
    }

    /**
     * Searches the index for a resource map associated with the given PID.
     * Returns an object containing the PID and metadata about the search.
     * @param {string} pid The PID to search for in the index
     * @param {object} [options] Search options
     * @param {string[]} [options.fields] An array of index fields to query in
     * addition to the default fields.
     * @returns {Promise<object|null>} An object containing the PID and metadata
     * if a resource map is found, null otherwise
     */
    static async searchIndex(pid, options) {
      const meta = { numFound: 0 };
      const result = { pid, rm: null, meta };

      const response = await QueryService.queryWithFetch({
        q: QueryService.buildIdQuery(pid),
        fields: [...QUERY_FIELDS, ...(options?.fields || [])],
        rows: 100,
      });
      const docs = QueryService.parseResponse(response);
      const numFound = response?.response?.numFound || docs.length;
      if (numFound === 0) return result;
      meta.numFound = numFound;
      meta.indexResults = docs;

      // If we found one doc matching the incoming PID, then we can be fairly
      // confident about the format type and use that to help with the
      // resolution.
      const idMatch = docs.filter((doc) => doc[FIELDS.ID] === pid);
      if (idMatch.length > 1) throw new Error(STATUS.multiResultSamePid);
      if (idMatch.length === 1) {
        const doc = idMatch[0];
        const formatType = doc[FIELDS.FORMAT_TYPE];
        meta.formatType = formatType;
        meta.indexMatch = doc;
        if (formatType === FORMAT_TYPES.DATA) {
          meta.isData = true;
        } else if (formatType === FORMAT_TYPES.METADATA) {
          meta.isMetadata = true;
        } else if (formatType === RM_FORMAT_ID) {
          meta.isRM = true;
          result.rm = doc[FIELDS.ID];
        }
      }

      // Collect other metadata about the PID from the search results that may
      // be helpful for the resolution process
      meta.isSid = docs.some((doc) =>
        ValueUtilities.listify(doc?.[FIELDS.SERIESID]).includes(pid),
      );
      meta.rms = ValueUtilities.normalizeStringList(
        docs.flatMap((doc) => ValueUtilities.listify(doc?.[FIELDS.RM])),
      );
      meta.isDocumentedBy = ValueUtilities.normalizeStringList(
        docs.flatMap((doc) =>
          ValueUtilities.listify(doc?.[FIELDS.IS_DOCUMENTED_BY]),
        ),
      );

      // If the PID is a series ID, then we need to follow other steps to find
      // the RM.
      if (!meta.isSid) {
        if (meta.rms.length === 1) [result.rm] = meta.rms;
        if (result.rm) return result;
      }

      return result;
    }

    /**
     * Checks local storage / index DB for a resource map PID associated with
     * the given PID. Uses PersistentStorage to access the local storage.
     * @param {string} pid The PID of the document to check
     * @returns {Promise<string|null>} PID of RM if found, null otherwise
     */
    async checkStorage(pid) {
      return { rm: (await this.storage.getItem(pid)) || null };
    }

    /**
     * Clears the saved resource map : pid pairs from the local storage.
     * @returns {Promise<void>} A promise that resolves when the storage is
     * cleared
     */
    clearStorage() {
      return this.storage.clear();
    }

    /**
     * Adds a resource map PID to the local storage for the given PID.
     * @param {string} pid The PID of the document to add the RM for
     * @param {string} rm The resource map PID to add
     * @returns {Promise<string|null>} The PID of the resource map added to
     * storage, or null if the addition failed
     */
    async addToStorage(pid, rm) {
      if (!pid || !rm) {
        throw new Error("PID and RM are required to add to storage");
      }
      try {
        return await this.storage.setItem(pid, rm);
      } catch (err) {
        if (PersistentStorage.isQuotaError(err)) {
          await this.clearStorage();
          try {
            return await this.storage.setItem(pid, rm);
          } catch (retryErr) {
            this.warn(
              "Retry failed: Unable to add RM to local storage",
              retryErr,
            );
            return null;
          }
        } else {
          // Unexpected error type
          this.warn("Unexpected error adding RM to local storage", err);
          return null;
        }
      }
    }

    /**
     * Walks the system metadata to find the resource map PID associated with
     * the given PID. It starts from the given PID and walks backward
     * through the version history to find an old resource map PID. Then,
     * starting at the found RM pid, walks forward to find the current RM.
     * @param {string} pid The PID of the document to walk sysmeta for
     * @returns {Promise<{rm: string|null, meta: object}>} An object containing the
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
        let prevPid = null;
        try {
          prevPid = await this.versionTracker.getPrev(currentPid);
        } catch (error) {
          if (error?.status === 401) meta.unauthorized = true;
          if (error?.status) {
            if (!meta.errors) meta.errors = [];
            meta.errors.push(error.status);
          }
          break;
        }

        if (!prevPid) break;
        steps += 1;
        currentPid = prevPid;
        pastPids.push(currentPid);
        let indexResult = null;
        try {
          indexResult = await this.constructor.searchIndex(currentPid);
        } catch (error) {
          meta.indexError = true;
          meta.error = this.constructor.errorValue(error);
          this.warn(`Error searching index for prior PID ${currentPid}`, error);
          break;
        }
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
      const currentRM =
        steps > 0 ? await this.versionTracker.getNth(rm, steps) : rm;
      return { rm: currentRM, meta };
    }

    /**
     * Guesses the resource map PID based on the PID. The guessed PID is
     * constructed by appending the PID to a predefined prefix.
     * @param {string} pid The PID of the document to guess the RM PID for
     * @returns {Promise<string|null>} The guessed resource map PID if it exists
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
     * @param {string} rm The PID of the resource map to verify
     * @param {string} pid The PID of the document to check
     * @returns {Promise<boolean>} True if the RM is valid and contains the PID,
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
        meta.matchedPid = isValid ? pid : null;
      }

      this.status(pid, status, isValid ? rm : null, meta);
      return isValid;
    }

    /**
     * Fetches the resource map model for the given resource map PID.
     * @param {string} rm The PID of the resource map to fetch
     * @param {number} [timeout] The maximum time to wait for the fetch
     * @returns {Promise<{model: PackageModel, status: number}>} A promise
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
     * @param {PackageModel} rmModel The resource map model to check
     * @param {string} pid The PID to check for in the resource map
     * @returns {boolean} True if the PID is found in the resource map,
     * false otherwise
     */
    static containsPid(rmModel, pid) {
      if (!rmModel || !pid) return false;
      const rmMembers = rmModel.get("memberIds") || [];
      return rmMembers.includes(pid);
    }

    /**
     * Logs an event for the resolution process.
     * @param {string} pid The PID of the object being resolved
     * @param {string} rm The resource map PID if found, null otherwise
     * @param {string} status The human-readable status of the resolution
     * @param {object} [meta] Additional metadata to include in the event
     * @param {string} [level] The log level for the event
     * @returns {object} The event log for the resolution process
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
     * @param {string} pid The PID of the object being resolved
     * @param {string} status The human-readable status of the resolution
     * @param {string} [rm] The resource map PID if found, null otherwise
     * @param {object} [meta] Additional metadata to include in the status
     * @returns {ResolveResult} An object with the result of the resolution
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
        this.addToStorage(pid, rm).catch((error) => {
          this.warn(`Failed to persist RM ${rm} for PID ${pid}`, error);
        });
      }

      const result = { success: !!rm, pid, log };
      if (rm) result.rm = rm;
      if (meta) result.meta = meta;

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

  ResourceMapResolver.QUERY_FIELDS = QUERY_FIELDS;

  return ResourceMapResolver;
});
