define([
  "models/dataONEServices/DataONEService",
  "models/sysmeta/SysMeta",
  "common/UrlUtilities",
  "common/ValueUtilities",
], (DataONEService, SysMeta, UrlUtilities, ValueUtilities) => {
  /**
   * Default DataONEHttpClient options for SysMetaService
   * @type {DataONEHttpClient#DataONEHttpClientOptions}
   */
  const DEFAULT_CLIENT_OPTIONS = {
    // baseUrl added at runtime
    timeoutMs: 2 * 60 * 1000, // 2 minutes
    allowedHttpMethods: ["GET", "POST", "PUT"],
    headerNamesForDedup: ["Authorization"],
    responseTypes: ["text"],
  };

  /**
   * Default PersistentStorage options for SysMetaService
   * @type {PersistentStorage#PersistentStorageOptions}
   */
  const DEFAULT_STORAGE_OPTIONS = {
    ttlMs: 60 * 60 * 1000, // 1 hour
    schemaVersion: 1,
  };

  /**
   * Service for fetching and caching DataONE system metadata.
   * @class SysMetaService
   * @augments DataONEService
   */
  class SysMetaService extends DataONEService {
    /**
     * @param {object} [options] Options for the SysMetaService
     * @param {string} options.baseUrl Base URL for the DataONE endpoint
     * @param {DataONEHttpClient#DataONEHttpClientOptions} [options.clientConfig]
     * DataONEHttpClient configuration
     * @param {PersistentStorage#PersistentStorageOptions} [options.storageConfig]
     * Storage configuration
     * @param {boolean} [options.persistPrivate] Allow caching private datas
     * @param {boolean} [options.defaultAuth] Default auth behavior
     * @param {Function} [options.getToken] Override token resolver function
     * @param {Function} [options.getUserName] Optional function to get the
     * current user name, used for caching keys.
     */
    constructor({
      baseUrl = "",
      clientConfig = {},
      storageConfig = {},
      persistPrivate = true,
      defaultAuth = true,
      getToken,
      getUserName,
    } = {}) {
      const url =
        baseUrl || globalThis.MetacatUI?.appModel?.get("metaServiceUrl");
      const urlNormalized = UrlUtilities.normalizeUrl(url);

      const instanceKeys = storageConfig.instanceKeys
        ? [...storageConfig.instanceKeys]
        : [];
      instanceKeys.push("SysMetaService", urlNormalized);

      const storageConfigWithDefaults = {
        ...DEFAULT_STORAGE_OPTIONS,
        ...storageConfig,
        instanceKeys,
      };

      super({
        baseUrl: urlNormalized,
        clientConfig: SysMetaService.buildClientConfig({
          defaults: DEFAULT_CLIENT_OPTIONS,
          overrides: clientConfig,
          baseUrl: urlNormalized,
          requiredMethods: ["GET", "POST", "PUT"],
          requiredResponseTypes: ["text"],
          requiredHeaderNames: ["Authorization"],
        }),
        storageConfig: storageConfigWithDefaults,
        persistPrivate,
        defaultAuth,
        getToken,
        getUserName,
      });
    }

    /**
     * Fetch SysMeta for a PID. Returns the raw sysmeta response text.
     * @param {string} pid The PID of the object to fetch SysMeta for.
     * @param {object} [options] Options passed to
     * {@link DataONEService#download}
     * @returns {Promise<SysMeta>} The SysMeta object for the requested PID. Raw
     * XML can be found in the `fetchedXmlString` property.
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
        sysMeta = SysMeta.fromXml(xmlString);
      } catch (error) {
        // Remove from cache if parsing fails
        await this.removeCached(resolvedCacheKey);
        error.message = `Failed to parse SysMeta XML for PID ${normalizedPid}: ${error.message}`;
        throw error;
      }

      return sysMeta;
    }

    /**
     * Remove a cached SysMeta record for a PID.
     * @param {string} pid PID to invalidate.
     * @returns {Promise<void>} Promise resolving when invalidation completes.
     */
    async invalidate(pid) {
      const normalizedPid = ValueUtilities.normalizeText(pid);
      if (!normalizedPid) return;
      await this.removeCached(normalizedPid);
    }

    /**
     * Upload SysMeta XML to the service.
     * @param {string} sysMetaXml SysMeta XML string.
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
     * Update SysMeta XML for an existing object.
     * @param {string} pid PID to update system metadata for.
     * @param {string} sysMetaXml SysMeta XML string.
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

  SysMetaService.endpoint = "sysmeta";
  SysMetaService.SysMeta = SysMeta;

  return SysMetaService;
});
