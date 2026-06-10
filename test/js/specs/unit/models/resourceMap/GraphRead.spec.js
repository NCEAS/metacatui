define([
  "rdflib",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/GraphRead",
  "models/resourceMap/GraphMutation",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ResourceMap, GraphRead, GraphMutation, testUtils) => {
  chai.should();
  const { MISSING_IDENTIFIER_XML, TEST_RESOLVE_BASE, createBaseResourceMap } =
    testUtils;

  describe("GraphRead", () => {
    it("extracts lexical values and datatypes from malformed resource artifacts", () => {
      const malformedValue =
        'file:///tmp/RtmpArtifact/"meta.1"^^<http://www.w3.org/2001/XMLSchema#string>';

      GraphRead.extractMalformedResourceValue(malformedValue).should.deep.equal({
        lexicalValue: "meta.1",
        datatypeUri: "http://www.w3.org/2001/XMLSchema#string",
        rawValue: malformedValue,
      });
    });

    it("reads literal-like values from both RDF literals and malformed named nodes", () => {
      GraphRead.getLiteralLikeObjectValue(rdf.literal("literal-value")).should.equal(
        "literal-value",
      );

      GraphRead.getLiteralLikeObjectValue(
        rdf.sym(
          'file:///tmp/RtmpArtifact/"recovered-value"^^<http://www.w3.org/2001/XMLSchema#string>',
        ),
      ).should.equal("recovered-value");
    });

    it("ignores RDF literals when deriving resource identifiers and package structure", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.literal.resources.1",
        memberPids: ["meta.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "meta.1",
          },
        ],
      });

      chai.expect(GraphRead.pidFromNode(resourceMap, rdf.literal("literal.pid"))).to
        .equal(null);

      resourceMap.graph.add(
        rdf.sym(resourceMap.aggregationUri),
        resourceMap.ns.ORE("aggregates"),
        rdf.literal("literal.member.pid"),
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.getNodeUriForPid("meta.1")),
        resourceMap.ns.CITO("documents"),
        rdf.literal("literal.data.pid"),
      );

      GraphRead.collectMemberPids(resourceMap).should.deep.equal(["meta.1"]);
      GraphRead.collectDocLinks(resourceMap).should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "meta.1",
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

      GraphRead.findNodeUriForPid(resourceMap, memberPid).should.equal(memberUri);
    });

    it("returns member descriptors without exposing cached member state", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.setLocation("data.1", "data/data.csv");

      const descriptor = GraphRead.collectMemberDescriptors(resourceMap).find(
        ({ pid }) => pid === "data.1",
      );

      descriptor.should.deep.equal({
        pid: "data.1",
        uri: resourceMap.getNodeUriForPid("data.1"),
      });
      resourceMap.getMember("data.1").atLocations.should.deep.equal([
        "data/data.csv",
      ]);
    });

    it("finds named nodes by normalized identifier literals and direct URIs", () => {
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

      GraphRead.findNodesByIdentifier(resourceMap, "meta.1")
        .map((node) => node.value)
        .should.deep.equal([memberNode.value]);
      GraphRead.findNodesByIdentifier(resourceMap, "https://example.org/direct-node")
        .map((node) => node.value)
        .should.deep.equal([directNode.value]);
    });
  });
});
