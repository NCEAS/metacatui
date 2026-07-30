"use strict";

/**
 * Create and remove the program run relationships used by provenance.
 *
 * The public Provenance API says that a program produced or consumed data. RDF
 * represents that history with an Execution node for the individual program
 * run. The Execution links to an Association, and the Association links to the
 * program through a Plan. This module manages those extra RDF nodes.
 *
 * MetacatUI reuses a program's run only when there is exactly one safe choice.
 * Multiple or ambiguous imported runs remain unchanged and read only. When the
 * final managed relationship is removed, the minimal run and association nodes
 * created by MetacatUI are removed too; imported nodes with extra information
 * are preserved.
 *
 * During a grouped edit, reads use the state captured before editing began and
 * writes go directly to `resourceMap.graph`.
 * @since 0.0.0
 */

define([
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/ProvenanceValidation",
], (ValueUtilities, RDFGraph, ResourceMapCommon, ProvenanceValidation) => {
  const { requireNonEmptyString, makeUUID } = ValueUtilities;
  const { NS, ResourceMapConflictError } = ResourceMapCommon;

  /**
   * Create the error returned when there is no single program run that can be
   * edited safely.
   * @param {string} programPid Program selected by the caller
   * @returns {ResourceMapConflictError} Read only provenance conflict
   */
  function programProvenanceReadOnlyError(programPid) {
    return new ResourceMapConflictError(
      `Program "${programPid}" is read only. Only programs with no run or one unambiguous run can be edited here.`,
      {
        code: "programProvenanceReadOnly",
        details: { programPid },
      },
    );
  }

  /**
   * Find a program run created earlier in the current grouped edit. Cached state
   * describes the graph before editing began, so this direct graph lookup is
   * needed only when that cache has no matching run.
   * @param {Provenance} provenance Provenance instance whose graph is inspected
   * @param {{pid: string, node: NamedNode}} programMember Exact program package
   * member
   * @returns {NamedNode|BlankNode|null} Pending execution node when found
   */
  function resolvePendingExecution(provenance, programMember) {
    const { graph } = provenance.resourceMap;
    const { node: programNode, pid: programPid } = programMember;
    const associationNodes = graph
      .findStatements({ predicate: NS.PROV("hadPlan"), object: programNode })
      .map(({ subject }) => subject);
    const executionNodes = RDFGraph.dedupeTerms(
      associationNodes.flatMap((associationNode) =>
        graph
          .findStatements({
            predicate: NS.PROV("qualifiedAssociation"),
            object: associationNode,
          })
          .map(({ subject }) => subject),
      ),
    ).filter((executionNode) =>
      graph.hasStatement({
        subject: executionNode,
        predicate: NS.RDF("type"),
        object: NS.PROVONE("Execution"),
      }),
    );
    if (executionNodes.length > 1) {
      throw programProvenanceReadOnlyError(programPid);
    }
    return executionNodes[0] || null;
  }

  /**
   * Label a node as a program run and add its identifier when either statement
   * is missing.
   * @param {Provenance} provenance Provenance instance whose graph is updated
   * @param {NamedNode|BlankNode} executionNode Execution node to update
   * @param {object} [inspection] Existing execution summary
   */
  function ensureExecutionIdentity(provenance, executionNode, inspection = {}) {
    const { graph } = provenance.resourceMap;
    if (!inspection.isExecution) {
      graph.addStatementIfMissing({
        subject: executionNode,
        predicate: NS.RDF("type"),
        object: NS.PROVONE("Execution"),
      });
    }
    if (
      RDFGraph.isNamedNode(executionNode) &&
      !inspection.hasIdentifierLiteral
    ) {
      const executionId = inspection.identifier || executionNode.value;
      graph.addStatementIfMissing({
        subject: executionNode,
        predicate: NS.DCTERMS("identifier"),
        object: RDFGraph.createLiteral(executionId, NS.XSD("string")),
      });
    }
  }

  /**
   * Connect a program run to the program that was executed. PROV stores this as
   * an Association linked to a Plan that identifies the program. Reuse an
   * existing Association and Plan, and add a program link only when none exists.
   * @param {Provenance} provenance Provenance instance whose graph is updated.
   * @param {NamedNode|BlankNode} executionNode Execution node to update.
   * @param {{pid: string, node: NamedNode}} programMember Exact program package
   * member that should be linked
   */
  function ensureAssociationForExecution(
    provenance,
    executionNode,
    programMember,
  ) {
    const { graph, graphState } = provenance.resourceMap;
    const { node: programNode, pid: programPid } = programMember;
    const associationNodes = RDFGraph.dedupeTerms(
      graph
        .findStatements({
          subject: executionNode,
          predicate: NS.PROV("qualifiedAssociation"),
        })
        .map(({ object }) => object),
    );
    if (associationNodes.length > 1) {
      throw programProvenanceReadOnlyError(programPid);
    }
    const associationNode = associationNodes[0] || RDFGraph.createBlankNode();
    const planNodes = RDFGraph.dedupeTerms(
      graph
        .findStatements({
          subject: associationNode,
          predicate: NS.PROV("hadPlan"),
        })
        .map(({ object }) => object),
    );
    if (planNodes.length > 1) {
      throw programProvenanceReadOnlyError(programPid);
    }
    const [existingPlanNode] = planNodes;
    if (
      existingPlanNode &&
      graphState.pidFromNode(existingPlanNode) !== programPid
    ) {
      throw programProvenanceReadOnlyError(programPid);
    }

    graph.addStatementIfMissing({
      subject: executionNode,
      predicate: NS.PROV("qualifiedAssociation"),
      object: associationNode,
    });
    if (!planNodes.length) {
      graph.addStatementIfMissing({
        subject: associationNode,
        predicate: NS.PROV("hadPlan"),
        object: programNode,
      });
    }
  }

  /**
   * Update the program runs belonging to one provenance graph.
   * @class ProvenanceExecutionMutation
   * @classcategory Models/ResourceMap
   * @since 0.0.0
   */
  class ProvenanceExecutionMutation {
    /**
     * @param {object} options Mutation options
     * @param {Provenance} options.provenance Provenance instance being updated
     */
    constructor({ provenance } = {}) {
      this.provenance = provenance;
    }

    /**
     * Find or create the single program run used to connect a program package
     * member to data.
     * @param {{pid: string, node: NamedNode}} programMember Exact program
     * package member whose run is needed
     * @returns {NamedNode|BlankNode} Existing or newly created execution node
     * Intended to be called inside `Provenance.mutateGraph()`
     */
    ensureExecutionForProgram(programMember) {
      const { provenance } = this;
      const normalizedProgramPid = programMember.pid;
      const { graphState } = provenance.resourceMap;
      if (
        !ProvenanceValidation.isProgramExecutionEditable(
          provenance,
          normalizedProgramPid,
        )
      ) {
        throw programProvenanceReadOnlyError(normalizedProgramPid);
      }
      const executionNode =
        graphState.getExecutionNodesForProgram(normalizedProgramPid)[0] ||
        resolvePendingExecution(provenance, programMember);

      if (executionNode) {
        const inspection = graphState.getExecutionSummary(executionNode);
        if (!inspection) {
          ensureAssociationForExecution(
            provenance,
            executionNode,
            programMember,
          );
          return executionNode;
        }
        ensureExecutionIdentity(provenance, executionNode, inspection);
        return executionNode;
      }

      const executionId = makeUUID();
      const newExecutionNode = RDFGraph.createNamedNode(executionId);

      ensureExecutionIdentity(provenance, newExecutionNode);
      ensureAssociationForExecution(
        provenance,
        newExecutionNode,
        programMember,
      );
      return newExecutionNode;
    }

    /**
     * Record that a program run produced or consumed a data object.
     * @param {object} options Relationship options
     * @param {string} options.dataPid Data PID in the relationship
     * @param {string} options.programPid Program PID in the relationship
     * @param {string} options.predicate PROV relationship name
     * @param {boolean} [options.dataFromObject] Whether the data is on the
     * object side of the RDF statement
     * @returns {Provenance} Updated provenance instance
     */
    addExecutionProgramRelationship(options) {
      const { provenance } = this;
      const programMember = provenance.resourceMap.resolveMemberNode(
        options.programPid,
        {
          required: true,
          message: "Program PID required",
        },
      );
      return provenance.mutateGraph(() => {
        const { dataPid, predicate, dataFromObject = false } = options;
        const dataNode = provenance.ensurePidNode(dataPid, {
          message: "Data PID required",
        });
        const executionNode = this.ensureExecutionForProgram(programMember);

        provenance.resourceMap.graph.addStatementIfMissing({
          subject: dataFromObject ? executionNode : dataNode,
          predicate: NS.PROV(predicate),
          object: dataFromObject ? dataNode : executionNode,
        });
      });
    }

    /**
     * Remove the record that a program run produced or consumed a data object.
     * @param {object} options Relationship options
     * @param {string} options.dataPid Data PID in the relationship
     * @param {string} options.programPid Program PID in the relationship
     * @param {string} options.predicate PROV relationship name
     * @param {boolean} [options.dataFromObject] Whether the data is on the
     * object side of the RDF statement
     * @returns {Provenance} Updated provenance instance
     */
    removeExecutionProgramRelationship({
      dataPid,
      programPid,
      predicate,
      dataFromObject = false,
    }) {
      const { provenance } = this;
      const normalizedDataPid = requireNonEmptyString(
        dataPid,
        "Data PID required",
      );
      const { pid: normalizedProgramPid } =
        provenance.resourceMap.resolveMemberNode(programPid, {
          required: true,
          message: "Program PID required",
        });
      const { graph, graphState } = provenance.resourceMap;
      if (
        !ProvenanceValidation.isProgramExecutionEditable(
          provenance,
          normalizedProgramPid,
        )
      ) {
        throw programProvenanceReadOnlyError(normalizedProgramPid);
      }
      const [executionNode] =
        graphState.getExecutionNodesForProgram(normalizedProgramPid);
      if (!executionNode) return provenance;

      const statementsToRemove = graph
        .findStatements({ predicate: NS.PROV(predicate) })
        .filter((statement) => {
          const dataNode = dataFromObject
            ? statement.object
            : statement.subject;
          const statementExecutionNode = dataFromObject
            ? statement.subject
            : statement.object;
          return (
            RDFGraph.buildTermKey(statementExecutionNode) ===
              RDFGraph.buildTermKey(executionNode) &&
            graphState.pidFromNode(dataNode) === normalizedDataPid
          );
        });
      if (!statementsToRemove.length) return provenance;

      return provenance.mutateGraph(() => {
        // One chart relationship summarizes every RDF edge for this data PID
        // and program PID. Removing it must remove every matching edge.
        statementsToRemove.forEach((statement) => {
          graph.removeStatement(statement);
        });
        provenance.removeStandaloneExecutionScaffolds([executionNode]);
      });
    }

    /**
     * Add a missing program run type or identifier only when existing
     * relationships make the node's role certain. Ambiguous imported structures
     * are left untouched.
     * @param {object[]} executionInspections Precomputed execution summaries
     */
    normalizeExecutionGraph(executionInspections) {
      const { provenance } = this;
      executionInspections.forEach((inspection) => {
        const { node: executionNode } = inspection;
        if (!inspection.hasManagedLinks) {
          return;
        }

        ensureExecutionIdentity(provenance, executionNode, inspection);
      });
    }

    /**
     * Remove an unnamed Association node after its program link is deleted, but
     * only when it contains no other imported information.
     * @param {Array<BlankNode|NamedNode>} associationNodes Changed associations
     */
    removeDanglingQualifiedAssociations(associationNodes) {
      const { graph } = this.provenance.resourceMap;
      RDFGraph.dedupeTerms(associationNodes)
        .filter((associationNode) => {
          if (!RDFGraph.isBlankNode(associationNode)) return false;

          // The canonical Association type is scaffold metadata, not
          // enriched RDF that should retain a planless blank association.
          return graph
            .findStatements({ subject: associationNode })
            .every(
              ({ predicate, object }) =>
                RDFGraph.buildTermKey(predicate) ===
                  RDFGraph.buildTermKey(NS.RDF("type")) &&
                RDFGraph.buildTermKey(object) ===
                  RDFGraph.buildTermKey(NS.PROV("Association")),
            );
        })
        .forEach((associationNode) => {
          graph.removeStatementsMatching({
            predicate: NS.PROV("qualifiedAssociation"),
            object: associationNode,
          });
          if (!graph.hasStatement({ object: associationNode })) {
            graph.removeNodeReferences(associationNode);
          }
        });
    }
  }

  return ProvenanceExecutionMutation;
});
