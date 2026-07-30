"use strict";

define([
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/ProvenanceExecutionMutation",
  "models/resourceMap/ProvenanceValidation",
], (
  ValueUtilities,
  RDFGraph,
  ResourceMapCommon,
  ProvenanceExecutionMutation,
  ProvenanceValidation,
) => {
  const { requireNonEmptyString } = ValueUtilities;

  const { PROV_EDGE_SPECS } = ResourceMapCommon;

  /**
   * @typedef {object} WasDerivedFromRelationship
   * @property {string} derivedPid PID of the newer data object.
   * @property {string} sourcePid PID of the data it came from. Either object may
   * be a package member or an external object.
   */

  /**
   * @typedef {object} ExecutionProgramRelationship
   * @property {string} dataPid PID of data produced or consumed by a program
   * run. The data may be a package member or an external object.
   * @property {string} programPid PID of the program package member.
   * @property {string|null} executionId Identifier for the program run that
   * connects the data and program.
   * @property {string} [executionKey] Internal graph key used when an imported
   * program run has no identifier.
   */

  /**
   * @typedef {object} ProgramLineageRelationship
   * @property {string} programPid PID of the current program package member.
   * @property {string} previousProgramPid PID of the package member representing
   * the program whose run informed the current run.
   * @property {string|null} executionId Identifier for the current program run.
   * @property {string|null} previousExecutionId Identifier for the earlier
   * program run.
   */

  /**
   * @typedef {object} TypeAssertion
   * @property {string} pid PID of the classified object.
   * @property {string} className PROVONE classification, such as `Data` or
   * `Program`, without the namespace prefix.
   */

  /**
   * Read and update a package's history: which data came from other data, which
   * programs produced or consumed it, and which program runs followed earlier
   * runs. The relationships are stored in the Resource Map's RDF graph.
   * @class Provenance
   * @classcategory Models/ResourceMap
   * @since 0.0.0
   */
  class Provenance {
    /**
     * @param {object} options Provenance options.
     * @param {ResourceMap} options.resourceMap Resource Map whose graph stores
     * the provenance statements
     */
    constructor({ resourceMap } = {}) {
      this.resourceMap = resourceMap;
      this.ns = resourceMap.ns;
      this.executionMutation = new ProvenanceExecutionMutation({
        provenance: this,
      });
    }

    /**
     * Apply one provenance edit and clear cached summaries afterwards.
     * @param {Function} mutator Provenance graph mutation callback.
     * @param {object} [options] Mutation options.
     * @param {boolean} [options.markDirty] Mark a successful mutation unsaved.
     * @param {boolean} [options.rollbackOnError] Whether to roll back graph
     * mutations if the mutator throws an error. Default to true.
     * @returns {Provenance} Updated provenance instance.
     * @private
     */
    mutateGraph(mutator, { markDirty = true, rollbackOnError = true } = {}) {
      if (!this.resourceMap.isGraphMutating()) {
        // Provenance mutations resolve PIDs, roles, and executions from the
        // state recorded before the edit. Build that state before changing the
        // graph.
        this.resourceMap.graphState.getIndex();
      }
      this.resourceMap.mutateGraph(mutator, { markDirty, rollbackOnError });
      return this;
    }

    /**
     * Return pairs showing which data objects were created from which source
     * data. RDF values that cannot be tied to PIDs are omitted.
     * @returns {WasDerivedFromRelationship[]} Derivation relationships, e.g.
     * `[{ derivedPid: "derived.1", sourcePid: "data.1" }]`
     */
    getWasDerivedFromLinks() {
      return this.resourceMap.graphState.getWasDerivedFromLinks();
    }

    /**
     * Return the program runs that produced data objects.
     * @returns {ExecutionProgramRelationship[]} Generation relationships, e.g.
     * `[{ dataPid: "derived.1", programPid: "program.1", executionId:
     * "urn:uuid:exec.1" }]`
     */
    getGeneratedByPrograms() {
      return this.resourceMap.graphState.getGeneratedByPrograms();
    }

    /**
     * Return the program runs that consumed data objects as inputs.
     * @returns {ExecutionProgramRelationship[]} Usage relationships, e.g.
     * `[{ dataPid: "data.1", programPid: "program.1", executionId:
     * "urn:uuid:exec.1" }]`
     */
    getUsedByPrograms() {
      return this.resourceMap.graphState.getUsedByPrograms();
    }

    /**
     * Return current/previous program pairs when one program run followed
     * another (`prov:wasInformedBy`).
     * @returns {ProgramLineageRelationship[]} Program ordering relationships,
     * e.g. `[{ programPid: "program.1", previousProgramPid: "program.2" }]`
     */
    getWasInformedByPrograms() {
      return this.resourceMap.graphState.getWasInformedByPrograms();
    }

    /**
     * Return `Data` and `Program` classifications that are written explicitly
     * or inferred from how each PID is used in provenance relationships.
     * @returns {TypeAssertion[]} Classifications keyed by PID, e.g.
     * `[{ pid: "program.1", className: "Program" }]`
     */
    getTypeAssertions() {
      return this.resourceMap.graphState.getTypeAssertions();
    }

    /**
     * Record that one data object was created from another
     * (`derivedPid --wasDerivedFrom--> sourcePid`).
     * @param {string} derivedPid PID of the derived data node.
     * @param {string} sourcePid PID of the source data node.
     * @returns {Provenance} Updated provenance instance.
     */
    addWasDerivedFrom(derivedPid, sourcePid) {
      return this.mutateGraph(() => {
        const derivedNode = this.ensurePidNode(derivedPid, {
          message: "Derived PID required",
        });
        const sourceNode = this.ensurePidNode(sourcePid, {
          message: "Source PID required",
        });
        this.resourceMap.graph.addStatementIfMissing({
          subject: derivedNode,
          predicate: this.ns.PROV("wasDerivedFrom"),
          object: sourceNode,
        });
      });
    }

    /**
     * Remove the record that one data object was created from another.
     * @param {string} derivedPid PID of the derived data node.
     * @param {string} sourcePid PID of the source data node.
     * @returns {Provenance} Updated provenance instance.
     */
    removeWasDerivedFrom(derivedPid, sourcePid) {
      const normalizedDerivedPid = requireNonEmptyString(
        derivedPid,
        "Derived PID required",
      );
      const normalizedSourcePid = requireNonEmptyString(
        sourcePid,
        "Source PID required",
      );
      const { graph, graphState } = this.resourceMap;
      const statementsToRemove = graph
        .findStatements({ predicate: this.ns.PROV("wasDerivedFrom") })
        .filter(
          ({ subject, object }) =>
            graphState.pidFromNode(subject) === normalizedDerivedPid &&
            graphState.pidFromNode(object) === normalizedSourcePid,
        );
      if (!statementsToRemove.length) return this;

      return this.mutateGraph(() => {
        // One chart relationship summarizes every RDF statement for this PID
        // pair. Deleting the relationship must remove each matching statement.
        statementsToRemove.forEach((statement) => {
          graph.removeStatement(statement);
        });
      });
    }

    /**
     * Record that a program package member produced a data object. The data may
     * be inside or outside the package.
     * @param {string} dataPid PID of the generated data object.
     * @param {string} programPid PID of the program package member.
     * @returns {Provenance} Updated provenance instance.
     */
    addGeneratedByProgram(dataPid, programPid) {
      return this.executionMutation.addExecutionProgramRelationship({
        dataPid,
        programPid,
        ...PROV_EDGE_SPECS.generatedByProgram,
      });
    }

    /**
     * Remove the record that a program produced a data object.
     * @param {string} dataPid PID of the generated data object.
     * @param {string} programPid PID of the program object.
     * @returns {Provenance} Updated provenance instance.
     */
    removeGeneratedByProgram(dataPid, programPid) {
      return this.executionMutation.removeExecutionProgramRelationship({
        dataPid,
        programPid,
        ...PROV_EDGE_SPECS.generatedByProgram,
      });
    }

    /**
     * Record that a program package member consumed a data object as input. The
     * data may be inside or outside the package.
     * @param {string} dataPid PID of the used data object.
     * @param {string} programPid PID of the program package member.
     * @returns {Provenance} Updated provenance instance.
     */
    addUsedByProgram(dataPid, programPid) {
      return this.executionMutation.addExecutionProgramRelationship({
        dataPid,
        programPid,
        ...PROV_EDGE_SPECS.usedByProgram,
      });
    }

    /**
     * Remove the record that a program consumed a data object.
     * @param {string} dataPid PID of the used data object.
     * @param {string} programPid PID of the program object.
     * @returns {Provenance} Updated provenance instance.
     */
    removeUsedByProgram(dataPid, programPid) {
      return this.executionMutation.removeExecutionProgramRelationship({
        dataPid,
        programPid,
        ...PROV_EDGE_SPECS.usedByProgram,
      });
    }

    /**
     * Apply provenance cleanup calculated before package members are removed.
     * @private
     * @param {object} removals Collected member reference removals.
     * @returns {Provenance} Updated provenance instance.
     */
    applyMemberReferenceRemovals(removals) {
      const {
        statementsToRemove,
        affectedExecutionNodes,
        affectedAssociationNodes,
        executionsLosingAllPlans,
      } = removals;
      if (!statementsToRemove.length) return this;
      statementsToRemove.forEach((statement) => {
        this.resourceMap.graph.removeStatement(statement);
      });
      // Keep this pass before association pruning. Otherwise removing one of
      // several programs could expose the surviving program's sole association
      // and make it look like a removable standalone scaffold.
      this.removeStandaloneExecutionScaffolds(affectedExecutionNodes);
      this.executionMutation.removeDanglingQualifiedAssociations(
        affectedAssociationNodes,
      );

      // A batch can empty several affected blank associations at once. Recheck
      // only executions proven against the pre-mutation graph to lose every
      // plan; pre-existing associationless imports are not cleanup targets.
      const associationlessExecutionNodes = RDFGraph.dedupeTerms(
        executionsLosingAllPlans,
      ).filter(
        (executionNode) =>
          this.resourceMap.graph.hasStatement({ subject: executionNode }) &&
          !this.resourceMap.graph.hasStatement({
            subject: executionNode,
            predicate: this.ns.PROV("qualifiedAssociation"),
          }),
      );
      this.removeStandaloneExecutionScaffolds(associationlessExecutionNodes, {
        allowAssociationless: true,
      });
      return this;
    }

    /**
     * Find provenance statements and helper nodes affected by member deletion.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @returns {object} Collected statements and affected graph nodes
     */
    collectMemberReferenceRemovals(normalizedPids) {
      const removals = {
        statementsToRemove: [],
        affectedExecutionNodes: [],
        affectedAssociationNodes: [],
        executionsLosingAllPlans: [],
      };

      this.collectWasDerivedFromMemberRemovals(normalizedPids, removals);
      this.collectExecutionProgramMemberRemovals(normalizedPids, removals);
      this.collectWasInformedByMemberRemovals(normalizedPids, removals);
      this.collectProgramPlanMemberRemovals(normalizedPids, removals);

      return removals;
    }

    /**
     * Find data derivation relationships involving deleted members.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @param {object} removals Shared removal collection.
     */
    collectWasDerivedFromMemberRemovals(normalizedPids, removals) {
      const { graphState } = this.resourceMap;
      this.resourceMap.graph
        .findStatements({ predicate: this.ns.PROV("wasDerivedFrom") })
        .filter(
          ({ subject, object }) =>
            normalizedPids.has(graphState.pidFromNode(subject)) ||
            normalizedPids.has(graphState.pidFromNode(object)),
        )
        .forEach((statement) => removals.statementsToRemove.push(statement));
    }

    /**
     * Test whether deleting program members removes every program linked to a
     * run.
     * @private
     * @param {object|null} executionSummary Execution structure to inspect
     * @param {Set<string>} normalizedPids Member PIDs being removed
     * @returns {boolean} Whether every exact plan belongs to a removed PID
     */
    removesEveryExecutionPlan(executionSummary, normalizedPids) {
      const planNodes =
        executionSummary?.associations.flatMap(
          ({ planNodes: associationPlans }) => associationPlans,
        ) || [];
      // The PID summary omits imported plans that do not resolve to a PID.
      // Their exact RDF nodes still share the execution, so the execution must
      // remain.
      return (
        planNodes.length > 0 &&
        planNodes.every((planNode) =>
          normalizedPids.has(this.resourceMap.graphState.pidFromNode(planNode)),
        )
      );
    }

    /**
     * Find relationships for produced or consumed data affected by member
     * deletion.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @param {object} removals Shared removal collection.
     */
    collectExecutionProgramMemberRemovals(normalizedPids, removals) {
      const { graphState } = this.resourceMap;
      [
        PROV_EDGE_SPECS.generatedByProgram,
        PROV_EDGE_SPECS.usedByProgram,
      ].forEach(({ predicate, dataFromObject }) => {
        this.resourceMap.graph
          .findStatements({ predicate: this.ns.PROV(predicate) })
          .forEach((statement) => {
            const dataNode = dataFromObject
              ? statement.object
              : statement.subject;
            const executionNode = dataFromObject
              ? statement.subject
              : statement.object;
            const dataPid = graphState.pidFromNode(dataNode);
            const removesData = normalizedPids.has(dataPid);
            const executionSummary =
              graphState.getExecutionSummary(executionNode);
            const removesAllPlans = this.removesEveryExecutionPlan(
              executionSummary,
              normalizedPids,
            );
            if (!removesData && !removesAllPlans) return;

            removals.statementsToRemove.push(statement);
            // Decide cleanup eligibility from the pre-mutation shape. One plan,
            // resolved or external, is still part of a bare scaffold after its
            // final data edge is removed. A batch must not make an imported
            // multi-plan or multi-association run newly removable.
            const dataRemovalLeavesBareCandidate =
              removesData &&
              executionSummary?.associations.length === 1 &&
              executionSummary.associations[0].planNodes.length <= 1;
            if (dataRemovalLeavesBareCandidate || removesAllPlans) {
              removals.affectedExecutionNodes.push(executionNode);
            }
          });
      });
    }

    /**
     * Find program run ordering relationships affected by deleting members.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @param {object} removals Shared removal collection.
     */
    collectWasInformedByMemberRemovals(normalizedPids, removals) {
      const { graphState } = this.resourceMap;
      this.resourceMap.graph
        .findStatements({ predicate: this.ns.PROV("wasInformedBy") })
        .forEach((statement) => {
          const executionNodes = [statement.subject, statement.object];
          const executionSummaries = executionNodes.map((executionNode) =>
            graphState.getExecutionSummary(executionNode),
          );
          if (executionSummaries.some((summary) => !summary)) {
            return;
          }

          const removedExecutionNodes = executionNodes.filter(
            (_executionNode, index) =>
              this.removesEveryExecutionPlan(
                executionSummaries[index],
                normalizedPids,
              ),
          );
          if (!removedExecutionNodes.length) return;

          removals.affectedExecutionNodes.push(...removedExecutionNodes);
          removals.statementsToRemove.push(statement);
        });
    }

    /**
     * Find links from executions to deleted program members.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed
     * @param {object} removals Shared removal collection
     */
    collectProgramPlanMemberRemovals(normalizedPids, removals) {
      const { graph, graphState } = this.resourceMap;
      graph
        .findStatements({ predicate: this.ns.PROV("hadPlan") })
        .filter(({ object }) =>
          normalizedPids.has(graphState.pidFromNode(object)),
        )
        .forEach((statement) => {
          removals.statementsToRemove.push(statement);
          // Remember only the association changed by this member removal.
          removals.affectedAssociationNodes.push(statement.subject);
          graph
            .findStatements({
              predicate: this.ns.PROV("qualifiedAssociation"),
              object: statement.subject,
            })
            .forEach(({ subject: executionNode }) => {
              // Eligibility is execution-wide: removing one association must
              // not queue a run whose other association still has a plan.
              const executionSummary =
                graphState.getExecutionSummary(executionNode);
              if (
                !this.removesEveryExecutionPlan(
                  executionSummary,
                  normalizedPids,
                )
              ) {
                return;
              }

              removals.affectedExecutionNodes.push(executionNode);
              removals.executionsLosingAllPlans.push(executionNode);
            });
        });
    }

    /**
     * Remove minimal run and association nodes after their last managed
     * relationship is removed. Preserve imported nodes that carry any
     * additional statements.
     * @private
     * @param {Array<NamedNode|BlankNode>} executionNodes Candidate executions
     * @param {object} [options] Cleanup options
     * @param {boolean} [options.allowAssociationless] Allow a candidate
     * that lost every plan and became associationless in the current edit
     */
    removeStandaloneExecutionScaffolds(
      executionNodes,
      { allowAssociationless = false } = {},
    ) {
      const { graph } = this.resourceMap;
      const typePredicate = this.ns.RDF("type").value;
      const identifierPredicate = this.ns.DCTERMS("identifier").value;
      const associationPredicate = this.ns.PROV("qualifiedAssociation").value;
      const executionType = this.ns.PROVONE("Execution").value;
      const associationType = this.ns.PROV("Association").value;
      const planPredicate = this.ns.PROV("hadPlan").value;

      RDFGraph.dedupeTerms(executionNodes).forEach((executionNode) => {
        const outgoing = graph.findStatements({ subject: executionNode });
        const associations = outgoing
          .filter(({ predicate }) => predicate.value === associationPredicate)
          .map(({ object }) => object);
        const identifierStatements = outgoing.filter(
          ({ predicate }) => predicate.value === identifierPredicate,
        );
        const hasManagedIdentifier = RDFGraph.isBlankNode(executionNode)
          ? identifierStatements.length <= 1
          : identifierStatements.length === 1;
        const isManagedExecution =
          !graph.hasStatement({ object: executionNode }) &&
          (associations.length === 1 ||
            (allowAssociationless && associations.length === 0)) &&
          hasManagedIdentifier &&
          outgoing.every(({ predicate, object }) => {
            if (predicate.value === associationPredicate) return true;
            if (predicate.value === identifierPredicate) {
              return RDFGraph.isLiteral(object);
            }
            return (
              predicate.value === typePredicate &&
              object.value === executionType
            );
          });
        if (!isManagedExecution) return;

        const [associationNode] = associations;
        if (!associationNode) {
          // Associationless cleanup is opt-in because an incomplete imported
          // execution may have meaning of its own. Member removal enables it
          // only after the same edit removes every plan and prunes its links.
          graph.removeNodeReferences(executionNode);
          return;
        }

        const associationStatements = graph.findStatements({
          subject: associationNode,
        });
        const isManagedAssociation =
          associationStatements.filter(
            ({ predicate }) => predicate.value === planPredicate,
          ).length <= 1 &&
          associationStatements.every(({ predicate, object }) => {
            // An association with prov:agent or any other imported statement
            // contains information beyond MetacatUI's basic structure and must
            // remain.
            if (predicate.value === planPredicate) return true;
            return (
              predicate.value === typePredicate &&
              object.value === associationType
            );
          });
        if (!isManagedAssociation) return;

        graph.removeNodeReferences(executionNode);
        if (!graph.hasStatement({ object: associationNode })) {
          graph.removeNodeReferences(associationNode);
        }
      });
    }

    /**
     * Check that provenance relationships have usable PIDs and reference valid
     * program package members.
     * @returns {object[]} Validation issues.
     */
    validate() {
      return ProvenanceValidation.validateProvenance(this);
    }

    /**
     * Add missing execution type or identifier statements only when existing
     * relationships make the repair unambiguous.
     * @param {object} [options] Normalization options.
     * @param {boolean} [options.markDirty] Mark normalization changes unsaved.
     * @returns {Provenance} Updated provenance instance.
     */
    normalize({ markDirty = false } = {}) {
      const { graphState } = this.resourceMap;
      const executionInspections = graphState
        .getExecutionNodes()
        .map((executionNode) => graphState.getExecutionSummary(executionNode));

      return this.mutateGraph(
        () => {
          this.executionMutation.normalizeExecutionGraph(executionInspections);
        },
        { markDirty },
      );
    }

    /**
     * Return a consistently ordered provenance summary for diffs, tests, and
     * JSON output.
     * @returns {object} Ordered provenance summary
     */
    toJSON() {
      return {
        wasDerivedFrom: ResourceMapCommon.sortByFields(
          this.getWasDerivedFromLinks(),
          ["derivedPid", "sourcePid"],
        ),
        generatedByPrograms: ResourceMapCommon.sortByFields(
          this.getGeneratedByPrograms(),
          ["dataPid", "programPid", "executionId"],
        ),
        usedByPrograms: ResourceMapCommon.sortByFields(
          this.getUsedByPrograms(),
          ["dataPid", "programPid", "executionId"],
        ),
        wasInformedByPrograms: ResourceMapCommon.sortByFields(
          this.getWasInformedByPrograms(),
          [
            "programPid",
            "previousProgramPid",
            "executionId",
            "previousExecutionId",
          ],
        ),
        typeAssertions: ResourceMapCommon.sortByFields(
          this.getTypeAssertions(),
          ["pid", "className"],
        ),
      };
    }

    /**
     * Create missing `rdf:type` statements that label objects as `provone:Data`
     * or `provone:Program` based on how they participate in provenance
     * relationships. The statements are added only to serialized output, not to
     * the editable graph.
     * @private
     * @returns {Array<object>} Derived RDF type statements for serialization
     */
    deriveRoleTypeStatements() {
      const { graphState } = this.resourceMap;
      const statements = [];
      const existingTypeKeys = new Set(
        this.resourceMap.graph
          .findStatements({ predicate: this.ns.RDF("type") })
          .map(RDFGraph.buildStatementKey),
      );
      ["Data", "Program"].forEach((className) => {
        const classNode = this.ns.PROVONE(className);
        graphState.getRolePidSet(className).forEach((pid) => {
          const uri = graphState.findNodeUriForPid(pid);
          if (!uri) {
            return;
          }
          const subject = RDFGraph.createNamedNode(uri);
          const statement = RDFGraph.createStatement(
            subject,
            this.ns.RDF("type"),
            classNode,
          );
          if (!existingTypeKeys.has(RDFGraph.buildStatementKey(statement))) {
            statements.push(statement);
          }
        });
      });
      return statements;
    }

    /**
     * Find the RDF node already representing a provenance PID, or create a
     * resolve service node when none exists.
     * @private
     * @param {string} pid PID to resolve.
     * @param {object} [options] Resolution options.
     * @param {string} [options.message] Error message used when the PID is
     * invalid.
     * @returns {NamedNode} Resolved provenance node
     */
    ensurePidNode(pid, { message = "PID required" } = {}) {
      const normalizedPid = requireNonEmptyString(pid, message);
      const { graphState } = this.resourceMap;
      const member = this.resourceMap.resolveMemberNode(normalizedPid);
      if (member) {
        // Use the exact package member URI. Creating a URI from the PID could
        // put the relationship on the currently configured Coordinating Node
        // instead of the node used by the imported member, which caused issue
        // #478.
        this.resourceMap.ensureIdentifierForUri(member.uri, normalizedPid);
        return member.node;
      }

      const uri =
        graphState.findNodeUriForPid(normalizedPid) ||
        this.resourceMap.pidToUri(normalizedPid);
      this.resourceMap.ensureIdentifierForUri(uri, normalizedPid);
      return RDFGraph.createNamedNode(uri);
    }
  }

  return Provenance;
});
