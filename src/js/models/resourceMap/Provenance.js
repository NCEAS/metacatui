"use strict";

define([
  "rdflib",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/ProvenanceExecutionMutation",
  "models/resourceMap/ProvenanceValidation",
], (
  rdf,
  ValueUtilities,
  ResourceMapCommon,
  GraphMutation,
  ProvenanceExecutionMutation,
  ProvenanceValidation,
) => {
  const { dedupeBy, isNonEmptyString, normalizeText, requireNonEmptyString } =
    ValueUtilities;

  const EXPLICIT_TYPE_CLASS_NAMES = new Set(["Data", "Program"]);

  /**
   * @typedef {object} WasDerivedFromRelationship
   * @property {string} derivedPid PID of the derived data object. This may be
   * aggregated or external.
   * @property {string} sourcePid PID of the source data object. This may be
   * aggregated or external.
   */

  /**
   * @typedef {object} ExecutionProgramRelationship
   * @property {string} dataPid PID of the data object. This may be aggregated
   * or external.
   * @property {string} programPid Aggregated PID of the program object.
   * @property {string|null} executionId Execution identifier linking the
   * data/program relationship.
   * @property {string|null} agentUri Agent URI associated with the execution,
   * when present.
   */

  /**
   * @typedef {object} ProgramLineageRelationship
   * @property {string} programPid Aggregated PID of the current program.
   * @property {string} previousProgramPid Aggregated PID of the informing
   * program.
   * @property {string|null} executionId Execution identifier for the current
   * program.
   * @property {string|null} previousExecutionId Execution identifier for the
   * informing program.
   */

  /**
   * @typedef {object} TypeAssertion
   * @property {string} pid PID of the subject node.
   * @property {string} className PROVONE class name without the namespace
   * prefix.
   */

  /**
   * Find the concrete execution-node pairs behind one program-lineage
   * relationship. Pairs whose execution nodes no longer resolve are skipped.
   * @param {ResourceMapState} graphState Pre-mutation graph projection.
   * @param {ProgramLineageRelationship} relationship Lineage link whose
   * execution pairs are needed.
   * @returns {Array<{executionNode: object, previousExecutionNode: object}>}
   * Distinct execution-node pairs.
   */
  function findWasInformedByExecutionPairs(graphState, relationship) {
    const findExecution = (executionId) =>
      graphState
        .findNodesByIdentifier(executionId)
        .find((node) => graphState.isExecutionNode(node));

    return dedupeBy(
      graphState
        .getWasInformedByPrograms()
        .filter(
          (candidate) =>
            candidate.programPid === relationship.programPid &&
            candidate.previousProgramPid === relationship.previousProgramPid &&
            candidate.executionId === relationship.executionId &&
            candidate.previousExecutionId === relationship.previousExecutionId,
        )
        .flatMap(({ executionId, previousExecutionId }) => {
          const executionNode = findExecution(executionId);
          const previousExecutionNode = findExecution(previousExecutionId);
          return executionNode && previousExecutionNode
            ? [{ executionNode, previousExecutionNode }]
            : [];
        }),
      ({ executionNode, previousExecutionNode }) =>
        ResourceMapCommon.buildKey([
          ResourceMapCommon.nodeKey(executionNode),
          ResourceMapCommon.nodeKey(previousExecutionNode),
        ]),
    );
  }

  /**
   * Query and edit package-level provenance stored in a {@link ResourceMap}.
   * This class focuses on provenance relationships used in MetacatUI:
   * derivations, program usage and generation, program lineage, type
   * assertions, and validation.
   */
  class Provenance {
    /**
     * @param {object} options Provenance options.
     * @param {ResourceMap} options.resourceMap Resource map that owns the RDF
     * graph.
     */
    constructor({ resourceMap } = {}) {
      this.resourceMap = resourceMap;
      this.graph = resourceMap.graph;
      this.ns = resourceMap.ns;
    }

    /** @returns {ResourceMapState} Derived graph projection. */
    getGraphState() {
      return this.resourceMap.getGraphState();
    }

    /**
     * Edit the provenance graph and clear the summary cache afterwards.
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
        // Provenance mutations resolve PIDs, roles, and executions from one
        // stable pre-mutation projection. Build it once before editing.
        this.getGraphState().getIndex();
      }
      this.resourceMap.mutateGraph(mutator, { markDirty, rollbackOnError });
      return this;
    }

    /**
     * Return all `prov:wasDerivedFrom` relationships between data PIDs. e.g.
     * <prov:wasDerivedFrom rdf:resource=".../resolve/data.1"/>. This excludes
     * literal values and blank nodes that cannot be reliably resolved to PIDs.
     * @returns {WasDerivedFromRelationship[]} Normalized derivation
     * relationships, e.g. [{ derivedPid: "derived.1", sourcePid: "data.1" }]
     */
    getWasDerivedFromLinks() {
      return this.getGraphState().getWasDerivedFromLinks();
    }

    /**
     * Get program executions that generated data objects, e.g.
     * <prov:wasGeneratedBy rdf:resource="urn:uuid:exec.1"/>
     * @returns {ExecutionProgramRelationship[]} Normalized generation
     * relationships, e.g. [{ dataPid: "derived.1", programPid: "program.1",
     * executionId: "urn:uuid:exec.1" }]
     */
    getGeneratedByPrograms() {
      return this.getGraphState().getGeneratedByPrograms();
    }

    /**
     * Get program executions that used data objects, e.g. <prov:used
     * rdf:resource=".../resolve/data.1"/>
     * @returns {ExecutionProgramRelationship[]} Normalized usage relationships,
     * e.g. [{ dataPid: "data.1", programPid: "program.1", executionId:
     * "urn:uuid:exec.1" }]
     */
    getUsedByPrograms() {
      return this.getGraphState().getUsedByPrograms();
    }

    /**
     * Return program-to-program lineage inferred from execution
     * `prov:wasInformedBy` links, e.g. <prov:wasInformedBy
     * rdf:resource="urn:uuid:prev-exec"/>
     * @returns {ProgramLineageRelationship[]} Normalized program-lineage
     * relationships, e.g. [{ programPid: "program.1", previousProgramPid:
     * "program.2" }]
     */
    getWasInformedByPrograms() {
      return this.getGraphState().getWasInformedByPrograms();
    }

    /**
     * Get explicit and structurally derived PROVONE type assertions keyed by
     * PID, e.g. <rdf:type
     * rdf:resource="http://purl.dataone.org/provone/...#Program"/>
     * @returns {TypeAssertion[]} PROVONE type assertions keyed by PID, e.g. [{
     * pid: "program.1", className: "Program" }]
     */
    getTypeAssertions() {
      return this.getGraphState().getTypeAssertions();
    }

    /**
     * Add a `prov:wasDerivedFrom` relationship between two data PIDs. e.g. adds
     * <prov:wasDerivedFrom rdf:resource=".../resolve/data.1"/>
     * @param {string} derivedPid PID of the derived data node.
     * @param {string} sourcePid PID of the source data node.
     * @returns {Provenance} Updated provenance instance.
     */
    addWasDerivedFrom(derivedPid, sourcePid) {
      return this.mutateGraph(() => {
        const derived = this.ensurePidNode(derivedPid, {
          message: "Derived PID required",
        });
        const source = this.ensurePidNode(sourcePid, {
          message: "Source PID required",
        });
        GraphMutation.addStatementIfMissing(
          this.resourceMap,
          derived.node,
          this.ns.PROV("wasDerivedFrom"),
          source.node,
        );
      });
    }

    /**
     * Remove a `prov:wasDerivedFrom` relationship.
     * @param {string} derivedPid PID of the derived data node.
     * @param {string} sourcePid PID of the source data node.
     * @returns {Provenance} Updated provenance instance.
     */
    removeWasDerivedFrom(derivedPid, sourcePid) {
      const derived = this.resolveExistingPidNode(
        derivedPid,
        "Derived PID required",
      );
      const source = this.resolveExistingPidNode(
        sourcePid,
        "Source PID required",
      );
      if (!derived || !source) return this;

      return this.mutateGraph(() => {
        GraphMutation.removeStatementsMatching(
          this.resourceMap,
          derived.node,
          this.ns.PROV("wasDerivedFrom"),
          source.node,
        );
      });
    }

    /**
     * Add a generation relationship between a data PID and a local program
     * member. The data PID may be aggregated or external; the program must
     * already be aggregated by the current resource map.
     * @param {string} dataPid PID of the generated data object.
     * @param {string} programPid PID of the aggregated program object.
     * @param {object} [options] Optional execution metadata.
     * @param {string} [options.executionId] Execution identifier to reuse or
     * create.
     * @param {string} [options.agentUri] Agent URI associated with the execution.
     * @returns {Provenance} Updated provenance instance.
     */
    addGeneratedByProgram(dataPid, programPid, options = {}) {
      return ProvenanceExecutionMutation.addExecutionProgramRelationship(this, {
        dataPid,
        programPid,
        options,
        predicate: "wasGeneratedBy",
        dataFromObject: false,
      });
    }

    /**
     * Remove a generation relationship between a data PID and a program member.
     * @param {string} dataPid PID of the generated data object.
     * @param {string} programPid PID of the program object.
     * @param {object} [options] Optional execution selector.
     * @param {string} [options.executionId] Execution identifier used to narrow
     * removal.
     * @returns {Provenance} Updated provenance instance.
     */
    removeGeneratedByProgram(dataPid, programPid, options = {}) {
      return ProvenanceExecutionMutation.removeExecutionProgramRelationship(
        this,
        {
          dataPid,
          programPid,
          options,
          predicate: "wasGeneratedBy",
          dataFromObject: false,
        },
      );
    }

    /**
     * Add a usage relationship between a data PID and a local program member.
     * The data PID may be aggregated or external; the program must already be
     * aggregated by the current resource map.
     * @param {string} dataPid PID of the used data object.
     * @param {string} programPid PID of the aggregated program object.
     * @param {object} [options] Optional execution metadata.
     * @param {string} [options.executionId] Execution identifier to reuse or
     * create.
     * @param {string} [options.agentUri] Agent URI associated with the execution.
     * @returns {Provenance} Updated provenance instance.
     */
    addUsedByProgram(dataPid, programPid, options = {}) {
      return ProvenanceExecutionMutation.addExecutionProgramRelationship(this, {
        dataPid,
        programPid,
        options,
        predicate: "used",
        dataFromObject: true,
      });
    }

    /**
     * Remove a usage relationship between a data PID and a program member.
     * @param {string} dataPid PID of the used data object.
     * @param {string} programPid PID of the program object.
     * @param {object} [options] Optional execution selector.
     * @param {string} [options.executionId] Execution identifier used to narrow
     * removal.
     * @returns {Provenance} Updated provenance instance.
     */
    removeUsedByProgram(dataPid, programPid, options = {}) {
      return ProvenanceExecutionMutation.removeExecutionProgramRelationship(
        this,
        {
          dataPid,
          programPid,
          options,
          predicate: "used",
          dataFromObject: true,
        },
      );
    }

    /**
     * Restore one execution-lineage link from a provenance summary, e.g.
     * <prov:wasInformedBy rdf:resource="urn:uuid:prev-exec"/>. Program lineage
     * is read-only in the public API (see
     * {@link Provenance#getWasInformedByPrograms}); this internal helper
     * exists so ResourceMap builders can round-trip the summaries produced by
     * {@link Provenance#toJSON}. Lineage links involving deleted members are
     * removed by {@link Provenance#removeMemberReferences}.
     * @param {ProgramLineageRelationship} relationship Lineage link to
     * restore.
     * @returns {Provenance} Updated provenance instance.
     * @private
     */
    restoreWasInformedByLink({
      programPid,
      previousProgramPid,
      executionId,
      previousExecutionId,
    } = {}) {
      return this.mutateGraph(() => {
        const normalizedProgramPid = this.resourceMap.requireExistingMemberPid(
          programPid,
          "Program PID required",
        );
        const normalizedPreviousProgramPid =
          this.resourceMap.requireExistingMemberPid(
            previousProgramPid,
            "Previous program PID required",
          );

        const executionNode =
          ProvenanceExecutionMutation.ensureExecutionForProgram(
            this,
            normalizedProgramPid,
            { executionId },
          );
        const previousExecutionNode =
          ProvenanceExecutionMutation.ensureExecutionForProgram(
            this,
            normalizedPreviousProgramPid,
            { executionId: previousExecutionId },
          );

        GraphMutation.addStatementIfMissing(
          this.resourceMap,
          executionNode,
          this.ns.PROV("wasInformedBy"),
          previousExecutionNode,
        );
      });
    }

    /**
     * Remove provenance relationships that reference members being deleted.
     * @param {string|string[]} pids PIDs being removed from the package.
     * @returns {Provenance} Updated provenance instance.
     */
    removeMemberReferences(pids) {
      const normalizedPids = new Set(
        (Array.isArray(pids) ? pids : [pids]).map((pid) =>
          requireNonEmptyString(pid, "PID required"),
        ),
      );
      // Collect removals before mutating so read helpers see a stable graph.
      const removals = this.collectMemberReferenceRemovals(normalizedPids);

      return this.applyMemberReferenceRemovals(removals);
    }

    /**
     * Apply member-reference removals collected before mutation begins.
     * @private
     * @param {object} removals Collected member-reference removals.
     * @returns {Provenance} Updated provenance instance.
     */
    applyMemberReferenceRemovals(removals) {
      const {
        statementsToRemove,
        affectedExecutionNodes,
        affectedExecutionInspections,
      } = removals;
      if (!statementsToRemove.length && !affectedExecutionNodes.length) {
        return this;
      }

      return this.mutateGraph(() => {
        // Apply statement removals first so execution cleanup sees the final
        // post-removal graph shape.
        this.removeCollectedStatements(statementsToRemove);
        ResourceMapCommon.dedupeNodes(affectedExecutionNodes).forEach(
          (executionNode) => {
            ProvenanceExecutionMutation.cleanupExecution(
              this,
              executionNode,
              affectedExecutionInspections.get(
                ResourceMapCommon.nodeKey(executionNode),
              ),
            );
          },
        );
      });
    }

    /**
     * Collect graph removals and cleanup targets for members being deleted.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @returns {{statementsToRemove: object[], affectedExecutionNodes:
     * Array<NamedNode|BlankNode>, affectedExecutionInspections: Map<string,
     * object>}} Collected removal inputs.
     */
    collectMemberReferenceRemovals(normalizedPids) {
      const removals = {
        statementsToRemove: [],
        affectedExecutionNodes: [],
      };

      this.collectWasDerivedFromMemberRemovals(normalizedPids, removals);
      this.collectExecutionProgramMemberRemovals(normalizedPids, removals);
      this.collectWasInformedByMemberRemovals(normalizedPids, removals);
      removals.affectedExecutionInspections = new Map(
        ResourceMapCommon.dedupeNodes(removals.affectedExecutionNodes).map(
          (executionNode) => [
            ResourceMapCommon.nodeKey(executionNode),
            this.getGraphState().getExecutionSummary(executionNode),
          ],
        ),
      );

      return removals;
    }

    /**
     * Collect `prov:wasDerivedFrom` removals involving deleted members.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @param {object} removals Shared removal collection.
     */
    collectWasDerivedFromMemberRemovals(normalizedPids, removals) {
      const graphState = this.getGraphState();
      this.getWasDerivedFromLinks()
        .filter(
          ({ derivedPid, sourcePid }) =>
            normalizedPids.has(derivedPid) || normalizedPids.has(sourcePid),
        )
        .forEach(({ derivedPid, sourcePid }) => {
          const derivedUri = graphState.findNodeUriForPid(derivedPid);
          const sourceUri = graphState.findNodeUriForPid(sourcePid);
          if (derivedUri && sourceUri) {
            removals.statementsToRemove.push({
              subject: rdf.sym(derivedUri),
              predicate: this.ns.PROV("wasDerivedFrom"),
              object: rdf.sym(sourceUri),
            });
          }
        });
    }

    /**
     * Collect generation and usage removals involving deleted members.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @param {object} removals Shared removal collection.
     */
    collectExecutionProgramMemberRemovals(normalizedPids, removals) {
      const graphState = this.getGraphState();
      // If a deleted member is itself a program, any now-orphaned executions
      // associated with that program also need cleanup.
      [
        {
          relationships: this.getGeneratedByPrograms(),
          predicate: "wasGeneratedBy",
          dataFromObject: false,
        },
        {
          relationships: this.getUsedByPrograms(),
          predicate: "used",
          dataFromObject: true,
        },
      ].forEach(({ relationships, predicate, dataFromObject }) => {
        relationships
          .filter(
            ({ dataPid, programPid }) =>
              normalizedPids.has(dataPid) || normalizedPids.has(programPid),
          )
          .forEach(({ dataPid, programPid, executionId }) => {
            const dataUri = graphState.findNodeUriForPid(dataPid);
            if (!dataUri) return;

            const dataNode = rdf.sym(dataUri);
            graphState
              .filterExecutionNodesByIdentifier(
                graphState.getExecutionNodesForProgram(programPid),
                executionId,
              )
              .forEach((executionNode) => {
                removals.affectedExecutionNodes.push(executionNode);
                removals.statementsToRemove.push({
                  subject: dataFromObject ? executionNode : dataNode,
                  predicate: this.ns.PROV(predicate),
                  object: dataFromObject ? dataNode : executionNode,
                });
              });
          });
      });

      normalizedPids.forEach((pid) => {
        removals.affectedExecutionNodes.push(
          ...graphState.getExecutionNodesForProgram(pid),
        );
      });
    }

    /**
     * Collect `prov:wasInformedBy` removals involving deleted members.
     * @private
     * @param {Set<string>} normalizedPids Member PIDs being removed.
     * @param {object} removals Shared removal collection.
     */
    collectWasInformedByMemberRemovals(normalizedPids, removals) {
      const graphState = this.getGraphState();
      this.getWasInformedByPrograms()
        .filter(
          ({ programPid, previousProgramPid }) =>
            normalizedPids.has(programPid) ||
            normalizedPids.has(previousProgramPid),
        )
        .forEach((relationship) => {
          findWasInformedByExecutionPairs(graphState, relationship).forEach(
            ({ executionNode, previousExecutionNode }) => {
              removals.affectedExecutionNodes.push(
                executionNode,
                previousExecutionNode,
              );
              removals.statementsToRemove.push({
                subject: executionNode,
                predicate: this.ns.PROV("wasInformedBy"),
                object: previousExecutionNode,
              });
            },
          );
        });
    }

    /**
     * Remove a collected set of RDF statement patterns once each.
     * @private
     * @param {Array<{subject: *, predicate: *, object: *}>} statements
     * Statement patterns to remove.
     */
    removeCollectedStatements(statements) {
      dedupeBy(statements, ResourceMapCommon.statementKey).forEach(
        ({ subject, predicate, object }) => {
          GraphMutation.removeStatementsMatching(
            this.resourceMap,
            subject,
            predicate,
            object,
          );
        },
      );
    }

    /**
     * Add an explicit Data or Program annotation for a PID. Assertions already
     * implied by a provenance relationship are derived and are not persisted.
     * @param {string} pid PID whose subject node receives the type assertion.
     * @param {string} className PROVONE class name or fully-qualified PROVONE
     * URI.
     * @returns {Provenance} Updated provenance instance.
     */
    addTypeAssertion(pid, className) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      const normalizedClassName = this.getProvoneClassName(className);
      if (!EXPLICIT_TYPE_CLASS_NAMES.has(normalizedClassName)) {
        throw new Error("Only Data and Program type assertions are supported");
      }
      if (this.hasRole(normalizedPid, normalizedClassName)) {
        return this;
      }

      return this.mutateGraph(() => {
        const nodeInfo = this.ensurePidNode(normalizedPid, {
          message: "PID required",
        });
        GraphMutation.addStatementIfMissing(
          this.resourceMap,
          nodeInfo.node,
          this.ns.RDF("type"),
          this.resolveProvoneClassNode(normalizedClassName),
        );
      });
    }

    /**
     * Remove an explicit Data or Program annotation from a PID. Structurally
     * derived role types remain visible until their relationships are removed.
     * @param {string} pid PID whose subject node loses the type assertion.
     * @param {string} className PROVONE class name or fully-qualified PROVONE
     * URI.
     * @returns {Provenance} Updated provenance instance.
     */
    removeTypeAssertion(pid, className) {
      const normalizedClassName = this.getProvoneClassName(className);
      if (!EXPLICIT_TYPE_CLASS_NAMES.has(normalizedClassName)) {
        throw new Error("Only Data and Program type assertions are supported");
      }
      const existingNode = this.resolveExistingPidNode(pid, "PID required");
      if (!existingNode) return this;

      return this.mutateGraph(() => {
        GraphMutation.removeStatementsMatching(
          this.resourceMap,
          existingNode.node,
          this.ns.RDF("type"),
          this.resolveProvoneClassNode(normalizedClassName),
        );
      });
    }

    /**
     * Validate provenance relationships against the currently aggregated
     * members.
     * @returns {object[]} Validation issues.
     */
    validate() {
      return ProvenanceValidation.validateProvenance(this);
    }

    /**
     * Normalize obvious provenance defects that can be repaired without
     * guessing.
     * @param {object} [options] Normalization options.
     * @param {boolean} [options.markDirty] Mark normalization changes unsaved.
     * @returns {Provenance} Updated provenance instance.
     */
    normalize({ markDirty = false } = {}) {
      const graphState = this.getGraphState();
      const executionNodes = graphState.getExecutionNodes();
      const executionInspections = new Map(
        executionNodes.map((executionNode) => [
          ResourceMapCommon.nodeKey(executionNode),
          graphState.getExecutionSummary(executionNode),
        ]),
      );

      this.mutateGraph(
        () => {
          ProvenanceExecutionMutation.normalizeExecutionGraph(
            this,
            executionNodes,
            executionInspections,
          );
        },
        { markDirty },
      );
      return this;
    }

    /**
     * Return the canonical provenance summary used for diffs, tests, and JSON
     * output.
     * @returns {object} Canonical provenance summary object.
     */
    toJSON() {
      return ResourceMapCommon.sortProvenanceSummary({
        wasDerivedFrom: this.getWasDerivedFromLinks(),
        generatedByPrograms: this.getGeneratedByPrograms(),
        usedByPrograms: this.getUsedByPrograms(),
        wasInformedByPrograms: this.getWasInformedByPrograms(),
        typeAssertions: this.getTypeAssertions(),
      });
    }

    /**
     * Resolve a PROVONE class name or URI into the RDF node used in the graph.
     * @private
     * @param {string} className PROVONE local name or fully-qualified URI.
     * @returns {NamedNode} RDF node for the requested class.
     */
    resolveProvoneClassNode(className) {
      const normalizedClassName = normalizeText(className);
      if (!isNonEmptyString(normalizedClassName)) {
        throw new Error("Class required");
      }
      if (normalizedClassName.startsWith(this.ns.PROVONE("").value)) {
        return rdf.sym(normalizedClassName);
      }
      return this.ns.PROVONE(normalizedClassName);
    }

    /**
     * Normalize a PROVONE class input to its local class name.
     * @private
     * @param {string} className PROVONE class name or fully-qualified URI.
     * @returns {string} Local PROVONE class name.
     */
    getProvoneClassName(className) {
      const classNode = this.resolveProvoneClassNode(className);
      return classNode.value.slice(this.ns.PROVONE("").value.length);
    }

    /**
     * Resolve an existing RDF node for a required PID.
     * @private
     * @param {string} pid PID to resolve.
     * @param {string} message Error message used when the PID is invalid.
     * @returns {{pid: string, node: NamedNode}|null} Existing PID node.
     */
    resolveExistingPidNode(pid, message) {
      const normalizedPid = requireNonEmptyString(pid, message);
      const nodeUri = this.getGraphState().findNodeUriForPid(normalizedPid);
      return nodeUri ? { pid: normalizedPid, node: rdf.sym(nodeUri) } : null;
    }

    /**
     * Resolve or create the RDF node for a provenance PID.
     * @private
     * @param {string} pid PID to resolve.
     * @param {object} [options] Resolution options.
     * @param {boolean} [options.requireAggregated] Whether the PID must already
     * be aggregated.
     * @param {string} [options.message] Error message used when the PID is
     * invalid.
     * @returns {{pid: string, uri: string, node: NamedNode}} Resolved node
     * summary.
     */
    ensurePidNode(
      pid,
      { requireAggregated = false, message = "PID required" } = {},
    ) {
      const normalizedPid = requireAggregated
        ? this.resourceMap.requireExistingMemberPid(pid, message)
        : requireNonEmptyString(pid, message);

      // External provenance PIDs, such as URNs or HTTP identifiers that are
      // not aggregated members, are represented directly by their own URI.
      // They still get an identifier statement so future PID lookups can
      // resolve them, but they do not go through the resource map's canonical
      // member URI machinery.
      if (
        !requireAggregated &&
        ResourceMapCommon.isExternalDirectUriPid(normalizedPid) &&
        !this.getGraphState().hasMember(normalizedPid)
      ) {
        GraphMutation.ensureIdentifierForUri(
          this.resourceMap,
          normalizedPid,
          normalizedPid,
        );
        return {
          pid: normalizedPid,
          uri: normalizedPid,
          node: rdf.sym(normalizedPid),
        };
      }

      return this.resourceMap.ensurePidNode(normalizedPid, {
        createIdentifier: true,
        requireAggregated,
        message,
      });
    }

    /**
     * Test whether a PID currently has a PROVONE type assertion.
     * @private
     * @param {string} pid PID whose type assertion is checked.
     * @param {string} className PROVONE class name or URI.
     * @returns {boolean} True when the type is explicit or structurally
     * derived.
     */
    hasTypeAssertion(pid, className) {
      return this.getGraphState().hasTypeAssertion(
        pid,
        this.getProvoneClassName(className),
      );
    }

    /**
     * Collect PIDs that currently play a data role anywhere in provenance.
     * @param {"Data"|"Program"} className PROVONE class name or URI whose role
     * definitions are consulted.
     * @returns {string[]} Resolvable data-role PIDs.
     * @private
     */
    collectRolePids(className) {
      return Array.from(
        this.getGraphState().getRolePidSet(this.getProvoneClassName(className)),
      );
    }

    /**
     * Test whether a PID still has one structural provenance role for the
     * requested PROVONE class.
     * @param {string} pid PID to inspect.
     * @param {string} className PROVONE class name or URI.
     * @returns {boolean} True when the PID still has a matching structural
     * role.
     */
    hasRole(pid, className) {
      return this.getGraphState().hasRole(
        pid,
        this.getProvoneClassName(className),
      );
    }
  }

  return Provenance;
});
