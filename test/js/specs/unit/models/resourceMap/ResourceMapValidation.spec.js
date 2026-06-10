define([
  "/test/js/specs/shared/clean-state.js",
  "rdflib",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/GraphRead",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/GraphNormalization",
  "models/resourceMap/ResourceMapValidation",
  "common/ValidationUtilities",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (
  cleanState,
  rdf,
  ResourceMap,
  GraphRead,
  GraphMutation,
  GraphNormalization,
  ResourceMapValidation,
  ValidationUtilities,
  testUtils,
) => {
  chai.should();
  const ResourceMapGraph = Object.assign(
    GraphRead,
    GraphMutation,
    GraphNormalization,
  );
  const { createValidationReport } = ValidationUtilities;
  const {
    TEST_RESOLVE_BASE,
    createBaseResourceMap,
    getIssueCodes,
    getWarningCodes,
  } = testUtils;

  const state = cleanState(() => {
    const sandbox = sinon.createSandbox();
    return { sandbox };
  }, beforeEach);

  afterEach(() => {
    state.sandbox.restore();
  });

  describe("ResourceMapValidation", () => {
    it("validates metadata-only packages via implicit fallback without mutating the graph", () => {
      const resourceMap = new ResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.meta.only.1",
      });
      resourceMap.setMembers(["meta.only.1"]);

      ResourceMapGraph.collectDocLinks(resourceMap).should.deep.equal([]);

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      ResourceMapGraph.collectDocLinks(resourceMap).should.deep.equal([]);
      ("validationErrors" in resourceMap).should.equal(false);
      getIssueCodes(issues).should.not.include("missingPackageStructure");
      createValidationReport(issues).valid.should.equal(true);
    });

    it("treats self-documenting links as valid package structure", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "meta.1",
          },
        ],
      });

      ResourceMapGraph.synchronizeCoreGraph(resourceMap);

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      getIssueCodes(issues).should.not.include("missingPackageStructure");
      getIssueCodes(issues).should.not.include("selfDocumentingLink");
      createValidationReport(issues).valid.should.equal(true);
    });

    it("repairs malformed resource artifacts during canonicalization so validation sees the repaired graph", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.1",
        memberPids: ["meta.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "meta.1",
          },
        ],
        creatorName: "Temporary Creator",
      });
      const creatorNode = resourceMap.graph.statementsMatching(
        rdf.sym(resourceMap.resourceMapUri),
        resourceMap.ns.DC("creator"),
        undefined,
        undefined,
      )[0].object;
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));

      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        creatorNode,
        resourceMap.ns.FOAF("name"),
        undefined,
      );
      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        memberNode,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
      );
      resourceMap.graph.add(
        creatorNode,
        resourceMap.ns.FOAF("name"),
        rdf.sym("https://example.org/malformed-marker-foaf-name"),
      );
      resourceMap.graph.add(
        memberNode,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.sym("https://example.org/malformed-marker-identifier"),
      );
      resourceMap.graph.add(
        rdf.sym("https://example.org/member.legacy"),
        resourceMap.ns.ORE("isAggregatedBy"),
        rdf.sym("https://example.org/malformed-marker-isAggregatedBy"),
      );

      state.sandbox
        .stub(ResourceMapGraph, "extractMalformedResourceValue")
        .callsFake((value) => {
          if (value === "https://example.org/malformed-marker-identifier") {
            return {
              lexicalValue: "meta.1",
              datatypeUri: "http://www.w3.org/2001/XMLSchema#string",
              rawValue: value,
            };
          }
          if (value === "https://example.org/malformed-marker-foaf-name") {
            return {
              lexicalValue: "Recovered Creator",
              datatypeUri: "http://www.w3.org/2001/XMLSchema#string",
              rawValue: value,
            };
          }
          if (value === "https://example.org/malformed-marker-isAggregatedBy") {
            return {
              lexicalValue:
                "https://cn.dataone.org/cn/v1/resolve/resourceMap_legacy#aggregation",
              datatypeUri: "http://www.w3.org/2001/XMLSchema#anyURI",
              rawValue: value,
            };
          }
          return null;
        });

      resourceMap.mutateGraph(() => {}, { syncAfter: true });

      ResourceMapGraph.getCreatorName(resourceMap).should.equal(
        "Recovered Creator",
      );
      resourceMap.graph
        .statementsMatching(
          memberNode,
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) =>
          ResourceMapGraph.getLiteralObjectValue(statement.object),
        )
        .filter(Boolean)
        .should.include("meta.1");
      resourceMap.graph
        .statementsMatching(
          rdf.sym("https://example.org/member.legacy"),
          resourceMap.ns.ORE("isAggregatedBy"),
          undefined,
        )[0]
        .object.value.should.equal(
          "https://cn.dataone.org/cn/v1/resolve/resourceMap_legacy#aggregation",
        );
      getWarningCodes(
        ResourceMapValidation.validateResourceMap(resourceMap),
      ).should.deep.equal([]);
    });

    it("reports literal resource endpoints instead of treating them as valid member or documentation PIDs", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid:
          "resource_map_urn:uuid:rm.validation.literal.resources.1",
        memberPids: ["meta.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "meta.1",
          },
        ],
      });
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);

      resourceMap.graph.add(
        aggregationNode,
        resourceMap.ns.ORE("aggregates"),
        rdf.literal("literal.member.pid"),
      );
      resourceMap.graph.add(
        rdf.sym("https://example.org/unidentified-metadata"),
        resourceMap.ns.CITO("documents"),
        rdf.literal("literal.data.pid"),
      );

      ResourceMapGraph.collectMemberPids(resourceMap).should.deep.equal([
        "meta.1",
      ]);
      ResourceMapGraph.collectDocLinks(resourceMap).should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "meta.1",
        },
      ]);

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      getIssueCodes(issues).should.include("aggregatedResourceMissingPid");
      getIssueCodes(issues).should.include("documentsMissingMetadataPid");
      getIssueCodes(issues).should.include("documentsMissingDataPid");
    });

    it("reports cito:isDocumentedBy endpoints with literal, blank-node, and unknown values", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid:
          "resource_map_urn:uuid:rm.validation.isdocumentedby.endpoints.1",
        memberPids: ["meta.1", "data.1", "data.2", "data.3", "data.4"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const unknownDataSubject = rdf.sym(
        "https://example.org/unidentified-data",
      );
      const blankDataSubject = rdf.blankNode();
      const unknownMetadataObject = rdf.sym(
        "https://example.org/unidentified-metadata",
      );
      const blankMetadataObject = rdf.blankNode();

      resourceMap.graph.add(
        unknownDataSubject,
        resourceMap.ns.CITO("isDocumentedBy"),
        rdf.sym(resourceMap.getNodeUriForPid("meta.1")),
      );
      resourceMap.graph.add(
        blankDataSubject,
        resourceMap.ns.CITO("isDocumentedBy"),
        rdf.sym(resourceMap.getNodeUriForPid("meta.1")),
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.getNodeUriForPid("data.2")),
        resourceMap.ns.CITO("isDocumentedBy"),
        rdf.literal("literal.metadata.pid"),
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.getNodeUriForPid("data.3")),
        resourceMap.ns.CITO("isDocumentedBy"),
        blankMetadataObject,
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.getNodeUriForPid("data.4")),
        resourceMap.ns.CITO("isDocumentedBy"),
        unknownMetadataObject,
      );

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);
      const missingDataPidIssues = issues.filter(
        ({ code }) => code === "isDocumentedByMissingDataPid",
      );
      const missingMetadataPidIssues = issues.filter(
        ({ code }) => code === "isDocumentedByMissingMetadataPid",
      );

      missingDataPidIssues
        .map(({ subjectUri }) => subjectUri)
        .should.include(unknownDataSubject.value);
      missingDataPidIssues
        .map(({ subjectUri }) => subjectUri)
        .should.include(blankDataSubject.value);

      missingMetadataPidIssues
        .map(({ objectUri }) => objectUri)
        .should.include("literal.metadata.pid");
      missingMetadataPidIssues
        .map(({ objectUri }) => objectUri)
        .should.include(blankMetadataObject.value);
      missingMetadataPidIssues
        .map(({ objectUri }) => objectUri)
        .should.include(unknownMetadataObject.value);
    });

    it("still rejects multi-member packages without documentation links", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.multi.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [],
      });

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      getIssueCodes(issues).should.include("missingPackageStructure");
    });

    it("preserves explicit documentation links without adding fallback links", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.explicit.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      ResourceMapGraph.collectDocLinks(resourceMap).should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "data.1",
        },
      ]);
      getIssueCodes(issues).should.not.include("missingPackageStructure");
      createValidationReport(issues).valid.should.equal(true);
    });

    it("reports a missing resource map identifier on the root node", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.root.identifier.1",
        memberPids: ["meta.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "meta.1",
          },
        ],
      });
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);

      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        resourceMapNode,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
      );

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);
      const issue = issues.find(
        ({ code }) => code === "missingResourceMapIdentifier",
      );

      (!!issue).should.equal(true);
      issue.pid.should.equal(resourceMap.resourceMapPid);
      getIssueCodes(issues).should.not.include("missingResourceMapType");
    });

    it("reports non-hash aggregation URIs even when the graph backbone is otherwise present", () => {
      const resourceMap = new ResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.nonhash.1",
        resolveBase: TEST_RESOLVE_BASE,
      });
      const badAggregationUri = `${resourceMap.resourceMapUri}/aggregation`;
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);

      resourceMap.setMembers(["meta.1"]);

      resourceMap.mutateGraph(() => {
        const badAggregationNode = rdf.sym(badAggregationUri);
        const memberNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));

        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          resourceMapNode,
          resourceMap.ns.ORE("describes"),
          badAggregationNode,
        );
        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          badAggregationNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.ORE("Aggregation"),
        );
        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          badAggregationNode,
          resourceMap.ns.ORE("isDescribedBy"),
          resourceMapNode,
        );
        ResourceMapGraph.addStatementIfMissing(
          resourceMap,
          badAggregationNode,
          resourceMap.ns.ORE("aggregates"),
          memberNode,
        );
      });
      resourceMap.aggregationUri = badAggregationUri;

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);
      const issue = issues.find(({ code }) => code === "nonHashAggregationUri");

      (!!issue).should.equal(true);
      issue.aggregationUri.should.equal(badAggregationUri);
      issue.resourceMapUri.should.equal(resourceMap.resourceMapUri);
      getIssueCodes(issues).should.not.include("missingDescribes");
      getIssueCodes(issues).should.not.include("missingAggregationType");
      getIssueCodes(issues).should.not.include("missingIsDescribedBy");
      getIssueCodes(issues).should.not.include("missingAggregates");
    });

    it("returns the same issue codes for a deliberately broken resource map across root, member, documentation, and atLocation checks", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.regression.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);
      const metaNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const externalNode = rdf.sym(
        `${TEST_RESOLVE_BASE}/external.validation.1`,
      );

      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        resourceMapNode,
        resourceMap.ns.RDF("type"),
        resourceMap.ns.ORE("ResourceMap"),
      );
      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        resourceMapNode,
        resourceMap.ns.ORE("describes"),
        aggregationNode,
      );
      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        aggregationNode,
        resourceMap.ns.RDF("type"),
        resourceMap.ns.ORE("Aggregation"),
      );
      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        aggregationNode,
        resourceMap.ns.ORE("isDescribedBy"),
        resourceMapNode,
      );
      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        metaNode,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
      );
      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        dataNode,
        resourceMap.ns.CITO("isDocumentedBy"),
        metaNode,
      );
      ResourceMapGraph.removeStatementsMatching(
        resourceMap,
        resourceMapNode,
        resourceMap.ns.DCTERMS("modified"),
        undefined,
      );

      resourceMap.graph.add(
        rdf.sym("https://example.org/unidentified-metadata"),
        resourceMap.ns.CITO("documents"),
        rdf.literal("literal.data.pid"),
      );
      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("/absolute/path.csv"),
      );
      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/second-copy.csv"),
      );
      resourceMap.graph.add(
        externalNode,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal(
          "external.validation.1",
          undefined,
          resourceMap.ns.XSD("string"),
        ),
      );
      resourceMap.graph.add(
        externalNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("external/file.csv"),
      );
      resourceMap.graph.add(
        resourceMapNode,
        resourceMap.ns.DCTERMS("modified"),
        rdf.literal("not-a-date"),
      );

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      getIssueCodes(issues)
        .slice()
        .sort()
        .should.deep.equal([
          "atLocationMemberNotAggregated",
          "documentsMissingDataPid",
          "documentsMissingMetadataPid",
          "invalidModifiedDate",
          "missingAggregationType",
          "missingDescribes",
          "missingIsDescribedBy",
          "missingIsDocumentedByLink",
          "missingMemberIdentifier",
          "missingResourceMapType",
        ]);
    });

    it("reports unaggregated prov:atLocation values", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.locations.1",
        memberPids: ["meta.1", "data.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const externalNode = rdf.sym(`${TEST_RESOLVE_BASE}/external.1`);

      ResourceMapGraph.addStatement(
        resourceMap,
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("/absolute/path.csv"),
      );
      ResourceMapGraph.addStatement(
        resourceMap,
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/second-copy.csv"),
      );
      ResourceMapGraph.addStatement(
        resourceMap,
        externalNode,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal("external.1", undefined, resourceMap.ns.XSD("string")),
      );
      ResourceMapGraph.addStatement(
        resourceMap,
        externalNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("external/file.csv"),
      );

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      getIssueCodes(issues).should.include("atLocationMemberNotAggregated");
    });

    it("includes statement context when prov:atLocation cannot be resolved to a PID", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.locations.2",
        memberPids: ["meta.1"],
      });
      const unknownSubject = rdf.sym(
        "https://example.org/unidentified-resource",
      );

      resourceMap.graph.add(
        unknownSubject,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/untracked.csv"),
      );

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);
      const issue = issues.find(({ code }) => code === "atLocationWithoutPid");

      (!!issue).should.equal(true);
      issue.subjectUri.should.equal(unknownSubject.value);
      issue.atLocationValue.should.equal("data/untracked.csv");
    });

    it("accepts legacy-normalizable prov:atLocation values", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid:
          "resource_map_urn:uuid:rm.validation.legacy.locations.1",
        memberPids: ["meta.1", "data.1", "data.2", "data.3", "data.4"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      resourceMap.setLocation("data.1", "./q/../w.csv");
      resourceMap.setLocation("data.2", "~/q/w.csv");
      resourceMap.setLocation("data.3", "folder1///folder2/file.txt");
      resourceMap.setLocation("data.4", "~");

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      issues.should.deep.equal([]);
      resourceMap.getMember("data.1").should.deep.include({
        atLocations: ["./q/../w.csv"],
        displayAtLocations: ["w.csv"],
      });
      resourceMap.getMember("data.4").should.deep.include({
        atLocations: ["~"],
        displayAtLocations: ["/"],
      });
    });

    it("accepts root-escaping prov:atLocation values and normalizes them for display", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid:
          "resource_map_urn:uuid:rm.validation.invalid.locations.1",
        memberPids: ["meta.1", "data.1", "data.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      ResourceMapGraph.addStatement(
        resourceMap,
        rdf.sym(resourceMap.getNodeUriForPid("data.1")),
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("../x.csv"),
      );
      ResourceMapGraph.addStatement(
        resourceMap,
        rdf.sym(resourceMap.getNodeUriForPid("data.2")),
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("a/../../x.csv"),
      );

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      issues.should.deep.equal([]);
      resourceMap.getMember("data.1").should.deep.include({
        atLocations: ["../x.csv"],
        displayAtLocations: ["x.csv"],
      });
      resourceMap.getMember("data.2").should.deep.include({
        atLocations: ["a/../../x.csv"],
        displayAtLocations: ["x.csv"],
      });
    });

    it("accepts absolute, windows-style, and URL-like prov:atLocation values", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid:
          "resource_map_urn:uuid:rm.validation.invalid.locations.2",
        memberPids: ["meta.1", "data.1", "data.2", "data.3"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const invalidPaths = {
        "data.1": "/absolute/path.csv",
        "data.2": "C:/folder/file.csv",
        "data.3": "https://example.org/file.csv",
      };

      Object.entries(invalidPaths).forEach(([pid, path]) => {
        const memberNode = rdf.sym(resourceMap.getNodeUriForPid(pid));
        resourceMap.graph.add(
          memberNode,
          resourceMap.ns.PROV("atLocation"),
          rdf.literal(path),
        );
      });

      const issues = ResourceMapValidation.validateResourceMap(resourceMap);

      issues.should.deep.equal([]);
    });
  });
});
