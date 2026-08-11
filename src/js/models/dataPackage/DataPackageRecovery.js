"use strict";

define([
  "common/ErrorUtilities",
  "common/Utilities",
  "common/ValueUtilities",
  "models/dataONEServices/ObjectService",
  "models/dataONEServices/SysMetaService",
  "models/sysmeta/SystemMetadata",
  "models/sysmeta/VersionTracker",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapResolver",
  "models/dataPackage/DataPackageMember",
  "models/dataPackage/UploadRecoveryStore",
  "collections/ObjectFormats",
], (
  ErrorUtilities,
  Utilities,
  Values,
  ObjectService,
  SysMetaService,
  SystemMetadata,
  VersionTracker,
  ResourceMap,
  ResourceMapResolver,
  DataPackageMember,
  UploadRecoveryStore,
  ObjectFormats,
) => {
  const RESOURCE_MAP_FORMAT_ID =
    ObjectFormats.prototype.FORMAT_IDS.RESOURCE_MAP;

  /**
   * Normalize system metadata (model or plain object) to a plain object.
   * @param {object} sysMeta System metadata model or object
   * @returns {object} Plain object view
   */
  const sysMetaJson = (sysMeta) => sysMeta?.toJSON?.() || sysMeta || {};

  /**
   * Build the system metadata for a reconstructed resource map, reusing the
   * member machinery so the checksum matches the exact bytes written and the
   * map obsoletes the prior version.
   * @param {object} plan Build inputs
   * @param {string} plan.rmPid New resource map PID
   * @param {Blob} plan.rmBlob Serialized resource map (the exact bytes)
   * @param {string} plan.obsoletesRmPid Prior resource map PID to obsolete
   * @param {object} plan.sourceSysMeta Prior ResourceMap system metadata,
   * whose submitter/rightsHolder/accessPolicy the new map inherits
   * @param {AbortSignal} [plan.signal] Abort signal
   * @returns {Promise<string>} Serialized resource map system metadata
   */
  async function buildResourceMapSysMeta({
    rmPid,
    rmBlob,
    obsoletesRmPid,
    sourceSysMeta,
    signal,
  }) {
    const member = new DataPackageMember({ formatId: RESOURCE_MAP_FORMAT_ID });
    member.setDesiredPid(rmPid);
    // The map obsoletes the prior version: buildObjectSystemMetadata derives
    // `obsoletes` from remotePid.
    member.remotePid = obsoletesRmPid || null;
    member.uploadFile = rmBlob;
    const source = sysMetaJson(sourceSysMeta);
    await member.buildObjectSystemMetadata(
      {
        formatId: RESOURCE_MAP_FORMAT_ID,
        useBlobMediaType: false,
        submitter: source.submitter,
        rightsHolder: source.rightsHolder,
        accessPolicy: source.accessPolicy,
        signal,
      },
      sourceSysMeta,
    );
    return member.serializeSystemMetadata();
  }

  /**
   * Repair a metadata document that resolves to no resource map after an upload
   * commits the metadata but stops before writing its resource map. Exact
   * replay is attempted first; server reconstruction is available only through
   * explicit opt-in when recovery storage yields no local record:
   *
   *   R1 (replay): resend the exact resource map bytes the interrupted
   *   upload had prepared, from a durable local recovery record. Includes any
   *   newly added files; device local.
   *
   *   R2 (reconstruct): rebuild the resource map from server state by walking
   *   the metadata's `obsoletes` chain to the previous resource map. Device
   *   independent; may miss brand new files a lost record would have captured.
   *
   * Both preserve the resource map version chain by obsoleting the prior map,
   * and are self healing: the DataONE server rejects a second object that would
   * obsolete an already obsoleted map, so a map that actually committed is
   * detected rather than duplicated.
   *
   * TODO: we should combine the EML local drafts feature with this class so
   * that we can also recover from unsaved EML drafts.
   *
   * @class DataPackageRecovery
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  class DataPackageRecovery {
    /**
     * Create a package recovery coordinator.
     * @param {object} options Recovery configuration and injected collaborators
     * @param {string} options.resolveServiceUrl Resolve service base URL passed
     * to ResourceMap parsing
     * @param {string} [options.objectServiceUrl] Object service base URL passed
     * to ResourceMap parsing for configured endpoint identity checks
     * @param {ObjectService} [options.objectService] Object write service
     * @param {SysMetaService} [options.sysMetaService] System metadata service
     * @param {VersionTracker} [options.versionTracker] Version tracker used to
     * map prior members to their latest versions
     * @param {ResourceMapResolver} [options.resolver] Resolver for the prior
     * resource map and for caching a recovered mapping
     * @param {UploadRecoveryStore} [options.recoveryStore] Durable record store
     */
    constructor({
      resolveServiceUrl,
      objectServiceUrl,
      objectService,
      sysMetaService,
      versionTracker,
      resolver,
      recoveryStore,
    } = {}) {
      this.resolveServiceUrl = Values.requireNonEmptyString(
        resolveServiceUrl,
        "resolveServiceUrl required",
      );
      this.objectServiceUrl = Values.normalizeText(objectServiceUrl) || null;
      this.objectService = objectService || new ObjectService();
      this.sysMetaService = sysMetaService || new SysMetaService();
      this.versionTracker = versionTracker || new VersionTracker();
      this.resolver = resolver || new ResourceMapResolver();
      this.recoveryStore = recoveryStore || new UploadRecoveryStore();
    }

    /**
     * Attempt to recover an orphaned metadata document.
     * @param {string} metadataPid Orphaned metadata PID (its latest version)
     * @param {object} [options] Recovery options
     * @param {boolean} [options.allowReconstruct] Reconstruct from the prior
     * server ResourceMap only when local storage yields no record after its read
     * retry. Defaults to false
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Maximum concurrent server reads
     * @returns {Promise<object>} Result: `{ recovered, resourceMapPid, strategy }`
     * or `{ recovered: false, reason }`
     */
    async recover(metadataPid, options = {}) {
      const pid = Values.requireNonEmptyString(metadataPid, "PID required");
      const { allowReconstruct = false, ...internalOptions } = options;
      const recoveryOptions = {
        ...internalOptions,
        maxConcurrent: Utilities.getMaxConcurrent(
          internalOptions.maxConcurrent,
        ),
      };
      const replayed = await this._replayFromRecord(pid, recoveryOptions);
      if (replayed.recovered) return replayed;
      // UploadRecoveryStore treats exhausted read failures as no record because
      // inaccessible bytes cannot support R1. Other R1 failures preserve their
      // reason and block R2 from discarding known package intent.
      if (allowReconstruct !== true || replayed.reason !== "no_record")
        return replayed;
      return this._reconstructFromServer(pid, recoveryOptions);
    }

    /**
     * R1: replay the exact ResourceMap object and System Metadata bytes the
     * interrupted upload prepared.
     * @param {string} metadataPid Orphaned metadata PID
     * @param {object} [options] Options
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Maximum concurrent server reads
     * @returns {Promise<object>} Recovery result
     * @private
     * @throws {Error} When the recovery record cannot be verified or replayed
     */
    async _replayFromRecord(metadataPid, { signal, maxConcurrent } = {}) {
      let record;
      let memberPids;
      try {
        record = await this.recoveryStore.get(metadataPid);
        if (!record) return { recovered: false, reason: "no_record" };
        Values.requireNonEmptyString(
          record.rmSysMetaXml,
          "Recovery record System Metadata required",
        );
        memberPids = ResourceMap.fromXml(record.rmPid, record.rmXml, {
          resolveServiceUrl: this.resolveServiceUrl,
          objectServiceUrl: this.objectServiceUrl,
        }).getMemberPids();
      } catch (error) {
        if (ErrorUtilities.isAbortError(error) || signal?.aborted) throw error;
        return { recovered: false, reason: "record_unreadable" };
      }
      const rmBlob = new Blob([record.rmXml], { type: "application/xml" });
      // Never publish a resource map that points at objects that did not
      // commit: confirm every referenced member is present first.
      try {
        if (
          !(await this._verifyMembersPresent(memberPids, {
            signal,
            maxConcurrent,
          }))
        ) {
          return { recovered: false, reason: "members_missing" };
        }
      } catch (error) {
        if (ErrorUtilities.isAbortError(error) || signal?.aborted) throw error;
        return { recovered: false, reason: "members_unverifiable" };
      }
      return this._commitRecovery(
        metadataPid,
        {
          rmPid: record.rmPid,
          obsoletesRmPid: record.obsoletesRmPid || null,
          rmBlob,
          rmSysMetaXml: record.rmSysMetaXml,
          fileName: record.rmFileName,
        },
        "replay",
        signal,
      );
    }

    /**
     * R2: reconstruct the resource map from server state by walking the
     * metadata's `obsoletes` chain to the previous resource map, then building
     * a new map that obsoletes it and aggregates the latest metadata plus the
     * prior data members (mapped to their latest versions). Recovers a
     * metadata only edit perfectly; brand new files added in the interrupted
     * session are only captured by the durable record (R1).
     * @param {string} metadataPid Orphaned metadata PID
     * @param {object} [options] Options
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Maximum concurrent server reads
     * @returns {Promise<object>} Recovery result
     * @private
     */
    async _reconstructFromServer(metadataPid, { signal, maxConcurrent } = {}) {
      const metaSysMeta = await this._getSysMeta(metadataPid, signal);
      const priorMetadataPid = sysMetaJson(metaSysMeta).obsoletes || null;
      if (!priorMetadataPid) {
        return { recovered: false, reason: "no_prior_version" };
      }

      const resolved = await this.resolver.resolve(priorMetadataPid, {
        signal,
      });
      const priorRmPid = resolved?.rm || null;
      if (!priorRmPid) return { recovered: false, reason: "no_prior_map" };
      const priorRmSysMeta = await this._getSysMeta(priorRmPid, signal);
      if (!priorRmSysMeta) {
        return { recovered: false, reason: "prior_map_sysmeta_missing" };
      }

      const fetched = await this.resolver.fetchResourceMap(priorRmPid, {
        signal,
      });
      const priorMap = fetched?.model;
      if (!priorMap)
        return { recovered: false, reason: "prior_map_unreadable" };

      // R2 can only advance members already represented in the prior graph;
      // brand-new files require the exact R1 record from the interrupted save.
      const priorDataPids = (priorMap.getMemberPids() || []).filter(
        (pid) => pid !== priorMetadataPid && pid !== priorRmPid,
      );
      const latestDataPids = await this.versionTracker.getLatestVersions(
        priorDataPids,
        { useCache: false, signal, maxConcurrent },
      );

      // Mutate a parsed copy because resolvers may cache the prior model. This
      // preserves its locations, provenance, documentation topology, and RDF
      // that MetacatUI does not manage while advancing only known identities.
      const rmModel = ResourceMap.fromXml(
        priorRmPid,
        priorMap.serialize({ validate: false }),
        {
          resolveServiceUrl: this.resolveServiceUrl,
          objectServiceUrl: this.objectServiceUrl,
        },
      );
      const rmPid = Values.makeUUID({
        prefix: ResourceMap.RESOURCE_MAP_PID_PREFIX,
      });
      rmModel.setResourceMapPid(rmPid);
      rmModel.replaceMember(priorMetadataPid, metadataPid);
      priorDataPids.forEach((pid, index) => {
        rmModel.replaceMember(pid, latestDataPids[index]);
      });
      rmModel.setModified(new Date());
      const rmXml = rmModel.serialize({ validate: true });
      const rmBlob = new Blob([rmXml], { type: "application/xml" });
      const rmSysMetaXml = await buildResourceMapSysMeta({
        rmPid,
        rmBlob,
        obsoletesRmPid: priorRmPid,
        sourceSysMeta: priorRmSysMeta,
        signal,
      });
      const fileName = ResourceMap.defaultFileName(rmPid);

      return this._commitRecovery(
        metadataPid,
        { rmPid, obsoletesRmPid: priorRmPid, rmBlob, rmSysMetaXml, fileName },
        "reconstruct",
        signal,
      );
    }

    /**
     * Write a resource map, self healing when the intended map or a compatible
     * successor already committed despite the failed response.
     * @param {object} plan Resource map write plan
     * @param {string} plan.metadataPid Metadata PID being recovered
     * @param {string} plan.rmPid New resource map PID
     * @param {string} [plan.obsoletesRmPid] Prior resource map PID to obsolete
     * @param {Blob} plan.rmBlob Serialized resource map
     * @param {string} plan.rmSysMetaXml Serialized resource map system metadata
     * @param {string} [plan.fileName] Resource map file name
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<string>} The committed resource map PID
     * @private
     * @throws {Error} When the resource map write cannot be confirmed
     */
    async _writeResourceMap(
      { metadataPid, rmPid, obsoletesRmPid, rmBlob, rmSysMetaXml, fileName },
      signal,
    ) {
      const writeOptions = { transport: "xhr", signal };
      try {
        if (obsoletesRmPid) {
          await this.objectService.update(
            {
              pid: obsoletesRmPid,
              newPid: rmPid,
              object: rmBlob,
              sysMetaXml: rmSysMetaXml,
              fileName,
            },
            writeOptions,
          );
        } else {
          await this.objectService.create(
            { pid: rmPid, object: rmBlob, sysMetaXml: rmSysMetaXml, fileName },
            writeOptions,
          );
        }
        return rmPid;
      } catch (error) {
        if (ErrorUtilities.isAbortError(error) || signal?.aborted) throw error;
        const committed = await this._resolveAlreadyCommitted(
          { metadataPid, rmPid, obsoletesRmPid, rmSysMetaXml },
          signal,
        );
        if (committed) return committed;
        throw error;
      }
    }

    /**
     * Validate a server side resource map before selecting it as the recovery
     * result: exact prepared bytes at the intended PID, or a readable successor
     * that obsoletes the expected prior map and contains the recovered metadata.
     * @param {object} plan Resource map identity
     * @param {string} plan.metadataPid Metadata PID being recovered
     * @param {string} plan.rmPid Intended resource map PID
     * @param {string} [plan.obsoletesRmPid] Prior resource map PID to obsolete
     * @param {string} plan.rmSysMetaXml Prepared ResourceMap system metadata
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<string|null>} The committed resource map PID, or null
     * @private
     */
    async _resolveAlreadyCommitted(
      { metadataPid, rmPid, obsoletesRmPid, rmSysMetaXml },
      signal,
    ) {
      const intended = await this._getSysMeta(rmPid, signal);
      if (intended) {
        const expected = SystemMetadata.fromXml(rmSysMetaXml).toJSON();
        const remote = sysMetaJson(intended);
        const fields = ["identifier", "size", "checksum", "checksumAlgorithm"];
        if (fields.every((field) => remote[field] === expected[field])) {
          return rmPid;
        }
      }
      if (obsoletesRmPid) {
        const prior = await this._getSysMeta(obsoletesRmPid, signal);
        const candidatePid = sysMetaJson(prior).obsoletedBy;
        if (candidatePid) {
          const candidate = await this._getSysMeta(candidatePid, signal);
          if (
            sysMetaJson(candidate).obsoletes === obsoletesRmPid &&
            (await this.resolver.verify(candidatePid, metadataPid, { signal }))
          ) {
            return candidatePid;
          }
        }
      }
      return null;
    }

    /**
     * Confirm every referenced member PID is present on the server.
     * @param {string[]} pids Member PIDs to check
     * @param {object} [options] Check options
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Maximum concurrent server reads
     * @returns {Promise<boolean>} True when all members are present
     * @private
     * @throws {Error} When a member check fails
     */
    async _verifyMembersPresent(pids, { signal, maxConcurrent } = {}) {
      const unique = Values.dedupeStrings(pids);
      if (!unique.length) return true;

      let allPresent = true;
      // Bound package-wide fan-out so per-request retries cannot turn a large
      // package into hundreds of simultaneous recovery requests.
      const { errors } = await Utilities.processConcurrently(
        unique,
        async (pid) => {
          if (!(await this._getSysMeta(pid, signal))) allPresent = false;
        },
        { maxConcurrent, signal },
      );
      ErrorUtilities.throwIfAborted(signal);
      if (errors.length) throw errors[0].error;
      return allPresent;
    }

    /**
     * Download system metadata, returning null when confirmed absent.
     * @param {string} pid PID to look up
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<object|null>} System metadata, or null
     * @private
     * @throws {Error} When system metadata cannot be downloaded
     */
    async _getSysMeta(pid, signal) {
      try {
        return (
          (await this.sysMetaService.download(pid, {
            useCache: false,
            signal,
          })) || null
        );
      } catch (error) {
        if (error?.status === 404 && !signal?.aborted) return null;
        throw error;
      }
    }

    /**
     * Commit a recovered resource map: write it, cache the mapping so the
     * package resolves immediately, clear the now redundant record, and report
     * success. Shared by both strategies so every recovery finishes the same
     * way.
     * @param {string} metadataPid Recovered metadata PID
     * @param {object} plan Resource map write plan for {@link #_writeResourceMap}
     * @param {string} strategy Recovery strategy name
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<object>} Successful recovery result
     * @private
     */
    async _commitRecovery(metadataPid, plan, strategy, signal) {
      const resourceMapPid = await this._writeResourceMap(
        { metadataPid, ...plan },
        signal,
      );
      await this.resolver
        .addToStorage(metadataPid, resourceMapPid)
        .catch(() => {});
      await this.recoveryStore.remove(metadataPid);
      return { recovered: true, resourceMapPid, strategy };
    }
  }

  return DataPackageRecovery;
});
