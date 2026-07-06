define([
  "models/dataONEServices/DataONEService",
  "common/ErrorUtilities",
  "common/UrlUtilities",
  "common/ValueUtilities",
], (DataONEService, ErrorUtilities, UrlUtilities, ValueUtilities) => {
  /**
   * Service for DataONE identifier generation and reservation.
   * @class IdentifierService
   * @augments DataONEService
   * @since 0.0.0
   */
  class IdentifierService extends DataONEService {
    /**
     * @param {object} [options] Service options. See
     * {@link DataONEService.optionsFromDescriptor} for the shared option shape.
     * @param {string} [options.baseUrl] CN DataONE API base URL (for example,
     * `https://cn.dataone.org/cn/v2`).
     */
    constructor(options = {}) {
      super(IdentifierService.optionsFromDescriptor(options));
    }

    /**
     * Resolve the CN DataONE API base URL for identifier operations. If no
     * baseUrl is provided, it is composed from the configured CN base URL and
     * service path in AppModel.
     * @param {string} [baseUrl] Candidate base URL.
     * @returns {string} Normalized base URL, or an empty string when unresolved.
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

      return "";
    }

    /**
     * Build FormData for the DataONE generateIdentifier request.
     * @param {object} [params] GenerateIdentifier params.
     * @param {string} [params.scheme] Identifier scheme.
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
      const normalizedPid = this.normalizePid(
        pid,
        "pid",
        "IdentifierService: pid is required",
      );
      const formData = new FormData();
      formData.append("pid", normalizedPid);
      return formData;
    }

    /**
     * Whether identifier generation failed for a transient network reason.
     * Callers may use this to decide whether local UUID fallback is acceptable.
     * @param {Error} error Identifier-service error.
     * @returns {boolean} Whether local UUID fallback is allowed.
     */
    static isTransientIdentifierError(error) {
      const status = Number(error?.status);
      return (
        ErrorUtilities.isTimeoutError(error) ||
        error?.name === "TypeError" ||
        error?.code === "NETWORK_ERROR" ||
        status === 0 ||
        status === 408 ||
        status >= 500
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
      return this.sendParsedIdentifierRequest({
        requestOptions: this.constructor.buildRequestOptions({
          options,
          path,
          method: "POST",
          body,
          accept: "text/xml",
          dedupe: false,
          auth: true,
        }),
        context,
      });
    }

    /**
     * Generate a new DataONE identifier.
     * @param {object} [params] Generation parameters.
     * @param {string} [params.scheme] Identifier scheme.
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

  /** @type {DataONEService#DataONEServiceConfig} */
  IdentifierService.config = {
    endpoint: "identifier",
    client: {
      timeoutMs: null,
      methods: ["POST"],
      responseTypes: ["text"],
      dedupeHeaders: ["Authorization", "Content-Type", "Accept"],
    },
    persistPrivate: false,
    defaultAuth: true,
  };

  return IdentifierService;
});
