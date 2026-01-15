define(["models/dataONEServices/DataONEService", "models/sysmeta/SysMeta"], (
  DataONEService,
  SysMeta,
) => {
  /**
   * Default Meta Service URL from MetacatUI AppModel
   * @type {string}
   */
  const DEFAULT_META_SERVICE_URL = MetacatUI?.appModel?.get("metaServiceUrl");

  /**
   * Default DataONEHttpClient options for SysMetaService
   * @type {DataONEHttpClient#DataONEHttpClientOptions}
   */
  const DEFAULT_CLIENT_OPTIONS = {
    baseUrl: DEFAULT_META_SERVICE_URL,
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
    name: "MetacatUI_SysMetaService",
    endpoint: "sysmeta",
    ttlMs: 60 * 60 * 1000, // 1 hour
    schemaVersion: 1,
  };

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
     */
    constructor({
      baseUrl = DEFAULT_META_SERVICE_URL,
      clientConfig = DEFAULT_CLIENT_OPTIONS,
      storageConfig = DEFAULT_STORAGE_OPTIONS,
      persistPrivate = true,
      defaultAuth = true,
      getToken,
    } = {}) {
      const storageConfigWithDefaults = {
        ...DEFAULT_STORAGE_OPTIONS,
        ...storageConfig,
      };

      const clientConfigWithDefaults = {
        ...DEFAULT_CLIENT_OPTIONS,
        ...clientConfig,
      };

      super({
        baseUrl,
        clientConfig: clientConfigWithDefaults,
        storageConfig: storageConfigWithDefaults,
        persistPrivate,
        defaultAuth,
        getToken,
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
      const { cacheKey } = options;

      const result = super.download(pid, {
        ...options,
        cacheKey: cacheKey !== undefined ? cacheKey : pid,
      });

      const xmlString = await result;
      const sysMeta = SysMeta.fromXml(xmlString);

      return sysMeta;
    }

    async invalidate(pid, { token } = {}) {
      if (!pid) return;
      await this.removeCached(pid, { token });
    }

    async upload(sysMetaXml, options = {}) {
      const { token, ...requestOptions } = options;

      // TODO: accept pid?
      return super.upload("", {
        ...requestOptions,
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
        },
        token,
        body: sysMetaXml,
      });
    }
  }

  SysMetaService.endpoint = "sysmeta";

  return SysMetaService;
});
