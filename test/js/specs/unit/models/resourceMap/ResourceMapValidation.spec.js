define([
  "rdflib",
  "models/resourceMap/ResourceMapValidation",
  "common/ValidationUtilities",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, ResourceMapValidation, ValidationUtilities, testUtils) => {
  chai.should();
  const { createValidationReport } = ValidationUtilities;
  const { TEST_RESOLVE_BASE, createBaseResourceMap, getIssueCodes } = testUtils;

  describe("ResourceMapValidation", () => {
    it("accepts a canonical resource map", () => {
      const resourceMap = createBaseResourceMap();

      ResourceMapValidation.validateResourceMap(resourceMap).should.deep.equal(
        [],
      );
      resourceMap.serialize({ validate: true }).should.be.a("string");
    });

    it("blocks a competing owner added after construction", () => {
      const resourceMap = createBaseResourceMap();

      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: rdf.sym("https://example.org/competing-resource-map"),
          predicate: resourceMap.ns.ORE("describes"),
          object: rdf.sym("https://example.org/competing-aggregation"),
        });
      });

      getIssueCodes(resourceMap.getEditBlockers()).should.include(
        "ambiguousResourceMapRoot",
      );
      (() => resourceMap.serialize({ validate: true })).should.throw(
        "ResourceMap validation failed",
      );
    });

    it("allows a duplicate of the selected ownership statement", () => {
      const resourceMap = createBaseResourceMap();

      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: rdf.sym(resourceMap.resourceMapUri),
          predicate: resourceMap.ns.ORE("describes"),
          object: rdf.sym(resourceMap.aggregationUri),
        });
      });

      resourceMap.validate().should.deep.equal([]);
      resourceMap.serialize({ validate: true }).should.be.a("string");
    });

    it("accepts an arbitrary member URL with an explicit identifier", () => {
      const resourceMap = createBaseResourceMap();
      const previousUri = resourceMap.getNodeUriForPid("data.1");
      const importedUri = "https://archive.example/files/original-data";
      resourceMap.mutateGraph(
        () => resourceMap.graph.replaceNodeValue(previousUri, importedUri),
        { markDirty: false },
      );

      ResourceMapValidation.validateResourceMap(resourceMap).should.deep.equal(
        [],
      );
      resourceMap.getNodeUriForPid("data.1").should.equal(importedUri);
      const xml = resourceMap.serialize({ validate: true });
      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        xml,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );

      reparsed.getNodeUriForPid("data.1").should.equal(importedUri);
    });

    it("blocks a known member URI whose identifiers all name another PID", () => {
      const objectServiceUrl = "https://mn.example/mn/v2/object";
      const resourceMap = createBaseResourceMap({ objectServiceUrl });
      const previousUri = resourceMap.getNodeUriForPid("data.1");
      const contradictoryUri = "https://mn.example/mn/v2/object/different.1";
      resourceMap.mutateGraph(
        () => resourceMap.graph.replaceNodeValue(previousUri, contradictoryUri),
        { markDirty: false },
      );

      const issues = resourceMap.validate();
      const issue = issues.find(
        ({ code }) => code === "memberIdentifierMismatch",
      );

      issue.should.deep.include({
        field: "resourceMap",
        severity: "error",
        code: "memberIdentifierMismatch",
        message: "A package member contains contradictory identifier claims.",
        memberUri: contradictoryUri,
        literalPids: ["data.1"],
        endpointPids: ["different.1"],
      });
      getIssueCodes(issues).should.not.include("invalidPackageStructure");
      (() => resourceMap.serialize({ validate: true })).should.throw(
        "ResourceMap validation failed",
      );
    });

    it("blocks conflicting literal identifiers even when one matches the URI", () => {
      const resourceMap = createBaseResourceMap();
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: memberNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal("data.alternate.1"),
          });
        },
        { markDirty: false },
      );

      const issue = resourceMap
        .getEditBlockers()
        .find(({ code }) => code === "memberIdentifierMismatch");
      issue.literalPids.should.have.members(["data.1", "data.alternate.1"]);
      (() => resourceMap.serialize({ validate: true })).should.throw(
        "ResourceMap validation failed",
      );
    });

    it("blocks equivalent duplicate identifiers added after construction", () => {
      const resourceMap = createBaseResourceMap();
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const equivalentIdentifier = "https://foreign.example/resolve/data.1";

      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: memberNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
          object: rdf.literal(equivalentIdentifier),
        });
      });

      const issue = resourceMap
        .getEditBlockers()
        .find(({ code }) => code === "noncanonicalIdentifier");

      issue.should.deep.include({
        field: "resourceMap",
        severity: "error",
        code: "noncanonicalIdentifier",
        nodeUri: memberNode.value,
        pid: "data.1",
        literalValues: ["data.1", equivalentIdentifier],
      });
      (() => resourceMap.serialize({ validate: true })).should.throw(
        "ResourceMap validation failed",
      );
      resourceMap
        .serialize({ validate: false })
        .should.contain(equivalentIdentifier);
    });

    it("blocks resource-valued identifiers without removing them", () => {
      const resourceMap = createBaseResourceMap();
      const rootNode = rdf.sym(resourceMap.resourceMapUri);
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const rootIdentifier = rdf.sym("https://example.org/root-identifier");
      const memberIdentifier = rdf.blankNode("member-identifier");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: rootNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rootIdentifier,
          });
          resourceMap.graph.addStatement({
            subject: memberNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: memberIdentifier,
          });
        },
        { markDirty: false },
      );

      resourceMap
        .getEditBlockers()
        .filter(({ code }) => code === "resourceValuedIdentifier")
        .should.have.lengthOf(2);
      resourceMap.graph
        .hasStatement({
          subject: rootNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
          object: rootIdentifier,
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: memberNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
          object: memberIdentifier,
        })
        .should.equal(true);
    });

    it("reports invalid package structure and blocks serialization", () => {
      const resourceMap = createBaseResourceMap();
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.removeStatementsMatching({
            subject: resourceMapNode,
            predicate: resourceMap.ns.RDF("type"),
            object: resourceMap.ns.ORE("ResourceMap"),
          });
          resourceMap.graph.removeStatementsMatching({
            subject: memberNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
          });
        },
        { markDirty: false },
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

    it("allows multi-member packages without CiTO", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [],
      });

      resourceMap.validate().should.deep.equal([]);
      resourceMap.serialize({ validate: true }).should.be.a("string");
      resourceMap.getDocumentationLinks().should.deep.equal([]);
    });

    it("rejects a Resource Map with no aggregated members", () => {
      const resourceMap = createBaseResourceMap({
        memberPids: [],
        documentationLinks: [],
      });

      resourceMap
        .validate()
        .find(({ code }) => code === "invalidPackageStructure")
        .reasons.should.include("missingAggregatedResource");
    });

    it("reports a missing reciprocal aggregation link", () => {
      const resourceMap = createBaseResourceMap();
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.removeStatementsMatching({
            subject: memberNode,
            predicate: resourceMap.ns.ORE("isAggregatedBy"),
            object: aggregationNode,
          });
        },
        { markDirty: false },
      );

      const issue = resourceMap
        .validate()
        .find(({ code }) => code === "invalidPackageStructure");

      issue.reasons.should.include("missingIsAggregatedBy");
    });

    it("reports distinct membership endpoints that claim the same PID", () => {
      const resourceMap = createBaseResourceMap();
      const duplicateUri = "https://another-cn.example/cn/v2/resolve/data.1";
      const duplicateNode = rdf.sym(duplicateUri);
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: aggregationNode,
            predicate: resourceMap.ns.ORE("aggregates"),
            object: duplicateNode,
          });
          resourceMap.graph.addStatement({
            subject: duplicateNode,
            predicate: resourceMap.ns.ORE("isAggregatedBy"),
            object: aggregationNode,
          });
          resourceMap.graph.addStatement({
            subject: duplicateNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal("data.1"),
          });
        },
        { markDirty: false },
      );

      const issue = resourceMap
        .validate()
        .find(({ code }) => code === "ambiguousMemberPid");

      issue.memberUris.should.have.members([
        resourceMap.pidToUri("data.1"),
        duplicateUri,
      ]);
    });

    it("blocks absolute inverse-only membership without an identifier", () => {
      const resourceMap = createBaseResourceMap();
      const unresolvedNode = rdf.sym("https://example.org/unresolved-member");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: unresolvedNode,
            predicate: resourceMap.ns.ORE("isAggregatedBy"),
            object: rdf.sym(resourceMap.aggregationUri),
          });
        },
        { markDirty: false },
      );

      resourceMap
        .validate()
        .find(({ code }) => code === "missingMemberIdentifier")
        .memberUri.should.equal(unresolvedNode.value);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(resourceMap.aggregationUri),
          predicate: resourceMap.ns.ORE("aggregates"),
          object: unresolvedNode,
        })
        .should.equal(false);
    });

    it("blocks relative and blank-node member terms", () => {
      const resourceMap = createBaseResourceMap();
      const relativeNode = rdf.sym("relative-member.1");
      const blankNode = rdf.blankNode("blank-member");
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: relativeNode,
            predicate: resourceMap.ns.ORE("isAggregatedBy"),
            object: aggregationNode,
          });
          resourceMap.graph.addStatement({
            subject: aggregationNode,
            predicate: resourceMap.ns.ORE("aggregates"),
            object: blankNode,
          });
        },
        { markDirty: false },
      );

      getIssueCodes(resourceMap.getEditBlockers()).should.include.members([
        "relativeMember",
        "invalidMemberTerm",
      ]);
      resourceMap.graph
        .hasStatement({
          subject: aggregationNode,
          predicate: resourceMap.ns.ORE("aggregates"),
          object: relativeNode,
        })
        .should.equal(false);
    });

    it("ignores documentation links whose subject is not a member", () => {
      const resourceMap = createBaseResourceMap();
      const metadataNode = rdf.sym(resourceMap.pidToUri("external-meta.1"));
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: metadataNode,
            predicate: resourceMap.ns.CITO("documents"),
            object: dataNode,
          });
        },
        { markDirty: false },
      );

      const issues = resourceMap
        .validate()
        .filter(({ code }) => code === "invalidDocumentationLink");

      issues.should.deep.equal([]);
      resourceMap.serialize({ validate: true }).should.be.a("string");
    });

    it("does not let a safe pair hide an unsafe same-PID alias edge", () => {
      const resourceMap = createBaseResourceMap();
      const metadataNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));
      const aliasNode = rdf.sym("https://old-cn.example/resolve/data.1");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: aliasNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal("data.1"),
          });
          resourceMap.graph.addStatement({
            subject: metadataNode,
            predicate: resourceMap.ns.CITO("documents"),
            object: aliasNode,
          });
        },
        { markDirty: false },
      );

      const issues = resourceMap
        .getEditBlockers()
        .filter(({ code }) => code === "invalidDocumentationLink");
      issues.should.have.lengthOf(1);
      issues[0].reason.should.equal("objectNotAggregated");
      issues[0].object.value.should.equal(aliasNode.value);
    });

    it("reports invalid documentation links that touch a member", () => {
      const resourceMap = createBaseResourceMap();
      const metadataNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: metadataNode,
            predicate: resourceMap.ns.CITO("documents"),
            object: rdf.literal("literal-data"),
          });
        },
        { markDirty: false },
      );

      const issues = resourceMap
        .validate()
        .filter(({ code }) => code === "invalidDocumentationLink");

      issues.length.should.equal(1);
      issues[0].reason.should.equal("objectNotAggregated");
    });

    it("ignores atLocation statements on external provenance resources", () => {
      const resourceMap = createBaseResourceMap();
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: rdf.sym("https://example.org/external-activity"),
            predicate: resourceMap.ns.PROV("atLocation"),
            object: rdf.literal("cluster-a"),
          });
        },
        { markDirty: false },
      );

      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidAtLocationReference",
      );
      resourceMap.serialize({ validate: true }).should.be.a("string");
    });

    it("reports invalid modified dates as non-blocking warnings", () => {
      const resourceMap = createBaseResourceMap();
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.removeStatementsMatching({
            subject: rdf.sym(resourceMap.resourceMapUri),
            predicate: resourceMap.ns.DCTERMS("modified"),
          });
          resourceMap.graph.addStatement({
            subject: rdf.sym(resourceMap.resourceMapUri),
            predicate: resourceMap.ns.DCTERMS("modified"),
            object: rdf.literal("not-a-date"),
          });
        },
        { markDirty: false },
      );

      const issues = resourceMap.validate();
      const issue = issues.find(({ code }) => code === "invalidModifiedDate");

      issue.severity.should.equal("warning");
      createValidationReport(issues).valid.should.equal(true);
      resourceMap.getEditBlockers().should.deep.equal([]);
    });

    it("reports an invalid modified date when another value is valid", () => {
      const resourceMap = createBaseResourceMap();
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: rdf.sym(resourceMap.resourceMapUri),
            predicate: resourceMap.ns.DC("modified"),
            object: rdf.literal("not-a-date"),
          });
        },
        { markDirty: false },
      );

      const issue = resourceMap
        .validate()
        .find(({ code }) => code === "invalidModifiedDate");

      issue.modified.should.equal("not-a-date");
    });
  });
});
