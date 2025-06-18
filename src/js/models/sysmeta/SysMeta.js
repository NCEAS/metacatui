define([], () => {
  // TODO: update eslint config to ecmaVersion 2022 to support static class
  // fields, then move these constants to the class body

  const SIMPLE_TEXT_FIELDS = [
    "identifier",
    "formatId",
    "size",
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
  };

  const DEFAULT_META_SERVICE_URL = MetacatUI.appModel.get("metaServiceUrl");
  // TODO: Add more fields like accessPolicy, replicationPolicy, etc.
  // TODO: Add node order constant for serialization

  class SystemMetadata {
    constructor({ identifier, metaServiceUrl } = {}) {
      let url = metaServiceUrl || DEFAULT_META_SERVICE_URL;
      url = typeof url !== "string" ? this.DEFAULT_META_SERVICE_URL : url;

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

    get url() {
      const id = this.data.identifier;
      if (!id || typeof id !== "string") {
        throw new Error("identifier must be a non-empty string");
      }
      return `${this.metaServiceUrl}${encodeURIComponent(id)}`;
    }

    async fetch(token) {
      this.parsed = false;
      this.fetched = false;
      this.fetchedWithError = false;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(this.url, {
        headers,
        credentials: "include",
      }).catch((err) => this.handleFetchError(err));

      if (!response.ok) {
        this.handleFetchError({
          status: response.status,
          message: response.statusText,
        });
        return null;
      }

      const text = await response.text();
      this.fetched = true;
      this.data = this.parse(text) || {};
      return this.data;
    }

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

    parse(xmlString) {
      this.parsed = false;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");
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
