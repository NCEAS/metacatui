define([
  "rdflib",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/Provenance",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/GraphNormalization",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/ResourceMapState",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (
  rdf,
  ResourceMap,
  Provenance,
  GraphMutation,
  GraphNormalization,
  ResourceMapCommon,
  ResourceMapState,
  testUtils,
) => {
  chai.should();
  const expect = chai.expect;
  const ns = {
    RDF: rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    DCTERMS: rdf.Namespace("http://purl.org/dc/terms/"),
    ORE: rdf.Namespace("http://www.openarchives.org/ore/terms/"),
    CITO: rdf.Namespace("http://purl.org/spar/cito/"),
    XSD: rdf.Namespace("http://www.w3.org/2001/XMLSchema#"),
  };

  const {
    COMPREHENSIVE_XML,
    DCTERMS_CREATOR_XML,
    MISSING_IDENTIFIER_XML,
    PREFIX_ALIAS_CREATOR_XML,
    createBaseResourceMap,
    createMalformedArtifactResourceMap,
    getIssueCodes,
    TEST_RESOLVE_BASE,
  } = testUtils;
  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;

  /**
   * Collect the creator statements on the resource map node.
   * @param {ResourceMap} resourceMap Test resource map.
   * @returns {object[]} `dc:creator` and `dcterms:creator` statements.
   */
  function creatorStatements(resourceMap) {
    const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
    return [
      ...resourceMap.graph.statementsMatching(
        resourceMapNode,
        resourceMap.ns.DC("creator"),
        undefined,
        undefined,
      ),
      ...resourceMap.graph.statementsMatching(
        resourceMapNode,
        resourceMap.ns.DCTERMS("creator"),
        undefined,
        undefined,
      ),
    ];
  }

  describe("ResourceMap Test Suite", () => {
    // Ensure there is a resolveServiceUrl and a objectServiceUrl in the app
    // config for tests that rely on them, and restore any existing app config
    // after the tests complete.
    const originalAppModel = globalThis.MetacatUI?.appModel;
    before(() => {
      globalThis.MetacatUI = {
        ...globalThis.MetacatUI,
        appModel: {
          get(key) {
            if (key === "objectServiceUrl") {
              return "https://mn.test.dataone.org/mn/v2/object";
            }
            if (key === "resolveServiceUrl") {
              return TEST_RESOLVE_BASE;
            }
            return null;
          },
        },
      };
    });

    after(() => {
      globalThis.MetacatUI = {
        ...globalThis.MetacatUI,
        appModel: originalAppModel,
      };
    });

    it("builds namespace functions from the built-in namespace URIs", () => {
      const resourceMap = new ResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.1",
      });

      resourceMap.namespaces.should.include({
        RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        ORE: "http://www.openarchives.org/ore/terms/",
      });
      resourceMap.ns
        .RDF("type")
        .value.should.equal("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
      resourceMap.ns
        .ORE("Aggregation")
        .value.should.equal(
          "http://www.openarchives.org/ore/terms/Aggregation",
        );
    });

    it("parses the current public surface and provenance projections", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );

      expect(resourceMap.provenance).to.be.instanceOf(Provenance);
      resourceMap.resourceMapPid.should.equal("resource_map_urn:uuid:rm.1");
      resourceMap.resourceMapUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn:uuid:rm.1`,
      );
      resourceMap.aggregationUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn:uuid:rm.1#aggregation`,
      );
      resourceMap.resolveBase.should.equal(`${TEST_RESOLVE_BASE}/`);
      resourceMap.getSummary().creatorName.should.equal("Example Creator");
      resourceMap
        .getSummary()
        .modified.should.equal("2026-03-24T10:00:00.000Z");
      resourceMap
        .getMemberPids()
        .should.have.members([
          "meta.1",
          "data.1",
          "derived.1",
          "script.1",
          "script.2",
          "resource_map_doi:10.18739/A2NESTED",
        ]);
      resourceMap.getMetadataPids().should.deep.equal(["meta.1"]);
      resourceMap
        .getDocumentedObjectPids()
        .should.have.members(["data.1", "resource_map_doi:10.18739/A2NESTED"]);

      resourceMap.getMetadataPids().length.should.be.greaterThan(0);

      resourceMap.hasMember("data.1").should.equal(true);
      resourceMap.hasMember("missing.1").should.equal(false);

      const dataMember = resourceMap.getMember("data.1");
      dataMember.should.deep.include({
        pid: "data.1",
        uri: `${TEST_RESOLVE_BASE}/data.1`,
      });
      dataMember.atLocations.should.deep.equal(["data/data.csv"]);
      dataMember.displayAtLocations.should.deep.equal(["data/data.csv"]);
      dataMember.isDocumentedBy.should.deep.equal(["meta.1"]);
      dataMember.documents.should.deep.equal([]);
      resourceMap
        .getMembers()
        .map((member) => member.pid)
        .should.have.members([
          "meta.1",
          "data.1",
          "derived.1",
          "script.1",
          "script.2",
          "resource_map_doi:10.18739/A2NESTED",
        ]);
    });

    it("parses raw XML that mixes CN resolve hosts", () => {
      // Replace one member PID's resolve URI to simulate parsing XML from a
      // source that mixes CN resolve hosts.
      const mixedCnResolveXml = COMPREHENSIVE_XML.replace(
        /https:\/\/cn\.dataone\.org\/cn\/v2\/resolve\/data\.1/g,
        `${TEST_RESOLVE_BASE}/data.1`,
      );

      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        mixedCnResolveXml,
      );

      resourceMap.getMemberPids().should.include("data.1");
      resourceMap
        .getNodeUriForPid("data.1")
        .should.equal(`${TEST_RESOLVE_BASE}/data.1`);
    });

    it("parses raw XML that mixes object-service and resolve-service absolute URIs", () => {
      const mixedAbsoluteUriXml = COMPREHENSIVE_XML.replace(
        /https:\/\/cn\.dataone\.org\/cn\/v2\/resolve\/data\.1/g,
        "https://mn-stage.test.dataone.org/mn/v2/object/data.1",
      );

      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        mixedAbsoluteUriXml,
        {
          resolveBase: TEST_RESOLVE_BASE,
        },
      );

      resourceMap.getMemberPids().should.include("data.1");
      resourceMap
        .getNodeUriForPid("data.1")
        .should.equal(`${TEST_RESOLVE_BASE}/data.1`);
    });

    it("parses relative RDF/XML URIs with a parseBase different from resolveBase", () => {
      const relativeUriXml = COMPREHENSIVE_XML.replace(
        /https:\/\/cn\.dataone\.org\/cn\/v2\/resolve\/data\.1/g,
        "data.1",
      );

      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        relativeUriXml,
        {
          parseBase: "https://mn-stage.test.dataone.org/mn/v2/object/",
          resolveBase: TEST_RESOLVE_BASE,
        },
      );

      resourceMap.getMemberPids().should.include("data.1");
      resourceMap
        .getNodeUriForPid("data.1")
        .should.equal(`${TEST_RESOLVE_BASE}/data.1`);
    });

    it("parses with an object-service parseBase without treating it as the canonical resolve base", () => {
      const relativeUriXml = COMPREHENSIVE_XML.replace(
        /https:\/\/cn\.dataone\.org\/cn\/v2\/resolve\/data\.1/g,
        "data.1",
      );

      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        relativeUriXml,
        {
          parseBase: "https://mn-stage.test.dataone.org/mn/v2/object/",
          resolveServiceUrl: TEST_RESOLVE_BASE,
        },
      );

      resourceMap.resolveBase.should.equal(`${TEST_RESOLVE_BASE}/`);
      resourceMap
        .getNodeUriForPid("data.1")
        .should.equal(`${TEST_RESOLVE_BASE}/data.1`);
    });

    it("reuses one package-wide cached summary across member and summary reads", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const sandbox = sinon.createSandbox();

      try {
        const buildGraphIndexSpy = sandbox.spy(
          ResourceMapState.prototype,
          "buildGraphIndex",
        );
        resourceMap.getMembers().length.should.equal(6);
        resourceMap.getMember("data.1").should.deep.include({
          pid: "data.1",
        });
        resourceMap
          .getMember("data.1")
          .atLocations.should.deep.equal(["data/data.csv"]);
        resourceMap
          .toJSON()
          .memberPids.should.have.members([
            "meta.1",
            "data.1",
            "derived.1",
            "script.1",
            "script.2",
            "resource_map_doi:10.18739/A2NESTED",
          ]);

        buildGraphIndexSpy.callCount.should.equal(1);
      } finally {
        sandbox.restore();
      }
    });

    it("batches member removals and additions in one graph mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.members.replace.batch.1",
        memberPids: ["meta.1", "data.1", "data.2", "data.3"],
      });
      const sandbox = sinon.createSandbox();

      try {
        const mutateGraphSpy = sandbox.spy(resourceMap, "mutateGraph");
        const collectReferencesSpy = sandbox.spy(
          resourceMap.provenance,
          "collectMemberReferenceRemovals",
        );

        resourceMap.setMembers(["meta.1", "data.4"]);

        mutateGraphSpy.callCount.should.equal(1);
        collectReferencesSpy.callCount.should.equal(1);
        resourceMap.getMemberPids().should.have.members(["meta.1", "data.4"]);
      } finally {
        sandbox.restore();
      }
    });

    it("batches shared provenance cleanup during bulk member removal", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.members.prov.batch.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });
      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.members.prov.batch.1",
      });
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.members.prov.batch.1",
      });
      const sandbox = sinon.createSandbox();

      try {
        const provenanceMutationSpy = sandbox.spy(
          resourceMap.provenance,
          "mutateGraph",
        );

        resourceMap.setMembers(["meta.1"]);

        provenanceMutationSpy.callCount.should.equal(1);
        resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
        resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
        resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
        resourceMap.getMemberPids().should.deep.equal(["meta.1"]);
        resourceMap
          .serialize({ validate: false })
          .should.not.contain("urn:uuid:exec.members.prov.batch.1");
      } finally {
        sandbox.restore();
      }
    });

    it("invalidates the cached summary after graph mutations routed through mutateGraph", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const sandbox = sinon.createSandbox();

      try {
        const buildGraphIndexSpy = sandbox.spy(
          ResourceMapState.prototype,
          "buildGraphIndex",
        );

        resourceMap.getMember("data.1").should.deep.include({
          atLocations: ["data/data.csv"],
          displayAtLocations: ["data/data.csv"],
        });

        resourceMap.mutateGraph(() => {
          const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

          GraphMutation.removeStatementsMatching(
            resourceMap,
            memberNode,
            resourceMap.ns.PROV("atLocation"),
            undefined,
          );
          resourceMap.graph.add(
            memberNode,
            resourceMap.ns.PROV("atLocation"),
            rdf.literal("./renamed/../updated.csv"),
          );
        });

        resourceMap.getMember("data.1").should.deep.include({
          atLocations: ["./renamed/../updated.csv"],
          displayAtLocations: ["updated.csv"],
        });

        buildGraphIndexSpy.callCount.should.equal(2);
      } finally {
        sandbox.restore();
      }
    });

    it("keeps projected reads on one stable State snapshot during mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.live.member.reads.1",
        memberPids: ["meta.1", "data.1"],
      });
      const sandbox = sinon.createSandbox();
      const documentationLinks = resourceMap.getDocumentationLinks();
      const buildGraphIndexSpy = sandbox.spy(
        ResourceMapState.prototype,
        "buildGraphIndex",
      );

      try {
        resourceMap.mutateGraph(() => {
          resourceMap
            .getNodeUriForPid("data.1")
            .should.equal(resourceMap.pidToUri("data.1"));
          resourceMap.hasMember("data.1").should.equal(true);
          resourceMap.getMemberPids().should.have.members(["meta.1", "data.1"]);
          resourceMap
            .getDocumentationLinks()
            .should.deep.equal(documentationLinks);
        });

        resourceMap.replaceMember("data.1", "data.renamed.1");
      } finally {
        sandbox.restore();
      }

      resourceMap.hasMember("data.renamed.1").should.equal(true);
      resourceMap.hasMember("data.1").should.equal(false);
      buildGraphIndexSpy.callCount.should.equal(1);
    });

    it("rejects lazy State construction after mutation begins", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.mutation.state.guard.1",
        memberPids: ["meta.1", "data.1"],
      });

      resourceMap.invalidateGraphState();

      expect(() => {
        resourceMap.mutateGraph(() => {
          resourceMap.getMemberPids();
        });
      }).to.throw(
        "ResourceMapState must be built before starting a graph mutation",
      );
    });

    it("tracks saved graph changes and reparses the saved baseline", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.changes.1",
        memberPids: ["meta.1", "data.1", "source.1"],
      });

      resourceMap.markSaved();
      resourceMap.hasUnsavedChanges().should.equal(false);

      resourceMap.provenance.addWasDerivedFrom("data.1", "source.1");
      resourceMap.hasUnsavedChanges().should.equal(true);

      const restoredResourceMap = resourceMap.reparseRawData();
      restoredResourceMap.hasUnsavedChanges().should.equal(false);
      restoredResourceMap.provenance
        .getWasDerivedFromLinks()
        .should.deep.equal([]);
    });

    it("does not mark normalization changes unsaved unless requested", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.dirty.1",
        memberPids: ["meta.1", "data.1"],
      });
      const canonicalUri = resourceMap.getNodeUriForPid("data.1");
      const customUri = "https://example.org/custom/member/normalize";

      resourceMap.mutateGraph(() => {
        GraphMutation.replaceNodeValue(resourceMap, canonicalUri, customUri);
      });
      resourceMap.markSaved();

      resourceMap.normalize();
      resourceMap.hasUnsavedChanges().should.equal(false);

      resourceMap.mutateGraph(() => {
        GraphMutation.replaceNodeValue(resourceMap, canonicalUri, customUri);
      });
      resourceMap.markSaved();

      resourceMap.normalize({ markDirty: true });
      resourceMap.hasUnsavedChanges().should.equal(true);
    });

    it("rolls back normalization when synchronization throws", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.rollback.1",
        memberPids: ["meta.1", "data.1"],
      });
      const sandbox = sinon.createSandbox();
      const subject = rdf.sym("urn:uuid:normalization.rollback.subject");
      const predicate = rdf.sym("urn:uuid:normalization.rollback.predicate");

      resourceMap.markSaved();

      try {
        sandbox
          .stub(GraphNormalization, "synchronizeCoreGraph")
          .callsFake(() => {
            GraphMutation.addStatement(
              resourceMap,
              subject,
              predicate,
              rdf.literal("partial normalization"),
            );
            throw new Error("Normalization synchronization failed");
          });

        expect(() => resourceMap.normalize()).to.throw(
          "Normalize failed: Normalization synchronization failed",
        );
        resourceMap.graph
          .statementsMatching(subject, predicate, undefined, undefined)
          .should.deep.equal([]);
        resourceMap.hasUnsavedChanges().should.equal(false);
      } finally {
        sandbox.restore();
      }
    });

    it("rolls back an outer graph mutation when it throws", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.rollback.1",
        memberPids: ["meta.1", "data.1", "source.1"],
      });

      resourceMap.markSaved();

      expect(() =>
        resourceMap.mutateGraph(
          () => {
            resourceMap.provenance.addWasDerivedFrom("data.1", "source.1");
            throw new Error("Mutation failed");
          },
          { rollbackOnError: true },
        ),
      ).to.throw(/mutation failed/i);

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("creates new maps using the configured app resolve base URL", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.async.create.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      resourceMap.resolveBase.should.equal(`${TEST_RESOLVE_BASE}/`);
      resourceMap.resourceMapUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn:uuid:rm.async.create.1`,
      );
    });

    it("builds canonical resolve URIs from the normalized resolve base URL", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.async.create.2",
        resolveBase: TEST_RESOLVE_BASE,
      });

      resourceMap
        .pidToUri("doi:10.1234/example file")
        .should.equal(`${TEST_RESOLVE_BASE}/doi:10.1234%2Fexample%20file`);
    });

    it("stores normalized resolveBase from resolveServiceUrl", () => {
      const resourceMap = new ResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.services.1",
        objectServiceUrl: "https://mn-stage.test.dataone.org/mn/v2/object",
        resolveServiceUrl: TEST_RESOLVE_BASE,
      });
      resourceMap.resolveBase.should.equal(`${TEST_RESOLVE_BASE}/`);
    });

    it("defaults constructor service URLs from app config when omitted", () => {
      const resourceMap = new ResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.services.2",
      });
      resourceMap.resolveBase.should.equal(`${TEST_RESOLVE_BASE}/`);
    });

    it("parses maps while preserving resolve-base inference from RDF", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );

      resourceMap.resolveBase.should.equal(`${TEST_RESOLVE_BASE}/`);
      resourceMap.resourceMapUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn:uuid:rm.1`,
      );
    });

    it("canonicalizes legacy root URI variants when adopting an existing graph", () => {
      const resourceMapPid = "resource_map_urn:uuid:legacy.root.1";
      const resolveBase = TEST_RESOLVE_BASE;
      const canonicalResourceMapUri = `${resolveBase}/${resourceMapPid}`;
      const rootVariants = [
        resourceMapPid,
        encodeURIComponent(resourceMapPid),
        `${resolveBase}${encodeURIComponent(resourceMapPid)}`,
        `${resolveBase}${resourceMapPid}`,
        "https://example.org/custom/resource map",
      ];

      rootVariants.forEach((rootUri) => {
        const graph = rdf.graph();
        const rootNode = rdf.sym(rootUri);
        const aggregationNode = rdf.sym(`${rootUri}#legacy-aggregation`);
        const memberNode = rdf.sym("meta.1");

        graph.add(rootNode, ns.RDF("type"), ns.ORE("ResourceMap"));
        graph.add(
          rootNode,
          ns.DCTERMS("identifier"),
          rdf.literal(resourceMapPid, undefined, ns.XSD("string")),
        );
        graph.add(rootNode, ns.ORE("describes"), aggregationNode);
        graph.add(aggregationNode, ns.RDF("type"), ns.ORE("Aggregation"));
        graph.add(aggregationNode, ns.ORE("isDescribedBy"), rootNode);
        graph.add(aggregationNode, ns.ORE("aggregates"), memberNode);
        graph.add(memberNode, ns.ORE("isAggregatedBy"), aggregationNode);
        graph.add(
          memberNode,
          ns.DCTERMS("identifier"),
          rdf.literal("meta.1", undefined, ns.XSD("string")),
        );
        graph.add(memberNode, ns.CITO("documents"), memberNode);
        graph.add(memberNode, ns.CITO("isDocumentedBy"), memberNode);

        const resourceMap = new ResourceMap({
          resourceMapPid,
          graph,
          resolveBase,
        });

        resourceMap.resourceMapUri.should.equal(canonicalResourceMapUri);
        resourceMap.aggregationUri.should.equal(
          `${canonicalResourceMapUri}#aggregation`,
        );
        resourceMap
          .getNodeUriForPid("meta.1")
          .should.equal(`${resolveBase}/meta.1`);
      });
    });

    it("collapses simultaneous legacy managed-node variants onto canonical nodes while preserving attached RDF", () => {
      const resourceMapPid = "resource_map_urn:uuid:legacy.merge.1";
      const resolveBase = TEST_RESOLVE_BASE;
      const rootBareUri = resourceMapPid;
      const rootCustomUri = "https://example.org/custom/root";
      const aggregationLegacyUri = "https://example.org/custom/aggregation";
      const memberBareUri = "data.1";
      const memberCustomUri = "https://example.org/custom/member/data.1";
      const rootNotePredicate = rdf.sym("https://example.org/test#rootNote");
      const memberNotePredicate = rdf.sym(
        "https://example.org/test#memberNote",
      );
      const graph = rdf.graph();

      graph.add(rdf.sym(rootBareUri), ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(
        rdf.sym(rootCustomUri),
        ns.DCTERMS("identifier"),
        rdf.literal(resourceMapPid, undefined, ns.XSD("string")),
      );
      graph.add(
        rdf.sym(rootBareUri),
        ns.ORE("describes"),
        rdf.sym(aggregationLegacyUri),
      );
      graph.add(
        rdf.sym(aggregationLegacyUri),
        ns.RDF("type"),
        ns.ORE("Aggregation"),
      );
      graph.add(
        rdf.sym(aggregationLegacyUri),
        ns.ORE("isDescribedBy"),
        rdf.sym(rootCustomUri),
      );
      graph.add(
        rdf.sym(aggregationLegacyUri),
        ns.ORE("aggregates"),
        rdf.sym(memberBareUri),
      );
      graph.add(
        rdf.sym(memberCustomUri),
        ns.ORE("isAggregatedBy"),
        rdf.sym(aggregationLegacyUri),
      );
      graph.add(
        rdf.sym(memberCustomUri),
        ns.DCTERMS("identifier"),
        rdf.literal("data.1", undefined, ns.XSD("string")),
      );
      graph.add(
        rdf.sym(rootCustomUri),
        rootNotePredicate,
        rdf.literal("preserve root note"),
      );
      graph.add(
        rdf.sym(memberCustomUri),
        memberNotePredicate,
        rdf.literal("preserve member note"),
      );

      const resourceMap = new ResourceMap({
        resourceMapPid,
        graph,
        resolveBase,
      });
      const canonicalRootNode = rdf.sym(`${resolveBase}/${resourceMapPid}`);
      const canonicalMemberNode = rdf.sym(`${resolveBase}/data.1`);

      resourceMap.resourceMapUri.should.equal(
        `${resolveBase}/${resourceMapPid}`,
      );
      resourceMap.aggregationUri.should.equal(
        `${resolveBase}/${resourceMapPid}#aggregation`,
      );
      resourceMap
        .getNodeUriForPid("data.1")
        .should.equal(`${resolveBase}/data.1`);
      resourceMap.graph
        .statementsMatching(canonicalRootNode, rootNotePredicate, undefined)
        .map((statement) => statement.object.value)
        .should.deep.equal(["preserve root note"]);
      resourceMap.graph
        .statementsMatching(canonicalMemberNode, memberNotePredicate, undefined)
        .map((statement) => statement.object.value)
        .should.deep.equal(["preserve member note"]);
      resourceMap.graph
        .statementsMatching(rdf.sym(rootCustomUri), undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(rdf.sym(memberCustomUri), undefined, undefined)
        .length.should.equal(0);
    });

    it("canonicalizes complex legacy package and provenance graphs with oddly encoded PIDs", () => {
      const resourceMapPid = "resource_map_doi:10.5063/F1+RM";
      const metadataPid = "meta:10.5063/F1+META";
      const dataPid = "doi:10.5063/F1+DATA";
      const derivedPid = "doi:10.5063/F1+DERIVED";
      const programPid = "doi:10.5063/F1+PROGRAM";
      const resolveBase = TEST_RESOLVE_BASE;
      const canonicalResourceMapUri = `${resolveBase}/resource_map_doi:10.5063%2FF1%2BRM`;
      const canonicalDataUri = `${resolveBase}/doi:10.5063%2FF1%2BDATA`;
      const graph = rdf.graph();
      const rootBareNode = rdf.sym(resourceMapPid);
      const rootCustomNode = rdf.sym("https://example.org/legacy/root");
      const aggregationNode = rdf.sym("https://example.org/legacy/aggregation");
      const metadataBareNode = rdf.sym(metadataPid);
      const dataCustomNode = rdf.sym("https://example.org/legacy/data");
      const derivedRawResolveNode = rdf.sym(`${resolveBase}${derivedPid}`);
      const programEncodedOnlyNode = rdf.sym(encodeURIComponent(programPid));
      const executionNode = rdf.sym("urn:uuid:exec.legacy.canonical.1");
      const associationNode = rdf.blankNode();
      const provQualifiedAssociation = rdf.sym(
        "http://www.w3.org/ns/prov#qualifiedAssociation",
      );
      const provHadPlan = rdf.sym("http://www.w3.org/ns/prov#hadPlan");
      const provUsed = rdf.sym("http://www.w3.org/ns/prov#used");
      const provWasGeneratedBy = rdf.sym(
        "http://www.w3.org/ns/prov#wasGeneratedBy",
      );
      const provWasDerivedFrom = rdf.sym(
        "http://www.w3.org/ns/prov#wasDerivedFrom",
      );
      const provoneExecution = rdf.sym(
        "http://purl.dataone.org/provone/2015/01/15/ontology#Execution",
      );

      graph.add(
        rootCustomNode,
        ns.DCTERMS("identifier"),
        rdf.literal(resourceMapPid),
      );
      graph.add(rootBareNode, ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(rootBareNode, ns.ORE("describes"), aggregationNode);
      graph.add(aggregationNode, ns.RDF("type"), ns.ORE("Aggregation"));
      graph.add(aggregationNode, ns.ORE("isDescribedBy"), rootCustomNode);
      graph.add(aggregationNode, ns.ORE("aggregates"), metadataBareNode);
      graph.add(aggregationNode, ns.ORE("aggregates"), dataCustomNode);
      graph.add(aggregationNode, ns.ORE("aggregates"), derivedRawResolveNode);
      graph.add(aggregationNode, ns.ORE("aggregates"), programEncodedOnlyNode);
      graph.add(metadataBareNode, ns.ORE("isAggregatedBy"), aggregationNode);
      graph.add(dataCustomNode, ns.ORE("isAggregatedBy"), aggregationNode);
      graph.add(
        derivedRawResolveNode,
        ns.ORE("isAggregatedBy"),
        aggregationNode,
      );
      graph.add(
        programEncodedOnlyNode,
        ns.ORE("isAggregatedBy"),
        aggregationNode,
      );
      graph.add(
        metadataBareNode,
        ns.DCTERMS("identifier"),
        rdf.literal(metadataPid, undefined, ns.XSD("string")),
      );
      graph.add(
        dataCustomNode,
        ns.DCTERMS("identifier"),
        rdf.literal(dataPid, undefined, ns.XSD("string")),
      );
      graph.add(
        derivedRawResolveNode,
        ns.DCTERMS("identifier"),
        rdf.literal(derivedPid, undefined, ns.XSD("string")),
      );
      graph.add(
        programEncodedOnlyNode,
        ns.DCTERMS("identifier"),
        rdf.literal(programPid, undefined, ns.XSD("string")),
      );
      graph.add(metadataBareNode, ns.CITO("documents"), dataCustomNode);
      graph.add(dataCustomNode, ns.CITO("isDocumentedBy"), metadataBareNode);
      graph.add(derivedRawResolveNode, provWasDerivedFrom, dataCustomNode);
      graph.add(derivedRawResolveNode, provWasGeneratedBy, executionNode);
      graph.add(
        executionNode,
        ns.DCTERMS("identifier"),
        rdf.literal(executionNode.value),
      );
      graph.add(executionNode, ns.RDF("type"), provoneExecution);
      graph.add(executionNode, provQualifiedAssociation, associationNode);
      graph.add(associationNode, provHadPlan, programEncodedOnlyNode);
      graph.add(executionNode, provUsed, dataCustomNode);

      const resourceMap = new ResourceMap({
        resourceMapPid,
        graph,
        resolveBase,
      });

      resourceMap.resourceMapUri.should.equal(canonicalResourceMapUri);
      resourceMap.aggregationUri.should.equal(
        `${canonicalResourceMapUri}#aggregation`,
      );
      resourceMap
        .getNodeUriForPid(metadataPid)
        .should.equal(`${resolveBase}/meta:10.5063%2FF1%2BMETA`);
      resourceMap.getNodeUriForPid(dataPid).should.equal(canonicalDataUri);
      resourceMap
        .getNodeUriForPid(derivedPid)
        .should.equal(`${resolveBase}/doi:10.5063%2FF1%2BDERIVED`);
      resourceMap
        .getNodeUriForPid(programPid)
        .should.equal(`${resolveBase}/doi:10.5063%2FF1%2BPROGRAM`);
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid,
          dataPid,
        },
      ]);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([
        {
          derivedPid,
          sourcePid: dataPid,
        },
      ]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: derivedPid,
          programPid,
          executionId: executionNode.value,
          agentUri: null,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid,
          programPid,
          executionId: executionNode.value,
          agentUri: null,
        },
      ]);

      const namedNodeValues = [
        ...new Set(
          resourceMap.graph.statements
            .flatMap((statement) => [
              statement.subject?.termType === "NamedNode"
                ? statement.subject.value
                : null,
              statement.object?.termType === "NamedNode"
                ? statement.object.value
                : null,
            ])
            .filter(Boolean),
        ),
      ];
      namedNodeValues.should.not.include(resourceMapPid);
      namedNodeValues.should.not.include("https://example.org/legacy/root");
      namedNodeValues.should.not.include(
        "https://example.org/legacy/aggregation",
      );
      namedNodeValues.should.not.include("https://example.org/legacy/data");
      namedNodeValues.should.not.include(`${resolveBase}${derivedPid}`);
      namedNodeValues.should.not.include(encodeURIComponent(programPid));

      const xml = resourceMap.serialize();
      xml.should.contain(canonicalResourceMapUri);
      xml.should.contain(canonicalDataUri);
      xml.should.not.contain("https://example.org/legacy/data");
      xml.should.not.contain(`${resolveBase}${derivedPid}`);
    });

    it("repairs missing ore:Aggregation typing during fromXml normalization", () => {
      const xmlMissingAggregationType = COMPREHENSIVE_XML.replace(
        `<rdf:Description rdf:about="${TEST_RESOLVE_BASE}resource_map_urn%3Auuid%3Arm.1#aggregation">\n      <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>`,
        `<rdf:Description rdf:about="${TEST_RESOLVE_BASE}resource_map_urn%3Auuid%3Arm.1#aggregation">`,
      );

      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        xmlMissingAggregationType,
      );
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);

      resourceMap.graph
        .statementsMatching(
          aggregationNode,
          resourceMap.ns.RDF("type"),
          resourceMap.ns.ORE("Aggregation"),
          undefined,
        )
        .length.should.equal(1);
      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidPackageStructure",
      );
    });

    it("omits explicit ore:Aggregation typing from serialized XML", () => {
      const xml = createBaseResourceMap().serialize();

      xml.should.not.contain(
        'rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"',
      );
    });

    it("throws when fromXml cannot determine a parse base", () => {
      const originalAppModel = globalThis.MetacatUI?.appModel;

      try {
        globalThis.MetacatUI = {
          ...globalThis.MetacatUI,
          appModel: { get: () => null },
        };

        (() =>
          ResourceMap.fromXml(
            "resource_map_urn:uuid:rm.1",
            COMPREHENSIVE_XML,
          )).should.throw("parseBase required");
      } finally {
        globalThis.MetacatUI = {
          ...globalThis.MetacatUI,
          appModel: originalAppModel,
        };
      }
    });

    it("throws parsed DataONE service errors from XML preflight", () => {
      let caught = null;

      try {
        ResourceMap.fromXml("resource_map_urn:uuid:rm.1", ERROR_XML, {
          parseBase: TEST_RESOLVE_BASE,
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).to.be.instanceOf(Error);
      expect(caught.name).to.equal("NotAuthorized");
      expect(caught.message).to.equal("READ not allowed");
      expect(caught.status).to.equal("401");
    });

    it("does not throw and sorts the canonical JSON view when requested", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.tojson.sort.1",
        members: [{ pid: "data.2" }, { pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.2",
          },
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      expect(() => resourceMap.toJSON({ sort: true })).to.not.throw();

      const summary = resourceMap.toJSON({ sort: true });
      const json = resourceMap.toJSON({ sort: true });

      json.should.deep.equal(summary);
      json.members
        .map((member) => member.pid)
        .should.deep.equal(["data.1", "data.2", "meta.1"]);
      Object.keys(json.membersByPid).should.deep.equal([
        "data.1",
        "data.2",
        "meta.1",
      ]);
      json.memberPids.should.deep.equal(["data.1", "data.2", "meta.1"]);
      json.metadataPids.should.deep.equal(["meta.1"]);
      json.documentedObjectPids.should.deep.equal(["data.1", "data.2"]);
      json.documentationLinks.should.deep.equal([
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

    it("keeps validate() pure and returns issues without storing model state", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.pure.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [],
      });

      const issues = resourceMap.validate();

      getIssueCodes(issues).should.include("missingPackageStructure");
      expect("validationErrors" in resourceMap).to.equal(false);
    });

    it("preserves an explicit modified timestamp on first serialization of created maps", () => {
      const modified = "2024-01-02T03:04:05.000Z";
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.modified.preserve.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
        modified,
      });

      resourceMap.getSummary().modified.should.equal(modified);
      const xml = resourceMap.serialize();
      xml.should.contain(modified);
      const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
      const [modifiedNode] = Array.from(
        xmlDoc.getElementsByTagNameNS("http://purl.org/dc/terms/", "modified"),
      );
      modifiedNode
        .getAttributeNS(
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          "datatype",
        )
        .should.equal("http://www.w3.org/2001/XMLSchema#dateTime");
      resourceMap.getSummary().modified.should.equal(modified);

      const reparsed = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.modified.preserve.1",
        xml,
      );
      reparsed.getSummary().modified.should.equal(modified);
    });

    it("preserves raw prov:atLocation values while exposing legacy display normalization", () => {
      const rawAtLocation = {
        "data.1": "./q/../w.csv",
        "data.2": "~/q/w.csv",
        "data.3": "folder1///folder2/file.txt",
        "data.4": ".",
      };
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.display.1",
        members: [
          { pid: "meta.1" },
          { pid: "data.1", atLocations: [rawAtLocation["data.1"]] },
          { pid: "data.2", atLocations: [rawAtLocation["data.2"]] },
          { pid: "data.3", atLocations: [rawAtLocation["data.3"]] },
          { pid: "data.4", atLocations: [rawAtLocation["data.4"]] },
        ],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      resourceMap.getMember("data.1").should.deep.include({
        atLocations: ["./q/../w.csv"],
        displayAtLocations: ["w.csv"],
      });
      resourceMap.getMember("data.4").should.deep.include({
        atLocations: ["."],
        displayAtLocations: ["/"],
      });
      resourceMap.getSummary().membersByPid["data.2"].should.deep.include({
        atLocations: ["~/q/w.csv"],
        displayAtLocations: ["q/w.csv"],
      });

      const xml = resourceMap.serialize();
      xml.should.contain(">./q/../w.csv<");
      xml.should.contain(">~/q/w.csv<");
      xml.should.contain(">folder1///folder2/file.txt<");

      const reparsed = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.atlocation.display.1",
        xml,
      );

      reparsed.getMember("data.2").should.deep.include({
        atLocations: ["~/q/w.csv"],
        displayAtLocations: ["q/w.csv"],
      });
      reparsed.getMember("data.3").should.deep.include({
        atLocations: ["folder1///folder2/file.txt"],
        displayAtLocations: ["folder1/folder2/file.txt"],
      });
    });

    it("stores root-escaping prov:atLocation values without rewriting them", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.escape.write.1",
        memberPids: ["meta.1", "data.1"],
      });

      resourceMap.setLocation("data.1", "../x.csv");
      resourceMap.getMember("data.1").should.deep.include({
        atLocations: ["../x.csv"],
        displayAtLocations: ["x.csv"],
      });

      resourceMap.setLocation("data.1", "a/../../x.csv");
      resourceMap.getMember("data.1").should.deep.include({
        atLocations: ["a/../../x.csv"],
        displayAtLocations: ["x.csv"],
      });
    });

    it("sets and replaces prov:atLocation for one member", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.set.1",
        memberPids: ["meta.1", "data.1", "data.2"],
      });

      resourceMap.setLocation("data.1", "data/original.csv");
      resourceMap.setLocation("data.2", "data/other.csv");
      resourceMap.setLocation("data.1", "data/replacement.csv");

      resourceMap.getMember("data.1").should.deep.include({
        atLocations: ["data/replacement.csv"],
        displayAtLocations: ["data/replacement.csv"],
      });
      resourceMap
        .getMember("data.2")
        .atLocations.should.deep.equal(["data/other.csv"]);
    });

    it("removes one matching prov:atLocation from one member", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.remove.one.1",
        memberPids: ["meta.1", "data.1", "data.2"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.setLocation("data.1", "data/keep.csv");
      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/remove.csv"),
      );
      resourceMap.setLocation("data.2", "data/other.csv");

      resourceMap.removeLocation("data.1", "data/remove.csv");

      resourceMap
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/keep.csv"]);
      resourceMap
        .getMember("data.2")
        .atLocations.should.deep.equal(["data/other.csv"]);
    });

    it("removes a matching typed prov:atLocation literal", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.remove.typed.1",
        memberPids: ["meta.1", "data.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/remove.csv", undefined, resourceMap.ns.XSD("string")),
      );

      resourceMap.removeLocation("data.1", "data/remove.csv");

      resourceMap.getMember("data.1").atLocations.should.deep.equal([]);
    });

    it("rejects an empty path instead of removing every location", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.remove.empty.1",
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.setLocation("data.1", "data/keep.csv");

      expect(() => resourceMap.removeLocation("data.1", " ")).to.throw(
        "Path required",
      );
      resourceMap
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/keep.csv"]);
    });

    it("rejects removing a location from a non-member PID", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid:
          "resource_map_urn:uuid:rm.atlocation.remove.nonmember.1",
        memberPids: ["meta.1"],
      });

      expect(() =>
        resourceMap.removeLocation("external.data.1", "data/external.csv"),
      ).to.throw("Member PID required");
    });

    it("preserves multiple prov:atLocation values through serialization", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.multiple.1",
        memberPids: ["meta.1", "data.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.setLocation("data.1", "data/first.csv");
      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/second.csv"),
      );

      resourceMap
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/first.csv", "data/second.csv"]);

      const xml = resourceMap.serialize();
      const reparsed = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.atlocation.multiple.1",
        xml,
      );

      reparsed
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/first.csv", "data/second.csv"]);
    });

    it("creates members with multiple prov:atLocation values", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.create.multiple.1",
        members: [
          {
            pid: "data.1",
            atLocations: ["data/first.csv", "data/second.csv"],
          },
        ],
      });

      resourceMap
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/first.csv", "data/second.csv"]);
    });

    it("requires member atLocations to be an array", () => {
      expect(() =>
        ResourceMap.create({
          resourceMapPid: "resource_map_urn:uuid:rm.atlocation.create.scalar.1",
          members: [{ pid: "data.1", atLocations: "data/file.csv" }],
        }),
      ).to.throw("atLocations must be an array");
    });

    it("removes all prov:atLocation statements from one member", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.remove.all.1",
        memberPids: ["meta.1", "data.1", "data.2"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.setLocation("data.1", "data/first.csv");
      resourceMap.graph.add(
        dataNode,
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("data/second.csv"),
      );
      resourceMap.setLocation("data.2", "data/other.csv");

      resourceMap.removeLocation("data.1");

      resourceMap.getMember("data.1").atLocations.should.deep.equal([]);
      resourceMap
        .getMember("data.2")
        .atLocations.should.deep.equal(["data/other.csv"]);
    });

    it("edits documentation links and member atLocation values", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.child.domains.1",
        memberPids: ["meta.1", "data.1", "data.2"],
        documentationLinks: [],
      });

      resourceMap.linkDocumentation("meta.1", "data.1");
      resourceMap.setDocumentationLinks([
        { metadataPid: "meta.1", dataPid: "data.2" },
      ]);
      resourceMap.setLocation("data.2", "nested/data.csv");

      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "data.2",
        },
      ]);
      resourceMap.getMetadataPids().should.deep.equal(["meta.1"]);
      resourceMap.getDocumentedObjectPids().should.deep.equal(["data.2"]);
      resourceMap.getMember("data.2").should.deep.include({
        atLocations: ["nested/data.csv"],
        displayAtLocations: ["nested/data.csv"],
      });

      resourceMap.unlinkDocumentation("meta.1", "data.2");
      resourceMap.removeLocation("data.2", "nested/data.csv");

      resourceMap.getDocumentationLinks().should.deep.equal([]);
      resourceMap.getMember("data.2").atLocations.should.deep.equal([]);
    });

    it("batches documentation link changes and skips unchanged writes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.docs.batch.1",
        memberPids: ["meta.1", "data.1", "data.2", "data.3"],
        documentationLinks: [],
      });
      const links = [
        { metadataPid: "meta.1", dataPid: "data.1" },
        { metadataPid: "meta.1", dataPid: "data.2" },
        { metadataPid: "meta.1", dataPid: "data.3" },
      ];
      const sandbox = sinon.createSandbox();

      try {
        const mutateGraphSpy = sandbox.spy(resourceMap, "mutateGraph");

        resourceMap.setDocumentationLinks(links);
        mutateGraphSpy.callCount.should.equal(1);
        resourceMap.getDocumentationLinks().should.deep.equal(links);

        resourceMap.setDocumentationLinks(links);
        mutateGraphSpy.callCount.should.equal(1);
      } finally {
        sandbox.restore();
      }
    });

    it("returns null for invalid member and location lookups", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.lookup.defaults.1",
        memberPids: ["meta.1", "data.1"],
      });

      expect(resourceMap.getMember("")).to.equal(null);
    });

    it("ignores literal objects when deriving members and documentation links", () => {
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
      resourceMap.invalidateGraphState();

      resourceMap.getMemberPids().should.deep.equal(["meta.1"]);
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "meta.1",
        },
      ]);
    });

    it("normalizes root-escaping prov:atLocation values for display when reading RDF", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.escape.read.1",
        memberPids: ["meta.1", "data.1", "data.2"],
      });

      GraphMutation.addStatement(
        resourceMap,
        rdf.sym(resourceMap.getNodeUriForPid("data.1")),
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("../x.csv"),
      );
      GraphMutation.addStatement(
        resourceMap,
        rdf.sym(resourceMap.getNodeUriForPid("data.2")),
        resourceMap.ns.PROV("atLocation"),
        rdf.literal("a/../../x.csv"),
      );

      resourceMap.getMember("data.1").should.deep.include({
        atLocations: ["../x.csv"],
        displayAtLocations: ["x.csv"],
      });
      resourceMap.getMember("data.2").should.deep.include({
        atLocations: ["a/../../x.csv"],
        displayAtLocations: ["x.csv"],
      });

      const xml = resourceMap.serialize({
        validate: false,
      });
      xml.should.contain(">../x.csv<");
      xml.should.contain(">a/../../x.csv<");

      const reparsed = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.atlocation.escape.read.1",
        xml,
      );

      reparsed.getMember("data.1").should.deep.include({
        atLocations: ["../x.csv"],
        displayAtLocations: ["x.csv"],
      });
    });

    it("reads creator names from both creator predicates and arbitrary prefixes", () => {
      const dctermsCreatorMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.creator.1",
        DCTERMS_CREATOR_XML,
      );
      dctermsCreatorMap
        .getSummary()
        .creatorName.should.equal("DCTERMS Creator");

      const prefixedCreatorMap = ResourceMap.fromXml(
        "urn:uuid:rm.prefixed.1",
        PREFIX_ALIAS_CREATOR_XML,
      );
      prefixedCreatorMap
        .getSummary()
        .creatorName.should.equal("Prefixed Creator");
    });

    it("preserves extra creator RDF when updating the creator name", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.creator.1",
        DCTERMS_CREATOR_XML,
      );

      resourceMap.setCreatorName("Updated Creator");
      const xml = resourceMap.serialize();
      const reparsed = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.creator.1",
        xml,
      );

      reparsed.getSummary().creatorName.should.equal("Updated Creator");
      reparsed.graph
        .statementsMatching(undefined, resourceMap.ns.FOAF("mbox"), undefined)
        .map((statement) => statement.object.value)
        .should.deep.equal(["mailto:creator@example.org"]);
    });

    it("removes literal creators while preserving an existing creator node", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.creator.1",
        DCTERMS_CREATOR_XML,
      );
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      const existingCreatorNode = creatorStatements(resourceMap).find(
        (statement) => statement.object.termType !== "Literal",
      ).object;

      resourceMap.graph.add(
        resourceMapNode,
        resourceMap.ns.DC("creator"),
        rdf.literal("Literal DC Creator"),
      );
      resourceMap.graph.add(
        resourceMapNode,
        resourceMap.ns.DCTERMS("creator"),
        rdf.literal("Literal DCTERMS Creator"),
      );

      resourceMap.setCreatorName("Updated Creator");

      const updatedCreatorStatements = creatorStatements(resourceMap);
      updatedCreatorStatements
        .filter((statement) => statement.object.termType === "Literal")
        .should.deep.equal([]);
      updatedCreatorStatements
        .filter((statement) => statement.object.equals(existingCreatorNode))
        .length.should.equal(2);
      resourceMap.getSummary().creatorName.should.equal("Updated Creator");
    });

    it("preserves unrelated identifiers when changing the resource map PID", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:old.1",
      });

      GraphNormalization.synchronizeCoreGraph(resourceMap);
      resourceMap.graph.add(
        rdf.sym(resourceMap.resourceMapUri),
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal(
          "alternate-resource map-id",
          undefined,
          resourceMap.ns.XSD("string"),
        ),
      );

      resourceMap.setResourceMapPid("resource_map_urn:uuid:new.1");

      resourceMap.resourceMapPid.should.equal("resource_map_urn:uuid:new.1");
      resourceMap.graph
        .statementsMatching(
          rdf.sym(resourceMap.resourceMapUri),
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) =>
          ResourceMapCommon.getLiteralLikeObjectValue(statement.object),
        )
        .filter(Boolean)
        .should.have.members([
          "resource_map_urn:uuid:new.1",
          "alternate-resource map-id",
        ]);
    });

    it("rewrites the managed root and aggregation nodes to the new encoded PID when the resource map PID changes", () => {
      const oldPid = "resource_map_doi:10.5063/F1+OLD";
      const newPid = "resource_map_doi:10.5063/F1+NEW";
      const resolveBase = TEST_RESOLVE_BASE;
      const rootNotePredicate = rdf.sym("https://example.org/test#rootNote");
      const aggregationNotePredicate = rdf.sym(
        "https://example.org/test#aggregationNote",
      );
      const graph = rdf.graph();
      const rootBareNode = rdf.sym(oldPid);
      const rootCustomNode = rdf.sym("https://example.org/custom/root.old");
      const aggregationNode = rdf.sym(
        "https://example.org/custom/aggregation.old",
      );
      const memberNode = rdf.sym("meta.1");

      graph.add(rootCustomNode, ns.DCTERMS("identifier"), rdf.literal(oldPid));
      graph.add(rootBareNode, ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(rootBareNode, ns.ORE("describes"), aggregationNode);
      graph.add(aggregationNode, ns.RDF("type"), ns.ORE("Aggregation"));
      graph.add(aggregationNode, ns.ORE("isDescribedBy"), rootCustomNode);
      graph.add(aggregationNode, ns.ORE("aggregates"), memberNode);
      graph.add(memberNode, ns.ORE("isAggregatedBy"), aggregationNode);
      graph.add(
        memberNode,
        ns.DCTERMS("identifier"),
        rdf.literal("meta.1", undefined, ns.XSD("string")),
      );
      graph.add(rootCustomNode, rootNotePredicate, rdf.literal("root note"));
      graph.add(
        aggregationNode,
        aggregationNotePredicate,
        rdf.literal("aggregation note"),
      );

      const resourceMap = new ResourceMap({
        resourceMapPid: oldPid,
        graph,
        resolveBase,
      });

      resourceMap.setResourceMapPid(newPid);

      resourceMap.resourceMapUri.should.equal(
        `${resolveBase}/resource_map_doi:10.5063%2FF1%2BNEW`,
      );
      resourceMap.aggregationUri.should.equal(
        `${resolveBase}/resource_map_doi:10.5063%2FF1%2BNEW#aggregation`,
      );
      resourceMap.graph
        .statementsMatching(
          rdf.sym(resourceMap.resourceMapUri),
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) =>
          ResourceMapCommon.getLiteralLikeObjectValue(statement.object),
        )
        .filter(Boolean)
        .should.include(newPid);
      resourceMap.graph
        .statementsMatching(
          rdf.sym(resourceMap.resourceMapUri),
          rootNotePredicate,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["root note"]);
      resourceMap.graph
        .statementsMatching(
          rdf.sym(resourceMap.aggregationUri),
          aggregationNotePredicate,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["aggregation note"]);

      const allValues = resourceMap.graph.statements.flatMap((statement) => [
        statement.subject?.value,
        statement.object?.value,
      ]);
      allValues.should.not.include(oldPid);
      allValues.should.not.include("https://example.org/custom/root.old");
      allValues.should.not.include(
        "https://example.org/custom/aggregation.old",
      );

      const xml = resourceMap.serialize();
      xml.should.contain("resource_map_doi:10.5063%2FF1%2BNEW");
      xml.should.not.contain("resource_map_doi:10.5063%2FF1%2BOLD");
      xml.should.not.contain("https://example.org/custom/root.old");
    });

    it("replaces canonical member PIDs across package structure and provenance reads", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.replace.member.1",
        resolveBase: TEST_RESOLVE_BASE,
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      resourceMap.setLocation("data.1", "data/data.csv");
      const oldMemberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.replace.member.1",
      });

      resourceMap.replaceMember("data.1", "data.renamed.1");

      resourceMap
        .getMemberPids()
        .should.have.members([
          "meta.1",
          "data.renamed.1",
          "derived.1",
          "program.1",
        ]);
      expect(resourceMap.getMember("data.1")).to.equal(null);
      resourceMap.getMember("data.renamed.1").should.deep.include({
        pid: "data.renamed.1",
        uri: `${TEST_RESOLVE_BASE}/data.renamed.1`,
        atLocations: ["data/data.csv"],
        displayAtLocations: ["data/data.csv"],
      });
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "data.renamed.1",
        },
      ]);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([
        {
          derivedPid: "derived.1",
          sourcePid: "data.renamed.1",
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.renamed.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.replace.member.1",
          agentUri: null,
        },
      ]);
      resourceMap.graph
        .statementsMatching(oldMemberNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, oldMemberNode)
        .length.should.equal(0);
    });

    it("canonicalizes managed member nodes when replacing their PID", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.replace.member.2",
        resolveBase: TEST_RESOLVE_BASE,
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const customMemberUri = "https://example.org/custom/member/data.1";

      GraphMutation.replaceNodeValue(
        resourceMap,
        resourceMap.getNodeUriForPid("data.1"),
        customMemberUri,
      );

      resourceMap.replaceMember("data.1", "data.custom.1");

      resourceMap
        .getNodeUriForPid("data.custom.1")
        .should.equal(`${TEST_RESOLVE_BASE}/data.custom.1`);
      expect(resourceMap.getMember("data.1")).to.equal(null);
      resourceMap.getMember("data.custom.1").should.deep.include({
        pid: "data.custom.1",
        uri: `${TEST_RESOLVE_BASE}/data.custom.1`,
      });
      resourceMap.graph
        .statementsMatching(
          rdf.sym(`${TEST_RESOLVE_BASE}/data.custom.1`),
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) =>
          ResourceMapCommon.getLiteralLikeObjectValue(statement.object),
        )
        .filter(Boolean)
        .should.deep.equal(["data.custom.1"]);
      resourceMap.graph
        .statementsMatching(rdf.sym(customMemberUri), undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, rdf.sym(customMemberUri))
        .length.should.equal(0);
    });

    it("rewrites every package and provenance reference when replacing a weirdly encoded member PID", () => {
      const oldPid = "doi:10.5063/F1+OLDDATA";
      const newPid = "doi:10.5063/F1+NEWDATA";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.replace.member.weird.1",
        resolveBase: TEST_RESOLVE_BASE,
        memberPids: ["meta.1", oldPid, "derived.1", "program.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: oldPid,
          },
        ],
      });
      resourceMap.setLocation(oldPid, "data/old.csv");
      const oldCanonicalUri = `${TEST_RESOLVE_BASE}/doi:10.5063%2FF1%2BOLDDATA`;

      GraphMutation.replaceNodeValue(
        resourceMap,
        oldCanonicalUri,
        "https://example.org/custom/member/old-data",
      );
      resourceMap.provenance.addWasDerivedFrom("derived.1", oldPid);
      resourceMap.provenance.addUsedByProgram(oldPid, "program.1", {
        executionId: "urn:uuid:exec.replace.member.weird.1",
      });

      resourceMap.replaceMember(oldPid, newPid);

      expect(resourceMap.getMember(oldPid)).to.equal(null);
      resourceMap.getMember(newPid).should.deep.include({
        pid: newPid,
        uri: `${TEST_RESOLVE_BASE}/doi:10.5063%2FF1%2BNEWDATA`,
        atLocations: ["data/old.csv"],
        displayAtLocations: ["data/old.csv"],
      });
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: newPid,
        },
      ]);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([
        {
          derivedPid: "derived.1",
          sourcePid: newPid,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: newPid,
          programPid: "program.1",
          executionId: "urn:uuid:exec.replace.member.weird.1",
          agentUri: null,
        },
      ]);

      const graphValues = resourceMap.graph.statements.flatMap((statement) => [
        statement.subject?.value,
        statement.object?.value,
      ]);
      graphValues.should.not.include(oldPid);
      graphValues.should.not.include(oldCanonicalUri);
      graphValues.should.not.include(
        "https://example.org/custom/member/old-data",
      );
      resourceMap.graph
        .statementsMatching(
          undefined,
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) =>
          ResourceMapCommon.getLiteralLikeObjectValue(statement.object),
        )
        .filter(Boolean)
        .should.not.include(oldPid);

      const xml = resourceMap.serialize();
      xml.should.contain("doi:10.5063%2FF1%2BNEWDATA");
      xml.should.not.contain("doi:10.5063%2FF1%2BOLDDATA");
      xml.should.not.contain("https://example.org/custom/member/old-data");
    });

    it("rejects replacement PIDs that are already aggregated elsewhere", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.replace.member.3",
        memberPids: ["meta.1", "data.1", "data.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      let caught = null;
      try {
        resourceMap.replaceMember("data.1", "data.2");
      } catch (error) {
        caught = error;
      }

      expect(caught).to.be.instanceOf(Error);
      caught.message.should.match(/already aggregated/);
      caught.code.should.equal("memberAlreadyAggregated");
      caught.details.should.deep.equal({
        oldPid: "data.1",
        newPid: "data.2",
      });
      resourceMap
        .getMemberPids()
        .should.have.members(["meta.1", "data.1", "data.2"]);
    });

    it("ignores removeMember calls for PIDs that are not in the graph", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.absent.1",
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.markSaved();

      resourceMap.removeMember("never.aggregated.1").should.equal(resourceMap);

      resourceMap.getMemberPids().should.have.members(["meta.1", "data.1"]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("rolls back every nested mutation when the outer mutation fails", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.rollback.nested.1",
        memberPids: ["meta.1", "data.1", "source.1"],
      });

      resourceMap.markSaved();

      expect(() =>
        resourceMap.mutateGraph(
          () => {
            // Inner mutations succeed before the outer mutator throws; the
            // outer rollback must undo them too.
            resourceMap.provenance.addWasDerivedFrom("data.1", "source.1");
            resourceMap.setLocation("data.1", "data/rolled-back.csv");
            throw new Error("Outer mutation failed");
          },
          { rollbackOnError: true },
        ),
      ).to.throw("Outer mutation failed");

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.getMember("data.1").atLocations.should.deep.equal([]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("throws on XML that cannot be parsed", () => {
      expect(() =>
        ResourceMap.fromXml("resource_map_urn:uuid:rm.bad.xml.1", "   "),
      ).to.throw("resourceMapXml required");
      expect(() =>
        ResourceMap.fromXml("resource_map_urn:uuid:rm.bad.xml.2", "<rdf:RDF>", {
          parseBase: TEST_RESOLVE_BASE,
        }),
      ).to.throw();
    });

    it("throws a parse error for well-formed XML that is invalid RDF/XML", () => {
      // Well-formed XML, so it passes the DataONE XML preflight, but rdflib
      // halts on a node carrying both rdf:about and rdf:ID.
      const invalidRdfXml = [
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
        '  <rdf:Description rdf:about="https://example.org/a" rdf:ID="b"/>',
        "</rdf:RDF>",
      ].join("\n");

      expect(() =>
        ResourceMap.fromXml(
          "resource_map_urn:uuid:rm.bad.rdf.1",
          invalidRdfXml,
          {
            parseBase: TEST_RESOLVE_BASE,
          },
        ),
      ).to.throw("Parse failed");
    });

    it("auto-creates a self-documenting link for metadata-only packages", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:meta.only.1",
        members: [{ pid: "meta.only.1" }],
        documentationLinks: [],
      });
      const metadataNode = rdf.sym(resourceMap.getNodeUriForPid("meta.only.1"));

      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.only.1",
          dataPid: "meta.only.1",
        },
      ]);
      resourceMap.graph
        .statementsMatching(
          metadataNode,
          resourceMap.ns.CITO("documents"),
          metadataNode,
          undefined,
        )
        .length.should.equal(1);
      resourceMap.graph
        .statementsMatching(
          metadataNode,
          resourceMap.ns.CITO("isDocumentedBy"),
          metadataNode,
          undefined,
        )
        .length.should.equal(1);

      const xml = resourceMap.serialize();
      const reparsed = ResourceMap.fromXml(
        "resource_map_urn:uuid:meta.only.1",
        xml,
      );

      reparsed.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.only.1",
          dataPid: "meta.only.1",
        },
      ]);
    });

    it("auto-creates a self-documenting link for any sole package member", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:solo.member.1",
        members: [{ pid: "solo.member.1" }],
        documentationLinks: [],
      });

      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "solo.member.1",
          dataPid: "solo.member.1",
        },
      ]);
    });

    it("round-trips explicit provenance type assertions through ResourceMap.create", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.type.summary.1",
        members: [{ pid: "meta.1" }, { pid: "program.1" }],
        documentationLinks: [],
      });

      resourceMap.provenance.addTypeAssertion("program.1", "Program");

      const provenanceSnapshot = resourceMap.provenance.toJSON();
      const recreated = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.type.summary.2",
        members: [{ pid: "meta.1" }, { pid: "program.1" }],
        documentationLinks: [],
        provenance: provenanceSnapshot,
      });

      recreated.provenance.toJSON().should.deep.equal(provenanceSnapshot);
      recreated.provenance.getTypeAssertions().should.deep.equal([
        {
          pid: "program.1",
          className: "Program",
        },
      ]);
    });

    it("removes a member and all RDF statements that reference it", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.member.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
          {
            metadataPid: "meta.1",
            dataPid: "derived.1",
          },
        ],
      });
      resourceMap.setLocation("data.1", "data/data.csv");
      resourceMap.setLocation("derived.1", "data/derived.csv");
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const customPredicate = rdf.sym(
        "https://example.org/test#customMemberNote",
      );

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1", {
        executionId: "urn:uuid:exec.remove.member.1",
      });
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1", {
        executionId: "urn:uuid:exec.remove.member.2",
      });

      resourceMap.graph.add(
        dataNode,
        customPredicate,
        rdf.literal("remove this custom statement"),
      );
      resourceMap.removeMember("data.1");

      resourceMap.getMemberPids().should.not.include("data.1");
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "derived.1",
        },
      ]);
      expect(resourceMap.getMember("data.1")).to.equal(null);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "derived.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.remove.member.2",
          agentUri: null,
        },
      ]);
      resourceMap.graph
        .statementsMatching(dataNode, undefined, undefined)
        .length.should.equal(0);
      resourceMap.graph
        .statementsMatching(undefined, undefined, dataNode)
        .length.should.equal(0);

      const xml = resourceMap.serialize();
      xml.should.not.contain(">data.1<");
      xml.should.not.contain(`${TEST_RESOLVE_BASE}/data.1`);
    });

    it("removes every package and provenance reference to a weirdly encoded member PID", () => {
      const removedPid = "doi:10.5063/F1+REMOVE";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.member.weird.1",
        resolveBase: TEST_RESOLVE_BASE,
        memberPids: ["meta.1", removedPid, "data.2", "derived.1", "program.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: removedPid,
          },
          {
            metadataPid: "meta.1",
            dataPid: "derived.1",
          },
        ],
      });
      resourceMap.setLocation(removedPid, "data/remove.csv");
      resourceMap.setLocation("derived.1", "data/derived.csv");
      const removedCanonicalUri = `${TEST_RESOLVE_BASE}/doi:10.5063%2FF1%2BREMOVE`;

      GraphMutation.replaceNodeValue(
        resourceMap,
        removedCanonicalUri,
        "https://example.org/custom/member/remove",
      );
      resourceMap.provenance.addWasDerivedFrom("derived.1", removedPid);
      resourceMap.provenance.addUsedByProgram(removedPid, "program.1", {
        executionId: "urn:uuid:exec.remove.member.weird.1",
      });
      resourceMap.provenance.addUsedByProgram("data.2", "program.1", {
        executionId: "urn:uuid:exec.remove.member.weird.2",
      });

      resourceMap.removeMember(removedPid);

      resourceMap.getMemberPids().should.not.include(removedPid);
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "derived.1",
        },
      ]);
      expect(resourceMap.getMember(removedPid)).to.equal(null);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.2",
          programPid: "program.1",
          executionId: "urn:uuid:exec.remove.member.weird.2",
          agentUri: null,
        },
      ]);

      const graphValues = resourceMap.graph.statements.flatMap((statement) => [
        statement.subject?.value,
        statement.object?.value,
      ]);
      graphValues.should.not.include(removedPid);
      graphValues.should.not.include(removedCanonicalUri);
      graphValues.should.not.include(
        "https://example.org/custom/member/remove",
      );

      const xml = resourceMap.serialize();
      xml.should.not.contain("doi:10.5063%2FF1%2BREMOVE");
      xml.should.not.contain("https://example.org/custom/member/remove");
    });

    it("validates serialization by default and still supports best-effort output", () => {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "resource_map_urn:uuid:rm.invalid.serialize.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [],
      });

      expect(() => resourceMap.serialize()).to.throw(
        "ResourceMap validation failed",
      );

      const xml = resourceMap.serialize({ validate: false });
      xml.should.be.a("string");
      xml.should.contain("meta.1");
      xml.should.contain("data.1");
    });

    it("does not rerun import repair during serialization or normalization", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.serialize.normalize.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const canonicalUri = resourceMap.getNodeUriForPid("data.1");
      const customUri = "https://example.org/custom/member/serialize";

      resourceMap.mutateGraph(() => {
        GraphMutation.replaceNodeValue(resourceMap, canonicalUri, customUri);
      });

      const rawXml = resourceMap.serialize({ validate: false });
      rawXml.should.contain(customUri);
      rawXml.should.not.contain(resourceMap.pidToUri("data.1"));

      resourceMap.normalize();

      const normalizedXml = resourceMap.serialize({ validate: false });
      normalizedXml.should.contain(customUri);
    });

    it("treats a sole remaining member as self-documenting package structure", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.metadata.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      resourceMap.removeMember("meta.1");

      resourceMap.getDocumentationLinks().should.deep.equal([]);
      getIssueCodes(resourceMap.validate()).should.not.include(
        "missingPackageStructure",
      );
      resourceMap.getDocumentationLinks().should.deep.equal([]);
      resourceMap.serialize({ validate: true }).should.be.a("string");
      resourceMap.getDocumentationLinks().should.deep.equal([]);

      resourceMap.normalize();
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "data.1",
          dataPid: "data.1",
        },
      ]);
    });

    it("round-trips unknown RDF attached to managed nodes without losing it", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const creatorNode = resourceMap.graph.statementsMatching(
        rdf.sym(resourceMap.resourceMapUri),
        resourceMap.ns.DC("creator"),
        undefined,
        undefined,
      )[0].object;
      const executionNode = rdf.sym("urn:uuid:execution-1");
      const associationNode = resourceMap.graph.statementsMatching(
        executionNode,
        resourceMap.ns.PROV("qualifiedAssociation"),
        undefined,
        undefined,
      )[0].object;
      const rootPredicate = rdf.sym("https://example.org/test#resourceMapNote");
      const aggregationPredicate = rdf.sym(
        "https://example.org/test#aggregationNote",
      );
      const memberPredicate = rdf.sym("https://example.org/test#memberNote");
      const creatorPredicate = rdf.sym("https://example.org/test#creatorNote");
      const executionPredicate = rdf.sym(
        "https://example.org/test#executionNote",
      );
      const associationPredicate = rdf.sym(
        "https://example.org/test#associationNote",
      );

      resourceMap.graph.add(
        rdf.sym(resourceMap.resourceMapUri),
        rootPredicate,
        rdf.literal("keep resource map note"),
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.aggregationUri),
        aggregationPredicate,
        rdf.literal("keep aggregation note"),
      );
      resourceMap.graph.add(
        rdf.sym(resourceMap.getNodeUriForPid("data.1")),
        memberPredicate,
        rdf.literal("keep member note"),
      );
      resourceMap.graph.add(
        creatorNode,
        creatorPredicate,
        rdf.literal("keep creator note"),
      );
      resourceMap.graph.add(
        executionNode,
        executionPredicate,
        rdf.literal("keep execution note"),
      );
      resourceMap.graph.add(
        associationNode,
        associationPredicate,
        rdf.literal("keep association note"),
      );

      const xml = resourceMap.serialize();
      const reparsed = ResourceMap.fromXml("resource_map_urn:uuid:rm.1", xml);
      const reparsedCreatorNode = reparsed.graph.statementsMatching(
        rdf.sym(reparsed.resourceMapUri),
        reparsed.ns.DC("creator"),
        undefined,
        undefined,
      )[0].object;
      const reparsedExecutionNode = rdf.sym("urn:uuid:execution-1");
      const reparsedAssociationNode = reparsed.graph.statementsMatching(
        reparsedExecutionNode,
        reparsed.ns.PROV("qualifiedAssociation"),
        undefined,
        undefined,
      )[0].object;

      reparsed.graph
        .statementsMatching(
          rdf.sym(reparsed.resourceMapUri),
          rootPredicate,
          undefined,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep resource map note"]);
      reparsed.graph
        .statementsMatching(
          rdf.sym(reparsed.aggregationUri),
          aggregationPredicate,
          undefined,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep aggregation note"]);
      reparsed.graph
        .statementsMatching(
          rdf.sym(reparsed.getNodeUriForPid("data.1")),
          memberPredicate,
          undefined,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep member note"]);
      reparsed.graph
        .statementsMatching(
          reparsedCreatorNode,
          creatorPredicate,
          undefined,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep creator note"]);
      reparsed.graph
        .statementsMatching(
          reparsedExecutionNode,
          executionPredicate,
          undefined,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep execution note"]);
      reparsed.graph
        .statementsMatching(
          reparsedAssociationNode,
          associationPredicate,
          undefined,
          undefined,
        )
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep association note"]);
    });

    it("auto-fixes missing aggregation back-links and member identifiers during parsing", () => {
      const resourceMap = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.fix.1",
        MISSING_IDENTIFIER_XML,
      );

      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidPackageStructure",
      );

      const xml = resourceMap.serialize({ validate: true });
      xml.should.contain("resource_map_doi:10.18739/A22Z9V");

      const reparsed = ResourceMap.fromXml(
        "resource_map_urn:uuid:rm.fix.1",
        xml,
      );
      getIssueCodes(reparsed.validate()).should.not.include(
        "invalidPackageStructure",
      );
      reparsed.graph
        .statementsMatching(
          rdf.sym(`${TEST_RESOLVE_BASE}/resource_map_doi:10.18739%2FA22Z9V`),
          reparsed.ns.DCTERMS("identifier"),
          undefined,
        )
        .map((statement) =>
          ResourceMapCommon.getLiteralLikeObjectValue(statement.object),
        )
        .should.include("resource_map_doi:10.18739/A22Z9V");
    });

    it("repairs malformed managed identifiers during import repair", () => {
      const resourceMap = createMalformedArtifactResourceMap();

      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidPackageStructure",
      );
      GraphNormalization.repairBrokenGraph(resourceMap);

      resourceMap.getMemberPids().should.deep.equal(["meta.1"]);
      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidPackageStructure",
      );
    });

    it("repairs malformed creator names during import repair", () => {
      const resourceMap = createMalformedArtifactResourceMap();
      GraphNormalization.repairBrokenGraph(resourceMap);

      resourceMap
        .getSummary()
        .creatorName.should.equal("DataONE Java Client Library");
    });
  });
});
