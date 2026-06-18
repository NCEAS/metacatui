define([
  "rdflib",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/ProvenanceValidation",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, GraphMutation, ProvenanceValidation, testUtils) => {
  chai.should();
  const { createBaseResourceMap, getIssueCodes } = testUtils;

  describe("ProvenanceValidation", () => {
    it("accepts provenance created through the public API", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.valid.1",
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.valid.1",
      });

      ProvenanceValidation.validateProvenance(
        resourceMap.provenance,
      ).should.deep.equal([]);
    });

    it("reports invalid provenance endpoints", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.graph.add(
        rdf.sym(resourceMap.getNodeUriForPid("data.1")),
        resourceMap.ns.PROV("wasDerivedFrom"),
        rdf.literal("literal-source"),
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

      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("wasDerivedFrom"),
        malformedNode,
      );
      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("wasDerivedFrom"),
        rdf.blankNode(),
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

    it("reports unsupported execution shapes once per execution", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
      });
      const executionNode = rdf.sym("urn:uuid:exec.unsupported.1");

      GraphMutation.addStatementIfMissing(
        resourceMap,
        rdf.sym(resourceMap.getNodeUriForPid("data.1")),
        resourceMap.ns.PROV("wasGeneratedBy"),
        executionNode,
      );

      const issues = ProvenanceValidation.validateProvenance(
        resourceMap.provenance,
      );
      const executionIssues = issues.filter(
        ({ code }) => code === "unsupportedExecutionShape",
      );

      executionIssues.length.should.equal(1);
      executionIssues[0].reasons.should.include.members([
        "missingType",
        "missingIdentifier",
        "missingProgram",
      ]);
      getIssueCodes(issues).should.not.include("invalidProvenanceEndpoint");
    });
  });
});
