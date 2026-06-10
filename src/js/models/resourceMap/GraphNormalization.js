"use strict";

define([
  "rdflib",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/GraphRead",
  "models/resourceMap/GraphMutation",
], (rdf, ValueUtilities, ResourceMapCommon, GraphRead, GraphMutation) => {
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
      : GraphRead.collectMemberPids(resourceMap);
    normalizedMemberPids.forEach((memberPid) => {
      const memberUri = useCanonicalMemberUris
        ? resourceMap.pidToUri(memberPid)
        : GraphRead.findNodeUriForPid(resourceMap, memberPid);
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
   * Build a stable dedupe key for one RDF term.
   * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term.
   * @returns {string} Stable term key.
   */
  function buildTermKey(term) {
    if (!term) {
      return "null";
    }

    const datatypeValue =
      term.termType === "Literal" ? term.datatype?.value || "" : "";
    const languageValue = term.termType === "Literal" ? term.lang || "" : "";
    return ResourceMapCommon.buildKey([
      term.termType || "",
      term.value || "",
      languageValue,
      datatypeValue,
    ]);
  }

  /**
   * Remove duplicate RDF statements from the graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   */
  function dedupeStatements(resourceMap) {
    const seen = new Set();
    resourceMap.graph.statements.slice().forEach((statement) => {
      const key = ResourceMapCommon.buildKey([
        buildTermKey(statement.subject),
        buildTermKey(statement.predicate),
        buildTermKey(statement.object),
      ]);
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
      .map((statement) => GraphRead.getLiteralLikeObjectValue(statement.object))
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
      const malformed = GraphRead.extractMalformedResourceValue(
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
      "GraphNormalization.discoverEquivalentNodeUris requires a PID",
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
   * Discover aggregation URIs using a prebuilt PID index.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {Map<string, string>} pidByUri Indexed URI-to-PID map.
   * @param {Map<string, string[]>} pidToUris Indexed PID-to-URI map.
   * @returns {string[]} Aggregation URI candidates.
   */
  function discoverAggregationNodeUrisFromIndex(
    resourceMap,
    pidByUri,
    pidToUris,
  ) {
    const discoveredUris = [];
    const resourceMapUriCandidates = discoverEquivalentNodeUrisFromIndex(
      pidToUris,
      resourceMap.resourceMapPid,
      { includeFragments: false },
    );

    resourceMapUriCandidates.forEach((resourceMapUri) => {
      if (isNonEmptyString(resourceMapUri)) {
        discoveredUris.push(`${resourceMapUri}#aggregation`);
      }
    });

    resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.ORE("isDescribedBy"),
        undefined,
      )
      .forEach((statement) => {
        if (
          pidByUri.get(statement.object?.value) === resourceMap.resourceMapPid
        ) {
          discoveredUris.push(statement.subject?.value);
        }
      });

    resourceMap.graph
      .statementsMatching(undefined, resourceMap.ns.ORE("describes"), undefined)
      .forEach((statement) => {
        if (
          pidByUri.get(statement.subject?.value) === resourceMap.resourceMapPid
        ) {
          discoveredUris.push(statement.object?.value);
        }
      });

    return dedupeArray(discoveredUris.filter(isNonEmptyString));
  }

  /**
   * Collect recoverable aggregated member PIDs from legacy membership statements.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {string[]} Recoverable aggregated member PIDs.
   */
  function collectRecoverableMemberPids(resourceMap) {
    /* eslint-disable-next-line no-use-before-define */
    const aggregationUris = new Set(discoverAggregationNodeUris(resourceMap));
    const memberPids = [];
    resourceMap.graph.statements.forEach((statement) => {
      if (
        statement.predicate?.value === resourceMap.ns.ORE("aggregates").value &&
        aggregationUris.has(statement.subject?.value)
      ) {
        const pid = GraphRead.recoverPidFromNode(
          resourceMap,
          statement.object,
          {
            allowBareValue: true,
          },
        );
        if (pid) memberPids.push(pid);
      }

      if (
        statement.predicate?.value ===
          resourceMap.ns.ORE("isAggregatedBy").value &&
        aggregationUris.has(statement.object?.value)
      ) {
        const pid = GraphRead.recoverPidFromNode(
          resourceMap,
          statement.subject,
          {
            allowBareValue: true,
          },
        );
        if (pid) memberPids.push(pid);
      }
    });

    return dedupeArray(memberPids);
  }

  /**
   * Collect recoverable typed Data/Program PIDs that are not already excluded.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {string[]} [excludedPids] PIDs to exclude from recovery.
   * @returns {string[]} Recoverable typed PIDs.
   */
  function collectRecoverableTypedPids(resourceMap, excludedPids = []) {
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

        const pid = GraphRead.recoverPidFromNode(
          resourceMap,
          statement.subject,
          {
            allowBareValue: true,
          },
        );
        if (!pid || excludedPidSet.has(pid)) {
          return;
        }

        recoverablePids.push(pid);
      });

    return dedupeArray(recoverablePids);
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

      const identifierValue = GraphRead.getLiteralLikeObjectValue(
        statement.object,
      );
      if (
        isNonEmptyString(identifierValue) &&
        !identifierByUri.has(statement.subject.value)
      ) {
        identifierByUri.set(statement.subject.value, identifierValue);
      }
    });

    /**
     * Recover a PID for one indexed URI.
     * @param {string} uri Named-node URI.
     * @returns {string|null} Recovered PID.
     */
    const recoverPidForUri = (uri) => {
      const directPid =
        identifierByUri.get(uri) || resourceMap.constructor.uriToPid(uri);
      if (isNonEmptyString(directPid)) {
        return directPid;
      }

      const fragmentlessUri = uri.split("#")[0];
      if (fragmentlessUri !== uri) {
        const fragmentlessPid =
          identifierByUri.get(fragmentlessUri) ||
          resourceMap.constructor.uriToPid(fragmentlessUri);
        if (isNonEmptyString(fragmentlessPid)) {
          return fragmentlessPid;
        }
      }

      return (
        GraphRead.recoverBarePidValue(uri) ||
        GraphRead.recoverBarePidValue(fragmentlessUri)
      );
    };

    Array.from(pidByUri.keys()).forEach((uri) => {
      const pid = recoverPidForUri(uri);
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
   * Replace every subject/object node value that appears in a rewrite map.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {Map<string, string>} replacementMap Old-to-new node value mapping.
   */
  function replaceNodeValues(resourceMap, replacementMap) {
    if (!(replacementMap instanceof Map) || replacementMap.size === 0) {
      return;
    }

    resourceMap.graph.statements.slice().forEach((statement) => {
      const nextSubjectValue = replacementMap.get(statement.subject?.value);
      const nextObjectValue = replacementMap.get(
        statement.object?.termType === "NamedNode"
          ? statement.object.value
          : null,
      );

      if (!nextSubjectValue && !nextObjectValue) {
        return;
      }

      const nextSubject = nextSubjectValue
        ? rdf.sym(nextSubjectValue)
        : statement.subject;
      const nextObject = nextObjectValue
        ? rdf.sym(nextObjectValue)
        : statement.object;

      GraphMutation.removeStatement(resourceMap, statement);
      GraphMutation.addStatementIfMissing(
        resourceMap,
        nextSubject,
        statement.predicate,
        nextObject,
      );
    });
  }

  /**
   * Discover every URI currently acting as the same PID in the graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @param {string} pid PID whose equivalent URIs are requested.
   * @param {object} [options] Discovery options.
   * @param {boolean} [options.allowBareValue] Whether bare values may count as PID equivalents.
   * @param {boolean} [options.includeFragments] Whether fragment URIs should be returned directly.
   * @returns {string[]} Equivalent node URIs.
   */
  function discoverEquivalentNodeUris(
    resourceMap,
    pid,
    { allowBareValue = false, includeFragments = false } = {},
  ) {
    const normalizedPid = requireNonEmptyString(
      pid,
      "GraphNormalization.discoverEquivalentNodeUris requires a PID",
    );
    const discoveredUris = [];
    const statements = resourceMap.graph.statements || [];

    /**
     * Add one matching named-node URI to the candidate list.
     * @param {NamedNode|BlankNode|Literal|null|undefined} node Candidate node.
     */
    const collectCandidateUri = (node) => {
      if (node?.termType !== "NamedNode") {
        return;
      }

      const recoveredPid = GraphRead.recoverPidFromNode(resourceMap, node, {
        allowBareValue,
      });
      if (recoveredPid !== normalizedPid) {
        return;
      }

      if (includeFragments || !node.value.includes("#")) {
        discoveredUris.push(node.value);
      }

      if (includeFragments) {
        return;
      }

      const fragmentlessValue = node.value.split("#")[0];
      if (fragmentlessValue !== node.value) {
        discoveredUris.push(fragmentlessValue);
      }
    };

    statements.forEach((statement) => {
      collectCandidateUri(statement.subject);
      collectCandidateUri(statement.object);
    });

    return dedupeArray(discoveredUris);
  }

  /**
   * Discover legacy aggregation URIs linked to the current resource map.
   * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
   * @returns {string[]} Aggregation URI candidates.
   */
  function discoverAggregationNodeUris(resourceMap) {
    const discoveredUris = [];
    const resourceMapUriCandidates = discoverEquivalentNodeUris(
      resourceMap,
      resourceMap.resourceMapPid,
      { allowBareValue: true },
    );

    resourceMapUriCandidates.forEach((resourceMapUri) => {
      if (isNonEmptyString(resourceMapUri)) {
        discoveredUris.push(`${resourceMapUri}#aggregation`);
      }
    });

    resourceMap.graph
      .statementsMatching(
        undefined,
        resourceMap.ns.ORE("isDescribedBy"),
        undefined,
      )
      .forEach((statement) => {
        const describedByPid = GraphRead.recoverPidFromNode(
          resourceMap,
          statement.object,
          { allowBareValue: true },
        );
        if (describedByPid === resourceMap.resourceMapPid) {
          discoveredUris.push(statement.subject?.value);
        }
      });

    resourceMap.graph
      .statementsMatching(undefined, resourceMap.ns.ORE("describes"), undefined)
      .forEach((statement) => {
        const subjectPid = GraphRead.recoverPidFromNode(
          resourceMap,
          statement.subject,
          { allowBareValue: true },
        );
        if (subjectPid === resourceMap.resourceMapPid) {
          discoveredUris.push(statement.object?.value);
        }
      });

    return dedupeArray(discoveredUris.filter(isNonEmptyString));
  }

  /**
   * Collapse all equivalent node URIs for one PID onto one canonical URI.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {string} pid PID being canonicalized.
   * @param {string} canonicalUri Canonical node URI to keep.
   * @param {object} [options] Canonicalization options.
   * @param {boolean} [options.allowBareValue] Whether bare values may be canonicalized.
   * @param {boolean} [options.includeFragments] Whether fragment variants should be canonicalized directly.
   */
  function canonicalizePidNode(
    resourceMap,
    pid,
    canonicalUri,
    { allowBareValue = false, includeFragments = false } = {},
  ) {
    discoverEquivalentNodeUris(resourceMap, pid, {
      allowBareValue,
      includeFragments,
    }).forEach((legacyUri) => {
      if (legacyUri !== canonicalUri) {
        GraphMutation.replaceNodeValue(resourceMap, legacyUri, canonicalUri);
      }
    });

    canonicalizeIdentifierStatements(resourceMap, canonicalUri, pid);
  }

  /**
   * Canonicalize the managed package graph in place.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   */
  function canonicalizeManagedGraph(resourceMap) {
    repairMalformedResourceArtifacts(resourceMap);

    const canonicalResourceMapUri = resourceMap.pidToUri(
      resourceMap.resourceMapPid,
    );
    const canonicalAggregationUri = `${canonicalResourceMapUri}#aggregation`;
    const { pidByUri, pidToUris } = buildCanonicalizationIndex(resourceMap);
    const replacementMap = new Map();

    discoverEquivalentNodeUrisFromIndex(pidToUris, resourceMap.resourceMapPid, {
      includeFragments: false,
    }).forEach((legacyUri) => {
      if (legacyUri !== canonicalResourceMapUri) {
        replacementMap.set(legacyUri, canonicalResourceMapUri);
      }
    });

    const aggregationUris = new Set(
      discoverAggregationNodeUrisFromIndex(resourceMap, pidByUri, pidToUris),
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
      const canonicalUri = resourceMap.pidToUri(pid);
      discoverEquivalentNodeUrisFromIndex(pidToUris, pid, {
        includeFragments: true,
      }).forEach((legacyUri) => {
        if (legacyUri !== canonicalUri) {
          replacementMap.set(legacyUri, canonicalUri);
        }
      });
    });

    replaceNodeValues(resourceMap, replacementMap);
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
      canonicalizeIdentifierStatements(
        resourceMap,
        resourceMap.pidToUri(pid),
        pid,
      );
    });

    synchronizeCoreGraph(resourceMap, managedMemberPids);

    dedupeStatements(resourceMap);
  }

  return {
    canonicalizeIdentifierStatements,
    canonicalizeManagedGraph,
    canonicalizePidNode,
    collectRecoverableMemberPids,
    collectRecoverableTypedPids,
    dedupeStatements,
    discoverAggregationNodeUris,
    discoverEquivalentNodeUris,
    repairMalformedResourceArtifacts,
    synchronizeCoreGraph,
  };
});
