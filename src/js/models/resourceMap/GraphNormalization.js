"use strict";

define([
  "rdflib",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/GraphMutation",
], (rdf, ValueUtilities, ResourceMapCommon, GraphMutation) => {
  const {
    dedupeArray,
    isNonEmptyString,
    normalizeText,
    requireNonEmptyString,
  } = ValueUtilities;
  const CANONICALIZABLE_TYPED_NODE_URIS = new Set([
    "http://purl.dataone.org/provone/2015/01/15/ontology#Data",
    "http://purl.dataone.org/provone/2015/01/15/ontology#Program",
  ]);

  /**
   * Rebuild the core ORE/DataONE backbone for the current resource map.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {string[] | null} [memberPids] Known canonical member PIDs.
   */
  function synchronizeCoreGraph(resourceMap, memberPids = null) {
    const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
    const aggregationNode = rdf.sym(resourceMap.aggregationUri);

    GraphMutation.setIdentifierForUri(
      resourceMap,
      resourceMap.resourceMapUri,
      resourceMap.resourceMapPid,
    );
    GraphMutation.addStatementIfMissing(
      resourceMap,
      resourceMapNode,
      resourceMap.ns.RDF("type"),
      resourceMap.ns.ORE("ResourceMap"),
    );
    GraphMutation.addStatementIfMissing(
      resourceMap,
      aggregationNode,
      resourceMap.ns.RDF("type"),
      resourceMap.ns.ORE("Aggregation"),
    );

    GraphMutation.removeStatementsMatching(
      resourceMap,
      resourceMapNode,
      resourceMap.ns.ORE("describes"),
      undefined,
    );
    GraphMutation.removeStatementsMatching(
      resourceMap,
      aggregationNode,
      resourceMap.ns.ORE("isDescribedBy"),
      undefined,
    );

    GraphMutation.addStatementIfMissing(
      resourceMap,
      resourceMapNode,
      resourceMap.ns.ORE("describes"),
      aggregationNode,
    );
    GraphMutation.addStatementIfMissing(
      resourceMap,
      aggregationNode,
      resourceMap.ns.ORE("isDescribedBy"),
      resourceMapNode,
    );

    const useCanonicalMemberUris = memberPids !== null;
    const normalizedMemberPids = useCanonicalMemberUris
      ? memberPids
      : resourceMap.getGraphState().getMemberPids();
    normalizedMemberPids.forEach((memberPid) => {
      const memberUri = useCanonicalMemberUris
        ? resourceMap.pidToUri(memberPid)
        : resourceMap.getGraphState().findNodeUriForPid(memberPid);
      if (!memberUri) {
        return;
      }

      const memberNode = rdf.sym(memberUri);
      GraphMutation.ensureIdentifierForUri(resourceMap, memberUri, memberPid);
      GraphMutation.addStatementIfMissing(
        resourceMap,
        aggregationNode,
        resourceMap.ns.ORE("aggregates"),
        memberNode,
      );
      GraphMutation.addStatementIfMissing(
        resourceMap,
        memberNode,
        resourceMap.ns.ORE("isAggregatedBy"),
        aggregationNode,
      );
    });
  }

  /**
   * Remove duplicate RDF statements from the graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   */
  function dedupeStatements(resourceMap) {
    const seen = new Set();
    resourceMap.graph.statements.slice().forEach((statement) => {
      const key = ResourceMapCommon.statementKey(statement);
      if (seen.has(key)) {
        GraphMutation.removeStatement(resourceMap, statement);
        return;
      }

      seen.add(key);
    });
  }

  /**
   * Test whether one identifier value is equivalent to a PID under DataONE URI rules.
   * @param {ResourceMap} resourceMap Resource map whose URI rules are used.
   * @param {string} value Candidate identifier value.
   * @param {string} pid Expected PID.
   * @returns {boolean} `true` when the value and PID are equivalent.
   */
  function isEquivalentIdentifierValue(resourceMap, value, pid) {
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
      resourceMap.constructor.uriToPid(normalizedValue) === normalizedPid
    );
  }

  /**
   * Normalize identifier statements for one canonical managed node URI.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {string} uri Canonical node URI.
   * @param {string} pid PID that should remain attached to the node.
   */
  function canonicalizeIdentifierStatements(resourceMap, uri, pid) {
    const node = rdf.sym(uri);
    const identifierStatements = resourceMap.graph.statementsMatching(
      node,
      resourceMap.ns.DCTERMS("identifier"),
      undefined,
      undefined,
    );
    const removeValues = identifierStatements
      .map((statement) =>
        ResourceMapCommon.getLiteralLikeObjectValue(statement.object),
      )
      .filter(
        (value) =>
          isNonEmptyString(value) &&
          isEquivalentIdentifierValue(resourceMap, value, pid) &&
          normalizeText(value) !== normalizeText(pid),
      );

    GraphMutation.setIdentifierForUri(resourceMap, uri, pid, { removeValues });
  }

  /**
   * Rewrite malformed external-client `rdf:resource` literal artifacts as real literals.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   */
  function repairMalformedResourceArtifacts(resourceMap) {
    resourceMap.graph.statements.slice().forEach((statement) => {
      const malformed = ResourceMapCommon.extractMalformedResourceValue(
        statement.object?.value,
      );
      if (!malformed) {
        return;
      }

      GraphMutation.removeStatement(resourceMap, statement);
      GraphMutation.addStatementIfMissing(
        resourceMap,
        statement.subject,
        statement.predicate,
        rdf.literal(
          malformed.lexicalValue,
          undefined,
          rdf.sym(malformed.datatypeUri),
        ),
      );
    });
  }

  /**
   * Resolve equivalent URIs for one PID from a prebuilt index.
   * @param {Map<string, string[]>} pidToUris Indexed PID-to-URI map.
   * @param {string} pid PID whose equivalent URIs are requested.
   * @param {object} [options] Discovery options.
   * @param {boolean} [options.includeFragments] Whether fragment URIs should be returned directly.
   * @returns {string[]} Equivalent node URIs.
   */
  function discoverEquivalentNodeUrisFromIndex(
    pidToUris,
    pid,
    { includeFragments = false } = {},
  ) {
    const normalizedPid = requireNonEmptyString(
      pid,
      "GraphNormalization.discoverEquivalentNodeUrisFromIndex requires a PID",
    );
    const discoveredUris = [];

    (pidToUris.get(normalizedPid) || []).forEach((uri) => {
      if (!isNonEmptyString(uri)) {
        return;
      }

      if (includeFragments || !uri.includes("#")) {
        discoveredUris.push(uri);
      }

      if (!includeFragments) {
        const fragmentlessValue = uri.split("#")[0];
        if (fragmentlessValue !== uri) {
          discoveredUris.push(fragmentlessValue);
        }
      }
    });

    return dedupeArray(discoveredUris);
  }

  /**
   * Build a one-pass index of named RDF nodes and the PIDs they recover to.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {{pidByUri: Map<string, string>, pidToUris: Map<string, string[]>}} Indexed PID lookups.
   */
  function buildCanonicalizationIndex(resourceMap) {
    const pidByUri = new Map();
    const pidToUris = new Map();
    const identifierByUri = new Map();
    const statements = resourceMap.graph.statements || [];

    /**
     * Register one named node in the canonicalization lookup.
     * @param {NamedNode|BlankNode|Literal|null|undefined} node Candidate node.
     */
    const registerNamedNode = (node) => {
      if (node?.termType === "NamedNode" && !pidByUri.has(node.value)) {
        pidByUri.set(node.value, null);
      }
    };

    statements.forEach((statement) => {
      registerNamedNode(statement.subject);
      registerNamedNode(statement.object);

      if (
        statement.subject?.termType !== "NamedNode" ||
        statement.predicate?.value !==
          resourceMap.ns.DCTERMS("identifier").value
      ) {
        return;
      }

      const identifierValue = ResourceMapCommon.getLiteralLikeObjectValue(
        statement.object,
      );
      if (
        isNonEmptyString(identifierValue) &&
        !identifierByUri.has(statement.subject.value)
      ) {
        identifierByUri.set(statement.subject.value, identifierValue);
      }
    });

    Array.from(pidByUri.keys()).forEach((uri) => {
      const pid = ResourceMapCommon.recoverPidFromUri(resourceMap, uri, {
        identifierForUri: identifierByUri,
        allowBareValue: true,
      });
      if (!isNonEmptyString(pid)) {
        return;
      }

      pidByUri.set(uri, pid);
      if (!pidToUris.has(pid)) {
        pidToUris.set(pid, []);
      }
      pidToUris.get(pid).push(uri);
    });

    return { pidByUri, pidToUris };
  }

  /**
   * Collect recoverable aggregated member PIDs using a prebuilt PID index.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {Map<string, string>} pidByUri Indexed URI-to-PID map.
   * @param {Set<string>} aggregationUris Aggregation URI candidates.
   * @returns {string[]} Recoverable aggregated member PIDs.
   */
  function collectRecoverableMemberPidsFromIndex(
    resourceMap,
    pidByUri,
    aggregationUris,
  ) {
    const memberPids = [];

    resourceMap.graph.statements.forEach((statement) => {
      if (
        statement.predicate?.value === resourceMap.ns.ORE("aggregates").value &&
        aggregationUris.has(statement.subject?.value)
      ) {
        const pid = pidByUri.get(statement.object?.value);
        if (pid) memberPids.push(pid);
      }

      if (
        statement.predicate?.value ===
          resourceMap.ns.ORE("isAggregatedBy").value &&
        aggregationUris.has(statement.object?.value)
      ) {
        const pid = pidByUri.get(statement.subject?.value);
        if (pid) memberPids.push(pid);
      }
    });

    return dedupeArray(memberPids);
  }

  /**
   * Collect recoverable typed Data/Program PIDs using a prebuilt PID index.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {Map<string, string>} pidByUri Indexed URI-to-PID map.
   * @param {string[]} [excludedPids] PIDs to exclude from recovery.
   * @returns {string[]} Recoverable typed PIDs.
   */
  function collectRecoverableTypedPidsFromIndex(
    resourceMap,
    pidByUri,
    excludedPids = [],
  ) {
    const excludedPidSet = new Set(
      (Array.isArray(excludedPids) ? excludedPids : [excludedPids])
        .map((pid) => normalizeText(pid))
        .filter(isNonEmptyString),
    );
    const recoverablePids = [];

    resourceMap.graph
      .statementsMatching(undefined, resourceMap.ns.RDF("type"), undefined)
      .forEach((statement) => {
        if (
          !CANONICALIZABLE_TYPED_NODE_URIS.has(
            normalizeText(statement.object?.value),
          )
        ) {
          return;
        }

        const pid = pidByUri.get(statement.subject?.value);
        if (!pid || excludedPidSet.has(pid)) {
          return;
        }

        recoverablePids.push(pid);
      });

    return dedupeArray(recoverablePids);
  }

  /**
   * Remove Data/Program type triples already implied by provenance edges.
   * These roles are derived in ResourceMapState and materialized again during
   * serialization; only unsupported type triples remain explicit annotations.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   */
  function removeDerivedRoleTypeAssertions(resourceMap) {
    const dataNodes = [];
    const programNodes = [];

    resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.PROV("wasDerivedFrom"),
        undefined,
      )
      .forEach(({ subject, object }) => dataNodes.push(subject, object));
    resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.PROV("wasGeneratedBy"),
        undefined,
      )
      .forEach(({ subject }) => dataNodes.push(subject));
    resourceMap.graph
      .statementsMatching(undefined, resourceMap.ns.PROV("used"), undefined)
      .forEach(({ object }) => dataNodes.push(object));
    resourceMap.graph
      .statementsMatching(undefined, resourceMap.ns.PROV("hadPlan"), undefined)
      .forEach(({ object }) => programNodes.push(object));

    const dataNodeKeys = new Set(
      ResourceMapCommon.dedupeNodes(dataNodes).map(ResourceMapCommon.nodeKey),
    );
    const programNodeKeys = new Set(
      ResourceMapCommon.dedupeNodes(programNodes).map(ResourceMapCommon.nodeKey),
    );
    resourceMap.graph
      .statementsMatching(undefined, resourceMap.ns.RDF("type"), undefined)
      .filter(
        ({ subject, object }) =>
          (object?.value === resourceMap.ns.PROVONE("Data").value &&
            dataNodeKeys.has(ResourceMapCommon.nodeKey(subject))) ||
          (object?.value === resourceMap.ns.PROVONE("Program").value &&
            programNodeKeys.has(ResourceMapCommon.nodeKey(subject))),
      )
      .forEach((statement) => {
        GraphMutation.removeStatement(resourceMap, statement);
      });
  }

  /**
   * Repair malformed and legacy managed-node shapes after parsing or adopting
   * an existing graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   */
  function repairBrokenGraph(resourceMap) {
    repairMalformedResourceArtifacts(resourceMap);

    const canonicalResourceMapUri = resourceMap.pidToUri(
      resourceMap.resourceMapPid,
    );
    const canonicalAggregationUri = `${canonicalResourceMapUri}#aggregation`;
    const { pidByUri, pidToUris } = buildCanonicalizationIndex(resourceMap);
    const replacementMap = new Map();

    const resourceMapUris = discoverEquivalentNodeUrisFromIndex(
      pidToUris,
      resourceMap.resourceMapPid,
      { includeFragments: false },
    );
    resourceMapUris.forEach((legacyUri) => {
      if (legacyUri !== canonicalResourceMapUri) {
        replacementMap.set(legacyUri, canonicalResourceMapUri);
      }
    });

    const aggregationUris = new Set(
      ResourceMapCommon.collectAssociatedAggregationUris(resourceMap, {
        pidFromNode: (node) => pidByUri.get(node?.value) || null,
        resourceMapUris,
      }),
    );
    aggregationUris.forEach((legacyUri) => {
      if (legacyUri !== canonicalAggregationUri) {
        replacementMap.set(legacyUri, canonicalAggregationUri);
      }
    });

    const managedMemberPids = collectRecoverableMemberPidsFromIndex(
      resourceMap,
      pidByUri,
      aggregationUris,
    );
    managedMemberPids.forEach((pid) => {
      const canonicalUri = resourceMap.pidToUri(pid);
      discoverEquivalentNodeUrisFromIndex(pidToUris, pid, {
        includeFragments: true,
      }).forEach((legacyUri) => {
        if (legacyUri !== canonicalUri) {
          replacementMap.set(legacyUri, canonicalUri);
        }
      });
    });

    const typedPids = collectRecoverableTypedPidsFromIndex(
      resourceMap,
      pidByUri,
      [resourceMap.resourceMapPid, ...managedMemberPids],
    );
    typedPids.forEach((pid) => {
      const canonicalUri =
        ResourceMapCommon.isExternalDirectUriPid(pid) &&
        !managedMemberPids.includes(pid)
          ? pid
          : resourceMap.pidToUri(pid);
      discoverEquivalentNodeUrisFromIndex(pidToUris, pid, {
        includeFragments: true,
      }).forEach((legacyUri) => {
        if (legacyUri !== canonicalUri) {
          replacementMap.set(legacyUri, canonicalUri);
        }
      });
    });

    GraphMutation.replaceNodeValues(resourceMap, replacementMap);
    /* eslint-disable no-param-reassign */
    resourceMap.resourceMapUri = canonicalResourceMapUri;
    resourceMap.aggregationUri = canonicalAggregationUri;
    /* eslint-enable no-param-reassign */

    canonicalizeIdentifierStatements(
      resourceMap,
      canonicalResourceMapUri,
      resourceMap.resourceMapPid,
    );
    managedMemberPids.forEach((pid) => {
      canonicalizeIdentifierStatements(
        resourceMap,
        resourceMap.pidToUri(pid),
        pid,
      );
    });
    typedPids.forEach((pid) => {
      const canonicalUri =
        ResourceMapCommon.isExternalDirectUriPid(pid) &&
        !managedMemberPids.includes(pid)
          ? pid
          : resourceMap.pidToUri(pid);
      canonicalizeIdentifierStatements(resourceMap, canonicalUri, pid);
    });

    removeDerivedRoleTypeAssertions(resourceMap);
    dedupeStatements(resourceMap);
  }

  return {
    dedupeStatements,
    repairBrokenGraph,
    synchronizeCoreGraph,
  };
});
