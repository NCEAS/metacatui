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
  // TODO: Add more fields like accessPolicy, replicationPolicy, etc.
  // TODO: Add node order constant for serialization

  class SystemMetadata {
    constructor({ identifier, metaServiceUrl } = {}) {
      if (!metaServiceUrl || typeof metaServiceUrl !== "string") {
        throw new Error("metaServiceUrl is required and must be a string");
      }

      if (!identifier) {
        throw new Error("identifier is required");
      }

      this.metaServiceUrl = metaServiceUrl.endsWith("/")
        ? metaServiceUrl
        : `${metaServiceUrl}/`;

      // Initialize fields with null/defaults
      this.data = { ...DEFAULTS, identifier };
    }

    get url() {
      return `${this.metaServiceUrl}${encodeURIComponent(this.data.identifier)}`;
    }

    async fetch(token) {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(this.url, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch SysMeta: ${response.status}`);
      }

      const text = await response.text();
      return this.parse(text);
    }

    parse(xmlString) {
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

      this.data = sysMeta;
      return sysMeta;
    }
  }

  return SystemMetadata;
});
