define([
  "rdflib",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/ResourceMapValidation",
  "common/ValidationUtilities",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (
  rdf,
  GraphMutation,
  ResourceMapValidation,
  ValidationUtilities,
  testUtils,
) => {
  chai.should();
  const { createValidationReport } = ValidationUtilities;
  const { createBaseResourceMap, getIssueCodes } = testUtils;

  describe("ResourceMapValidation", () => {
    it("accepts a canonical resource map", () => {
      const resourceMap = createBaseResourceMap();

      ResourceMapValidation.validateResourceMap(resourceMap).should.deep.equal(
        [],
      );
      resourceMap.serialize({ validate: true }).should.be.a("string");
    });

    it("reports invalid package structure and blocks serialization", () => {
      const resourceMap = createBaseResourceMap();
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      GraphMutation.removeStatementsMatching(
        resourceMap,
        resourceMapNode,
        resourceMap.ns.RDF("type"),
        resourceMap.ns.ORE("ResourceMap"),
      );
      GraphMutation.removeStatementsMatching(
        resourceMap,
        memberNode,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
      );

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);
      const issue = issues.find(
        ({ code }) => code === "invalidPackageStructure",
      );

      issue.reasons.should.include.members([
        "missingResourceMapType",
        "missingMemberIdentifier",
      ]);
      createValidationReport(issues).valid.should.equal(false);
      (() => resourceMap.serialize({ validate: true })).should.throw(
        "ResourceMap validation failed",
      );
    });

    it("reports missing package structure", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [],
      });

      getIssueCodes(resourceMap.validate()).should.include(
        "missingPackageStructure",
      );
    });

    it("reports invalid documentation links", () => {
      const resourceMap = createBaseResourceMap();
      resourceMap.graph.add(
        rdf.sym("https://example.org/unknown-metadata"),
        resourceMap.ns.CITO("documents"),
        rdf.literal("literal-data"),
      );

      const issues = resourceMap.validate().filter(
        ({ code }) => code === "invalidDocumentationLink",
      );

      issues.length.should.equal(2);
      issues.map(({ reason }) => reason).should.include.members([
        "missingMetadataPid",
        "missingDataPid",
      ]);
    });

    it("reports invalid atLocation references", () => {
      const resourceMap = createBaseResourceMap();
      resourceMap.graph.add(
        rdf.sym("https://example.org/unknown-member"),
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/file.csv"),
      );

      const issue = resourceMap
        .validate()
        .find(({ code }) => code === "invalidAtLocationReference");

      issue.reason.should.equal("missingPid");
      issue.atLocationValue.should.equal("data/file.csv");
    });

    it("reports invalid modified dates as non-blocking warnings", () => {
      const resourceMap = createBaseResourceMap();
      GraphMutation.removeStatementsMatching(
        resourceMap,
        rdf.sym(resourceMap.resourceMapUri),
        resourceMap.ns.DCTERMS("modified"),
        undefined,
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.resourceMapUri),
        resourceMap.ns.DCTERMS("modified"),
        rdf.literal("not-a-date"),
      );

      const issues = resourceMap.validate();
      const issue = issues.find(({ code }) => code === "invalidModifiedDate");

      issue.severity.should.equal("warning");
      createValidationReport(issues).valid.should.equal(true);
    });
  });
});
