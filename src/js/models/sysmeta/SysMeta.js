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
   * @since 0.0.0
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
      this.errors = null; // Will hold any fetch errors
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
      const response = await fetch(this.url, {
        headers,
        credentials: "include",
      }).catch((err) => {
        this.handleFetchError(err);
        return null;
      });

      if (!response || !response.ok) {
        this.handleFetchError({
          status: response?.status || "unknown",
          message: response?.statusText || "Unknown error",
        });
        return null;
      }

      const text = await response.text();
      this.fetched = true;

      let parsed;
      try {
        parsed = this.parse(text) || {};
      } catch (err) {
        // Malformed XML, parser error, etc.
        this.handleFetchError(err);
        return null;
      }

      this.data = { ...DEFAULTS, ...parsed };
      return this.data;
    }

    /**
     * Handles errors that occur during the fetch operation.
     * @param {Error} err - The error object containing error details.
     * @returns {null} Returns null after logging the error.
     */
    handleFetchError(err) {
      this.fetchedWithError = true;
      // If the fetch fails, we can log the error and return null
      if (!this.errors) this.errors = [];
      this.errors.push({
        message: err.message,
        status: err.status || "unknown",
        timestamp: new Date().toISOString(),
        identifier: this.data.identifier,
        url: this.url,
      });
      /* eslint-disable-next-line no-console */
      console.error(
        `Error fetching SystemMetadata for ${this.data.identifier}: ${err.message}`,
      );
      return null;
    }

    /**
     * Parses the XML string into a system metadata object.
     * @param {string} xmlString - The XML string to parse.
     * @returns {object} The parsed system metadata object.
     */
    parse(xmlString) {
      this.parsed = false;
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
