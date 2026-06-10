"use strict";

define([
  "rdflib",
  "common/UrlUtilities",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
], (rdf, UrlUtilities, ValueUtilities, ResourceMapCommon) => {
  const {
    dedupeBy,
    isNonEmptyString,
    normalizeText,
    requireNonEmptyString,
    safeDecodeURIComponent,
  } = ValueUtilities;

  /**
   * Return the cached graph state when reads can safely use it.
   * @param {ResourceMap} resourceMap Resource map being inspected.
   * @returns {ResourceMapState|null} Stable graph state, or `null` during
   * mutation and for unsupported callers.
   */
  function getStableGraphState(resourceMap) {
    if (
      !resourceMap ||
      typeof resourceMap.getGraphState !== "function" ||
      resourceMap.isGraphMutating?.()
    ) {
      return null;
    }

    return resourceMap.getGraphState();
  }

  /**
   * Recover the literal payload from a malformed external-client URI artifact.
   * @param {string} value Candidate malformed URI value.
   * @returns {{lexicalValue: string, datatypeUri: string, rawValue:
   * string}|null} Recovered literal metadata.
   */
  function extractMalformedResourceValue(value) {
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
    if (!match) {
      return null;
    }

    return {
      lexicalValue: normalizeText(match[1]),
      datatypeUri: normalizeText(match[2]),
      rawValue: normalizedValue,
    };
  }

  /**
   * Read a normalized string from either a literal or a recoverable malformed
   * URI artifact.
   * @param {NamedNode|Literal|BlankNode|null|undefined} objectNode RDF object
   * node.
   * @returns {string|null} Recovered string value when present.
   */
  function getLiteralLikeObjectValue(objectNode) {
    if (!objectNode) {
      return null;
    }

    if (objectNode.termType === "Literal") {
      return normalizeText(objectNode.value);
    }

    if (objectNode.termType === "NamedNode") {
      return (
        extractMalformedResourceValue(objectNode.value)?.lexicalValue || null
      );
    }

    return null;
  }

  /**
   * Read a normalized string from a literal node only.
   * @param {NamedNode|Literal|BlankNode|null|undefined} objectNode RDF object
   * node.
   * @returns {string|null} Literal value when present.
   */
  function getLiteralObjectValue(objectNode) {
    if (objectNode?.termType !== "Literal") {
      return null;
    }
    return normalizeText(objectNode.value);
  }

  /**
   * Recover a PID-like value from a non-URL named-node string.
   * @param {string} value Candidate node value.
   * @returns {string|null} Recovered PID-like value.
   */
  function recoverBarePidValue(value) {
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
  }

  /**
   * Read the `dcterms:identifier` literal attached to a named node.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {NamedNode|Literal|BlankNode|null|undefined} node RDF node to
   * inspect.
   * @returns {string|null} Identifier value when present.
   */
  function identifierFromNode(resourceMap, node) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.identifierFromNode(node);
    }

    if (!node || node.termType !== "NamedNode") {
      return null;
    }

    const identifierStatement = resourceMap.graph
      .statementsMatching(
        node,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
        undefined,
      )
      .find((statement) =>
        isNonEmptyString(getLiteralObjectValue(statement.object)),
      );

    return getLiteralObjectValue(identifierStatement?.object);
  }

  /**
   * Recover a PID from a named node using identifier literals, resolve URIs, or
   * optional bare values.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {NamedNode|Literal|BlankNode|null|undefined} node RDF node to
   * inspect.
   * @param {object} [options] Recovery options.
   * @param {boolean} [options.allowBareValue] Whether bare values may be
   * treated as PIDs.
   * @returns {string|null} Recovered PID.
   */
  function recoverPidFromNode(
    resourceMap,
    node,
    { allowBareValue = false } = {},
  ) {
    if (!node || node.termType !== "NamedNode") {
      return null;
    }

    const directPid =
      identifierFromNode(resourceMap, node) ||
      resourceMap.constructor.uriToPid(node.value);
    if (isNonEmptyString(directPid)) {
      return directPid;
    }

    const fragmentlessValue = UrlUtilities.stripFragment(node.value);
    if (fragmentlessValue !== node.value) {
      const fragmentlessNode = rdf.sym(fragmentlessValue);
      const fragmentlessPid =
        identifierFromNode(resourceMap, fragmentlessNode) ||
        resourceMap.constructor.uriToPid(fragmentlessValue);
      if (isNonEmptyString(fragmentlessPid)) {
        return fragmentlessPid;
      }
    }

    if (!allowBareValue) {
      return null;
    }

    return (
      recoverBarePidValue(node.value) || recoverBarePidValue(fragmentlessValue)
    );
  }

  /**
   * Infer a resolve-service base URL from any named node in the graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {string|null} fallbackBaseUrl Fallback base URL.
   * @returns {string|null} Inferred resolve base URL.
   */
  function inferResolveBase(resourceMap, fallbackBaseUrl) {
    if (!resourceMap?.graph?.statements) {
      return null;
    }
    const candidateValues = [];

    resourceMap.graph.statements.forEach((statement) => {
      if (statement.subject?.termType === "NamedNode") {
        candidateValues.push(statement.subject.value);
      }
      if (statement.object?.termType === "NamedNode") {
        candidateValues.push(statement.object.value);
      }
    });

    for (let i = 0; i < candidateValues.length; i += 1) {
      const baseUrl = UrlUtilities.extractBaseUrl(candidateValues[i], {
        requiredPathSegment: "/resolve/",
        trailingSlash: "ensure",
      });
      if (baseUrl) return baseUrl;
    }

    return fallbackBaseUrl;
  }

  /**
   * Infer the current resource map URI from existing identifier, type, or
   * describes statements.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {string|null} Inferred resource map URI.
   */
  function inferResourceMapUri(resourceMap) {
    const identifierStatements = resourceMap.graph.statementsMatching(
      undefined,
      resourceMap.ns.DCTERMS("identifier"),
      undefined,
      undefined,
    );

    const identifierMatch = identifierStatements.find(
      (statement) =>
        statement.object?.value === resourceMap.resourceMapPid &&
        statement.subject?.termType === "NamedNode",
    );
    if (identifierMatch) {
      return identifierMatch.subject.value;
    }

    const describesMatch = resourceMap.graph
      .statementsMatching(undefined, resourceMap.ns.ORE("describes"), undefined)
      .find(
        (statement) =>
          resourceMap.constructor.uriToPid(statement.subject?.value) ===
          resourceMap.resourceMapPid,
      );
    if (describesMatch) {
      return describesMatch.subject.value;
    }

    const typedMatch = resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.RDF("type"),
        resourceMap.ns.ORE("ResourceMap"),
      )
      .find(
        (statement) =>
          resourceMap.constructor.uriToPid(statement.subject?.value) ===
          resourceMap.resourceMapPid,
      );
    if (typedMatch) {
      return typedMatch.subject.value;
    }

    return null;
  }

  /**
   * Infer the aggregation URI from `ore:describes` or `ore:isDescribedBy`.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {string|null} Inferred aggregation URI.
   */
  function inferAggregationUri(resourceMap) {
    const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
    const describesStatement = resourceMap.graph.statementsMatching(
      resourceMapNode,
      resourceMap.ns.ORE("describes"),
      undefined,
      undefined,
    )[0];
    if (describesStatement?.object?.value) {
      return describesStatement.object.value;
    }

    const describedByStatement = resourceMap.graph.statementsMatching(
      undefined,
      resourceMap.ns.ORE("isDescribedBy"),
      resourceMapNode,
      undefined,
    )[0];
    return describedByStatement?.subject?.value || null;
  }

  /**
   * Resolve a DataONE PID from a named RDF node.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {NamedNode|Literal|BlankNode|null|undefined} node RDF node to
   * inspect.
   * @returns {string|null} Resolved PID.
   */
  function pidFromNode(resourceMap, node) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.pidFromNode(node);
    }

    if (!node || node.termType !== "NamedNode") {
      return null;
    }

    return (
      identifierFromNode(resourceMap, node) ||
      resourceMap.constructor.uriToPid(node.value)
    );
  }

  /**
   * Collect aggregated member PID/URI descriptors from the ORE membership
   * graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {Array<{pid: string, uri: string}>} Aggregated member descriptors.
   */
  function collectMemberDescriptors(resourceMap) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.getMemberDescriptors();
    }

    const aggregationNode = rdf.sym(resourceMap.aggregationUri);
    const members = [];
    /**
     * Add one resolvable named member node to the candidate list.
     * @param {NamedNode|BlankNode|Literal|null|undefined} node Candidate node.
     */
    const addMember = (node) => {
      if (node?.termType !== "NamedNode") return;

      const pid = pidFromNode(resourceMap, node);
      if (!pid) return;

      members.push({
        pid,
        uri: node.value,
      });
    };

    resourceMap.graph
      .statementsMatching(
        aggregationNode,
        resourceMap.ns.ORE("aggregates"),
        undefined,
        undefined,
      )
      .forEach((statement) => addMember(statement.object));

    resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.ORE("isAggregatedBy"),
        aggregationNode,
        undefined,
      )
      .forEach((statement) => addMember(statement.subject));

    if (members.length) {
      return dedupeBy(members, (member) => member.pid);
    }

    return dedupeBy(
      resourceMap.graph
        .statementsMatching(
          undefined,
          resourceMap.ns.ORE("aggregates"),
          undefined,
        )
        .map((statement) => statement.object)
        .filter((node) => node?.termType === "NamedNode")
        .map((node) => ({
          pid: pidFromNode(resourceMap, node),
          uri: node.value,
        }))
        .filter((member) => isNonEmptyString(member.pid)),
      (member) => member.pid,
    );
  }

  /**
   * Collect aggregated member PIDs.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {string[]} Aggregated member PIDs.
   */
  function collectMemberPids(resourceMap) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.getMemberPids();
    }

    return collectMemberDescriptors(resourceMap).map((member) => member.pid);
  }

  /**
   * Collect normalized reciprocal documentation links from CiTO statements.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {Array<{metadataPid: string, dataPid: string}>} Normalized
   * documentation links.
   */
  function collectDocLinks(resourceMap) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.getDocumentationLinks();
    }

    const documentationLinks = [];

    resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.CITO("documents"),
        undefined,
      )
      .forEach((statement) => {
        const metadataPid = pidFromNode(resourceMap, statement.subject);
        const dataPid = pidFromNode(resourceMap, statement.object);
        if (metadataPid && dataPid) {
          documentationLinks.push({ metadataPid, dataPid });
        }
      });

    resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.CITO("isDocumentedBy"),
        undefined,
      )
      .forEach((statement) => {
        const dataPid = pidFromNode(resourceMap, statement.subject);
        const metadataPid = pidFromNode(resourceMap, statement.object);
        if (metadataPid && dataPid) {
          documentationLinks.push({ metadataPid, dataPid });
        }
      });

    return dedupeBy(documentationLinks, ResourceMapCommon.buildKey);
  }

  /**
   * Collect creator statements from either `dc:creator` or `dcterms:creator`.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {Statement[]} Matching creator statements.
   */
  function collectCreatorStatements(resourceMap) {
    const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
    return [
      ...resourceMap.graph.statementsMatching(
        resourceMapNode,
        resourceMap.ns.DC("creator"),
        undefined,
        undefined,
      ),
      ...resourceMap.graph.statementsMatching(
        resourceMapNode,
        resourceMap.ns.DCTERMS("creator"),
        undefined,
        undefined,
      ),
    ];
  }

  /**
   * Read the resource map creator name.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {string|null} Creator name when present.
   */
  function getCreatorName(resourceMap) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.getCreatorName();
    }

    const creatorStatements = collectCreatorStatements(resourceMap);

    const namedCreator = creatorStatements.find((statement) => {
      if (statement.object?.termType === "Literal") return false;
      return isNonEmptyString(
        getLiteralLikeObjectValue(
          resourceMap.graph.statementsMatching(
            statement.object,
            resourceMap.ns.FOAF("name"),
            undefined,
            undefined,
          )[0]?.object,
        ),
      );
    })?.object;
    if (namedCreator) {
      return getLiteralLikeObjectValue(
        resourceMap.graph.statementsMatching(
          namedCreator,
          resourceMap.ns.FOAF("name"),
          undefined,
          undefined,
        )[0]?.object,
      );
    }

    const literalCreator = creatorStatements.find(
      (statement) => statement.object?.termType === "Literal",
    )?.object;
    return normalizeText(literalCreator?.value);
  }

  /**
   * Read the current modified timestamp from the root node.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {string|null} Modified timestamp when present.
   */
  function getModifiedValue(resourceMap) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.getModifiedValue();
    }

    const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
    const modifiedStatements = [
      ...resourceMap.graph.statementsMatching(
        resourceMapNode,
        resourceMap.ns.DCTERMS("modified"),
        undefined,
        undefined,
      ),
      ...resourceMap.graph.statementsMatching(
        resourceMapNode,
        resourceMap.ns.DC("modified"),
        undefined,
        undefined,
      ),
    ];

    return normalizeText(modifiedStatements[0]?.object?.value);
  }

  /**
   * Find named RDF nodes by identifier literal or direct named-node value.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {string|null} identifier Identifier or URI to resolve.
   * @returns {Array<NamedNode>} Matching RDF nodes.
   */
  function findNodesByIdentifier(resourceMap, identifier) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.findNodesByIdentifier(identifier);
    }

    const normalizedIdentifier = normalizeText(identifier);
    if (!isNonEmptyString(normalizedIdentifier)) {
      return [];
    }

    const nodes = resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
        undefined,
      )
      .filter(
        (statement) =>
          getLiteralObjectValue(statement.object) === normalizedIdentifier &&
          statement.subject?.termType === "NamedNode",
      )
      .map((statement) => statement.subject);

    const directNode = rdf.sym(normalizedIdentifier);
    const hasDirectStatements =
      resourceMap.graph.statementsMatching(directNode, undefined, undefined)
        .length ||
      resourceMap.graph.statementsMatching(undefined, undefined, directNode)
        .length;
    if (hasDirectStatements) {
      nodes.push(directNode);
    }

    return dedupeBy(
      nodes,
      (node) => `${node?.termType || ""}::${node?.value || ""}`,
    );
  }

  /**
   * Find the current named-node URI used for a PID anywhere in the graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {string} pid PID to resolve.
   * @returns {string|null} Matching node URI.
   */
  function findNodeUriForPid(resourceMap, pid) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.findNodeUriForPid(pid);
    }

    const normalizedPid = requireNonEmptyString(
      pid,
      "A PID is required to find a node URI.",
    );

    const identifierMatch = resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
        undefined,
      )
      .find(
        (statement) =>
          getLiteralObjectValue(statement.object) === normalizedPid &&
          statement.subject?.termType === "NamedNode",
      );
    if (identifierMatch) {
      return identifierMatch.subject.value;
    }

    const statements = resourceMap.graph.statements || [];
    for (let i = 0; i < statements.length; i += 1) {
      const statement = statements[i];
      const candidateNodes = [statement.subject, statement.object];
      for (let j = 0; j < candidateNodes.length; j += 1) {
        const candidateNode = candidateNodes[j];
        if (
          candidateNode?.termType === "NamedNode" &&
          resourceMap.constructor.uriToPid(candidateNode.value) ===
            normalizedPid
        ) {
          return candidateNode.value;
        }
      }
    }

    return null;
  }

  /**
   * Test whether a node has a matching `dcterms:identifier` literal.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {NamedNode} node Named node to inspect.
   * @param {string} pid Expected PID.
   * @returns {boolean} `true` when the identifier is present.
   */
  function nodeHasIdentifier(resourceMap, node, pid) {
    const graphState = getStableGraphState(resourceMap);
    if (graphState) {
      return graphState.nodeHasIdentifier(node, pid);
    }

    return resourceMap.graph
      .statementsMatching(node, resourceMap.ns.DCTERMS("identifier"), undefined)
      .some((statement) => getLiteralObjectValue(statement.object) === pid);
  }

  return {
    collectCreatorStatements,
    collectDocLinks,
    collectMemberDescriptors,
    collectMemberPids,
    extractMalformedResourceValue,
    findNodesByIdentifier,
    findNodeUriForPid,
    getCreatorName,
    getLiteralLikeObjectValue,
    getLiteralObjectValue,
    getModifiedValue,
    identifierFromNode,
    inferAggregationUri,
    inferResolveBase,
    inferResourceMapUri,
    nodeHasIdentifier,
    pidFromNode,
    recoverBarePidValue,
    recoverPidFromNode,
  };
});
