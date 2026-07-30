define([
  "rdflib",
  "models/resourceMap/ProvenanceValidation",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ProvenanceValidation, testUtils) => {
  chai.should();
  const { createBaseResourceMap } = testUtils;

  describe("ProvenanceValidation", () => {
    it("accepts provenance created through the public API", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");

      ProvenanceValidation.validateProvenance(
        resourceMap.provenance,
      ).should.deep.equal([]);
    });

    it("reports invalid provenance endpoints", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: rdf.literal("literal-source"),
          });
        },
        { markDirty: false },
      );

      const issue = ProvenanceValidation.validateProvenance(
        resourceMap.provenance,
      ).find(({ code }) => code === "invalidProvenanceEndpoint");

      issue.predicate.should.equal("wasDerivedFrom");
      issue.endpoint.should.equal("source");
      issue.reason.should.equal("literalEndpoint");
    });

    it("classifies malformed literal artifacts and unresolvable endpoints", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const malformedNode = rdf.sym(
        'file:///tmp/RtmpArtifact/"recovered-value"^^<http://www.w3.org/2001/XMLSchema#string>',
      );

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: malformedNode,
          });
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: rdf.blankNode(),
          });
        },
        { markDirty: false },
      );

      const issues = ProvenanceValidation.validateProvenance(
        resourceMap.provenance,
      ).filter(({ code }) => code === "invalidProvenanceEndpoint");

      issues
        .map(({ reason }) => reason)
        .should.have.members(["literalEndpoint", "missingPid"]);
      issues
        .find(({ reason }) => reason === "literalEndpoint")
        .value.should.equal("recovered-value");
    });
  });
});
