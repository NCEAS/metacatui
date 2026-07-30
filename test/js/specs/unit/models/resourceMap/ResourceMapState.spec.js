define([
  "rdflib",
  "models/resourceMap/ResourceMap",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ResourceMap, testUtils) => {
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
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      const graphState = resourceMap.graphState;
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      graphState.pidFromNode(memberNode).should.equal("data.1");
      graphState.findNodeUriForPid("data.1").should.equal(memberNode.value);
      graphState
        .findNodesByIdentifier("data.1")
        .map((node) => node.value)
        .should.deep.equal([memberNode.value]);
      graphState.hasMember("data.1").should.equal(true);
    });

    it("keeps contradictory managed identifiers visible to validation", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
      });
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.mutateGraph(() => {
        resourceMap.graph.removeStatementsMatching({
          subject: memberNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
        });
        ["alternate-data-id", "data.1"].forEach((identifier) => {
          resourceMap.graph.addStatement({
            subject: memberNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(identifier),
          });
        });
      });

      const graphState = resourceMap.graphState;
      graphState.nodeHasIdentifier(memberNode, "data.1").should.equal(true);
      graphState
        .findNodesByIdentifier("alternate-data-id")
        .map((node) => node.value)
        .should.deep.equal([memberNode.value]);
      resourceMap
        .getEditBlockers()
        .map(({ code }) => code)
        .should.include("memberIdentifierMismatch");
    });

    it("does not hide a contradictory Resource Map identifier", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:state.root.1",
      });
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: rdf.sym(resourceMap.resourceMapUri),
          predicate: resourceMap.ns.DCTERMS("identifier"),
          object: rdf.literal("alternate-resource-map-id"),
        });
      });

      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      const graphState = resourceMap.graphState;
      graphState
        .nodeHasIdentifier(resourceMapNode, "alternate-resource-map-id")
        .should.equal(true);
      resourceMap
        .getEditBlockers()
        .map(({ code }) => code)
        .should.include("resourceMapIdentifierMismatch");
    });

    it("does not choose between ambiguous identifiers on an external URI", () => {
      const resourceMap = createBaseResourceMap();
      const externalNode = rdf.sym("https://example.org/resources/123");

      resourceMap.mutateGraph(() => {
        ["doi:10.1234/example", "local-record-7"].forEach((identifier) => {
          resourceMap.graph.addStatement({
            subject: externalNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(identifier),
          });
        });
      });

      const graphState = resourceMap.graphState;
      chai.expect(graphState.pidFromNode(externalNode)).to.equal(null);
      graphState
        .findNodesByIdentifier("doi:10.1234/example")
        .map((node) => node.value)
        .should.deep.equal([externalNode.value]);
    });

    it("reuses provenance nodes with URL-valued DataONE identifiers", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1", "derived.1"],
      });
      const sourcePid = "external.1";
      const sourceNode = rdf.sym(
        `https://old.example/cn/v2/resolve/${sourcePid}`,
      );
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const derivedNode = rdf.sym(resourceMap.getNodeUriForPid("derived.1"));

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: sourceNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(sourceNode.value),
          });
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: sourceNode,
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState.pidFromNode(sourceNode).should.equal(sourcePid);
      resourceMap.graphState
        .findNodesByIdentifier(sourceNode.value)
        .map((node) => node.value)
        .should.deep.equal([sourceNode.value]);
      resourceMap.provenance.addWasDerivedFrom("derived.1", sourcePid);
      resourceMap.graph
        .findStatements({
          predicate: resourceMap.ns.PROV("wasDerivedFrom"),
          object: sourceNode,
        })
        .map(({ subject }) => subject.value)
        .should.have.members([dataNode.value, derivedNode.value]);
      resourceMap.graph
        .findStatements({
          object: rdf.sym(resourceMap.pidToUri(sourcePid)),
        })
        .should.deep.equal([]);

      resourceMap.provenance.removeWasDerivedFrom("data.1", sourcePid);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([
        {
          derivedPid: "derived.1",
          sourcePid,
        },
      ]);
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
      const graphState = resourceMap.graphState;

      graphState
        .getMemberPids()
        .should.have.members(["meta.1", "data.1", "data.2"]);
      graphState
        .getMember("meta.1")
        .documents.should.have.members(["data.1", "data.2"]);
      graphState
        .getMember("data.1")
        .isDocumentedBy.should.deep.equal(["meta.1"]);
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

    it("ignores foreign documentation links that reuse member identifiers", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1", "data.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const metadataNode = rdf.sym("https://example.org/foreign-metadata");
      const dataNode = rdf.sym("https://example.org/foreign-data");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: metadataNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal("meta.1"),
          });
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal("data.2"),
          });
          resourceMap.graph.addStatement({
            subject: metadataNode,
            predicate: resourceMap.ns.CITO("documents"),
            object: dataNode,
          });
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.CITO("isDocumentedBy"),
            object: metadataNode,
          });
        },
        { markDirty: false },
      );

      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "data.1",
        },
      ]);
      resourceMap
        .validate()
        .filter(({ code }) => code === "invalidDocumentationLink")
        .should.deep.equal([]);
    });

    it("reads locations only from the exact aggregated member node", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
      });
      const memberNode = rdf.sym(
        resourceMap.graphState.getMember("data.1").uri,
      );
      const foreignNode = rdf.sym("https://example.org/foreign-data-location");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: foreignNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal("data.1"),
          });
          resourceMap.graph.addStatement({
            subject: memberNode,
            predicate: resourceMap.ns.PROV("atLocation"),
            object: rdf.literal("member/data.csv"),
          });
          resourceMap.graph.addStatement({
            subject: foreignNode,
            predicate: resourceMap.ns.PROV("atLocation"),
            object: rdf.literal("foreign/data.csv"),
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal(["member/data.csv"]);
    });

    it("finds member URIs from resolve paths and identifiers", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.fix.1",
        MISSING_IDENTIFIER_XML,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );

      const memberPid = "resource_map_doi:10.18739/A22Z9V";
      const memberUri = `${TEST_RESOLVE_BASE}/resource_map_doi:10.18739%2FA22Z9V`;

      resourceMap.graphState
        .findNodeUriForPid(memberPid)
        .should.equal(memberUri);
    });

    it("finds resource nodes by normalized identifier literals and direct URIs", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.find.nodes.1",
        memberPids: ["meta.1"],
      });
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));
      const identifierStatement = resourceMap.graph.findStatements({
        subject: memberNode,
        predicate: resourceMap.ns.DCTERMS("identifier"),
      })[0];
      const directNode = rdf.sym("https://example.org/direct-node");
      const directPredicate = rdf.sym("https://example.org/test#direct");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.removeStatement(identifierStatement);
          resourceMap.graph.addStatement({
            subject: memberNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              "  meta.1  ",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
          resourceMap.graph.addStatement({
            subject: directNode,
            predicate: directPredicate,
            object: rdf.literal("present in graph"),
          });
        },
        { markDirty: false },
      );

      const graphState = resourceMap.graphState;
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

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: blankNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              identifier,
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState
        .findNodesByIdentifier(identifier)
        .should.deep.equal([blankNode]);
    });

    it("indexes only the selected aggregation and rejects a competing root", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.state.unrelated.1",
        memberPids: ["meta.1", "data.1"],
      });
      const unselectedRoot = rdf.sym(
        "https://example.org/unselected-resource-map",
      );
      const unrelatedAggregation = rdf.sym(
        "https://example.org/unrelated-aggregation",
      );
      const unrelatedMember = rdf.sym(resourceMap.pidToUri("unrelated.1"));

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: unselectedRoot,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(resourceMap.resourceMapPid),
          });
          resourceMap.graph.addStatement({
            subject: unselectedRoot,
            predicate: resourceMap.ns.RDF("type"),
            object: resourceMap.ns.ORE("ResourceMap"),
          });
          resourceMap.graph.addStatement({
            subject: unselectedRoot,
            predicate: resourceMap.ns.ORE("describes"),
            object: unrelatedAggregation,
          });
          resourceMap.graph.addStatement({
            subject: unrelatedAggregation,
            predicate: resourceMap.ns.RDF("type"),
            object: resourceMap.ns.ORE("Aggregation"),
          });
          resourceMap.graph.addStatement({
            subject: unrelatedAggregation,
            predicate: resourceMap.ns.ORE("isDescribedBy"),
            object: unselectedRoot,
          });
          resourceMap.graph.addStatement({
            subject: unrelatedAggregation,
            predicate: resourceMap.ns.ORE("aggregates"),
            object: unrelatedMember,
          });
          resourceMap.graph.addStatement({
            subject: unrelatedMember,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              "unrelated.1",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState
        .getMemberPids()
        .should.have.members(["meta.1", "data.1"]);
      (() => resourceMap.normalize()).should.throw(
        "The RDF does not identify exactly one Resource Map document",
      );
      resourceMap.graph
        .hasStatement({
          subject: unselectedRoot,
          predicate: resourceMap.ns.ORE("describes"),
          object: unrelatedAggregation,
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: unrelatedAggregation,
          predicate: resourceMap.ns.ORE("aggregates"),
          object: unrelatedMember,
        })
        .should.equal(true);
      resourceMap.graphState.hasMember("unrelated.1").should.equal(false);
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

      resourceMap.graphState
        .getMember("__proto__")
        .isDocumentedBy.should.deep.equal(["meta.1"]);
      resourceMap.graphState
        .getMember("meta.1")
        .documents.should.deep.equal(["__proto__"]);
    });

    it("indexes execution summaries by program", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      const graphState = resourceMap.graphState;
      const [executionNode] =
        graphState.getExecutionNodesForProgram("script.1");
      const executionSummary = graphState.getExecutionSummary(executionNode);

      (!!executionNode).should.equal(true);
      executionSummary.identifier.should.equal("urn:uuid:execution-1");
      executionSummary.isExecution.should.equal(true);
      executionSummary.hasIdentifierLiteral.should.equal(true);
      executionSummary.hasManagedLinks.should.equal(true);
      executionSummary.programPids.should.deep.equal(["script.1"]);
    });

    it("normalizes execution identifiers in indexed lookups", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.normalize.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionNode = rdf.sym("urn:uuid:exec.normalize.1");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: resourceMap.ns.RDF("type"),
            object: resourceMap.ns.PROVONE("Execution"),
          });
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              "  urn:uuid:exec.normalize.1  ",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState
        .getExecutionSummary(executionNode)
        .identifier.should.equal("urn:uuid:exec.normalize.1");
    });

    it("indexes role and provenance relationships from typed resource map members", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      const graphState = resourceMap.graphState;

      [...graphState.getRolePidSet("Data")].should.have.members([
        "data.1",
        "derived.1",
      ]);
      [...graphState.getRolePidSet("Program")].should.have.members([
        "script.1",
        "script.2",
      ]);
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
        },
      ]);
      graphState.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "script.1",
          executionId: "urn:uuid:execution-1",
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
