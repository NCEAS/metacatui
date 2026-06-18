"use strict";

define(["common/UrlUtilities", "common/ValueUtilities"], (
  UrlUtilities,
  ValueUtilities,
) => {
  const {
    dedupeBy,
    isNonEmptyString,
    normalizeText,
    safeDecodeURIComponent,
    sortBy,
  } = ValueUtilities;

  /**
   * Error raised when a requested ResourceMap edit conflicts with graph state.
   */
  class ResourceMapConflictError extends Error {
    /**
     * @param {string} message Human-readable conflict message.
     * @param {object} [options] Conflict details.
     * @param {string} [options.code] Stable conflict code.
     * @param {object|null} [options.details] Structured conflict context.
     * @param {Error|null} [options.cause] Underlying error.
     */
    constructor(
      message = "Conflict",
      { code = "conflict", details = null, cause = null } = {},
    ) {
      super(message);
      this.name = "ResourceMapConflictError";
      this.code = code;
      if (details) this.details = details;
      if (cause) this.cause = cause;
    }
  }

  const ResourceMapCommon = {
    /**
     * Build a stable key from ordered parts
     * @param {string[]} parts Ordered key parts
     * @returns {string} Stable serialized key.
     */
    buildKey(parts) {
      return JSON.stringify(
        parts.map((part) => (part == null ? "" : String(part))),
      );
    },

    /**
     * Build a stable identity key for one RDF node.
     * @param {NamedNode|BlankNode|Literal|null|undefined} node RDF node.
     * @returns {string} Stable node key.
     */
    nodeKey(node) {
      return ResourceMapCommon.buildKey([
        node?.termType || "",
        node?.value || "",
      ]);
    },

    /**
     * Build a stable identity key for one RDF term, including literal type.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term.
     * @returns {string} Stable term key.
     */
    termKey(term) {
      if (!term) {
        return "null";
      }

      return ResourceMapCommon.buildKey([
        term.termType || "",
        term.value || "",
        term.termType === "Literal" ? term.lang || "" : "",
        term.termType === "Literal" ? term.datatype?.value || "" : "",
      ]);
    },

    /**
     * Build a stable identity key for one RDF statement or statement pattern.
     * @param {{subject: *, predicate: *, object: *}} statement RDF statement.
     * @returns {string} Stable statement key.
     */
    statementKey(statement) {
      return ResourceMapCommon.buildKey([
        ResourceMapCommon.termKey(statement?.subject),
        ResourceMapCommon.termKey(statement?.predicate),
        ResourceMapCommon.termKey(statement?.object),
      ]);
    },

    /**
     * Recover the literal payload from a malformed external-client URI
     * artifact.
     * @param {string} value Candidate malformed URI value.
     * @returns {{lexicalValue: string, datatypeUri: string, rawValue:
     * string}|null} Recovered literal metadata.
     */
    extractMalformedResourceValue(value) {
      const normalizedValue = normalizeText(value);
      if (!isNonEmptyString(normalizedValue)) {
        return null;
      }

      const decodedValue = normalizedValue
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      const match = decodedValue.match(
        /^file:\/\/\/[^"]*"([\s\S]*)"\^\^<([^>]+)>$/,
      );

      return match
        ? {
            lexicalValue: normalizeText(match[1]),
            datatypeUri: normalizeText(match[2]),
            rawValue: normalizedValue,
          }
        : null;
    },

    /**
     * Read a normalized string from either a literal or a recoverable malformed
     * URI artifact.
     * @param {NamedNode|Literal|BlankNode|null|undefined} objectNode RDF object.
     * @returns {string|null} Recovered string value when present.
     */
    getLiteralLikeObjectValue(objectNode) {
      if (objectNode?.termType === "Literal") {
        return normalizeText(objectNode.value);
      }
      if (objectNode?.termType === "NamedNode") {
        return (
          ResourceMapCommon.extractMalformedResourceValue(objectNode.value)
            ?.lexicalValue || null
        );
      }
      return null;
    },

    /**
     * Read a normalized string from a literal node only.
     * @param {NamedNode|Literal|BlankNode|null|undefined} objectNode RDF object.
     * @returns {string|null} Literal value when present.
     */
    getLiteralObjectValue(objectNode) {
      return objectNode?.termType === "Literal"
        ? normalizeText(objectNode.value)
        : null;
    },

    /**
     * Recover a PID-like value from a non-URL named-node string.
     * @param {string} value Candidate node value.
     * @returns {string|null} Recovered PID-like value.
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
     * Recover a PID from one named-node URI and an optional identifier lookup.
     * @param {ResourceMap} resourceMap Resource map whose URI rules are used.
     * @param {string} uri Named-node URI or value.
     * @param {object} [options] Recovery options.
     * @param {Map<string, string>|Function} [options.identifierForUri]
     * Identifier lookup by URI.
     * @param {boolean} [options.allowBareValue] Whether bare values may be PIDs.
     * @returns {string|null} Recovered PID.
     */
    recoverPidFromUri(
      resourceMap,
      uri,
      { identifierForUri = null, allowBareValue = false } = {},
    ) {
      if (!isNonEmptyString(uri)) {
        return null;
      }

      const getIdentifier =
        typeof identifierForUri === "function"
          ? identifierForUri
          : (candidateUri) => identifierForUri?.get(candidateUri);
      const directPid =
        getIdentifier(uri) || resourceMap.constructor.uriToPid(uri);
      if (isNonEmptyString(directPid)) {
        return directPid;
      }

      const fragmentlessUri = UrlUtilities.stripFragment(uri);
      if (fragmentlessUri !== uri) {
        const fragmentlessPid =
          getIdentifier(fragmentlessUri) ||
          resourceMap.constructor.uriToPid(fragmentlessUri);
        if (isNonEmptyString(fragmentlessPid)) {
          return fragmentlessPid;
        }
      }

      if (!allowBareValue) {
        return null;
      }

      return (
        ResourceMapCommon.recoverBarePidValue(uri) ||
        ResourceMapCommon.recoverBarePidValue(fragmentlessUri)
      );
    },

    /**
     * Collect aggregation URIs associated with the current resource map.
     * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
     * @param {object} [options] Discovery options.
     * @param {Function} [options.pidFromNode] PID resolver for named nodes.
     * @param {string[]} [options.resourceMapUris] Equivalent resource map URIs.
     * @returns {string[]} Associated aggregation URIs.
     */
    collectAssociatedAggregationUris(
      resourceMap,
      { pidFromNode = () => null, resourceMapUris = [] } = {},
    ) {
      const associatedUris = new Set([resourceMap.aggregationUri]);
      resourceMapUris.filter(isNonEmptyString).forEach((uri) => {
        associatedUris.add(`${uri}#aggregation`);
      });

      resourceMap.graph.statements.forEach((statement) => {
        if (
          statement.predicate?.value ===
            resourceMap.ns.ORE("describes").value &&
          statement.object?.termType === "NamedNode" &&
          pidFromNode(statement.subject) === resourceMap.resourceMapPid
        ) {
          associatedUris.add(statement.object.value);
        }

        if (
          statement.predicate?.value ===
            resourceMap.ns.ORE("isDescribedBy").value &&
          statement.subject?.termType === "NamedNode" &&
          pidFromNode(statement.object) === resourceMap.resourceMapPid
        ) {
          associatedUris.add(statement.subject.value);
        }
      });

      return Array.from(associatedUris).filter(isNonEmptyString);
    },

    /**
     * Sort records by explicit ordered fields.
     * @param {Array<object>} values Records to sort.
     * @param {string[]} fields Ordered field names.
     * @returns {Array<object>} Sorted shallow copy.
     */
    sortByFields(values, fields) {
      return sortBy(values, (value) =>
        ResourceMapCommon.buildKey(fields.map((field) => value?.[field])),
      );
    },

    /**
     * Sort a provenance summary for deterministic output.
     * @param {object} [summary] Provenance summary.
     * @returns {object} Sorted provenance summary.
     */
    sortProvenanceSummary(summary = {}) {
      return {
        wasDerivedFrom: ResourceMapCommon.sortByFields(
          summary?.wasDerivedFrom,
          ["derivedPid", "sourcePid"],
        ),
        generatedByPrograms: ResourceMapCommon.sortByFields(
          summary?.generatedByPrograms,
          ["dataPid", "programPid", "executionId", "agentUri"],
        ),
        usedByPrograms: ResourceMapCommon.sortByFields(
          summary?.usedByPrograms,
          ["dataPid", "programPid", "executionId", "agentUri"],
        ),
        wasInformedByPrograms: ResourceMapCommon.sortByFields(
          summary?.wasInformedByPrograms,
          [
            "programPid",
            "previousProgramPid",
            "executionId",
            "previousExecutionId",
          ],
        ),
        typeAssertions: ResourceMapCommon.sortByFields(
          summary?.typeAssertions,
          ["pid", "className"],
        ),
      };
    },

    /**
     * Deduplicate RDF nodes by term type and value.
     * @param {Array<NamedNode|BlankNode|Literal>} nodes Candidate RDF nodes.
     * @returns {Array<NamedNode|BlankNode|Literal>} Deduplicated nodes.
     */
    dedupeNodes(nodes) {
      return dedupeBy((nodes || []).filter(Boolean), (node) =>
        ResourceMapCommon.nodeKey(node),
      );
    },

    /**
     * Test whether an external provenance PID can identify its RDF node
     * directly instead of through a DataONE resolve URI.
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
