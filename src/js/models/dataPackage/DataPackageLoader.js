"use strict";

/* eslint-disable no-param-reassign */
// Disable because we are purposefully mutating the dataPackage passed in to these methods.

define([
  "common/QueryService",
  "common/ErrorUtilities",
  "common/Utilities",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapResolver",
  "collections/ObjectFormats",
], (
  QueryService,
  ErrorUtilities,
  Utilities,
  Values,
  ResourceMapResolver,
  ObjectFormats,
) => {
  const DEFAULT_ROWS = 1000;
  const LOAD_PHASES = Object.freeze({
    OBJECT_FORMATS: "objectFormats",
    RESOLVE: "resolve",
    RESOURCE_MAP_MEMBERSHIP: "resourceMapMembership",
    RESOURCE_MAP_DOWNLOAD: "resourceMapDownload",
    RESOURCE_MAP_SUMMARY: "resourceMapSummary",
    INDEX_MANIFEST: "indexManifest",
    MISSING_SYSTEM_METADATA: "missingSystemMetadata",
    EDITABLE_BASELINE: "editableBaseline",
    EDITABLE_METADATA: "editableMetadata",
  });
  const ERROR_MSGS = Object.freeze({
    MISSING_PID: "DataPackage resolution requires a PID",
  });
  const SOLR_MANIFEST_FIELDS = Object.freeze([
    "id",
    "seriesId",
    "resourceMap",
    "documents",
    "isDocumentedBy",
    "fileName",
    "obsoletes",
    "obsoletedBy",
    "size",
    "formatType",
    "formatId",
    "datasource",
    "rightsHolder",
    "dateUploaded",
    "archived",
    "title",
    "origin",
    "prov_instanceOfClass",
    "isPlaceHolder_b",
  ]);
  const { FORMAT_IDS, FORMAT_TYPES } = ObjectFormats.prototype;
  const RESOURCE_MAP_FORMAT_ID = FORMAT_IDS.RESOURCE_MAP;
  const { isAbortError, throwIfAborted } = ErrorUtilities;
  let DataPackageLoader;

  /**
   * Classify a ResourceMap resolver result without changing package state.
   * @param {object} resolverResult ResourceMap resolver result
   * @param {string} inputId Input PID or SID
   * @returns {object} Structured DataPackage resolution result
   */
  function classifyResolverResult(resolverResult, inputId) {
    const meta = resolverResult.meta || {};
    const candidateMetadataPids = meta.metadataCandidates || [];
    const resolvedPid = resolverResult.pid || inputId;
    const result = {
      success: false,
      type: meta.formatType || null,
      isData: meta.isData || false,
      isMetadata: meta.isMetadata || false,
      isResourceMap: meta.isResourceMap || false,
      resolvedPid,
    };

    if (resolverResult.multipleRMs) {
      result.multipleRMs = true;
      result.candidateResourceMapPids = meta.rms || [];
      result.candidateMetadataPids = candidateMetadataPids;
    }
    if (resolverResult.unauthorized) result.unauthorized = true;

    return result;
  }

  /**
   * Seed package members and identity fields from a resolver result.
   * @param {DataPackage} dataPackage Package being loaded
   * @param {object} resolverResult ResourceMap resolver result
   * @param {object} result Structured DataPackage resolution result
   * @returns {void}
   */
  function seedResolvedPackageIdentity(dataPackage, resolverResult, result) {
    const meta = resolverResult.meta || {};
    const candidateMetadataPids = meta.metadataCandidates || [];
    const { indexMatch } = meta;
    const idMatch = indexMatch?.id;
    const { resolvedPid } = result;
    const addOptions = { merge: true, sources: ["resourceMapResolver"] };

    if (indexMatch) {
      dataPackage.members.add({ pid: idMatch, ...indexMatch }, addOptions);
    }
    if (idMatch !== resolvedPid) {
      dataPackage.members.add({ pid: resolvedPid }, addOptions);
    }
    if (result.isMetadata && resolvedPid) {
      dataPackage.primaryMetadataPid = resolvedPid;
    } else if (candidateMetadataPids.length === 1) {
      const [candidateMetadataPid] = candidateMetadataPids;
      dataPackage.primaryMetadataPid = candidateMetadataPid;
    }

    if (resolverResult.rm) {
      dataPackage.members.add(
        {
          pid: resolverResult.rm,
          formatId: RESOURCE_MAP_FORMAT_ID,
          formatType: FORMAT_TYPES.RESOURCE,
        },
        addOptions,
      );
      dataPackage.rootResourceMapPid = resolverResult.rm;
      result.success = true;
    }
  }

  /**
   * Classify an unresolved object from its system metadata.
   * @param {DataPackage} dataPackage Package being loaded
   * @param {ResourceMapResolver} resolver Resolver used for the initial lookup
   * @param {object} result Structured DataPackage resolution result
   * @param {object} [options] Fallback options
   * @param {AbortSignal} [options.signal] Abort signal
   * @returns {Promise<void>} Resolves after the fallback attempt
   */
  async function applySystemMetadataFallback(
    dataPackage,
    resolver,
    result,
    { signal } = {},
  ) {
    const { resolvedPid } = result;
    try {
      const sysMeta = await resolver.getSysMeta(resolvedPid, { signal });
      throwIfAborted(signal, "Data package resolution cancelled");
      if (!sysMeta) {
        result.notFound = true;
        return;
      }

      dataPackage.members.add(sysMeta, {
        merge: true,
        sources: ["sysMeta"],
      });
      const objectFormats =
        await DataPackageLoader.ensureObjectFormats(dataPackage);
      throwIfAborted(signal, "Data package resolution cancelled");
      const formatType = objectFormats.getFormatType(sysMeta);
      result.type = formatType || null;
      result.isData = formatType === FORMAT_TYPES.DATA;
      result.isMetadata = formatType === FORMAT_TYPES.METADATA;
      result.isResourceMap = sysMeta.formatId
        ? objectFormats.isResourceMap(sysMeta)
        : formatType === FORMAT_TYPES.RESOURCE;
      if (formatType) {
        dataPackage.members.add(
          {
            pid: resolvedPid,
            formatId: sysMeta.formatId,
            formatType,
          },
          { merge: true, sources: ["sysMeta"] },
        );
      }
      result.isIndexing = true;
      if (result.isResourceMap) {
        result.success = true;
        dataPackage.rootResourceMapPid = resolvedPid;
      } else if (result.isMetadata) {
        dataPackage.primaryMetadataPid = resolvedPid;
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error?.status === 401 || error?.status === 403) {
        result.isPrivate = true;
      } else if (error?.status === 404) {
        result.notFound = true;
      } else {
        // eslint-disable-next-line no-console
        console.error(`Error fetching sysMeta for PID ${resolvedPid}:`, error);
        result.error = error;
      }
    }
  }

  /**
   * Resolve and load authoritative ResourceMap membership for editing.
   * @param {DataPackage} dataPackage Package being loaded
   * @param {string} pid Input PID or SID for any package member
   * @param {object} [options] Load options
   * @param {AbortSignal} [options.signal] Abort signal
   * @returns {Promise<DataPackageMember>} Root ResourceMap member
   * @throws {Error} When authoritative membership cannot be loaded
   */
  async function loadEditableResourceMapMembership(
    dataPackage,
    pid,
    options = {},
  ) {
    const { signal } = options;
    try {
      await dataPackage.resolveFromPid(pid, options);
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (Array.isArray(error?.issues) && error.issues.length) {
        throw DataPackageLoader.resourceMapNotEditableError({
          inputId: dataPackage.inputId || pid,
          rootResourceMapPid:
            error?.details?.resourceMapPid || error?.resourceMapPid || null,
          issues: error.issues,
          cause: error,
        });
      }
      throw error;
    }

    const resourceMapMember = dataPackage.getRootResourceMapMember();
    if (!resourceMapMember) {
      const resolution = dataPackage.resolutionResult || {};
      // Only a clean, unambiguous miss is safe to repair as orphaned metadata.
      let reason = "missing";
      if (resolution.multipleRMs) {
        reason = null;
      } else if (resolution.unauthorized || resolution.isPrivate) {
        reason = "unauthorized";
      } else if (resolution.error) {
        reason = "error";
      }
      throw DataPackageLoader.resourceMapUnavailableError({
        inputId: dataPackage.inputId,
        reason,
        httpStatus: resolution.error?.status ?? null,
        cause: resolution.error || null,
      });
    }

    let resourceMapResult;
    try {
      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.RESOURCE_MAP_MEMBERSHIP,
        {
          inputId: dataPackage.inputId,
        },
      );
      resourceMapResult = await dataPackage.getManifestFromResourceMap({
        merge: true,
        requireEditable: true,
        signal,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error?.code === "resource_map_not_editable") throw error;
      resourceMapResult = {
        ok: false,
        reason: "error",
        httpStatus: error?.status ?? null,
        error,
      };
    }
    if (!resourceMapResult?.ok) {
      throw DataPackageLoader.resourceMapUnavailableError({
        inputId: dataPackage.inputId,
        rootResourceMapPid: resourceMapMember.pid,
        reason: resourceMapResult?.reason || null,
        httpStatus: resourceMapResult?.httpStatus ?? null,
        cause: resourceMapResult?.error || null,
      });
    }

    dataPackage.members.retain(
      dataPackage.members
        .getFromSource("resourceMap")
        .map((member) => member.pid),
    );
    return resourceMapMember;
  }

  /**
   * Enrich authoritative members and require primary metadata.
   * @param {DataPackage} dataPackage Package being loaded
   * @param {DataPackageMember} resourceMapMember Root ResourceMap member
   * @param {object} [options] Enrichment options
   * @param {number|null} [options.maxMembers] Maximum editable member count
   * @param {AbortSignal} [options.signal] Abort signal
   * @returns {Promise<DataPackageMember>} Primary metadata member
   * @throws {Error} When the member limit or baseline requirement fails
   */
  async function enrichEditableMembers(
    dataPackage,
    resourceMapMember,
    { maxMembers = null, signal } = {},
  ) {
    const memberCount = dataPackage.members.getActiveMembers().length;
    if (maxMembers && memberCount > maxMembers) {
      throw DataPackageLoader.memberLimitExceededError({
        inputId: dataPackage.inputId,
        rootResourceMapPid: resourceMapMember.pid,
        memberCount,
        maxMembers,
      });
    }

    await dataPackage.getManifestFromIndex({
      merge: true,
      onlyExisting: true,
      rows: maxMembers || DEFAULT_ROWS,
      signal,
    });

    const unclassifiedPids = dataPackage.members
      .getActiveMembers()
      .filter((member) => !member.getFormatType())
      .map((member) => member.pid);
    if (unclassifiedPids.length) {
      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.MISSING_SYSTEM_METADATA,
        {
          count: unclassifiedPids.length,
        },
      );
      const failures = await dataPackage.fetchSysMeta(unclassifiedPids, {
        signal,
      });
      const abortFailure = failures.find(({ error }) => isAbortError(error));
      if (abortFailure) throw abortFailure.error;
      throwIfAborted(signal, "Editable package loading cancelled");
    }

    const primaryMetadata = dataPackage.getPrimaryMetadataMember();
    if (!primaryMetadata) {
      throw DataPackageLoader.editableBaselineUnavailableError({
        inputId: dataPackage.inputId,
        rootResourceMapPid: resourceMapMember.pid,
        missingMembers: ["primaryMetadata"],
      });
    }
    return primaryMetadata;
  }

  /**
   * Load baseline system metadata and initialize editable member state.
   * @param {DataPackage} dataPackage Package being loaded
   * @param {DataPackageMember} resourceMapMember Root ResourceMap member
   * @param {DataPackageMember} primaryMetadata Primary metadata member
   * @param {object} [options] Initialization options
   * @param {AbortSignal} [options.signal] Abort signal
   * @param {boolean} [options.fetchPrimaryMetadata] Whether to fetch metadata
   * content
   * @returns {Promise<void>} Resolves when editable state is ready
   * @throws {Error} When required system metadata is unavailable
   */
  async function initializeEditableBaseline(
    dataPackage,
    resourceMapMember,
    primaryMetadata,
    { signal, fetchPrimaryMetadata = false } = {},
  ) {
    const baselineMembers = [resourceMapMember, primaryMetadata];
    const baselinePids = baselineMembers.map((member) => member.pid);
    await DataPackageLoader.reportLoadProgress(
      dataPackage,
      LOAD_PHASES.EDITABLE_BASELINE,
      { count: baselinePids.length },
    );
    const failures = await dataPackage.fetchSysMeta(baselinePids, { signal });
    const abortFailure = failures.find(({ error }) => isAbortError(error));
    if (abortFailure) throw abortFailure.error;
    throwIfAborted(signal, "Editable package loading cancelled");
    const failedPids = Values.dedupeStrings([
      ...failures.map(({ pid: failedPid }) => failedPid),
      ...baselineMembers
        .filter((member) => !member.sysMeta)
        .map((member) => member.pid),
    ]);
    if (failedPids.length) {
      throw DataPackageLoader.editableBaselineUnavailableError({
        inputId: dataPackage.inputId,
        rootResourceMapPid: resourceMapMember.pid,
        failedPids,
        causes: failures.map(({ error }) => error).filter(Boolean),
      });
    }

    dataPackage.members.toArray().forEach((member) => {
      member.initializeEditableState({
        remotePid: member.pid,
        aggregatedPid: member.pid,
        sysMeta: member.sysMeta,
        remoteSysMeta: member.sysMeta,
      });
    });

    if (fetchPrimaryMetadata && !primaryMetadata.objectModel) {
      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.EDITABLE_METADATA,
      );
      await primaryMetadata.fetchObject({ signal });
    }
  }

  /**
   * Load and enrich data packages from resource maps and the Solr index.
   * @namespace DataPackageLoader
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  DataPackageLoader = {
    LoadPhases: LOAD_PHASES,

    /**
     * Publish a package loading phase and give listeners a chance to paint
     * before the next expensive synchronous step.
     * @param {DataPackage} dataPackage Package being loaded
     * @param {string} phase Loading phase from
     * {@link DataPackageLoader.LoadPhases}
     * @param {object} [details] Additional progress details
     * @returns {Promise<void>} Resolves after the next animation frame, when
     * available
     */
    async reportLoadProgress(dataPackage, phase, details = {}) {
      if (!phase) return;
      dataPackage.events.trigger("load:progress", { ...details, phase });
      if (
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
      ) {
        await new Promise((resolve) => {
          window.requestAnimationFrame(resolve);
        });
      }
    },

    /**
     * Ensure a DataONE object format list is available and inject it into the
     * member collection so members can classify their format type synchronously.
     * @param {DataPackage} dataPackage Package being loaded
     * @returns {Promise<ObjectFormats>} The ObjectFormats collection
     */
    async ensureObjectFormats(dataPackage) {
      if (!dataPackage.objectFormats) {
        const objectFormats = await Utilities.awaitObjectFormats();
        if (typeof objectFormats?.getFormatType === "function") {
          dataPackage.objectFormats = objectFormats;
        } else if (Array.isArray(objectFormats) && objectFormats.length) {
          dataPackage.objectFormats = new ObjectFormats(objectFormats);
        } else {
          dataPackage.objectFormats = new ObjectFormats();
        }
        dataPackage.members.setObjectFormats(dataPackage.objectFormats);
      }
      return dataPackage.objectFormats;
    },

    /**
     * Resolve the single root resource map for an input PID. This seeds only
     * the input object and resolved resource map shell; package manifests are
     * loaded separately.
     * @param {DataPackage} dataPackage Package being loaded
     * @param {string} pid Input PID or SID
     * @param {object} [options] Resolver options
     * @returns {Promise<object>} Structured resolution result
     * @throws {Error} When resource map resolution fails
     */
    async resolveFromPid(dataPackage, pid, options = {}) {
      const { signal } = options;
      const inputId = Values.requireNonEmptyString(pid, ERROR_MSGS.MISSING_PID);
      dataPackage.inputId = inputId;
      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.OBJECT_FORMATS,
        { inputId },
      );
      await DataPackageLoader.ensureObjectFormats(dataPackage);
      throwIfAborted(signal, "Data package resolution cancelled");
      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.RESOLVE,
        { inputId },
      );
      const resolver = new ResourceMapResolver(options.resolverOptions || {});
      resolver.events.on("update", () => {
        DataPackageLoader.reportLoadProgress(dataPackage, LOAD_PHASES.RESOLVE, {
          inputId,
        });
      });
      const resolveOptions = { fields: SOLR_MANIFEST_FIELDS };
      if (signal) resolveOptions.signal = signal;
      const resMapResult = await resolver.resolve(inputId, resolveOptions);
      throwIfAborted(signal, "Data package resolution cancelled");

      const result = classifyResolverResult(resMapResult, inputId);
      result.inputId = inputId;
      seedResolvedPackageIdentity(dataPackage, resMapResult, result);

      if (!result.success && !resMapResult.meta?.indexMatch) {
        await applySystemMetadataFallback(dataPackage, resolver, result, {
          signal,
        });
      }

      if (!result.success) {
        resolver.trackMissingResourceMap(inputId);
      }
      dataPackage.resolutionResult = result;
      return result;
    },

    /**
     * Load an existing package into a deterministic editable baseline.
     * @param {DataPackage} dataPackage Package being loaded
     * @param {string} pid Input PID or SID for any package member
     * @param {object} [options] Load options
     * @returns {Promise<DataPackage>} Package once the editable baseline is
     * ready
     * @throws {Error} When an editable package baseline cannot be built
     */
    async loadEditablePackage(dataPackage, pid, options = {}) {
      const { signal } = options;
      const maxMembers = Values.normalizePositiveInteger(
        options.maxMembers,
        null,
      );

      const resourceMapMember = await loadEditableResourceMapMembership(
        dataPackage,
        pid,
        options,
      );
      const primaryMetadata = await enrichEditableMembers(
        dataPackage,
        resourceMapMember,
        { maxMembers, signal },
      );
      await initializeEditableBaseline(
        dataPackage,
        resourceMapMember,
        primaryMetadata,
        {
          signal,
          fetchPrimaryMetadata: options.fetchPrimaryMetadata,
        },
      );

      return dataPackage;
    },

    /**
     * Build the error thrown when an authoritative ResourceMap cannot be
     * loaded for editing.
     * @param {object} [details] Error details
     * @param {string} [details.inputId] Input PID being loaded
     * @param {string} [details.rootResourceMapPid] Root ResourceMap PID
     * @param {string} [details.reason] Failure reason
     * @param {number} [details.httpStatus] HTTP status, when known
     * @param {Error} [details.cause] Underlying error
     * @returns {Error} Error with `code === "resource_map_unavailable"`
     */
    resourceMapUnavailableError({
      inputId = null,
      rootResourceMapPid = null,
      reason = null,
      httpStatus = null,
      cause = null,
    } = {}) {
      const detail = reason || (httpStatus != null ? `HTTP ${httpStatus}` : "");
      const error = new Error(
        `Resource map unavailable for editable loading${
          inputId ? ` of "${inputId}"` : ""
        }${detail ? ` (${detail})` : ""}`,
      );
      error.code = "resource_map_unavailable";
      error.inputId = inputId;
      error.rootResourceMapPid = rootResourceMapPid;
      if (reason) error.reason = reason;
      if (httpStatus != null) error.httpStatus = httpStatus;
      if (cause) error.cause = cause;
      return error;
    },

    /**
     * Build the error thrown when a ResourceMap is available but its structured
     * RDF conflicts make normal editing unsafe.
     * @param {object} [details] Error details
     * @param {string} [details.inputId] Input PID being loaded
     * @param {string} [details.rootResourceMapPid] Root ResourceMap PID
     * @param {object[]} [details.issues] Blocking ResourceMap issues
     * @param {Error} [details.cause] Underlying ownership error
     * @returns {Error} Error with `code === "resource_map_not_editable"`
     */
    resourceMapNotEditableError({
      inputId = null,
      rootResourceMapPid = null,
      issues = [],
      cause = null,
    } = {}) {
      const error = new Error(
        `Resource map is not safe to edit${
          rootResourceMapPid ? ` ("${rootResourceMapPid}")` : ""
        }`,
      );
      error.code = "resource_map_not_editable";
      error.inputId = inputId;
      error.rootResourceMapPid = rootResourceMapPid;
      error.issues = issues
        .filter((issue) => issue && typeof issue === "object")
        .map((issue) => ({ ...issue }));
      if (cause) error.cause = cause;
      return error;
    },

    /**
     * Build the error thrown when package membership exceeds the configured
     * editable limit.
     * @param {object} [details] Error details
     * @param {string} [details.inputId] Input PID being loaded
     * @param {string} [details.rootResourceMapPid] Root ResourceMap PID
     * @param {number} [details.memberCount] Actual member count
     * @param {number} [details.maxMembers] Configured editable member limit
     * @returns {Error} Error with `code === "package_member_limit_exceeded"`
     */
    memberLimitExceededError({
      inputId = null,
      rootResourceMapPid = null,
      memberCount = 0,
      maxMembers = null,
    } = {}) {
      const error = new Error(
        `Package member count ${memberCount} exceeds editable limit ${
          maxMembers || "unknown"
        }${inputId ? ` for "${inputId}"` : ""}`,
      );
      error.code = "package_member_limit_exceeded";
      error.inputId = inputId;
      error.rootResourceMapPid = rootResourceMapPid;
      error.memberCount = memberCount;
      error.maxMembers = maxMembers;
      return error;
    },

    /**
     * Build the error thrown when required editable sysmeta is unavailable.
     * @param {object} [details] Error details
     * @param {string} [details.inputId] Input PID being loaded
     * @param {string} [details.rootResourceMapPid] Root ResourceMap PID
     * @param {string[]} [details.failedPids] PIDs whose sysmeta failed
     * @param {Error[]} [details.causes] Underlying sysmeta errors
     * @param {string[]} [details.missingMembers] Required missing member roles
     * @returns {Error} Error with `code === "editable_baseline_unavailable"`
     */
    editableBaselineUnavailableError({
      inputId = null,
      rootResourceMapPid = null,
      failedPids = [],
      causes = [],
      missingMembers = [],
    } = {}) {
      const error = new Error(
        `Required system metadata unavailable for editable loading${
          inputId ? ` of "${inputId}"` : ""
        }`,
      );
      error.code = "editable_baseline_unavailable";
      error.inputId = inputId;
      error.rootResourceMapPid = rootResourceMapPid;
      error.failedPids = [...failedPids];
      error.causes = [...causes];
      error.missingMembers = [...missingMembers];
      if (causes.length) [error.cause] = causes;
      return error;
    },

    /**
     * Load package manifest data from configured sources.
     * @param {DataPackage} dataPackage Package being loaded
     * @param {object} [options] Manifest options
     * @param {boolean} [options.sysMeta] Whether to fetch System Metadata
     * @param {boolean} [options.resourceMap] Whether to load the ResourceMap
     * @param {boolean} [options.index] Whether to load index enrichment
     * @param {AbortSignal} [options.signal] Abort signal
     * @returns {Promise<DataPackageMember[]>} Package members
     */
    async getManifest(
      dataPackage,
      { sysMeta = false, resourceMap = true, index = true, signal } = {},
    ) {
      if (index) {
        await dataPackage.getManifestFromIndex({ signal });
      }
      if (resourceMap) {
        await dataPackage.getManifestFromResourceMap({ signal });
      }
      if (sysMeta) {
        await dataPackage.fetchSysMeta(null, { signal });
      }
      return dataPackage.members.toArray();
    },

    /**
     * Enrich package members from the Solr index.
     * @param {DataPackage} dataPackage Package being loaded
     * @param {object} [options] Index manifest options
     * @param {boolean} [options.merge] Merge matching existing members
     * @param {boolean} [options.onlyExisting] Skip members not already present
     * @param {string[]} [options.fields] Extra Solr fields to request
     * @param {number} [options.rows] Solr row limit
     * @param {boolean} [options.archived] Whether to include archived rows
     * @param {boolean} [options.usePost] Whether to use POST
     * @param {string} [options.urlBase] Query service URL base
     * @param {AbortSignal} [options.signal] Abort signal
     * @returns {Promise<object>} Load result details
     */
    async getManifestFromIndex(
      dataPackage,
      {
        merge = true,
        onlyExisting = false,
        fields = [],
        rows = DEFAULT_ROWS,
        archived = true,
        usePost = true,
        urlBase = null,
        signal,
      } = {},
    ) {
      const resourceMapPid =
        dataPackage.rootResourceMapPid ||
        dataPackage.getRootResourceMapMember()?.pid;

      if (!resourceMapPid) {
        return {
          ok: false,
          details: {
            inputId: dataPackage.inputId,
            rootResourceMapPid: null,
          },
        };
      }

      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.INDEX_MANIFEST,
        { rootResourceMapPid: resourceMapPid },
      );
      await DataPackageLoader.ensureObjectFormats(dataPackage);
      throwIfAborted(signal, "Package index manifest load cancelled");
      const query = [
        QueryService.getQueryPart("resourceMap", resourceMapPid),
        QueryService.getQueryPart("id", resourceMapPid),
      ].join(" OR ");
      const allFields = Values.dedupeArray([
        ...SOLR_MANIFEST_FIELDS,
        ...Values.listify(fields),
      ]);
      const response = await QueryService.queryWithFetch({
        q: query,
        fields: allFields,
        rows: rows || DEFAULT_ROWS,
        archived,
        usePost,
        urlBase,
        signal,
      });
      throwIfAborted(signal, "Package index manifest load cancelled");
      const results = QueryService.parseResponse(response);
      dataPackage.members.add(results, {
        merge,
        onlyExisting,
        sources: ["index"],
      });
      const total = response?.response?.numFound ?? results.length;
      // Record the total count (could be > than the number of rows fetched)
      dataPackage.indexManifestTotal = total;
      dataPackage.indexManifestFetched = true;
      return {
        ok: true,
        details: {
          inputId: dataPackage.inputId,
          rootResourceMapPid: resourceMapPid,
          count: results.length,
          total,
          source: "index",
        },
      };
    },

    /**
     * Load titles for nested ResourceMaps from their metadata documents.
     * @param {DataPackage} dataPackage Package being enriched
     * @param {object} [options] Fetch options
     * @param {AbortSignal} [options.signal] Abort signal
     * @returns {Promise<boolean>} Whether any member title changed
     */
    async loadNestedPackageTitles(dataPackage, { signal } = {}) {
      const packageId = dataPackage.rootResourceMapPid;
      const nestedPackages = dataPackage.members
        .getActiveMembers()
        .filter(
          (member) =>
            member.pid !== packageId && member.isResourceMap() && !member.title,
        );
      if (!nestedPackages.length) return false;

      const nestedPackagesByPid = new Map(
        nestedPackages.map((member) => [member.pid, member]),
      );
      const resourceMapQuery = nestedPackages
        .map((member) => QueryService.getQueryPart("resourceMap", member.pid))
        .join(" OR ");
      const metadataQuery = QueryService.getQueryPart("formatType", "METADATA");

      throwIfAborted(signal, "Nested package title load cancelled");
      const response = await QueryService.queryWithFetch({
        q: `${metadataQuery} AND (${resourceMapQuery})`,
        fields: ["id", "resourceMap", "title"],
        rows: DEFAULT_ROWS,
        archived: true,
        usePost: true,
        signal,
      });
      throwIfAborted(signal, "Nested package title load cancelled");

      let changed = false;
      QueryService.parseResponse(response).forEach((doc) => {
        if (!doc.title) return;
        (doc.resourceMap || []).forEach((resourceMapPid) => {
          const member = nestedPackagesByPid.get(resourceMapPid);
          if (!member || member.title) return;
          member.title = doc.title;
          changed = true;
        });
      });
      return changed;
    },

    /**
     * Load and parse the authoritative ResourceMap manifest.
     * @param {DataPackage} dataPackage Package being loaded
     * @param {object} [options] ResourceMap manifest options
     * @param {boolean} [options.merge] Merge matching existing members
     * @param {boolean} [options.requireEditable] Reject ResourceMaps with
     * blocking identity or relationship issues before projecting package
     * membership
     * @param {AbortSignal} [options.signal] Abort signal
     * @returns {Promise<object>} Load result details
     * @throws {Error} When loading is aborted or editable validation fails
     */
    async getManifestFromResourceMap(
      dataPackage,
      { merge = true, requireEditable = false, signal } = {},
    ) {
      const resourceMapMember = dataPackage.getRootResourceMapMember();
      const resourceMapPid =
        dataPackage.rootResourceMapPid || resourceMapMember?.pid;
      if (!resourceMapMember) {
        return {
          ok: false,
          details: {
            inputId: dataPackage.inputId,
            rootResourceMapPid: null,
          },
        };
      }
      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.RESOURCE_MAP_DOWNLOAD,
        { rootResourceMapPid: resourceMapPid },
      );
      await DataPackageLoader.ensureObjectFormats(dataPackage);
      throwIfAborted(signal, "Resource map manifest load cancelled");
      let resourceMap = resourceMapMember.objectModel;
      if (!resourceMap) {
        try {
          resourceMap = await resourceMapMember.fetchObject({ signal });
          throwIfAborted(signal, "Resource map manifest load cancelled");
        } catch (error) {
          if (isAbortError(error)) throw error;
          if (Array.isArray(error?.issues) && error.issues.length) {
            throw DataPackageLoader.resourceMapNotEditableError({
              inputId: dataPackage.inputId,
              rootResourceMapPid: resourceMapPid,
              issues: error.issues,
              cause: error,
            });
          }
          const httpStatus = error?.status ?? null;
          const unauthorized = httpStatus === 401 || httpStatus === 403;
          // A 404 confirms absence; other failures must never trigger repair.
          let reason = "error";
          if (httpStatus === 404) reason = "missing";
          else if (unauthorized) reason = "unauthorized";
          const result = {
            ok: false,
            reason,
            httpStatus,
            details: {
              inputId: dataPackage.inputId,
              rootResourceMapPid: resourceMapPid,
            },
          };
          if (!unauthorized) result.error = error;
          return result;
        }
      }
      await DataPackageLoader.reportLoadProgress(
        dataPackage,
        LOAD_PHASES.RESOURCE_MAP_SUMMARY,
        { rootResourceMapPid: resourceMapPid },
      );
      throwIfAborted(signal, "Resource map manifest load cancelled");
      if (requireEditable) {
        const blockers = resourceMap.getEditBlockers?.() || [];
        if (blockers.length) {
          throw DataPackageLoader.resourceMapNotEditableError({
            inputId: dataPackage.inputId,
            rootResourceMapPid: resourceMapPid,
            issues: blockers,
          });
        }
      }
      const summary = resourceMap.getSummary();
      const rootResourceMapPid = summary.resourceMapPid || resourceMapPid;
      dataPackage.rootResourceMapPid = rootResourceMapPid;
      const resourceMapMembers = summary.members.map((member) => {
        let formatType;
        if (member.documents?.length) {
          formatType = FORMAT_TYPES.METADATA;
        } else if (member.isDocumentedBy?.length) {
          formatType = FORMAT_TYPES.DATA;
        }
        return {
          ...member,
          resourceMap: [rootResourceMapPid],
          formatType: formatType || member.formatType,
        };
      });
      const metadataPids = resourceMapMembers
        .filter((member) => member.formatType === FORMAT_TYPES.METADATA)
        .map((member) => member.pid)
        .filter(Boolean);
      if (metadataPids.length === 1) {
        const [metadataPid] = metadataPids;
        dataPackage.primaryMetadataPid = metadataPid;
      } else if (!metadataPids.includes(dataPackage.primaryMetadataPid)) {
        dataPackage.primaryMetadataPid = null;
      }
      const members = [
        ...resourceMapMembers,
        {
          pid: rootResourceMapPid,
          formatId: RESOURCE_MAP_FORMAT_ID,
          formatType: FORMAT_TYPES.RESOURCE,
          resourceMapUri: summary.resourceMapUri,
          modified: summary.modified,
          creatorName: summary.creatorName,
        },
      ];

      dataPackage.members.add(members, {
        merge,
        sources: ["resourceMap"],
      });
      dataPackage.refreshMemberGraphFields(resourceMap);
      dataPackage.resourceManifestIsFetched = true;
      return {
        ok: true,
        details: {
          inputId: dataPackage.inputId,
          rootResourceMapPid,
          count: members.length,
          source: "resourceMap",
        },
      };
    },
  };

  return DataPackageLoader;
});

/* eslint-enable no-param-reassign */
