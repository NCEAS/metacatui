"use strict";

define([
  "backbone",
  "common/ErrorUtilities",
  "common/Utilities",
  "common/ValueUtilities",
  "models/dataONEServices/DataONEService",
  "models/dataONEServices/AuthorizationService",
  "models/dataONEServices/IdentifierService",
  "models/dataONEServices/ObjectService",
  "models/dataONEServices/PublishService",
  "models/dataONEServices/SysMetaService",
  "models/sysmeta/AccessPolicy",
  "models/sysmeta/VersionTracker",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapResolver",
  "models/dataPackage/DataPackageMember",
  "models/dataPackage/DataPackageMembers",
  "models/dataPackage/DataPackageLoader",
  "models/dataPackage/DataPackageUploader",
  "models/dataPackage/UploadRecoveryStore",
  "collections/ObjectFormats",
], (
  Backbone,
  ErrorUtilities,
  Utilities,
  Values,
  DataONEService,
  AuthorizationService,
  IdentifierService,
  ObjectService,
  PublishService,
  SysMetaService,
  AccessPolicy,
  VersionTracker,
  ResourceMap,
  ResourceMapResolver,
  DataPackageMember,
  DataPackageMembers,
  DataPackageLoader,
  DataPackageUploader,
  UploadRecoveryStore,
  ObjectFormats,
) => {
  const { FORMAT_TYPES } = ObjectFormats.prototype;
  const { DEFAULT_MAX_CONCURRENT, processConcurrently } = Utilities;
  const { throwIfAborted } = ErrorUtilities;
  const LOAD_PROGRESS_MESSAGES = Object.freeze({
    [DataPackageLoader.LoadPhases.OBJECT_FORMATS]:
      "Loading file format information...",
    [DataPackageLoader.LoadPhases.RESOLVE]:
      "Find the files that belong to this package...",
    [DataPackageLoader.LoadPhases.RESOURCE_MAP_MEMBERSHIP]:
      "Loading the file list...",
    [DataPackageLoader.LoadPhases.RESOURCE_MAP_DOWNLOAD]:
      "Downloading the file list...",
    [DataPackageLoader.LoadPhases.RESOURCE_MAP_SUMMARY]:
      "Reading the file list summary...",
    [DataPackageLoader.LoadPhases.INDEX_MANIFEST]:
      "Searching for information about the files in this package...",
    [DataPackageLoader.LoadPhases.MISSING_SYSTEM_METADATA]:
      "Loading extra information about the files in this package...",
    [DataPackageLoader.LoadPhases.EDITABLE_BASELINE]:
      "Preparing the package for editing...",
    [DataPackageLoader.LoadPhases.EDITABLE_METADATA]:
      "Loading metadata for editing...",
  });

  /**
   * Manage the members, resource map, edits, and uploads for a DataONE data
   * package.
   * @class DataPackage
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  class DataPackage {
    /**
     * Create a data package.
     * @param {object} [options] Initial package state and service overrides
     * @param {ObjectFormats} [options.objectFormats] Loaded object format
     * collection used to classify members
     * @param {DataPackageMember|object|Array<DataPackageMember|object>} [options.members]
     * Members used to seed the package
     * @param {string[]} [options.sources] Source tags applied to the initial
     * members
     * @param {string} [options.primaryMetadataPid] PID of the package's primary
     * metadata member
     * @param {string} [options.rootResourceMapPid] PID of the package's root
     * ResourceMap
     * @param {IdentifierService} [options.identifierService] Identifier
     * allocation service
     * @param {object} [options.identifierServiceOptions] Options used to create
     * the identifier service when one is not provided
     * @param {ObjectService} [options.objectService] Object read and write
     * service
     * @param {object} [options.objectServiceOptions] Options used to create the
     * object service when one is not provided
     * @param {SysMetaService} [options.sysMetaService] System metadata service
     * @param {object} [options.sysMetaServiceOptions] Options used to create the
     * system metadata service when one is not provided
     * @param {VersionTracker} [options.versionTracker] Version tracker used for
     * stale source checks
     * @param {object} [options.versionTrackerOptions] Options used to create the
     * version tracker when one is not provided
     * @param {AuthorizationService} [options.authorizationService] Service used
     * for write permission checks
     * @param {object} [options.authorizationServiceOptions] Options used to
     * create the authorization service when one is not provided
     * @param {UploadRecoveryStore} [options.uploadRecoveryStore] Durable upload
     * recovery record store
     * @param {object} [options.uploadDefaults] Default System Metadata values
     * for newly uploaded objects
     */
    constructor(options = {}) {
      this.type = "DataPackage";
      this.events = { ...Backbone.Events };
      // Loaded ObjectFormats collection, injected into members so they can
      // classify their format type synchronously. Loaded lazily (and once) via
      // ensureObjectFormats() before any member manifest is parsed.
      this.objectFormats = options.objectFormats || null;
      this.members = new DataPackageMembers(this.objectFormats, this.events);
      // For storing the PID or SID originally passed to resolveFromPid()
      this.inputId = null;
      this.primaryMetadataPid =
        Values.normalizeText(options.primaryMetadataPid) || null;
      this.rootResourceMapPid =
        Values.normalizeText(options.rootResourceMapPid) || null;
      this.resolutionResult = null;
      this.draftRevision = 0;
      this.savedRevision = 0;
      // True when EML/metadata content has been edited since the last save. Set
      // by recordUserEdit("metadata:changed"), read via
      // hasMetadataContentEdits(), and cleared on a successful save. Legacy EML
      // editor views/models flag edits through
      // EMLUtilities.markRootDataPackageChanged().
      this.metadataContentEdited = false;
      this.identifierService = options.identifierService || null;
      this.identifierServiceOptions = options.identifierServiceOptions || {};
      this.objectService = options.objectService || null;
      this.objectServiceOptions = options.objectServiceOptions || {};
      this.sysMetaService = options.sysMetaService || null;
      this.sysMetaServiceOptions = options.sysMetaServiceOptions || {};
      this.versionTracker = options.versionTracker || null;
      this.versionTrackerOptions = options.versionTrackerOptions || {};
      this.authorizationService = options.authorizationService || null;
      this.authorizationServiceOptions =
        options.authorizationServiceOptions || {};
      // Browser storage for upload recovery records, so a crash between
      // "metadata committed" and "ResourceMap committed" can be repaired on the
      // next load.
      this.uploadRecoveryStore = options.uploadRecoveryStore || null;
      this.uploadDefaults = options.uploadDefaults || {};
      // Member-keyed records for background uploads started when files are added.
      this.eagerUploads = new Map();
      // Set while a full or ResourceMap-only upload is being prepared or run.
      this.activeUpload = null;
      this._uploader = new DataPackageUploader({ dataPackage: this });
      const addOptions = {};
      if (options.sources) {
        addOptions.sources = options.sources;
      }
      if (options.members) {
        this.members.add(options.members, addOptions);
      }
    }

    // See DataPackageLoader.reportLoadProgress().
    async reportLoadProgress(phase, details = {}) {
      return DataPackageLoader.reportLoadProgress(this, phase, details);
    }

    // See DataPackageLoader.ensureObjectFormats().
    async ensureObjectFormats() {
      return DataPackageLoader.ensureObjectFormats(this);
    }

    // See DataPackageLoader.resolveFromPid().
    async resolveFromPid(pid, options = {}) {
      return DataPackageLoader.resolveFromPid(this, pid, options);
    }

    // See DataPackageLoader.loadEditablePackage().
    async loadEditablePackage(pid, options = {}) {
      return DataPackageLoader.loadEditablePackage(this, pid, options);
    }

    /**
     * Initialize existing package members for editing after a read-only load.
     * Members without editable state are marked as already stored and aggregated
     * under their current PIDs. Existing editable state is preserved.
     * @returns {DataPackage} This package
     */
    initializeLoadedMembersForEditing() {
      this.members.toArray().forEach((member) => {
        if (member.remotePid) return;
        member.initializeEditableState({
          remotePid: member.pid,
          aggregatedPid: member.pid,
          sysMeta: member.sysMeta,
          remoteSysMeta: member.sysMeta,
        });
      });
      return this;
    }

    // See DataPackageLoader.getManifest().
    async getManifest(options = {}) {
      return DataPackageLoader.getManifest(this, options);
    }

    // See DataPackageLoader.getManifestFromIndex().
    async getManifestFromIndex(options = {}) {
      return DataPackageLoader.getManifestFromIndex(this, options);
    }

    // See DataPackageLoader.loadNestedPackageTitles().
    async loadNestedPackageTitles(options = {}) {
      return DataPackageLoader.loadNestedPackageTitles(this, options);
    }

    // See DataPackageMembers.getMetadata().
    getMetadataMembers() {
      return this.members.getMetadata();
    }

    /**
     * Return the primary metadata member for the package.
     * @returns {DataPackageMember|null} Primary metadata member, or null
     * when the package aggregates no metadata
     */
    getPrimaryMetadataMember() {
      const metadataMembers = this.members.getMetadata();
      if (!metadataMembers.length) return null;
      if (this.primaryMetadataPid) {
        const primaryMetadata = metadataMembers.find(
          (member) => member.pid === this.primaryMetadataPid,
        );
        if (primaryMetadata) return primaryMetadata;
      }
      return metadataMembers.length === 1 ? metadataMembers[0] : null;
    }

    // See DataPackageMembers.getData().
    getData() {
      return this.members.getData();
    }

    /**
     * Return ResourceMap members aggregated by the root ResourceMap.
     * @returns {DataPackageMember[]} Nested ResourceMap members
     */
    getNestedResourceMapMembers() {
      const rootResourceMap = this.getRootResourceMapMember();
      return this.members
        .getResourceMaps()
        .filter((member) => member !== rootResourceMap && !member.removed);
    }

    /**
     * Return the resource map member for the package. Returns only the root
     * resource map in case there are nested resource maps.
     * @returns {DataPackageMember|null} Root resource map member, or null when
     * the package does not aggregate any resource maps
     */
    getRootResourceMapMember() {
      const resourceMapMembers = this.members.getResourceMaps();
      if (!resourceMapMembers.length) return null;
      if (this.rootResourceMapPid) {
        const rootResourceMap = resourceMapMembers.find(
          (member) => member.pid === this.rootResourceMapPid,
        );
        if (rootResourceMap) return rootResourceMap;
      }
      return resourceMapMembers.length === 1 ? resourceMapMembers[0] : null;
    }

    /**
     * Return the parsed {@link ResourceMap} model for a resource map member,
     * when that member's object has been fetched and parsed.
     * @param {string} [resourceMapPid] Resource map PID. Defaults to the root
     * resource map
     * @returns {ResourceMap|null} Parsed ResourceMap model, or null
     */
    getResourceMapModel(resourceMapPid = this.rootResourceMapPid) {
      const member = resourceMapPid
        ? this.getMember(resourceMapPid)
        : this.getRootResourceMapMember();
      return member?.objectModel || null;
    }

    // See DataPackageMembers.get().
    getMember(pid) {
      return this.members.get(pid);
    }

    // See DataPackageMembers.toArray().
    toArray() {
      return this.members.toArray();
    }

    /**
     * Return whether the package has edits newer than its last successful save.
     * @returns {boolean} Whether the package has unsaved changes
     */
    hasUnsavedChanges() {
      return (
        this.draftRevision !== this.savedRevision ||
        this.getChangedMembers().length > 0 ||
        this.getResourceMapModel()?.hasUnsavedChanges?.() === true ||
        this.metadataContentEdited === true
      );
    }

    /**
     * Return whether EML/metadata content has been edited since the last save.
     * Legacy EML editor views/models flag these edits via
     * EMLUtilities.markRootDataPackageChanged().
     * @returns {boolean} Whether metadata content has unsaved edits
     */
    hasMetadataContentEdits() {
      return this.metadataContentEdited === true;
    }

    /**
     * Return whether a full package save is queued, preparing, or executing.
     * Background eager uploads do not lock editing.
     * @returns {boolean} Whether package edits are locked
     */
    isEditLocked() {
      return this.activeUpload !== null;
    }

    /**
     * Reject a package edit while a full save is queued or active, or a member
     * edit while that member is uploading eagerly.
     * @param {string} [memberPid] Member being edited
     * @returns {true} True when editing is allowed
     * @throws {Error} With `code === "upload_in_progress"` while locked
     */
    assertCanEdit(memberPid) {
      const memberUploadPending = this.eagerUploads.has(memberPid);
      if (!this.isEditLocked() && !memberUploadPending) return true;
      const error = new Error(
        memberUploadPending
          ? "Cannot edit a file while it is uploading"
          : "Cannot edit a package while an upload is in progress",
      );
      error.code = "upload_in_progress";
      throw error;
    }

    /**
     * Reserve a new PID for a package member, or confirm a requested PID is
     * available.
     * @param {object} [options] Allocation options
     * @param {string} [options.requestedPid] Custom PID to reserve
     * @param {boolean} [options.resourceMap] Allocate a ResourceMap PID
     * @returns {Promise<string>} Allocated PID
     * @throws {Error} When allocation fails or the reserved PID does not match
     */
    async allocatePid({ requestedPid, resourceMap = false } = {}) {
      const customPid = Values.normalizeText(requestedPid);
      if (customPid) {
        if (!this.identifierService) {
          this.identifierService = new IdentifierService(
            this.identifierServiceOptions,
          );
        }
        const response =
          await this.identifierService.reserveIdentifier(customPid);
        if (response?.data?.identifier !== customPid) {
          throw new Error("Reserved identifier does not match requested PID");
        }
        return customPid;
      }

      const prefix = resourceMap ? ResourceMap.RESOURCE_MAP_PID_PREFIX : "";
      return Values.makeUUID({ prefix });
    }

    /**
     * Assign a PID to a new member when it does not already have one.
     * @param {DataPackageMember} member Member to assign
     * @param {object} [options] Allocation options
     * @returns {Promise<string>} Desired PID
     */
    async assignNewMemberPid(member, options = {}) {
      if (member.pid) return member.pid;
      const pid = await this.allocatePid(options);
      member.setDesiredPid(pid);
      return pid;
    }

    /**
     * Assign one stable replacement PID to an existing member.
     * @param {DataPackageMember} member Member being replaced
     * @param {object} [options] Allocation options
     * @returns {Promise<string>} Desired replacement PID
     */
    async assignReplacementPid(member, options = {}) {
      if (member.remotePid && member.pid !== member.remotePid)
        return member.pid;
      const oldPid = member.pid;
      const wasPrimaryMetadata =
        member.isMetadata() && this.getPrimaryMetadataMember() === member;
      const wasRootResourceMap =
        member.isResourceMap() && this.getRootResourceMapMember() === member;
      const pid = await this.allocatePid(options);
      if (this.members.get(oldPid) === member) {
        this.members.replacePid(oldPid, pid);
      } else {
        member.setDesiredPid(pid);
      }
      if (wasPrimaryMetadata) this.primaryMetadataPid = pid;
      if (wasRootResourceMap) this.rootResourceMapPid = pid;
      return pid;
    }

    /**
     * Ensure changed metadata has its final desired upload PID.
     * @param {DataPackageMember} member Metadata member
     * @returns {Promise<string>} Desired PID
     * @throws {Error} When changed metadata has no replacement PID
     */
    async ensureMetadataUploadPid(member) {
      if (
        member.contentDirty &&
        member.remotePid &&
        member.pid === member.remotePid
      ) {
        throw new Error(
          "Metadata replacement PID must be assigned when content changes",
        );
      }
      return member.pid || this.assignNewMemberPid(member);
    }

    /**
     * Ensure the ResourceMap has its final desired upload PID.
     * @param {DataPackageMember} member ResourceMap member
     * @returns {Promise<string>} Desired PID
     */
    async ensureResourceMapUploadPid(member) {
      this.assertNotNestedResourceMap(member);
      const wasRootResourceMap = this.getRootResourceMapMember() === member;
      const pid = member.remotePid
        ? this.assignReplacementPid(member, { resourceMap: true })
        : this.assignNewMemberPid(member, { resourceMap: true });
      const desiredPid = await pid;
      if (wasRootResourceMap) this.rootResourceMapPid = desiredPid;
      member.objectModel?.setResourceMapPid?.(desiredPid);
      return desiredPid;
    }

    /**
     * Stage local files in the in-memory member collection and assign their
     * PIDs. Staged members can be rendered by the editor, but are not yet
     * aggregated by the ResourceMap, recorded as `members:add`, or uploaded.
     * @param {File[]|Blob[]} files Files to add
     * @param {object} [options] Edit options
     * @param {string[]} [options.requestedPids] Optional custom PIDs by index
     * @returns {Promise<DataPackageMember[]>} In-memory members awaiting
     * ResourceMap linking
     */
    async stageLocalFiles(files, { requestedPids = [] } = {}) {
      this.assertCanEdit();

      const fileList = Values.listify(files);
      if (!fileList.length) return [];
      const addedMembers = fileList.map((file) => {
        const member = new DataPackageMember({
          formatType: FORMAT_TYPES.DATA,
          formatId: file.type || "application/octet-stream",
          fileName: file.name,
        });
        member.setLocalFile(file);
        return member;
      });
      const pids = await Promise.all(
        fileList.map((file, index) =>
          this.allocatePid({ requestedPid: requestedPids[index] }),
        ),
      );
      this.assertCanEdit();
      // Make provisional rows available before linking starts eager uploads.
      addedMembers.forEach((member, index) => {
        member.setDesiredPid(pids[index]);
        this.members.add(member, { merge: false });
      });
      return addedMembers;
    }

    /**
     * Add staged members to the editable package by aggregating them in the
     * ResourceMap. This records the package edit and starts eager object
     * uploads. Membership becomes durable when the ResourceMap is saved.
     * @param {DataPackageMember[]} addedMembers Staged members to link
     * @param {object} [options] Edit options
     * @param {string} [options.metadataPid] Metadata member documenting files
     * @param {string} [options.atLocation] Folder path to store in the
     * ResourceMap `prov:atLocation` value
     * @returns {Promise<DataPackageMember[]>} Locally added package members
     * @throws {Error} When the requested links cannot be applied atomically
     */
    async linkStagedFiles(addedMembers, { metadataPid, atLocation } = {}) {
      this.assertCanEdit();

      const resourceMap = this.requireResourceMapModel();
      const stagedMembers = Values.listify(addedMembers).filter(
        (member) => member && !member.removed,
      );
      if (!stagedMembers.length) return [];
      const folderPath = (Values.normalizeText(atLocation) || "").replace(
        /\/+$/,
        "",
      );
      const previousPids = resourceMap.getMemberPids();
      const previousLinks = resourceMap.getDocumentationLinks();
      const previousResourceMapUnsavedChanges = resourceMap.hasUnsavedChanges();

      try {
        const documentingPid =
          metadataPid || this.getPrimaryMetadataMember()?.pid;
        if (documentingPid) {
          const metadata = this.requireMember(documentingPid);
          const inheritAccessPolicy =
            globalThis.MetacatUI?.appModel?.get?.("inheritAccessPolicy") !==
            false;
          const inheritedAccessPolicy = inheritAccessPolicy
            ? (metadata.sysMeta || metadata.remoteSysMeta)?.accessPolicy
            : null;
          if (inheritedAccessPolicy) {
            const accessPolicy = AccessPolicy.fromValue(
              inheritedAccessPolicy,
            ).toJSON();
            stagedMembers.forEach((addedMember) => {
              const values = addedMember.sysMeta?.toJSON?.() || {};
              values.accessPolicy = accessPolicy;
              addedMember.setSystemMetadata(values, { markDirty: true });
              Object.assign(addedMember, { accessPolicyDirty: true });
            });
          }
        }
        const nextPids = Values.dedupeStrings([
          ...previousPids,
          ...stagedMembers.map((member) => member.pid),
        ]);
        const nextLinks = [
          ...previousLinks,
          ...(documentingPid
            ? stagedMembers.map((member) => ({
                metadataPid: documentingPid,
                dataPid: member.pid,
              }))
            : []),
        ];
        // ResourceMap aggregation is the local package-membership boundary.
        resourceMap.setPackageStructure(nextPids, nextLinks);
        if (folderPath) {
          resourceMap.setMemberLocations(
            stagedMembers.map((member) => {
              const fileName = member.fileName || member.pid;
              return {
                pid: member.pid,
                atLocations: [`${folderPath}/${fileName}`],
              };
            }),
          );
        }
        this.refreshMemberGraphFields(resourceMap);
      } catch (error) {
        stagedMembers.forEach((member) => this.members.remove(member.pid));
        try {
          resourceMap.setPackageStructure(previousPids, previousLinks);
          // setPackageStructure marks successful mutations dirty; restore the
          // pre-add state after rolling back this failed add.
          resourceMap.unsavedChanges = previousResourceMapUnsavedChanges;
        } catch (restoreError) {
          error.rollbackError = restoreError;
        }
        this.refreshMemberGraphFields(resourceMap);
        throw error;
      }

      // Objects may upload eagerly, but membership is not durable until the
      // ResourceMap is saved.
      this.recordUserEdit("members:add", { members: stagedMembers });
      this._uploader.uploadAddedMembers(stagedMembers).catch(() => {});
      return stagedMembers;
    }

    /**
     * Replace a member's content and desired PID as one transaction.
     * @param {string} pid Current member PID
     * @param {Blob|File} file Replacement content
     * @param {object} [options] Edit options
     * @param {string} [options.requestedPid] Optional custom replacement PID
     * @param {string} [options.replacementSourcePid] Remote PID to obsolete
     * @returns {Promise<DataPackageMember>} Replaced member
     * @throws {Error} When the replacement is invalid or cannot be applied atomically
     */
    async replaceFile(pid, file, { requestedPid, replacementSourcePid } = {}) {
      this.assertCanEdit(pid);
      const member = this.requireMember(pid);
      const resourceMap = this.requireResourceMapModel();
      DataPackageMember.validateLocalFile(file);
      const replacementSource =
        Values.normalizeText(replacementSourcePid) || null;
      const metadataMembers = this.getMetadataMembers().filter(
        (metadataMember) =>
          metadataMember.objectModel?.replaceMemberPid &&
          metadataMember.pid !== member.pid,
      );
      await this._ensureSystemMetadata([member, ...metadataMembers]);
      this.assertNotNestedResourceMap(member);
      let replacementSourceSysMeta = null;
      if (replacementSource) {
        replacementSourceSysMeta =
          replacementSource === member.remotePid && member.remoteSysMeta
            ? member.remoteSysMeta.clone()
            : await this.getSysMetaService().download(replacementSource, {
                useCache: false,
              });
      }
      const newPid = await this.allocatePid({ requestedPid });
      if (newPid === pid) {
        throw new Error("Replacement PID must differ from the current PID");
      }
      const metadataPidChanges = await Promise.all(
        metadataMembers.map(async (metadataMember) => ({
          member: metadataMember,
          oldPid: metadataMember.pid,
          newPid:
            metadataMember.remotePid &&
            metadataMember.pid === metadataMember.remotePid
              ? await this.allocatePid()
              : metadataMember.pid,
        })),
      );
      this.assertCanEdit();
      [member, ...metadataMembers].forEach((affectedMember) =>
        this.assertCanEdit(affectedMember.pid),
      );
      const formatProperties = member.getFormatProperties?.() || {};
      const replacementDisplay = {
        pid,
        fileName: member.getFileName?.() || member.fileName || null,
        title: member.title || "",
        size: member.size,
        formatType: member.getFormatType?.() || member.formatType || null,
        formatId: member.getFormatId?.() || member.formatId || null,
        mediaType: formatProperties.mediaType || member.mediaType || null,
        atLocations: Array.isArray(member.atLocations)
          ? [...member.atLocations]
          : member.atLocations,
      };
      // Snapshot the current state of the member and any metadata members that
      // will be updated, so we can restore them if the replacement fails.
      const memberSnapshots = this.constructor._snapshotMembers(
        [member, ...metadataMembers],
        // Only snapshot the fields that will be changed by the replacement, so
        // we can restore them without overwriting any other edits that may have
        // occurred in the meantime.
        [
          "uploadFile",
          "contentDirty",
          "removed",
          "remoteState",
          "remotePid",
          "aggregatedPid",
          "size",
          "fileName",
          "_replacementDisplay",
          "_replacementSourcePid",
          "_replacementSourceSysMeta",
        ],
      );
      const updatedMetadataModels = [];
      const previousPrimaryMetadataPid = this.primaryMetadataPid;
      const previousRootResourceMapPid = this.rootResourceMapPid;

      try {
        this.constructor._mutateResourceMap(resourceMap, () => {
          this._changeMemberPid(member, newPid);
          metadataPidChanges.forEach((metadataPidChange) => {
            const replacements = this._updateMetadataMemberReferences(
              metadataPidChange.member,
              pid,
              newPid,
            );
            if (replacements) {
              const metadataMember = metadataPidChange.member;
              updatedMetadataModels.push(metadataMember.objectModel);
              metadataMember.contentDirty = true;
              metadataMember.remoteState =
                DataPackageMember.RemoteState.PENDING;
              if (metadataPidChange.oldPid !== metadataPidChange.newPid) {
                this._changeMemberPid(metadataMember, metadataPidChange.newPid);
              }
            }
          });
          member._replacementDisplay = replacementDisplay;
          member._replacementSourcePid = replacementSource;
          member._replacementSourceSysMeta =
            replacementSourceSysMeta?.clone?.() ||
            replacementSourceSysMeta ||
            null;
          member.setLocalFile(file);
        });
      } catch (error) {
        updatedMetadataModels.reverse().forEach((model) => {
          model.replaceMemberPid(newPid, pid);
        });
        this.primaryMetadataPid = previousPrimaryMetadataPid;
        this.rootResourceMapPid = previousRootResourceMapPid;
        this._restoreMemberSnapshots(memberSnapshots);
        this.refreshMemberGraphFields(resourceMap);
        throw error;
      }

      this.refreshMemberGraphFields(resourceMap);
      this.recordUserEdit("member:replace", { member, oldPid: pid, newPid });
      // Eagerly upload the replaced content so the file table can show progress
      // and settle the row instead of leaving the member PENDING until the next
      // full package save. The eager path builds an UPDATE action when the
      // member has a remotePid, obsoleting the old version.
      this._uploader.uploadAddedMembers([member]).catch(() => {});
      return member;
    }

    /**
     * Discard a failed file replacement and restore the current remote file.
     * @param {string} pid Replacement PID currently assigned to the member
     * @returns {DataPackageMember} Restored member
     * @throws {Error} When the original member state cannot be restored
     */
    discardFileReplacement(pid) {
      this.assertCanEdit(pid);
      const member = this.requireMember(pid);
      if (
        !member.isData() ||
        !member.remotePid ||
        member.pid === member.remotePid
      ) {
        return member;
      }

      const replacementPid = member.pid;
      const { remotePid } = member;
      const resourceMap = this.requireResourceMapModel();
      const metadataMembers = this.getMetadataMembers().filter(
        (metadataMember) =>
          metadataMember.objectModel?.replaceMemberPid &&
          metadataMember.pid !== member.pid,
      );
      const memberSnapshots = this.constructor._snapshotMembers(
        [member, ...metadataMembers],
        [
          "uploadFile",
          "contentDirty",
          "sysMetaDirty",
          "accessPolicyDirty",
          "remoteState",
          "lastUploadError",
          "sysMeta",
          "fileName",
          "size",
          "checksum",
          "checksumAlgorithm",
          "_replacementDisplay",
          "_replacementSourcePid",
          "_replacementSourceSysMeta",
        ],
      );
      const updatedMetadataModels = [];

      try {
        this.constructor._mutateResourceMap(resourceMap, () => {
          this._changeMemberPid(member, remotePid);
          metadataMembers.forEach((metadataMember) => {
            const replacements = this._updateMetadataMemberReferences(
              metadataMember,
              replacementPid,
              remotePid,
            );
            if (replacements) {
              updatedMetadataModels.push(metadataMember.objectModel);
              Object.assign(metadataMember, {
                contentDirty: true,
                remoteState: DataPackageMember.RemoteState.PENDING,
              });
            }
          });
          const remoteSysMeta = member.remoteSysMeta?.toJSON?.() || null;
          member.uploadFile = null;
          member.contentDirty = false;
          member.sysMeta = member.remoteSysMeta?.clone?.() || null;
          member.sysMetaDirty = false;
          member.accessPolicyDirty = false;
          if (remoteSysMeta) {
            member.fileName = remoteSysMeta.fileName || null;
            member.size = remoteSysMeta.size;
            member.checksum = remoteSysMeta.checksum || null;
            member.checksumAlgorithm = remoteSysMeta.checksumAlgorithm || null;
          }
          member.remoteState = DataPackageMember.RemoteState.UPLOADED;
          member.lastUploadError = null;
          member._replacementDisplay = null;
          member._replacementSourcePid = null;
          member._replacementSourceSysMeta = null;
        });
      } catch (error) {
        updatedMetadataModels.reverse().forEach((model) => {
          model.replaceMemberPid(remotePid, replacementPid);
        });
        this._restoreMemberSnapshots(memberSnapshots);
        this.refreshMemberGraphFields(resourceMap);
        throw error;
      }

      this.refreshMemberGraphFields(resourceMap);
      this.recordUserEdit("member:discard-replacement", {
        member,
        oldPid: replacementPid,
        restoredPid: remotePid,
      });
      return member;
    }

    /**
     * Mark members removed from the desired package.
     * @param {string|string[]} pids Member PIDs
     * @returns {DataPackageMember[]} Removed members
     * @throws {Error} When removal would invalidate the package or graph
     */
    async removeMembers(pids) {
      this.assertCanEdit();
      const memberPids = Values.listify(pids);
      memberPids.forEach((pid) => this.assertCanEdit(pid));
      const removed = memberPids.map((pid) => this.requireMember(pid));
      if (!removed.length) return [];
      const rootResourceMap = this.getRootResourceMapMember();
      // Do not allow removal of the root ResourceMap or primary metadata
      if (rootResourceMap && removed.includes(rootResourceMap)) {
        const error = new Error(
          "The root ResourceMap cannot be removed from its package",
        );
        error.code = "root_resource_map_removal_unsupported";
        throw error;
      }
      const primaryMetadata = this.getPrimaryMetadataMember();
      if (primaryMetadata && removed.includes(primaryMetadata)) {
        const error = new Error(
          "The primary metadata cannot be removed from its package",
        );
        error.code = "primary_metadata_removal_unsupported";
        throw error;
      }
      const resourceMap = this.requireResourceMapModel();
      const metadataChanges = await Promise.all(
        this.getMetadataMembers().map(async (metadataMember) => {
          const entities = removed
            .map((member) => metadataMember.objectModel?.getEntity?.(member))
            .filter(Boolean);
          if (!entities.length) return null;
          return {
            member: metadataMember,
            oldPid: metadataMember.pid,
            newPid:
              metadataMember.remotePid &&
              metadataMember.pid === metadataMember.remotePid
                ? await this.allocatePid()
                : metadataMember.pid,
            entities,
          };
        }),
      );
      const affectedMetadata = metadataChanges.filter(Boolean);
      this.assertCanEdit();
      [...removed, ...affectedMetadata.map(({ member }) => member)].forEach(
        (affectedMember) => this.assertCanEdit(affectedMember.pid),
      );
      const memberSnapshots = this.constructor._snapshotMembers(
        [...removed, ...affectedMetadata.map((p) => p.member)],
        ["contentDirty", "removed", "remoteState"],
      );
      const previousPrimaryMetadataPid = this.primaryMetadataPid;
      const previousRootResourceMapPid = this.rootResourceMapPid;
      try {
        this.constructor._mutateResourceMap(resourceMap, () => {
          removed.forEach((member) => member.markRemoved());
          affectedMetadata.forEach(({ member, oldPid, newPid, entities }) => {
            if (oldPid !== newPid) this._changeMemberPid(member, newPid);
            entities.forEach((entity) =>
              member.objectModel.removeEntity(entity),
            );
            Object.assign(member, {
              contentDirty: true,
              remoteState: DataPackageMember.RemoteState.PENDING,
            });
          });
          resourceMap.removeMembers(removed.map((member) => member.pid));
        });
      } catch (error) {
        affectedMetadata.forEach(({ member, oldPid, entities }) => {
          entities.forEach((entity) => member.objectModel.addEntity(entity));
          if (
            member.pid !== oldPid &&
            this.members.get(member.pid) === member
          ) {
            this.members.replacePid(member.pid, oldPid);
          }
        });
        this.primaryMetadataPid = previousPrimaryMetadataPid;
        this.rootResourceMapPid = previousRootResourceMapPid;
        this._restoreMemberSnapshots(memberSnapshots);
        this.refreshMemberGraphFields(resourceMap);
        throw error;
      }
      this.refreshMemberGraphFields(resourceMap);
      this.recordUserEdit("members:remove", { members: removed });
      return removed;
    }

    /**
     * Replace the ResourceMap location for a package member.
     * @param {string} pid Member PID
     * @param {string} path Raw location path
     * @returns {DataPackageMember} Updated member
     */
    setMemberLocation(pid, path) {
      this.assertCanEdit(pid);
      const member = this.requireMember(pid);
      const resourceMap = this.requireResourceMapModel();
      const location = Values.normalizeText(path);

      resourceMap.setMemberLocations([
        { pid: member.pid, atLocations: location ? [location] : [] },
      ]);

      this.refreshMemberGraphFields(resourceMap);
      this.recordUserEdit("member:location", { member, path: location });
      return member;
    }

    /**
     * Rename a member's display file name and matching ResourceMap locations.
     * @param {string} pid Member PID
     * @param {string} fileName New file name
     * @returns {Promise<DataPackageMember>} Updated member
     * @throws {Error} When the requested file name is empty
     */
    async renameMemberFile(pid, fileName) {
      this.assertCanEdit(pid);
      const member = this.requireMember(pid);
      const nextFileName = Values.normalizeText(fileName);
      if (!nextFileName) {
        throw new Error("File name is required");
      }

      await this._ensureSystemMetadata([member]);
      this.assertNotNestedResourceMap(member);
      this.assertCanEdit(member.pid);

      const previousFileName = Values.normalizeText(member.getFileName()) || "";
      const locations = member.atLocations || [];
      // Locations are arbitrary RDF values, not normalized filesystem paths.
      // Rewrite only a matching filename suffix and preserve every prefix/value.
      const nextLocations = previousFileName
        ? locations.map((location) => {
            if (
              location !== previousFileName &&
              !location.endsWith(`/${previousFileName}`)
            ) {
              return location;
            }
            return `${location.slice(0, -previousFileName.length)}${nextFileName}`;
          })
        : locations;
      const locationsChanged = nextLocations.some(
        (location, index) => location !== locations[index],
      );

      member.fileName = nextFileName;
      if (member.sysMeta) {
        const sysMeta = member.sysMeta.clone();
        sysMeta.fileName = nextFileName;
        member.setSystemMetadata(sysMeta, { markDirty: true });
      }
      if (locationsChanged) {
        const resourceMap = this.requireResourceMapModel();
        resourceMap.setMemberLocations([
          { pid: member.pid, atLocations: nextLocations },
        ]);
        this.refreshMemberGraphFields(resourceMap);
        this.recordUserEdit("member:location", {
          member,
          path: nextLocations.find(
            (location, index) => location !== locations[index],
          ),
        });
      } else {
        this.recordUserEdit("member:rename", { member });
      }

      member.trigger?.("change:fileName", member, nextFileName);
      return member;
    }

    /**
     * Mark a member's object content dirty, assigning a replacement PID when
     * needed.
     * @param {string} pid Member PID
     * @returns {Promise<DataPackageMember>} Changed member
     * @throws {Error} When PID reassignment cannot be applied atomically
     */
    async markMemberContentDirty(pid) {
      this.assertCanEdit(pid);
      const member = this.requireMember(pid);
      await this._ensureSystemMetadata([member]);
      this.assertNotNestedResourceMap(member);
      if (member.remotePid && member.pid === member.remotePid) {
        const newPid = await this.allocatePid({
          resourceMap: member.isResourceMap(),
        });
        this.assertCanEdit(member.pid);
        const resourceMap = member.isResourceMap()
          ? member.objectModel
          : this.requireResourceMapModel();
        const previousRootResourceMapPid = this.rootResourceMapPid;
        const previousPrimaryMetadataPid = this.primaryMetadataPid;
        const previousObjectModelPid =
          member.objectModel?.get?.("id") ?? member.objectModel?.id;
        const previousMemberState = {
          contentDirty: member.contentDirty,
          removed: member.removed,
          remoteState: member.remoteState,
        };
        try {
          this.constructor._mutateResourceMap(resourceMap, () =>
            this._changeMemberPid(member, newPid),
          );
        } catch (error) {
          if (this.members.get(newPid) === member) {
            this.members.replacePid(newPid, pid);
          }
          Object.assign(member, previousMemberState);
          this.primaryMetadataPid = previousPrimaryMetadataPid;
          this.rootResourceMapPid = previousRootResourceMapPid;
          if (member.isMetadata() && previousObjectModelPid) {
            this._setMetadataObjectPid(member, previousObjectModelPid);
          }
          this.refreshMemberGraphFields(resourceMap);
          throw error;
        }
        this.refreshMemberGraphFields(resourceMap);
      } else {
        this.assertCanEdit(member.pid);
      }
      member.contentDirty = true;
      member.remoteState = DataPackageMember.RemoteState.PENDING;
      this.recordUserEdit("member:dirty", { member });
      return member;
    }

    /**
     * Link a metadata member to the data member it documents.
     * @param {string} metadataPid Documenting metadata PID
     * @param {string} dataPid Documented data PID
     * @returns {DataPackage} This package
     * @throws {Error} When the package cannot be edited or either member is missing
     */
    linkDocumentation(metadataPid, dataPid) {
      this.assertCanEdit();
      this.requireMember(metadataPid);
      this.requireMember(dataPid);
      const resourceMap = this.requireResourceMapModel();
      resourceMap.linkDocumentation(metadataPid, dataPid);
      this.refreshMemberGraphFields(resourceMap);
      this.recordUserEdit("documentation:link", { metadataPid, dataPid });
      return this;
    }

    /**
     * Remove a documentation link between two package members.
     * @param {string} metadataPid Documenting metadata PID
     * @param {string} dataPid Documented data PID
     * @returns {DataPackage} This package
     * @throws {Error} When the package cannot be edited or either member is missing
     */
    unlinkDocumentation(metadataPid, dataPid) {
      this.assertCanEdit();
      this.requireMember(metadataPid);
      this.requireMember(dataPid);
      const resourceMap = this.requireResourceMapModel();
      resourceMap.unlinkDocumentation(metadataPid, dataPid);
      this.refreshMemberGraphFields(resourceMap);
      this.recordUserEdit("documentation:unlink", { metadataPid, dataPid });
      return this;
    }

    /**
     * Replace the package's documentation links.
     * @param {ResMapDocLink[]} links Desired documentation links
     * @returns {DataPackage} This package
     * @throws {Error} When the package cannot be edited
     */
    setDocumentationLinks(links) {
      this.assertCanEdit();
      const resourceMap = this.requireResourceMapModel();
      resourceMap.setDocumentationLinks(links);
      this.refreshMemberGraphFields(resourceMap);
      this.recordUserEdit("documentation:set", { links });
      return this;
    }

    /**
     * Set one member's desired access policy.
     * @param {string} pid Member PID
     * @param {AccessPolicy|object[]|object|null} accessPolicy Desired policy
     * @param {object} [options] Options
     * @param {string} [options.rightsHolder] Desired rights holder
     * @returns {Promise<DataPackageMember>} Updated member
     */
    async setMemberAccessPolicy(pid, accessPolicy, { rightsHolder } = {}) {
      this.assertCanEdit(pid);
      const member = this.requireMember(pid);
      const policy = AccessPolicy.fromValue(accessPolicy);
      await this._ensureSystemMetadata([member]);
      this.assertNotNestedResourceMap(member);
      this.assertCanEdit(member.pid);
      this.constructor._applyAccessPolicy(member, policy, { rightsHolder });
      this.recordUserEdit("accessPolicy:setMember", { member });
      return member;
    }

    /**
     * Stage a package access policy change.
     * @param {AccessPolicy|object[]|object|null} accessPolicy Desired policy
     * @param {object} [options] Options
     * @param {boolean} [options.propagate] Whether to target every active
     * package member. Otherwise target the root ResourceMap and primary
     * metadata only
     * @param {number} [options.maxConcurrent] Fetch concurrency
     * @param {Function} [options.onProgress] SysMeta fetch progress callback
     * @param {string} [options.rightsHolder] Desired rights holder
     * @returns {Promise<DataPackageMember[]>} Updated members
     */
    async setPackageAccessPolicy(
      accessPolicy,
      { propagate = false, maxConcurrent, onProgress, rightsHolder } = {},
    ) {
      this.assertCanEdit();
      const resolvedMaxConcurrent = Utilities.resolveMaxConcurrent(
        "batchSizeFetch",
        maxConcurrent,
      );
      const policy = AccessPolicy.fromValue(accessPolicy);
      const targets = this._getAccessPolicyTargets({ propagate });
      targets.forEach((member) => this.assertCanEdit(member.pid));
      await this._ensureSystemMetadata(targets, {
        maxConcurrent: resolvedMaxConcurrent,
        onProgress,
        refresh: true,
      });
      const rootResourceMap = this.getRootResourceMapMember();
      targets.forEach((member) =>
        this.assertNotNestedResourceMap(member, rootResourceMap),
      );
      this.assertCanEdit();
      targets.forEach((member) => this.assertCanEdit(member.pid));

      targets.forEach((member) =>
        this.constructor._applyAccessPolicy(member, policy, { rightsHolder }),
      );
      this.recordUserEdit("accessPolicy:setPackage", {
        members: targets,
        propagate,
      });
      return targets;
    }

    /**
     * Return members targeted by a package access policy edit.
     * @param {object} [options] Options
     * @param {boolean} [options.propagate] Whether to target all active
     * members
     * @returns {DataPackageMember[]} Target members
     * @private
     */
    _getAccessPolicyTargets({ propagate = false } = {}) {
      const targets = propagate
        ? this.members.getActiveMembers()
        : [this.getRootResourceMapMember(), this.getPrimaryMetadataMember()];
      const seen = new Set();
      return targets.filter((member) => {
        if (!member || member.removed || seen.has(member.pid)) return false;
        seen.add(member.pid);
        return true;
      });
    }

    /**
     * Fetch sysmeta baselines needed for access policy edits.
     * @param {DataPackageMember[]} members Target members
     * @param {object} [options] Options
     * @param {number} [options.maxConcurrent] Fetch concurrency
     * @param {boolean} [options.refresh] Refresh existing baselines too
     * @param {AbortSignal} [options.signal] Abort signal
     * @param {Function} [options.onProgress] Progress callback
     * @returns {Promise<void>}
     * @private
     * @throws {Error} When any system metadata fetch fails
     */
    async _ensureSystemMetadata(
      members,
      {
        maxConcurrent = DEFAULT_MAX_CONCURRENT,
        refresh = false,
        signal,
        onProgress,
      } = {},
    ) {
      const membersToFetch = Values.listify(members).filter(
        (member) =>
          (member?.remotePid || member?.aggregatedPid) &&
          (refresh || !member.remoteSysMeta),
      );
      if (!membersToFetch.length) return;

      let completed = 0;
      if (typeof onProgress === "function") {
        onProgress({ completed, total: membersToFetch.length });
      }
      const { errors } = await processConcurrently(
        membersToFetch,
        async (member) => {
          await member.fetchSysMeta({
            sysMetaService: this.getSysMetaService(),
            useCache: false,
            signal,
          });
        },
        {
          maxConcurrent,
          signal,
          stopOnError: true,
          onItemComplete: () => {
            completed += 1;
            if (typeof onProgress === "function") {
              onProgress({ completed, total: membersToFetch.length });
            }
          },
        },
      );
      if (errors.length) throw errors[0].error;
      throwIfAborted(signal, "Upload cancelled");
    }

    /**
     * Apply a desired access policy to one member.
     * @param {DataPackageMember} member Member to update
     * @param {AccessPolicy} policy Desired policy
     * @param {object} [options] Options
     * @param {string} [options.rightsHolder] Desired rights holder
     * @returns {DataPackageMember} Updated member
     * @private
     */
    static _applyAccessPolicy(member, policy, { rightsHolder } = {}) {
      const base = member.sysMeta || member.remoteSysMeta;
      const values = base?.toJSON?.() || {
        identifier: member.pid,
        formatId: member.formatId,
      };
      values.accessPolicy = policy.toJSON();
      if (rightsHolder) {
        values.rightsHolder = rightsHolder;
      }
      member.setSystemMetadata(values, { markDirty: true });
      Object.assign(member, { accessPolicyDirty: true });
      return member;
    }

    /**
     * Copy relationships and locations from the ResourceMap graph to each
     * active package member. Call this after changing the ResourceMap to keep
     * those member fields in sync.
     * @param {ResourceMap} [resourceMap] ResourceMap to read; defaults to the
     * package's root ResourceMap
     * @returns {DataPackage} This package
     */
    refreshMemberGraphFields(resourceMap = this.requireResourceMapModel()) {
      const rootResourceMap = this.getRootResourceMapMember();
      const fields = DataPackageMember.ResourceMapGraphFields;

      this.members
        .getActiveMembers()
        .filter((member) => member !== rootResourceMap)
        .forEach((member) => {
          const graphMember =
            resourceMap.graphState.getMember(member.pid) || {};
          const graphFields = {};
          fields.forEach((field) => {
            graphFields[field] = [...(graphMember[field] || [])];
          });
          Object.assign(member, graphFields);
        });

      return this;
    }

    /**
     * Record that one data object was derived from another.
     * @param {...string} args Derived PID followed by source PID
     * @returns {DataPackage} This package
     */
    addWasDerivedFrom(...args) {
      return this.mutateProvenance("addWasDerivedFrom", args);
    }

    /**
     * Remove a derivation relationship between two data objects.
     * @param {...string} args Derived PID followed by source PID
     * @returns {DataPackage} This package
     */
    removeWasDerivedFrom(...args) {
      return this.mutateProvenance("removeWasDerivedFrom", args);
    }

    /**
     * Record that a program produced a data object.
     * @param {string} dataPid Generated data PID
     * @param {string} programPid Program PID
     * @returns {DataPackage} This package
     */
    addGeneratedByProgram(dataPid, programPid) {
      return this.mutateProvenance("addGeneratedByProgram", [
        dataPid,
        programPid,
      ]);
    }

    /**
     * Remove the record that a program produced a data object.
     * @param {string} dataPid Generated data PID
     * @param {string} programPid Program PID
     * @returns {DataPackage} This package
     */
    removeGeneratedByProgram(dataPid, programPid) {
      return this.mutateProvenance("removeGeneratedByProgram", [
        dataPid,
        programPid,
      ]);
    }

    /**
     * Record that a program used a data object.
     * @param {string} dataPid Used data PID
     * @param {string} programPid Program PID
     * @returns {DataPackage} This package
     */
    addUsedByProgram(dataPid, programPid) {
      return this.mutateProvenance("addUsedByProgram", [dataPid, programPid]);
    }

    /**
     * Remove the record that a program used a data object.
     * @param {string} dataPid Used data PID
     * @param {string} programPid Program PID
     * @returns {DataPackage} This package
     */
    removeUsedByProgram(dataPid, programPid) {
      return this.mutateProvenance("removeUsedByProgram", [
        dataPid,
        programPid,
      ]);
    }

    /**
     * Run a provenance mutation and record the package edit.
     * @param {string} method Provenance method name
     * @param {Array<*>} args Arguments passed to the provenance method
     * @returns {DataPackage} This package
     * @throws {Error} When the package cannot be edited or the method is invalid
     */
    mutateProvenance(method, args) {
      this.assertCanEdit();
      this.requireResourceMapModel().provenance[method](...args);
      this.recordUserEdit("provenance:changed", { operation: method, args });
      return this;
    }

    /**
     * Capture member state that may need to be restored after a failed edit.
     * @param {DataPackageMember[]} members Members to snapshot
     * @param {string[]} extraFields Additional member fields to capture
     * @returns {object[]} Member snapshots
     * @private
     */
    static _snapshotMembers(members, extraFields) {
      return members.map((member) => {
        const snapshot = {
          member,
          pid: member.pid,
          objectModelPid:
            member.objectModel?.get?.("id") ?? member.objectModel?.id,
        };
        extraFields.forEach((field) => {
          snapshot[field] = member[field];
        });
        return snapshot;
      });
    }

    /**
     * Restore previously captured member state.
     * @param {object[]} snapshots Member snapshots
     * @returns {void}
     * @private
     */
    _restoreMemberSnapshots(snapshots) {
      snapshots.forEach((snapshot) => {
        const { member: snapshotMember, objectModelPid, ...state } = snapshot;
        if (
          snapshotMember.pid !== snapshot.pid &&
          this.members.get(snapshotMember.pid) === snapshotMember
        ) {
          this.members.replacePid(snapshotMember.pid, snapshot.pid);
        }
        Object.assign(snapshotMember, state);
        if (objectModelPid) {
          this._setMetadataObjectPid(snapshotMember, objectModelPid);
        }
      });
    }

    /**
     * Group ResourceMap edits against one stable pre mutation graph projection.
     * @param {ResourceMap} resourceMap Resource map being edited
     * @param {Function} mutator Grouped edit callback
     * @returns {ResourceMap} Updated resource map
     * @private
     */
    static _mutateResourceMap(resourceMap, mutator) {
      resourceMap.graphState.getIndex();
      return resourceMap.mutateGraph(mutator, { rollbackOnError: true });
    }

    /**
     * Replace a member PID in package state and the resource map.
     * @param {DataPackageMember} member Member to update
     * @param {string} newPid Replacement PID
     * @returns {DataPackageMember} Updated member
     * @private
     */
    _changeMemberPid(member, newPid) {
      const oldPid = member.pid;
      const wasPrimaryMetadata =
        member.isMetadata() && this.getPrimaryMetadataMember() === member;
      const wasRootResourceMap =
        member.isResourceMap() && this.getRootResourceMapMember() === member;
      this.members.replacePid(oldPid, newPid);
      if (member.isResourceMap()) {
        if (wasRootResourceMap) this.rootResourceMapPid = newPid;
        member.objectModel?.setResourceMapPid(newPid);
      } else {
        this.requireResourceMapModel().replaceMember(oldPid, newPid);
        if (member.isMetadata()) {
          if (wasPrimaryMetadata) this.primaryMetadataPid = newPid;
          this._setMetadataObjectPid(member, newPid);
        }
      }
      return member;
    }

    /**
     * Replace member references in a metadata model.
     * @param {DataPackageMember} metadataMember Metadata member to update
     * @param {string} oldPid Current referenced PID
     * @param {string} newPid Replacement PID
     * @returns {number} Number of replaced references
     * @throws {Error} When the metadata member is not in this package
     * @private
     */
    _updateMetadataMemberReferences(metadataMember, oldPid, newPid) {
      if (this.getMember(metadataMember.pid) !== metadataMember) {
        throw new Error("Metadata member does not belong to this package");
      }
      return (
        metadataMember.objectModel?.replaceMemberPid?.(oldPid, newPid) || 0
      );
    }

    /**
     * Set the identifier stored in a metadata member's object model.
     * @param {DataPackageMember} metadataMember Metadata member to update
     * @param {string} pid Identifier to store
     * @returns {DataPackageMember} Updated metadata member
     * @throws {Error} When the metadata member is not in this package
     * @private
     */
    _setMetadataObjectPid(metadataMember, pid) {
      if (this.getMember(metadataMember.pid) !== metadataMember) {
        throw new Error("Metadata member does not belong to this package");
      }
      const { objectModel } = metadataMember;
      objectModel.set("id", pid);
      return metadataMember;
    }

    /**
     * Return a package member or throw when it is missing.
     * @param {string} pid Member PID
     * @returns {DataPackageMember} Matching member
     * @throws {Error} When no package member has the PID
     */
    requireMember(pid) {
      const member = this.getMember(pid);
      if (!member) throw new Error(`Member with PID ${pid} does not exist`);
      return member;
    }

    /**
     * Reject direct edits to ResourceMaps aggregated by the root package.
     * @param {DataPackageMember} member Package member
     * @param {DataPackageMember} [rootResourceMap] Root ResourceMap member
     * @returns {DataPackageMember} The accepted member
     * @throws {Error} When the member is a nested resource map
     */
    assertNotNestedResourceMap(
      member,
      rootResourceMap = this.getRootResourceMapMember(),
    ) {
      if (member?.isResourceMap() && member !== rootResourceMap) {
        const error = new Error(
          "Nested ResourceMap members are read-only in the editor",
        );
        error.code = "nested_resource_map_edit_unsupported";
        error.pid = member.pid;
        throw error;
      }
      return member;
    }

    /**
     * Return a loaded resource map model or throw when it is unavailable.
     * @param {string} [resourceMapPid] Resource map PID
     * @returns {ResourceMap} Loaded resource map
     * @throws {Error} When the resource map is not loaded
     */
    requireResourceMapModel(resourceMapPid = this.rootResourceMapPid) {
      const resourceMap = this.getResourceMapModel(resourceMapPid);
      if (!resourceMap) throw new Error("Editable ResourceMap is not loaded");
      return resourceMap;
    }

    /**
     * Advance the draft revision and publish a package edit event.
     * @param {string} event Edit event name
     * @param {object} details Event details
     * @returns {DataPackage} This package
     * @throws {Error} When the package is locked for editing
     */
    recordUserEdit(event, details) {
      // This is only the final synchronous guard. Async edit methods must also
      // recheck immediately after their last await and before their first mutation.
      this.assertCanEdit();
      if (event === "metadata:changed") {
        this.metadataContentEdited = true;
      }
      this.draftRevision += 1;
      this.events.trigger(event, details);
      this.events.trigger("change", { event, ...details });
      return this;
    }

    /**
     * Return the version tracker used for stale source checks.
     * @returns {VersionTracker} Version tracker
     * @private
     */
    getVersionTracker() {
      if (!this.versionTracker) {
        this.versionTracker = new VersionTracker(this.versionTrackerOptions);
      }
      return this.versionTracker;
    }

    /**
     * Return the authorization service used for write permission checks.
     * @returns {AuthorizationService} Authorization service
     * @private
     */
    getAuthorizationService() {
      if (!this.authorizationService) {
        this.authorizationService = new AuthorizationService(
          this.authorizationServiceOptions,
        );
      }
      return this.authorizationService;
    }

    /**
     * Return the object service used for create/update writes.
     * @returns {ObjectService} Object service
     * @private
     */
    getObjectService() {
      if (!this.objectService) {
        this.objectService = new ObjectService(this.objectServiceOptions);
      }
      return this.objectService;
    }

    /**
     * Return the system metadata service used for sysmeta only updates and
     * cache invalidation.
     * @returns {SysMetaService} System metadata service
     * @private
     */
    getSysMetaService() {
      if (!this.sysMetaService) {
        this.sysMetaService = new SysMetaService(this.sysMetaServiceOptions);
      }
      return this.sysMetaService;
    }

    /**
     * Return the durable store for upload recovery records.
     * @returns {UploadRecoveryStore} Upload recovery store
     * @private
     */
    getUploadRecoveryStore() {
      if (!this.uploadRecoveryStore) {
        this.uploadRecoveryStore = new UploadRecoveryStore();
      }
      return this.uploadRecoveryStore;
    }

    /**
     * Return active members that require an object write or system metadata
     * update. Removed members are deaggregated by the ResourceMap, not
     * uploaded, so they are excluded.
     * @returns {DataPackageMember[]} Changed members
     */
    getChangedMembers() {
      const { NONE } = DataPackageMember.RequiredOperation;
      return this.members
        .getActiveMembers()
        .filter((member) => member.getRequiredOperation() !== NONE);
    }

    // See DataPackageUploader.getPendingEagerUploads().
    getPendingEagerUploads() {
      return this._uploader.getPendingEagerUploads();
    }

    // See DataPackageUploader.cancelEagerUpload().
    cancelEagerUpload(pid) {
      return this._uploader.cancelEagerUpload(pid);
    }

    // See DataPackageUploader.upload().
    upload(options) {
      return this._uploader.upload(options);
    }

    // See DataPackageUploader.cancelUpload().
    cancelUpload() {
      return this._uploader.cancelUpload();
    }

    // See DataPackageUploader.retryUpload().
    retryUpload(previousResult, options) {
      return this._uploader.retryUpload(previousResult, options);
    }

    /**
     * Sum the reported sizes of the package's data members.
     * @returns {number|null} Total bytes, or null when the package has no data
     * @throws {Error} When any size is missing or nonnumeric
     */
    getTotalSize() {
      const dataMembers = this.members.getData();
      if (!dataMembers?.length) return null;
      const sizes = dataMembers
        .map((member) => {
          const size = member.size ?? member.sysMeta?.size;
          if (size === null || size === undefined || size === "") return null;
          const sizeNum = Number(size);
          return Number.isFinite(sizeNum) ? sizeNum : null;
        })
        .filter((size) => size !== null);

      if (sizes.length !== dataMembers.length) {
        throw new Error(
          "Cannot calculate total size of data package because some data members are missing size information",
        );
      }
      return sizes.reduce((total, size) => total + size, 0);
    }

    // See DataPackageLoader.getManifestFromResourceMap().
    async getManifestFromResourceMap(options = {}) {
      return DataPackageLoader.getManifestFromResourceMap(this, options);
    }

    /**
     * Merge entity summaries from a rendered metadata document into matching
     * package members.
     * @param {object[]} entities Plain entity summaries from
     * ViewServiceDoc
     * @returns {void}
     */
    addViewServiceEntities(entities = []) {
      const normalizedEntities = Values.listify(entities)
        .map((entity) => DataPackageMember.normalizeViewInfo(entity))
        .filter((entity) => entity.pid);

      normalizedEntities.forEach((entity) => {
        const member = this.members.get(entity.pid);
        if (member) member.addViewInfo(entity);
      });
    }

    /**
     * Check whether the resource map contains members absent from the index.
     * @returns {Promise<boolean>} Whether the package has private members
     * @throws {Error} When the authoritative resource map cannot be loaded
     */
    async hasPrivateMembers() {
      // The package service can fail the whole-package ZIP when any aggregated
      // object is private. The ResourceMap is the authoritative member list; the
      // index only returns members the current user can see. Withhold Download
      // All when a ResourceMap member is missing from the index, while leaving
      // individual visible-file downloads available.
      if (!this.resourceManifestIsFetched) {
        const result = await this.getManifestFromResourceMap({ merge: true });
        if (result?.ok === false) {
          const error = new Error(
            "Resource map unavailable for private-member check",
          );
          error.code = "resource_map_unavailable";
          error.reason = result.reason || null;
          error.httpStatus = result.httpStatus ?? null;
          error.rootResourceMapPid =
            result.details?.rootResourceMapPid || this.rootResourceMapPid;
          if (result.error) error.cause = result.error;
          throw error;
        }
      }
      const resourceMapMembers = this.members.getFromSource("resourceMap");
      if (!this.indexManifestFetched) {
        // Size the index fetch to the membership so a large all-public package
        // is not truncated and misread as having private members.
        await this.getManifestFromIndex({
          fields: ["id"],
          rows: resourceMapMembers.length,
          merge: true,
        });
      }
      const indexPids = new Set(
        this.members.getFromSource("index").map((member) => member.pid),
      );
      return resourceMapMembers.some((member) => !indexPids.has(member.pid));
    }

    /**
     * Fetch missing system metadata for selected package members.
     * @param {string[]|null} memberPids PIDs to fetch, or null for all members
     * @param {object} [options] Fetch options
     * @param {number} [options.maxConcurrent] Fetch concurrency
     * @returns {Promise<Array<{pid: string, error: Error}>>} Fetch failures
     */
    async fetchSysMeta(memberPids, { maxConcurrent, ...fetchOptions } = {}) {
      const resolvedMaxConcurrent = Utilities.resolveMaxConcurrent(
        "batchSizeFetch",
        maxConcurrent,
      );
      let members = this.members.toArray();
      let missingFailures = [];
      if (Values.isNonEmptyArray(memberPids)) {
        const requestedPids = [...new Set(memberPids)];
        members = this.members.getMembers(requestedPids);
        const foundPids = new Set(members.map((member) => member.pid));
        missingFailures = requestedPids
          .filter((pid) => !foundPids.has(pid))
          .map((pid) => {
            const error = new Error(
              `Cannot fetch System Metadata for unknown member PID ${pid}`,
            );
            error.code = "member_not_found";
            return { pid, error };
          });
      }
      const pendingMembers = members.filter((member) => !member.sysMeta);
      const sysMetaService =
        fetchOptions.sysMetaService ?? this.getSysMetaService();
      const { errors } = await processConcurrently(
        pendingMembers,
        (member) => member.fetchSysMeta({ ...fetchOptions, sysMetaService }),
        {
          maxConcurrent: resolvedMaxConcurrent,
          stopOnError: false,
          signal: fetchOptions.signal,
        },
      );
      return [
        ...missingFailures,
        ...errors.map(({ item: member, error }) => ({
          pid: member.pid,
          error,
        })),
      ];
    }

    /**
     * Find the latest PID for the package's primary object.
     * @param {object} [options] Lookup options
     * @param {AbortSignal} [options.signal] Abort signal
     * @returns {Promise<string|null>} Latest primary PID, or null
     * @throws {Error} When the version lookup fails
     */
    async getLatestVersionPid(options = {}) {
      const { signal } = options;
      let metadata = this.getPrimaryMetadataMember();
      if (!metadata) {
        await this.getManifestFromResourceMap({ merge: true, signal });
        metadata = this.getPrimaryMetadataMember();
      }
      const versionTracker = this.getVersionTracker();
      if (metadata) {
        const newest = await versionTracker.getLatestVersion(metadata.pid, {
          signal,
        });
        return newest || metadata.pid;
      }
      // Otherwise see if there's a newer version of the resource map, and if so
      // get the manifest from that resource map and check for metadata there.
      const resourceMap = this.getRootResourceMapMember();
      if (resourceMap) {
        const newestRm = await versionTracker.getLatestVersion(
          resourceMap.pid,
          {
            signal,
          },
        );
        if (newestRm && newestRm !== resourceMap.pid) {
          const newDataPackage = new DataPackage();
          await newDataPackage.resolveFromPid(newestRm, { signal });
          return newDataPackage.getLatestVersionPid({ signal });
        }
        return resourceMap.pid;
      }
      return null;
    }

    /**
     * Check if the user has write permission on the resource map and metadata
     * if they both exist, or just the one that exists if only one exists. If
     * neither exists, then return false.
     * @param {object|boolean} [options] Options or refresh boolean
     * @returns {Promise<boolean>} Whether every checked member is writable
     */
    async checkWritePermissions(options = false) {
      const metadata = this.getPrimaryMetadataMember();
      const resourceMap = this.getRootResourceMapMember();
      const toCheck = [metadata, resourceMap].filter(Boolean);
      if (!toCheck.length) return false;
      const results = await Promise.all(
        toCheck.map((member) => member.checkWritePermission(options)),
      );
      return results.every((result) => result === true);
    }

    /**
     * Check whether the user can write to the root resource map specifically.
     * Provenance editing depends on resource map writability rather than
     * metadata write permission, so this is intentionally separate from
     * {@link DataPackage#checkWritePermissions}, which requires write access to
     * every member.
     * @param {object|boolean} [options] Options or refresh boolean
     * @returns {Promise<boolean>} Whether the root resource map is writable
     * Returns false when no resource map has been resolved
     */
    async checkResourceMapWritePermission(options = false) {
      const resourceMap = this.getRootResourceMapMember();
      if (!resourceMap) return false;
      return (await resourceMap.checkWritePermission(options)) === true;
    }

    /**
     * Publish the package and verify ambiguous publication responses.
     * @returns {Promise<{pid: string, resourceMapPending: boolean}>} Publication result
     * @throws {Error} When publication fails or cannot be verified
     */
    async publish() {
      const sourcePid =
        this.getPrimaryMetadataMember()?.pid ||
        this.getRootResourceMapMember()?.pid ||
        null;
      const pubService = new PublishService();
      try {
        const pid = await pubService.publish(sourcePid);
        return { pid, resourceMapPending: false };
      } catch (error) {
        if (!DataONEService.isAmbiguousWriteError(error)) throw error;

        // If we are not sure whether the publication succeeded, check for a
        // newer version of the source PID. If the source PID was obsoleted by a
        // newer version, and that newer version obsoletes the source PID, then
        // we can assume that the publication succeeded and return the newer
        // PID.
        try {
          const sysMetaService = this.getSysMetaService();
          const sourceSysMeta = await sysMetaService.download(sourcePid, {
            useCache: false,
          });
          const source = sourceSysMeta?.toJSON?.() || sourceSysMeta || {};
          const candidatePid = Values.normalizeText(source.obsoletedBy);
          if (candidatePid) {
            const candidateSysMeta = await sysMetaService.download(
              candidatePid,
              { useCache: false },
            );
            const candidate =
              candidateSysMeta?.toJSON?.() || candidateSysMeta || {};
            if (Values.normalizeText(candidate.obsoletes) === sourcePid) {
              let resourceMapPending = true;
              try {
                const resolution = await new ResourceMapResolver().resolve(
                  candidatePid,
                );
                resourceMapPending = !resolution.rm;
              } catch (_resolverError) {
                // The DOI is committed; unresolved package details remain pending.
              }
              return { pid: candidatePid, resourceMapPending };
            }
          }
        } catch (_recoveryError) {
          // Recovery is useful only when the version chain proves publication.
        }
        throw error;
      }
    }

    /**
     * Serialize package state.
     * @returns {object} Serializable package state
     */
    toJSON() {
      return {
        inputId: this.inputId,
        primaryMetadataPid: this.primaryMetadataPid,
        rootResourceMapPid: this.rootResourceMapPid,
        draftRevision: this.draftRevision,
        savedRevision: this.savedRevision,
        members: this.members.toArray().map((member) => member.toJSON()),
      };
    }
  }

  DataPackage.LoadPhases = DataPackageLoader.LoadPhases;
  DataPackage.LoadProgressMessages = LOAD_PROGRESS_MESSAGES;
  return DataPackage;
});
