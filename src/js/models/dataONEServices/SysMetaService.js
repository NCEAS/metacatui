define([
  "models/dataONEServices/DataONEService",
  "models/dataONEServices/DataONEHttpClient",
  "models/sysmeta/SystemMetadata",
  "common/UrlUtilities",
  "common/ValueUtilities",
], (
  DataONEService,
  DataONEHttpClient,
  SystemMetadata,
  UrlUtilities,
  ValueUtilities,
) => {
  /**
   * Service for fetching and caching DataONE system metadata.
   * @class SysMetaService
   * @augments DataONEService
   */
  class SysMetaService extends DataONEService {
    /**
     * @param {object} [options] Options for the SysMetaService. See
     * {@link DataONEService.optionsFromDescriptor} for the shared option shape.
     * @param {string} [options.readBaseUrl] Base URL for System Metadata reads
     * @param {string} [options.writeBaseUrl] Base URL for System Metadata
     * writes and reads after a write
     */
    constructor(options = {}) {
      const readBaseUrl = UrlUtilities.normalizeUrl(options.readBaseUrl);
      if (!readBaseUrl) {
        throw new Error("SysMetaService: readBaseUrl is required");
      }
      const serviceOptions = SysMetaService.optionsFromDescriptor({
        ...options,
        baseUrl: readBaseUrl,
      });
      super(serviceOptions);
      this.readBaseUrl = readBaseUrl;
      this.writeBaseUrl = UrlUtilities.normalizeUrl(options.writeBaseUrl);
      this.writeClientConfig = {
        ...serviceOptions.clientConfig,
        baseUrl: "",
      };
    }

    /**
     * Return the client for System Metadata writes and subsequent reads.
     * @param {string} operation Operation name for error reporting
     * @returns {DataONEHttpClient} Client for the write endpoint
     * @private
     * @since 0.0.0
     */
    getWriteClient(operation) {
      if (!this.writeBaseUrl) {
        throw new Error(
          `SysMetaService: writeBaseUrl is required for ${operation}`,
        );
      }
      return DataONEHttpClient.get({
        ...this.writeClientConfig,
        baseUrl: this.writeBaseUrl,
      });
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
     * Fetch uncached System Metadata from the repository that accepts writes.
     * @param {string} pid PID of the object to fetch System Metadata for
     * @param {object} [options] Request options
     * @returns {Promise<SystemMetadata>} Parsed System Metadata model
     * @since 0.0.0
     */
    async downloadFromWriteTarget(pid, options = {}) {
      const normalizedPid = this.constructor.normalizePid(pid, "pid");
      const response = await this.requestWithClient(
        this.getWriteClient("downloadFromWriteTarget"),
        this.constructor.buildRequestOptions({
          options,
          path: this.constructor.encodePidPath(normalizedPid),
          method: "GET",
        }),
      );

      try {
        return SystemMetadata.fromXml(response.data);
      } catch (error) {
        error.message = `Failed to parse SystemMetadata XML for PID ${normalizedPid}: ${error.message}`;
        throw error;
      }
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
      return this.requestWithClient(
        this.getWriteClient("upload"),
        this.constructor.buildRequestOptions({
          options: {
            ...options,
            headers: {
              ...(options.headers || {}),
              "Content-Type": "application/xml",
            },
          },
          path: "",
          method: "POST",
          body: normalizedSysMetaXml,
        }),
      );
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

      return this.requestWithClient(
        this.getWriteClient("update"),
        this.constructor.buildRequestOptions({
          options,
          path: this.constructor.encodePidPath(normalizedPid),
          method: "PUT",
          dedupe: false,
          responseType: "text",
          body: formData,
          extra: { transport: "xhr", useCache: false },
        }),
      );
    }
  }

  /** @type {DataONEService#DataONEServiceConfig} */
  SysMetaService.config = {
    endpoint: "sysmeta",
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
