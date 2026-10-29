"use strict";

define([
  "common/UrlUtilities",
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
], (UrlUtilities, ValueUtilities, RDFGraph) => {
  const { isNonEmptyString, normalizeText, safeDecodeURIComponent, sortBy } =
    ValueUtilities;

  /**
   * Options for a Resource Map conflict error.
   * @typedef {object} ResourceMapConflictErrorOptions
   * @property {string} [code] Stable conflict code
   * @property {object|null} [details] Structured conflict context
   */

  /**
   * Error raised when a Resource Map cannot be edited safely because its current
   * RDF statements are missing or ambiguous.
   * @class ResourceMapConflictError
   * @classcategory Models/ResourceMap
   * @since 2.39.0
   */
  class ResourceMapConflictError extends Error {
    /**
     * Create a conflict error with stable machine-readable details.
     * @param {string} message Human readable conflict message
     * @param {object} [options] Conflict details
     * @param {string} [options.code] Stable conflict code
     * @param {object|null} [options.details] Structured conflict context
     */
    constructor(
      message = "Conflict",
      { code = "conflict", details = null } = {},
    ) {
      super(message);
      this.name = "ResourceMapConflictError";
      this.code = code;
      if (details) {
        this.details = details;
        if (Array.isArray(details.issues)) {
          this.issues = details.issues.map((issue) => ({ ...issue }));
        }
      }
    }
  }

  // Matches a DataONE resolve service URI and captures the final PID path
  // segment after percent encoding.
  const RESOLVE_URI_PATTERN = /^https?:\/\/.+\/resolve\/(?:.+\/)?([^/?#]+)$/i;

  /**
   * Namespace URIs used by ResourceMap and helper modules.
   * @type {Readonly<Object<string, string>>}
   */
  const NAMESPACES = Object.freeze({
    RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    FOAF: "http://xmlns.com/foaf/0.1/",
    DC: "http://purl.org/dc/elements/1.1/",
    ORE: "http://www.openarchives.org/ore/terms/",
    DCTERMS: "http://purl.org/dc/terms/",
    CITO: "http://purl.org/spar/cito/",
    PROV: "http://www.w3.org/ns/prov#",
    PROVONE: "http://purl.dataone.org/provone/2015/01/15/ontology#",
    XSD: "http://www.w3.org/2001/XMLSchema#",
  });

  /**
   * Functions that create RDF names from a vocabulary prefix and term, such as
   * `NS.PROV("used")`.
   * @type {Readonly<Object<string, Function>>}
   */
  const NS = Object.freeze(
    Object.fromEntries(
      Object.entries(NAMESPACES).map(([prefix, uri]) => [
        prefix,
        RDFGraph.createNamespace(uri),
      ]),
    ),
  );

  /**
   * An execution is one run of a program. These relationships point in opposite
   * directions: `data --wasGeneratedBy--> execution` means the execution
   * produced the data, while `execution --used--> data` means it consumed the
   * data. `dataFromObject` identifies which side contains the data node.
   * @type {Readonly<Object<string, {predicate: string, dataFromObject:
   * boolean}>>}
   */
  const PROV_EDGE_SPECS = Object.freeze({
    generatedByProgram: Object.freeze({
      predicate: "wasGeneratedBy",
      dataFromObject: false,
    }),
    usedByProgram: Object.freeze({
      predicate: "used",
      dataFromObject: true,
    }),
  });

  /**
   * @namespace ResourceMapCommon
   * @description Shared Resource Map vocabulary, PID, URI, and error helpers
   * @classcategory Models/ResourceMap
   * @type {object}
   * @since 2.39.0
   */
  const ResourceMapCommon = {
    NAMESPACES,
    NS,
    PROV_EDGE_SPECS,

    /**
     * Copy one RDF value into plain diagnostic data.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @returns {object|null} Copyable term details
     * @example
     * ResourceMapCommon.describeTerm(RDFGraph.createNamedNode("urn:data:1"));
     * // => { termType: "NamedNode", value: "urn:data:1", ... }
     */
    describeTerm(term) {
      if (!term) return null;
      return {
        termType: term.termType || null,
        value: term.value ?? null,
        datatype: RDFGraph.isLiteral(term)
          ? term.datatype?.value || null
          : null,
        language: RDFGraph.isLiteral(term) ? term.lang || null : null,
      };
    },

    /**
     * Test whether a term identifies a resource with a complete URI or URN.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @returns {boolean} Whether the term is an absolute named node
     * @example
     * ResourceMapCommon.isAbsoluteNamedNode(
     *   RDFGraph.createNamedNode("urn:data:1"),
     * ); // => true
     */
    isAbsoluteNamedNode(term) {
      return (
        RDFGraph.isNamedNode(term) &&
        ResourceMapCommon.isAbsoluteIri(term.value)
      );
    },

    /**
     * Read the PID claimed by one identifier literal, recognizing only
     * configured DataONE URL forms.
     * @param {Literal} literal Identifier literal
     * @param {string} [expectedPid] Already known PID to keep if the text matches
     * it exactly, even when that PID is itself a complete URL
     * @param {object} [endpoints] Resolve and object service URLs configured for
     * this Resource Map
     * @returns {string|null} PID claim, or null for nonliterals or empty text
     * @example
     * ResourceMapCommon.identifierLiteralPid(
     *   RDFGraph.createLiteral("https://cn.example/resolve/data.1"),
     *   null,
     *   { resolveServiceUrl: "https://cn.example/resolve" },
     * ); // => "data.1"
     */
    identifierLiteralPid(literal, expectedPid, endpoints) {
      return ResourceMapCommon.managedIdentifierValuePid(
        RDFGraph.getLiteralValue(literal),
        expectedPid,
        endpoints,
      );
    },

    /**
     * Recover the original text and datatype from a known malformed URI written
     * by an external RDF client.
     * @param {string} value Candidate malformed URI value.
     * @returns {{lexicalValue: string, datatypeUri: string}|null} Recovered
     * literal metadata
     */
    extractMalformedResourceValue(value) {
      if (typeof value !== "string" || value.length === 0) {
        return null;
      }

      const decodedValue = value
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      const match = decodedValue.match(
        /^file:\/\/\/[^"]*"([\s\S]*)"\^\^<([^>]+)>$/,
      );

      return match
        ? {
            lexicalValue: match[1],
            datatypeUri: match[2],
          }
        : null;
    },

    /**
     * Read the PID claimed by an identifier value. A bare PID is returned
     * unchanged. URL prefixes are removed only for configured DataONE services.
     * An exact expected PID is preserved first, even when it is a complete URL.
     * @param {string} value Identifier literal value
     * @param {string} [expectedPid] Already known PID, which may itself be a URL
     * @param {object} [endpoints] DataONE service URLs configured for this map
     * @param {string} [endpoints.resolveServiceUrl] Resolve service base URL
     * @param {string} [endpoints.objectServiceUrl] Object service base URL
     * @returns {string|null} PID claim
     */
    managedIdentifierValuePid(value, expectedPid, endpoints) {
      const literalValue = normalizeText(value);
      if (!isNonEmptyString(literalValue)) return null;

      // The PID may itself be a URL; preserve an exact known value first.
      if (literalValue === expectedPid) return literalValue;

      // An unconfigured URL may itself be a PID.
      return (
        ResourceMapCommon.configuredEndpointPids(literalValue, endpoints)[0] ||
        literalValue
      );
    },

    /**
     * Read distinct PIDs from the configured endpoint URLs.
     * Return an empty array for URLs outside those endpoints.
     * @param {string} value Candidate node or identifier URL
     * @param {object} [endpoints] Configured DataONE services
     * @param {string} [endpoints.resolveServiceUrl] CN resolve service URL
     * @param {string} [endpoints.objectServiceUrl] Object read service URL
     * @returns {string[]} Distinct endpoint PIDs, decoded once
     * @since 2.41.0
     */
    configuredEndpointPids(
      value,
      { resolveServiceUrl, objectServiceUrl } = {},
    ) {
      return Array.from(
        new Set(
          [resolveServiceUrl, objectServiceUrl]
            .map((serviceUrl) =>
              ResourceMapCommon.configuredEndpointPid(value, serviceUrl),
            )
            .filter(isNonEmptyString),
        ),
      );
    },

    /**
     * Test whether a value is a complete IRI with a scheme such as `https:` or
     * `urn:`.
     * @param {string} value Candidate IRI value
     * @returns {boolean} Whether the value is absolute
     */
    isAbsoluteIri(value) {
      return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalizeText(value) || "");
    },

    /**
     * Return a PID only when a URI is the configured DataONE service URL
     * followed by one PID path segment. This prevents an arbitrary imported URL
     * from being mistaken for a managed PID.
     * @param {string} value Candidate absolute endpoint URI
     * @param {string} serviceUrl Configured resolver or object service base
     * @returns {string|null} PID decoded once, or null if the URL does not match
     */
    configuredEndpointPid(value, serviceUrl) {
      const uri = normalizeText(value);
      const base = UrlUtilities.normalizeUrl(serviceUrl, "", {
        trailingSlash: "ensure",
      });
      if (
        !ResourceMapCommon.isAbsoluteIri(uri) ||
        !isNonEmptyString(base) ||
        !uri.startsWith(base)
      ) {
        return null;
      }

      const encodedPid = uri.slice(base.length);
      if (!isNonEmptyString(encodedPid) || /[/?#]/.test(encodedPid)) {
        return null;
      }

      try {
        // Accept both urn:uuid:abc and urn%3Auuid%3Aabc. Decode only once:
        // literal%252Fpid means PID "literal%2Fpid", not "literal/pid".
        const pid = decodeURIComponent(encodedPid);
        return isNonEmptyString(pid) ? pid : null;
      } catch {
        return null;
      }
    },

    /**
     * Extract a DataONE PID from a resolve service URI.
     * @param {string} value Candidate URI
     * @returns {string|null} Decoded PID when the URI matches a DataONE resolve
     * URL
     * @example uriToPid(".../resolve/data.1") => "data.1"
     */
    uriToPid(value) {
      const normalized = UrlUtilities.stripFragment(value);
      if (!isNonEmptyString(normalized) || normalized.startsWith("_:")) {
        return null;
      }

      const resolveMatch = normalized.match(RESOLVE_URI_PATTERN);
      if (!resolveMatch?.[1]) return null;

      const decoded = UrlUtilities.decodeDataONEPidFromPath(resolveMatch[1]);
      return isNonEmptyString(decoded)
        ? decoded
        : normalizeText(resolveMatch[1]);
    },

    /**
     * Test whether an identifier is either the expected PID or a configured
     * DataONE URL for that PID.
     * @param {string} value Candidate identifier value
     * @param {string} pid Expected PID
     * @param {object} [endpoints] Configured DataONE services
     * @param {string} [endpoints.resolveServiceUrl] CN resolve service URL
     * @param {string} [endpoints.objectServiceUrl] Object read service URL
     * @returns {boolean} `true` when the value and PID are equivalent
     */
    identifierMatchesPid(value, pid, endpoints) {
      const normalizedValue = normalizeText(value);
      const normalizedPid = normalizeText(pid);
      if (
        !isNonEmptyString(normalizedValue) ||
        !isNonEmptyString(normalizedPid)
      ) {
        return false;
      }

      return (
        normalizedValue === normalizedPid ||
        ResourceMapCommon.recoverPidFromUri(normalizedValue, endpoints) ===
          normalizedPid
      );
    },

    /**
     * Test whether a URI is a valid DataONE resolve service URI for a PID.
     * @param {string} value Candidate URI
     * @param {string} pid Expected PID
     * @param {object} [options] URI matching options
     * @param {boolean} [options.allowFragment] Whether hash fragments are
     * accepted, e.g. `https://cn.dataone.org/cn/v2/resolve/data.1#section1`
     * @returns {boolean} True when the URI resolves to the expected PID
     * @example
     * isResolveUriForPid(".../resolve/data.1", "data.1") => true
     * isResolveUriForPid(".../resolve/doi:10.5063/F1+ABC", "doi:10.5063/F1+ABC") => false
     */
    isResolveUriForPid(value, pid, { allowFragment = true } = {}) {
      const normalizedUri = normalizeText(value);
      const normalizedPid = normalizeText(pid);
      if (
        !isNonEmptyString(normalizedUri) ||
        !isNonEmptyString(normalizedPid)
      ) {
        return false;
      }

      if (!allowFragment && normalizedUri.includes("#")) {
        return false;
      }

      const withoutFragment = UrlUtilities.stripFragment(normalizedUri);
      const resolveMatch = withoutFragment.match(RESOLVE_URI_PATTERN);
      if (!resolveMatch?.[1]) return false;

      // DataONE path encoding requires a literal PID plus sign to be `%2B`;
      // accepting `+` would make distinct PID spellings appear equivalent.
      return (
        !resolveMatch[1].includes("+") &&
        ResourceMapCommon.uriToPid(normalizedUri) === normalizedPid
      );
    },

    /**
     * Treat an RDF resource value without a URL scheme as a possible bare PID.
     * @param {string} value Candidate node value.
     * @returns {string|null} Value that may be a PID.
     */
    recoverBarePidValue(value) {
      const normalizedValue = normalizeText(value);
      if (
        !isNonEmptyString(normalizedValue) ||
        normalizedValue.startsWith("_:")
      ) {
        return null;
      }

      if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\/.+/.test(normalizedValue)) {
        return null;
      }

      return normalizeText(
        safeDecodeURIComponent(UrlUtilities.stripFragment(normalizedValue)),
      );
    },

    /**
     * Find the PID represented by an RDF resource URI. Prefer its declared
     * identifier, then configured DataONE endpoints, and optionally a bare value.
     * @param {string} uri Named node URI or value
     * @param {object} [options] Recovery options
     * @param {Map<string, string>} [options.identifierForUri] Identifier lookup
     * by URI
     * @param {boolean} [options.allowBareValue] Whether bare values may be PIDs
     * @param {string} [options.resolveServiceUrl] Configured CN resolve URL
     * @param {string} [options.objectServiceUrl] Configured object read URL
     * @returns {string|null} Recovered PID
     */
    recoverPidFromUri(
      uri,
      {
        identifierForUri = null,
        allowBareValue = false,
        resolveServiceUrl,
        objectServiceUrl,
      } = {},
    ) {
      if (!isNonEmptyString(uri)) {
        return null;
      }

      const directPid =
        identifierForUri?.get(uri) ||
        ResourceMapCommon.configuredEndpointPids(uri, {
          resolveServiceUrl,
          objectServiceUrl,
        })[0];
      if (isNonEmptyString(directPid)) {
        return directPid;
      }

      const fragmentlessUri = UrlUtilities.stripFragment(uri);
      if (fragmentlessUri !== uri) {
        const fragmentlessPid = identifierForUri?.get(fragmentlessUri);
        if (isNonEmptyString(fragmentlessPid)) {
          return fragmentlessPid;
        }
      }

      if (!allowBareValue) {
        return null;
      }

      return ResourceMapCommon.recoverBarePidValue(uri);
    },

    /**
     * Sort records by explicit ordered fields.
     * @param {Array<object>} values Records to sort.
     * @param {string[]} fields Ordered field names.
     * @returns {Array<object>} Sorted shallow copy.
     */
    sortByFields(values, fields) {
      return sortBy(values, (value) =>
        RDFGraph.buildKey(fields.map((field) => value?.[field])),
      );
    },

    /**
     * Test whether an external provenance PID is already a complete URI or URN
     * and can therefore identify its RDF node directly.
     * @param {string} pid PID to inspect.
     * @returns {boolean} Whether the PID is an absolute URN or URI.
     */
    isExternalDirectUriPid(pid) {
      const normalizedPid = normalizeText(pid);
      return (
        /^urn:/i.test(normalizedPid) ||
        /^[A-Za-z][A-Za-z0-9+.-]*:\/\/.+/.test(normalizedPid)
      );
    },

    ResourceMapConflictError,
  };

  return ResourceMapCommon;
});
