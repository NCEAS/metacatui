define([
  "rdflib",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapState",
  "models/resourceMap/GraphMutation",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ResourceMap, ResourceMapState, GraphMutation, testUtils) => {
  chai.should();

  const {
    COMPREHENSIVE_XML,
    MISSING_IDENTIFIER_XML,
    TEST_RESOLVE_BASE,
    createBaseResourceMap,
  } = testUtils;

  describe("ResourceMapState", () => {
    it("reads indexed identifiers from parsed graph state", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const graphState = resourceMap.getGraphState();
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const validationContext = graphState.createValidationContext();

      graphState.should.be.instanceOf(ResourceMapState);
      graphState.identifierFromNode(memberNode).should.equal("data.1");
      graphState.pidFromNode(memberNode).should.equal("data.1");
      graphState.findNodeUriForPid("data.1").should.equal(memberNode.value);
      graphState
        .findNodesByIdentifier("data.1")
        .map((node) => node.value)
        .should.deep.equal([memberNode.value]);
      validationContext.memberPids.should.include("data.1");
      validationContext.memberSet.has("data.1").should.equal(true);
      validationContext.hasSoloMemberSelfDocumentationCandidate.should.equal(
        false,
      );
    });

    it("returns member descriptors and documentation indexes from the shared graph index", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.state.members.1",
        memberPids: ["meta.1", "data.1", "data.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
          {
            metadataPid: "meta.1",
            dataPid: "data.2",
          },
        ],
      });
      const graphState = resourceMap.getGraphState();

      graphState
        .getMemberDescriptors()
        .map((descriptor) => descriptor.pid)
        .should.have.members(["meta.1", "data.1", "data.2"]);
      graphState.getMetadataPids().should.deep.equal(["meta.1"]);
      graphState
        .getDocumentedObjectPids()
        .should.have.members(["data.1", "data.2"]);
      graphState.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "data.1",
        },
        {
          metadataPid: "meta.1",
          dataPid: "data.2",
        },
      ]);
    });

    it("finds member URIs from resolve paths and identifiers", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.fix.1",
        MISSING_IDENTIFIER_XML,
      );

      const memberPid = "resource_map_doi:10.18739/A22Z9V";
      const memberUri = `${TEST_RESOLVE_BASE}/resource_map_doi:10.18739%2FA22Z9V`;

      resourceMap
        .getGraphState()
        .findNodeUriForPid(memberPid)
        .should.equal(memberUri);
    });

    it("finds resource nodes by normalized identifier literals and direct URIs", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.find.nodes.1",
        memberPids: ["meta.1"],
      });
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));
      const identifierStatement = resourceMap.graph.statementsMatching(
        memberNode,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
      )[0];
      const directNode = rdf.sym("https://example.org/direct-node");
      const directPredicate = rdf.sym("https://example.org/test#direct");

      GraphMutation.removeStatement(resourceMap, identifierStatement);
      GraphMutation.addStatement(
        resourceMap,
        memberNode,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal("  meta.1  ", undefined, resourceMap.ns.XSD("string")),
      );
      GraphMutation.addStatement(
        resourceMap,
        directNode,
        directPredicate,
        rdf.literal("present in graph"),
      );

      const graphState = resourceMap.getGraphState();
      graphState
        .findNodesByIdentifier("meta.1")
        .map((node) => node.value)
        .should.deep.equal([memberNode.value]);
      graphState
        .findNodesByIdentifier("https://example.org/direct-node")
        .map((node) => node.value)
        .should.deep.equal([directNode.value]);
    });

    it("finds blank nodes by identifier", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.find.blank.nodes.1",
        memberPids: ["meta.1"],
      });
      const blankNode = rdf.blankNode();
      const identifier = "urn:uuid:blank.identifier.1";

      GraphMutation.addStatement(
        resourceMap,
        blankNode,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal(identifier, undefined, resourceMap.ns.XSD("string")),
      );

      resourceMap
        .getGraphState()
        .findNodesByIdentifier(identifier)
        .should.deep.equal([blankNode]);
    });

    it("ignores members aggregated by an unrelated aggregation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.state.unrelated.1",
        memberPids: ["meta.1", "data.1"],
      });
      const unrelatedAggregation = rdf.sym(
        "https://example.org/unrelated-aggregation",
      );
      const unrelatedMember = rdf.sym(resourceMap.pidToUri("unrelated.1"));

      GraphMutation.addStatement(
        resourceMap,
        unrelatedAggregation,
        resourceMap.ns.ORE("aggregates"),
        unrelatedMember,
      );
      GraphMutation.addStatement(
        resourceMap,
        unrelatedMember,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal("unrelated.1", undefined, resourceMap.ns.XSD("string")),
      );

      resourceMap
        .getGraphState()
        .getMemberDescriptors()
        .map((member) => member.pid)
        .should.have.members(["meta.1", "data.1"]);
    });

    it("builds summaries for PIDs that shadow object prototypes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.state.prototype.1",
        memberPids: ["meta.1", "__proto__"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "__proto__",
          },
        ],
      });

      const summary = resourceMap.getGraphState().getSummary();

      summary.membersByPid["__proto__"].isDocumentedBy.should.deep.equal([
        "meta.1",
      ]);
      summary.membersByPid["meta.1"].documents.should.deep.equal([
        "__proto__",
      ]);
    });

    it("indexes execution summaries and program execution lookups", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const graphState = resourceMap.getGraphState();
      const [executionNode] =
        graphState.getExecutionNodesForProgram("script.1");
      const executionSummary = graphState.getExecutionSummary(executionNode);

      (!!executionNode).should.equal(true);
      executionSummary.identifier.should.equal("urn:uuid:execution-1");
      executionSummary.isExecution.should.equal(true);
      executionSummary.hasIdentifierLiteral.should.equal(true);
      executionSummary.hasGeneratedLinks.should.equal(true);
      executionSummary.hasUsedLinks.should.equal(true);
      executionSummary.hasWasInformedByLinks.should.equal(true);
      executionSummary.programPids.should.deep.equal(["script.1"]);
      graphState
        .getExecutionIdentifier(executionNode)
        .should.equal("urn:uuid:execution-1");
      graphState.hasExecutionIdentifier(executionNode).should.equal(true);
      graphState.isExecutionNode(executionNode).should.equal(true);
      executionSummary.programs.should.deep.equal([
        {
          programPid: "script.1",
          agentUri: "https://orcid.org/0000-0001-0000-0001",
        },
      ]);
      graphState
        .filterExecutionNodesByIdentifier(
          [executionNode],
          "urn:uuid:execution-1",
        )
        .map((node) => node.value)
        .should.deep.equal([executionNode.value]);
      graphState.getProgramExecutions().should.deep.equal([
        {
          programPid: "script.1",
          executionId: "urn:uuid:execution-1",
          agentUri: "https://orcid.org/0000-0001-0000-0001",
        },
        {
          programPid: "script.2",
          executionId: "urn:uuid:execution-2",
          agentUri: null,
        },
      ]);
    });

    it("normalizes execution identifiers in indexed lookups", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.normalize.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionNode = rdf.sym("urn:uuid:exec.normalize.1");

      GraphMutation.addStatement(
        resourceMap,
        executionNode,
        resourceMap.ns.RDF("type"),
        resourceMap.ns.PROVONE("Execution"),
      );
      GraphMutation.addStatement(
        resourceMap,
        executionNode,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal(
          "  urn:uuid:exec.normalize.1  ",
          undefined,
          resourceMap.ns.XSD("string"),
        ),
      );

      const graphState = resourceMap.getGraphState();
      graphState
        .getExecutionIdentifier(executionNode)
        .should.equal("urn:uuid:exec.normalize.1");
      graphState
        .filterExecutionNodesByIdentifier(
          [executionNode],
          "urn:uuid:exec.normalize.1",
        )
        .map((node) => node.value)
        .should.deep.equal([executionNode.value]);
    });

    it("indexes every agent on malformed multi-agent associations", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.multiple.agents.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionId = "urn:uuid:exec.multiple.agents.1";
      const executionNode = rdf.sym(executionId);
      const associationNode = rdf.blankNode();

      [
        [
          executionNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.PROVONE("Execution"),
        ],
        [
          executionNode,
          resourceMap.ns.DCTERMS("identifier"),
          rdf.literal(executionId, undefined, resourceMap.ns.XSD("string")),
        ],
        [
          executionNode,
          resourceMap.ns.PROV("qualifiedAssociation"),
          associationNode,
        ],
        [
          associationNode,
          resourceMap.ns.PROV("hadPlan"),
          rdf.sym(resourceMap.getNodeUriForPid("program.1")),
        ],
        [
          associationNode,
          resourceMap.ns.PROV("agent"),
          rdf.sym("https://orcid.org/0000-0000-0000-0021"),
        ],
        [
          associationNode,
          resourceMap.ns.PROV("agent"),
          rdf.sym("https://orcid.org/0000-0000-0000-0022"),
        ],
      ].forEach(([subject, predicate, object]) => {
        GraphMutation.addStatement(resourceMap, subject, predicate, object);
      });

      const graphState = resourceMap.getGraphState();
      graphState
        .getExecutionSummary(executionNode)
        .programs
        .sort((left, right) => left.agentUri.localeCompare(right.agentUri))
        .should.deep.equal([
          {
            programPid: "program.1",
            agentUri: "https://orcid.org/0000-0000-0000-0021",
          },
          {
            programPid: "program.1",
            agentUri: "https://orcid.org/0000-0000-0000-0022",
          },
        ]);
      graphState
        .getProgramExecutions()
        .sort((left, right) => left.agentUri.localeCompare(right.agentUri))
        .should.deep.equal([
          {
            programPid: "program.1",
            executionId,
            agentUri: "https://orcid.org/0000-0000-0000-0021",
          },
          {
            programPid: "program.1",
            executionId,
            agentUri: "https://orcid.org/0000-0000-0000-0022",
          },
        ]);
    });

    it("indexes role and provenance relationships from typed resource-map members", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const graphState = resourceMap.getGraphState();

      Array.from(graphState.getRolePidSet("Data")).should.have.members([
        "data.1",
        "derived.1",
      ]);
      Array.from(graphState.getRolePidSet("Program")).should.have.members([
        "script.1",
        "script.2",
      ]);
      graphState.hasRole("script.1", "Program").should.equal(true);
      graphState.getTypeAssertions().should.deep.include({
        pid: "data.1",
        className: "Data",
      });
      graphState.getWasDerivedFromLinks().should.deep.equal([
        {
          derivedPid: "derived.1",
          sourcePid: "data.1",
        },
      ]);
      graphState.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "derived.1",
          programPid: "script.1",
          executionId: "urn:uuid:execution-1",
          agentUri: "https://orcid.org/0000-0001-0000-0001",
        },
      ]);
      graphState.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "script.1",
          executionId: "urn:uuid:execution-1",
          agentUri: "https://orcid.org/0000-0001-0000-0001",
        },
      ]);
      graphState.getWasInformedByPrograms().should.deep.equal([
        {
          programPid: "script.1",
          previousProgramPid: "script.2",
          executionId: "urn:uuid:execution-1",
          previousExecutionId: "urn:uuid:execution-2",
        },
      ]);
    });
  });
});
