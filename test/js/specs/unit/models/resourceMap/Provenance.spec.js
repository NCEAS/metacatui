define([
  "rdflib",
  "models/resourceMap/GraphMutation",
  "models/ResourceMapSolrProvenanceFields",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, GraphMutation, ResourceMapSolrProvenanceFields, testUtils) => {
  chai.should();
  const { addExecutionScaffold, createBaseResourceMap } = testUtils;

  describe("Provenance", () => {
    it("keeps provenance projections stable until a mutation completes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.live.roles.1",
        memberPids: ["meta.1", "data.1", "source.1", "program.1", "program.2"],
      });

      resourceMap.provenance.addWasDerivedFrom("data.1", "source.1");
      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.live.current.1",
      });
      resourceMap.provenance.addUsedByProgram("source.1", "program.1", {
        executionId: "urn:uuid:exec.live.current.1",
      });
      resourceMap.provenance.restoreWasInformedByLink({
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.live.current.1",
        previousExecutionId: "urn:uuid:exec.live.previous.1",
      });
      resourceMap.provenance.toJSON();
      resourceMap.provenance
        .hasTypeAssertion("data.1", "Data")
        .should.equal(true);

      resourceMap.mutateGraph(() => {
        ["wasDerivedFrom", "wasGeneratedBy", "used", "wasInformedBy"].forEach(
          (predicate) => {
            resourceMap.graph
              .statementsMatching(
                undefined,
                resourceMap.ns.PROV(predicate),
                undefined,
                undefined,
              )
              .forEach((statement) => resourceMap.graph.remove(statement));
          },
        );
        resourceMap.provenance.getWasDerivedFromLinks().should.have.length(1);
        resourceMap.provenance.getGeneratedByPrograms().should.have.length(1);
        resourceMap.provenance.getUsedByPrograms().should.have.length(1);
        resourceMap.provenance.getWasInformedByPrograms().should.have.length(1);
        resourceMap.provenance
          .getTypeAssertions()
          .should.deep.include({ pid: "data.1", className: "Data" });
        resourceMap.provenance
          .hasTypeAssertion("data.1", "Data")
          .should.equal(true);
        resourceMap.provenance
          .collectRolePids("Data")
          .should.have.members(["data.1", "source.1"]);
        resourceMap.provenance.hasRole("data.1", "Data").should.equal(true);
        ResourceMapSolrProvenanceFields.getMemberFieldMap(resourceMap)[
          "data.1"
        ].prov_wasDerivedFrom.should.deep.equal(["source.1"]);
      });

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([]);
    });

    it("removes member references collected before mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.live.member-removal.1",
        memberPids: ["meta.1", "data.1", "source.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const sourceNode = rdf.sym(resourceMap.getNodeUriForPid("source.1"));
      const wasDerivedFrom = resourceMap.ns.PROV("wasDerivedFrom");
      GraphMutation.addStatement(
        resourceMap,
        dataNode,
        wasDerivedFrom,
        sourceNode,
      );

      resourceMap.provenance.removeMemberReferences("source.1");

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
    });

    it("adds, removes, and serializes provenance relationships", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
      });

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.1",
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.1",
      });
      resourceMap.provenance.restoreWasInformedByLink({
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.1",
        previousExecutionId: "urn:uuid:exec.2",
      });
      resourceMap.provenance.addTypeAssertion("program.1", "Program");

      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const programNode = rdf.sym(resourceMap.getNodeUriForPid("program.1"));
      resourceMap.graph
        .statementsMatching(
          dataNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Data"),
        )
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(
          programNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Program"),
        )
        .length.should.equal(0);

      resourceMap.provenance.toJSON().should.deep.equal({
        wasDerivedFrom: [
          {
            derivedPid: "derived.1",
            sourcePid: "data.1",
          },
        ],
        generatedByPrograms: [
          {
            dataPid: "derived.1",
            programPid: "program.1",
            executionId: "urn:uuid:exec.1",
            agentUri: null,
          },
        ],
        usedByPrograms: [
          {
            dataPid: "data.1",
            programPid: "program.1",
            executionId: "urn:uuid:exec.1",
            agentUri: null,
          },
        ],
        wasInformedByPrograms: [
          {
            programPid: "program.1",
            previousProgramPid: "program.2",
            executionId: "urn:uuid:exec.1",
            previousExecutionId: "urn:uuid:exec.2",
          },
        ],
        typeAssertions: [
          {
            pid: "data.1",
            className: "Data",
          },
          {
            pid: "derived.1",
            className: "Data",
          },
          {
            pid: "program.1",
            className: "Program",
          },
          {
            pid: "program.2",
            className: "Program",
          },
          {
            pid: "urn:uuid:exec.1",
            className: "Execution",
          },
          {
            pid: "urn:uuid:exec.2",
            className: "Execution",
          },
        ],
      });

      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");
      resourceMap.provenance.removeGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.removeWasDerivedFrom("derived.1", "data.1");

      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      // Program lineage is read-only in the public API, so the restored link
      // survives the other removals.
      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([
        {
          programPid: "program.1",
          previousProgramPid: "program.2",
          executionId: "urn:uuid:exec.1",
          previousExecutionId: "urn:uuid:exec.2",
        },
      ]);
    });

    it("updates execution scaffolding and field projections when execution-backed provenance is added and changed", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.change.1",
        memberPids: ["meta.1", "input.1", "output.1", "program.1", "program.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "input.1",
          },
        ],
      });
      const firstExecutionNode = rdf.sym("urn:uuid:exec.change.1");
      const secondExecutionNode = rdf.sym("urn:uuid:exec.change.2");

      resourceMap.provenance.addGeneratedByProgram("output.1", "program.1", {
        executionId: firstExecutionNode.value,
      });

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "output.1",
          programPid: "program.1",
          executionId: firstExecutionNode.value,
          agentUri: null,
        },
      ]);
      const firstFieldMap =
        ResourceMapSolrProvenanceFields.getMemberFieldMap(resourceMap);
      firstFieldMap["output.1"].prov_generatedByProgram.should.deep.equal([
        "program.1",
      ]);
      firstFieldMap["output.1"].prov_generatedByExecution.should.deep.equal([
        firstExecutionNode.value,
      ]);
      resourceMap.graph
        .statementsMatching(
          firstExecutionNode,
          resourceMap.ns.PROV("qualifiedAssociation"),
          undefined,
        )
        .length.should.equal(1);
      const firstAssociationNode = resourceMap.graph.statementsMatching(
        firstExecutionNode,
        resourceMap.ns.PROV("qualifiedAssociation"),
        undefined,
      )[0].object;
      resourceMap.graph
        .statementsMatching(
          firstAssociationNode,
          resourceMap.ns.PROV("hadPlan"),
          rdf.sym(resourceMap.getNodeUriForPid("program.1")),
        )
        .length.should.equal(1);

      resourceMap.provenance.removeGeneratedByProgram("output.1", "program.1", {
        executionId: firstExecutionNode.value,
      });
      resourceMap.provenance.addGeneratedByProgram("output.1", "program.2", {
        executionId: secondExecutionNode.value,
      });

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "output.1",
          programPid: "program.2",
          executionId: secondExecutionNode.value,
          agentUri: null,
        },
      ]);
      const secondFieldMap =
        ResourceMapSolrProvenanceFields.getMemberFieldMap(resourceMap);
      secondFieldMap["output.1"].prov_generatedByProgram.should.deep.equal([
        "program.2",
      ]);
      secondFieldMap["output.1"].prov_generatedByExecution.should.deep.equal([
        secondExecutionNode.value,
      ]);
      resourceMap.graph
        .statementsMatching(firstExecutionNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, firstExecutionNode)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(
          secondExecutionNode,
          resourceMap.ns.PROV("qualifiedAssociation"),
          undefined,
        )
        .length.should.equal(1);
      const secondAssociationNode = resourceMap.graph.statementsMatching(
        secondExecutionNode,
        resourceMap.ns.PROV("qualifiedAssociation"),
        undefined,
      )[0].object;
      resourceMap.graph
        .statementsMatching(
          secondAssociationNode,
          resourceMap.ns.PROV("hadPlan"),
          rdf.sym(resourceMap.getNodeUriForPid("program.2")),
        )
        .length.should.equal(1);
    });

    it("supports external data PIDs without turning them into aggregated members", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.external.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });

      resourceMap.provenance.addWasDerivedFrom(
        "derived.1",
        "external.source.1",
      );
      resourceMap.provenance.addWasDerivedFrom("external.derived.1", "data.1");
      resourceMap.provenance.addGeneratedByProgram(
        "external.derived.1",
        "program.1",
        {
          executionId: "urn:uuid:exec.external.1",
        },
      );
      resourceMap.provenance.addUsedByProgram(
        "external.source.1",
        "program.1",
        {
          executionId: "urn:uuid:exec.external.1",
        },
      );

      resourceMap
        .getMemberPids()
        .should.have.members(["meta.1", "data.1", "derived.1", "program.1"]);
      resourceMap.getMemberPids().should.not.include("external.source.1");
      resourceMap.getMemberPids().should.not.include("external.derived.1");
      chai.expect(resourceMap.getMember("external.source.1")).to.equal(null);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([
        {
          derivedPid: "derived.1",
          sourcePid: "external.source.1",
        },
        {
          derivedPid: "external.derived.1",
          sourcePid: "data.1",
        },
      ]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "external.derived.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.external.1",
          agentUri: null,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "external.source.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.external.1",
          agentUri: null,
        },
      ]);

      const externalSourceNode = rdf.sym(
        resourceMap.getNodeUriForPid("external.source.1"),
      );
      const externalDerivedNode = rdf.sym(
        resourceMap.getNodeUriForPid("external.derived.1"),
      );
      resourceMap.graph
        .statementsMatching(
          externalSourceNode,
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.source.1"]);
      resourceMap.graph
        .statementsMatching(
          externalDerivedNode,
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.derived.1"]);
      resourceMap.graph
        .statementsMatching(
          externalSourceNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Data"),
        )
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(
          externalDerivedNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Data"),
        )
        .length.should.equal(0);
      resourceMap.provenance
        .hasTypeAssertion("external.source.1", "Data")
        .should.equal(true);
      resourceMap.provenance
        .hasTypeAssertion("external.derived.1", "Data")
        .should.equal(true);
    });

    it("removes only execution-scoped provenance relationships when execution identifiers are provided", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.execution.removal.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
      });

      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.generated.1",
      });
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.generated.2",
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.used.1",
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.used.2",
      });

      resourceMap.provenance.removeGeneratedByProgram(
        "derived.1",
        "program.1",
        {
          executionId: "urn:uuid:exec.generated.1",
        },
      );
      resourceMap.provenance.removeUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.used.1",
      });

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "derived.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.generated.2",
          agentUri: null,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.used.2",
          agentUri: null,
        },
      ]);
    });

    it("round-trips the provenance snapshot and field projection through resource map XML", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.roundtrip.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.roundtrip.1",
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.roundtrip.1",
      });
      resourceMap.provenance.restoreWasInformedByLink({
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.roundtrip.1",
        previousExecutionId: "urn:uuid:exec.roundtrip.2",
      });

      const expectedSnapshot = resourceMap.provenance.toJSON();
      const expectedFieldMap =
        ResourceMapSolrProvenanceFields.getMemberFieldMap(resourceMap);
      const xml = resourceMap.serialize();
      const reparsed = resourceMap.constructor.fromXml(
        "resource_map_urn:uuid:prov.roundtrip.1",
        xml,
      );

      reparsed.provenance.toJSON().should.deep.equal(expectedSnapshot);
      ResourceMapSolrProvenanceFields.getMemberFieldMap(
        reparsed,
      ).should.deep.equal(expectedFieldMap);
    });

    it("round-trips external data provenance without aggregating external nodes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.external.roundtrip.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });

      resourceMap.provenance.addWasDerivedFrom(
        "derived.1",
        "external.source.1",
      );
      resourceMap.provenance.addGeneratedByProgram(
        "external.derived.1",
        "program.1",
        {
          executionId: "urn:uuid:exec.external.roundtrip.1",
        },
      );
      resourceMap.provenance.addUsedByProgram(
        "external.source.1",
        "program.1",
        {
          executionId: "urn:uuid:exec.external.roundtrip.1",
        },
      );

      const expectedSnapshot = resourceMap.provenance.toJSON();
      const xml = resourceMap.serialize();
      const reparsed = resourceMap.constructor.fromXml(
        "resource_map_urn:uuid:prov.external.roundtrip.1",
        xml,
      );

      reparsed.provenance.toJSON().should.deep.equal(expectedSnapshot);
      reparsed
        .getMemberPids()
        .should.have.members(["meta.1", "data.1", "derived.1", "program.1"]);
      reparsed.getMemberPids().should.not.include("external.source.1");
      reparsed.getMemberPids().should.not.include("external.derived.1");
      reparsed.graph
        .statementsMatching(
          rdf.sym(reparsed.getNodeUriForPid("external.source.1")),
          reparsed.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.source.1"]);
      reparsed.graph
        .statementsMatching(
          rdf.sym(reparsed.getNodeUriForPid("external.derived.1")),
          reparsed.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.derived.1"]);
    });

    [
      {
        label: "URN",
        pid: "urn:uuid:external.data.direct.1",
      },
      {
        label: "HTTP",
        pid: "https://example.org/data/external.direct.1",
      },
    ].forEach(({ label, pid }) => {
      it(`preserves direct ${label} external data PIDs through import repair`, () => {
        const resourceMap = createBaseResourceMap({
          resourceMapPid: `resource_map_urn:uuid:prov.external.direct.${label}`,
          memberPids: ["meta.1", "data.1"],
        });
        const directNode = rdf.sym(pid);
        const resolveNode = rdf.sym(resourceMap.pidToUri(pid));

        resourceMap.provenance.addWasDerivedFrom("data.1", pid);
        GraphMutation.addStatementIfMissing(
          resourceMap,
          resolveNode,
          resourceMap.ns.DCTERMS("identifier"),
          rdf.literal(pid, undefined, resourceMap.ns.XSD("string")),
        );
        GraphMutation.addStatementIfMissing(
          resourceMap,
          resolveNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Data"),
        );

        resourceMap.getNodeUriForPid(pid).should.equal(pid);
        resourceMap.normalize();

        resourceMap.getNodeUriForPid(pid).should.equal(pid);
        resourceMap.graph
          .statementsMatching(resolveNode, undefined, undefined)
          .length.should.be.greaterThan(0);

        const xml = resourceMap.serialize();
        const reparsed = resourceMap.constructor.fromXml(
          resourceMap.resourceMapPid,
          xml,
        );

        reparsed.getNodeUriForPid(pid).should.equal(pid);
        reparsed.graph
          .statementsMatching(directNode, undefined, undefined)
          .length.should.be.greaterThan(0);
        reparsed.graph
          .statementsMatching(resolveNode, undefined, undefined)
          .should.deep.equal([]);
        reparsed.provenance.getWasDerivedFromLinks().should.deep.equal([
          {
            derivedPid: "data.1",
            sourcePid: pid,
          },
        ]);
        reparsed.getMemberPids().should.not.include(pid);
      });
    });

    it("preserves malformed literal provenance endpoints while excluding them from normalized views", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.literal.roundtrip.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });
      const derivedNode = rdf.sym(resourceMap.getNodeUriForPid("derived.1"));
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.literal.roundtrip.1",
        programPid: "program.1",
      });

      GraphMutation.addStatementIfMissing(
        resourceMap,
        derivedNode,
        resourceMap.ns.PROV("wasDerivedFrom"),
        rdf.literal("data.1", undefined, resourceMap.ns.XSD("string")),
      );
      GraphMutation.addStatementIfMissing(
        resourceMap,
        executionNode,
        resourceMap.ns.PROV("used"),
        rdf.literal("data.1", undefined, resourceMap.ns.XSD("string")),
      );
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);

      const xml = resourceMap.serialize();
      const reparsed = resourceMap.constructor.fromXml(
        "resource_map_urn:uuid:prov.literal.roundtrip.1",
        xml,
      );

      reparsed.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      reparsed.provenance.getUsedByPrograms().should.deep.equal([]);
      reparsed.graph
        .statementsMatching(
          derivedNode,
          reparsed.ns.PROV("wasDerivedFrom"),
          undefined,
        )[0]
        .object.termType.should.equal("Literal");
      reparsed.graph
        .statementsMatching(
          derivedNode,
          reparsed.ns.PROV("wasDerivedFrom"),
          undefined,
        )[0]
        .object.value.should.equal("data.1");
      reparsed.graph
        .statementsMatching(
          executionNode,
          reparsed.ns.PROV("used"),
          undefined,
        )[0]
        .object.termType.should.equal("Literal");
      reparsed.graph
        .statementsMatching(
          executionNode,
          reparsed.ns.PROV("used"),
          undefined,
        )[0]
        .object.value.should.equal("data.1");
    });

    it("preserves explicit type assertions on otherwise unconnected members across snapshot recreation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.types.member.1",
        memberPids: ["meta.1", "program.1"],
        documentationLinks: [],
      });

      resourceMap.provenance.addTypeAssertion("program.1", "Program");

      const snapshot = resourceMap.provenance.toJSON();
      const recreated = resourceMap.constructor.create({
        resourceMapPid: "resource_map_urn:uuid:prov.types.member.2",
        memberPids: ["meta.1", "program.1"],
        documentationLinks: [],
        provenance: snapshot,
      });

      recreated.provenance.toJSON().should.deep.equal(snapshot);
      recreated.provenance.getTypeAssertions().should.deep.equal([
        {
          pid: "program.1",
          className: "Program",
        },
      ]);

      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        resourceMap.serialize({ validate: false }),
      );
      const programNode = rdf.sym(reparsed.getNodeUriForPid("program.1"));
      reparsed.graph
        .statementsMatching(
          programNode,
          reparsed.ns.RDF("type"),
          reparsed.ns.PROVONE("Program"),
        )
        .length.should.equal(1);
      reparsed.provenance
        .hasTypeAssertion("program.1", "Program")
        .should.equal(true);
    });

    it("does not duplicate inferred classes when replaying explicit type assertions", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.types.dedupe.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
        documentationLinks: [],
      });

      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.types.dedupe.1",
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.types.dedupe.1",
      });
      resourceMap.provenance.addTypeAssertion("program.1", "Program");
      resourceMap.provenance.addTypeAssertion("data.1", "Data");

      const snapshot = resourceMap.provenance.toJSON();
      const recreated = resourceMap.constructor.create({
        resourceMapPid: "resource_map_urn:uuid:prov.types.dedupe.2",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
        documentationLinks: [],
        provenance: snapshot,
      });
      const recreatedAssertions = recreated.provenance.toJSON().typeAssertions;

      recreated.provenance.toJSON().should.deep.equal(snapshot);
      recreatedAssertions
        .filter(
          (assertion) =>
            assertion.pid === "program.1" && assertion.className === "Program",
        )
        .length.should.equal(1);
      recreatedAssertions
        .filter(
          (assertion) =>
            assertion.pid === "data.1" && assertion.className === "Data",
        )
        .length.should.equal(1);
    });

    it("removes derived Program and Data types when the last supporting relationship is deleted", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.generated.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.generated.cleanup.1",
      });
      resourceMap.provenance.removeUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.generated.cleanup.1",
      });

      resourceMap.provenance.getTypeAssertions().should.deep.equal([]);
    });

    it("materializes derived role types during serialization and re-derives them after parsing", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.derived.types.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.derived.types.1",
      });

      const xml = resourceMap.serialize({ validate: false });
      xml.should.contain(
        "http://purl.dataone.org/provone/2015/01/15/ontology#Data",
      );
      xml.should.contain(
        "http://purl.dataone.org/provone/2015/01/15/ontology#Program",
      );

      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        xml,
      );
      const dataNode = rdf.sym(reparsed.getNodeUriForPid("data.1"));
      const programNode = rdf.sym(reparsed.getNodeUriForPid("program.1"));

      reparsed.graph
        .statementsMatching(
          dataNode,
          reparsed.ns.RDF("type"),
          reparsed.ns.PROVONE("Data"),
        )
        .length.should.equal(0);
      reparsed.graph
        .statementsMatching(
          programNode,
          reparsed.ns.RDF("type"),
          reparsed.ns.PROVONE("Program"),
        )
        .length.should.equal(0);
      reparsed.provenance
        .hasTypeAssertion("data.1", "Data")
        .should.equal(true);
      reparsed.provenance
        .hasTypeAssertion("program.1", "Program")
        .should.equal(true);
    });

    it("serializes one type triple when an explicit assertion overlaps a derived role", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.types.overlap.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      // The explicit assertion persists a type triple; the later usage link
      // derives the same Data/Program roles. Serialization must not emit the
      // triple twice.
      resourceMap.provenance.addTypeAssertion("data.1", "Data");
      resourceMap.provenance.addTypeAssertion("program.1", "Program");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.types.overlap.1",
      });

      const xml = resourceMap.serialize({ validate: false });
      (xml.match(/ontology#Data/g) || []).length.should.equal(1);
      (xml.match(/ontology#Program/g) || []).length.should.equal(1);
    });

    it("removes orphan execution scaffolding when the last execution-backed relationship is deleted", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.execution.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });
      const executionId = "urn:uuid:exec.cleanup.relationship.1";

      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId,
      });

      const executionNode = rdf.sym(executionId);
      const associationNode = resourceMap.graph.statementsMatching(
        executionNode,
        resourceMap.ns.PROV("qualifiedAssociation"),
        undefined,
      )[0].object;

      resourceMap.provenance.removeUsedByProgram("data.1", "program.1", {
        executionId,
      });

      resourceMap.graph
        .statementsMatching(executionNode, undefined, undefined, undefined)
        .should.deep.equal([]);
      resourceMap.graph
        .statementsMatching(undefined, undefined, executionNode, undefined)
        .should.deep.equal([]);
      resourceMap.graph
        .statementsMatching(associationNode, undefined, undefined, undefined)
        .should.deep.equal([]);
      resourceMap.graph
        .statementsMatching(undefined, undefined, associationNode, undefined)
        .should.deep.equal([]);
    });

    it("preserves explicit Program and Data types when related relationships are deleted", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.explicit.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      resourceMap.provenance.addTypeAssertion("data.1", "Data");
      resourceMap.provenance.addTypeAssertion("program.1", "Program");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.explicit.cleanup.1",
      });
      resourceMap.provenance.removeUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.explicit.cleanup.1",
      });

      resourceMap.provenance.getTypeAssertions().should.deep.equal([
        {
          pid: "data.1",
          className: "Data",
        },
        {
          pid: "program.1",
          className: "Program",
        },
      ]);
    });

    it("ignores standalone Execution assertions when recreating snapshots", () => {
      const snapshot = {
        wasDerivedFrom: [],
        generatedByPrograms: [],
        usedByPrograms: [],
        wasInformedByPrograms: [],
        typeAssertions: [
          {
            pid: "urn:uuid:exec.snapshot.1",
            className: "Execution",
          },
        ],
      };
      const recreated = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.types.execution.1",
        memberPids: ["meta.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "meta.1",
          },
        ],
        provenance: snapshot,
      });
      chai
        .expect(
          recreated.getGraphState().findNodeUriForPid("urn:uuid:exec.snapshot.1"),
        )
        .to.equal(null);
    });

    it("rejects standalone Execution type assertion edits", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.type.cleanup.1",
        memberPids: ["meta.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "meta.1",
          },
        ],
      });
      const externalExecutionPid = "urn:uuid:exec.type.cleanup.1";

      chai
        .expect(() =>
          resourceMap.provenance.addTypeAssertion(
            externalExecutionPid,
            "Execution",
          ),
        )
        .to.throw("Only Data and Program type assertions are supported");
      chai
        .expect(() =>
          resourceMap.provenance.removeTypeAssertion(
            externalExecutionPid,
            "Execution",
          ),
        )
        .to.throw("Only Data and Program type assertions are supported");
    });

    it("removes execution graphs when the deleted member was the only program on them", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.program.cleanup.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
      });
      const programNode = rdf.sym(resourceMap.getNodeUriForPid("program.1"));
      const executionNode = rdf.sym("urn:uuid:exec.program.cleanup.1");
      const previousExecutionNode = rdf.sym("urn:uuid:exec.program.cleanup.2");

      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: executionNode.value,
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: executionNode.value,
      });
      resourceMap.provenance.restoreWasInformedByLink({
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: executionNode.value,
        previousExecutionId: previousExecutionNode.value,
      });

      resourceMap.removeMember("program.1");

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([]);
      resourceMap.graph
        .statementsMatching(programNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, programNode)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(executionNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, executionNode)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(previousExecutionNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, previousExecutionNode)
        .length.should.equal(0);
    });

    it("removes only the lineage links that involve a deleted program", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.lineage.partial.1",
        memberPids: ["meta.1", "program.1", "program.2", "program.3"],
      });

      resourceMap.provenance.restoreWasInformedByLink({
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.lineage.partial.1",
        previousExecutionId: "urn:uuid:exec.lineage.partial.2",
      });
      resourceMap.provenance.restoreWasInformedByLink({
        programPid: "program.1",
        previousProgramPid: "program.3",
        executionId: "urn:uuid:exec.lineage.partial.1",
        previousExecutionId: "urn:uuid:exec.lineage.partial.3",
      });

      resourceMap.provenance.removeMemberReferences("program.2");

      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([
        {
          programPid: "program.1",
          previousProgramPid: "program.3",
          executionId: "urn:uuid:exec.lineage.partial.1",
          previousExecutionId: "urn:uuid:exec.lineage.partial.3",
        },
      ]);
      resourceMap.graph
        .statementsMatching(
          rdf.sym("urn:uuid:exec.lineage.partial.2"),
          undefined,
          undefined,
        )
        .should.deep.equal([]);
    });

    it("removes deleted data references while preserving unrelated provenance", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.data.cleanup.1",
        memberPids: ["meta.1", "data.1", "data.2", "derived.1", "program.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
          {
            metadataPid: "meta.1",
            dataPid: "derived.1",
          },
        ],
      });
      const removedDataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.data.cleanup.1",
      });
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.data.cleanup.2",
      });
      resourceMap.provenance.addUsedByProgram("data.2", "program.1", {
        executionId: "urn:uuid:exec.data.cleanup.3",
      });

      resourceMap.removeMember("data.1");

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "derived.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.data.cleanup.2",
          agentUri: null,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.2",
          programPid: "program.1",
          executionId: "urn:uuid:exec.data.cleanup.3",
          agentUri: null,
        },
      ]);
      resourceMap.graph
        .statementsMatching(removedDataNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, removedDataNode)
        .length.should.equal(0);
    });
  });
});
