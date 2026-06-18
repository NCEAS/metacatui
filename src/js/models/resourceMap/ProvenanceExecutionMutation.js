"use strict";

/**
 * Utilities for creating, reusing, and cleaning up PROVONE Execution nodes in
 * a ResourceMap provenance graph.
 *
 * This module supports the higher-level Provenance API methods that describe
 * relationships between data objects and programs, such as "data was generated
 * by program" or "program used data". Those public methods expose simple
 * PID-based operations, but the RDF graph stores these relationships through
 * Execution nodes and qualified associations.
 *
 * Mutations here manage one canonical execution shape: a named execution node
 * with a `dcterms:identifier` literal, one qualified association, and one plan
 * pointing at an aggregated program. Reuse is resolved by explicit execution
 * identifier when one is provided, otherwise by the program's existing
 * execution. Unusual linked execution shapes — shared associations, multiple
 * associations, plans, or programs per execution — are left untouched and
 * reported by ProvenanceValidation. Standalone execution scaffolding is
 * removed during cleanup and normalization.
 *
 * Reads come from the resource map's cached graph state (the pre-mutation
 * projection during grouped mutations); edits go through GraphMutation.
 * @since 0.0.0
 */

define([
  "rdflib",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/GraphMutation",
], (rdf, ValueUtilities, ResourceMapCommon, GraphMutation) => {
  const { normalizeText, requireNonEmptyString, makeUUID } = ValueUtilities;
  const { ResourceMapConflictError } = ResourceMapCommon;

  /**
   * Resolve a reusable execution node by its identifier. Reuse requires the
   * identifier to resolve to a node already typed as a PROVONE Execution;
   * identifier matches on non-execution nodes are ignored here and surfaced
   * by validation as identifier collisions.
   * @param {Provenance} provenance Provenance instance whose graph is
   * inspected.
   * @param {string} executionId Requested execution identifier.
   * @returns {NamedNode|BlankNode|null} Reusable execution node when found.
   */
  function resolveReusableExecutionByIdentifier(provenance, executionId) {
    const graphState = provenance.resourceMap.getGraphState();
    return (
      graphState
        .findNodesByIdentifier(executionId)
        .find((node) => graphState.isExecutionNode(node)) || null
    );
  }

  /**
   * Resolve a reusable execution for a program. When the program already has
   * more than one execution, the first is reused; callers that need a
   * specific execution must pass an explicit execution identifier.
   * @param {Provenance} provenance Provenance instance whose graph is
   * inspected.
   * @param {string} programPid Program PID whose execution is requested.
   * @returns {NamedNode|BlankNode|null} Reusable execution node when found.
   */
  function resolveReusableExecutionForProgram(provenance, programPid) {
    return (
      provenance.resourceMap
        .getGraphState()
        .getExecutionNodesForProgram(programPid)[0] || null
    );
  }

  /**
   * Ensure an execution has an association with a plan for the program.
   * Existing association details are reused as-is; a plan is only added when
   * the association has none, so pre-existing graph content is never
   * replaced.
   * @param {Provenance} provenance Provenance instance whose graph is updated.
   * @param {NamedNode|BlankNode} executionNode Execution node to update.
   * @param {string} programPid Aggregated program PID that should be linked.
   * @param {string|null} [agentUri] Optional agent URI for the association.
   */
  function ensureAssociationForExecution(
    provenance,
    executionNode,
    programPid,
    agentUri = null,
  ) {
    const inspection = provenance.resourceMap
      .getGraphState()
      .getExecutionSummary(executionNode);
    const [association] = inspection?.associations || [];
    const associationNode = association?.node || rdf.blankNode();

    const { node: programNode } = provenance.ensurePidNode(programPid, {
      requireAggregated: true,
      message: "Program not aggregated",
    });
    GraphMutation.addStatementIfMissing(
      provenance.resourceMap,
      executionNode,
      provenance.ns.PROV("qualifiedAssociation"),
      associationNode,
    );
    if (!association?.planNodes.length) {
      GraphMutation.addStatementIfMissing(
        provenance.resourceMap,
        associationNode,
        provenance.ns.PROV("hadPlan"),
        programNode,
      );
    }
    const normalizedAgentUri = normalizeText(agentUri);
    if (normalizedAgentUri) {
      GraphMutation.addStatementIfMissing(
        provenance.resourceMap,
        associationNode,
        provenance.ns.PROV("agent"),
        rdf.sym(normalizedAgentUri),
      );
    }
  }

  /**
   * Find or create an execution node for one aggregated program.
   * @param {Provenance} provenance Provenance instance whose graph is updated.
   * @param {string} programPid Aggregated program PID whose execution is
   * needed.
   * @param {object} [options] Execution options.
   * @param {string} [options.executionId] Execution identifier to reuse or
   * assign to a newly created execution.
   * @param {string} [options.agentUri] Agent URI associated with the execution.
   * @returns {NamedNode} Existing or newly created execution node.
   * Intended to be called inside `Provenance.mutateGraph()`.
   */
  function ensureExecutionForProgram(provenance, programPid, options = {}) {
    const normalizedProgramPid =
      provenance.resourceMap.requireExistingMemberPid(
        programPid,
        "Program not aggregated",
      );
    const requestedExecutionId = normalizeText(options.executionId);
    const graphState = provenance.resourceMap.getGraphState();
    const executionNode = requestedExecutionId
      ? resolveReusableExecutionByIdentifier(provenance, requestedExecutionId)
      : resolveReusableExecutionForProgram(provenance, normalizedProgramPid);

    if (executionNode) {
      const inspection = graphState.getExecutionSummary(executionNode);
      const hasExistingPlan = inspection.associations.some(
        ({ planNodes }) => planNodes.length,
      );
      if (
        hasExistingPlan &&
        !inspection.programPids.includes(normalizedProgramPid)
      ) {
        throw new ResourceMapConflictError(
          `Execution "${requestedExecutionId}" belongs to another program`,
          {
            code: "executionProgramConflict",
            details: {
              executionId: requestedExecutionId,
              programPid: normalizedProgramPid,
              existingProgramPids: inspection.programPids,
            },
          },
        );
      }

      ensureAssociationForExecution(
        provenance,
        executionNode,
        normalizedProgramPid,
        options.agentUri,
      );
      return executionNode;
    }

    const executionId = requestedExecutionId || makeUUID();
    const newExecutionNode = rdf.sym(executionId);

    GraphMutation.addStatementIfMissing(
      provenance.resourceMap,
      newExecutionNode,
      provenance.ns.RDF("type"),
      provenance.ns.PROVONE("Execution"),
    );
    GraphMutation.addStatementIfMissing(
      provenance.resourceMap,
      newExecutionNode,
      provenance.ns.DCTERMS("identifier"),
      rdf.literal(executionId, undefined, provenance.ns.XSD("string")),
    );
    ensureAssociationForExecution(
      provenance,
      newExecutionNode,
      normalizedProgramPid,
      options.agentUri,
    );
    return newExecutionNode;
  }

  /**
   * Add an execution-backed generation or usage relationship.
   * @param {Provenance} provenance Provenance instance whose graph is updated.
   * @param {object} options Relationship options.
   * @param {string} options.dataPid Data PID in the relationship.
   * @param {string} options.programPid Aggregated program PID in the
   * relationship.
   * @param {object} [options.options] Execution options forwarded to execution
   * creation.
   * @param {string} options.predicate PROV predicate name without the
   * namespace.
   * @param {boolean} [options.dataFromObject] Whether the data PID is stored in
   * the object position.
   * @returns {Provenance} Updated provenance instance.
   */
  function addExecutionProgramRelationship(
    provenance,
    { dataPid, programPid, options = {}, predicate, dataFromObject = false },
  ) {
    return provenance.mutateGraph(() => {
      const dataInfo = provenance.ensurePidNode(dataPid, {
        message: "Data PID required",
      });
      const programInfo = provenance.ensurePidNode(programPid, {
        requireAggregated: true,
        message: "Program PID required",
      });
      const executionNode = ensureExecutionForProgram(
        provenance,
        programInfo.pid,
        options,
      );

      GraphMutation.addStatementIfMissing(
        provenance.resourceMap,
        dataFromObject ? executionNode : dataInfo.node,
        provenance.ns.PROV(predicate),
        dataFromObject ? dataInfo.node : executionNode,
      );
    });
  }

  /**
   * Remove execution scaffolding when no managed provenance relationship
   * references it.
   * @param {Provenance} provenance Provenance instance whose graph is updated.
   * @param {NamedNode|BlankNode} executionNode Execution node that may be
   * removed.
   * @param {object|null} [inspection] Pre-mutation execution summary.
   */
  function cleanupExecution(provenance, executionNode, inspection = null) {
    const executionInspection =
      inspection ||
      provenance.resourceMap.getGraphState().getExecutionSummary(executionNode);
    if (!executionInspection) {
      return;
    }

    const { graph, ns } = provenance;
    const managedLinkPatterns = [
      [undefined, ns.PROV("wasGeneratedBy"), executionNode],
      [executionNode, ns.PROV("used"), undefined],
      [executionNode, ns.PROV("wasInformedBy"), undefined],
      [undefined, ns.PROV("wasInformedBy"), executionNode],
    ];
    const hasManagedLinks = managedLinkPatterns.some(
      ([subject, predicate, object]) =>
        graph.statementsMatching(subject, predicate, object, undefined).length,
    );
    if (hasManagedLinks) {
      return;
    }

    executionInspection.associations.forEach(({ node: associationNode }) => {
      const associationIsShared =
        graph.statementsMatching(
          undefined,
          ns.PROV("qualifiedAssociation"),
          associationNode,
          undefined,
        ).length > 1;
      GraphMutation.removeStatementsMatching(
        provenance.resourceMap,
        executionNode,
        ns.PROV("qualifiedAssociation"),
        associationNode,
      );
      if (!associationIsShared) {
        GraphMutation.removeNodeReferences(
          provenance.resourceMap,
          associationNode,
        );
      }
    });

    GraphMutation.removeNodeReferences(provenance.resourceMap, executionNode);
  }

  /**
   * Remove an execution-backed generation or usage relationship.
   * @param {Provenance} provenance Provenance instance whose graph is updated.
   * @param {object} options Relationship options.
   * @param {string} options.dataPid Data PID in the relationship.
   * @param {string} options.programPid Program PID in the relationship.
   * @param {object} [options.options] Execution filter options.
   * @param {string} options.predicate PROV predicate name without the
   * namespace.
   * @param {boolean} [options.dataFromObject] Whether the data PID is stored in
   * the object position.
   * @returns {Provenance} Updated provenance instance.
   */
  function removeExecutionProgramRelationship(
    provenance,
    { dataPid, programPid, options = {}, predicate, dataFromObject = false },
  ) {
    const normalizedDataPid = requireNonEmptyString(
      dataPid,
      "Data PID required",
    );
    const normalizedProgramPid = requireNonEmptyString(
      programPid,
      "Program PID required",
    );

    const graphState = provenance.resourceMap.getGraphState();
    const dataUri = graphState.findNodeUriForPid(normalizedDataPid);
    if (!dataUri) return provenance;

    const dataNode = rdf.sym(dataUri);
    const affectedExecutionNodes = graphState
      .filterExecutionNodesByIdentifier(
        graphState.getExecutionNodesForProgram(normalizedProgramPid),
        options.executionId,
      )
      .filter((executionNode) => {
        const subject = dataFromObject ? executionNode : dataNode;
        const object = dataFromObject ? dataNode : executionNode;
        return provenance.graph.statementsMatching(
          subject,
          provenance.ns.PROV(predicate),
          object,
          undefined,
        ).length;
      });
    const executionInspections = new Map(
      affectedExecutionNodes.map((executionNode) => [
        ResourceMapCommon.nodeKey(executionNode),
        graphState.getExecutionSummary(executionNode),
      ]),
    );

    return provenance.mutateGraph(() => {
      affectedExecutionNodes.forEach((executionNode) => {
        GraphMutation.removeStatementsMatching(
          provenance.resourceMap,
          dataFromObject ? executionNode : dataNode,
          provenance.ns.PROV(predicate),
          dataFromObject ? dataNode : executionNode,
        );
        cleanupExecution(
          provenance,
          executionNode,
          executionInspections.get(ResourceMapCommon.nodeKey(executionNode)),
        );
      });
    });
  }

  /**
   * Repair execution facts that can be inferred without guessing: a node used
   * as an execution but missing its Execution type, and a named execution
   * missing its identifier literal (legacy resource maps key execution lookups
   * on identifier literals). Shapes that would require choosing between
   * multiple possible programs or agents are left for validation to report.
   * @param {Provenance} provenance Provenance instance whose graph is updated.
   * @param {Array<NamedNode|BlankNode>} executionNodes Precomputed execution
   * candidates.
   * @param {Map<string, object>} executionInspections Precomputed execution
   * summaries keyed by node identity.
   * @returns {Array<NamedNode|BlankNode>} Normalized execution candidates.
   */
  function normalizeExecutionGraph(
    provenance,
    executionNodes,
    executionInspections,
  ) {
    executionNodes.forEach((executionNode) => {
      const inspection = executionInspections.get(
        ResourceMapCommon.nodeKey(executionNode),
      );
      const hasManagedLinks =
        inspection?.hasGeneratedLinks ||
        inspection?.hasUsedLinks ||
        inspection?.hasWasInformedByLinks;
      if (!hasManagedLinks) {
        cleanupExecution(provenance, executionNode, inspection);
        return;
      }

      if (!inspection?.isExecution) {
        GraphMutation.addStatementIfMissing(
          provenance.resourceMap,
          executionNode,
          provenance.ns.RDF("type"),
          provenance.ns.PROVONE("Execution"),
        );
      }

      if (
        executionNode?.termType === "NamedNode" &&
        !inspection?.hasIdentifierLiteral
      ) {
        GraphMutation.addStatementIfMissing(
          provenance.resourceMap,
          executionNode,
          provenance.ns.DCTERMS("identifier"),
          rdf.literal(
            executionNode.value,
            undefined,
            provenance.ns.XSD("string"),
          ),
        );
      }
    });

    return executionNodes;
  }

  return {
    addExecutionProgramRelationship,
    cleanupExecution,
    ensureExecutionForProgram,
    normalizeExecutionGraph,
    removeExecutionProgramRelationship,
  };
});
