define([
  "backbone",
  "models/PersistentStorage",
  "models/sysmeta/VersionTracker",
  "models/resourceMap/ResourceMap",
  "models/dataONEServices/ObjectService",
  "common/EventLog",
  "common/QueryService",
  "common/ErrorUtilities",
  "common/UrlUtilities",
  "common/Utilities",
  "common/ValueUtilities",
], (
  Backbone,
  PersistentStorage,
  VersionTracker,
  ResourceMap,
  ObjectService,
  EventLog,
  QueryService,
  ErrorUtilities,
  UrlUtilities,
  Utilities,
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

  const QUERY_FIELDS = Object.values(FIELDS);

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
    resolutionCycle: "Stopped resolution after finding a PID cycle",
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
      this.events = { ...Backbone.Events };

      const url =
        options.metaServiceUrl ||
        globalThis.MetacatUI?.appModel?.get("metaServiceUrl");
      const normalizedUrl = UrlUtilities.normalizeUrl(url);

      // Storage to store obj:ResMap pid pairs.
      const storageOptions = {
        ...DEFAULT_STORAGE_OPTIONS,
        ...(options.storageOptions || {}),
      };
      storageOptions.instanceKeys = [
        ...(storageOptions.instanceKeys || []),
        normalizedUrl,
        "ResourceMapResolver",
      ];
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
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @param {Set<string>} [visitedPids] PIDs already visited in this path
     * @returns {Promise<ResolveResult>} The result of the resolution process
     */
    async resolve(pid, options = {}, visitedPids = new Set()) {
      if (visitedPids.has(pid)) {
        return this.status(pid, STATUS.resolutionCycle, null, {
          resolutionCycle: true,
          cyclePid: pid,
        });
      }

      const nextVisitedPids = new Set(visitedPids);
      nextVisitedPids.add(pid);

      // ---- INDEX ----
      let indexResult = null;
      try {
        indexResult = await this.constructor.searchIndex(pid, options);
      } catch (error) {
        if (ErrorUtilities.isAbortError(error)) throw error;
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
      if (indexResult?.rm) {
        return this.status(pid, STATUS.indexMatch, indexResult.rm, {
          ...resolutionMeta,
          source: "index",
        });
      }

      // -- Special case: PID is a series ID --
      if (indexResult?.meta?.isSid) {
        // Either we find PID for SID and resolve with PID, or we fail here
        // (don't continue to storage, sysmeta, guess using SID)
        this.status(pid, STATUS.pidIsSeriesId, null, resolutionMeta);
        return this.resolveFromSeriesId(pid, options, nextVisitedPids);
      }

      // -- Special case: PID a data object and has isDocumentedBy metadata PIDs --
      if (
        indexResult?.meta?.isData &&
        indexResult.meta.isDocumentedBy?.length
      ) {
        const metadataSearchResult = await this.resolveFromMetadataPids(
          indexResult.meta.isDocumentedBy,
          options,
          nextVisitedPids,
        );
        const rms = ValueUtilities.normalizeStringList([
          ...(resolutionMeta.rms || []),
          ...(metadataSearchResult.meta?.rms || []),
        ]);
        resolutionMeta = {
          ...resolutionMeta,
          ...metadataSearchResult.meta,
          rms,
        };
        if (
          metadataSearchResult.rm &&
          (await this.verify(metadataSearchResult.rm, pid, options))
        ) {
          return this.status(pid, STATUS.indexMatch, metadataSearchResult.rm, {
            ...resolutionMeta,
            source: "isDocumentedBy",
          });
        }
      }

      // -- Special case: more than 1 resource map found in index --
      const rmCandidates = ValueUtilities.normalizeStringList(
        resolutionMeta.rms || [],
      );
      if (rmCandidates.length > 1) {
        // Multiple resource maps found. If they are all versions of each other
        // and one is not yet obsoleted, then that is the one we want.
        const multiResult = await this.multiRMCheck(rmCandidates, options);
        const multiMeta = {
          ...resolutionMeta,
          ...multiResult.meta,
          rms: rmCandidates,
        };
        if (multiResult.rm) {
          return this.status(pid, STATUS.multiRMMatch, multiResult.rm, {
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
      let storedRM = null;
      try {
        storedRM = await this.checkStorage(pid);
      } catch (error) {
        if (ErrorUtilities.isAbortError(error)) throw error;
        this.warn(`Error checking local storage for PID ${pid}`, error);
      }
      if (storedRM && (await this.verify(storedRM, pid, options))) {
        return this.status(pid, STATUS.storageMatch, storedRM, {
          ...resolutionMeta,
          source: "storage",
        });
      }
      this.status(pid, STATUS.storageMiss, null);

      // ---- SYS META ----
      const smResult = await this.walkSysmeta(pid, options);
      if (smResult.rm && (await this.verify(smResult.rm, pid, options))) {
        return this.status(pid, STATUS.smMatch, smResult.rm, {
          ...resolutionMeta,
          ...(smResult.meta || {}),
          source: "sysMeta",
        });
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
      const guessedPid = await this.guessPid(pid, options);
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
     * @param {object} [options] Resolution options
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @param {Set<string>} [visitedPids] PIDs already visited in this path
     * @returns {Promise<{rm: (string|null), meta: object}>} The resolved RM PID
     * if found, and metadata about the resolution attempt
     */
    async resolveFromMetadataPids(
      metadataPids = [],
      options = {},
      visitedPids = new Set(),
    ) {
      const inputMetadataPids =
        ValueUtilities.normalizeStringList(metadataPids);
      if (!inputMetadataPids.length) {
        return {
          rm: null,
          meta: {
            inputMetadataPids,
            metadataCandidates: [],
            resolvedMetadataPids: [],
            rms: [],
          },
        };
      }

      // First, reduce the list of metadata PIDs to the latest reachable PIDs
      // from each version chain. This avoids redundant resolution attempts for
      // metadata that are just older versions of each other.
      const metadataCandidates = await this.reducePidsToLatest(
        inputMetadataPids,
        options,
      );

      // Next, resolve the RM for each metadata PID candidate.
      const metadataResults = await Promise.all(
        metadataCandidates.map(async (metadataPid) => {
          try {
            return await this.resolve(metadataPid, options, visitedPids);
          } catch (error) {
            if (ErrorUtilities.isAbortError(error)) throw error;
            if (Array.isArray(error?.issues) && error.issues.length) {
              throw error;
            }
            this.warn(`Error resolving metadata PID ${metadataPid}`, error);
            return null;
          }
        }),
      );

      const rmCandidates = ValueUtilities.normalizeStringList(
        metadataResults.flatMap((metadataResult) => [
          metadataResult?.rm,
          ...(metadataResult?.meta?.rms || []),
        ]),
      );

      return {
        rm: rmCandidates.length === 1 ? rmCandidates[0] : null,
        meta: {
          inputMetadataPids,
          metadataCandidates,
          resolvedMetadataPids: [...metadataCandidates],
          rms: rmCandidates,
        },
      };
    }

    /**
     * Collapse a list of PIDs to only the most one for its version chain. For
     * example, if given 3 PIDs that are all part of the same version chain, it
     * will remove the two older versions. If given PIDs that are part of
     * different version chains, it will return the most recent PID from each
     * chain.
     * @param {string[]} pids PIDs to group by version chain
     * @param {object} [options] Version-chain lookup options
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @returns {Promise<string[]>} Latest PID from each discovered chain
     */
    async reducePidsToLatest(pids = [], options = {}) {
      let remainingPids = ValueUtilities.normalizeStringList(pids);
      const latestPids = [];

      while (remainingPids.length) {
        let chainDetails;
        try {
          // eslint-disable-next-line no-await-in-loop
          chainDetails = await this.versionTracker.checkPidsInSameVersionChain(
            remainingPids,
            options,
          );
        } catch (error) {
          if (ErrorUtilities.isAbortError(error)) throw error;
          return ValueUtilities.normalizeStringList([
            ...latestPids,
            ...remainingPids,
          ]);
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
     * @param {object} [options] Resolution options
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @param {Set<string>} [visitedPids] PIDs already visited in this path
     * @returns {Promise<ResolveResult>} The result of the resolution process
     */
    async resolveFromSeriesId(sid, options = {}, visitedPids = new Set()) {
      // Get sysmeta which will give the most up-to-date PID for a SID
      const pid = await this.getPidForSid(sid, options);
      if (!pid) return this.status(sid, STATUS.noPidForSeriesId, null);
      if (visitedPids.has(pid)) {
        return this.status(sid, STATUS.resolutionCycle, null, {
          resolutionCycle: true,
          cyclePid: pid,
        });
      }

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
      this.events.on(eventName, sidStatusForwarder);

      // Restart the resolution with the new PID
      try {
        return await this.resolve(pid, options, visitedPids);
      } finally {
        // Remove only this listener so existing subscribers are preserved.
        this.events.off(eventName, sidStatusForwarder);
      }
    }

    /**
     * When 2 or more resource maps are found in the index for a PID, then this
     * method is called to check if they are all versions of each other. If so,
     * it returns the most recent resource map PID, but only if that PID is not
     * obsoleted.
     * @param {Array<string>} rms An array of resource map PIDs to check
     * @param {object} [options] Version-chain lookup options
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @returns {Promise<object>} The resolved resource map PID, when found,
     * and metadata about the search.
     * @since 2.34.1
     */
    async multiRMCheck(rms, options = {}) {
      const result = { rm: null, meta: {} };

      let versionChain;
      try {
        versionChain = await this.versionTracker.checkPidsInSameVersionChain(
          rms,
          options,
        );
      } catch (e) {
        if (ErrorUtilities.isAbortError(e)) throw e;
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

      // Only resolve when one candidate is the unobsoleted head of the chain.
      if (!newestRm || newestRm !== newestInChain) {
        result.meta.multipleRMsAllObsoleted = true;
        return result;
      }

      result.rm = newestRm;
      return result;
    }

    /**
     * Gets the PID for a given series ID (SID) using sys metadata. Ensures that
     * the most recent PID is returned, even if indexing is not complete.
     * @param {string} sid The series ID to get the PID for
     * @param {object} [options] System metadata lookup options
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @returns {Promise<string|null>} The PID associated with the series ID,
     * or null if not found
     */
    async getPidForSid(sid, options = {}) {
      try {
        const sysMeta = await this.getSysMeta(sid, options);
        return sysMeta?.identifier || null;
      } catch (error) {
        if (ErrorUtilities.isAbortError(error)) throw error;
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
     * Track a failed resource map resolution.
     * @param {string} pid PID whose resource map could not be resolved
     */
    trackMissingResourceMap(pid) {
      if (!pid) return;
      this.eventLog.analytics?.trackCustomEvent("resource_map_missing", {
        pid,
      });
    }

    /**
     * Searches the index for a resource map associated with the given PID.
     * Returns an object containing the PID and metadata about the search.
     * @param {string} pid The PID to search for in the index
     * @param {object} [options] Search options
     * @param {string[]} [options.fields] An array of index fields to query in
     * addition to the default fields.
     * @param {AbortSignal} [options.signal] Signal used to cancel the index
     * search.
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
        signal: options?.signal,
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
        const objectFormats = await Utilities.awaitObjectFormats();
        const formatProps = {
          formatId: doc[FIELDS.FORMAT_ID],
          formatType: doc[FIELDS.FORMAT_TYPE],
        };
        const formatType = objectFormats.getFormatType(formatProps);
        meta.formatType = formatType;
        meta.indexMatch = doc;
        if (objectFormats.isData(formatProps)) {
          meta.isData = true;
        } else if (objectFormats.isMetadata(formatProps)) {
          meta.isMetadata = true;
        } else if (objectFormats.isResourceMap(formatProps)) {
          meta.isResourceMap = true;
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

      // When the PID is a series ID, the caller must resolve the SID to a PID
      // first, so never return an RM directly for a SID.
      if (!result.rm && !meta.isSid && meta.rms.length === 1) {
        [result.rm] = meta.rms;
      }

      return result;
    }

    /**
     * Checks local storage / index DB for a resource map PID associated with
     * the given PID. Uses PersistentStorage to access the local storage.
     * @param {string} pid The PID of the document to check
     * @returns {Promise<string|null>} The stored RM PID, when present
     */
    async checkStorage(pid) {
      return (await this.storage.getItem(pid)) || null;
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
          await this.storage.clear();
          try {
            return await this.storage.setItem(pid, rm);
          } catch (retryErr) {
            this.warn(
              "Retry failed: Unable to add RM to local storage",
              retryErr,
            );
            return null;
          }
        }
        this.warn("Unexpected error adding RM to local storage", err);
        return null;
      }
    }

    /**
     * Walks the system metadata to find the resource map PID associated with
     * the given PID. It starts from the given PID and walks backward
     * through the version history to find an old resource map PID. Then,
     * starting at the found RM pid, walks forward to find the current RM.
     * @param {string} pid The PID of the document to walk sysmeta for
     * @param {object} [options] System metadata lookup options
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @returns {Promise<{rm: string|null, meta: object}>} An object containing the
     * resource map PID if found, and metadata about the walk
     */
    async walkSysmeta(pid, options = {}) {
      let currentPid = pid;
      const pastPids = [];
      let rm = null;
      const meta = { stepsBack: 0, pastPids };

      /* eslint-disable no-await-in-loop */
      // The loop depends on the previous PID to find the next one,
      // so the loop must be synchronous (must await for each)
      while (pastPids.length < this.maxSteps && currentPid) {
        let prevPid = null;
        try {
          prevPid = await this.versionTracker.getPrev(currentPid, options);
        } catch (error) {
          if (ErrorUtilities.isAbortError(error)) throw error;
          if (error?.status === 401) meta.unauthorized = true;
          if (error?.status) {
            if (!meta.errors) meta.errors = [];
            meta.errors.push(error.status);
          }
          break;
        }

        if (!prevPid) break;
        currentPid = prevPid;
        pastPids.push(currentPid);
        let indexResult = null;
        try {
          indexResult = await this.constructor.searchIndex(currentPid, options);
        } catch (error) {
          if (ErrorUtilities.isAbortError(error)) throw error;
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
      meta.stepsBack = pastPids.length;

      // If no prev. RM found, cannot walk forward to find current RM
      if (!rm) return { rm, meta };

      // Walk forward same # steps to find the current RM
      let currentRM = rm;
      if (pastPids.length) {
        try {
          currentRM = await this.versionTracker.getNth(
            rm,
            pastPids.length,
            options,
          );
        } catch (error) {
          // A real cancellation must still propagate.
          if (ErrorUtilities.isAbortError(error)) throw error;
          // A private version in the chain: stop and report unauthorized.
          if (error?.status === 401) meta.unauthorized = true;
          // Record any HTTP status for diagnostics, like the backward walk.
          if (error?.status) {
            if (!meta.errors) meta.errors = [];
            meta.errors.push(error.status);
          }
          this.warn(`Error walking forward from resource map ${rm}`, error);
          // Couldn't determine the current RM; fall through to the guess
          // strategy rather than hard-rejecting the whole resolution.
          return { rm: null, meta };
        }
      }
      return { rm: currentRM, meta };
    }

    /**
     * Guesses the resource map PID based on the PID. The guessed PID is
     * constructed by appending the PID to a predefined prefix.
     * @param {string} pid The PID of the document to guess the RM PID for
     * @param {object} [options] Verification options
     * @param {AbortSignal} [options.signal] Signal used to cancel resolver work
     * @returns {Promise<string|null>} The guessed resource map PID if it exists
     * and is linked to the PID, null otherwise
     */
    async guessPid(pid, options = {}) {
      const guessed = `${ResourceMap.RESOURCE_MAP_PID_PREFIX}${pid}`;
      const isValid = await this.verify(guessed, pid, options);
      return isValid ? guessed : null;
    }

    /**
     * Verifies that the given resource map PID exists and contains the pid
     * as a member.
     * @param {string} rm The PID of the resource map to verify
     * @param {string} pid The PID of the document to check
     * @param {object} [options] Fetch options
     * @param {number} [options.timeoutMs] The maximum time to wait for the
     * fetch.
     * @param {AbortSignal} [options.signal] Signal used to cancel the fetch
     * @returns {Promise<boolean>} True if the RM is valid and contains the PID,
     * false otherwise
     */
    async verify(rm, pid, options = {}) {
      const rmFetchResults = await this.fetchResourceMap(rm, options);
      const rmMembers = rmFetchResults?.model?.getMemberPids?.() || [];
      const isValid = !!pid && rmMembers.includes(pid);
      const meta = {};

      let status = isValid ? STATUS.foundAndValid : STATUS.foundButNotValid;
      if (rmFetchResults?.status !== 200) {
        status = STATUS.rmFetchError;
        meta.error = rmFetchResults?.status || "Unknown error";
      } else {
        meta.rmMembers = rmMembers;
        meta.matchedPid = isValid ? pid : null;
      }

      this.status(pid, status, isValid ? rm : null, meta);
      return isValid;
    }

    /**
     * Fetches and parses the resource map for the given PID.
     * @param {string} rm The PID of the resource map to fetch
     * @param {object} [options] Fetch options
     * @param {number} [options.timeoutMs] The maximum time to wait for the
     * fetch.
     * @param {AbortSignal} [options.signal] Signal used to cancel the fetch
     * @returns {Promise<{model: ResourceMap|null, status: number}>} Parsed
     * resource map and HTTP status.
     */
    async fetchResourceMap(rm, options = {}) {
      const timeout = options.timeoutMs ?? this.maxFetchTime;
      try {
        const appModel = globalThis.MetacatUI?.appModel;
        const resolveServiceUrl = ValueUtilities.normalizeText(
          appModel?.get?.("resolveServiceUrl"),
        );
        const objectServiceUrl = ValueUtilities.normalizeText(
          appModel?.get?.("objectServiceUrl"),
        );
        // ObjectService centralizes MetacatUI's MN-first read policy, falling
        // back to /resolve/ only for CN deployments without an object service.
        const objectService = new ObjectService();
        const xml = await objectService.download(rm, {
          responseType: "text",
          timeoutMs: timeout,
          signal: options.signal,
        });
        const model = ResourceMap.fromXml(rm, xml, {
          resolveServiceUrl,
          objectServiceUrl,
        });
        return { model, status: 200 };
      } catch (e) {
        if (ErrorUtilities.isAbortError(e)) throw e;
        if (Array.isArray(e?.issues) && e.issues.length) throw e;
        return { model: null, status: e?.status || 500 };
      }
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
      const log = this.eventLog.getOrCreateLog(pid);

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

      this.events.trigger("update", { pid, rm, status, meta });
      this.events.trigger(`update:${pid}`, { pid, rm, status, meta });

      // Store the obj:rm pair in local storage if rm is found
      if (rm) {
        this.addToStorage(pid, rm).catch((error) => {
          this.warn(`Failed to persist RM ${rm} for PID ${pid}`, error);
        });
      }

      const result = { success: !!rm, pid, log };
      if (rm) result.rm = rm;
      if (meta) result.meta = meta;

      if (log.events.some((event) => event.meta?.unauthorized))
        result.unauthorized = true;
      if (
        !rm &&
        log.events.some(
          (event) =>
            Array.isArray(event.meta?.rms) && event.meta.rms.length > 1,
        )
      )
        result.multipleRMs = true;

      return result;
    }
  }

  return ResourceMapResolver;
});
