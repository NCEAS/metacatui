"use strict";

define([
  "backbone",
  "common/ErrorUtilities",
  "common/ValueUtilities",
  "common/XMLUtilities",
  "models/dataONEServices/AuthorizationService",
  "models/dataONEServices/ObjectService",
  "models/dataONEServices/SysMetaService",
  "models/resourceMap/ResourceMap",
  "models/sysmeta/SystemMetadata",
  "models/metadata/ScienceMetadata",
  "models/metadata/eml211/EML211",
  "models/viewService/ViewServiceDoc",
  "collections/ObjectFormats",
], (
  Backbone,
  ErrorUtilities,
  Values,
  XMLUtilities,
  AuthorizationService,
  ObjectService,
  SysMetaService,
  ResourceMap,
  SystemMetadata,
  ScienceMetadata,
  EML211,
  ViewServiceDoc,
  ObjectFormats,
) => {
  const REMOTE_STATES = Object.freeze({
    UNKNOWN: "unknown",
    PENDING: "pending",
    UPLOADING: "uploading",
    UPLOADED: "uploaded",
    FAILED: "failed",
    AMBIGUOUS: "ambiguous",
  });
  const REQUIRED_OPERATIONS = Object.freeze({
    NONE: "none",
    CREATE: "create",
    UPDATE: "update",
    UPDATE_SYSTEM_METADATA: "updateSystemMetadata",
    REMOVE: "remove",
  });
  const EDITABLE_STATE_FIELDS = new Set([
    "pid",
    "remotePid",
    "aggregatedPid",
    "sysMeta",
    "remoteSysMeta",
    "contentDirty",
    "sysMetaDirty",
    "accessPolicyDirty",
    "removed",
    "remoteState",
    "lastUploadError",
  ]);
  const RESOURCE_MAP_GRAPH_FIELDS = Object.freeze([
    "documents",
    "isDocumentedBy",
    "atLocations",
  ]);
  // These values describe package relationships, but they are not editable
  // member state. Once a parsed ResourceMap is loaded, DataPackage refreshes
  // the graph projection fields from the ResourceMap state. The resourceMap
  // field remains parent-package/discovery metadata from Solr or resource map
  // load seeding, not current graph membership.
  const RESOURCE_MAP_RELATIONSHIP_FIELDS = new Set([
    ...RESOURCE_MAP_GRAPH_FIELDS,
    "resourceMap",
  ]);
  const MUTABLE_SYSTEM_METADATA_FIELDS = [
    "rightsHolder",
    "accessPolicy",
    "replicationPolicy",
    "archived",
    "fileName",
  ];
  const FALLBACK_OBJECT_FORMATS = new ObjectFormats();

  /**
   * Store one data package member's manifest, editable, and upload state.
   * @class DataPackageMember
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  class DataPackageMember {
    /**
     * Create a package member.
     * @param {object} [info] Member fields and editable state
     */
    constructor(info = {}) {
      this.pid = Values.normalizeText(info.pid || info.id || info.identifier);
      this.events = { ...Backbone.Events };
      this.sources = [];
      this.addSources(info.sources);
      // Injected ObjectFormats collection used for synchronous format
      // classification (getFormatType/isMetadata/etc.). Explicitly excluded
      // from toJSON()/merge() so the collection is never serialized.
      this.objectFormats = info.objectFormats || null;
      // Preserve Solr, ResourceMap, and View Service fields that package
      // table, viewer, and provenance paths may read directly.
      Object.entries(info).forEach(([key, value]) => {
        if (
          key === "id" ||
          key === "identifier" ||
          EDITABLE_STATE_FIELDS.has(key)
        ) {
          return; // initialized below
        }
        if (key === "events" || key === "sources" || key === "objectFormats") {
          return; // handled above
        }
        if (key === "isPublic") {
          // Solr's snapshot must not shadow the async isPublic() policy check.
          return;
        }
        this[key] = value;
      });
      this.initializeEditableState({
        remotePid: info.remotePid,
        aggregatedPid: info.aggregatedPid,
        sysMeta: info.sysMeta,
        remoteSysMeta: info.remoteSysMeta,
        contentDirty: info.contentDirty,
        sysMetaDirty: info.sysMetaDirty,
        accessPolicyDirty: info.accessPolicyDirty,
        removed: info.removed,
        remoteState: info.remoteState,
        lastUploadError: info.lastUploadError,
      });
    }

    /**
     * Return a member instance for a member or plain object.
     * @param {DataPackageMember|object} [value] Member value
     * @param {object} [options] Conversion options
     * @param {string[]} [options.sources] Manifest sources to add
     * @returns {DataPackageMember} Member instance
     */
    static from(value = {}, options = {}) {
      if (value instanceof DataPackageMember) {
        if (options.sources) {
          value.addSources(options.sources);
        }
        return value;
      }

      const newValues = { ...value };
      if (options.sources) {
        newValues.sources = options.sources;
      }
      return new DataPackageMember(newValues);
    }

    /**
     * Add manifest sources without duplicates.
     * @param {string|string[]} sources Sources to add
     * @returns {void}
     */
    addSources(sources) {
      if (!sources) return;
      const existingSources = Array.isArray(this.sources) ? this.sources : [];
      const newSources = Values.listify(sources);
      this.sources = Array.from(new Set([...existingSources, ...newSources]));
    }

    /**
     * Download and parse this member's object into a typed model, stored on
     * `this.objectModel`:
     *  - metadata    → an EML211 (EML) or ScienceMetadata (other format) model
     *  - resourceMap → a ResourceMap model
     *  - data/unknown → no model (data is fetched on demand for preview/download)
     * @param {object} [options] Fetch options
     * @param {AbortSignal} [options.signal] Signal used to cancel downloads
     * @returns {Promise<object|null>} The parsed object model, or null
     */
    async fetchObject(options = {}) {
      const { pid } = this;

      if (this.isMetadata()) {
        this.objectModel = await this.fetchMetadataModel(options);
        return this.objectModel;
      }

      if (this.isResourceMap()) {
        const appModel = globalThis.MetacatUI?.appModel;
        const resolveServiceUrl = Values.normalizeText(
          appModel?.get?.("resolveServiceUrl"),
        );
        const objectServiceUrl = Values.normalizeText(
          appModel?.get?.("objectServiceUrl"),
        );
        // ObjectService prefers the local MN so newly saved maps are readable
        // before CN synchronization, and falls back to /resolve/ on a CN.
        const objectService = new ObjectService();
        const downloadOptions = {};
        if (options.signal) downloadOptions.signal = options.signal;
        const blob = await objectService.download(pid, downloadOptions);
        this.rawData = await blob.text();
        this.objectModel = ResourceMap.fromXml(pid, this.rawData, {
          resolveServiceUrl,
          objectServiceUrl,
        });
        return this.objectModel;
      }

      // Data objects are downloaded on demand for preview/download rather than
      // parsed into a model, so there is nothing to build here.
      return this.objectModel || null;
    }

    /**
     * Build this member's typed metadata model and download its content. The
     * member already knows its formatId from the manifest, so the typed model
     * is constructed without a Solr round trip or ScienceMetadata→EML
     * "replace" handshake. The model is created unsynced so fetch population
     * is not trickled up as a user edit; it flips `synced` to true on its own
     * "sync" event.
     * @param {object} [options] Fetch options
     * @param {AbortSignal} [options.signal] Signal used to cancel fetches
     * @returns {Promise<EML211|ScienceMetadata>} The fetched metadata model
     */
    async fetchMetadataModel(options = {}) {
      const { pid } = this;
      const formatId = this.getFormatId() || undefined;
      const model = this.isEML()
        ? new EML211(
            { id: pid, formatId, synced: false },
            { packageEvents: this._packageEvents },
          )
        : new ScienceMetadata(
            { id: pid, formatId, synced: false },
            { packageEvents: this._packageEvents },
          );

      // Wait on the model's events, not fetch() callbacks: EML211.fetch also
      // runs a separate system-metadata fetch that invokes the success/error
      // callbacks, but only the document load fires "sync" (sysmeta fires
      // "sysMetaUpdated"). This ties resolution to the document itself.
      await new Promise((resolve, reject) => {
        model.once("sync", resolve);
        model.once("error", (_model, err) =>
          reject(
            err instanceof Error
              ? err
              : new Error(`Failed to fetch metadata object ${pid}`),
          ),
        );
        const fetchOptions = options.signal
          ? { signal: options.signal }
          : undefined;
        model.fetch(fetchOptions);
      });

      // Preserve the raw XML for the upload fallback (objectModel.serialize() is
      // the primary serializer; rawData is only the fallback).
      const objectXML = model.get?.("objectXML");
      if (objectXML) this.rawData = objectXML;

      return model;
    }

    /**
     * Download system metadata and update this member's remote baseline.
     * @param {object} [options] Download and service options
     * @param {SysMetaService} [options.sysMetaService] Service instance
     * @param {object} [options.sysMetaServiceOptions] Service constructor options
     * @returns {Promise<SystemMetadata>} Downloaded system metadata
     */
    async fetchSysMeta(options = {}) {
      const pid = this.remotePid || this.aggregatedPid || this.pid;
      const {
        sysMetaService = null,
        sysMetaServiceOptions = {},
        ...downloadOptions
      } = options;
      const service =
        sysMetaService || new SysMetaService(sysMetaServiceOptions);
      const sysMeta = await service.download(pid, downloadOptions);
      if (!this.remotePid && this.aggregatedPid) {
        this.remotePid = this.aggregatedPid;
      }
      this._rebaseSystemMetadata(sysMeta);
      const sysMetaMember = new DataPackageMember({
        ...sysMeta.toJSON(),
        sources: ["sysMeta"],
      });
      if (this.pid === sysMetaMember.pid) {
        this.merge(sysMetaMember);
      }
      return this.sysMeta;
    }

    /**
     * Replace the remote baseline while retaining planned mutable changes.
     * @param {SystemMetadata|object} remoteSysMeta Fresh remote System Metadata
     * @param {object} [options] Rebase options
     * @param {boolean} [options.updateRemoteBaseline] Whether the fresh source
     * replaces the member's confirmed remote baseline
     * @param {SystemMetadata|object} [options.localEditBaseline] Baseline used
     * to distinguish explicit local edits from prior source values
     * @returns {SystemMetadata} Rebased desired System Metadata
     * @private
     */
    _rebaseSystemMetadata(
      remoteSysMeta,
      { updateRemoteBaseline = true, localEditBaseline = null } = {},
    ) {
      const fresh =
        remoteSysMeta instanceof SystemMetadata
          ? remoteSysMeta
          : new SystemMetadata(remoteSysMeta);
      const previousSysMeta = localEditBaseline || this.remoteSysMeta;
      const previousValues =
        previousSysMeta?.toJSON?.() || previousSysMeta || {};
      const desiredValues = this.sysMeta?.toJSON?.() || {};
      const values = fresh.toJSON();

      if (this.sysMetaDirty && this.sysMeta) {
        MUTABLE_SYSTEM_METADATA_FIELDS.forEach((field) => {
          if (
            !previousSysMeta ||
            (field === "accessPolicy" && this.accessPolicyDirty) ||
            !Values.deepEqual(previousValues[field], desiredValues[field])
          ) {
            values[field] = desiredValues[field];
          }
        });
      }

      if (updateRemoteBaseline) {
        this.remoteSysMeta = fresh.clone();
        this._remoteSysMetaDownloaded = true;
        this._remoteSysMetaParseWarnings = [...(fresh.parseWarnings || [])];
      } else if (this._replacementSourcePid) {
        // A retargeted replacement inherits from another remote object. Keep
        // that source separate from this member's own confirmed remote baseline.
        this._replacementSourceSysMeta = fresh.clone();
      }
      this.sysMeta = new SystemMetadata(values);
      this.sysMetaMissing = false;
      return this.sysMeta;
    }

    /**
     * Add information inferred from a rendered metadata document.
     * @param {object} viewInfo Plain entity summary from
     * ViewServiceDoc
     * @returns {DataPackageMember} This member
     * @throws {Error} When the view information belongs to another PID
     */
    addViewInfo(viewInfo = {}) {
      const info = DataPackageMember.normalizeViewInfo(viewInfo);
      if (!info.pid) return this;

      if (this.pid && info.pid !== this.pid) {
        throw new Error("Cannot add view info for a different member PID");
      }

      this.viewServiceEntity = {
        ...(this.viewServiceEntity || {}),
        ...info,
      };
      this.addSources(["viewService"]);

      if (!this.fileName && info.fileName) this.fileName = info.fileName;
      if (!this.title && info.entityName) this.title = info.entityName;

      return this;
    }

    /**
     * Normalize a rendered metadata entity summary for matching and merging.
     * Identifiers follow the same conventions as {@link ViewServiceDoc} so the
     * summary can be matched against member PIDs.
     * @param {object} [viewInfo] Entity summary from ViewServiceDoc
     * @returns {object} Normalized summary with a normalized `pid` (or null)
     */
    static normalizeViewInfo(viewInfo = {}) {
      return {
        ...viewInfo,
        pid: ViewServiceDoc.normalizeIdentifier(
          viewInfo.pid || viewInfo.identifier || viewInfo.id,
        ),
        fileName:
          Values.normalizeText(viewInfo.fileName || viewInfo.objectName) ||
          null,
        entityName: Values.normalizeText(viewInfo.entityName) || null,
        objectUrl: Values.normalizeText(viewInfo.objectUrl) || null,
      };
    }

    /**
     * Merge enrichment data without overwriting editable lifecycle state.
     * @param {DataPackageMember|object} packageMember Member data to merge
     * @returns {DataPackageMember} This member
     * @throws {Error} When the incoming member has a different PID
     */
    merge(packageMember) {
      const incomingMember = DataPackageMember.from(packageMember);
      const newData = incomingMember.toJSON();
      if (this.pid !== newData.pid) {
        throw new Error("Cannot merge DataPackageMember with different pid");
      }
      const incomingFromParsedResourceMap =
        incomingMember.sources.includes("resourceMap");

      Object.entries(newData).forEach(([key, value]) => {
        if (key === "pid") return; // never merge pid, it should be the same
        if (key === "sources") {
          this.addSources(value);
          return;
        }
        if (EDITABLE_STATE_FIELDS.has(key)) return;
        if (RESOURCE_MAP_RELATIONSHIP_FIELDS.has(key)) {
          if (incomingFromParsedResourceMap) {
            this[key] = Array.isArray(value) ? [...value] : value;
          }
          return;
        }
        if (Array.isArray(value)) {
          const existingArray = Array.isArray(this[key]) ? this[key] : [];
          this[key] = Array.from(new Set([...existingArray, ...value]));
        } else if (value && typeof value === "object") {
          this[key] = { ...(this[key] || {}), ...value };
        } else if (value !== undefined && value !== null) {
          // For primitive values, overwrite if new value is not undefined
          this[key] = value;
        } // else keep existing value
      });

      return this;
    }

    /**
     * Get the member ready for editing by initializing fields that are not set
     * by the manifest or Solr. It does not overwrite existing editable state.
     * @param {object} [state] Editable state values
     * @returns {DataPackageMember} This member
     */
    initializeEditableState(state = {}) {
      this.remotePid = Values.normalizeText(state.remotePid) || null;
      this.aggregatedPid = Values.normalizeText(state.aggregatedPid) || null;
      this.sysMeta = state.sysMeta ? new SystemMetadata(state.sysMeta) : null;
      this.remoteSysMeta = state.remoteSysMeta
        ? new SystemMetadata(state.remoteSysMeta)
        : null;
      this._remoteSysMetaDownloaded = false;
      this._remoteSysMetaParseWarnings = [];
      this.contentDirty = state.contentDirty === true;
      this.sysMetaDirty = state.sysMetaDirty === true;
      this.accessPolicyDirty = state.accessPolicyDirty === true;
      this.removed = state.removed === true;
      this.remoteState =
        state.remoteState ||
        (this.remotePid ? REMOTE_STATES.UPLOADED : REMOTE_STATES.UNKNOWN);
      this.lastUploadError = state.lastUploadError || null;
      this._replacementSourcePid = null;
      this._replacementSourceSysMeta = null;
      return this;
    }

    /**
     * Change the PID desired by the editable package without changing the
     * confirmed remote or last aggregated PID.
     * @param {string} pid Desired PID
     * @returns {DataPackageMember} This member
     * @throws {Error} When an ambiguous remote write is unresolved
     */
    setDesiredPid(pid) {
      if (this.remoteState === REMOTE_STATES.AMBIGUOUS) {
        throw new Error(
          "Resolve the ambiguous remote write before changing the desired PID",
        );
      }
      const desiredPid = Values.requireNonEmptyString(
        pid,
        "DataPackageMember.setDesiredPid requires a PID",
      );
      this.pid = desiredPid;
      if (desiredPid !== this.remotePid) this.contentDirty = true;
      this.removed = false;
      if (this.contentDirty) this.remoteState = REMOTE_STATES.PENDING;
      return this;
    }

    /**
     * Attach desired object bytes.
     * @param {Blob|File} file File or Blob to upload
     * @returns {DataPackageMember} This member
     * @throws {Error} When the write is ambiguous or the file is invalid
     */
    setLocalFile(file) {
      if (this.remoteState === REMOTE_STATES.AMBIGUOUS) {
        throw new Error(
          "Resolve the ambiguous remote write before changing local content",
        );
      }
      DataPackageMember.validateLocalFile(file);
      this.uploadFile = file;
      this.contentDirty = true;
      this.removed = false;
      this.remoteState = REMOTE_STATES.PENDING;
      if (typeof file.size === "number") this.size = file.size;
      if (file.name) this.fileName = file.name;
      this.sysMeta?.checksum.clear();
      this.checksum = null;
      this.checksumAlgorithm = null;
      return this;
    }

    /**
     * Validate file content before allocating identifiers or editing state.
     * @param {Blob|File} file File or Blob to validate
     * @returns {Blob|File} Validated file
     * @throws {Error} When the value is not a non empty Blob or File
     */
    static validateLocalFile(file) {
      if (!(file instanceof Blob)) {
        throw new Error(
          "DataPackageMember.setLocalFile requires a Blob or File",
        );
      }
      if (file.size === 0) {
        throw new Error("Cannot upload an empty file");
      }
      return file;
    }

    /**
     * Build fresh System Metadata for a create or content update.
     * @param {object} [defaults] Values not already present on the member
     * @param {boolean} [defaults.useBlobMediaType] Whether to infer mediaType
     * from generated Blob content
     * @param {SystemMetadata|object} [desiredSystemMetadata] Prepared desired
     * values to use instead of the member's stored source baseline
     * @returns {Promise<SystemMetadata>} Desired System Metadata
     * @throws {Error} When object content is missing or empty
     */
    async buildObjectSystemMetadata(
      defaults = {},
      desiredSystemMetadata = null,
    ) {
      let blob = this.uploadFile;
      if (!(blob instanceof Blob) && this.objectModel?.serialize) {
        // Serialize at the desired PID so the embedded identifier (for example
        // an EML packageId) matches the upload, without mutating the model.
        const serialized = await this.objectModel.serialize({
          packageId: this.pid,
        });
        blob =
          serialized instanceof Blob
            ? serialized
            : new Blob([serialized], { type: defaults.contentType || "" });
      }
      if (!(blob instanceof Blob) && this.rawData !== undefined) {
        blob =
          this.rawData instanceof Blob
            ? this.rawData
            : new Blob([this.rawData], { type: defaults.contentType || "" });
      }
      if (!(blob instanceof Blob)) {
        throw new Error("Cannot build System Metadata without object content");
      }
      if (blob.size === 0) {
        throw new Error("Cannot upload an empty object");
      }

      const checksum = await Values.calculateBlobChecksum(blob, {
        algorithm: defaults.checksumAlgorithm || "MD5",
        signal: defaults.signal,
        onProgress: defaults.onProgress,
      });
      const replacementSourceValues =
        this._replacementSourceSysMeta?.toJSON?.() ||
        this._replacementSourceSysMeta ||
        null;
      const preparedValues =
        desiredSystemMetadata?.toJSON?.() || desiredSystemMetadata || null;
      const desiredValues =
        preparedValues ||
        replacementSourceValues ||
        this.sysMeta?.toJSON() ||
        this.remoteSysMeta?.toJSON() ||
        this;
      const desiredAccessPolicy = desiredValues.accessPolicy;
      const hasDesiredAccessPolicy =
        desiredAccessPolicy !== undefined && desiredAccessPolicy !== null;
      const accessPolicyWasExplicitlySet =
        this.accessPolicyDirty ||
        (this.remotePid && hasDesiredAccessPolicy) ||
        Boolean(desiredAccessPolicy?.length);
      const mediaType =
        defaults.mediaType ||
        (defaults.useBlobMediaType === false
          ? desiredValues.mediaType || null
          : blob.type || desiredValues.mediaType || null);
      const replacementFileNameChanged =
        this._replacementDisplay &&
        this.fileName !== this._replacementDisplay.fileName;
      const fileName =
        preparedValues && !replacementFileNameChanged
          ? preparedValues.fileName
          : this.fileName || desiredValues.fileName;
      const sysMeta = new SystemMetadata({
        identifier: this.pid,
        formatId: this.formatId || defaults.formatId,
        size: blob.size,
        checksum,
        submitter: desiredValues.submitter || defaults.submitter,
        rightsHolder: desiredValues.rightsHolder || defaults.rightsHolder,
        // Use the default only for a new object with no explicit policy. An
        // empty policy on an existing object, or one deliberately made
        // private, must remain empty when its content is versioned.
        accessPolicy: accessPolicyWasExplicitlySet
          ? desiredAccessPolicy
          : defaults.accessPolicy,
        replicationPolicy:
          desiredValues.replicationPolicy ?? defaults.replicationPolicy,
        obsoletes: this._replacementSourcePid || this.remotePid,
        obsoletedBy: null,
        archived:
          desiredValues.archived === true || defaults.archived === true
            ? true
            : null,
        authoritativeMemberNode:
          desiredValues.authoritativeMemberNode ||
          defaults.authoritativeMemberNode,
        seriesId: desiredValues.seriesId || defaults.seriesId,
        fileName: fileName || defaults.fileName || this.uploadFile?.name,
        mediaType,
      });
      sysMeta.serialize();

      this.uploadFile = blob;
      this.sysMeta = sysMeta;
      this.sysMetaDirty = true;
      this.fileName = sysMeta.fileName || null;
      this.size = blob.size;
      this.checksum = checksum.value;
      this.checksumAlgorithm = checksum.algorithm;
      return sysMeta;
    }

    /**
     * Build an update limited to System Metadata from the confirmed remote
     * baseline.
     * @param {SystemMetadata} [freshRemoteSysMeta] Fresh preflight baseline
     * @returns {SystemMetadata} Desired System Metadata
     * @throws {Error} When remote or desired system metadata is missing
     */
    buildSystemMetadataUpdate(freshRemoteSysMeta = null) {
      if (!freshRemoteSysMeta && !this.remoteSysMeta) {
        throw new Error(
          "Cannot build a System Metadata update without remote System Metadata",
        );
      }
      if (!this.sysMeta) {
        throw new Error(
          "Cannot build a System Metadata update without desired System Metadata",
        );
      }

      if (freshRemoteSysMeta) {
        this._rebaseSystemMetadata(freshRemoteSysMeta);
      }

      const values = this.remoteSysMeta.toJSON();
      const desiredValues = this.sysMeta.toJSON();
      // After rebasing, desiredValues contains the fresh remote values plus
      // only the mutable fields that were deliberately changed in the draft.
      MUTABLE_SYSTEM_METADATA_FIELDS.forEach((field) => {
        values[field] = desiredValues[field];
      });
      const sysMeta = new SystemMetadata(values);
      sysMeta.serialize();

      this.sysMeta = sysMeta;
      this.sysMetaDirty = true;
      return sysMeta;
    }

    /**
     * Serialize desired System Metadata for upload.
     * @returns {string} Canonical System Metadata XML
     * @throws {Error} When system metadata is missing
     */
    serializeSystemMetadata() {
      if (!this.sysMeta) {
        throw new Error("Cannot serialize missing System Metadata");
      }
      return this.sysMeta.serialize();
    }

    /**
     * Return the fields used to verify an ambiguous object write: enough to
     * confirm the target PID exists with the intended bytes.
     * @param {object} [options] Verification options
     * @param {boolean} [options.includeMutableFields] Include mutable fields
     * @returns {object} Verification fields
     */
    getSystemMetadataVerificationFields({ includeMutableFields = false } = {}) {
      if (!this.sysMeta) return null;
      const sysMeta = this.sysMeta.toJSON();
      const verification = {
        identifier: sysMeta.identifier,
        checksum: {
          value: sysMeta.checksum,
          algorithm: sysMeta.checksumAlgorithm,
        },
      };
      if (includeMutableFields) {
        verification.mutableFields = Object.fromEntries(
          MUTABLE_SYSTEM_METADATA_FIELDS.map((field) => [
            field,
            sysMeta[field],
          ]),
        );
      }
      return verification;
    }

    /**
     * Validate the member's desired object content before upload.
     * @returns {object[]} Validation issues (empty when valid)
     */
    validateContent() {
      if (this.uploadFile instanceof Blob) {
        try {
          DataPackageMember.validateLocalFile(this.uploadFile);
        } catch (error) {
          return [{ pid: this.pid, message: error.message }];
        }
        return [];
      }
      const model = this.objectModel;
      if (model && typeof model.isValid === "function" && !model.isValid()) {
        return [
          {
            pid: this.pid,
            message: "Invalid metadata content",
            errors: model.validationError || null,
          },
        ];
      }
      return [];
    }

    /**
     * Serialize the member's desired object content for upload. Cached upload
     * bytes are returned as is so the payload matches the computed checksum;
     * otherwise the attached object model is serialized at the desired PID.
     * @param {object} [options] Serialization options
     * @param {string} [options.pid] Desired PID to embed (for example, an EML
     * packageId)
     * @returns {Promise<Blob|string>} Serialized content
     * @throws {Error} When the member has no serializable content
     */
    async serializeContent({ pid = this.pid } = {}) {
      if (this.uploadFile instanceof Blob) {
        return this.uploadFile;
      }
      const model = this.objectModel;
      if (model && typeof model.serialize === "function") {
        return model.serialize({ packageId: pid });
      }
      if (this.rawData !== undefined && this.rawData !== null) {
        return this.rawData;
      }
      throw new Error(
        `Cannot serialize content for member ${this.pid} without object content`,
      );
    }

    /**
     * Set desired System Metadata.
     * @param {SystemMetadata|object|null} sysMeta Desired System Metadata
     * @param {object} [options] Update options
     * @param {boolean} [options.markDirty] Whether this is a local edit
     * @returns {DataPackageMember} This member
     * @throws {Error} When an ambiguous remote write is unresolved
     */
    setSystemMetadata(sysMeta, { markDirty = true } = {}) {
      if (markDirty && this.remoteState === REMOTE_STATES.AMBIGUOUS) {
        throw new Error(
          "Resolve the ambiguous remote write before changing System Metadata",
        );
      }
      this.sysMeta = sysMeta ? new SystemMetadata(sysMeta) : null;
      this.sysMetaDirty = markDirty === true;
      if (!markDirty) {
        this.remoteSysMeta = this.sysMeta?.clone() || null;
        this._remoteSysMetaDownloaded = false;
        this._remoteSysMetaParseWarnings = [];
      } else if (this.contentDirty) {
        this.remoteState = REMOTE_STATES.PENDING;
      }
      return this;
    }

    /**
     * Mark the member for removal from the package.
     * @returns {DataPackageMember} This member
     */
    markRemoved() {
      this.removed = true;
      return this;
    }

    /**
     * Mark the member's remote write as in progress.
     * @returns {DataPackageMember} This member
     */
    markRemoteUploading() {
      this.remoteState = REMOTE_STATES.UPLOADING;
      this.lastUploadError = null;
      return this;
    }

    /**
     * Record a confirmed remote write and clear local dirty state.
     * @param {object} [options] Confirmation details
     * @param {string} [options.pid] Confirmed remote PID
     * @param {object} [options.response] DataONE write response
     * @param {SystemMetadata|object} [options.sysMeta] Confirmed system metadata
     * @returns {DataPackageMember} This member
     * @throws {Error} When the confirmed PID is missing or does not match
     */
    markRemoteSuccess({ pid = null, response = null, sysMeta = null } = {}) {
      const confirmedPid = Values.requireNonEmptyString(
        response ? response?.data?.identifier : pid || this.pid,
        response
          ? "Upload response did not include an identifier"
          : "DataPackageMember.markRemoteSuccess requires a PID",
      );
      if (confirmedPid !== this.pid) {
        throw new Error(
          response
            ? "Upload response identifier does not match desired PID"
            : "Confirmed remote PID does not match desired PID",
        );
      }
      this.remotePid = confirmedPid;
      const confirmedSysMeta = sysMeta || this.sysMeta;
      this.sysMeta = confirmedSysMeta
        ? new SystemMetadata(confirmedSysMeta)
        : null;
      // A caller-supplied sysMeta is server-confirmed (ambiguous-write
      // verification), so it is a trustworthy remote baseline. The sysMeta we
      // built locally for a write is not: the server assigns serialVersion,
      // dateUploaded, and dateSysMetadataModified on write. Drop the remote
      // baseline in that case so the next edit re-fetches a fresh one before
      // building another System Metadata update.
      this.remoteSysMeta = sysMeta ? this.sysMeta.clone() : null;
      this._remoteSysMetaDownloaded = Boolean(sysMeta);
      this._remoteSysMetaParseWarnings = sysMeta?.parseWarnings
        ? [...sysMeta.parseWarnings]
        : [];
      // Upload bytes are scoped to the confirmed write. Future model-backed
      // saves must serialize the current objectModel instead of replaying them.
      this.uploadFile = null;
      this.contentDirty = false;
      this.sysMetaDirty = false;
      this.accessPolicyDirty = false;
      this.remoteState = REMOTE_STATES.UPLOADED;
      this.lastUploadError = null;
      this._replacementDisplay = null;
      this._replacementSourcePid = null;
      this._replacementSourceSysMeta = null;
      return this;
    }

    /**
     * Record a failed or ambiguous remote write.
     * @param {Error} error Write error
     * @param {object} [options] Failure options
     * @param {boolean} [options.ambiguous] Whether the write may have committed
     * @returns {DataPackageMember} This member
     */
    markRemoteFailure(error, { ambiguous = false } = {}) {
      this.remoteState = ambiguous
        ? REMOTE_STATES.AMBIGUOUS
        : REMOTE_STATES.FAILED;
      this.lastUploadError = error || null;
      return this;
    }

    /**
     * Align the aggregated PID with confirmed remote state.
     * @returns {DataPackageMember} This member
     * @throws {Error} When an active member is not confirmed remote
     */
    promoteAggregatedState() {
      if (!this.removed && this.pid !== this.remotePid) {
        throw new Error("Cannot aggregate a PID that is not confirmed remote");
      }
      this.aggregatedPid = this.removed ? null : this.pid;
      return this;
    }

    /**
     * Return the remote operation required by the member's dirty state.
     * @returns {string} Required operation
     */
    getRequiredOperation() {
      if (this.removed) return REQUIRED_OPERATIONS.REMOVE;
      if (this.contentDirty) {
        return this.remotePid
          ? REQUIRED_OPERATIONS.UPDATE
          : REQUIRED_OPERATIONS.CREATE;
      }
      if (this.sysMetaDirty) {
        return REQUIRED_OPERATIONS.UPDATE_SYSTEM_METADATA;
      }
      return REQUIRED_OPERATIONS.NONE;
    }

    /**
     * Return the best available member file name.
     * @returns {string|null} File name, or null
     */
    getFileName() {
      return (
        this.fileName ||
        this.filename ||
        this.sysMeta?.fileName ||
        this.viewServiceEntity?.fileName ||
        null
      );
    }

    /**
     * Inject the loaded ObjectFormats collection so this member can classify
     * its format type synchronously. Excluded from toJSON()/merge() so the
     * collection is never serialized or copied between members.
     * @param {ObjectFormats} objectFormats Loaded ObjectFormats collection
     * @returns {DataPackageMember} This member
     */
    setObjectFormats(objectFormats) {
      this.objectFormats = objectFormats || null;
      return this;
    }

    /**
     * Collect the format fields used for object format classification.
     * @returns {{formatType: string, formatId: string, mediaType: string, filename: string}} Format fields
     */
    getFormatProperties() {
      const sysMetaMediaType = this.sysMeta?.mediaType;
      const memberMediaType = this.mediaType;
      const sysMetaMediaTypeName =
        typeof sysMetaMediaType === "object"
          ? sysMetaMediaType?.name
          : sysMetaMediaType;
      const memberMediaTypeName =
        typeof memberMediaType === "object"
          ? memberMediaType?.name
          : memberMediaType;
      return {
        formatType: Values.normalizeText(this.formatType) || "",
        formatId:
          Values.normalizeText(this.sysMeta?.formatId) ||
          Values.normalizeText(this.formatId) ||
          "",
        mediaType:
          Values.normalizeText(sysMetaMediaTypeName) ||
          Values.normalizeText(memberMediaTypeName) ||
          "",
        filename: Values.normalizeText(this.getFileName()) || "",
      };
    }

    /**
     * Return the member's DataONE format type.
     * @returns {string|null} Format type, or null when unknown
     */
    getFormatType() {
      const props = this.getFormatProperties();
      // A member known only by PID (e.g. an unresolved or private object) has
      // no format signal at all: its type is unknown. Don't let ObjectFormats
      // default it to octet-stream/DATA, which would leak such members into
      // getData() and the file table.
      if (
        !props.formatType &&
        !props.formatId &&
        !props.mediaType &&
        !props.filename
      ) {
        return null;
      }
      // Prefer the injected format list (needed to derive a type from a
      // formatId/extension). Without it, trust an explicit formatType.
      if (this.objectFormats) return this.objectFormats.getFormatType(props);
      return props.formatType || null;
    }

    /**
     * Return the member's object format identifier.
     * @returns {string|null} Format identifier, or null
     */
    getFormatId() {
      const props = this.getFormatProperties();
      if (this.objectFormats) return this.objectFormats.getFormatId(props);
      return props.formatId || null;
    }

    /**
     * Check whether the member is science metadata.
     * @returns {boolean} Whether the member is metadata
     */
    isMetadata() {
      const props = this.getFormatProperties();
      const objectFormats = this.objectFormats || FALLBACK_OBJECT_FORMATS;
      return objectFormats.isMetadata(props) || objectFormats.isEML(props);
    }

    /**
     * Check whether the member is a data object.
     * @returns {boolean} Whether the member is data
     */
    isData() {
      const props = this.getFormatProperties();
      if (
        !props.formatType &&
        !props.formatId &&
        !props.mediaType &&
        !props.filename
      ) {
        return false;
      }
      const objectFormats = this.objectFormats || FALLBACK_OBJECT_FORMATS;
      return objectFormats.isData(props);
    }

    /**
     * Check whether the member is a resource map.
     * @returns {boolean} Whether the member is a resource map
     */
    isResourceMap() {
      const props = this.getFormatProperties();
      const objectFormats = this.objectFormats || FALLBACK_OBJECT_FORMATS;
      return props.formatId
        ? objectFormats.isResourceMap(props)
        : objectFormats.isResource(props);
    }

    /**
     * Check whether the member uses an EML format.
     * @returns {boolean} Whether the member is EML
     */
    isEML() {
      const objectFormats = this.objectFormats || FALLBACK_OBJECT_FORMATS;
      return objectFormats.isEML(this.getFormatProperties());
    }

    /**
     * Check whether the member is an index placeholder.
     * @returns {boolean} Whether the member is a placeholder
     */
    isPlaceholder() {
      return this.isPlaceHolder_b === true;
    }

    /**
     * Check whether the member's access policy is public.
     * @returns {Promise<boolean|null>} Public state, or null when unknown
     */
    async isPublic() {
      if (!this.sysMeta) {
        try {
          await this.fetchSysMeta();
        } catch (error) {
          if (error?.status === 401 || error?.status === 403) return false;
          return null;
        }
      }
      const accessPolicy = this.sysMeta?.accessPolicy;
      if (!accessPolicy) return null;
      return accessPolicy.isPublic();
    }

    /**
     * Serialize member state without runtime services, models, or upload bytes.
     * @returns {object} Serializable member state
     */
    toJSON() {
      const json = {};
      Object.entries(this).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          key.startsWith("_") ||
          key === "uploadFile" ||
          key === "objectModel" ||
          key === "objectFormats" ||
          key === "events" ||
          key === "rawData" ||
          typeof value === "function" ||
          value instanceof AuthorizationService ||
          value instanceof ObjectService ||
          value instanceof SysMetaService ||
          (typeof Blob !== "undefined" && value instanceof Blob)
        ) {
          return;
        }
        if (value instanceof Error) {
          json[key] = {
            name: value.name,
            message: value.message,
            code: value.code,
            status: value.status,
          };
          return;
        }
        const serializable =
          typeof value.toJSON === "function" ? value.toJSON() : value;
        if (serializable === undefined) return;
        if (serializable === null || typeof serializable !== "object") {
          json[key] = serializable;
          return;
        }
        try {
          json[key] = JSON.parse(JSON.stringify(serializable));
        } catch (_error) {
          // Complex runtime-only values are intentionally omitted.
        }
      });

      const fileName = this.getFileName();
      if (fileName) json.fileName = fileName;

      const { formatId } = this.getFormatProperties();
      if (formatId) json.formatId = formatId;

      const sysMeta = json.sysMeta || {};
      if (!json.checksum && sysMeta.checksum) {
        json.checksum = sysMeta.checksum;
      }
      if (!json.checksumAlgorithm && sysMeta.checksumAlgorithm) {
        json.checksumAlgorithm = sysMeta.checksumAlgorithm;
      }
      return json;
    }

    /**
     * Check the current user's permission for this member. Results are cached
     * in memory on the member, keyed by user subject.
     * @param {string} [action] Permission action. Defaults to "write"
     * @param {object|boolean} [options] Options or refresh boolean
     * @param {boolean} [options.refresh] Whether to bypass the cache and check again
     * @param {AbortSignal} [options.signal] Signal used to cancel permission checks
     * @param {AuthorizationService} [authorizationService] Service used to
     * resolve the current user and check permission
     * @returns {Promise<boolean>} Permission result
     */
    async checkPermission(
      action = "write",
      options = {},
      authorizationService = null,
    ) {
      const opts =
        typeof options === "boolean" ? { refresh: options } : options || {};
      const authOpts = { ...(opts.auth || {}) };
      const requestOptions = { ...authOpts };
      if (opts.signal) requestOptions.signal = opts.signal;

      const service =
        authorizationService || new AuthorizationService(authOpts);
      const user = await service.getUserKey();
      this.permissions = this.permissions || {};
      if (!this.permissions[user]) {
        this.permissions[user] = {};
      }
      if (
        opts.refresh !== true &&
        Values.hasOwn(this.permissions[user], action) &&
        typeof this.permissions[user][action] === "boolean"
      ) {
        return this.permissions[user][action];
      }
      let can;
      try {
        can = await service.check(this.pid, action, requestOptions);
      } catch (error) {
        if (ErrorUtilities.isAbortError(error)) return false;
        // eslint-disable-next-line no-console
        console.error(
          `Error checking ${action} permission for PID ${this.pid}:`,
          error,
        );
        return false;
      }
      this.permissions[user][action] = can;
      return can;
    }

    /**
     * Check write permission for the current user.
     * @param {object|boolean} [options] Options or refresh boolean
     * @param {AuthorizationService} [authorizationService] Service used to
     * resolve the current user and check permission
     * @returns {Promise<boolean>} Write permission result
     */
    checkWritePermission(options = {}, authorizationService = null) {
      return this.checkPermission("write", options, authorizationService);
    }

    // See XMLUtilities.getXMLSafeID().
    getXMLSafeID() {
      return XMLUtilities.getXMLSafeID(this.pid);
    }
  }

  DataPackageMember.RemoteState = REMOTE_STATES;
  DataPackageMember.RequiredOperation = REQUIRED_OPERATIONS;
  DataPackageMember.ResourceMapGraphFields = RESOURCE_MAP_GRAPH_FIELDS;

  return DataPackageMember;
});
