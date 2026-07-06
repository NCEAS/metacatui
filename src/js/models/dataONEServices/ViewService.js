define([
  "models/dataONEServices/DataONEService",
  "models/viewService/ViewServiceDoc",
  "common/ValueUtilities",
], (DataONEService, ViewServiceDoc, ValueUtilities) => {
  const DEFAULT_THEME = "metacatui";
  const DEFAULT_ACCEPT = "text/html, application/xhtml+xml, */*;q=0.8";

  /**
   * Service for fetching rendered views from the DataONE MNView API.
   * @class ViewService
   * @augments DataONEService
   * @since 0.0.0
   */
  class ViewService extends DataONEService {
    /**
     * @param {object} [options] Options for the ViewService. See
     * {@link DataONEService.optionsFromDescriptor} for the shared option shape.
     * @param {string} [options.baseUrl] Theme-qualified view-service base URL,
     * e.g. `/views/metacatui/`.
     * @param {string} [options.theme] Theme name requested by this service
     * Stored for callers; `baseUrl` is still expected to be theme-qualified in
     * this slice.
     */
    constructor(options = {}) {
      super(ViewService.optionsFromDescriptor(options));
      this.theme = ValueUtilities.normalizeText(options.theme) || DEFAULT_THEME;
      this.baseUrl = ViewService.resolveBaseUrl(options.baseUrl);
    }

    /**
     * Fetch rendered HTML and return the full normalized HTTP response.
     * @param {string} pid PID or SID to render
     * @param {object} [options] Request options for
     * {@link DataONEService#request}.
     * @returns {Promise<DataONEHttpResponse>} Normalized response
     */
    async fetch(pid, options = {}) {
      const normalizedPid = this.constructor.normalizePid(
        pid,
        "pid",
        "ViewService.fetch requires a PID",
      );

      return this.request(
        this.constructor.buildRequestOptions({
          options,
          path: this.constructor.buildPidPath(normalizedPid),
          method: "GET",
          accept: DEFAULT_ACCEPT,
        }),
      );
    }

    /**
     * Download rendered HTML and return a parsed rendered metadata document.
     * This method intentionally bypasses DataONEService.download so rendered
     * HTML is not persistently cached by default.
     * @param {string} pid PID or SID to render
     * @param {object} [options] Request and document options
     * @param {string} [options.resolveBaseUrl] Resolve URL for ecogrid rewrites
     * @returns {Promise<ViewServiceDoc>} Parsed rendered document
     */
    async download(pid, options = {}) {
      const { resolveBaseUrl, ...requestOptions } = options;
      const normalizedPid = this.constructor.normalizePid(
        pid,
        "pid",
        "ViewService.download requires a PID",
      );

      const response = await this.fetch(normalizedPid, requestOptions);
      const contentType =
        response.headers?.get?.("Content-Type") ||
        response.headers?.get?.("content-type") ||
        null;

      return ViewServiceDoc.fromHtml(response.data, {
        pid: normalizedPid,
        url: response.url,
        contentType,
        resolveBaseUrl,
      });
    }

    /**
     * Remove an explicitly cached rendered document, if a caller opted into
     * cache use in the future.
     * @param {string} pid PID to invalidate
     * @returns {Promise<void>} Promise resolving when invalidation completes
     */
    async invalidate(pid) {
      const normalizedPid = ValueUtilities.normalizeText(pid);
      if (!normalizedPid) return;
      await this.removeCached(normalizedPid);
    }
  }

  /** @type {DataONEService#DataONEServiceConfig} */
  ViewService.config = {
    endpoint: "views",
    appModelKeys: ["viewServiceUrl"],
    client: {
      timeoutMs: 2 * 60 * 1000, // 2 minutes
      methods: ["GET"],
      responseTypes: ["text"],
      dedupeHeaders: ["Authorization", "Accept"],
    },
    persistPrivate: false,
    defaultAuth: true,
  };
  ViewService.theme = DEFAULT_THEME;
  ViewService.ViewServiceDoc = ViewServiceDoc;

  return ViewService;
});
