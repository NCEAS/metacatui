define(["models/dataONEServices/DataONEService"], (DataONEService) => {
  /**
   * Service for downloading packages from the DataONE Package API.
   * @class PackageService
   * @augments DataONEService
   * @classcategory Models/DataONEServices
   * @since 0.0.0
   */
  class PackageService extends DataONEService {
    /**
     * @param {object} [options] Options for the PackageService. See
     * {@link DataONEService.optionsFromDescriptor} for the shared option shape.
     */
    constructor(options = {}) {
      super(PackageService.optionsFromDescriptor(options));
    }

    /**
     * Download a package as a Blob using the current user's authentication.
     * Package responses intentionally bypass persistent caching.
     * @param {string} pid Resource Map PID.
     * @param {object} [options] Download options.
     * @param {AbortSignal} [options.signal] Signal used to cancel the request.
     * @returns {Promise<Blob>} Package data.
     */
    download(pid, { signal } = {}) {
      return super.download(this.constructor.buildPidPath(pid), {
        signal,
        encodePath: false,
        responseType: "blob",
        useCache: false,
      });
    }
  }

  /** @type {DataONEService#DataONEServiceConfig} */
  PackageService.config = {
    endpoint: "packages",
    appModelKeys: ["packageServiceUrl"],
    client: {
      timeoutMs: null,
      retry: {
        maxRetries: 0,
      },
      methods: ["GET"],
      responseTypes: ["blob"],
      dedupeHeaders: ["Authorization"],
    },
    defaultAuth: true,
  };

  return PackageService;
});
