define(["backbone", "models/dataONEServices/SysMetaService"], (
  Backbone,
  SysMetaService,
) => {
  /**
   * @constant {number} DEFAULT_TTL_MS Default Time-To-Live for cached records
   * in milliseconds.
   */
  const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour

  /**
   * @constant {number} DEFAULT_MAX_CHAIN_HOPS Default maximum number of hops in
   * the version chain to cache. Defaults to 200 hops.
   */
  const DEFAULT_MAX_CHAIN_HOPS = 200;

  /**
   * @constant {object} FIELD_NAMES Field names for version links in SysMeta
   * @property {string} next The field name for the next version link
   * @property {string} prev The field name for the previous version link
   */
  const FIELD_NAMES = {
    next: "obsoletedBy",
    prev: "obsoletes",
  };

  /**
   * Get the field name for the next or previous version link.
   * @param {boolean} forward True for next version, false for previous version
   * @returns {string} the field name
   */
  function NEXT_OR_PREV(forward = true) {
    return forward ? FIELD_NAMES.next : FIELD_NAMES.prev;
  }

  /**
   * Normalize the SysMeta service URL by ensuring it's a string and removing
   * trailing slashes.
   * @param {string} url The SysMeta service URL
   * @returns {Promise<string>} resolves to the normalized URL
   */
  function NORMALIZE_METASERVICE_URL(url) {
    let urlResolved = url;
    if (typeof urlResolved !== "string" || !urlResolved) {
      urlResolved = MetacatUI.appModel.get("sysmetaServiceUrl");
    }
    // Remove trailing slashes
    return urlResolved.replace(/\/+$/, "");
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
   * @example
   * // Get a singleton instance for a specific SysMeta service URL
   * // This will create a new instance if it doesn't exist yet.
   * const vt = VersionTracker.get("https://example.com/sysmeta");
   */
  class VersionTracker {
    /**
     * Create a new VersionTracker instance.
     * @param {object} options - configuration options
     * @param {string} options.metaServiceUrl - URL of the SysMeta service
     * @param {number} [options.maxChainHops] - Maximum number of hops in the
     * version chain to cache. Defaults to 200 hops.
     * @param {number} [options.ttlMs] - Time-To-Live for cached records in
     * milliseconds. Defaults to 24 hours (1 day).
     */
    constructor({
      metaServiceUrl,
      maxChainHops = DEFAULT_MAX_CHAIN_HOPS,
      ttlMs = DEFAULT_TTL_MS,
    } = {}) {
      this.metaServiceUrl = NORMALIZE_METASERVICE_URL(metaServiceUrl);

      // TTL for cached records in milliseconds
      if (typeof ttlMs !== "number" || ttlMs <= 0) {
        throw new Error("Invalid TTL provided to VersionTracker");
      }
      this.TTL_MS = ttlMs;

      // Avoid excessively long chains
      if (typeof maxChainHops !== "number" || maxChainHops <= 0) {
        throw new Error("Invalid maxChainHops provided to VersionTracker");
      }
      this.MAX_CHAIN_HOPS = maxChainHops;

      // Create SysMetaService instance for fetching SysMeta
      this.sysMetaService = SysMetaService.get({
        baseUrl: this.metaServiceUrl,
        storageConfig: {
          ttlMs: this.TTL_MS,
        },
        persistPrivate: true,
      });

      // To make compatible with Backbone-based MetacatUI, allow eventing
      this.events = { ...Backbone.Events };
    }

    /**
     * Get the SysMeta for a given PID. SysMetaService handles caching, token
     * management, and duplicate fetch prevention.
     * @param {string} pid the PID to get SysMeta for
     * @returns {Promise<SysMeta>} resolves to the SysMeta object for the PID
     */
    async getSysMeta(pid) {
      // TODO: handle 401 (private) and 404 (non existent) errors...
      return this.sysMetaService.download(pid);
    }

    /**
     * Check if the SysMeta for a given PID is cached.
     * @param {string} pid the PID to check
     * @returns {Promise<boolean>} resolves to true if the SysMeta is cached
     */
    async sysMetaIsCached(pid) {
      return this.sysMetaService.isCached(pid);
    }

    /**
     * Get the next most recent version after the given PID.
     * @param {string} pid The PID that is obsoleted by the next version
     * @returns {Promise<string>} resolves to the next version PID, or null if
     * there is no next version.
     * @since 2.34.1
     */
    async getNext(pid) {
      return this.getAdjacent(pid, true);
    }

    /**
     * Get the previous version before the given PID.
     * @param {string} pid The PID that obsoletes the previous version
     * @returns {Promise<string>} resolves to the previous version PID, or null
     * if there is no previous version.
     * @since 2.34.1
     */
    async getPrev(pid) {
      return this.getAdjacent(pid, false);
    }

    /**
     * Get the PID that is one version older or newer than the given PID.
     * @param {string} pid The starting PID
     * @param {boolean} forward True to get the next (newer) version, false for
     * the previous (older) version.
     * @returns {Promise<string|null>} resolves to the adjacent version PID, or
     * null if no such version exists.
     */
    async getAdjacent(pid, forward = true) {
      if (typeof pid !== "string" || !pid) {
        throw new Error("Invalid PID provided");
      }
      const getAdjacentPid = async () => {
        const sysMeta = await this.getSysMeta(pid);
        return sysMeta?.data?.[NEXT_OR_PREV(forward)] || null;
      };
      const adjacentPid = await getAdjacentPid();
      // Force re-check in case end of chain has changed
      if (!adjacentPid && (await this.sysMetaIsCached(pid))) {
        this.sysMetaService.removeCached(pid);
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
     * @returns {Promise<VersionRecord>} resolves to a record that includes
     * versions found, number of completed steps, and flags for chain
     * completion, privacy, and not-found status.
     */
    async getVersions(startPid, steps) {
      const record = {
        pid: startPid,
        requestedSteps: steps,
        completedSteps: 0,
        versions: [],
        chainComplete: false,
        endIsPrivate: false,
        endNotFound: false,
      };

      const cappedSteps = this.capSteps(steps);
      const absSteps = Math.abs(cappedSteps);
      const forward = steps > 0;

      let currentPid = startPid;

      /* eslint-disable no-await-in-loop */
      for (let step = 0; step < absSteps; step += 1) {
        let adjPid;
        try {
          adjPid = await this.getAdjacent(currentPid, forward);
        } catch (error) {
          // Stop if we hit an error fetching the adjacent version
          if (error.status === 401) {
            record.endIsPrivate = true;
          } else if (error.status === 404) {
            record.endNotFound = true;
          } else {
            throw error;
          }
          break;
        }

        const currentStep = forward ? step + 1 : -(step + 1);
        // TODO: consider fire and forget notify to speed up loop?
        await this.notify(startPid, adjPid, currentStep);

        // Stop if there is no adjacent version
        if (!adjPid) break;
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
        record.chainComplete = await this.isEndOfChain(lastPid, forward);
      }

      return record;
    }

    /**
     * Get all versions in one direction (newer or older) from a starting PID.
     * @param {string} startPid The starting PID
     * @param {boolean} forward True to get newer versions, false for older
     * @returns {Promise<object>} resolves to a record with the following
     */
    async getAllVersionsOneDirection(startPid, forward = true) {
      const max = this.MAX_CHAIN_HOPS;
      const steps = forward ? max : -max;
      return this.getVersions(startPid, steps);
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
     * @returns {Promise<{prev: VersionRecord, next: VersionRecord}>} resolves
     * to an object with 'prev' and 'next' VersionRecords
     */
    async getAllVersions(pid) {
      const results = await Promise.all([
        this.getAllVersionsOneDirection(pid, false),
        this.getAllVersionsOneDirection(pid, true),
      ]);
      return { prev: results[0], next: results[1] };
    }

    /**
     * Check if the given PID is at the end of its version chain in the given
     * direction.
     * @param {string} pid PID to check
     * @param {boolean} forward True to check for next version, false for
     * previous
     * @returns {Promise<boolean>} resolves to true if the PID is at the end of
     * the chain in the given direction
     * @throws {Error} if the PID is invalid or SysMeta cannot be retrieved
     */
    async isEndOfChain(pid, forward = true) {
      const sysMeta = await this.getSysMeta(pid);
      return !sysMeta?.data?.[NEXT_OR_PREV(forward)];
    }

    /**
     * Get the latest version in the version chain for the given PID. If the
     * newest versions are private or not found, this will return the last
     * available version.
     * @param {string} pid PID to get the latest version for
     * @returns {Promise<string>} resolves to the latest version PID, or the
     * original PID if no newer versions exist or are accessible.
     */
    async getLatestVersion(pid) {
      const record = await this.getAllVersionsOneDirection(pid, true);
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
     * Notify subscribers/listeners that a new version has been found within the
     * version history of a given PID. Sends update with the following info:
     *   - pid: the original PID whose version chain was updated
     *   - steps: the offset of the new version from the original PID, positive
     *     for newer, negative for older
     *   - foundPid: the new version PID that was added, or null if no new
     *     version was found
     *   - foundSysMeta:  SysMeta object for the foundPid, or null if not found
     *   - status: a status code indicating why foundPid was null (e.g. 404 or
     *     401)
     * @param {string} pid the PID whose version chain was updated
     * @param {string|null} foundPid the new version PID that was added, or null
     * if no new version was found
     *  @param {number} steps the offset of the new version from the original
     * PID, positive for newer, negative for older
     * @param {404|401} [status] a status code indicating why foundPid was null
     * @private
     * @fires Backbone.Events#update
     */
    async notify(pid, foundPid, steps, status) {
      let foundSysMeta = null;
      let finalStatus = status;
      try {
        foundSysMeta = foundPid ? await this.getSysMeta(foundPid) : null;
      } catch (e) {
        // If there was a found pid, then sysmeta should be cached. However, in
        // case something went wrong, we only throw if the error is not a 404 or
        // 401, since those are expected for private or non-existent versions.
        if (e.status !== 404 && e.status !== 401) {
          throw e;
        } else {
          finalStatus = e.status;
        }
      }

      const record = {
        pid,
        steps,
        foundPid,
        foundSysMeta,
        status: finalStatus,
      };
      // Trigger Backbone-style events
      this.events.trigger("update", record);
      this.events.trigger(`update:${pid}`, record);
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

  // Static singleton instance management: Create one VersionTracker per
  // unique SysMeta service URL.
  VersionTracker.instances = new Map();
  VersionTracker.get = function get(metaServiceUrl) {
    const msUrl = NORMALIZE_METASERVICE_URL(metaServiceUrl);
    if (!VersionTracker.instances.has(msUrl)) {
      VersionTracker.instances.set(
        msUrl,
        new VersionTracker({ metaServiceUrl: msUrl }),
      );
    }
    return VersionTracker.instances.get(msUrl);
  };

  return VersionTracker;
});
