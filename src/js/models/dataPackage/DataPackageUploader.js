"use strict";

/* eslint-disable no-await-in-loop */
// We use a lot of await in loops here because we at times process members sequentially

define([
  "common/ErrorUtilities",
  "common/Utilities",
  "common/ValueUtilities",
  "models/dataONEServices/DataONEService",
  "models/sysmeta/AccessPolicy",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapResolver",
  "models/dataPackage/DataPackageMember",
  "models/dataPackage/UploadResult",
  "collections/ObjectFormats",
], (
  ErrorUtilities,
  Utilities,
  Values,
  DataONEService,
  AccessPolicy,
  ResourceMap,
  ResourceMapResolver,
  DataPackageMember,
  UploadResult,
  ObjectFormats,
) => {
  const RESOURCE_MAP_FORMAT_ID =
    ObjectFormats.prototype.FORMAT_IDS.RESOURCE_MAP;
  const UPLOAD_CANCELLED_MESSAGE = "Upload cancelled";
  const UPLOAD_PHASES = Object.freeze({
    DATA: "data",
    METADATA: "metadata",
    SYSTEM_METADATA: "systemMetadata",
    RESOURCE_MAP: "resourceMap",
  });
  const UPLOAD_PHASE_ORDER = Object.freeze(Object.values(UPLOAD_PHASES));
  const UPLOAD_OPERATIONS = Object.freeze({
    CREATE: "create",
    UPDATE: "update",
    UPDATE_SYSTEM_METADATA: "updateSystemMetadata",
  });
  const { DEFAULT_MAX_CONCURRENT, processConcurrently } = Utilities;
  const { abortableDelay, createAbortError, isAbortError, throwIfAborted } =
    ErrorUtilities;

  // The ResourceMap is the last, orphan-critical write. A transient failure is
  // re-attempted a bounded number of times (initial attempt included), but only
  // after verifying the write did not commit — so an ambiguous success is never
  // duplicated. Other writes attempt exactly once and defer to action-level
  // ambiguity handling.
  const RESOURCE_MAP_WRITE_ATTEMPTS = 3;
  const RESOURCE_MAP_RETRY_BASE_DELAY_MS = 500;

  /**
   * Link one internal upload controller to an optional caller signal.
   * @param {AbortSignal} [signal] Caller signal
   * @returns {object} Controller and listener cleanup
   */
  function createUploadController(signal) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener("abort", abort, { once: true });
    }
    return {
      controller,
      cleanup: () => signal?.removeEventListener("abort", abort),
    };
  }

  /**
   * Coordinates upload preparation, execution, retry, cancellation, and recovery
   * persistence for one {@link DataPackage} instance.
   * @class DataPackageUploader
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  class DataPackageUploader {
    /**
     * Create an uploader for one data package.
     * @param {object} options Uploader options
     * @param {object} options.dataPackage Owning DataPackage instance
     * @throws {Error} When no data package is supplied
     */
    constructor({ dataPackage } = {}) {
      if (!dataPackage) {
        throw new Error("DataPackageUploader requires a DataPackage");
      }
      this.dataPackage = dataPackage;
    }

    /**
     * Return eager upload records that are still in flight.
     * @returns {object[]} Eager upload records in flight
     */
    getPendingEagerUploads() {
      return [...new Set(this.dataPackage.eagerUploads.values())];
    }

    /**
     * Build eager actions for newly added members. A later full save aggregates
     * successful eager uploads.
     * @param {DataPackageMember[]} members Members to upload eagerly
     * @param {object} [options] Build options
     * @param {AbortSignal} [options.signal] Abort signal for checksums
     * @param {number} [options.maxConcurrent] Fetch concurrency
     * @returns {Promise<object[]>} Eager upload actions
     * @throws {Error} When eager upload preparation fails
     */
    async _prepareEagerUploadActions(
      members,
      { signal, maxConcurrent = DEFAULT_MAX_CONCURRENT } = {},
    ) {
      throwIfAborted(signal, UPLOAD_CANCELLED_MESSAGE);
      const { UPDATE, UPDATE_SYSTEM_METADATA } =
        DataPackageMember.RequiredOperation;
      // Build eager updates from fresh source state. Execution checks the
      // source again immediately before writing to close the remaining race.
      const sourcePids = Values.dedupeStrings(
        members
          .filter((member) =>
            [UPDATE, UPDATE_SYSTEM_METADATA].includes(
              member.getRequiredOperation(),
            ),
          )
          .map((member) => member._replacementSourcePid || member.remotePid)
          .filter(Boolean),
      );
      const freshSysMetaByPid = new Map();
      const { errors } = await processConcurrently(
        sourcePids,
        async (pid) => {
          const sysMeta = await this.dataPackage
            .getVersionTracker()
            .getSysMeta(pid, { useCache: false, signal });
          freshSysMetaByPid.set(pid, sysMeta);
        },
        { maxConcurrent, signal, stopOnError: true },
      );
      if (errors.length) throw errors[0].error;
      const defaults = this.buildSysMetaDefaults();
      const actions = await this.buildUploadActions(members, defaults, {
        signal,
        maxConcurrent,
        isolateMemberFailures: true,
        freshSysMetaByPid,
      });
      throwIfAborted(signal, UPLOAD_CANCELLED_MESSAGE);
      return actions;
    }

    /**
     * Start eager uploads for newly added members through the same executor as
     * full package uploads.
     * @param {DataPackageMember[]} members Members to upload
     * @param {object} [options] Execution options
     * @returns {Promise<UploadResult[]>} One result per eager upload
     */
    async uploadAddedMembers(members, options = {}) {
      const maxConcurrent = Utilities.getMaxConcurrent(
        "upload",
        options.maxConcurrent,
      );
      const uploadMembers = Values.listify(members).filter(
        (member) => member && !member.removed,
      );
      if (!uploadMembers.length) return [];
      const { controller, cleanup: detachSignal } = createUploadController(
        options.signal,
      );
      const uploadPids = uploadMembers.map((member) => member.pid);
      const promise = (async () => {
        try {
          const { draftRevision } = this.dataPackage;
          const actions = await this._prepareEagerUploadActions(uploadMembers, {
            signal: controller.signal,
            maxConcurrent,
          });
          // Confirm write access before eagerly versioning any existing remote
          // object (e.g. a file replacement). New objects carry no sourcePid, so
          // this is a no-op for added files.
          await this.assertWritePermissions(actions, {
            signal: controller.signal,
            maxConcurrent,
          });
          const result = await this._executeUploadActions(actions, {
            draftRevision,
            checkSourceLatestBeforeWrite: true,
            markPackageSaved: false,
            maxConcurrent,
            signal: controller.signal,
            stopOnError: false,
          });
          return result;
        } finally {
          detachSignal();
        }
      })();
      const record = { members: uploadMembers, controller, promise };
      uploadPids.forEach((pid) => {
        this.dataPackage.eagerUploads.set(pid, record);
      });
      const cleanup = () => {
        uploadPids.forEach((pid) => {
          if (this.dataPackage.eagerUploads.get(pid) === record) {
            this.dataPackage.eagerUploads.delete(pid);
          }
        });
      };
      promise.then(
        (result) => {
          cleanup();
          this.dataPackage.events.trigger("eagerUpload:complete", {
            members: uploadMembers,
            memberPids: uploadPids,
            result,
          });
        },
        (error) => {
          cleanup();
          this.dataPackage.events.trigger("eagerUpload:error", {
            members: uploadMembers,
            memberPids: uploadPids,
            error,
          });
        },
      );
      return [await promise];
    }

    /**
     * Wait for all current eager uploads to settle.
     * @returns {Promise<object[]>} Settled eager upload results
     */
    async waitForEagerUploads() {
      const pending = this.getPendingEagerUploads().map(
        (record) => record.promise,
      );
      if (!pending.length) return [];
      return Promise.allSettled(pending);
    }

    /**
     * Cancel one eager upload.
     * @param {string} pid Member PID
     * @returns {boolean} Whether an eager upload was found
     */
    cancelEagerUpload(pid) {
      const record = this.dataPackage.eagerUploads.get(pid);
      if (!record) return false;
      record.controller.abort();
      this.dataPackage.events.trigger("eagerUpload:cancelled", {
        pid,
        record,
      });
      return true;
    }

    /**
     * Reject preparation when eager uploads are still in flight or unresolved
     * writes require a reload.
     * @param {object} [options] Precondition options
     * @param {boolean} [options.allowAmbiguous] Allow retry verification
     * @private
     * @throws {Error} When an eager or ambiguous write is unresolved
     */
    assertUploadPreconditions({ allowAmbiguous = false } = {}) {
      if (this.getPendingEagerUploads().length) {
        throw new Error(
          "Cannot prepare an upload while eager uploads are in progress",
        );
      }
      const hasAmbiguousWrites = this.dataPackage.members
        .getActiveMembers()
        .some(
          (member) =>
            member.remoteState === DataPackageMember.RemoteState.AMBIGUOUS,
        );
      if (!allowAmbiguous && hasAmbiguousWrites) {
        const error = new Error(
          "Cannot upload while a previous write is unresolved; reload first",
        );
        error.code = "reload_required";
        error.reloadRequired = true;
        throw error;
      }
    }

    /**
     * Throw a stale remote error if a PID is no longer the latest version.
     * @param {string} pid Source PID being updated
     * @param {string} context Human readable context for the error
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<SystemMetadata>} Current System Metadata
     * @private
     * @throws {Error} When the source PID is stale
     */
    async assertLatestVersion(pid, context, signal) {
      const sysMeta = await this.dataPackage
        .getVersionTracker()
        .getSysMeta(pid, {
          useCache: false,
          signal,
        });
      const latest = sysMeta?.obsoletedBy || sysMeta?.identifier || pid;
      if (latest && latest !== pid) {
        throw DataPackageUploader.staleRemoteError(pid, latest, context);
      }
      return sysMeta;
    }

    /**
     * Confirm the package shell and every updated source PID are latest.
     * @param {DataPackageMember[]} changedMembers Changed members
     * @param {object} [options] Check options
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Check concurrency
     * @param {Function} [options.onProgress] Progress callback
     * @returns {Promise<Map<string, SystemMetadata>>} Fresh SysMeta by PID
     * @private
     * @throws {Error} When a source lookup fails or finds stale state
     */
    async assertSourcesAreLatest(
      changedMembers,
      { signal, maxConcurrent = DEFAULT_MAX_CONCURRENT, onProgress } = {},
    ) {
      const pidsToCheck = new Set();
      [
        this.dataPackage.getPrimaryMetadataMember(),
        this.dataPackage.getRootResourceMapMember(),
      ].forEach((member) => {
        if (member?.remotePid) pidsToCheck.add(member.remotePid);
      });
      changedMembers.forEach((member) => {
        const sourcePid = member._replacementSourcePid || member.remotePid;
        if (sourcePid && (member.contentDirty || member.sysMetaDirty)) {
          pidsToCheck.add(sourcePid);
        }
      });
      const sourcePids = [...pidsToCheck];
      const sysMetaByPid = new Map();
      let completed = 0;
      if (sourcePids.length && typeof onProgress === "function") {
        onProgress({ completed, total: sourcePids.length });
      }
      const { errors } = await processConcurrently(
        sourcePids,
        async (pid) => {
          const sysMeta = await this.assertLatestVersion(
            pid,
            "upload source",
            signal,
          );
          sysMetaByPid.set(pid, sysMeta);
        },
        {
          maxConcurrent,
          signal,
          stopOnError: true,
          onItemComplete: () => {
            completed += 1;
            if (typeof onProgress === "function") {
              onProgress({ completed, total: sourcePids.length });
            }
          },
        },
      );
      if (errors.length) throw errors[0].error;
      throwIfAborted(signal, UPLOAD_CANCELLED_MESSAGE);
      return sysMetaByPid;
    }

    /**
     * Check every permission required by source PIDs an upload will update.
     * New objects need no check; the member node authorizes their creation.
     * @param {object[]} actions Upload actions
     * @param {object} [options] Permission check options
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Request concurrency limit
     * @param {Function} [options.onProgress] Progress callback
     * @returns {Promise<void>} Resolves when all sources are writable
     * @private
     * @throws {Error} When the user cannot write to a required source
     */
    async assertWritePermissions(
      actions,
      { signal, maxConcurrent = DEFAULT_MAX_CONCURRENT, onProgress } = {},
    ) {
      const checksByPermission = new Map();
      actions.forEach((action) => {
        if (!action.sourcePid) return;
        action.requiredPermissions.forEach((permission) => {
          const checks = checksByPermission.get(permission) || new Map();
          if (!checks.has(action.sourcePid)) {
            checks.set(
              action.sourcePid,
              this.dataPackage.getMember(action.memberPid),
            );
          }
          checksByPermission.set(permission, checks);
        });
      });

      const permissionGroups = [...checksByPermission].map(
        ([permission, checks]) => ({
          permission,
          checks: [...checks].map(([pid, member]) => ({ pid, member })),
        }),
      );
      const total = permissionGroups.reduce(
        (count, group) => count + group.checks.length,
        0,
      );
      if (!total) return;

      const authService = this.dataPackage.getAuthorizationService();
      const currentSubject =
        Values.normalizeText(
          typeof authService.getUserKey === "function"
            ? await authService.getUserKey()
            : globalThis.MetacatUI?.appUserModel?.get?.("username"),
        ) || "public";
      const authenticatedSubject = currentSubject !== "public";
      const appUserModel = globalThis.MetacatUI?.appUserModel;
      const getUserValue = (key) =>
        typeof appUserModel?.get === "function" ? appUserModel.get(key) : null;
      const identityModels = Array.isArray(getUserValue("identities"))
        ? getUserValue("identities")
        : [];
      const groupModels = Array.isArray(getUserValue("isMemberOf"))
        ? getUserValue("isMemberOf")
        : [];
      const currentSubjects = authenticatedSubject
        ? Values.dedupeStrings([
            currentSubject,
            getUserValue("username"),
            ...Values.normalizeStringList(getUserValue("identitiesUsernames")),
            ...Values.normalizeStringList(
              getUserValue("allIdentitiesAndGroups"),
            ),
            ...identityModels.map(
              (identity) =>
                identity?.get?.("username") || identity?.username || identity,
            ),
            ...groupModels.map((group) => group?.groupId || group),
          ])
        : ["public"];
      const isLocallyObviousAllow = (member, permission) => {
        try {
          // Local policy can prove an allow, never a denial. Only trust a fresh,
          // fully parsed remote baseline; all uncertain cases go to the server.
          if (!member?._remoteSysMetaDownloaded) return false;
          const sysMeta = member.remoteSysMeta;
          const parseWarnings =
            member._remoteSysMetaParseWarnings || sysMeta?.parseWarnings;
          if (
            !sysMeta ||
            (Array.isArray(parseWarnings) && parseWarnings.length)
          ) {
            return false;
          }
          if (
            authenticatedSubject &&
            currentSubjects.includes(Values.normalizeText(sysMeta.rightsHolder))
          ) {
            return true;
          }
          const policy = sysMeta.accessPolicy;
          if (typeof policy?.isAuthorized !== "function") return false;
          return (
            (authenticatedSubject &&
              policy.isAuthorized(permission, currentSubjects)) ||
            policy.isAuthorized(permission, "public")
          );
        } catch (_error) {
          return false;
        }
      };

      const denied = [];
      let completed = 0;
      if (typeof onProgress === "function") {
        onProgress({ completed, total });
      }
      // Permission types stay sequential because each server batch reports
      // progress against the completed count from the preceding batch.
      for (let index = 0; index < permissionGroups.length; index += 1) {
        const { permission, checks } = permissionGroups[index];
        const sourcePids = [];
        for (let checkIndex = 0; checkIndex < checks.length; checkIndex += 1) {
          const { pid, member } = checks[checkIndex];
          if (isLocallyObviousAllow(member, permission)) {
            completed += 1;
            if (typeof onProgress === "function") {
              onProgress({ action: permission, completed, pid, total });
            }
          } else {
            sourcePids.push(pid);
          }
        }
        if (sourcePids.length) {
          const completedBeforeBatch = completed;
          const results = await authService.checkAll(sourcePids, permission, {
            signal,
            maxConcurrent,
            onProgress: (progress) => {
              if (progress.completed === 0) return;
              if (typeof onProgress === "function") {
                onProgress({
                  completed: completedBeforeBatch + progress.completed,
                  total,
                });
              }
            },
          });
          completed += sourcePids.length;
          denied.push(...sourcePids.filter((pid) => results[pid] !== true));
        }
      }
      if (denied.length) {
        throw DataPackageUploader.unauthorizedError(
          Values.dedupeStrings(denied),
        );
      }
    }

    /**
     * Ensure changed metadata members hold their final desired upload PID.
     * Data PIDs are assigned at edit time; the ResourceMap PID is assigned when
     * its action is built.
     * @param {DataPackageMember[]} changedMembers Changed members
     * @returns {Promise<void>} Resolves when metadata PIDs are final
     * @private
     */
    async allocateUploadPids(changedMembers) {
      await Promise.all(
        changedMembers
          .filter((member) => member.isMetadata() && member.contentDirty)
          .map((member) => this.dataPackage.ensureMetadataUploadPid(member)),
      );
    }

    /**
     * Default System Metadata values for newly created objects.
     * @returns {object} Defaults applied when a member lacks its own values
     * @private
     */
    buildSysMetaDefaults() {
      const subject = globalThis.MetacatUI?.appUserModel?.get?.("username");
      return {
        submitter: subject || null,
        rightsHolder: subject || null,
        accessPolicy: AccessPolicy.fromValue(
          globalThis.MetacatUI?.appModel?.get?.("defaultAccessPolicy"),
        ),
        ...this.dataPackage.uploadDefaults,
      };
    }

    /**
     * Build the object write and system metadata only actions for changed
     * members. The ResourceMap action is built separately. Members are
     * processed sequentially to bound concurrent checksum work.
     * @param {DataPackageMember[]} changedMembers Changed members
     * @param {object} defaults System Metadata defaults
     * @param {object} [options] Build options
     * @param {AbortSignal} [options.signal] Abort signal for checksums
     * @param {number} [options.maxConcurrent] Fetch concurrency
     * @param {boolean} [options.isolateMemberFailures] Mark member failures and
     * continue preparing the rest of the upload
     * @param {Map<string, SystemMetadata>} [options.freshSysMetaByPid]
     * Fresh preflight System Metadata by source PID
     * @param {Function} [options.onSystemMetadataProgress] SysMeta progress
     * @param {Function} [options.onBuildProgress] Action build progress
     * @returns {Promise<object[]>} Raw upload actions
     * @private
     * @throws {Error} When package state cannot produce valid actions
     */
    async buildUploadActions(
      changedMembers,
      defaults,
      {
        signal,
        maxConcurrent = DEFAULT_MAX_CONCURRENT,
        isolateMemberFailures = false,
        freshSysMetaByPid = new Map(),
        onSystemMetadataProgress,
        onBuildProgress,
      } = {},
    ) {
      const buildable = changedMembers.filter(
        (member) => !member.isResourceMap(),
      );
      const { UPDATE, UPDATE_SYSTEM_METADATA } =
        DataPackageMember.RequiredOperation;
      const needsSysMetaBaseline = buildable.filter((member) => {
        const operation = member.getRequiredOperation();
        const sourcePid = member._replacementSourcePid || member.remotePid;
        return (
          [UPDATE, UPDATE_SYSTEM_METADATA].includes(operation) &&
          !freshSysMetaByPid.has(sourcePid)
        );
      });
      await this.dataPackage._ensureSystemMetadata(needsSysMetaBaseline, {
        signal,
        maxConcurrent,
        onProgress: onSystemMetadataProgress,
      });
      const actions = [];
      let completed = 0;
      if (buildable.length && typeof onBuildProgress === "function") {
        onBuildProgress({ completed, total: buildable.length });
      }
      // Process members sequentially so checksum work for large files is not
      // run all at once.
      for (let index = 0; index < buildable.length; index += 1) {
        const member = buildable[index];
        // Serializing an edited metadata document blocks the main thread
        // for a while on large documents (the cost is roughly linear in
        // document size), so report it and yield one macrotask so the
        // progress message can paint before the block.
        if (member.isMetadata() && member.contentDirty) {
          if (typeof onBuildProgress === "function") {
            onBuildProgress({ completed, total: buildable.length, member });
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        }
        try {
          const sourcePid = member._replacementSourcePid || member.remotePid;
          actions.push(
            await DataPackageUploader.buildMemberAction(member, defaults, {
              freshSysMeta: freshSysMetaByPid.get(sourcePid),
              signal,
            }),
          );
        } catch (error) {
          if (!isolateMemberFailures) throw error;
          member.markRemoteFailure(error);
        }
        completed += 1;
        if (typeof onBuildProgress === "function") {
          onBuildProgress({ completed, total: buildable.length });
        }
      }
      return actions;
    }

    /**
     * Build a single object write or system metadata only action for a member.
     * @param {DataPackageMember} member Changed member that is not a ResourceMap
     * @param {object} defaults System Metadata defaults
     * @param {object} [options] Build options
     * @param {SystemMetadata} [options.freshSysMeta] Fresh preflight baseline
     * @param {AbortSignal} [options.signal] Abort signal for checksums
     * @returns {Promise<object>} Raw upload action
     * @private
     */
    static async buildMemberAction(
      member,
      defaults,
      { freshSysMeta, signal } = {},
    ) {
      const { UPDATE, UPDATE_SYSTEM_METADATA } =
        DataPackageMember.RequiredOperation;
      const operation = member.getRequiredOperation();

      if (operation === UPDATE_SYSTEM_METADATA) {
        return DataPackageUploader.buildSystemMetadataAction(
          member,
          freshSysMeta,
        );
      }

      const sourcePid = member._replacementSourcePid || member.remotePid;
      const retargetedReplacement =
        member._replacementSourcePid &&
        member._replacementSourcePid !== member.remotePid;
      // A retargeted replacement inherits mutable System Metadata from its
      // replacement source without pretending that source belongs to this member.
      const preparedReplacementBaseline =
        retargetedReplacement && member.sysMeta?.identifier === member.pid
          ? member._replacementSourceSysMeta
          : null;
      const rebasedSystemMetadata =
        operation === UPDATE && freshSysMeta
          ? member._rebaseSystemMetadata(freshSysMeta, {
              updateRemoteBaseline: !retargetedReplacement,
              localEditBaseline: preparedReplacementBaseline,
            })
          : null;
      await member.buildObjectSystemMetadata(
        {
          ...defaults,
          ...(member.isMetadata()
            ? { contentType: "application/xml", useBlobMediaType: false }
            : {}),
          signal,
        },
        rebasedSystemMetadata,
      );
      const payload = await member.serializeContent({ pid: member.pid });
      const requiredPermissions = [];
      if (operation === UPDATE) {
        requiredPermissions.push("write");
        if (member.accessPolicyDirty) {
          requiredPermissions.push("changePermission");
        }
      }
      const uploadOperation =
        operation === UPDATE
          ? UPLOAD_OPERATIONS.UPDATE
          : UPLOAD_OPERATIONS.CREATE;
      return {
        id: `${uploadOperation}:${member.pid}`,
        phase: member.isMetadata()
          ? UPLOAD_PHASES.METADATA
          : UPLOAD_PHASES.DATA,
        operation: uploadOperation,
        memberPid: member.pid,
        sourcePid: operation === UPDATE ? sourcePid : null,
        targetPid: member.pid,
        payload,
        sysMetaXml: member.serializeSystemMetadata(),
        fileName: member.fileName || null,
        size: typeof member.size === "number" ? member.size : null,
        verification: member.getSystemMetadataVerificationFields(),
        requiredPermissions,
      };
    }

    /**
     * Build one system metadata only update action.
     * @param {DataPackageMember} member Member with desired sysmeta changes
     * @param {SystemMetadata} [freshSysMeta] Fresh preflight baseline
     * @returns {object} Raw upload action
     * @private
     */
    static buildSystemMetadataAction(member, freshSysMeta) {
      member.buildSystemMetadataUpdate(freshSysMeta);
      return {
        id: `${UPLOAD_OPERATIONS.UPDATE_SYSTEM_METADATA}:${member.pid}`,
        phase: UPLOAD_PHASES.SYSTEM_METADATA,
        operation: UPLOAD_OPERATIONS.UPDATE_SYSTEM_METADATA,
        memberPid: member.pid,
        sourcePid: member.remotePid,
        targetPid: member.pid,
        payload: null,
        sysMetaXml: member.serializeSystemMetadata(),
        fileName: member.fileName || null,
        size: typeof member.size === "number" ? member.size : null,
        verification: member.getSystemMetadataVerificationFields({
          includeMutableFields: true,
        }),
        requiredPermissions: [
          member.accessPolicyDirty ? "changePermission" : "write",
        ],
      };
    }

    /**
     * Build the root ResourceMap upload action, or null when no new ResourceMap
     * version is needed. Validates and serializes the ResourceMap; warnings
     * (such as unsupported provenance) do not block.
     * @param {object[]} objectActions Object write actions already built
     * @param {object} defaults System Metadata defaults
     * @param {object} [options] Preparation options
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Fetch concurrency
     * @param {Map<string, SystemMetadata>} [options.freshSysMetaByPid]
     * Fresh preflight System Metadata by source PID
     * @returns {Promise<object|null>} ResourceMap action, or null
     * @private
     * @throws {Error} When the resource map member or graph is invalid
     */
    async prepareResourceMapAction(
      objectActions,
      defaults,
      {
        signal,
        maxConcurrent = DEFAULT_MAX_CONCURRENT,
        freshSysMetaByPid = new Map(),
      } = {},
    ) {
      const resourceMap = this.dataPackage.requireResourceMapModel();
      const hasObjectWrites = objectActions.some(
        (action) =>
          action.phase === UPLOAD_PHASES.DATA ||
          action.phase === UPLOAD_PHASES.METADATA,
      );
      const rmMember = this.dataPackage.getRootResourceMapMember();
      if (!rmMember) {
        throw new Error("Cannot build a ResourceMap action without a member");
      }
      if (!resourceMap.hasUnsavedChanges() && !hasObjectWrites) {
        if (
          rmMember.getRequiredOperation() ===
          DataPackageMember.RequiredOperation.UPDATE_SYSTEM_METADATA
        ) {
          const freshSysMeta = freshSysMetaByPid.get(rmMember.remotePid);
          if (!freshSysMeta) {
            await this.dataPackage._ensureSystemMetadata([rmMember], {
              signal,
              maxConcurrent,
            });
          }
          return DataPackageUploader.buildSystemMetadataAction(
            rmMember,
            freshSysMeta,
          );
        }
        return null;
      }

      const sourcePid = rmMember.remotePid || null;
      const freshSysMeta = sourcePid ? freshSysMetaByPid.get(sourcePid) : null;
      if (sourcePid && !freshSysMeta) {
        await this.dataPackage._ensureSystemMetadata([rmMember], {
          signal,
          maxConcurrent,
        });
      }
      await this.dataPackage.ensureResourceMapUploadPid(rmMember);
      resourceMap.setModified?.(new Date().toISOString());
      throwIfAborted(signal);
      // Imported member URLs are RDF identities, not endpoints to migrate.
      // Normalize locally and let graph validation check PID consistency.
      resourceMap.normalize({ markDirty: false });

      let xml;
      try {
        xml = resourceMap.serialize({ validate: true });
      } catch (error) {
        throw DataPackageUploader.validationError(
          error.validationErrors || [{ message: error.message }],
        );
      }

      rmMember.formatId = RESOURCE_MAP_FORMAT_ID;
      rmMember.fileName =
        rmMember.fileName || ResourceMap.defaultFileName(rmMember.pid);
      rmMember.uploadFile = new Blob([xml], { type: "application/xml" });
      const rebasedSystemMetadata = freshSysMeta
        ? rmMember._rebaseSystemMetadata(freshSysMeta)
        : null;
      await rmMember.buildObjectSystemMetadata(
        {
          ...defaults,
          formatId: RESOURCE_MAP_FORMAT_ID,
          useBlobMediaType: false,
          signal,
        },
        rebasedSystemMetadata,
      );
      const requiredPermissions = [];
      if (sourcePid) {
        requiredPermissions.push("write");
        if (rmMember.accessPolicyDirty) {
          requiredPermissions.push("changePermission");
        }
      }
      const operation = sourcePid
        ? UPLOAD_OPERATIONS.UPDATE
        : UPLOAD_OPERATIONS.CREATE;

      return {
        id: `${operation}:${rmMember.pid}`,
        phase: UPLOAD_PHASES.RESOURCE_MAP,
        operation,
        memberPid: rmMember.pid,
        sourcePid,
        targetPid: rmMember.pid,
        payload: rmMember.uploadFile,
        sysMetaXml: rmMember.serializeSystemMetadata(),
        fileName: rmMember.fileName || null,
        size: typeof rmMember.size === "number" ? rmMember.size : null,
        verification: rmMember.getSystemMetadataVerificationFields(),
        requiredPermissions,
      };
    }

    /**
     * Assert that every PID a ResourceMap action aggregates is confirmed
     * remote. Called by the executor before the ResourceMap phase, but exposed
     * here so the invariant lives with the package.
     * @param {object} resourceMapAction ResourceMap upload action
     * @returns {boolean} True when every aggregated PID is confirmed remote
     * @private
     * @throws {Error} When the map references unconfirmed PIDs
     */
    assertResourceMapTargetsRemote(resourceMapAction) {
      const resourceMap = this.dataPackage.requireResourceMapModel(
        resourceMapAction.targetPid,
      );
      const unconfirmed = resourceMap.getMemberPids().filter((pid) => {
        const member = this.dataPackage.getMember(pid);
        return !member || member.remotePid !== pid;
      });
      if (unconfirmed.length) {
        throw new Error(
          `ResourceMap references PIDs that are not confirmed remote: ${unconfirmed.join(
            ", ",
          )}`,
        );
      }
      return true;
    }

    /**
     * Prepare the plain actions required for the current package state.
     * @param {object} [options] Preparation options
     * @param {boolean} [options.resourceMapOnly] Prepare only ResourceMap work
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {number} [options.maxConcurrent] Fetch concurrency
     * @returns {Promise<object[]>} Upload actions
     * @private
     * @throws {Error} When pending changes or content are invalid
     */
    async _prepareUploadActions({
      resourceMapOnly = false,
      signal,
      maxConcurrent = DEFAULT_MAX_CONCURRENT,
    } = {}) {
      throwIfAborted(signal, UPLOAD_CANCELLED_MESSAGE);
      const changedMembers = this.dataPackage.getChangedMembers();

      if (resourceMapOnly) {
        const pendingObjectChanges = changedMembers.filter(
          (member) => !member.isResourceMap(),
        );
        if (pendingObjectChanges.length) {
          throw new Error(
            "A ResourceMap-only upload cannot include pending member changes",
          );
        }
      }

      const contentIssues = changedMembers
        .filter((member) => member.contentDirty)
        .flatMap((member) => member.validateContent());
      if (contentIssues.length) {
        throw DataPackageUploader.validationError(contentIssues);
      }

      const freshSysMetaByPid = await this.assertSourcesAreLatest(
        changedMembers,
        {
          signal,
          maxConcurrent,
          onProgress: ({ completed, total }) => {
            this._emitUploadPrepareProgress(
              "checkingLatest",
              completed,
              total,
              `Checking versions ${completed}/${total}...`,
            );
          },
        },
      );
      await this.allocateUploadPids(changedMembers);

      const defaults = this.buildSysMetaDefaults();
      const objectActions = await this.buildUploadActions(
        changedMembers,
        defaults,
        {
          signal,
          maxConcurrent,
          freshSysMetaByPid,
          onSystemMetadataProgress: ({ completed, total }) => {
            this._emitUploadPrepareProgress(
              "loadingSystemMetadata",
              completed,
              total,
              `Downloading system metadata ${completed}/${total}...`,
            );
          },
          onBuildProgress: ({ completed, total, member }) => {
            this._emitUploadPrepareProgress(
              "buildingActions",
              completed,
              total,
              member?.isMetadata?.()
                ? "Preparing metadata document..."
                : `Preparing updates ${completed}/${total}...`,
            );
          },
        },
      );

      this.dataPackage.refreshMemberGraphFields();
      const resourceMapAction = await this.prepareResourceMapAction(
        objectActions,
        defaults,
        { signal, maxConcurrent, freshSysMetaByPid },
      );
      const actions = resourceMapAction
        ? [...objectActions, resourceMapAction]
        : objectActions;

      await this.assertWritePermissions(actions, {
        signal,
        maxConcurrent,
        onProgress: ({ completed, total }) => {
          this._emitUploadPrepareProgress(
            "checkingPermissions",
            completed,
            total,
            `Checking permissions ${completed}/${total}...`,
          );
        },
      });
      throwIfAborted(signal, UPLOAD_CANCELLED_MESSAGE);
      this._emitUploadPrepareProgress(
        "prepared",
        actions.length,
        actions.length,
        "Upload prepared.",
      );
      return actions;
    }

    /**
     * Prepare and execute an upload.
     * @param {object} [options] Upload options
     * @param {boolean} [options.resourceMapOnly] Upload only ResourceMap work
     * @param {AbortSignal} [options.signal] Caller abort signal
     * @param {number} [options.maxConcurrent] Per phase concurrency
     * @returns {Promise<UploadResult>} Upload result
     * @throws {Error} When another upload is active or upload preparation fails
     */
    async upload({ resourceMapOnly = false, signal, maxConcurrent } = {}) {
      const resolvedMaxConcurrent = Utilities.getMaxConcurrent(
        "upload",
        maxConcurrent,
      );
      if (this.dataPackage.activeUpload) {
        throw new Error("An upload is already in progress");
      }

      let cleanup = () => {};
      try {
        const linked = createUploadController(signal);
        cleanup = linked.cleanup;
        const uploadSignal = linked.controller.signal;
        this.dataPackage.activeUpload = {
          cancelled: false,
          controller: linked.controller,
        };
        if (this.getPendingEagerUploads().length) {
          this.dataPackage.events.trigger("upload:queued", {
            pendingEagerUploads: this.getPendingEagerUploads(),
          });

          let rejectOnAbort;
          const cancelled = new Promise((_, reject) => {
            rejectOnAbort = () => {
              reject(createAbortError(UPLOAD_CANCELLED_MESSAGE));
            };
            uploadSignal.addEventListener("abort", rejectOnAbort, {
              once: true,
            });
          });
          try {
            throwIfAborted(uploadSignal, UPLOAD_CANCELLED_MESSAGE);
            await Promise.race([this.waitForEagerUploads(), cancelled]);
          } finally {
            uploadSignal.removeEventListener("abort", rejectOnAbort);
          }
        }

        this.assertUploadPreconditions();
        const { draftRevision } = this.dataPackage;
        const actions = await this._prepareUploadActions({
          resourceMapOnly,
          signal: uploadSignal,
          maxConcurrent: resolvedMaxConcurrent,
        });
        // Persist a durable recovery record before the first object write, so a
        // crash between "metadata committed" and "ResourceMap committed" can be
        // repaired on the next load. Cleared only on full success.
        await this._persistRecoveryRecord(actions);
        this._emitUploadPrepareProgress(
          "ready",
          actions.length,
          actions.length,
          "Starting upload...",
        );
        const result = await this._executeUploadActions(actions, {
          draftRevision,
          markPackageSaved: true,
          maxConcurrent: resolvedMaxConcurrent,
          signal: uploadSignal,
          stopOnError: true,
        });
        return result;
      } finally {
        cleanup();
        this.dataPackage.activeUpload = null;
      }
    }

    /**
     * Execute plain actions in fixed phase order.
     * @param {object[]} actions Upload actions
     * @param {object} options Execution context
     * @param {number} options.draftRevision Prepared draft revision
     * @param {boolean} [options.checkSourceLatestBeforeWrite] Whether to confirm
     * each update source is still latest immediately before writing
     * @param {boolean} options.markPackageSaved Whether success saves the draft
     * @param {number} options.maxConcurrent Per phase concurrency
     * @param {AbortSignal} options.signal Abort signal
     * @param {boolean} options.stopOnError Stop scheduling after an error
     * @param {UploadResult} [options.result] Existing retry result
     * @returns {Promise<UploadResult>} Upload result
     * @private
     */
    async _executeUploadActions(
      actions,
      {
        draftRevision,
        checkSourceLatestBeforeWrite = false,
        markPackageSaved,
        maxConcurrent,
        signal,
        stopOnError,
        result = new UploadResult(actions, {
          draftRevision,
          dataPackage: this.dataPackage,
        }),
      },
    ) {
      throwIfAborted(signal, UPLOAD_CANCELLED_MESSAGE);
      let shouldContinue = true;
      // Preserve the promise-chain boundary before the first phase so a
      // just-issued cancellation is observed before any writes are scheduled.
      await Promise.resolve();
      for (let index = 0; index < UPLOAD_PHASE_ORDER.length; index += 1) {
        if (!shouldContinue || signal?.aborted) break;
        shouldContinue = await this._executeUploadPhase(
          actions,
          result,
          UPLOAD_PHASE_ORDER[index],
          {
            checkSourceLatestBeforeWrite,
            maxConcurrent,
            signal,
            stopOnError,
          },
        );
      }

      actions.forEach((action) => {
        if (result.getStatus(action.id) !== UploadResult.Statuses.PENDING) {
          return;
        }
        if (signal?.aborted) {
          result.markCancelled(action.id);
          this._emitUploadProgress(action, {}, result);
        } else if (!shouldContinue) {
          result.markSkipped(action.id);
          this._emitUploadProgress(action, {}, result);
        }
      });

      result.finalize();
      await this._invalidateCommittedSysMeta(actions, result);
      if (result.outcome === UploadResult.Outcomes.SUCCESS) {
        await this._finalizeSuccessfulUpload(actions, result, {
          draftRevision,
          markPackageSaved,
        });
      }
      return result;
    }

    /**
     * Cancel the active upload, aborting new work where supported. In flight
     * writes are left in an unknown state and the result is marked
     * reload required; the package must be reloaded to reconcile what
     * committed.
     * @returns {boolean} Whether an upload was cancelled
     */
    cancelUpload() {
      if (!this.dataPackage.activeUpload) return false;
      this.dataPackage.activeUpload.cancelled = true;
      this.dataPackage.activeUpload.controller.abort();
      this.dataPackage.events.trigger(
        "upload:cancelled",
        this.dataPackage.activeUpload,
      );
      return true;
    }

    /**
     * Retry a failed upload without blindly repeating committed writes.
     * @param {UploadResult} previousResult Previous upload result
     * @param {object} [options] Execution options
     * @param {AbortSignal} [options.signal] Caller abort signal
     * @param {number} [options.maxConcurrent] Per phase concurrency
     * @returns {Promise<UploadResult>} Retry result
     * @throws {Error} When the result is unrelated, stale, active, or unverifiable
     */
    async retryUpload(previousResult, { signal, maxConcurrent } = {}) {
      const resolvedMaxConcurrent = Utilities.getMaxConcurrent(
        "upload",
        maxConcurrent,
      );
      if (previousResult?.dataPackage !== this.dataPackage) {
        throw new Error("Cannot retry an upload from another DataPackage");
      }
      if (
        previousResult.reloadRequired ||
        previousResult.outcome === UploadResult.Outcomes.STALE_REMOTE
      ) {
        const stale =
          previousResult.outcome === UploadResult.Outcomes.STALE_REMOTE;
        const error = new Error(
          stale
            ? "Cannot retry a stale package; reload first"
            : "Cannot retry a cancelled upload; reload first",
        );
        error.code = stale ? "stale_remote" : "reload_required";
        error.reloadRequired = true;
        throw error;
      }

      if (this.dataPackage.activeUpload) {
        throw new Error("An upload is already in progress");
      }
      this.assertUploadPreconditions({ allowAmbiguous: true });
      const { controller, cleanup } = createUploadController(signal);
      const { actions } = previousResult;
      const result = new UploadResult(actions, {
        draftRevision: previousResult.draftRevision,
        dataPackage: this.dataPackage,
      });
      this.dataPackage.activeUpload = { cancelled: false, controller };
      try {
        // Preserve the prior promise-chain yield before reconciling results.
        await Promise.resolve();
        for (let index = 0; index < actions.length; index += 1) {
          const action = actions[index];
          const status = previousResult.getStatus(action.id);
          if (status === UploadResult.Statuses.SUCCEEDED) {
            result.markSkipped(action.id);
          } else if (status === UploadResult.Statuses.AMBIGUOUS) {
            const verification = await this._verifyAmbiguousAction(
              action,
              controller.signal,
            );
            if (verification.confirmed) {
              const member = this.dataPackage.requireMember(
                action.memberPid || action.targetPid,
              );
              member.markRemoteSuccess({
                pid: action.targetPid,
                sysMeta: verification.sysMeta,
              });
              result.markSucceeded(action.id);
            } else if (!verification.notFound) {
              const error = new Error(
                `Cannot retry unresolved ambiguous write for ${action.targetPid}`,
              );
              error.code = "ambiguous_write_unresolved";
              throw error;
            } else {
              this.dataPackage
                .requireMember(action.memberPid || action.targetPid)
                .markRemoteFailure(previousResult.getError(action.id));
            }
          }
        }

        // SysMeta-only actions embed their prepared XML. If the draft changed
        // or one remains pending, rebuild the plan instead of replaying stale XML.
        const pendingSystemMetadata = actions.some(
          (action) =>
            action.operation === UPLOAD_OPERATIONS.UPDATE_SYSTEM_METADATA &&
            result.getStatus(action.id) === UploadResult.Statuses.PENDING,
        );
        if (
          previousResult.draftRevision === this.dataPackage.draftRevision &&
          !pendingSystemMetadata
        ) {
          // Await inside this try so activeUpload remains set until execution
          // and successful-finalization side effects have both completed.
          return await this._executeUploadActions(actions, {
            draftRevision: previousResult.draftRevision,
            markPackageSaved: true,
            maxConcurrent: resolvedMaxConcurrent,
            signal: controller.signal,
            stopOnError: true,
            result,
          });
        }
      } finally {
        cleanup();
        this.dataPackage.activeUpload = null;
      }
      return this.dataPackage.upload({
        signal,
        maxConcurrent: resolvedMaxConcurrent,
      });
    }

    /**
     * Execute one upload phase.
     * @param {object[]} allActions All upload actions
     * @param {UploadResult} result Mutable result
     * @param {string} phase Phase to execute
     * @param {object} [options] Phase options
     * @param {number} [options.maxConcurrent] Item concurrency cap
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {boolean} [options.stopOnError] Whether to stop scheduling after
     * the first item error
     * @param {boolean} [options.checkSourceLatestBeforeWrite] Whether to
     * confirm update sources are latest before writing
     * @returns {Promise<boolean>} True when the phase had no errors
     * @private
     */
    async _executeUploadPhase(
      allActions,
      result,
      phase,
      {
        maxConcurrent = DEFAULT_MAX_CONCURRENT,
        signal,
        stopOnError = true,
        checkSourceLatestBeforeWrite = false,
      } = {},
    ) {
      const actions = allActions.filter(
        (action) =>
          action.phase === phase &&
          result.getStatus(action.id) === UploadResult.Statuses.PENDING,
      );
      if (!actions.length) return true;

      const { errors } = await processConcurrently(
        actions,
        (action) =>
          this._executeUploadAction(action, result, signal, {
            checkSourceLatestBeforeWrite,
          }),
        { maxConcurrent, signal, stopOnError },
      );

      actions.forEach((action) => {
        if (result.getStatus(action.id) === UploadResult.Statuses.PENDING) {
          if (signal?.aborted) {
            result.markCancelled(action.id);
          } else {
            result.markSkipped(action.id);
          }
          this._emitUploadProgress(action, {}, result);
        }
      });
      return errors.length === 0 && !signal?.aborted;
    }

    /**
     * Invoke the service write for one action and record member success.
     * @param {object} action Upload action
     * @param {object} writeOptions Transport options
     * @param {DataPackageMember} member Member being written
     * @returns {Promise<void>} Resolves after the member records success
     * @private
     * @throws {Error} When the upload operation is unsupported
     */
    async _invokeWrite(action, writeOptions, member) {
      const objectService = this.dataPackage.getObjectService();
      switch (action.operation) {
        case UPLOAD_OPERATIONS.CREATE: {
          const response = await objectService.create(
            {
              pid: action.targetPid,
              object: action.payload,
              sysMetaXml: action.sysMetaXml,
              fileName: action.fileName,
            },
            writeOptions,
          );
          member.markRemoteSuccess({ response });
          break;
        }
        case UPLOAD_OPERATIONS.UPDATE: {
          const response = await objectService.update(
            {
              pid: action.sourcePid,
              newPid: action.targetPid,
              object: action.payload,
              sysMetaXml: action.sysMetaXml,
              fileName: action.fileName,
            },
            writeOptions,
          );
          member.markRemoteSuccess({ response });
          break;
        }
        case UPLOAD_OPERATIONS.UPDATE_SYSTEM_METADATA: {
          await this.dataPackage
            .getSysMetaService()
            .update(action.targetPid, action.sysMetaXml, writeOptions);
          member.markRemoteSuccess({ pid: action.targetPid });
          break;
        }
        default:
          throw new Error(`Unsupported upload operation: ${action.operation}`);
      }
    }

    /**
     * Write one action, retrying the ResourceMap write after a transient
     * failure only after verification confirms it did not commit. This avoids
     * duplicating an ambiguous success. Other actions attempt
     * exactly once and defer to action level ambiguity handling.
     * @param {object} action Upload action
     * @param {object} writeOptions Transport options
     * @param {DataPackageMember} member Member being written
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<void>} Resolves after a confirmed write
     * @private
     * @throws {Error} When the write remains unconfirmed after retries
     */
    async _writeWithRetry(action, writeOptions, member, signal) {
      const maxAttempts =
        action.phase === UPLOAD_PHASES.RESOURCE_MAP
          ? RESOURCE_MAP_WRITE_ATTEMPTS
          : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await this._invokeWrite(action, writeOptions, member);
          return;
        } catch (error) {
          const canRetry =
            attempt < maxAttempts &&
            !signal?.aborted &&
            DataONEService.isAmbiguousWriteError(error);
          // Retry only when the write provably did not commit; a committed or
          // inconclusive write must reach the ambiguous-verification path.
          if (!canRetry) throw error;
          const verification = await this._verifyAmbiguousAction(
            action,
            signal,
          );
          if (!verification.notFound) throw error;
          await abortableDelay(
            RESOURCE_MAP_RETRY_BASE_DELAY_MS * attempt,
            signal,
            UPLOAD_CANCELLED_MESSAGE,
          );
        }
      }
    }

    /**
     * Execute one upload action.
     * @param {object} action Upload action
     * @param {UploadResult} result Mutable result
     * @param {AbortSignal} signal Abort signal
     * @param {object} [options] Action options
     * @param {boolean} [options.checkSourceLatestBeforeWrite] Whether to confirm
     * update sources are latest before writing
     * @returns {Promise<void>} Resolves after action state is recorded
     * @private
     * @throws {Error} When the action fails
     */
    async _executeUploadAction(
      action,
      result,
      signal,
      { checkSourceLatestBeforeWrite = false } = {},
    ) {
      const member = this.dataPackage.requireMember(
        action.memberPid || action.targetPid,
      );
      const writeOptions = {
        transport: "xhr",
        retry: { maxRetries: 0 },
        signal,
        onUploadProgress: (event) =>
          this._emitUploadProgress(action, event, result),
      };

      result.markRunning(action.id);

      try {
        if (
          checkSourceLatestBeforeWrite &&
          action.operation === UPLOAD_OPERATIONS.UPDATE &&
          action.sourcePid
        ) {
          await this.assertLatestVersion(
            action.sourcePid,
            "upload source",
            signal,
          );
        }

        member.markRemoteUploading();
        this._emitUploadProgress(action, { loaded: 0 }, result);

        if (action.phase === UPLOAD_PHASES.RESOURCE_MAP) {
          this.assertResourceMapTargetsRemote(action);
        }

        await this._writeWithRetry(action, writeOptions, member, signal);

        result.markSucceeded(action.id);
        this._emitUploadProgress(action, {}, result);
      } catch (error) {
        const confirmed = await this._handleActionFailure(
          action,
          result,
          member,
          error,
          { signal },
        );
        this._emitUploadProgress(action, {}, result);
        if (confirmed) return;
        throw error;
      }
    }

    /**
     * Classify and record one failed write action.
     * @param {object} action Upload action
     * @param {UploadResult} result Mutable result
     * @param {DataPackageMember} member Member being uploaded
     * @param {Error} error Service error
     * @param {object} [options] Failure options
     * @param {AbortSignal} [options.signal] Upload cancellation signal
     * @returns {Promise<boolean>} Whether verification confirmed the write
     * @private
     * @throws {Error} When ambiguous write verification cannot complete
     */
    async _handleActionFailure(action, result, member, error, { signal } = {}) {
      const markCancelled = () => {
        // Cancellation leaves the remote state unknown. Rather than verifying
        // each in-flight write, mark the action cancelled; the package must be
        // reloaded to reconcile what actually committed.
        member.markRemoteFailure(error, { ambiguous: true });
        result.markCancelled(action.id);
        return false;
      };

      if (signal?.aborted) return markCancelled();

      const staleError = await this._detectStaleRemoteAction(
        action,
        error,
        signal,
      );
      if (signal?.aborted) return markCancelled();
      if (staleError) {
        member.markRemoteFailure(staleError);
        result.markStaleRemote(action.id, staleError);
        return false;
      }

      if (DataONEService.isAmbiguousWriteError(error)) {
        let verification;
        try {
          verification = await this._verifyAmbiguousAction(action, signal);
        } catch (verificationError) {
          if (isAbortError(verificationError) || signal?.aborted) {
            return markCancelled();
          }
          throw verificationError;
        }
        if (signal?.aborted) return markCancelled();
        if (verification.confirmed) {
          member.markRemoteSuccess({
            pid: action.targetPid,
            sysMeta: verification.sysMeta,
          });
          result.markSucceeded(action.id);
          return true;
        }

        member.markRemoteFailure(error, {
          ambiguous: !verification.notFound,
        });
        if (verification.notFound) {
          result.markFailed(action.id, error);
        } else {
          result.markAmbiguous(action.id, error);
        }
        return false;
      }

      member.markRemoteFailure(error);
      result.markFailed(action.id, error);
      return false;
    }

    /**
     * Verify whether an ambiguous write committed by comparing the target
     * object's checksum or intended mutable System Metadata.
     * @param {object} action Upload action
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<object>} Verification result
     * @private
     * @throws {Error} When remote verification fails
     */
    async _verifyAmbiguousAction(action, signal) {
      let sysMeta;
      try {
        sysMeta = await this.dataPackage
          .getSysMetaService()
          .download(action.targetPid, {
            useCache: false,
            signal,
          });
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw error;
        if (Number(error?.status) === 404) {
          return { confirmed: false, notFound: true };
        }
        return { confirmed: false };
      }

      const remote = sysMeta?.toJSON?.() || sysMeta || {};
      const verification = action.verification || {};
      const remoteIdentifier = Values.normalizeText(remote.identifier);
      if (remoteIdentifier !== action.targetPid) {
        return { confirmed: false };
      }

      if (action.operation === UPLOAD_OPERATIONS.UPDATE_SYSTEM_METADATA) {
        const mutableFields = verification.mutableFields || {};
        if (!Object.keys(mutableFields).length) {
          return { confirmed: false };
        }
        const matches = Object.entries(mutableFields).every(([field, value]) =>
          Values.deepEqual(remote[field], value),
        );
        if (!matches) return { confirmed: false };
        return { confirmed: true, sysMeta };
      }

      const intendedChecksum = Values.normalizeText(
        verification.checksum?.value || verification.checksum,
      );
      const remoteChecksum = Values.normalizeText(remote.checksum);
      const intendedAlgorithm = Values.normalizeText(
        verification.checksum?.algorithm || verification.checksumAlgorithm,
      )?.toUpperCase();
      const remoteAlgorithm = Values.normalizeText(
        remote.checksumAlgorithm,
      )?.toUpperCase();
      const checksumsAreComparable = Boolean(
        intendedChecksum &&
          remoteChecksum &&
          intendedAlgorithm &&
          remoteAlgorithm &&
          intendedAlgorithm === remoteAlgorithm,
      );
      // A different or missing algorithm cannot prove a mismatch. The target
      // PID still confirms the immutable object exists; compare bytes only when
      // both sides describe them with the same algorithm.
      if (checksumsAreComparable && intendedChecksum !== remoteChecksum) {
        return { confirmed: false };
      }
      return { confirmed: true, sysMeta };
    }

    /**
     * Detect a source PID that became stale between preflight and write.
     * @param {object} action Upload action
     * @param {Error} error Write error
     * @param {AbortSignal} [signal] Abort signal
     * @returns {Promise<Error|null>} Stale remote error, when detected
     * @private
     */
    async _detectStaleRemoteAction(action, error, signal) {
      if (error?.code === "stale_remote") return error;
      if (!action.sourcePid) return null;

      const obsoletingPid =
        DataPackageUploader._getObsoletingPidFromError(error);
      if (obsoletingPid && obsoletingPid !== action.targetPid) {
        return DataPackageUploader.staleRemoteError(
          action.sourcePid,
          obsoletingPid,
          "upload source",
        );
      }
      try {
        const latest = await this.dataPackage
          .getVersionTracker()
          .getLatestVersion(action.sourcePid, { useCache: false, signal });
        if (
          latest &&
          latest !== action.sourcePid &&
          latest !== action.targetPid
        ) {
          return DataPackageUploader.staleRemoteError(
            action.sourcePid,
            latest,
            "upload source",
          );
        }
      } catch (_verificationError) {
        // If the recheck itself fails, keep the original upload failure.
      }
      return null;
    }

    /**
     * Read Metacat's "previous identifier already obsolete" response.
     * @param {Error|object} error Service error
     * @returns {string|null} PID that already obsoleted the source
     * @private
     */
    static _getObsoletingPidFromError(error) {
      const name = error?.dataONEErrorName || "";
      if (name && name !== "IdentifierNotUnique" && name !== "InvalidRequest") {
        return null;
      }
      const message = Values.normalizeText(error?.message);
      const match = message.match(/made obsolete by:?\s*(\S+)/i);
      return match?.[1] || null;
    }

    /**
     * Emit package level upload preparation progress.
     * @param {string} phase Preparation phase
     * @param {number} completed Completed item count
     * @param {number} total Total item count
     * @param {string} message User facing progress message
     * @private
     */
    _emitUploadPrepareProgress(phase, completed, total, message) {
      const progress = { phase, completed, total, message };
      this.dataPackage.events.trigger("upload:prepare:progress", progress);
    }

    /**
     * Emit package level upload progress for one action.
     * @param {object} action Upload action
     * @param {ProgressEvent|object} event Progress event from the transport
     * @param {UploadResult} result Current upload result
     * @private
     */
    _emitUploadProgress(action, event = {}, result = null) {
      let total = null;
      if (typeof event.total === "number") {
        total = event.total;
      } else if (typeof action.size === "number") {
        total = action.size;
      }
      const progress = {
        actionId: action.id,
        action,
        result,
        status: result?.getStatus?.(action.id) || null,
        loaded: typeof event.loaded === "number" ? event.loaded : null,
        total,
        lengthComputable: event.lengthComputable === true,
      };
      this.dataPackage.events.trigger("upload:progress", progress);
    }

    /**
     * Promote local state after a completely successful upload.
     * @param {object[]} actions Executed actions
     * @param {UploadResult} result Successful result
     * @param {object} context Execution context
     * @param {number} context.draftRevision Prepared draft revision
     * @param {boolean} context.markPackageSaved Whether success saves the draft
     * @returns {Promise<UploadResult>} Final result
     * @private
     */
    async _finalizeSuccessfulUpload(
      actions,
      result,
      { draftRevision, markPackageSaved },
    ) {
      // A package plan has at most one root ResourceMap action. Its success is
      // the commit boundary for aggregate promotion and recovery cleanup.
      const resourceMapAction = actions.find(
        (action) => action.phase === UPLOAD_PHASES.RESOURCE_MAP,
      );
      if (resourceMapAction) {
        const resourceMap = this.dataPackage.requireResourceMapModel(
          resourceMapAction.targetPid,
        );
        this.dataPackage.rootResourceMapPid = resourceMapAction.targetPid;
        resourceMap.markSaved();
        this.dataPackage.members
          .toArray()
          .forEach((member) => member.promoteAggregatedState());
        this.dataPackage.members.purgeRemoved();

        const metadataPid =
          this.dataPackage.primaryMetadataPid ||
          this.dataPackage.getPrimaryMetadataMember()?.pid;
        if (metadataPid) {
          const resolver = new ResourceMapResolver();
          resolver
            .addToStorage(metadataPid, resourceMapAction.targetPid)
            .catch(() => {});
          await this.dataPackage.getUploadRecoveryStore().remove(metadataPid);
        }
      }

      const hasPendingWrites =
        this.dataPackage.getChangedMembers().length > 0 ||
        this.dataPackage.getResourceMapModel()?.hasUnsavedChanges?.() === true;
      if (
        markPackageSaved &&
        draftRevision === this.dataPackage.draftRevision &&
        !hasPendingWrites
      ) {
        this.dataPackage.savedRevision = this.dataPackage.draftRevision;
        this.dataPackage.metadataContentEdited = false;
      }

      this.dataPackage.events.trigger("upload:success", { actions, result });
      return result;
    }

    /**
     * Invalidate cached System Metadata for every committed write, including
     * after a partial failure. A failed plan can still commit some writes (for
     * example a system metadata update that succeeds before a later phase
     * fails); without this, other consumers would read a stale cached baseline
     * for those objects until the cache TTL expires. Best effort: a cache
     * failure must not mask or fail the upload result.
     * @param {object[]} actions Executed actions
     * @param {UploadResult} result Finalized result
     * @returns {Promise<void>} Resolves when invalidation has been attempted
     * @private
     */
    async _invalidateCommittedSysMeta(actions, result) {
      const committed = actions.filter(
        (action) =>
          result.getStatus(action.id) === UploadResult.Statuses.SUCCEEDED,
      );
      const pidsToInvalidate = Values.dedupeStrings(
        committed
          .flatMap((action) => [action.sourcePid, action.targetPid])
          .filter(Boolean),
      );
      if (!pidsToInvalidate.length) return;
      const sysMetaService = this.dataPackage.getSysMetaService();
      if (typeof sysMetaService.invalidate !== "function") return;
      await Promise.all(
        pidsToInvalidate.map((pid) =>
          Promise.resolve(sysMetaService.invalidate(pid)).catch(() => {}),
        ),
      );
    }

    /**
     * Build a durable recovery record from prepared actions, or null when the
     * plan carries no ResourceMap orphan risk (no ResourceMap write, or no
     * object write that could commit before it). RM only saves (access policy,
     * provenance) are excluded: a failed RM update leaves the prior RM
     * authoritative, so nothing is orphaned. The record stores the exact
     * ResourceMap bytes this upload will write, so a replay is byte identical
     * and includes RDF the summary projection does not model.
     * @param {object[]} actions Prepared upload actions
     * @returns {Promise<object|null>} Recovery record, or null
     * @private
     */
    async _buildRecoveryRecord(actions) {
      const rmAction = actions.find(
        (action) => action.phase === UPLOAD_PHASES.RESOURCE_MAP,
      );
      const hasObjectWrites = actions.some(
        (action) =>
          action.phase === UPLOAD_PHASES.DATA ||
          action.phase === UPLOAD_PHASES.METADATA,
      );
      const metadataPid = this.dataPackage.getPrimaryMetadataMember()?.pid;
      if (!rmAction || !hasObjectWrites || !metadataPid) return null;

      return {
        metadataPid,
        rmPid: rmAction.targetPid,
        obsoletesRmPid: rmAction.sourcePid || null,
        rmXml: await rmAction.payload.text(),
        rmSysMetaXml: rmAction.sysMetaXml,
        rmFileName: rmAction.fileName || null,
      };
    }

    /**
     * Persist a recovery record for the current upload. Best effort: a storage
     * failure must never fail the upload.
     * @param {object[]} actions Prepared upload actions
     * @returns {Promise<void>} Resolves when persistence has been attempted
     * @private
     */
    async _persistRecoveryRecord(actions) {
      try {
        const record = await this._buildRecoveryRecord(actions);
        if (!record) return;
        await this.dataPackage
          .getUploadRecoveryStore()
          .save(record.metadataPid, record);
      } catch (_error) {
        // Recovery is best-effort; never block the upload on it.
      }
    }

    /**
     * Build a stale remote error for a source PID superseded remotely.
     * @param {string} pid Source PID
     * @param {string} latestPid Latest version PID
     * @param {string} context Error context
     * @returns {Error} Stale remote error
     * @private
     */
    static staleRemoteError(pid, latestPid, context) {
      const error = new Error(
        `Cannot upload: ${context} "${pid}" has been superseded remotely by "${latestPid}"`,
      );
      error.code = "stale_remote";
      error.pid = pid;
      error.latestPid = latestPid;
      error.reloadRequired = true;
      return error;
    }

    /**
     * Build a validation failure error.
     * @param {object[]} issues Validation issues
     * @returns {Error} Validation failure error
     * @private
     */
    static validationError(issues) {
      const error = new Error("Cannot upload: validation failed");
      error.code = "validation_failure";
      error.issues = Values.listify(issues);
      return error;
    }

    /**
     * Build an unauthorized error for unwritable source PIDs.
     * @param {string[]} pids Source PIDs the user cannot write
     * @returns {Error} Unauthorized error
     * @private
     */
    static unauthorizedError(pids) {
      const error = new Error(
        `Cannot upload: not authorized to update ${pids.join(", ")}`,
      );
      error.code = "unauthorized";
      error.pids = pids;
      return error;
    }
  }

  return DataPackageUploader;
});

/* eslint-enable no-await-in-loop */
