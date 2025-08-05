define([], () => {
  // TODO: update eslint config to ecmaVersion 2022 to support static class
  // fields, then move these constants to the class body

  const SIMPLE_TEXT_FIELDS = [
    "identifier",
    "formatId",
    "submitter",
    "rightsHolder",
    "obsoletes",
    "obsoletedBy",
    "originMemberNode",
    "authoritativeMemberNode",
    "fileName",
  ];

  const SIMPLE_NUMBER_FIELDS = ["serialVersion", "size"];
  const SIMPLE_BOOLEAN_FIELDS = ["archived"];
  const DATE_FIELDS = ["dateUploaded", "dateSysMetadataModified"];
  const DEFAULTS = {
    identifier: null,
    formatId: null,
    size: null,
    checksum: null,
    checksumAlgorithm: null,
    submitter: null,
    rightsHolder: null,
    dateUploaded: null,
    dateSysMetadataModified: null,
    originMemberNode: null,
    authoritativeMemberNode: null,
    accessPolicy: [],
    replicationAllowed: false,
    numberReplicas: 0,
    preferredNodes: [],
    blockedNodes: [],
    obsoletes: null,
    obsoletedBy: null,
    archived: false,
    serialVersion: null,
  };

  const DEFAULT_META_SERVICE_URL = MetacatUI.appModel.get("metaServiceUrl");
  // TODO: Add more fields like accessPolicy, replicationPolicy, etc.
  // TODO: Add node order constant for serialization

  /**
   * Class representing System Metadata for a DataONE object. This class
   * currently only provides a basic implementation for fetching and parsing
   * system metadata from a DataONE service. It excludes parsing complex
   * elements like accessPolicy and replicationPolicy. In the future, all fields
   * will be implemented, and the class will support serialization to XML and
   * updating system metadata on the server.
   * @property {string} metaServiceUrl - The URL of the metadata service.
   * @property {object} data - The object that contains all the system metadata
   * fields, like identifier, formatId, size, checksum, etc.
   * @property {boolean} fetched - Indicates whether the system metadata has
   * been fetched successfully.
   * @property {boolean} fetchedWithError - Indicates whether there was an error
   * during the fetch operation.
   * @property {Array} errors - An array to hold any errors that occur during
   * the fetch operation.
   * @property {boolean} parsed - Indicates whether the system metadata has been
   * parsed from XML.
   * @property {string} url - The URL to fetch the system metadata.
   * @class SystemMetadata
   * @since 2.34.0
   */
  class SystemMetadata {
    /**
     * Creates an instance of SystemMetadata.
     * @class
     * @param {object} options - Configuration options for the SystemMetadata instance.
     * @param {string} options.identifier - The identifier for the DataONE object.
     * @param {string} [options.metaServiceUrl] - The URL of the metadata service.
     */
    constructor({ identifier, metaServiceUrl } = {}) {
      const defaultUrl = SystemMetadata.DEFAULT_META_SERVICE_URL;
      let url = metaServiceUrl || defaultUrl;
      url = typeof url !== "string" ? defaultUrl : url;

      if (!identifier) {
        throw new Error("identifier is required");
      }

      this.metaServiceUrl = url.endsWith("/") ? url : `${url}/`;

      // Initialize fields with null/defaults
      this.data = { ...DEFAULTS, identifier };

      // Initialize state, errors, and version tracking
      this.fetched = false;
      this.fetchedWithError = false;
    }

    /**
     * Returns the URL for fetching the system metadata.
     * @returns {string} The URL to fetch the system metadata.
     */
    get url() {
      const id = this.data.identifier;
      if (!id || typeof id !== "string") {
        throw new Error("identifier must be a non-empty string");
      }
      return `${this.metaServiceUrl}${encodeURIComponent(id)}`;
    }

    /**
     * Fetches the system metadata from the configured URL.
     * @param {string} [token] - Optional authentication token for the request.
     * @returns {Promise<object|null>} A promise that resolves to the system
     * metadata object or null if an error occurs.
     */
    async fetch(token) {
      this.parsed = false;
      this.fetched = false;
      this.fetchedWithError = false;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const options = { headers, credentials: "include" };

      let response;
      try {
        response = await fetch(this.url, options);
      } catch (networkError) {
        this.handleFetchError(networkError);
        return null;
      }

      const text = await response.text();

      if (!response.ok) {
        const parsedError = SystemMetadata.parseError(text);
        this.handleFetchError({
          status: parsedError?.status ?? response.status,
          message: parsedError?.message ?? "Failed to fetch system metadata",
        });
        return null;
      }

      try {
        const parsed = this.parse(text);
        this.data = { ...DEFAULTS, ...parsed };
        this.fetched = true;
        return this.data;
      } catch (parseError) {
        this.handleFetchError(parseError);
        return null;
      }
    }

    /**
     * Attempts to parse an xml error object returned from DataONE, e.g.:
     * <?xml version="1.0" encoding="UTF-8"?><error detailCode="1040" errorCode="401" name="NotAuthorized">
     * <description>READ not allowed on urn:uuid:c6556d90-4f58-4439-a309-a517a4fe3dc3 for subject[s]: public; </description>
     * </error>
     * @param {string} text - The XML string to parse.
     * @returns {Error|null} Returns a SysMetaError with the error message and status
     * if the XML contains an error element, or null if no error is found.
     */
    static parseError(text) {
      if (!text) return null;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");
      const errorEl = xmlDoc.querySelector("error");

      if (!errorEl) return null;

      const message = errorEl.querySelector("description")
        ? errorEl.querySelector("description").textContent.trim()
        : "Unknown error";
      const status = errorEl.getAttribute("errorCode") || "unknown";

      // return new SysMetaError(message, status);
      const error = new Error(message);
      error.name = "SysMetaError";
      error.status = status;
      return error;
    }

    /**
     * Handles errors that occur during the fetch operation.
     * @param {Error} e - The error object containing error details.
     */
    handleFetchError(e) {
      this.fetched = false;
      this.parsed = false;
      this.fetchedWithError = true;
      let status = e.status ?? e?.response?.status ?? 500;
      // try to coerce status to a number
      if (typeof status === "string") {
        status = parseInt(status, 10);
      }

      e.status = status;
      e.identifier = this.data.identifier;

      throw e;
    }

    /**
     * Parses the XML string into a system metadata object.
     * @param {string} xmlString - The XML string to parse.
     * @returns {object} The parsed system metadata object.
     */
    parse(xmlString) {
      this.parsed = false;
      this.fetchedXmlString = xmlString;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");
      // Detect XML parser errors (e.g., when the server returns HTML)
      if (xmlDoc.querySelector("parsererror")) {
        throw new Error("Invalid SystemMetadata XML");
      }
      const sysMeta = {};

      const getText = (tag) => {
        const el = xmlDoc.querySelector(tag);
        return el ? el.textContent.trim() : null;
      };

      // Simple fields
      SIMPLE_TEXT_FIELDS.forEach((field) => {
        sysMeta[field] = getText(field);
      });

      SIMPLE_NUMBER_FIELDS.forEach((field) => {
        const value = getText(field);
        if (value !== null) sysMeta[field] = parseInt(value, 10);
      });

      SIMPLE_BOOLEAN_FIELDS.forEach((field) => {
        const value = getText(field);
        if (value !== null) sysMeta[field] = value.toLowerCase() === "true";
      });

      DATE_FIELDS.forEach((field) => {
        const value = getText(field);
        if (value !== null) sysMeta[field] = new Date(value);
      });

      const checksumEl = xmlDoc.querySelector("checksum");
      if (checksumEl) {
        sysMeta.checksum = checksumEl.textContent.trim();
        sysMeta.checksumAlgorithm = checksumEl.getAttribute("algorithm");
      }

      // TODO: accessPolicy, replicationPolicy, etc.
      this.parsed = true;
      return sysMeta;
    }
  }

  SystemMetadata.DEFAULT_META_SERVICE_URL = DEFAULT_META_SERVICE_URL;

  return SystemMetadata;
});
