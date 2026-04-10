define(
  [
    "rdflib",
    "models/resourceMap/ResourceMapGraph",
    "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
  ],
  (rdf, ResourceMapGraph, testUtils) => {
    chai.should();
    const { createBaseResourceMap } = testUtils;

    describe("Provenance", () => {
      it("adds, removes, and serializes provenance relationships", () => {
        const resourceMap = createBaseResourceMap({
          resourceMapPid: "resource_map_urn:uuid:prov.1",
          memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
        });

        resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
        resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
          executionId: "urn:uuid:exec.1",
          agentUri: "https://orcid.org/0000-0000-0000-0001",
        });
        resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
          executionId: "urn:uuid:exec.1",
          agentUri: "https://orcid.org/0000-0000-0000-0001",
        });
        resourceMap.provenance.addWasInformedByProgram(
          "program.1",
          "program.2",
          {
            executionId: "urn:uuid:exec.1",
            previousExecutionId: "urn:uuid:exec.2",
          },
        );
        resourceMap.provenance.addTypeAssertion("program.1", "Program");

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
              agentUri: "https://orcid.org/0000-0000-0000-0001",
            },
          ],
          usedByPrograms: [
            {
              dataPid: "data.1",
              programPid: "program.1",
              executionId: "urn:uuid:exec.1",
              agentUri: "https://orcid.org/0000-0000-0000-0001",
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
        resourceMap.provenance.removeWasInformedByProgram(
          "program.1",
          "program.2",
        );
        resourceMap.provenance.removeWasDerivedFrom("derived.1", "data.1");

        resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
        resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
        resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([]);
        resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
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
          agentUri: "https://orcid.org/0000-0000-0000-1111",
        });

        resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
          {
            dataPid: "output.1",
            programPid: "program.1",
            executionId: firstExecutionNode.value,
            agentUri: "https://orcid.org/0000-0000-0000-1111",
          },
        ]);
        resourceMap.provenance.getMemberFieldMap()["output.1"]
          .prov_generatedByProgram.should.deep.equal(["program.1"]);
        resourceMap.provenance.getMemberFieldMap()["output.1"]
          .prov_generatedByExecution.should.deep.equal([firstExecutionNode.value]);
        resourceMap.provenance.getMemberFieldMap()["output.1"]
          .prov_generatedByUser.should.deep.equal([
            "https://orcid.org/0000-0000-0000-1111",
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
        resourceMap.graph
          .statementsMatching(
            firstAssociationNode,
            resourceMap.ns.PROV("agent"),
            rdf.sym("https://orcid.org/0000-0000-0000-1111"),
          )
          .length.should.equal(1);

        resourceMap.provenance.removeGeneratedByProgram("output.1", "program.1", {
          executionId: firstExecutionNode.value,
        });
        resourceMap.provenance.addGeneratedByProgram("output.1", "program.2", {
          executionId: secondExecutionNode.value,
          agentUri: "https://orcid.org/0000-0000-0000-2222",
        });

        resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
          {
            dataPid: "output.1",
            programPid: "program.2",
            executionId: secondExecutionNode.value,
            agentUri: "https://orcid.org/0000-0000-0000-2222",
          },
        ]);
        resourceMap.provenance.getMemberFieldMap()["output.1"]
          .prov_generatedByProgram.should.deep.equal(["program.2"]);
        resourceMap.provenance.getMemberFieldMap()["output.1"]
          .prov_generatedByExecution.should.deep.equal([secondExecutionNode.value]);
        resourceMap.provenance.getMemberFieldMap()["output.1"]
          .prov_generatedByUser.should.deep.equal([
            "https://orcid.org/0000-0000-0000-2222",
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
        resourceMap.graph
          .statementsMatching(
            secondAssociationNode,
            resourceMap.ns.PROV("agent"),
            rdf.sym("https://orcid.org/0000-0000-0000-2222"),
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
        resourceMap.provenance.addWasDerivedFrom(
          "external.derived.1",
          "data.1",
        );
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

        ResourceMapGraph.collectMemberPids(resourceMap).should.have.members([
          "meta.1",
          "data.1",
          "derived.1",
          "program.1",
        ]);
        ResourceMapGraph.collectMemberPids(resourceMap).should.not.include(
          "external.source.1",
        );
        ResourceMapGraph.collectMemberPids(resourceMap).should.not.include(
          "external.derived.1",
        );
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
          .length.should.equal(1);
        resourceMap.graph
          .statementsMatching(
            externalDerivedNode,
            resourceMap.ns.RDF("type"),
            resourceMap.ns.PROVONE("Data"),
          )
          .length.should.equal(1);
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
        resourceMap.provenance.addWasInformedByProgram("program.1", "program.2", {
          executionId: "urn:uuid:exec.informed.current.1",
          previousExecutionId: "urn:uuid:exec.informed.previous.1",
        });
        resourceMap.provenance.addWasInformedByProgram("program.1", "program.2", {
          executionId: "urn:uuid:exec.informed.current.2",
          previousExecutionId: "urn:uuid:exec.informed.previous.2",
        });

        resourceMap.provenance.removeGeneratedByProgram("derived.1", "program.1", {
          executionId: "urn:uuid:exec.generated.1",
        });
        resourceMap.provenance.removeUsedByProgram("data.1", "program.1", {
          executionId: "urn:uuid:exec.used.1",
        });
        resourceMap.provenance.removeWasInformedByProgram(
          "program.1",
          "program.2",
          {
            executionId: "urn:uuid:exec.informed.current.1",
            previousExecutionId: "urn:uuid:exec.informed.previous.1",
          },
        );

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
        resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([
          {
            programPid: "program.1",
            previousProgramPid: "program.2",
            executionId: "urn:uuid:exec.informed.current.2",
            previousExecutionId: "urn:uuid:exec.informed.previous.2",
          },
        ]);
      });

      it("round-trips the provenance snapshot and field projection through resource-map XML", () => {
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
          agentUri: "https://orcid.org/0000-0000-0000-0002",
        });
        resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
          executionId: "urn:uuid:exec.roundtrip.1",
          agentUri: "https://orcid.org/0000-0000-0000-0002",
        });
        resourceMap.provenance.addWasInformedByProgram(
          "program.1",
          "program.2",
          {
            executionId: "urn:uuid:exec.roundtrip.1",
            previousExecutionId: "urn:uuid:exec.roundtrip.2",
          },
        );

        const expectedSnapshot = resourceMap.provenance.toJSON();
        const expectedFieldMap = resourceMap.provenance.getMemberFieldMap();
        const xml = resourceMap.serialize();
        const reparsed = resourceMap.constructor.fromXml(
          "resource_map_urn:uuid:prov.roundtrip.1",
          xml,
        );

        reparsed.provenance.toJSON().should.deep.equal(expectedSnapshot);
        reparsed.provenance.getMemberFieldMap().should.deep.equal(
          expectedFieldMap,
        );
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
        ResourceMapGraph.collectMemberPids(reparsed).should.have.members([
          "meta.1",
          "data.1",
          "derived.1",
          "program.1",
        ]);
        ResourceMapGraph.collectMemberPids(reparsed).should.not.include(
          "external.source.1",
        );
        ResourceMapGraph.collectMemberPids(reparsed).should.not.include(
          "external.derived.1",
        );
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

      it("preserves malformed literal provenance endpoints while excluding them from normalized views", () => {
        const resourceMap = createBaseResourceMap({
          resourceMapPid: "resource_map_urn:uuid:prov.literal.roundtrip.1",
          memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
        });
        const derivedNode = rdf.sym(resourceMap.getNodeUriForPid("derived.1"));
        const programNode = rdf.sym(resourceMap.getNodeUriForPid("program.1"));
        const executionNode = rdf.sym("urn:uuid:exec.literal.roundtrip.1");
        const associationNode = rdf.blankNode();

        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          derivedNode,
          resourceMap.ns.PROV("wasDerivedFrom"),
          rdf.literal("data.1", undefined, resourceMap.ns.XSD("string")),
        );
        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          executionNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Execution"),
        );
        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          executionNode,
          resourceMap.ns.DCTERMS("identifier"),
          rdf.literal(
            executionNode.value,
            undefined,
            resourceMap.ns.XSD("string"),
          ),
        );
        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          executionNode,
          resourceMap.ns.PROV("qualifiedAssociation"),
          associationNode,
        );
        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          associationNode,
          resourceMap.ns.PROV("hadPlan"),
          programNode,
        );
        ResourceMapGraph.addStatementIfMissing(
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
        recreatedAssertions.filter(
          (assertion) =>
            assertion.pid === "program.1" && assertion.className === "Program",
        ).length.should.equal(1);
        recreatedAssertions.filter(
          (assertion) =>
            assertion.pid === "data.1" && assertion.className === "Data",
        ).length.should.equal(1);
      });

      it("replays standalone execution assertions onto the original execution node", () => {
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
        const executionNode = rdf.sym("urn:uuid:exec.snapshot.1");
        const encodedExecutionNode = rdf.sym(
          recreated.pidToUri("urn:uuid:exec.snapshot.1"),
        );

        ResourceMapGraph.findNodeUriForPid(
          recreated,
          "urn:uuid:exec.snapshot.1",
        ).should.equal(
          "urn:uuid:exec.snapshot.1",
        );
        recreated.graph
          .statementsMatching(
            executionNode,
            recreated.ns.RDF("type"),
            recreated.ns.PROVONE("Execution"),
          )
          .length.should.equal(1);
        recreated.graph
          .statementsMatching(
            executionNode,
            recreated.ns.DCTERMS("identifier"),
            undefined,
          )
          .map((statement) => statement.object.value)
          .should.deep.equal(["urn:uuid:exec.snapshot.1"]);
        recreated.graph
          .statementsMatching(encodedExecutionNode, undefined, undefined)
          .length.should.equal(0);
      });

      it("preserves identifier-only shells when removing standalone external type assertions", () => {
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
        const externalExecutionNode = rdf.sym(externalExecutionPid);

        resourceMap.provenance.addTypeAssertion(externalExecutionPid, "Execution");
        resourceMap.graph
          .statementsMatching(
            externalExecutionNode,
            resourceMap.ns.DCTERMS("identifier"),
            undefined,
          )
          .length.should.equal(1);

        resourceMap.provenance.removeTypeAssertion(
          externalExecutionPid,
          "Execution",
        );

        resourceMap.graph
          .statementsMatching(
            externalExecutionNode,
            resourceMap.ns.DCTERMS("identifier"),
            undefined,
          )
          .length.should.equal(1);
        resourceMap.graph
          .statementsMatching(
            externalExecutionNode,
            resourceMap.ns.RDF("type"),
            undefined,
          )
          .length.should.equal(0);
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
        resourceMap.provenance.addWasInformedByProgram(
          "program.1",
          "program.2",
          {
            executionId: executionNode.value,
            previousExecutionId: previousExecutionNode.value,
          },
        );

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
  },
);
