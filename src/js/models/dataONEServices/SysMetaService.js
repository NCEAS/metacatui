define([
  "models/dataONEServices/DataONEService",
  "models/sysmeta/SystemMetadata",
  "common/ValueUtilities",
], (DataONEService, SystemMetadata, ValueUtilities) => {
  /**
   * Service for fetching and caching DataONE system metadata.
   * @class SysMetaService
   * @augments DataONEService
   */
  class SysMetaService extends DataONEService {
    /**
     * @param {object} [options] Options for the SysMetaService. See
     * {@link DataONEService.optionsFromDescriptor} for the shared option shape.
     * @param {string} [options.baseUrl] Base URL for the DataONE endpoint.
     */
    constructor(options = {}) {
      super(SysMetaService.optionsFromDescriptor(options));
    }

    /**
     * Fetch System Metadata for a PID. Returns the raw sysmeta response text.
     * @param {string} pid The PID of the object to fetch System Metadata for.
     * @param {object} [options] Options passed to
     * {@link DataONEService#download}
     * @returns {Promise<SystemMetadata>} Parsed System Metadata model.
     */
    async download(pid, options = {}) {
      const normalizedPid = this.constructor.normalizePid(
        pid,
        "pid",
        "SysMetaService.download requires a PID",
      );
      const { cacheKey } = options;
      const resolvedCacheKey = this.constructor.resolveCacheKey(
        normalizedPid,
        cacheKey,
      );

      const xmlString = await super.download(
        this.constructor.encodePidPath(normalizedPid),
        {
          ...options,
          cacheKey: resolvedCacheKey,
          encodePath: false,
        },
      );

      let sysMeta;
      try {
        sysMeta = SystemMetadata.fromXml(xmlString);
      } catch (error) {
        // Remove from cache if parsing fails
        await this.removeCached(resolvedCacheKey);
        error.message = `Failed to parse SystemMetadata XML for PID ${normalizedPid}: ${error.message}`;
        throw error;
      }

      return sysMeta;
    }

    /**
     * Remove a cached System Metadata record for a PID.
     * @param {string} pid PID to invalidate.
     * @returns {Promise<void>} Promise resolving when invalidation completes.
     */
    async invalidate(pid) {
      const normalizedPid = ValueUtilities.normalizeText(pid);
      if (!normalizedPid) return;
      await this.removeCached(normalizedPid);
    }

    /**
     * Upload System Metadata XML to the service.
     * @param {string} sysMetaXml System Metadata XML string.
     * @param {object} [options] Options passed to {@link DataONEService#upload}.
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the upload response.
     */
    async upload(sysMetaXml, options = {}) {
      const normalizedSysMetaXml = ValueUtilities.requireNonEmptyString(
        sysMetaXml,
        "SysMetaService.upload requires sysMetaXml",
      );
      // TODO: accept pid?
      return super.upload("", {
        ...options,
        method: "POST",
        headers: {
          ...(options.headers || {}),
          "Content-Type": "application/xml",
        },
        body: normalizedSysMetaXml,
      });
    }

    /**
     * Update System Metadata XML for an existing object.
     * @param {string} pid PID to update system metadata for.
     * @param {string} sysMetaXml System Metadata XML string.
     * @param {object} [options] Options passed to {@link DataONEService#upload}.
     * @returns {Promise<DataONEHttpResponse>} Promise resolving to the update response.
     */
    async update(pid, sysMetaXml, options = {}) {
      const normalizedPid = this.constructor.normalizePid(
        pid,
        "pid",
        "SysMetaService.update requires a PID",
      );
      const normalizedSysMetaXml = ValueUtilities.requireNonEmptyString(
        sysMetaXml,
        "SysMetaService.update requires sysMetaXml",
      );

      const formData = new FormData();
      formData.append("pid", normalizedPid);
      const xmlBlob = new Blob([normalizedSysMetaXml], {
        type: "application/xml",
      });
      formData.append("sysmeta", xmlBlob, "sysmeta.xml");

      return super.upload(this.constructor.encodePidPath(normalizedPid), {
        ...options,
        method: "PUT",
        useCache: false,
        dedupe: false,
        transport: "xhr",
        responseType: "text",
        encodePath: false,
        body: formData,
      });
    }
  }

  /** @type {DataONEService#DataONEServiceConfig} */
  SysMetaService.config = {
    endpoint: "sysmeta",
    appModelKeys: ["metaServiceUrl"],
    client: {
      timeoutMs: 2 * 60 * 1000, // 2 minutes
      methods: ["GET", "POST", "PUT"],
      responseTypes: ["text"],
      dedupeHeaders: ["Authorization"],
    },
    storage: {
      ttlMs: 60 * 60 * 1000, // 1 hour
      schemaVersion: 1,
    },
    persistPrivate: true,
    defaultAuth: true,
  };
  SysMetaService.SystemMetadata = SystemMetadata;

  return SysMetaService;
});
