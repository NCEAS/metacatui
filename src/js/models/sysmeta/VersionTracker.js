define(["backbone", "models/sysmeta/SysMeta", "localforage", "md5"], (
  Backbone,
  SysMeta,
  localforage,
  md5,
) => {
  const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
  const { DEFAULT_META_SERVICE_URL } = SysMeta;
  const DEFAULT_MAX_CHAIN_HOPS = 200;
  const DEFAULT_MAX_CACHE_RECORDS = 5000;

  // Fields to persist from SysMeta in the cache
  const PERSISTED_SYS_META_FIELDS = [
    "formatId",
    "size",
    "checksum",
    "checksumAlgorithm",
    "rightsHolder",
    "dateUploaded",
    "dateSysMetadataModified",
    "fileName",
  ];

  const IS_LOCAL_FORAGE = (store) =>
    store &&
    typeof store.setItem === "function" &&
    typeof store.getItem === "function";

  const NORMALIZE_METASERVICE_URL = (url) => {
    let normalUrl = typeof url !== "string" ? DEFAULT_META_SERVICE_URL : url;
    normalUrl = normalUrl.trim();
    return normalUrl.endsWith("/") ? normalUrl : `${normalUrl}/`;
  };

  /**
   * @typedef {object} VersionResult
   * @property {string} pid - The PID of the version at the requested offset.
   * @property {SysMeta|null} sysMeta - SysMeta object for the PID, or null if
   * not fetched yet. If `withMeta` is true, this will always be populated.
   */

  /**
   * @typedef {object} VersionRecord
   * @property {string[]|VersionResult[]} next - List of PIDs that are newer.
   * May be either strings (PIDs) or objects with { pid, sysMeta } if `withMeta`
   * is true.
   * @property {string[]|VersionResult[]} prev - List of PIDs that are older.
   * May be either strings (PIDs) or objects with { pid, sysMeta } if `withMeta`
   * is true.
   * @property {boolean} endNext - true if there are no newer versions detected
   * from the SysMeta service. This is not a guarantee that no newer versions
   * exist, just that the chain is complete up to the last known version.
   * @property {boolean} endPrev - true if there are no older versions detected
   * from the SysMeta service. This is not a guarantee that no older versions
   * exist, just that the chain is complete up to the first known version.
   * @property {SysMeta|null} sysMeta - SysMeta object for the PID, or null if
   * not fetched yet. If `withMeta` is true, this will always be populated.
   */

  /**
   * @class VersionTracker
   * @classcategory Models/SysMeta
   * @since 0.0.0
   * @classdesc VersionTracker walks sysmeta version chains and caches them in
   * memory and in localForage for fast access. It allows getting PIDs at
   * arbitrary offsets from a given PID, fetching full version chains, and
   * listening for updates. It also supports manually adding a new version to
   * the chain (e.g. when a document has been updated in the editor and the new
   * version is known). A store is created for each unique SysMeta service URL,
   * so multiple VersionTracker instances can coexist without conflicts.
   * @example
   * const vt = new VersionTracker({
   *  metaServiceUrl: "https://example.com/sysmeta",
   * })
   * vt.getNth("pid123", 1).then((result) => {
   *  console.log("Next version PID:", result.pid);
   * });
   * const fullChain = await vt.getFullChain("pid123");
   * console.log("All versions in chain:", fullChain.prev, fullChain.next);
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
     * @param {localforage} [options.store] - optional localForage instance for
     * persistent caching. If not provided, a new instance will be created
     * @param {number} [options.ttlMs] - Time-To-Live for cached records in
     * milliseconds. Defaults to 24 hours (1 day).
     * @param {number} [options.maxChainHops] - Maximum number of hops in the
     * version chain to cache. Defaults to 200 hops.
     * @param {number} [options.maxCacheRecords] - Maximum number of in-memory cache records. Defaults to 5000.
     */
    constructor({
      metaServiceUrl,
      store = null,
      ttlMs = DEFAULT_TTL_MS,
      maxChainHops = DEFAULT_MAX_CHAIN_HOPS,
      maxCacheRecords = DEFAULT_MAX_CACHE_RECORDS,
    } = {}) {
      // metaServiceUrl may be undefined or invalid
      this.metaServiceUrl = NORMALIZE_METASERVICE_URL(metaServiceUrl);

      // TTL for cached records in milliseconds
      if (typeof ttlMs !== "number" || ttlMs <= 0) {
        throw new Error("Invalid TTL provided to VersionTracker");
      }
      this.TTL_MS = ttlMs;

      // avoid unbounded chain growth
      if (typeof maxChainHops !== "number" || maxChainHops <= 0) {
        throw new Error("Invalid maxChainHops provided to VersionTracker");
      }
      this.MAX_CHAIN_HOPS = maxChainHops;
      // limit in‑memory cache size (simple LRU)
      if (typeof maxCacheRecords !== "number" || maxCacheRecords <= 0) {
        throw new Error("Invalid maxCacheRecords provided to VersionTracker");
      }
      this.MAX_CACHE_RECORDS = maxCacheRecords;

      // dedup in‑flight SysMeta fetches
      this.inFlight = new Map();

      // locks for concurrent fillVersionChain calls (e.g. when multiple getNth
      // calls are made for the same PID)
      this.locks = new Map();

      // in-memory cache
      this.cache = new Map();

      // store - persistent cache (IndexedDB | localStorage)
      if (store && !IS_LOCAL_FORAGE(store)) {
        throw new Error(
          "Invalid store provided to VersionTracker. Must be a localforage instance.",
        );
      }
      // use a name based on the SysMeta service URL to avoid conflicts
      // with other instances that might use different URLs
      const storeName = `vt_${md5(this.metaServiceUrl)}`;
      this.store =
        store || localforage.createInstance({ name: storeName, storeName });
    }

    /**
     * Get the PID that is `offset` earlier or later in the version chain
     * relative to the given `pid`.
     * @param {string}  pid - the PID to start from
     * @param {number}  offset - the number of steps to move in the chain. 0 =
     * same PID, +n newer, -n older
     * @param {boolean} [ignoreEnd] Set to true to allow walking beyond cached
     * chain end (e.g. to re-check whether there's a newer version)
     * @param {boolean} [withMeta] - If true, return arrays of { pid,
     * sysMeta } instead of bare PIDs.
     * @returns {Promise<VersionResult|string|null>} - resolves to the requested
     * PID at the given offset, or null if no such version exists. If `withMeta`
     * is true, resolves to an object with { pid, sysMeta }.
     */
    async getNth(pid, offset, ignoreEnd = false, withMeta = false) {
      // Validate inputs
      if (typeof pid !== "string" || !pid) {
        throw new Error("Invalid PID provided to getNth");
      }
      if (typeof offset !== "number") {
        throw new Error("Invalid offset provided to getNth");
      }
      if (Math.abs(offset) > this.MAX_CHAIN_HOPS) {
        throw new Error(
          `Offset ${offset} exceeds maximum chain hops limit of ${this.MAX_CHAIN_HOPS}`,
        );
      }

      // If offset is 0, just return the PID itself but make sure it's cached
      if (offset === 0) {
        const rec = await this.record(pid);
        if (withMeta) {
          if (!rec.sysMeta) await this.getSysMeta(pid);
          return { pid, sysMeta: rec.sysMeta };
        }
        return pid;
      }

      // Ensure the chain is long enough in the requested direction & cache it
      const steps = Math.abs(offset);
      const forward = offset > 0;
      await this.fillVersionChain(pid, steps, forward, ignoreEnd);

      // Get the record from the cached chain and return the requested PID and sysMeta
      const rec = await this.record(pid);

      const list = forward ? rec.next : rec.prev;
      const targetPid = list[steps - 1] ?? null;
      if (!targetPid) return null;

      const targetRec = await this.record(targetPid);
      if (withMeta) {
        if (!targetRec.sysMeta) await this.getSysMeta(targetPid);
        return { pid: targetPid, sysMeta: targetRec.sysMeta };
      }
      return targetPid;
    }

    /**
     * Get the complete version chain for the given PID.
     * @param {string}  pid - PID to get the chain for
     * @param {boolean} [ignoreEnd] - Re‑probe past cached end flags
     * @param {boolean} [withMeta] - If true, return arrays of { pid,
     * sysMeta } instead of bare PIDs.
     * @returns {Promise<VersionRecord>} - resolves to an object with `prev`,
     * `next`, `sysMeta`, `endPrev`, and `endNext` properties.
     */
    async getFullChain(pid, ignoreEnd = false, withMeta = false) {
      await this.fillVersionChain(pid, Infinity, true, ignoreEnd); // walk → newest
      await this.fillVersionChain(pid, Infinity, false, ignoreEnd); // walk → oldest
      const cached = this.cache.get(pid);
      const chain = {
        prev: cached.prev,
        next: cached.next,
        sysMeta: cached.sysMeta,
        endPrev: cached.endPrev,
        endNext: cached.endNext,
      };
      if (withMeta) {
        const withMetaMap = async (list) =>
          Promise.all(
            list.map(async (p) => {
              const r = await this.record(p);
              return { pid: p, sysMeta: r.sysMeta };
            }),
          );

        chain.prev = await withMetaMap(chain.prev);
        chain.next = await withMetaMap(chain.next);
      }
      return chain;
    }

    /**
     * Refresh the version chain for the given PID by removing it from the cache
     * and re-fetching the full chain from the SysMeta service.
     * @param {string} pid - the PID to refresh
     * @returns {Promise<object>} - resolves to the refreshed chain object
     */
    async refresh(pid) {
      await this.store.removeItem(pid);
      this.cache.delete(pid);
      await this.getFullChain(pid);
      return this.cache.get(pid);
    }

    /**
     * Clear the entire cache, including in-memory and persistent store.
     * @returns {Promise<boolean>} - resolves to true if the cache was cleared
     */
    async clear() {
      await this.store.clear();
      this.cache.clear();
      this.inFlight.clear();
      this.locks.clear();
      // remove all listeners
      this.off();
      return true;
    }

    /**
     * Set the Time-To-Live (TTL) for cached records.
     * @param {number} ms - the TTL in milliseconds
     */
    setTTL(ms) {
      if (typeof ms !== "number" || ms <= 0) {
        throw new Error("Invalid TTL provided to VersionTracker");
      }
      this.TTL_MS = Number(ms) || this.TTL_MS;
    }

    /**
     * Manually register that `newPid` obsoletes (comes after) `prevPid`. Useful
     * when an external editor just created a brand‑new revision so the chain
     * can be updated immediately without refetching SysMeta. If `sysMeta` for
     * the new PID is already available, pass it to avoid a network round‑trip;
     * otherwise the tracker will fetch it lazily when first requested.
     * @param {string} prevPid - the PID of the previous version
     * @param {string} newPid - the PID of the new version
     * @param {SysMeta} [sysMeta] - optional SysMeta object for the new version.
     */
    async addVersion(prevPid, newPid, sysMeta = null) {
      await this.fillVersionChain(prevPid, 1, true);
      await this.fillVersionChain(newPid, 1, false);

      const prevRec = await this.record(prevPid);
      const newRec = await this.record(newPid);

      // newPid must not be in the chain of prevPid
      if (prevRec.next.includes(newPid) || prevRec.prev.includes(newPid)) {
        throw new Error(
          `Cannot add version: ${newPid} is already in the chain of ${prevPid}`,
        );
      }

      // prevRec must be tip, newRec must be isolated
      const prevIsTip = prevRec.endNext && prevRec.next.length === 0;
      const newIsIsolated =
        newRec.endPrev && newRec.prev.length === 0 && newRec.next.length === 0;
      if (!prevIsTip || !newIsIsolated) {
        let msg = `Cannot add version: ${newPid} as a new version of ${prevPid}`;
        if (!prevIsTip)
          msg += ` prevPid (${prevPid}) already has a newer version.`;
        if (!newIsIsolated)
          msg += ` newPid (${newPid}) already version history.`;
        throw new Error(msg);
      }

      // link the two
      prevRec.next[0] = newPid;
      prevRec.endNext = true;

      newRec.prev[0] = prevPid;
      newRec.endNext = true;
      if (sysMeta) newRec.sysMeta = sysMeta;

      await this.persist(prevPid, prevRec);
      await this.persist(newPid, newRec);

      this.notify(prevPid);
      this.notify(newPid);
    }

    /**
     * Notify that a specific the chain for a specific PID has been updated.
     * This is called internally after a new version is added or the chain is
     * updated.
     * @param {string} pid - the PID to notify about
     * @private
     */
    notify(pid) {
      const rec = this.cache.get(pid);
      this.trigger(`update:${pid}`, rec);
    }

    /**
     * Ensure we have at least `stepsNeeded` hops cached in `direction` starting
     * from `startPid` (not counting the start itself).
     * @param {string} startPid - the PID to start from
     * @param {number} stepsNeeded - how many hops to fill in the chain
     * @param {boolean} forward - true to fill next versions, false for prev
     * @param {boolean} [ignoreEnd] - if true, ignore end flags and continue
     * filling the chain even if it appears complete.
     * @returns {Promise<void>} - resolves when the chain is filled
     * @private
     */
    async fillVersionChain(startPid, stepsNeeded, forward, ignoreEnd = false) {
      const steps =
        stepsNeeded === Infinity ? this.MAX_CHAIN_HOPS : stepsNeeded;

      const rec = await this.record(startPid);
      const list = forward ? rec.next : rec.prev;
      const endFlag = forward ? "endNext" : "endPrev";

      if (ignoreEnd) rec[endFlag] = false;

      // --- simple per‑PID/dir lock to avoid concurrent mutation ---
      const lockKey = `${startPid}`;
      /* eslint-disable no-await-in-loop */
      while (this.locks.get(lockKey)) await this.locks.get(lockKey);
      let resolveLock;
      this.locks.set(
        lockKey,
        new Promise((r) => {
          resolveLock = r;
        }),
      );
      try {
        // already long enough
        if (list.length >= steps) return;

        let currentPid = list.length > 0 ? list[list.length - 1] : startPid;

        // Walk until we fill `stepsNeeded` slots or hit chain end
        while (
          list.length < steps &&
          currentPid &&
          (!rec[endFlag] || ignoreEnd)
        ) {
          let sysMeta;
          try {
            sysMeta = await this.getSysMeta(currentPid);
          } catch (err) {
            if (!rec.errors) rec.errors = [];
            rec.errors.push({
              pid: currentPid,
              error: err.message || "Unknown error fetching SysMeta",
              errorCode: err.code || "UNKNOWN",
            });
            break; // stop if we can't fetch SysMeta
          }
          const adjacentPid = forward
            ? sysMeta?.data?.obsoletedBy
            : sysMeta?.data?.obsoletes;
          if (!adjacentPid) {
            rec[endFlag] = true; // mark end reached
            this.notify(startPid);
            break; // no more versions in this direction
          } else {
            list.push(adjacentPid);
            this.notify(startPid);

            // also populate the reverse link on the neighbour record
            const adjRec = await this.record(adjacentPid);
            const reverseList = forward ? adjRec.prev : adjRec.next;
            const idx = list.length - 1;
            // ensure reverseList is long enough
            // while (reverseList.length < idx + 1) reverseList.push(undefined);
            if (reverseList[idx] !== startPid) {
              reverseList[idx] = startPid;
              await this.persist(adjacentPid, adjRec);
            }

            currentPid = adjacentPid;
          }
          /* eslint-enable no-await-in-loop */
        }

        await this.persist(startPid, rec);
      } finally {
        // always resolve the lock to allow other calls to proceed
        if (resolveLock) resolveLock();
        this.locks.delete(lockKey);
      }
    }

    /**
     * Ensure the user is authenticated and has a valid token.
     * @returns {Promise<string>} - resolves to the user's token
     */
    async getToken() {
      return MetacatUI.appUserModel.getTokenPromise();
    }

    /**
     * Get the SysMeta for a given PID. Prevents duplicate fetches for the same
     * PID and token by caching in-flight requests.
     * @param {string} pid - the PID to get SysMeta for
     * @returns {Promise<SysMeta>} - resolves to the SysMeta object for the PID
     * @private
     */
    async getSysMeta(pid) {
      const token = await this.getToken();
      const cacheKey = `${pid}:${token || ""}`;
      if (this.inFlight.has(cacheKey)) return this.inFlight.get(cacheKey);

      const fetchPromise = (async () => {
        const rec = await this.record(pid);
        if (rec.sysMeta) return rec.sysMeta;

        const sysMeta = new SysMeta({
          identifier: pid,
          metaServiceUrl: this.metaServiceUrl,
        });
        await sysMeta.fetch(token);
        rec.sysMeta = sysMeta;
        return rec.sysMeta;
      })();

      this.inFlight.set(cacheKey, fetchPromise);

      try {
        return await fetchPromise;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    }

    /**
     * Get or create a record for the given PID, ensuring it is cached. If the
     * record is not found in the cache, it will be fetched from localForage. If
     * it doesn't exist in localForage, a new record will be created.
     * @param {string} pid - the PID to get the record for
     * @returns {Promise<VersionRecord>} - resolves to the record object with
     * `next`, `prev`, `endNext`, `endPrev`, and `sysMeta` properties.
     * @private
     */
    async record(pid) {
      // First check the in-memory cache
      let rec = this.cache.get(pid);
      if (rec) return rec;

      // the rec obj will be updated with next/prev links if saved in
      // localForage
      rec = {
        next: [],
        prev: [],
        endNext: false,
        endPrev: false,
        sysMeta: null,
      };
      this.cache.set(pid, rec);
      // move to the end on (re)access
      const bump = () => {
        this.cache.delete(pid);
        this.cache.set(pid, rec);
      };
      bump();
      // Trim oldest if over limit
      while (this.cache.size > this.MAX_CACHE_RECORDS) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }

      // async resurrect
      const saved = await this.load(pid);
      if (saved) {
        rec.next = (saved.next || []).filter(Boolean);
        rec.prev = (saved.prev || []).filter(Boolean);
        rec.endNext = !!saved.endNext;
        rec.endPrev = !!saved.endPrev;
        if (saved.sysMeta) {
          const sm = new SysMeta({
            identifier: pid,
            metaServiceUrl: this.metaServiceUrl,
          });
          sm.data = { identifier: pid, ...saved.sysMeta };
          sm.fetched = true; // mark as fetched to skip network
          rec.sysMeta = sm;
        }
      }
      return rec;
    }

    /**
     * Persist the record for the given PID to localForage. This will store the
     * next/prev links, end flags, and lean SysMeta data.
     * @param {string} pid - the PID to persist
     * @param {VersionRecord} rec - the record to persist
     * @returns {Promise<void>} - resolves when the record is persisted
     * @private
     */
    async persist(pid, rec) {
      // Extract lean SysMeta data if available
      let leanMeta = null;

      if (rec.sysMeta && rec.sysMeta.data) {
        leanMeta = {};
        PERSISTED_SYS_META_FIELDS.forEach((k) => {
          if (rec.sysMeta.data[k] !== undefined)
            leanMeta[k] = rec.sysMeta.data[k];
        });
      }
      await this.store.setItem(pid, {
        next: rec.next,
        prev: rec.prev,
        endNext: rec.endNext,
        endPrev: rec.endPrev,
        sysMeta: leanMeta,
        ts: Date.now(),
      });
    }

    /**
     * Load a record for the given PID from localForage. If the record is older
     * than the TTL, it will be removed from the store and null will be
     * returned.
     * @param {string} pid - the PID to load
     * @returns {Promise<VersionRecord|null>} resolves to the record object or
     * null if not found or expired
     * @private
     */
    async load(pid) {
      const saved = await this.store.getItem(pid);
      if (!saved) return null;
      if (Date.now() - saved.ts > this.TTL_MS) {
        await this.store.removeItem(pid);
        return null;
      }
      return saved;
    }
  }

  // Allow the class to trigger Backbone events
  Object.assign(VersionTracker.prototype, Backbone.Events);

  // static map & accessor for singleton instances
  VersionTracker.instances = new Map();

  VersionTracker.get = function get(metaServiceUrl) {
    console.log("VersionTracker.get called with URL:", metaServiceUrl);

    const msUrl = NORMALIZE_METASERVICE_URL(metaServiceUrl);
    console.log("Getting VersionTracker for URL:", msUrl);

    if (!VersionTracker.instances.has(msUrl)) {
      VersionTracker.instances.set(msUrl, new VersionTracker({ msUrl }));
    }
    return VersionTracker.instances.get(msUrl);
  };

  return VersionTracker;
});
