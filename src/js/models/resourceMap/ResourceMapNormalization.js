"use strict";

define([
  "common/ValidationUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapCommon",
], (ValidationUtilities, RDFGraph, ResourceMapCommon) => {
  const { createValidationIssue } = ValidationUtilities;
  const {
    NS,
    ResourceMapConflictError,
    describeTerm,
    identifierLiteralPid,
    isAbsoluteNamedNode,
  } = ResourceMapCommon;

  /**
   * Copy an RDF statement into plain diagnostic data.
   * @param {RDFGraphStatement} statement RDF statement
   * @returns {object} Copyable statement details
   */
  function describeStatement(statement) {
    return {
      subject: describeTerm(statement?.subject),
      predicate: describeTerm(statement?.predicate),
      object: describeTerm(statement?.object),
    };
  }

  /**
   * Remove duplicate statements that contain the same subject and object.
   * @param {RDFGraphStatement[]} statements Statements to deduplicate
   * @returns {RDFGraphStatement[]} One statement per subject/object pair
   */
  function distinctPairs(statements) {
    const pairsByKey = new Map();
    statements.forEach((statement) => {
      const key = RDFGraph.buildKey([
        RDFGraph.buildTermKey(statement.subject),
        RDFGraph.buildTermKey(statement.object),
      ]);
      pairsByKey.set(key, statement);
    });
    return [...pairsByKey.values()];
  }

  /**
   * Stop import when the graph does not identify exactly one Resource Map and
   * the package aggregation it describes. The graph is left unchanged.
   * @param {RDFGraph} graph Imported graph
   * @param {string} resourceMapPid Outer Resource Map PID
   * @param {string} reason Machine readable failure reason
   * @param {RDFGraphStatement|null} [selected] Candidate selected before a
   * guard failed
   * @throws {ResourceMapConflictError} Always
   */
  function throwOwnershipConflict(
    graph,
    resourceMapPid,
    reason,
    selected = null,
  ) {
    const forwardStatements = graph.findStatements({
      predicate: NS.ORE("describes"),
    });
    const inverseStatements = graph.findStatements({
      predicate: NS.ORE("isDescribedBy"),
    });
    const validInversePairs = distinctPairs(
      inverseStatements.filter(
        ({ subject, object }) =>
          isAbsoluteNamedNode(subject) && isAbsoluteNamedNode(object),
      ),
    );
    const malformedOwnershipStatements = [
      ...forwardStatements.filter(
        ({ subject, object }) =>
          !isAbsoluteNamedNode(subject) || !isAbsoluteNamedNode(object),
      ),
      ...inverseStatements.filter(
        ({ subject, object }) =>
          !isAbsoluteNamedNode(subject) || !isAbsoluteNamedNode(object),
      ),
    ];
    const issue = createValidationIssue({
      field: "resourceMap",
      code: "ambiguousResourceMapRoot",
      reason,
      message:
        "The RDF does not identify exactly one Resource Map document and package aggregation.",
      resourceMapPid,
      forwardStatements: forwardStatements.map(describeStatement),
      inversePairs: validInversePairs.map(describeStatement),
      malformedOwnershipStatements:
        malformedOwnershipStatements.map(describeStatement),
      selectedCandidate: selected ? describeStatement(selected) : null,
    });

    throw new ResourceMapConflictError(issue.message, {
      code: "ambiguousResourceMapRoot",
      details: {
        resourceMapPid,
        reason,
        issues: [issue],
      },
    });
  }

  /**
   * After raw validation, replace equivalent identifier spellings with one
   * literal containing the exact PID.
   * @param {ResourceMap} resourceMap Resource Map being repaired
   * @param {NamedNode} node Managed RDF node
   * @param {string} pid Approved PID
   */
  function canonicalizeIdentifier(resourceMap, node, pid) {
    resourceMap.graph.removeStatementsMatching({
      subject: node,
      predicate: NS.DCTERMS("identifier"),
    });

    resourceMap.graph.addStatementIfMissing({
      subject: node,
      predicate: NS.DCTERMS("identifier"),
      object: RDFGraph.createLiteral(pid, undefined, NS.XSD("string")),
    });
  }

  /**
   * Repair the known issue #946 output where a member's `isAggregatedBy` target
   * was written as a malformed URI instead of the package aggregation node.
   * @param {ResourceMap} resourceMap Resource Map being repaired
   * @param {Set<string>} rawForwardMemberKeys Exact members found through
   * `package --aggregates--> member` statements
   */
  function repairMalformedMembershipArtifact(
    resourceMap,
    rawForwardMemberKeys,
  ) {
    const aggregationNode = RDFGraph.createNamedNode(
      resourceMap.aggregationUri,
    );

    resourceMap.graph
      .findStatements({ predicate: NS.ORE("isAggregatedBy") })
      .filter(({ subject, object }) => {
        if (
          !rawForwardMemberKeys.has(RDFGraph.buildTermKey(subject)) ||
          !RDFGraph.isNamedNode(object)
        ) {
          return false;
        }
        const malformed = ResourceMapCommon.extractMalformedResourceValue(
          object.value,
        );
        return (
          malformed?.datatypeUri === NS.XSD("anyURI").value &&
          malformed.lexicalValue === resourceMap.aggregationUri
        );
      })
      .forEach((statement) => {
        // This exact NamedNode value is the output created by issue #946.
        // Preserve near matches and ordinary literals because MetacatUI cannot
        // prove they came from that bug.
        resourceMap.graph.removeStatement(statement);
        resourceMap.graph.addStatementIfMissing({
          subject: statement.subject,
          predicate: NS.ORE("isAggregatedBy"),
          object: aggregationNode,
        });
      });
  }

  /**
   * Store both RDF directions of a link from metadata to documented data, but
   * only when both exact RDF nodes are package members.
   * @param {ResourceMap} resourceMap Resource Map being repaired
   * @param {Set<string>} memberKeys Exact selected member term keys
   */
  function repairDocumentationReciprocity(resourceMap, memberKeys) {
    [
      [NS.CITO("documents"), NS.CITO("isDocumentedBy")],
      [NS.CITO("isDocumentedBy"), NS.CITO("documents")],
    ].forEach(([predicate, inversePredicate]) => {
      resourceMap.graph.findStatements({ predicate }).forEach((statement) => {
        if (
          !memberKeys.has(RDFGraph.buildTermKey(statement.subject)) ||
          !memberKeys.has(RDFGraph.buildTermKey(statement.object))
        ) {
          return;
        }
        resourceMap.graph.addStatementIfMissing({
          subject: statement.object,
          predicate: inversePredicate,
          object: statement.subject,
        });
      });
    });
  }

  /**
   * Select the Resource Map and aggregation from exactly one explicit
   * `ResourceMap --describes--> aggregation` statement.
   * @param {RDFGraph} graph Imported RDF graph
   * @param {string} resourceMapPid Outer Resource Map PID
   * @param {RDFGraphStatement[]} forwardStatements `ore:describes` statements
   * @returns {{resourceMapUri:string, aggregationUri:string,
   * recoveredFromInverse:boolean}} Selected Resource Map and aggregation
   */
  function selectForwardRoot(graph, resourceMapPid, forwardStatements) {
    const relative = forwardStatements.some(
      ({ subject, object }) =>
        (RDFGraph.isNamedNode(subject) &&
          !ResourceMapCommon.isAbsoluteIri(subject.value)) ||
        (RDFGraph.isNamedNode(object) &&
          !ResourceMapCommon.isAbsoluteIri(object.value)),
    );
    const malformed = forwardStatements.some(
      ({ subject, object }) =>
        !isAbsoluteNamedNode(subject) || !isAbsoluteNamedNode(object),
    );
    const pairs = distinctPairs(forwardStatements);
    if (malformed || pairs.length !== 1) {
      let reason = "ambiguous";
      if (relative) reason = "relative";
      else if (malformed) reason = "malformed";
      throwOwnershipConflict(graph, resourceMapPid, reason);
    }
    return {
      resourceMapUri: pairs[0].subject.value,
      aggregationUri: pairs[0].object.value,
      recoveredFromInverse: false,
    };
  }

  /**
   * When the forward `describes` statement is missing, recover the Resource Map
   * and aggregation from exactly one
   * `aggregation --isDescribedBy--> ResourceMap` statement.
   * @param {RDFGraph} graph Imported RDF graph
   * @param {string} resourceMapPid Outer Resource Map PID
   * @param {object} endpoints Configured service URLs used to recognize map
   * identifiers written as resolver or object URLs
   * @returns {{resourceMapUri:string, aggregationUri:string,
   * recoveredFromInverse:boolean}} Selected Resource Map and aggregation
   */
  function selectInverseRoot(graph, resourceMapPid, endpoints) {
    // Use an inverse `ore:isDescribedBy` statement only when there is no
    // `ore:describes` statement. Count exact inverse pairs before checking
    // types or PIDs so a more complete candidate cannot silently win.
    const inverseStatements = graph.findStatements({
      predicate: NS.ORE("isDescribedBy"),
    });
    const inversePairs = distinctPairs(
      inverseStatements.filter(
        ({ subject, object }) =>
          isAbsoluteNamedNode(subject) && isAbsoluteNamedNode(object),
      ),
    );
    if (inversePairs.length !== 1) {
      const hasRelativeInverse = inverseStatements.some(
        ({ subject, object }) =>
          (RDFGraph.isNamedNode(subject) &&
            !ResourceMapCommon.isAbsoluteIri(subject.value)) ||
          (RDFGraph.isNamedNode(object) &&
            !ResourceMapCommon.isAbsoluteIri(object.value)),
      );
      let reason = "missing";
      if (inversePairs.length > 1) reason = "ambiguous";
      else if (hasRelativeInverse) reason = "relative";
      else if (inverseStatements.length) reason = "malformed";
      throwOwnershipConflict(graph, resourceMapPid, reason);
    }

    const selected = inversePairs[0];
    const rootIdentifiers = graph.findStatements({
      subject: selected.object,
      predicate: NS.DCTERMS("identifier"),
    });
    // Preserve URL-shaped PIDs when comparing configured identifier URLs.
    const passesGuards =
      graph.hasStatement({
        subject: selected.subject,
        predicate: NS.RDF("type"),
        object: NS.ORE("Aggregation"),
      }) &&
      graph.hasStatement({
        subject: selected.object,
        predicate: NS.RDF("type"),
        object: NS.ORE("ResourceMap"),
      }) &&
      rootIdentifiers.every(({ object }) => RDFGraph.isLiteral(object)) &&
      rootIdentifiers.length > 0 &&
      rootIdentifiers.every(
        ({ object }) =>
          identifierLiteralPid(object, resourceMapPid, endpoints) ===
          resourceMapPid,
      );

    if (!passesGuards) {
      throwOwnershipConflict(graph, resourceMapPid, "contradictory", selected);
    }

    return {
      resourceMapUri: selected.object.value,
      aggregationUri: selected.subject.value,
      recoveredFromInverse: true,
    };
  }

  /**
   * Find the Resource Map document and package aggregation in imported RDF,
   * then apply only repairs whose values are certain. Configured endpoint URIs
   * are converted only when their identifier claims agree.
   * @class ResourceMapNormalization
   * @classcategory Models/ResourceMap
   * @since 2.39.0
   */
  class ResourceMapNormalization {
    /**
     * Identify exactly one Resource Map and package aggregation in imported RDF.
     * Reject ambiguous candidates instead of ranking them, and do not edit the
     * graph.
     * @param {RDFGraph} graph Imported RDF graph
     * @param {string} resourceMapPid Outer Resource Map PID
     * @param {object} [endpoints] Configured resolve and object service URLs used
     * to read URL-valued map identifiers when checking the reverse link
     * @returns {{resourceMapUri:string, aggregationUri:string,
     * recoveredFromInverse:boolean}} Selected Resource Map and aggregation
     */
    static selectImportedRoot(graph, resourceMapPid, endpoints) {
      const forwardStatements = graph.findStatements({
        predicate: NS.ORE("describes"),
      });
      if (forwardStatements.length) {
        return selectForwardRoot(graph, resourceMapPid, forwardStatements);
      }
      return selectInverseRoot(graph, resourceMapPid, endpoints);
    }

    /**
     * Create a normalization helper for one ResourceMap.
     * @param {object} options Normalization options
     * @param {ResourceMap} options.resourceMap Resource Map being normalized
     */
    constructor({ resourceMap } = {}) {
      this.resourceMap = resourceMap;
    }

    /**
     * After all original PID claims have been validated, add only missing or
     * equivalent statements whose intended values are certain. Convert eligible
     * configured endpoint URIs to CN resolver URLs.
     * @param {object} identity Raw identity inspection from validation
     * @param {boolean} [recoveredFromInverse] Whether the Resource Map and
     * aggregation were found through one exact `ore:isDescribedBy` statement
     */
    repairImportedGraph(identity, recoveredFromInverse = false) {
      const { resourceMap } = this;
      const resourceMapNode = RDFGraph.createNamedNode(
        resourceMap.resourceMapUri,
      );
      const aggregationNode = RDFGraph.createNamedNode(
        resourceMap.aggregationUri,
      );

      // All imported PID claims were compared before this point. Only now may
      // equivalent forms be combined or a provably missing identifier added.
      canonicalizeIdentifier(resourceMap, resourceMapNode, identity.root.pid);
      identity.members.forEach(({ node, pid }) => {
        canonicalizeIdentifier(resourceMap, node, pid);
      });

      if (recoveredFromInverse) {
        resourceMap.graph.addStatementIfMissing({
          subject: resourceMapNode,
          predicate: NS.ORE("describes"),
          object: aggregationNode,
        });
        // Ensure recovery did not create or expose a second `ore:describes`
        // pair.
        ResourceMapNormalization.selectImportedRoot(
          resourceMap.graph,
          resourceMap.resourceMapPid,
          resourceMap,
        );
      }

      const rawForwardMemberKeys = new Set(
        identity.members
          .filter(({ forward }) => forward)
          .map(({ node }) => RDFGraph.buildTermKey(node)),
      );
      repairMalformedMembershipArtifact(resourceMap, rawForwardMemberKeys);
      const replacements = this.normalizeEndpointUrls();
      // Merging a member with another node can bring in documentation links.
      // Add missing inverse links using the converted member URLs.
      repairDocumentationReciprocity(
        resourceMap,
        new Set(
          identity.members.map(({ node }) =>
            RDFGraph.buildTermKey(
              RDFGraph.createNamedNode(
                replacements.get(node.value) || node.value,
              ),
            ),
          ),
        ),
      );
      resourceMap.graph.dedupeStatements();
    }

    /**
     * Use configured CN resolve URLs for identified MN/CN nodes. For example,
     * `/object/urn%3Auuid%3Aabc` becomes `/resolve/urn:uuid:abc`; the PID stays
     * `urn:uuid:abc`. Include nodes outside the package and merge matching PIDs.
     * @param {NamedNode[]} [nodes] Limit conversion to these nodes. By default,
     * inspect every node with an identifier statement
     * @returns {Map<string, string>} Old node URLs mapped to resolver URLs
     * @since 2.41.0
     */
    normalizeEndpointUrls(nodes) {
      const { resourceMap } = this;
      const replacements = new Map();
      const identifiersToNormalize = new Map();

      const candidates =
        nodes ||
        resourceMap.graph
          .findStatements({ predicate: NS.DCTERMS("identifier") })
          .map(({ subject }) => subject);
      // Check each source and its destination before changing identifiers.
      RDFGraph.dedupeTerms(candidates).forEach((subject) => {
        const pid = this.getEndpointPidForNormalization(subject);
        if (!pid) return;
        identifiersToNormalize.set(subject.value, pid);

        // Moving MN /object/data.1 to CN /resolve/data.1 can combine two nodes.
        // Skip if the CN node's identifier says different.1.
        const resolveUri = resourceMap.pidToUri(pid);
        const destination = RDFGraph.createNamedNode(resolveUri);
        if (this.getEndpointPidForNormalization(destination) === pid) {
          replacements.set(subject.value, resolveUri);
          identifiersToNormalize.set(resolveUri, pid);
        }
      });

      // Replace matching URL identifiers with PID text, e.g. data.1, before merging.
      // This keeps one identifier after merging. The identifier can still be
      // corrected when a destination conflict prevents renaming the URI.
      identifiersToNormalize.forEach((pid, uri) => {
        canonicalizeIdentifier(resourceMap, RDFGraph.createNamedNode(uri), pid);
      });
      // Update rdf:about and rdf:resource links together. Keep prov:atLocation
      // link targets: recorded file locations may still use the old MN URL.
      resourceMap.graph.replaceNodeValues(replacements, {
        preserveObjectPredicates: [NS.PROV("atLocation").value],
      });
      return replacements;
    }

    /**
     * Read a configured URL's PID when all its identifiers match.
     * A destination node may have no identifiers.
     * @param {NamedNode|BlankNode} subject RDF node to check
     * @returns {string|null} PID if the node can be used, otherwise null
     * @since 2.41.0
     */
    getEndpointPidForNormalization(subject) {
      const { resourceMap } = this;
      // Keep map/aggregation URLs; setResourceMapPid() updates them during save.
      if (
        !RDFGraph.isNamedNode(subject) ||
        subject.value === resourceMap.resourceMapUri ||
        subject.value === resourceMap.aggregationUri
      ) {
        return null;
      }
      // Use only configured service paths. Elsewhere, /object/data.1 may be
      // part of a full URL identifier rather than an endpoint for PID data.1.
      const [pid] = ResourceMapCommon.configuredEndpointPids(
        subject.value,
        resourceMap,
      );
      if (!pid) {
        return null;
      }

      // Require every identifier to claim this PID; resource-valued ones fail.
      const identifierStatements = resourceMap.graph.findStatements({
        subject,
        predicate: NS.DCTERMS("identifier"),
      });
      // A destination may have no identifier; the checked source identifies
      // the merged node.
      const identifiersMatchPid = identifierStatements.every(
        ({ object: identifier }) =>
          identifierLiteralPid(identifier, pid, resourceMap) === pid,
      );
      return identifiersMatchPid ? pid : null;
    }

    /**
     * Ensure a valid Resource Map has the required map, aggregation, and
     * membership statements in both directions for its current exact members.
     * @param {Array<{pid:string, uri:string}>} memberDescriptors Exact members
     */
    synchronizeCoreGraph(memberDescriptors) {
      const { resourceMap } = this;
      const resourceMapNode = RDFGraph.createNamedNode(
        resourceMap.resourceMapUri,
      );
      const aggregationNode = RDFGraph.createNamedNode(
        resourceMap.aggregationUri,
      );

      resourceMap.ensureIdentifierForUri(
        resourceMap.resourceMapUri,
        resourceMap.resourceMapPid,
      );
      resourceMap.graph.addStatementIfMissing({
        subject: resourceMapNode,
        predicate: NS.RDF("type"),
        object: NS.ORE("ResourceMap"),
      });
      resourceMap.graph.addStatementIfMissing({
        subject: aggregationNode,
        predicate: NS.RDF("type"),
        object: NS.ORE("Aggregation"),
      });
      resourceMap.graph.addStatementIfMissing({
        subject: resourceMapNode,
        predicate: NS.ORE("describes"),
        object: aggregationNode,
      });
      resourceMap.graph.addStatementIfMissing({
        subject: aggregationNode,
        predicate: NS.ORE("isDescribedBy"),
        object: resourceMapNode,
      });

      memberDescriptors.forEach(({ pid, uri }) => {
        // Keep each member's current RDF URI. Use the configured Coordinating
        // Node only when a new member has no RDF node yet.
        resourceMap.structureMutation.addAggregationTriples(pid, uri);
      });
    }
  }

  return ResourceMapNormalization;
});
