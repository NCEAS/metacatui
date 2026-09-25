define([
  "models/dataONEServices/DataONEService",
  "models/dataONEServices/DataONEHttpClient",
  "models/dataONEServices/ObjectLocationResolver",
  "common/ErrorUtilities",
  "common/UrlUtilities",
  "common/ValueUtilities",
], (
  DataONEService,
  DataONEHttpClient,
  ObjectLocationResolver,
  ErrorUtilities,
  UrlUtilities,
  ValueUtilities,
) => {
  /**
   * Default DataONEHttpClient options for ObjectService reads.
   * @type {DataONEHttpClient#DataONEHttpClientOptions}
   */
  const DEFAULT_READ_CLIENT_OPTIONS = {
    timeoutMs: null,
    allowedHttpMethods: ["GET"],
    headerNamesForDedup: ["Authorization", "Accept"],
    responseTypes: ["json", "arrayBuffer", "blob", "text"],
  };

  /**
   * Default DataONEHttpClient options for ObjectService writes.
   *
   * Retries are disabled by default because create/update are non-idempotent:
   * a POST/PUT that committed on the server but then surfaced a retryable
   * status (e.g. a 502/504 from an intermediary still processing the request,
   * or a client-side timeout) would otherwise be replayed, producing a
   * duplicate object or a committed-but-reported-as-failed write. Callers that
   * need bounded retries for a specific, safe-to-replay operation can opt in
   * via a per-request `retry` override.
   * @type {DataONEHttpClient#DataONEHttpClientOptions}
   */
  const DEFAULT_WRITE_CLIENT_OPTIONS = {
    timeoutMs: null,
    allowedHttpMethods: ["GET", "POST", "PUT"],
    headerNamesForDedup: ["Authorization", "Content-Type", "Accept"],
    responseTypes: ["json", "arrayBuffer", "blob", "text"],
    retry: {
      maxRetries: 0,
      retryOn: [],
      retryNetworkErrors: false,
    },
  };

  /**
   * Service for DataONE object read/download/create/update operations.
   * @class ObjectService
   * @augments DataONEService
   * @classcategory Models/DataONEServices
   * @since 2.39.0
   */
  class ObjectService extends DataONEService {
    /**
     * @param {object} [options] Options for the ObjectService
     * @param {string} [options.readBaseUrl] Base URL for object reads
     * @param {string} [options.writeBaseUrl] Base URL for object writes
     * @param {string} [options.resolveServiceUrl] CN resolve service URL
     * @param {string} [options.metaServiceUrl] System Metadata service URL
     * @param {ObjectLocationResolver} [options.locationResolver] Object
     * location resolver
     * @param {DataONEHttpClient#DataONEHttpClientOptions} [options.clientConfig]
     * DataONEHttpClient configuration
     * @param {boolean} [options.defaultAuth] Default auth behavior
     * @param {Function} [options.getToken] Override token resolver function
     * @throws {Error} When readBaseUrl is missing
     */
    constructor({
      readBaseUrl = "",
      writeBaseUrl = "",
      resolveServiceUrl = "",
      metaServiceUrl = "",
      locationResolver,
      clientConfig = {},
      defaultAuth,
      getToken,
    } = {}) {
      const normalizedReadBaseUrl = UrlUtilities.normalizeUrl(readBaseUrl);
      if (!normalizedReadBaseUrl) {
        throw new Error("ObjectService: readBaseUrl is required");
      }

      const resolvedDefaultAuth =
        typeof defaultAuth === "boolean" ? defaultAuth : true;
      const readClientConfig = ObjectService.buildClientConfig({
        defaults: DEFAULT_READ_CLIENT_OPTIONS,
        overrides: clientConfig,
        baseUrl: normalizedReadBaseUrl,
      });

      super({
        baseUrl: normalizedReadBaseUrl,
        clientConfig: readClientConfig,
        defaultAuth: resolvedDefaultAuth,
        getToken,
      });

      this.readBaseUrl = normalizedReadBaseUrl;
      this.readClientConfig = { ...readClientConfig, baseUrl: "" };
      this.writeBaseUrl = UrlUtilities.normalizeUrl(writeBaseUrl);
      this.resolveServiceUrl = UrlUtilities.normalizeUrl(resolveServiceUrl);
      this.locationResolver =
        normalizedReadBaseUrl === this.resolveServiceUrl
          ? locationResolver ||
            new ObjectLocationResolver({ metaServiceUrl, getToken })
          : null;
      this.writeClientConfig = ObjectService.buildClientConfig({
        defaults: DEFAULT_WRITE_CLIENT_OPTIONS,
        overrides: clientConfig,
        baseUrl: "",
      });
    }

    /**
     * Build the exact request URL used to read an object.
     * @param {string} pid PID to read.
     * @returns {string} Full object request URL.
     */
    getReadUrl(pid) {
      return UrlUtilities.buildUrl(
        this.readBaseUrl,
        this.constructor.buildPidPath(pid),
        { encodePath: false },
      );
    }

    /**
     * Append object content to multipart form data.
     * @param {FormData} formData FormData instance.
     * @param {*} objectBody Object content.
     * @param {string} [fileName] Optional file name.
     */
    static appendObjectBody(formData, objectBody, fileName) {
      const hasFileName =
        ValueUtilities.isNonEmptyString(fileName) && objectBody instanceof Blob;

      if (hasFileName) {
        formData.append("object", objectBody, fileName);
      } else {
        formData.append("object", objectBody);
      }
    }

    /**
     * Build the multipart form data for create/update requests.
     * @param {object} params Transfer params.
     * @param {string} params.pid Existing or new PID.
     * @param {string} [params.newPid] Replacement PID for updates.
     * @param {*} params.object Object payload.
     * @param {string} params.sysMetaXml System metadata XML.
     * @param {string} [params.fileName] Optional filename.
     * @returns {FormData} Multipart form data.
     */
    static buildTransferFormData({
      pid,
      newPid,
      object,
      sysMetaXml,
      fileName,
    }) {
      const formData = new FormData();
      formData.append("pid", pid);
      if (newPid !== undefined && newPid !== null) {
        formData.append("newPid", newPid);
      }
      const sysMetaBlob = new Blob([sysMetaXml], { type: "application/xml" });
      formData.append("sysmeta", sysMetaBlob, "sysmeta");
      this.appendObjectBody(formData, object, fileName);
      return formData;
    }

    /**
     * Build request options for create/update transfer requests.
     * @param {string} path Request path.
     * @param {"POST"|"PUT"} method HTTP method.
     * @param {FormData} body Multipart payload.
     * @param {object} [options] Transfer options.
     * @returns {object} Normalized request options.
     */
    buildTransferRequest(path, method, body, options = {}) {
      const transport =
        options.transport === undefined ? "fetch" : options.transport;

      return this.constructor.buildRequestOptions({
        options,
        path,
        method,
        body,
        accept: "text/xml",
        dedupe: false,
        extra: { transport },
      });
    }

    /**
     * Get a read client for a selected object service URL.
     * @param {string} baseUrl Object service base URL
     * @returns {DataONEHttpClient} Read client instance
     * @since 2.39.0
     */
    getReadClient(baseUrl) {
      return DataONEHttpClient.get({
        ...this.readClientConfig,
        baseUrl,
      });
    }

    /**
     * Get the write client for create/update requests.
     * @param {string} operation Operation name for error reporting.
     * @returns {DataONEHttpClient} Write client instance.
     * @throws {Error} When writeBaseUrl is missing
     */
    getWriteClient(operation) {
      if (!this.writeBaseUrl) {
        throw new Error(
          `ObjectService: writeBaseUrl is required for ${operation}`,
        );
      }
      return DataONEHttpClient.get({
        ...this.writeClientConfig,
        baseUrl: this.writeBaseUrl,
      });
    }

    /**
     * Execute a create/update transfer request and normalize the XML response.
     * @param {string} operation Operation name for error reporting.
     * @param {string} path Request path.
     * @param {"POST"|"PUT"} method HTTP method.
     * @param {FormData} body Multipart payload.
     * @param {string} context Error/parse context.
     * @param {object} [options] Transfer options.
     * @returns {Promise<DataONEHttpResponse>} Parsed identifier response.
     */
    async sendTransferRequest(
      operation,
      path,
      method,
      body,
      context,
      options = {},
    ) {
      return this.sendParsedIdentifierRequest({
        client: this.getWriteClient(operation),
        requestOptions: this.buildTransferRequest(path, method, body, options),
        context,
      });
    }

    /**
     * Fetch object content and return the full normalized response.
     * @param {string} pid PID to fetch.
     * @param {object} [options] Request options for
     * {@link DataONEService#request}.
     * @returns {Promise<DataONEHttpResponse>} Full response object.
     */
    async fetch(pid, options = {}) {
      const normalizedPid = this.constructor.normalizePid(pid);
      const { responseType = "blob", auth, ...requestOptions } = options;
      const builtRequest = this.constructor.buildRequestOptions({
        options: requestOptions,
        path: this.constructor.buildPidPath(normalizedPid),
        method: "GET",
        responseType,
      });
      const token = await this.resolveToken(auth);

      if (!token || !this.locationResolver) {
        return this.client.request({ ...builtRequest, token });
      }

      const location = await this.locationResolver.locate(normalizedPid, {
        signal: requestOptions.signal,
      });
      if (!location.objectServiceUrls.length) {
        if (location.isPublic) {
          try {
            return await this.client.request({ ...builtRequest, token: null });
          } catch (error) {
            const status = Number(error?.status) || null;
            if (status !== 401 && status !== 403) throw error;
            throw ErrorUtilities.createNamedError(
              "ObjectTransportError",
              `The public object could not be read through the resolve service: ${normalizedPid}.`,
              { code: "OBJECT_TRANSPORT_UNAVAILABLE", status: null },
            );
          }
        }
        throw ErrorUtilities.createNamedError(
          "ObjectLocationError",
          `No registered readable Member Node was found for ${normalizedPid}.`,
          { code: ObjectLocationResolver.LOCATION_ERROR_CODE },
        );
      }

      return this.fetchFromLocations(
        location.objectServiceUrls,
        builtRequest,
        token,
      );
    }

    /**
     * Fetch an object from its registered locations.
     * @param {string[]} objectServiceUrls Registered object service URLs
     * @param {object} request Built request options
     * @param {string} token Bearer token
     * @returns {Promise<DataONEHttpResponse>} Full response object
     * @since 2.39.0
     */
    fetchFromLocations(objectServiceUrls, request, token) {
      const attempts = [];

      const tryLocation = (index) => {
        if (index >= objectServiceUrls.length) {
          const allMissing = attempts.every(
            ({ status }) => status === 404 || status === 410,
          );
          return Promise.reject(
            ErrorUtilities.createNamedError(
              allMissing ? "ObjectNotFoundError" : "ObjectTransportError",
              allMissing
                ? "The object was not found at any registered location."
                : "No registered object location could be contacted.",
              {
                code: allMissing
                  ? "OBJECT_NOT_FOUND"
                  : "OBJECT_TRANSPORT_UNAVAILABLE",
                status: allMissing ? 404 : null,
                attempts,
              },
            ),
          );
        }

        const objectServiceUrl = objectServiceUrls[index];
        return this.getReadClient(objectServiceUrl)
          .request({
            ...request,
            token,
            redirect: "error",
            transport: "fetch",
          })
          .catch((error) => {
            if (ErrorUtilities.isAbortError(error)) throw error;
            const status = Number(error?.status) || null;
            attempts.push({
              objectServiceUrl,
              status,
              code: error?.code || null,
            });
            if (status === 401 || status === 403) throw error;
            const retryAtNextLocation =
              error?.networkError === true ||
              ErrorUtilities.isTimeoutError(error) ||
              status === 404 ||
              status === 410 ||
              status >= 500;
            if (!retryAtNextLocation) throw error;
            return tryLocation(index + 1);
          });
      };

      return tryLocation(0);
    }

    /**
     * Download object content and return only the response data.
     * @param {string} pid PID to download.
     * @param {object} [options] Request options for {@link ObjectService#fetch}.
     * @returns {Promise<*>} Response payload.
     */
    async download(pid, options = {}) {
      const response = await this.fetch(pid, options);
      return response.data;
    }

    /**
     * Download object content from the repository that accepts writes.
     * @param {string} pid PID to download
     * @param {object} [options] Request options
     * @returns {Promise<*>} Response payload
     */
    async downloadFromWriteTarget(pid, options = {}) {
      const normalizedPid = this.constructor.normalizePid(pid);
      const { responseType = "blob", ...requestOptions } = options;
      const response = await this.requestWithClient(
        this.getWriteClient("downloadFromWriteTarget"),
        this.constructor.buildRequestOptions({
          options: requestOptions,
          path: this.constructor.buildPidPath(normalizedPid),
          method: "GET",
          responseType,
        }),
      );
      return response.data;
    }

    /**
     * Create a new DataONE object.
     * @param {object} params Creation params.
     * @param {string} params.pid PID for the new object.
     * @param {*} params.object Object payload.
     * @param {string} params.sysMetaXml System metadata XML.
     * @param {string} [params.fileName] Optional filename.
     * @param {object} [options] Transfer options.
     * @returns {Promise<DataONEHttpResponse>} Upload response.
     * @throws {Error} When required params are missing or the request fails
     */
    async create(params = {}, options = {}) {
      const { pid, object, sysMetaXml, fileName } = params;
      const normalizedPid = this.constructor.normalizePid(pid);
      const normalizedSysMetaXml = ValueUtilities.requireNonEmptyString(
        sysMetaXml,
        "ObjectService: sysMetaXml is required",
      );
      if (object === undefined || object === null) {
        throw new Error("ObjectService: object is required");
      }

      return this.sendTransferRequest(
        "create",
        "",
        "POST",
        this.constructor.buildTransferFormData({
          pid: normalizedPid,
          object,
          sysMetaXml: normalizedSysMetaXml,
          fileName,
        }),
        "ObjectService.create",
        options,
      );
    }

    /**
     * Update an existing DataONE object.
     * @param {object} params Update params.
     * @param {string} params.pid Existing (old) PID.
     * @param {string} params.newPid Replacement PID.
     * @param {*} params.object Updated object payload.
     * @param {string} params.sysMetaXml Updated system metadata XML.
     * @param {string} [params.fileName] Optional filename.
     * @param {object} [options] Transfer options.
     * @returns {Promise<DataONEHttpResponse>} Update response.
     * @throws {Error} When required params are missing or the request fails
     */
    async update(params = {}, options = {}) {
      const { pid, newPid, object, sysMetaXml, fileName } = params;
      const normalizedPid = this.constructor.normalizePid(pid);
      const normalizedNewPid = this.constructor.normalizePid(newPid, "newPid");
      const normalizedSysMetaXml = ValueUtilities.requireNonEmptyString(
        sysMetaXml,
        "ObjectService: sysMetaXml is required",
      );
      if (object === undefined || object === null) {
        throw new Error("ObjectService: object is required");
      }

      return this.sendTransferRequest(
        "update",
        this.constructor.encodePidPath(normalizedPid),
        "PUT",
        this.constructor.buildTransferFormData({
          pid: normalizedPid,
          newPid: normalizedNewPid,
          object,
          sysMetaXml: normalizedSysMetaXml,
          fileName,
        }),
        "ObjectService.update",
        options,
      );
    }
  }

  /** @type {DataONEService#DataONEServiceConfig} */
  ObjectService.config = {
    endpoint: "object",
    persistPrivate: false,
    defaultAuth: true,
  };

  return ObjectService;
});
