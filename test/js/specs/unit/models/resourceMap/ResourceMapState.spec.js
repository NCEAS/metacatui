define([
  "rdflib",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/ResourceMapState",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ResourceMap, ResourceMapState, testUtils) => {
  chai.should();

  const { COMPREHENSIVE_XML, TEST_RESOLVE_BASE, createBaseResourceMap } =
    testUtils;

  describe("ResourceMapState", () => {
    it("infers root URIs and indexed identifiers from parsed graph state", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const graphState = resourceMap.getGraphState();
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const validationContext = graphState.createValidationContext();

      graphState.should.be.instanceOf(ResourceMapState);
      graphState
        .inferResolveBase("fallback")
        .should.equal(`${TEST_RESOLVE_BASE}/`);
      graphState.inferResourceMapUri().should.equal(resourceMap.resourceMapUri);
      graphState.inferAggregationUri().should.equal(resourceMap.aggregationUri);
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
      graphState.getProgramsForExecution(executionNode).should.deep.equal([
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
