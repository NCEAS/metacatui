define([
  "rdflib",
  "models/resourceMap/ResourceMapCommon",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ResourceMapCommon, testUtils) => {
  chai.should();
  const { createBaseResourceMap } = testUtils;
  const XSD = rdf.Namespace("http://www.w3.org/2001/XMLSchema#");

  describe("ResourceMapCommon", () => {
    it("builds distinct keys when relationship values contain separators", () => {
      ResourceMapCommon.buildKey(["a::b", "c"]).should.not.equal(
        ResourceMapCommon.buildKey(["a", "b::c"]),
      );
    });

    it("builds explicit RDF node, term, and statement identity keys", () => {
      const namedNode = rdf.sym("shared-value");
      const blankNode = rdf.blankNode("shared-value");
      const stringLiteral = rdf.literal("shared-value", XSD("string"));
      const integerLiteral = rdf.literal("shared-value", XSD("integer"));
      const predicate = rdf.sym("https://example.org/test#key");

      ResourceMapCommon.nodeKey(namedNode).should.not.equal(
        ResourceMapCommon.nodeKey(blankNode),
      );
      ResourceMapCommon.termKey(stringLiteral).should.not.equal(
        ResourceMapCommon.termKey(integerLiteral),
      );
      ResourceMapCommon.statementKey(
        rdf.st(namedNode, predicate, stringLiteral),
      ).should.not.equal(
        ResourceMapCommon.statementKey(
          rdf.st(namedNode, predicate, integerLiteral),
        ),
      );
    });

    it("recovers PIDs consistently from identifiers, fragments, and bare values", () => {
      const resourceMap = createBaseResourceMap();
      const identifiedUri = "https://example.org/identified";
      const identifiers = new Map([[identifiedUri, "identified.pid"]]);

      ResourceMapCommon.recoverPidFromUri(
        resourceMap,
        `${identifiedUri}#fragment`,
        { identifierForUri: identifiers },
      ).should.equal("identified.pid");
      chai
        .expect(ResourceMapCommon.recoverPidFromUri(resourceMap, "bare%2Fpid"))
        .to.equal(null);
      ResourceMapCommon.recoverPidFromUri(resourceMap, "bare%2Fpid", {
        allowBareValue: true,
      }).should.equal("bare/pid");
    });

    it("extracts lexical values and datatypes from malformed resource artifacts", () => {
      const malformedValue =
        'file:///tmp/RtmpArtifact/"meta.1"^^<http://www.w3.org/2001/XMLSchema#string>';

      ResourceMapCommon.extractMalformedResourceValue(
        malformedValue,
      ).should.deep.equal({
        lexicalValue: "meta.1",
        datatypeUri: "http://www.w3.org/2001/XMLSchema#string",
        rawValue: malformedValue,
      });
    });

    it("reads literal-like values from both RDF literals and malformed named nodes", () => {
      ResourceMapCommon.getLiteralLikeObjectValue(
        rdf.literal("literal-value"),
      ).should.equal("literal-value");

      ResourceMapCommon.getLiteralLikeObjectValue(
        rdf.sym(
          'file:///tmp/RtmpArtifact/"recovered-value"^^<http://www.w3.org/2001/XMLSchema#string>',
        ),
      ).should.equal("recovered-value");
    });
  });
});
