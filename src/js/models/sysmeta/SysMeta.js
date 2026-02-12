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

  // TODO: Add more fields like accessPolicy, replicationPolicy, etc.
  // TODO: Add node order constant for serialization

  /**
   * Class representing System Metadata for a DataONE object. This class
   * currently only provides a basic implementation for fetching and parsing
   * system metadata from a DataONE service. It excludes parsing complex
   * elements like accessPolicy and replicationPolicy. In the future, all fields
   * will be implemented, and the class will support serialization to XML and
   * updating system metadata on the server.
   * @property {object} data - The object that contains all the system metadata
   * fields, like identifier, formatId, size, checksum, etc.
   * @property {Array} errors - An array to hold any errors that occur during
   * the fetch operation.
   * @property {boolean} parsed - Indicates whether the system metadata has been
   * parsed from XML.
   * @class SystemMetadata
   * @since 2.34.0
   */
  class SystemMetadata {
    /**
     * Creates an instance of SystemMetadata.
     * @class
     * @param {object} data SystemMetadata fields and values, if known.
     */
    constructor(data = {}) {
      // Deep copy defaults so that nested objects/arrays are not shared
      const defaults = JSON.parse(JSON.stringify(DEFAULTS));
      this.data = { ...defaults, ...data };
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
     * Parses the XML string into a system metadata object.
     * @param {string} xmlString - The XML string to parse.
     * @returns {object} The parsed system metadata object.
     */
    parse(xmlString) {
      this.parsed = false;
      this.parseError = false;
      this.fetchedXmlString = xmlString;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");
      // Detect XML parser errors (e.g., when the server returns HTML)
      if (xmlDoc.querySelector("parsererror")) {
        this.parseError = true;
        throw new Error("Invalid SystemMetadata XML");
      }
      const defaults = JSON.parse(JSON.stringify(DEFAULTS));
      const sysMeta = { ...defaults };

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
        if ((value || value === "0") && !isNaN(value)) {
          sysMeta[field] = parseInt(value, 10);
        }
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

      this.data = sysMeta;

      // TODO: accessPolicy, replicationPolicy, etc.
      this.parsed = true;
      return sysMeta;
    }

    /**
     * Return a JSON-serializable representation of the SystemMetadata.
     * @returns {object} The JSON representation of the SystemMetadata, as a new
     * and unreferenced object.
     * @param {boolean} [includeErrors] Whether to include any parsing errors in
     * the output. If true, the `errors` array will be included, and if there
     * was a parsing error, an additional Error object will be added to the
     * array. If false, no errors will be included.
     * @param {Array} [otherFields] An array of other SystemMetadata fields to
     * include in the output, if they exist on the instance.
     */
    toJSON(includeErrors = true, otherFields = []) {
      const json = JSON.parse(JSON.stringify(this.data));
      if (includeErrors) {
        json.errors = this.errors ? [...this.errors] : [];
        if (this.parseError) {
          json.errors.push(new Error("Failed to parse SystemMetadata XML"));
        }
      }
      if (Array.isArray(otherFields) && otherFields.length > 0) {
        otherFields.forEach((field) => {
          if (this[field] !== undefined) {
            json[field] = this[field];
          }
        });
      }
      return json;
    }
  }

  /**
   * Create a SystemMetadata instance from an XML string.
   * @param {string} xmlString XML string to parse.
   * @returns {SystemMetadata} Parsed SystemMetadata instance.
   */
  SystemMetadata.fromXml = function fromXml(xmlString) {
    const sysMeta = new SystemMetadata();
    sysMeta.parse(xmlString);
    return sysMeta;
  };

  return SystemMetadata;
});
