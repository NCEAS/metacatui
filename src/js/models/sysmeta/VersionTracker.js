define([
  "backbone",
  "models/dataONEServices/SysMetaService",
  "common/UrlUtilities",
  "common/DateUtilities",
], (Backbone, SysMetaService, UrlUtilities, DateUtilities) => {
  /**
   * @constant {number} DEFAULT_TTL_MS Default Time-To-Live for cached data
   * object to resource map PID mappings, in milliseconds.
   */
  const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour

  /**
   * @constant {number} DEFAULT_MAX_CHAIN_HOPS Default maximum number of hops in
   * the version chain to cache. Defaults to 200 hops.
   */
  const DEFAULT_MAX_CHAIN_HOPS = 200;

  /**
   * Get the field name for the next or previous version link.
   * @param {boolean} forward True for next version, false for previous version
   * @returns {string} the field name
   */
  function NEXT_OR_PREV(forward = true) {
    return forward ? "obsoletedBy" : "obsoletes";
  }

  /**
   * @typedef {object} VersionRecord
   * @property {string} pid The starting PID
   * @property {number} requestedSteps The number of versions requested from the
   * starting PID (positive for newer, negative for older)
   * @property {number} completedSteps The number of versions successfully found
   * @property {string[]} versions Array of version PIDs found, in order from
   * the starting PID to the oldest/newest found
   * @property {boolean} chainComplete Whether the end of the version chain was
   * reached (NOT whether the number of requested steps was completed). In other
   * words, whether the last version found has no further versions in the given
   * direction.
   * @property {boolean} endIsPrivate Whether the fetching stopped because a
   * private version was encountered
   * @property {boolean} endNotFound Whether the fetching stopped because a
   * version was not found (404)
   * @property {DateConflict[]} dateConflicts Array of detected
   * sequence date conflicts in the versions found
   */

  /**
   * @typedef {object} DateConflict
   * @property {SystemMetadata} prevSysMeta The System Metadata record of the
   * version that appears earlier in the obsolsence chain, i.e. the obsoleted
   * version
   * @property {Date} prevDate The dateUploaded of the previous version
   * @property {string} prevPid The PID of the previous version
   * @property {SystemMetadata} nextSysMeta The System Metadata record of the
   * version that appears later in the obsolescence chain, i.e. the obsoleting
   * version
   * @property {Date} nextDate The dateUploaded of the next version
   * @property {string} nextPid The PID of the next version
   * @property {number} timeDiffMs The time difference between the two
   * versions in milliseconds
   */

  /**
   * @class VersionTracker
   * @classcategory Models/SysMeta
   * @since 2.34.0
   * @classdesc VersionTracker walks sysmeta version chains and caches them in
   * memory and in localForage for fast access. It allows getting PIDs at
   * arbitrary stepss from a given PID, fetching full version chains, and
   * listening for updates. A store is created for each unique SysMeta service
   * URL, so multiple VersionTracker instances can coexist without conflicts.
   * @example
   * const vt = new VersionTracker({
   *  metaServiceUrl: "https://example.com/sysmeta",
   * })
   * vt.getNth("pid123", 1).then((pid) => {
   *  console.log("Next version PID:", pid);
   * });
   * const allVersions = await vt.getAllVersions("pid123");
   * console.log("All versions in chain:", allVersions.prev.versions,
   *  allVersions.next.versions);
   */
  class VersionTracker {
    /**
     * Create a new VersionTracker instance.
     * @param {object} options - configuration options
     * @param {string} [options.metaServiceUrl] - URL of the SysMeta service
     * @param {number} [options.maxChainHops] - Maximum number of hops in the
     * version chain to cache. Defaults to 200 hops.
     * @param {number|null} [options.ttlMs] - Time-To-Live for cached records in
     * milliseconds. Defaults to 1 hour. Set to null to disable expiration.
     */
    constructor({
      metaServiceUrl,
      maxChainHops = DEFAULT_MAX_CHAIN_HOPS,
      ttlMs = DEFAULT_TTL_MS,
    } = {}) {
      const url =
        metaServiceUrl || globalThis.MetacatUI?.appModel?.get("metaServiceUrl");
      const normalizedUrl = UrlUtilities.normalizeUrl(url);
      if (!normalizedUrl) {
        throw new Error("VersionTracker: metaServiceUrl is required");
      }
      this.metaServiceUrl = normalizedUrl;

      // TTL for cached records in milliseconds
      if ((!Number.isFinite(ttlMs) || ttlMs <= 0) && ttlMs !== null) {
        throw new Error(
          `VersionTracker: ttlMs must be a positive number or null, got ${ttlMs}`,
        );
      }
      this.ttlMs = ttlMs;

      // Avoid excessively long chains
      if (typeof maxChainHops !== "number" || maxChainHops <= 0) {
        throw new Error("Invalid maxChainHops provided to VersionTracker");
      }

      this.MAX_CHAIN_HOPS = maxChainHops;

      // Get a SysMetaService instance for this metaServiceUrl (singleton per
      // URL and config)
      this.sysMetaService = new SysMetaService({
        baseUrl: this.metaServiceUrl,
        storageConfig: {
          ttlMs: this.ttlMs,
        },
        persistPrivate: true,
      });

      // To make compatible with Backbone views, event handling
      this.events = { ...Backbone.Events };
    }

    /**
     * Get the System Metadata for a given PID. SysMetaService handles caching,
     * token management, and duplicate fetch prevention.
     * @param {string} pid the PID to get System Metadata for
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<SystemMetadata>} resolves to the System Metadata object
     * for the PID
     */
    async getSysMeta(pid, options = {}) {
      return this.sysMetaService.download(pid, options);
    }

    /**
     * Check if the System Metadata for a given PID is cached.
     * @param {string} pid the PID to check
     * @returns {Promise<boolean>} resolves to true if the System Metadata is
     * cached
     */
    async sysMetaIsCached(pid) {
      return this.sysMetaService.isCached(pid);
    }

    /**
     * Get the next most recent version after the given PID.
     * @param {string} pid The PID that is obsoleted by the next version
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<string>} resolves to the next version PID, or null if
     * there is no next version.
     * @since 2.34.1
     */
    async getNext(pid, options) {
      return this.getAdjacent(pid, true, options);
    }

    /**
     * Get the previous version before the given PID.
     * @param {string} pid The PID that obsoletes the previous version
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<string>} resolves to the previous version PID, or null
     * if there is no previous version.
     * @since 2.34.1
     */
    async getPrev(pid, options) {
      return this.getAdjacent(pid, false, options);
    }

    /**
     * Get the PID that is one version older or newer than the given PID.
     * @param {string} pid The starting PID
     * @param {boolean} forward True to get the next (newer) version, false for
     * the previous (older) version.
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<string|null>} resolves to the adjacent version PID, or
     * null if no such version exists.
     */
    async getAdjacent(pid, forward = true, options = {}) {
      if (typeof pid !== "string" || !pid) {
        throw new Error("Invalid PID provided");
      }
      const getAdjacentPid = async () => {
        const sysMeta = await this.getSysMeta(pid, options);
        return sysMeta?.[NEXT_OR_PREV(forward)] || null;
      };
      const adjacentPid = await getAdjacentPid();
      // Force re-check in case end of chain has changed
      const cacheKey = options?.cacheKey ?? pid;
      if (
        !adjacentPid &&
        options?.useCache !== false &&
        (await this.sysMetaIsCached(cacheKey))
      ) {
        await this.sysMetaService.removeCached(cacheKey);
        return getAdjacentPid();
      }
      return adjacentPid;
    }

    /**
     * Get version information for a given PID and number of steps.
     * @param {string} startPid The starting PID
     * @param {number} steps Number of versions away from the starting PID.
     * Positive values indicate newer versions, negative values indicate older
     * versions. For example, a step of 1 gets the next version, -1 gets the
     * previous version.
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<VersionRecord>} resolves to a record that includes
     * versions found, number of completed steps, and flags for chain
     * completion, privacy, and not-found status.
     */
    async getVersions(startPid, steps, options = {}) {
      if (typeof startPid !== "string" || !startPid) {
        throw new Error("Invalid PID provided");
      }

      const record = {
        pid: startPid,
        requestedSteps: steps,
        completedSteps: 0,
        versions: [],
        chainComplete: false,
        endIsPrivate: false,
        endNotFound: false,
        dateConflicts: [],
      };

      if (typeof steps !== "number" || !Number.isInteger(steps)) {
        throw new Error("Steps must be an integer");
      }

      const cappedSteps = this.capSteps(steps);
      const absSteps = Math.abs(cappedSteps);
      const forward = steps > 0;
      let currentPid = startPid;
      let traversalError = null;
      const notifyQueue = [];

      // Queue notifications so version-chain traversal can continue without
      // blocking, but still surface async notify failures to callers.
      const queueNotify = (pid, foundPid, step, status) => {
        notifyQueue.push(this.notify(pid, foundPid, step, status, options));
      };

      try {
        // Send notice for sysMeta found for starting PID for consistency for UIs
        queueNotify(startPid, startPid, 0, null);

        let currentStepSysMeta = null;
        /* eslint-disable no-await-in-loop */
        for (let step = 0; step < absSteps; step += 1) {
          let adjPid;
          let status = null;
          const currentStep = forward ? step + 1 : -(step + 1);
          try {
            adjPid = await this.getAdjacent(currentPid, forward, options);
          } catch (error) {
            status = error.status;
            adjPid = null;
            // Stop if we hit an error fetching the adjacent version
            if (error.status === 401) {
              record.endIsPrivate = true;
            } else if (error.status === 404) {
              record.endNotFound = true;
            } else {
              throw error;
            }
          }

          if (Math.abs(currentStep) >= this.MAX_CHAIN_HOPS) {
            record.maxHopsReached = true;
          }

          queueNotify(startPid, adjPid, currentStep, status);

          // Stop if there is no adjacent version
          if (!adjPid) break;

          try {
            if (!currentStepSysMeta) {
              currentStepSysMeta = await this.getSysMeta(currentPid, options);
            }
            const adjSysMeta = await this.getSysMeta(adjPid, options);
            const conflict = VersionTracker.detectDateConflict(
              currentStepSysMeta,
              adjSysMeta,
              forward,
            );
            if (conflict) {
              record.dateConflicts.push(conflict);
            }
            currentStepSysMeta = adjSysMeta;
          } catch (error) {
            if (error?.name === "AbortError") {
              throw error;
            }
            if (error?.status !== 401 && error?.status !== 404) {
              throw error;
            }
            // Conflict detection is best-effort; keep traversal and notifications
            // intact when a version's sysmeta is private or missing.
            currentStepSysMeta = null;
          }

          // Update record and continue to next version
          record.completedSteps = currentStep;
          record.versions.push(adjPid);
          currentPid = adjPid;
        }
        /* eslint-enable no-await-in-loop */

        const { versions } = record;

        if (!record.endIsPrivate && !record.endNotFound) {
          const lastPid = versions.length
            ? versions[versions.length - 1]
            : startPid;
          record.chainComplete = await this.isEndOfChain(
            lastPid,
            forward,
            options,
          );
        }
      } catch (error) {
        traversalError = error;
      }

      // Always drain queued notify promises to avoid unhandled rejections. If
      // notifications failed, throw the first rejection explicitly.
      const notifyResults = await Promise.allSettled(notifyQueue);
      const firstNotifyFailure = notifyResults.find(
        (result) => result.status === "rejected",
      );

      if (traversalError) {
        throw traversalError;
      }
      if (firstNotifyFailure) {
        throw firstNotifyFailure.reason;
      }
      return record;
    }

    /**
     * Detect if there is a date conflict between two adjacent versions in the
     * version chain. A conflict occurs when the dateUploaded of an obsoleting
     * version is earlier than that of the obsoleted version, which breaks the
     * expected chronological order.
     * @param {SystemMetadata} sysMeta The System Metadata of the version to
     * check for conflicts.
     * @param {SystemMetadata} adjSysMeta The System Metadata of the adjacent
     * version to compare against.
     * @param {boolean} forward True if adjSysMeta is the obsoleting (newer)
     * version, false if adjSysMeta is the obsoleted (older) version.
     * @returns {DateConflict|false} A DateConflict object if a conflict is
     * detected, or false if no conflict is found or if either System Metadata
     * record is missing necessary date information.
     */
    static detectDateConflict(sysMeta, adjSysMeta, forward) {
      if (!sysMeta || !adjSysMeta) return false;

      const prevSysMeta = forward ? sysMeta : adjSysMeta;
      const nextSysMeta = forward ? adjSysMeta : sysMeta;
      const prevDate = DateUtilities.toDate(prevSysMeta?.dateUploaded);
      const nextDate = DateUtilities.toDate(nextSysMeta?.dateUploaded);

      if (!prevDate || !nextDate) {
        return false;
      }

      if (prevDate > nextDate) {
        // relative the adjacent version since it's the one that breaks the chain
        return {
          prevSysMeta,
          prevDate,
          prevPid: prevSysMeta?.identifier,
          nextSysMeta,
          nextDate,
          nextPid: nextSysMeta?.identifier,
          timeDiffMs: Math.abs(prevDate - nextDate),
        };
      }
      return false;
    }

    /**
     * Get all versions in one direction (newer or older) from a starting PID.
     * @param {string} startPid The starting PID
     * @param {boolean} forward True to get newer versions, false for older
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<object>} resolves to a record with the following
     */
    async getAllVersionsOneDirection(startPid, forward = true, options = {}) {
      const max = this.MAX_CHAIN_HOPS;
      const steps = forward ? max : -max;
      return this.getVersions(startPid, steps, options);
    }

    /**
     * Get the PID that is n number of versions newer or older than the a PID.
     * @param {string}  pid The starting PID
     * @param {number}  steps Number of versions away from the starting PID.
     * Positive values indicate newer versions, negative values indicate older
     * versions. For example, a step of 1 gets the next version, -1 gets the
     * previous version. A step of 0 returns the original PID.
     * @returns {Promise<string|null>} resolves to the PID at the given number
     * of steps, or null if no such version exists.
     */
    async getNth(pid, steps) {
      if (typeof pid !== "string" || !pid) {
        throw new Error("Invalid PID provided");
      }
      if (steps === 0) return pid;
      const record = await this.getVersions(pid, steps);
      const { versions, completedSteps } = record;
      if (Math.abs(completedSteps) < Math.abs(steps)) {
        return null;
      }
      return versions[versions.length - 1];
    }

    /**
     * Get the complete version chain for the given PID.
     * @param {string}  pid - PID to get the chain for
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<{prev: VersionRecord, next: VersionRecord}>} resolves
     * to an object with 'prev' and 'next' VersionRecords
     */
    async getAllVersions(pid, options = {}) {
      const results = await Promise.all([
        this.getAllVersionsOneDirection(pid, false, options),
        this.getAllVersionsOneDirection(pid, true, options),
      ]);
      return { prev: results[0], next: results[1] };
    }

    /**
     * Check if the given PID is at the end of its version chain in the given
     * direction.
     * @param {string} pid PID to check
     * @param {boolean} forward True to check for next version, false for
     * previous
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<boolean>} resolves to true if the PID is at the end of
     * the chain in the given direction
     * @throws {Error} if the PID is invalid or SysMeta cannot be retrieved
     */
    async isEndOfChain(pid, forward = true, options = {}) {
      const sysMeta = await this.getSysMeta(pid, options);
      return !sysMeta?.[NEXT_OR_PREV(forward)];
    }

    /**
     * Get the latest version in the version chain for the given PID. If the
     * newest versions are private or not found, this will return the last
     * available version.
     * @param {string} pid PID to get the latest version for
     * @param {object} [options] options to pass to SysMetaService.download
     * @returns {Promise<string>} resolves to the latest version PID, or the
     * original PID if no newer versions exist or are accessible.
     */
    async getLatestVersion(pid, options = {}) {
      const record = await this.getAllVersionsOneDirection(pid, true, options);
      const { versions, completedSteps } = record;
      if (completedSteps === 0) return pid;
      return versions[versions.length - 1];
    }

    /**
     * Clear the entire cache, including in-memory and persistent store.
     * @returns {Promise<boolean>} resolves to true if the cache was cleared
     */
    async clearCache() {
      return this.sysMetaService.clearCache();
    }

    /**
     * Notify listeners that a version was found (or not) for the given PID.
     * @param {string} pid The PID whose chain is being updated.
     * @param {string|null} foundPid The PID that was found, or null.
     * @param {number} steps Offset from the original PID (positive/negative).
     * @param {404|401|null} [error] Status code explaining why foundPid is null.
     * @param {object} [options] Options passed to SysMetaService.download.
     * @private
     * @fires Backbone.Events#versionFound
     */
    async notify(pid, foundPid, steps, error, options = {}) {
      if (!pid) return;
      const errors = error ? [error] : [];
      let sysMeta = null;

      // If we have the SysMeta cached for the foundPid, get it
      if (foundPid && !errors.includes(404) && !errors.includes(401)) {
        try {
          sysMeta = await this.getSysMeta(foundPid, options);
        } catch (e) {
          if (e.status === 404 || e.status === 401) {
            errors.push(e.status);
            sysMeta = new SysMetaService.SystemMetadata({
              identifier: foundPid,
            });
          } else if (e.name === "AbortError") {
            // Stop processing if the request was aborted by the caller
            return;
          } else {
            throw e;
          }
        }
      }
      if (!sysMeta) {
        sysMeta = new SysMetaService.SystemMetadata();
      }
      sysMeta.versionHistory = {};
      sysMeta.versionHistory[pid] = steps;
      if (!sysMeta.errors) sysMeta.errors = [];
      sysMeta.errors.push(...errors);
      try {
        this.events.trigger("versionFound", sysMeta);
        this.events.trigger(`versionFound:${pid}`, sysMeta);
      } catch (e) {
        // Failure to notify is not critical, so just log the error. This allows
        // callers to fire and forget without worrying about listener errors.

        // eslint-disable-next-line no-console
        console.error(
          `VersionTracker.notify: Error triggering update event for PID ${pid}:`,
          e,
        );
      }
    }

    /**
     * Cap the number of steps to the maximum allowed chain hops.
     * @param {number} steps The requested number of steps.
     * @returns {number} The capped number of steps.
     * @private
     * @fires console.warn if the steps exceed the maximum chain hops.
     */
    capSteps(steps) {
      const max = this.MAX_CHAIN_HOPS;
      if (max === Infinity) return steps;
      if (Math.abs(steps) > max) {
        // eslint-disable-next-line no-console
        console.warn(
          `Requested steps ${steps} exceeds max chain hops of ${max}.
           Capping to ${max}.`,
        );
        return steps < 0 ? -max : max;
      }
      return steps;
    }
  }

  VersionTracker.SysMetaService = SysMetaService;
  VersionTracker.SystemMetadata = SysMetaService.SystemMetadata;

  return VersionTracker;
});
