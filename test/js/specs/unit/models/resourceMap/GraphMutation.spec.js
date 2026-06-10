define([
  "rdflib",
  "models/resourceMap/GraphMutation",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, GraphMutation, testUtils) => {
  chai.should();
  const { createBaseResourceMap } = testUtils;

  describe("GraphMutation", () => {
    it("does not rewrite literal values that match a replaced node URI", () => {
      const resourceMap = createBaseResourceMap();
      const oldUri = resourceMap.getNodeUriForPid("data.1");
      const newUri = resourceMap.pidToUri("data.replaced");
      const literalSubject = rdf.sym(resourceMap.resourceMapUri);
      const literalPredicate = rdf.sym("https://example.org/test#literal");

      resourceMap.graph.add(
        literalSubject,
        literalPredicate,
        rdf.literal(oldUri),
      );

      GraphMutation.replaceNodeValue(resourceMap, oldUri, newUri);

      resourceMap.graph
        .statementsMatching(
          literalSubject,
          literalPredicate,
          rdf.literal(oldUri),
          undefined,
        )
        .length.should.equal(1);
    });

    it("removes detached blank nodes with outgoing payloads", () => {
      const resourceMap = createBaseResourceMap();
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      const keptBlankNode = rdf.blankNode();
      const orphanedBlankNode = rdf.blankNode();
      const keptPredicate = rdf.sym("https://example.org/test#keptBlank");
      const payloadPredicate = rdf.sym("https://example.org/test#payload");

      resourceMap.graph.add(resourceMapNode, keptPredicate, keptBlankNode);
      resourceMap.graph.add(
        keptBlankNode,
        payloadPredicate,
        rdf.literal("preserve this blank node"),
      );
      resourceMap.graph.add(
        orphanedBlankNode,
        payloadPredicate,
        rdf.literal("remove this detached blank node"),
      );

      GraphMutation.removeOrphanedBlankNodes(resourceMap);

      resourceMap.graph
        .statementsMatching(
          resourceMapNode,
          keptPredicate,
          keptBlankNode,
          undefined,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          keptBlankNode,
          payloadPredicate,
          undefined,
          undefined,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          orphanedBlankNode,
          payloadPredicate,
          undefined,
          undefined,
        )
        .length.should.equal(0);
    });

    it("removes detached nested blank nodes but preserves shared children", () => {
      const resourceMap = createBaseResourceMap();
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      const orphanedParent = rdf.blankNode();
      const orphanedChild = rdf.blankNode();
      const sharedChild = rdf.blankNode();
      const childPredicate = rdf.sym("https://example.org/test#child");
      const keptPredicate = rdf.sym("https://example.org/test#keptBlank");
      const payloadPredicate = rdf.sym("https://example.org/test#payload");

      resourceMap.graph.add(orphanedParent, childPredicate, orphanedChild);
      resourceMap.graph.add(orphanedParent, childPredicate, sharedChild);
      resourceMap.graph.add(
        orphanedChild,
        payloadPredicate,
        rdf.literal("remove this nested payload"),
      );
      resourceMap.graph.add(resourceMapNode, keptPredicate, sharedChild);
      resourceMap.graph.add(
        sharedChild,
        payloadPredicate,
        rdf.literal("preserve this shared child"),
      );

      GraphMutation.removeOrphanedBlankNodes(resourceMap);

      resourceMap.graph
        .statementsMatching(orphanedParent, undefined, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(orphanedChild, undefined, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(
          resourceMapNode,
          keptPredicate,
          sharedChild,
          undefined,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          sharedChild,
          payloadPredicate,
          undefined,
          undefined,
        )
        .length.should.equal(1);
    });
  });
});
