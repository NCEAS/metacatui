define([
  "/test/js/specs/shared/clean-state.js",
  "rdflib",
  "uuid",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/ProvenanceExecutionMutation",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (
  cleanState,
  rdf,
  uuid,
  GraphMutation,
  ProvenanceExecutionMutation,
  testUtils,
) => {
  const should = chai.should();
  const expect = chai.expect;
  const { addExecutionScaffold, createBaseResourceMap } = testUtils;

  const state = cleanState(() => {
    const sandbox = sinon.createSandbox();
    return { sandbox };
  }, beforeEach);

  afterEach(() => {
    state.sandbox.restore();
  });

  describe("ProvenanceExecutionMutation", () => {
    it("reuses the same execution for the same program and execution identifier", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.reuse.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionId = "urn:uuid:exec.reuse.same.1";

      const firstExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.1",
          { executionId },
        );
      const reusedExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.1",
          { executionId },
        );
      const associationNode = resourceMap.graph.statementsMatching(
        firstExecutionNode,
        resourceMap.ns.PROV("qualifiedAssociation"),
        undefined,
      )[0].object;

      reusedExecutionNode.value.should.equal(firstExecutionNode.value);
      resourceMap.graph
        .statementsMatching(
          firstExecutionNode,
          resourceMap.ns.PROV("qualifiedAssociation"),
          undefined,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          associationNode,
          resourceMap.ns.PROV("hadPlan"),
          undefined,
        )
        .length.should.equal(1);
      resourceMap
        .getGraphState()
        .getExecutionSummary(firstExecutionNode)
        .programs.should.deep.equal([
          {
            programPid: "program.1",
            agentUri: null,
          },
        ]);
    });

    it("reuses an identified blank-node execution during a provenance mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.reuse.blank.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionId = "urn:uuid:exec.reuse.blank.1";
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId,
        executionNode: rdf.blankNode(),
        programPid: "program.1",
      });

      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1", {
        executionId,
      });

      resourceMap
        .getGraphState()
        .getExecutionNodesForProgram("program.1")
        .should.deep.equal([executionNode]);
      resourceMap.graph
        .statementsMatching(
          rdf.sym(executionId),
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Execution"),
        )
        .should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "program.1",
          executionId,
          agentUri: null,
        },
      ]);
    });

    it("ignores identifier matches on non-execution nodes and creates a new execution", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.blank.collision.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionId = "urn:uuid:exec.blank.collision.1";
      const { executionNode: nonExecutionNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId,
          executionNode: rdf.blankNode(),
          typed: false,
        },
      );

      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1", {
        executionId,
      });

      // The non-execution identifier match is not reused; a new named
      // execution is created.
      resourceMap.graph
        .statementsMatching(
          rdf.sym(executionId),
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Execution"),
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(nonExecutionNode, undefined, undefined)
        .length.should.equal(1);
    });

    it("does not create execution RDF when the program is not aggregated", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.invalid.program.1",
        memberPids: ["meta.1", "data.1"],
      });
      const executionId = "urn:uuid:exec.invalid.program.1";

      expect(() =>
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "missing-program.1",
          { executionId },
        ),
      ).to.throw("Program not aggregated");

      resourceMap.graph
        .statementsMatching(rdf.sym(executionId), undefined, undefined)
        .should.deep.equal([]);
    });

    it("adds a missing plan to an existing association without disturbing its agent", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.reuse.association.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionId = "urn:uuid:exec.reuse.association.1";
      const agentNode = rdf.sym("https://orcid.org/0000-0000-0000-0012");
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId,
          agentUri: agentNode.value,
        },
      );

      const reusedExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.1",
          { executionId },
        );

      reusedExecutionNode.value.should.equal(executionNode.value);
      resourceMap.graph
        .statementsMatching(
          executionNode,
          resourceMap.ns.PROV("qualifiedAssociation"),
          undefined,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          associationNode,
          resourceMap.ns.PROV("hadPlan"),
          rdf.sym(resourceMap.getNodeUriForPid("program.1")),
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          associationNode,
          resourceMap.ns.PROV("agent"),
          agentNode,
        )
        .length.should.equal(1);
    });

    it("reuses an execution by identifier without replacing its existing plan", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.reuse.other.program.1",
        memberPids: ["meta.1", "data.1", "program.1", "program.2"],
      });
      const executionId = "urn:uuid:exec.reuse.other.program.1";

      const firstExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.1",
          { executionId },
        );
      const reusedExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.2",
          { executionId },
        );

      // Reuse by explicit identifier is the caller's choice: the execution's
      // existing plan is kept rather than adding a second plan.
      reusedExecutionNode.value.should.equal(firstExecutionNode.value);
      resourceMap
        .getGraphState()
        .getExecutionSummary(firstExecutionNode)
        .programPids.should.deep.equal(["program.1"]);
    });

    it("reuses the first execution when a program has multiple executions and no executionId is provided", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.ambiguous.program.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });

      ProvenanceExecutionMutation.ensureExecutionForProgram(
        resourceMap.provenance,
        "program.1",
        {
          executionId: "urn:uuid:exec.ambiguous.program.1.a",
        },
      );
      ProvenanceExecutionMutation.ensureExecutionForProgram(
        resourceMap.provenance,
        "program.1",
        {
          executionId: "urn:uuid:exec.ambiguous.program.1.b",
        },
      );

      const reusedExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.1",
        );

      const programExecutionNodes = resourceMap
        .getGraphState()
        .getExecutionNodesForProgram("program.1");
      programExecutionNodes.length.should.equal(2);
      reusedExecutionNode.value.should.equal(programExecutionNodes[0].value);
    });

    it("reuses an execution with multiple associations and reports it through validation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.multiple.associations.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionId = "urn:uuid:exec.multiple.associations.1";
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId,
        programPid: "program.1",
      });
      addExecutionScaffold(resourceMap, {
        executionId,
        associationNode: rdf.blankNode(),
        programPid: "program.1",
      });

      const reusedExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.1",
          { executionId },
        );

      reusedExecutionNode.value.should.equal(executionNode.value);
      resourceMap.graph
        .statementsMatching(
          executionNode,
          resourceMap.ns.PROV("qualifiedAssociation"),
          undefined,
        )
        .length.should.equal(2);
    });

    it("reuses an execution whose association has multiple plans and reports it through validation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.multiple.plans.1",
        memberPids: ["meta.1", "data.1", "program.1", "program.2"],
      });
      const executionId = "urn:uuid:exec.multiple.plans.1";
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId,
          programPid: "program.1",
        },
      );
      addExecutionScaffold(resourceMap, {
        executionId,
        associationNode,
        programPid: "program.2",
      });

      const reusedExecutionNode =
        ProvenanceExecutionMutation.ensureExecutionForProgram(
          resourceMap.provenance,
          "program.1",
          { executionId },
        );

      reusedExecutionNode.value.should.equal(executionNode.value);
      resourceMap.graph
        .statementsMatching(
          associationNode,
          resourceMap.ns.PROV("hadPlan"),
          undefined,
        )
        .length.should.equal(2);
    });

    it("cleans up orphaned executions when the final execution-program relationship is removed", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });

      state.sandbox.stub(uuid, "v4").returns("cleanup-exec-id");

      ProvenanceExecutionMutation.addExecutionProgramRelationship(
        resourceMap.provenance,
        {
          dataPid: "data.1",
          programPid: "program.1",
          predicate: "used",
          dataFromObject: true,
        },
      );

      const executionNode = resourceMap
        .getGraphState()
        .getExecutionNodesForProgram("program.1")[0];
      should.exist(executionNode);

      ProvenanceExecutionMutation.removeExecutionProgramRelationship(
        resourceMap.provenance,
        {
          dataPid: "data.1",
          programPid: "program.1",
          predicate: "used",
          dataFromObject: true,
        },
      );

      resourceMap
        .getGraphState()
        .getExecutionNodesForProgram("program.1")
        .should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.graph
        .statementsMatching(
          executionNode,
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .length.should.equal(0);
    });

    it("does not clean unrelated executions for the same program", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.cleanup.scope.1",
        memberPids: ["meta.1", "data.1", "data.2", "program.1"],
      });
      const {
        executionNode: unrelatedExecution,
        associationNode: unrelatedAssociation,
      } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.cleanup.unrelated.1",
        programPid: "program.1",
      });
      resourceMap.provenance.addUsedByProgram("data.2", "program.1", {
        executionId: "urn:uuid:exec.cleanup.target.1",
      });

      resourceMap.provenance.removeUsedByProgram("data.2", "program.1");

      resourceMap.graph
        .statementsMatching(unrelatedExecution, undefined, undefined)
        .length.should.be.greaterThan(0);
      resourceMap.graph
        .statementsMatching(
          unrelatedExecution,
          resourceMap.ns.PROV("qualifiedAssociation"),
          unrelatedAssociation,
        )
        .length.should.equal(1);
    });

    it("removes pre-existing execution scaffolding after its last relationship", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.cleanup.identifier.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.cleanup.identifier.1",
        programPid: "program.1",
        typed: false,
      });

      GraphMutation.addStatementIfMissing(
        resourceMap,
        executionNode,
        resourceMap.ns.PROV("used"),
        dataNode,
      );

      resourceMap.provenance.normalize();
      resourceMap.provenance.removeUsedByProgram("data.1", "program.1", {
        executionId: executionNode.value,
      });

      resourceMap.graph
        .statementsMatching(executionNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, executionNode)
        .length.should.equal(0);
    });

    it("removes standalone execution association metadata", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.explicit.association.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.explicit.association.1",
          programPid: "program.1",
          agentUri: "https://orcid.org/0000-0000-0000-0011",
        },
      );

      ProvenanceExecutionMutation.cleanupExecution(
        resourceMap.provenance,
        executionNode,
      );

      resourceMap.graph
        .statementsMatching(executionNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(associationNode, undefined, undefined)
        .length.should.equal(0);
    });

    it("leaves shared associations of parsed executions untouched", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.shared.association.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const programNode = rdf.sym(resourceMap.getNodeUriForPid("program.1"));
      const agentNode = rdf.sym("https://orcid.org/0000-0000-0000-0012");
      const { executionNode: orphanExecution, associationNode } =
        addExecutionScaffold(resourceMap, {
          executionId: "urn:uuid:exec.shared.orphan.1",
          programPid: "program.1",
          agentUri: agentNode.value,
        });
      const { executionNode: activeExecution } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.shared.active.1",
          associationNode,
          identified: false,
        },
      );

      GraphMutation.addStatementIfMissing(
        resourceMap,
        activeExecution,
        resourceMap.ns.PROV("used"),
        dataNode,
      );

      ProvenanceExecutionMutation.cleanupExecution(
        resourceMap.provenance,
        orphanExecution,
      );

      resourceMap.graph
        .statementsMatching(
          associationNode,
          resourceMap.ns.PROV("hadPlan"),
          programNode,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          associationNode,
          resourceMap.ns.PROV("agent"),
          agentNode,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          activeExecution,
          resourceMap.ns.PROV("qualifiedAssociation"),
          associationNode,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          orphanExecution,
          resourceMap.ns.PROV("qualifiedAssociation"),
          associationNode,
        )
        .length.should.equal(0);
    });
  });
});
