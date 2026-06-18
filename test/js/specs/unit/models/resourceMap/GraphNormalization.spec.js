define([
  "rdflib",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/GraphNormalization",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ResourceMap, GraphMutation, GraphNormalization, testUtils) => {
  chai.should();
  const { MISSING_IDENTIFIER_XML, createBaseResourceMap } = testUtils;

  describe("GraphNormalization", () => {
    it("keeps core graph synchronization idempotent after parsing repairs missing statements", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.fix.1",
        MISSING_IDENTIFIER_XML,
      );
      const memberNode = rdf.sym(
        resourceMap.getNodeUriForPid("resource_map_doi:10.18739/A22Z9V"),
      );

      resourceMap
        .getGraphState()
        .nodeHasIdentifier(memberNode, "resource_map_doi:10.18739/A22Z9V")
        .should.equal(true);

      GraphNormalization.synchronizeCoreGraph(resourceMap);

      resourceMap
        .getGraphState()
        .nodeHasIdentifier(memberNode, "resource_map_doi:10.18739/A22Z9V")
        .should.equal(true);
      resourceMap.graph
        .statementsMatching(
          rdf.sym(resourceMap.aggregationUri),
          resourceMap.ns.ORE("isDescribedBy"),
          rdf.sym(resourceMap.resourceMapUri),
        )
        .length.should.equal(1);
    });

    it("repairs missing reciprocal ore:isAggregatedBy links during core synchronization", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.fix.inverse.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);

      GraphMutation.removeStatementsMatching(
        resourceMap,
        memberNode,
        resourceMap.ns.ORE("isAggregatedBy"),
        aggregationNode,
      );

      GraphNormalization.synchronizeCoreGraph(resourceMap);

      resourceMap.graph
        .statementsMatching(
          memberNode,
          resourceMap.ns.ORE("isAggregatedBy"),
          aggregationNode,
        )
        .length.should.equal(1);
    });

    it("batch-canonicalizes legacy managed node URIs onto canonical resolve URIs", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.fix.batch.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const legacyResourceMapUri =
        "https://legacy.example.org/resolve/resource_map_urn%3Auuid%3Arm.fix.batch.1";
      const legacyAggregationUri = `${legacyResourceMapUri}#aggregation`;
      const legacyDataUri = "https://legacy.example.org/resolve/data.1";
      const canonicalDataUri = resourceMap.pidToUri("data.1");
      const literalDataPid = rdf.literal(
        "data.1",
        undefined,
        resourceMap.ns.XSD("string"),
      );

      resourceMap.graph.add(
        rdf.sym(legacyResourceMapUri),
        resourceMap.ns.ORE("describes"),
        rdf.sym(legacyAggregationUri),
      );
      resourceMap.graph.add(
        rdf.sym(legacyAggregationUri),
        resourceMap.ns.ORE("isDescribedBy"),
        rdf.sym(legacyResourceMapUri),
      );
      resourceMap.graph.add(
        rdf.sym(legacyAggregationUri),
        resourceMap.ns.ORE("aggregates"),
        rdf.sym(legacyDataUri),
      );
      resourceMap.graph.add(
        rdf.sym(legacyDataUri),
        resourceMap.ns.ORE("isAggregatedBy"),
        rdf.sym(legacyAggregationUri),
      );
      resourceMap.graph.add(
        rdf.sym(legacyDataUri),
        resourceMap.ns.DCTERMS("identifier"),
        literalDataPid,
      );

      GraphNormalization.repairBrokenGraph(resourceMap);

      resourceMap.graph
        .statementsMatching(rdf.sym(legacyResourceMapUri), undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, rdf.sym(legacyResourceMapUri))
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(rdf.sym(legacyAggregationUri), undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, rdf.sym(legacyAggregationUri))
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(rdf.sym(legacyDataUri), undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, rdf.sym(legacyDataUri))
        .length.should.equal(0);

      resourceMap.graph
        .statementsMatching(
          rdf.sym(resourceMap.aggregationUri),
          resourceMap.ns.ORE("aggregates"),
          rdf.sym(canonicalDataUri),
        )
        .length.should.equal(1);
      resourceMap
        .getGraphState()
        .nodeHasIdentifier(rdf.sym(canonicalDataUri), "data.1")
        .should.equal(true);
    });

    it("does not rewrite literal values that match canonicalized node URIs", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.fix.literal.1",
        memberPids: ["meta.1", "data.1"],
      });
      const canonicalDataUri = resourceMap.pidToUri("data.1");
      const legacyDataUri = "https://legacy.example.org/resolve/data.1";
      const literalPredicate = rdf.sym("https://example.org/test#literal");

      GraphMutation.replaceNodeValue(
        resourceMap,
        canonicalDataUri,
        legacyDataUri,
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.resourceMapUri),
        literalPredicate,
        rdf.literal(legacyDataUri),
      );

      GraphNormalization.repairBrokenGraph(resourceMap);

      resourceMap.graph
        .statementsMatching(
          rdf.sym(resourceMap.resourceMapUri),
          literalPredicate,
          rdf.literal(legacyDataUri),
          undefined,
        )
        .length.should.equal(1);
    });

    it("preserves standalone blank-node RDF during canonicalization", () => {
      const resourceMap = createBaseResourceMap();
      const blankNode = rdf.blankNode();
      const predicate = rdf.sym("https://example.org/test#payload");

      resourceMap.graph.add(
        blankNode,
        predicate,
        rdf.literal("standalone payload"),
      );

      GraphNormalization.repairBrokenGraph(resourceMap);

      resourceMap.graph
        .statementsMatching(
          blankNode,
          predicate,
          rdf.literal("standalone payload"),
          undefined,
        )
        .length.should.equal(1);
    });

    it("keeps distinct RDF statements whose values contain key separators", () => {
      const resourceMap = createBaseResourceMap();
      const subject = rdf.sym(resourceMap.resourceMapUri);
      const predicate = rdf.sym("https://example.org/test#separator");

      resourceMap.graph.add(subject, predicate, rdf.literal("a::b|||c"));
      resourceMap.graph.add(subject, predicate, rdf.literal("a|||b::c"));

      GraphNormalization.dedupeStatements(resourceMap);

      resourceMap.graph
        .statementsMatching(subject, predicate, undefined, undefined)
        .length.should.equal(2);
    });

  });
});
