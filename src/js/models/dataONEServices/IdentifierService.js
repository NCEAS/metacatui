define([
  "models/dataONEServices/DataONEService",
  "common/DataONEXmlUtilities",
  "common/UrlUtilities",
  "common/ValueUtilities",
], (DataONEService, DataONEXmlUtilities, ValueUtilities) => {
  /**
   * Default DataONEHttpClient options for IdentifierService.
   * @type {DataONEHttpClient#DataONEHttpClientOptions}
   */
  const DEFAULT_CLIENT_OPTIONS = {
    // baseUrl added at runtime
    timeoutMs: null,
    allowedHttpMethods: ["POST"],
    headerNamesForDedup: ["Authorization", "Content-Type", "Accept"],
    responseTypes: ["text"],
  };

  /**
   * Service for DataONE identifier generation and reservation.
   * @class IdentifierService
   * @augments DataONEService
   * @since 0.0.0
   */
  class IdentifierService extends DataONEService {
    /**
     * @param {object} [options] Service options.
     * @param {string} [options.baseUrl] CN DataONE API base URL (for example,
     * `https://cn.dataone.org/cn/v2`).
     * @param {DataONEHttpClient#DataONEHttpClientOptions}
     * [options.clientConfig] Client configuration.
     * @param {Function} [options.getToken] Override token resolver function.
     */
    constructor({ baseUrl = "", clientConfig = {}, getToken } = {}) {
      const resolvedBaseUrl = IdentifierService.resolveBaseUrl(baseUrl);

      const clientConfigWithDefaults = {
        ...DEFAULT_CLIENT_OPTIONS,
        ...clientConfig,
        baseUrl: resolvedBaseUrl,
      };

      super({
        baseUrl: resolvedBaseUrl,
        clientConfig: clientConfigWithDefaults,
        persistPrivate: false,
        defaultAuth: true,
        getToken,
      });
    }

    /**
     * Resolve the CN DataONE API base URL for identifier operations. If no
     * baseUrl is provided, then the configured url in AppModel will be used.
     * @param {string} [baseUrl] Candidate base URL.
     * @returns {string} Normalized base URL.
     */
    static resolveBaseUrl(baseUrl = "") {
      const appModel = globalThis.MetacatUI?.appModel;
      const normalizedBaseUrl = UrlUtilities.normalizeUrl(baseUrl);
      if (normalizedBaseUrl) {
        return normalizedBaseUrl;
      }

      // e.g. "https://cn.dataone.org",
      const normalizedCnBaseUrl = UrlUtilities.normalizeUrl(
        appModel?.get?.("d1CNBaseUrl"),
      );
      // e.g. "/cn/v2"
      let normalizedCnService =
        ValueUtilities.normalizeText(appModel?.get?.("d1CNService")) || "";
      normalizedCnService = normalizedCnService?.startsWith("/")
        ? normalizedCnService
        : `/${normalizedCnService}`;

      if (normalizedCnBaseUrl && normalizedCnService) {
        return UrlUtilities.buildUrl(normalizedCnBaseUrl, normalizedCnService, {
          encodePath: false,
        });
      }

      throw new Error("IdentifierService: baseUrl is required");
    }

    /**
     * Ensure a required string parameter is provided.
     * @param {string} value Parameter value.
     * @param {string} name Parameter name for error messages.
     */
    static requireString(value, name) {
      if (!ValueUtilities.isNonEmptyString(value)) {
        throw new Error(`IdentifierService: ${name} is required`);
      }
    }

    /**
     * Pick request options forwarded to DataONEService.request.
     * @param {object} [options] Candidate options.
     * @returns {object} Selected options.
     */
    static pickRequestOptions(options = {}) {
      const picked = {};
      ["signal", "timeoutMs", "retry", "headers", "transport"].forEach(
        (key) => {
          if (options[key] !== undefined) {
            picked[key] = options[key];
          }
        },
      );
      return picked;
    }

    /**
     * Build FormData for the DataONE generateIdentifier request.
     * @param {object} [params] GenerateIdentifier params.
     * @param {string} [params.scheme="UUID"] Identifier scheme.
     * @param {string} [params.fragment] Optional identifier fragment.
     * @returns {FormData} FormData payload.
     */
    static buildGenerateFormData(params = {}) {
      if (!params || Array.isArray(params) || typeof params !== "object") {
        throw new Error("IdentifierService: params must be an object");
      }

      const allowedKeys = ["scheme", "fragment"];
      const unexpectedKeys = Object.keys(params).filter(
        (key) => !allowedKeys.includes(key),
      );
      if (unexpectedKeys.length) {
        throw new Error(
          `IdentifierService: unsupported generateIdentifier params: ${unexpectedKeys.join(", ")}`,
        );
      }

      const normalizedScheme =
        ValueUtilities.normalizeText(params.scheme) || "UUID";
      const formData = new FormData();
      formData.append("scheme", normalizedScheme);

      const normalizedFragment = ValueUtilities.normalizeText(params.fragment);
      if (normalizedFragment) {
        formData.append("fragment", normalizedFragment);
      }

      return formData;
    }

    /**
     * Build FormData for the DataONE reserveIdentifier request.
     * @param {string} pid Identifier to reserve.
     * @returns {FormData} FormData payload.
     */
    static buildReserveFormData(pid) {
      this.requireString(pid, "pid");
      const formData = new FormData();
      formData.append("pid", pid);
      return formData;
    }

    /**
     * Build the request options for an identifier endpoint.
     * @param {string} path Identifier endpoint path.
     * @param {FormData} body Request payload.
     * @param {object} [options] Request options.
     * @returns {object} Normalized request options.
     */
    buildIdentifierRequest(path, body, options = {}) {
      return this.constructor.withDefaultAccept(
        {
          ...this.constructor.pickRequestOptions(options),
          auth: true,
          path,
          method: "POST",
          dedupe: false,
          responseType: "text",
          body,
        },
        "text/xml",
      );
    }

    /**
     * Execute an identifier endpoint request and normalize the XML response.
     * @param {string} path Identifier endpoint path.
     * @param {FormData} body Request payload.
     * @param {string} context Error/parse context.
     * @param {object} [options] Request options.
     * @returns {Promise<DataONEHttpResponse>} Parsed identifier response.
     */
    async sendIdentifierRequest(path, body, context, options = {}) {
      const response = await this.request(
        this.buildIdentifierRequest(path, body, options),
      );

      return {
        ...response,
        data: DataONEXmlUtilities.parseIdentifierResponse(
          response?.data,
          context,
        ),
      };
    }

    /**
     * Generate a new DataONE identifier.
     * @param {object} [params] Generation parameters.
     * @param {string} [params.scheme="UUID"] Identifier scheme.
     * @param {object} [options] Request options.
     * @returns {Promise<DataONEHttpResponse>} Parsed XML response with
     * identifier.
     */
    async generateIdentifier(params = {}, options = {}) {
      return this.sendIdentifierRequest(
        "generate",
        this.constructor.buildGenerateFormData(params),
        "IdentifierService.generateIdentifier",
        options,
      );
    }

    /**
     * Reserve an existing identifier.
     * @param {string} pid Identifier to reserve.
     * @param {object} [options] Request options.
     * @returns {Promise<DataONEHttpResponse>} Parsed XML response with
     * identifier.
     */
    async reserveIdentifier(pid, options = {}) {
      return this.sendIdentifierRequest(
        "reserve",
        this.constructor.buildReserveFormData(pid),
        "IdentifierService.reserveIdentifier",
        options,
      );
    }
  }

  IdentifierService.endpoint = "identifier";

  return IdentifierService;
});
