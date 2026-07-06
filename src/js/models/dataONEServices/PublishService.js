define([
  "models/dataONEServices/DataONEService",
  "models/dataONEServices/DataONEHttpError",
  "common/DataONEXmlUtilities",
], (DataONEService, DataONEHttpError, DataONEXmlUtilities) => {
  /**
   * A service for publishing packages to DataONE. This service is a wrapper
   * around the DataONE Publish API.
   * @class PublishService
   * @augments DataONEService
   * @since 0.0.0
   */
  class PublishService extends DataONEService {
    /**
     * @param {object} [options] Options for the PublishService. See
     * {@link DataONEService.optionsFromDescriptor} for the shared option shape.
     * @param {string} [options.baseUrl] Endpoint-qualified publish URL
     */
    constructor(options = {}) {
      super(PublishService.optionsFromDescriptor(options));
    }

    /**
     * Publish a package and return the new identifier.
     * @param {string} pid Package PID
     * @param {object} [options] Request options
     * @returns {Promise<string>} Published identifier
     */
    async publish(pid, options = {}) {
      const normalizedPid = this.constructor.normalizePid(
        pid,
        "pid",
        "PublishService.publish requires a PID",
      );

      try {
        const response = await this.request(
          this.constructor.buildRequestOptions({
            options,
            path: this.constructor.buildPidPath(normalizedPid),
            method: "PUT",
            accept: "text/xml, application/xml, text/plain, */*",
            dedupe: false,
          }),
        );

        return this.constructor.parsePublishResponse(response.data);
      } catch (error) {
        if (error instanceof DataONEHttpError) {
          const parsedError = DataONEXmlUtilities.parseErrorXml(
            error.bodyText,
            "PublishService.publish error response",
          );
          if (parsedError && parsedError.status !== "invalid_xml") {
            throw DataONEXmlUtilities.toError(parsedError);
          }
        }
        throw error;
      }
    }

    /**
     * Parse the publish response and return the minted identifier.
     * @param {string} responseText Publish response XML
     * @returns {string} Published identifier
     */
    static parsePublishResponse(responseText) {
      const result = DataONEXmlUtilities.parseIdentifierResponse(
        responseText,
        "PublishService.publish response",
      );
      return result.identifier;
    }
  }

  /** @type {DataONEService#DataONEServiceConfig} */
  PublishService.config = {
    endpoint: "publish",
    appModelKeys: ["publishServiceUrl"],
    client: {
      timeoutMs: 2 * 60 * 1000,
      methods: ["PUT"],
      responseTypes: ["text"],
      dedupeHeaders: ["Authorization", "Accept"],
      retry: {
        maxRetries: 0,
        retryOn: [],
        retryNetworkErrors: false,
      },
    },
    persistPrivate: false,
    defaultAuth: true,
  };

  return PublishService;
});
