define([
  "rdflib",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMap",
  "models/resourceMap/Provenance",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/ResourceMapState",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (
  rdf,
  RDFGraph,
  ResourceMap,
  Provenance,
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
    addExecutionScaffold,
    createBaseResourceMap,
    getIssueCodes,
    TEST_RESOLVE_BASE,
  } = testUtils;
  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;

  /**
   * Check whether a node remains anywhere in the graph.
   * @param {ResourceMap} resourceMap Test resource map
   * @param {object} node RDF node
   * @returns {boolean} Whether the node is a statement subject or object
   */
  function hasNodeReferences(resourceMap, node) {
    return (
      resourceMap.graph.hasStatement({ subject: node }) ||
      resourceMap.graph.hasStatement({ object: node })
    );
  }

  /**
   * Add one complete ORE Resource Map backbone to a test graph.
   * @param {object} graph rdflib graph store
   * @param {object} options Backbone options
   * @param {string} options.pid Requested Resource Map PID
   * @param {string} options.rootUri Exact root URI
   * @param {string} options.aggregationUri Exact aggregation URI
   */
  function addCompleteBackbone(graph, { pid, rootUri, aggregationUri }) {
    const root = rdf.sym(rootUri);
    const aggregation = rdf.sym(aggregationUri);
    graph.add(root, ns.DCTERMS("identifier"), rdf.literal(pid));
    graph.add(root, ns.RDF("type"), ns.ORE("ResourceMap"));
    graph.add(root, ns.ORE("describes"), aggregation);
    graph.add(aggregation, ns.RDF("type"), ns.ORE("Aggregation"));
    graph.add(aggregation, ns.ORE("isDescribedBy"), root);
  }

  /**
   * Serialize complete named node ORE backbones for parser ownership tests.
   * @param {string} pid Requested Resource Map PID
   * @param {Array<{rootUri: string, aggregationUri: string}>} backbones Roots
   * and aggregations to serialize
   * @returns {string} RDF/XML fixture
   */
  function buildBackbonesXml(pid, backbones) {
    return [
      '<rdf:RDF xmlns:dcterms="http://purl.org/dc/terms/"',
      '  xmlns:ore="http://www.openarchives.org/ore/terms/"',
      '  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
      ...backbones.flatMap(({ rootUri, aggregationUri }) => [
        `  <rdf:Description rdf:about="${rootUri}">`,
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
        `    <dcterms:identifier>${pid}</dcterms:identifier>`,
        `    <ore:describes rdf:resource="${aggregationUri}"/>`,
        "  </rdf:Description>",
        `  <rdf:Description rdf:about="${aggregationUri}">`,
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
        `    <ore:isDescribedBy rdf:resource="${rootUri}"/>`,
        "  </rdf:Description>",
      ]),
      "</rdf:RDF>",
    ].join("\n");
  }

  /** @returns {ResourceMap} Resource Map with the required service dependency. */
  function constructResourceMap(options = {}) {
    return new ResourceMap({
      resolveServiceUrl: TEST_RESOLVE_BASE,
      ...options,
    });
  }

  /** @returns {ResourceMap} New Resource Map with the test resolve service. */
  function createResourceMap(options = {}) {
    return ResourceMap.create({
      resolveServiceUrl: TEST_RESOLVE_BASE,
      ...options,
    });
  }

  /** @returns {ResourceMap} Parsed Resource Map with the test resolve service. */
  function parseResourceMap(resourceMapPid, xml, options = {}) {
    return ResourceMap.fromXml(resourceMapPid, xml, {
      resolveServiceUrl: TEST_RESOLVE_BASE,
      ...options,
    });
  }

  describe("ResourceMap Test Suite", () => {
    // Ensure there is a resolveServiceUrl and a objectServiceUrl in the app
    // config for tests that rely on them, and restore any existing app config
    // after the tests complete.
    const originalAppModel = globalThis.MetacatUI?.appModel;
    let sandbox;

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
            if (["baseUrl", "context", "d1Service"].includes(key)) {
              return "";
            }
            return null;
          },
        },
      };
    });

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    after(() => {
      globalThis.MetacatUI = {
        ...globalThis.MetacatUI,
        appModel: originalAppModel,
      };
    });

    it("builds namespace functions from the built-in namespace URIs", () => {
      const resourceMap = constructResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.1",
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

    it("honors an explicit absolute xml:base without a deployment base", () => {
      const xmlBase =
        "https://xml-base.example/cn/v2/resolve/resource_map_urn:uuid:rm.1";
      const relativeXml = COMPREHENSIVE_XML.replace(
        "<rdf:RDF",
        `<rdf:RDF xml:base="${xmlBase}"`,
      )
        .split(`${TEST_RESOLVE_BASE}/data.1`)
        .join("data.1");

      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        relativeXml,
      );

      const memberUri = "https://xml-base.example/cn/v2/resolve/data.1";
      resourceMap.getNodeUriForPid("data.1").should.equal(memberUri);
      resourceMap.graphState
        .nodeHasIdentifier(rdf.sym(memberUri), "data.1")
        .should.equal(true);
    });

    it("blocks baseless relative ownership without minting a configured root", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.relative.1";
      const xml = [
        '<rdf:RDF xmlns:dcterms="http://purl.org/dc/terms/"',
        '  xmlns:ore="http://www.openarchives.org/ore/terms/"',
        '  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
        '  <rdf:Description rdf:about="">',
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
        `    <dcterms:identifier>${resourceMapPid}</dcterms:identifier>`,
        '    <ore:describes rdf:resource="#aggregation"/>',
        "  </rdf:Description>",
        '  <rdf:Description rdf:about="#aggregation">',
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
        '    <ore:isDescribedBy rdf:resource=""/>',
        "  </rdf:Description>",
        "</rdf:RDF>",
      ].join("\n");
      let conflict;

      try {
        parseResourceMap(resourceMapPid, xml);
      } catch (error) {
        conflict = error;
      }

      conflict.should.be.instanceOf(ResourceMapCommon.ResourceMapConflictError);
      conflict.code.should.equal("ambiguousResourceMapRoot");
      conflict.details.reason.should.equal("relative");
      conflict.issues[0].malformedOwnershipStatements.should.have.lengthOf(2);
      conflict.issues[0].forwardStatements[0].subject.should.deep.include({
        termType: RDFGraph.NODE_TYPES.NAMED,
        value: "",
      });
    });

    it("parses the current public surface and provenance projections", () => {
      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const summary = resourceMap.getSummary();

      expect(resourceMap.provenance).to.be.instanceOf(Provenance);
      resourceMap.resourceMapPid.should.equal("resource_map_urn:uuid:rm.1");
      resourceMap.resourceMapUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.1`,
      );
      resourceMap.aggregationUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.1#aggregation`,
      );
      resourceMap.resolveServiceUrl.should.equal(`${TEST_RESOLVE_BASE}/`);
      summary.creatorName.should.equal("Example Creator");
      summary.modified.should.equal("2026-03-24T10:00:00.000Z");
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
      resourceMap.graphState.hasMember("data.1").should.equal(true);
      resourceMap.graphState.hasMember("missing.1").should.equal(false);

      const dataMember = resourceMap.graphState.getMember("data.1");
      dataMember.should.deep.include({
        pid: "data.1",
        uri: `${TEST_RESOLVE_BASE}/data.1`,
      });
      dataMember.atLocations.should.deep.equal(["data/data.csv"]);
      dataMember.isDocumentedBy.should.deep.equal(["meta.1"]);
      dataMember.documents.should.deep.equal([]);
      summary.members
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

    it("preserves valid resolver members from another CN", () => {
      // Replace one member PID's resolve URI to simulate parsing XML from a
      // source that mixes CN resolve hosts.
      const foreignMemberUri =
        "https://another-cn.example/cn/v2/resolve/data.1";
      const mixedCnResolveXml = COMPREHENSIVE_XML.split(
        `${TEST_RESOLVE_BASE}/data.1`,
      ).join(foreignMemberUri);

      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        mixedCnResolveXml,
      );

      resourceMap.getMemberPids().should.include("data.1");
      resourceMap.getNodeUriForPid("data.1").should.equal(foreignMemberUri);
      resourceMap.hasUnsavedChanges().should.equal(false);
      parseResourceMap(resourceMap.resourceMapPid, resourceMap.serialize())
        .getNodeUriForPid("data.1")
        .should.equal(foreignMemberUri);
    });

    it("parses raw XML that mixes object-service and resolve-service absolute URIs", () => {
      const physicalMemberUri =
        "https://mn-stage.test.dataone.org/mn/v2/object/data.1";
      const mixedAbsoluteUriXml = COMPREHENSIVE_XML.split(
        `${TEST_RESOLVE_BASE}/data.1`,
      ).join(physicalMemberUri);

      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        mixedAbsoluteUriXml,
      );

      resourceMap.getMemberPids().should.include("data.1");
      resourceMap.getNodeUriForPid("data.1").should.equal(physicalMemberUri);
    });

    it("reports a baseless relative member without assigning a configured identity", () => {
      const relativeUriXml = COMPREHENSIVE_XML.split(
        `${TEST_RESOLVE_BASE}/data.1`,
      ).join("data.1");

      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        relativeUriXml,
      );

      resourceMap.getMemberPids().should.not.include("data.1");
      getIssueCodes(resourceMap.getEditBlockers()).should.include(
        "relativeMember",
      );
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(resourceMap.aggregationUri),
          predicate: ns.ORE("aggregates"),
          object: rdf.sym(`${TEST_RESOLVE_BASE}/data.1`),
        })
        .should.equal(false);
    });

    it("reuses one package-wide cached summary across member and summary reads", () => {
      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const buildGraphIndexSpy = sandbox.spy(
        ResourceMapState.prototype,
        "buildGraphIndex",
      );

      resourceMap.getSummary().members.length.should.equal(6);
      resourceMap.graphState.getMember("data.1").should.deep.include({
        pid: "data.1",
      });
      resourceMap.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/data.csv"]);
      resourceMap
        .getSummary()
        .members.map(({ pid }) => pid)
        .should.have.members([
          "meta.1",
          "data.1",
          "derived.1",
          "script.1",
          "script.2",
          "resource_map_doi:10.18739/A2NESTED",
        ]);

      buildGraphIndexSpy.callCount.should.equal(1);
    });

    it("batches member removals and additions in one graph mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.members.replace.batch.1",
        memberPids: ["meta.1", "data.1", "data.2", "data.3"],
      });
      const mutateGraphSpy = sandbox.spy(resourceMap, "mutateGraph");
      const collectReferencesSpy = sandbox.spy(
        resourceMap.provenance,
        "collectMemberReferenceRemovals",
      );

      resourceMap.setPackageStructure(
        ["meta.1", "data.4"],
        [{ metadataPid: "meta.1", dataPid: "data.4" }],
      );

      mutateGraphSpy.callCount.should.equal(1);
      collectReferencesSpy.callCount.should.equal(1);
      resourceMap.getMemberPids().should.have.members(["meta.1", "data.4"]);
    });

    it("does not adopt a same-PID provenance node as a new member", () => {
      const externalPid = "external.1";
      const externalUri = "https://old-cn.example/cn/v2/resolve/external.1";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.member.prov-alias.1",
      });
      const metadataNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const externalNode = rdf.sym(externalUri);

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: externalNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(externalPid),
          });
          resourceMap.graph.addStatement({
            subject: externalNode,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: dataNode,
          });
        },
        { markDirty: false },
      );
      resourceMap.getNodeUriForPid(externalPid).should.equal(externalUri);

      const memberUri = resourceMap.pidToUri(externalPid);
      resourceMap.setPackageStructure(
        [...resourceMap.getMemberPids(), externalPid],
        [
          ...resourceMap.getDocumentationLinks(),
          { metadataPid: "meta.1", dataPid: externalPid },
        ],
      );

      resourceMap.resolveMemberNode(externalPid).uri.should.equal(memberUri);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(resourceMap.aggregationUri),
          predicate: resourceMap.ns.ORE("aggregates"),
          object: externalNode,
        })
        .should.equal(false);
      resourceMap.graph
        .hasStatement({
          subject: metadataNode,
          predicate: resourceMap.ns.CITO("documents"),
          object: rdf.sym(memberUri),
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: externalNode,
          predicate: resourceMap.ns.PROV("wasDerivedFrom"),
          object: dataNode,
        })
        .should.equal(true);
      resourceMap.serialize().should.be.a("string");
    });

    it("rejects non-array replacement inputs without clearing structure", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.structure.input.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [{ metadataPid: "meta.1", dataPid: "data.1" }],
      });
      const memberPids = resourceMap.getMemberPids();
      const documentationLinks = resourceMap.getDocumentationLinks();

      expect(() =>
        resourceMap.setPackageStructure("meta.1", documentationLinks),
      ).to.throw("pids must be an array");
      expect(() =>
        resourceMap.setPackageStructure(memberPids, undefined),
      ).to.throw("links must be an array");
      expect(() => resourceMap.setDocumentationLinks({})).to.throw(
        "links must be an array",
      );

      resourceMap.getMemberPids().should.deep.equal(memberPids);
      resourceMap.getDocumentationLinks().should.deep.equal(documentationLinks);
    });

    it("batches shared provenance relationship removal during bulk member removal", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.members.prov.batch.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });
      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      const mutateGraphSpy = sandbox.spy(resourceMap, "mutateGraph");
      const collectReferencesSpy = sandbox.spy(
        resourceMap.provenance,
        "collectMemberReferenceRemovals",
      );

      resourceMap.setPackageStructure(["meta.1"], []);

      mutateGraphSpy.callCount.should.equal(1);
      collectReferencesSpy.callCount.should.equal(1);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.getMemberPids().should.deep.equal(["meta.1"]);
    });

    it("preserves a shared execution until its last program is removed", () => {
      const executionId = "urn:uuid:exec.members.shared.1";
      const previousExecutionId = "urn:uuid:exec.members.shared.previous.1";
      const executionNode = rdf.sym(executionId);
      const previousExecutionNode = rdf.sym(previousExecutionId);
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.members.shared.1",
        memberPids: [
          "meta.1",
          "data.1",
          "program.1",
          "program.2",
          "program.previous.1",
        ],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      ["program.1", "program.2"].forEach((programPid) => {
        addExecutionScaffold(resourceMap, { executionNode, programPid });
      });
      addExecutionScaffold(resourceMap, {
        executionNode: previousExecutionNode,
        programPid: "program.previous.1",
      });
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.PROV("wasGeneratedBy"),
            object: executionNode,
          });
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: resourceMap.ns.PROV("wasInformedBy"),
            object: previousExecutionNode,
          });
        },
        { markDirty: false },
      );

      resourceMap.removeMembers(["program.1"]);

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "program.2",
          executionId,
        },
      ]);
      resourceMap.graph
        .hasStatement({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("wasInformedBy"),
          object: previousExecutionNode,
        })
        .should.equal(true);

      resourceMap.removeMembers(["program.2"]);

      resourceMap.graph.findStatements({ subject: executionNode }).should.be
        .empty;
      resourceMap.graph.findStatements({ object: executionNode }).should.be
        .empty;
      resourceMap.graph
        .hasStatement({
          subject: previousExecutionNode,
          predicate: resourceMap.ns.RDF("type"),
          object: resourceMap.ns.PROVONE("Execution"),
        })
        .should.equal(true);
    });

    it("rolls back package-structure reconciliation when documentation fails", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.package.rollback.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [{ metadataPid: "meta.1", dataPid: "data.1" }],
      });
      const addStatementIfMissing =
        resourceMap.graph.addStatementIfMissing.bind(resourceMap.graph);

      sandbox
        .stub(resourceMap.graph, "addStatementIfMissing")
        .callsFake((statement) => {
          if (
            statement.predicate.value ===
              resourceMap.ns.CITO("documents").value &&
            statement.object.value === resourceMap.pidToUri("data.2")
          ) {
            throw new Error("documentation update failed");
          }
          return addStatementIfMissing(statement);
        });

      (() =>
        resourceMap.setPackageStructure(
          ["meta.1", "data.2"],
          [{ metadataPid: "meta.1", dataPid: "data.2" }],
        )).should.throw("documentation update failed");

      resourceMap.getMemberPids().should.have.members(["meta.1", "data.1"]);
      resourceMap.graphState.hasMember("data.2").should.equal(false);
      resourceMap
        .getDocumentationLinks()
        .should.deep.equal([{ metadataPid: "meta.1", dataPid: "data.1" }]);
    });

    it("invalidates the cached summary after graph mutations routed through mutateGraph", () => {
      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const buildGraphIndexSpy = sandbox.spy(
        ResourceMapState.prototype,
        "buildGraphIndex",
      );

      resourceMap.graphState.getMember("data.1").should.deep.include({
        atLocations: ["data/data.csv"],
      });

      resourceMap.mutateGraph(() => {
        const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

        resourceMap.graph.removeStatementsMatching({
          subject: memberNode,
          predicate: resourceMap.ns.PROV("atLocation"),
        });
        resourceMap.graph.addStatement({
          subject: memberNode,
          predicate: resourceMap.ns.PROV("atLocation"),
          object: rdf.literal("./renamed/../updated.csv"),
        });
      });

      resourceMap.graphState.getMember("data.1").should.deep.include({
        atLocations: ["./renamed/../updated.csv"],
      });

      buildGraphIndexSpy.callCount.should.equal(2);
    });

    it("keeps projected reads on one stable State snapshot during mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.live.member.reads.1",
        memberPids: ["meta.1", "data.1"],
      });
      const documentationLinks = resourceMap.getDocumentationLinks();
      const buildGraphIndexSpy = sandbox.spy(
        ResourceMapState.prototype,
        "buildGraphIndex",
      );

      resourceMap.mutateGraph(() => {
        resourceMap
          .getNodeUriForPid("data.1")
          .should.equal(resourceMap.pidToUri("data.1"));
        resourceMap.graphState.hasMember("data.1").should.equal(true);
        resourceMap.getMemberPids().should.have.members(["meta.1", "data.1"]);
        resourceMap
          .getDocumentationLinks()
          .should.deep.equal(documentationLinks);
      });

      buildGraphIndexSpy.callCount.should.equal(0);
    });

    it("rejects lazy State construction after mutation begins", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.mutation.state.guard.1",
        memberPids: ["meta.1", "data.1"],
      });

      resourceMap.graphState.invalidate();

      expect(() => {
        resourceMap.mutateGraph(() => {
          resourceMap.getMemberPids();
        });
      }).to.throw(
        "ResourceMapState must be built before starting a graph mutation",
      );
    });

    it("tracks saved graph changes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.changes.1",
        memberPids: ["meta.1", "data.1", "source.1"],
      });

      resourceMap.markSaved();
      resourceMap.hasUnsavedChanges().should.equal(false);

      resourceMap.provenance.addWasDerivedFrom("data.1", "source.1");
      resourceMap.hasUnsavedChanges().should.equal(true);

      resourceMap.markSaved();
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("does not mark normalization changes unsaved unless requested", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.dirty.1",
        memberPids: ["meta.1", "data.1"],
      });
      const canonicalUri = resourceMap.getNodeUriForPid("data.1");
      const customUri = "https://example.org/custom/member/normalize";

      resourceMap.mutateGraph(() => {
        resourceMap.graph.replaceNodeValue(canonicalUri, customUri);
      });
      resourceMap.markSaved();

      resourceMap.normalize();
      resourceMap.hasUnsavedChanges().should.equal(false);

      resourceMap.mutateGraph(() => {
        resourceMap.graph.replaceNodeValue(canonicalUri, customUri);
      });
      resourceMap.markSaved();

      resourceMap.normalize({ markDirty: true });
      resourceMap.hasUnsavedChanges().should.equal(true);
    });

    it("rejects normalization when package ownership becomes ambiguous", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.ambiguous.1",
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: rdf.sym("https://example.org/competing-resource-map"),
          predicate: resourceMap.ns.ORE("describes"),
          object: rdf.sym("https://example.org/competing-aggregation"),
        });
      });
      resourceMap.markSaved();
      const before = resourceMap.graph
        .getStatements()
        .map(RDFGraph.buildStatementKey)
        .sort();

      expect(() => resourceMap.normalize())
        .to.throw(ResourceMapCommon.ResourceMapConflictError)
        .with.property("code", "ambiguousResourceMapRoot");
      resourceMap.graph
        .getStatements()
        .map(RDFGraph.buildStatementKey)
        .sort()
        .should.deep.equal(before);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("rejects normalization when package ownership has changed", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.replaced.1",
        memberPids: ["meta.1", "data.1"],
      });
      const originalRoot = rdf.sym(resourceMap.resourceMapUri);
      const originalAggregation = rdf.sym(resourceMap.aggregationUri);
      const replacementRoot = rdf.sym(
        "https://example.org/replacement-resource-map",
      );
      const replacementAggregation = rdf.sym(
        "https://example.org/replacement-aggregation",
      );

      resourceMap.mutateGraph(() => {
        resourceMap.graph.removeStatementsMatching({
          subject: originalRoot,
          predicate: resourceMap.ns.ORE("describes"),
          object: originalAggregation,
        });
        resourceMap.graph.removeStatementsMatching({
          subject: originalAggregation,
          predicate: resourceMap.ns.ORE("isDescribedBy"),
          object: originalRoot,
        });
        resourceMap.graph.addStatement({
          subject: replacementRoot,
          predicate: resourceMap.ns.ORE("describes"),
          object: replacementAggregation,
        });
        resourceMap.graph.addStatement({
          subject: replacementAggregation,
          predicate: resourceMap.ns.ORE("isDescribedBy"),
          object: replacementRoot,
        });
      });
      resourceMap.markSaved();
      const before = resourceMap.graph
        .getStatements()
        .map(RDFGraph.buildStatementKey)
        .sort();

      expect(() => resourceMap.normalize())
        .to.throw(ResourceMapCommon.ResourceMapConflictError)
        .with.property("code", "ambiguousResourceMapRoot");
      resourceMap.graph
        .getStatements()
        .map(RDFGraph.buildStatementKey)
        .sort()
        .should.deep.equal(before);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("does not add singleton self-documentation during normalization", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.solo.dirty.1",
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.removeMembers(["meta.1"]);
      resourceMap.markSaved();

      resourceMap.normalize();

      resourceMap.getDocumentationLinks().should.deep.equal([]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("rolls back normalization when synchronization throws", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.rollback.1",
        memberPids: ["meta.1", "data.1"],
      });
      const subject = rdf.sym("urn:uuid:normalization.rollback.subject");
      const predicate = rdf.sym("urn:uuid:normalization.rollback.predicate");

      resourceMap.markSaved();

      sandbox
        .stub(resourceMap.normalization, "synchronizeCoreGraph")
        .callsFake(() => {
          resourceMap.graph.addStatement({
            subject,
            predicate,
            object: rdf.literal("partial normalization"),
          });
          throw new Error("Normalization synchronization failed");
        });

      expect(() => resourceMap.normalize()).to.throw(
        "Normalization synchronization failed",
      );
      resourceMap.graph
        .findStatements({ subject, predicate })
        .should.deep.equal([]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("rolls back self-documentation when normalization throws", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.normalize.solo.rollback.1",
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.removeMembers(["meta.1"]);
      resourceMap.markSaved();

      sandbox
        .stub(resourceMap.normalization, "synchronizeCoreGraph")
        .throws(new Error("Normalization synchronization failed"));

      expect(() => resourceMap.normalize()).to.throw(
        "Normalization synchronization failed",
      );
      resourceMap.getDocumentationLinks().should.deep.equal([]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("rolls back an outer graph mutation when it throws", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.rollback.1",
        memberPids: ["meta.1", "data.1", "source.1"],
      });

      resourceMap.markSaved();
      resourceMap.graphState.getIndex();

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

    it("creates new maps using the required resolve service URL", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.async.create.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      resourceMap.resolveServiceUrl.should.equal(`${TEST_RESOLVE_BASE}/`);
      resourceMap.resourceMapUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn:uuid:rm.async.create.1`,
      );
    });

    it("builds canonical resolve URIs from the normalized resolve base URL", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.async.create.2",
        resolveServiceUrl: TEST_RESOLVE_BASE,
      });

      resourceMap
        .pidToUri("doi:10.1234/example file")
        .should.equal(`${TEST_RESOLVE_BASE}/doi:10.1234%2Fexample%20file`);
    });

    it("stores a normalized resolveServiceUrl", () => {
      const resourceMap = constructResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.services.1",
        resolveServiceUrl: TEST_RESOLVE_BASE,
      });
      resourceMap.resolveServiceUrl.should.equal(`${TEST_RESOLVE_BASE}/`);
    });

    it("requires resolveServiceUrl in each public construction API", () => {
      expect(
        () =>
          new ResourceMap({
            resourceMapPid: "resource_map_urn:uuid:rm.services.2",
          }),
      ).to.throw("resolveServiceUrl required");
      expect(() =>
        ResourceMap.create({
          resourceMapPid: "resource_map_urn:uuid:rm.services.3",
        }),
      ).to.throw("resolveServiceUrl required");
      expect(() =>
        ResourceMap.fromXml("resource_map_urn:uuid:rm.1", COMPREHENSIVE_XML),
      ).to.throw("resolveServiceUrl required");
    });

    it("preserves an imported exact owner independently of the minting service", () => {
      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
        { resolveServiceUrl: "https://different.example/cn/v2/resolve" },
      );

      resourceMap.resolveServiceUrl.should.equal(
        "https://different.example/cn/v2/resolve/",
      );
      resourceMap.resourceMapUri.should.equal(
        `${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.1`,
      );
    });

    it("selects and indexes 700 members beside unrelated identifiers", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.large.1";
      const ownerBase = "https://owner.example.org/cn/v2/resolve";
      const foreignBase = "https://foreign.example.org/cn/v2/resolve";
      const graph = rdf.graph();
      const resourceMapNode = rdf.sym(
        `${ownerBase}/${encodeURIComponent(resourceMapPid)}`,
      );
      const aggregationNode = rdf.sym(`${resourceMapNode.value}#aggregation`);
      addCompleteBackbone(graph, {
        pid: resourceMapPid,
        rootUri: resourceMapNode.value,
        aggregationUri: aggregationNode.value,
      });

      for (let i = 0; i < 700; i += 1) {
        const memberPid = `data.${i}`;
        const memberNode = rdf.sym(`${ownerBase}/${memberPid}`);
        graph.add(aggregationNode, ns.ORE("aggregates"), memberNode);
        graph.add(memberNode, ns.ORE("isAggregatedBy"), aggregationNode);
        graph.add(memberNode, ns.DCTERMS("identifier"), rdf.literal(memberPid));
        graph.add(
          rdf.sym(`${foreignBase}/program.${i}`),
          ns.DCTERMS("identifier"),
          rdf.literal(`program.${i}`),
        );
      }

      const resourceMap = constructResourceMap({
        resourceMapPid,
        graph,
        resolveServiceUrl: "https://different.example.org/cn/v2/resolve",
      });

      resourceMap.resolveServiceUrl.should.equal(
        "https://different.example.org/cn/v2/resolve/",
      );
      resourceMap.resourceMapUri.should.equal(resourceMapNode.value);
      resourceMap.getMemberPids().should.have.lengthOf(700);
      resourceMap.graphState
        .getMember("data.0")
        .uri.should.equal(`${ownerBase}/data.0`);
      resourceMap.graphState
        .getMember("data.699")
        .uri.should.equal(`${ownerBase}/data.699`);
    });

    it("blocks competing forward ownership pairs with raw diagnostics", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.ambiguous.1";
      const graph = rdf.graph();
      const firstRoot = "https://first.example.org/resolve/resource-map";
      const secondRoot = "https://second.example.org/resolve/resource-map";

      [firstRoot, secondRoot].forEach((rootUri) => {
        addCompleteBackbone(graph, {
          pid: resourceMapPid,
          rootUri,
          aggregationUri: `${rootUri}#aggregation`,
        });
      });
      let conflict;

      try {
        constructResourceMap({ resourceMapPid, graph });
      } catch (error) {
        conflict = error;
      }

      conflict.should.be.instanceOf(ResourceMapCommon.ResourceMapConflictError);
      conflict.code.should.equal("ambiguousResourceMapRoot");
      conflict.details.should.deep.include({
        resourceMapPid,
        reason: "ambiguous",
      });
      conflict.issues.should.have.lengthOf(1);
      conflict.issues[0].forwardStatements.should.have.lengthOf(2);
    });

    it("treats duplicate copies of one forward pair as one owner", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.duplicate-owner.1";
      const rootUri = "https://example.org/resource-map";
      const aggregationUri = `${rootUri}#aggregation`;
      const graph = rdf.graph();
      addCompleteBackbone(graph, {
        pid: resourceMapPid,
        rootUri,
        aggregationUri,
      });
      graph.add(rdf.sym(rootUri), ns.ORE("describes"), rdf.sym(aggregationUri));

      const resourceMap = constructResourceMap({ resourceMapPid, graph });

      resourceMap.resourceMapUri.should.equal(rootUri);
      resourceMap.aggregationUri.should.equal(aggregationUri);
    });

    it("blocks a competing one-way forward pair beside a complete pair", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.one-way-owner.1";
      const rootUri = "https://example.org/resource-map";
      const aggregationUri = `${rootUri}#aggregation`;
      const graph = rdf.graph();
      addCompleteBackbone(graph, {
        pid: resourceMapPid,
        rootUri,
        aggregationUri,
      });
      graph.add(
        rdf.sym("https://example.org/competing-root"),
        ns.ORE("describes"),
        rdf.sym("https://example.org/competing-aggregation"),
      );

      expect(() => constructResourceMap({ resourceMapPid, graph }))
        .to.throw(ResourceMapCommon.ResourceMapConflictError)
        .with.property("code", "ambiguousResourceMapRoot");
    });

    it("blocks malformed forward ownership instead of using an inverse", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.malformed-owner.1";
      const root = rdf.sym("https://example.org/resource-map");
      const aggregation = rdf.sym("https://example.org/aggregation");
      const graph = rdf.graph();
      graph.add(root, ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(root, ns.DCTERMS("identifier"), rdf.literal(resourceMapPid));
      graph.add(aggregation, ns.RDF("type"), ns.ORE("Aggregation"));
      graph.add(aggregation, ns.ORE("isDescribedBy"), root);
      graph.add(root, ns.ORE("describes"), rdf.literal(aggregation.value));
      let conflict;

      try {
        constructResourceMap({ resourceMapPid, graph });
      } catch (error) {
        conflict = error;
      }

      conflict.details.reason.should.equal("malformed");
      conflict.issues[0].malformedOwnershipStatements.should.have.lengthOf(1);
      graph
        .statementsMatching(root, ns.ORE("describes"))
        .some(({ object }) => RDFGraph.isNamedNode(object))
        .should.equal(false);
    });

    it("recovers one exact inverse-only owner before ordinary synchronization", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.inverse-only.1";
      const root = rdf.sym("https://example.org/resource-map");
      const aggregation = rdf.sym("https://example.org/aggregation");
      const graph = rdf.graph();
      graph.add(root, ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(root, ns.DCTERMS("identifier"), rdf.literal(resourceMapPid));
      graph.add(aggregation, ns.RDF("type"), ns.ORE("Aggregation"));
      graph.add(aggregation, ns.ORE("isDescribedBy"), root);

      const resourceMap = constructResourceMap({ resourceMapPid, graph });

      resourceMap.resourceMapUri.should.equal(root.value);
      resourceMap.aggregationUri.should.equal(aggregation.value);
      resourceMap.graph
        .hasStatement({
          subject: root,
          predicate: ns.ORE("describes"),
          object: aggregation,
        })
        .should.equal(true);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("counts inverse pairs before type and PID guards", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.inverse-choice.1";
      const graph = rdf.graph();
      const validRoot = rdf.sym("https://example.org/valid-root");
      const validAggregation = rdf.sym("https://example.org/valid-aggregation");
      graph.add(validRoot, ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(
        validRoot,
        ns.DCTERMS("identifier"),
        rdf.literal(resourceMapPid),
      );
      graph.add(validAggregation, ns.RDF("type"), ns.ORE("Aggregation"));
      graph.add(validAggregation, ns.ORE("isDescribedBy"), validRoot);
      graph.add(
        rdf.sym("https://example.org/untyped-aggregation"),
        ns.ORE("isDescribedBy"),
        rdf.sym("https://example.org/untyped-root"),
      );

      expect(() => constructResourceMap({ resourceMapPid, graph }))
        .to.throw(ResourceMapCommon.ResourceMapConflictError)
        .with.property("code", "ambiguousResourceMapRoot");
    });

    it("blocks the sole inverse candidate when its guards fail", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.inverse-guard.1";
      const root = rdf.sym("https://example.org/resource-map");
      const aggregation = rdf.sym("https://example.org/aggregation");
      const graph = rdf.graph();
      graph.add(root, ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(root, ns.DCTERMS("identifier"), rdf.literal("different.pid"));
      graph.add(aggregation, ns.RDF("type"), ns.ORE("Aggregation"));
      graph.add(aggregation, ns.ORE("isDescribedBy"), root);
      let conflict;

      try {
        constructResourceMap({ resourceMapPid, graph });
      } catch (error) {
        conflict = error;
      }

      conflict.details.reason.should.equal("contradictory");
      conflict.issues[0].selectedCandidate.subject.value.should.equal(
        aggregation.value,
      );
      graph
        .statementsMatching(root, ns.ORE("describes"))
        .should.have.lengthOf(0);
    });

    it("does not use configured services to break an ownership tie", () => {
      const resourceMapPid = "resource_map_doi:10.5063/F1+RESOLVE";
      const encodedPid = "resource_map_doi:10.5063%2FF1%2BRESOLVE";
      const resolveServiceUrl = "https://cn.example.org/cn/v2/resolve";
      const resolveRoot = `${resolveServiceUrl}/${encodedPid}`;
      const foreignRoot = `https://foreign.example.org/resolve/${encodedPid}`;
      const xml = buildBackbonesXml(resourceMapPid, [
        {
          rootUri: foreignRoot,
          aggregationUri: `${foreignRoot}#aggregation`,
        },
        {
          rootUri: resolveRoot,
          aggregationUri: `${resolveRoot}#aggregation`,
        },
      ]);

      expect(() =>
        parseResourceMap(resourceMapPid, xml, {
          resolveServiceUrl,
          objectServiceUrl: `https://mn.example.org/mn/v2/object/${encodedPid}`,
        }),
      )
        .to.throw(ResourceMapCommon.ResourceMapConflictError)
        .with.property("code", "ambiguousResourceMapRoot");
    });

    it("does not invent a root for a supplied ownerless graph", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.ownerless.1";
      const graph = rdf.graph();
      const aggregation = rdf.sym("https://example.org/aggregation");
      graph.add(aggregation, ns.RDF("type"), ns.ORE("Aggregation"));
      const before = graph.statements.map((statement) => statement.toNT());

      expect(() => constructResourceMap({ resourceMapPid, graph }))
        .to.throw(ResourceMapCommon.ResourceMapConflictError)
        .with.property("code", "ambiguousResourceMapRoot");
      graph.statements
        .map((statement) => statement.toNT())
        .should.deep.equal(before);
    });

    it("preserves an incomplete root-like node unrelated to the selected owner", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.complete-owner.1";
      const graph = rdf.graph();
      const selectedRoot = "https://example.org/selected-resource-map";
      const selectedAggregation = "https://example.org/selected-aggregation";
      const incompleteRoot = "https://example.org/incomplete-resource-map";
      addCompleteBackbone(graph, {
        pid: resourceMapPid,
        rootUri: selectedRoot,
        aggregationUri: selectedAggregation,
      });
      graph.add(
        rdf.sym(incompleteRoot),
        ns.DCTERMS("identifier"),
        rdf.literal(resourceMapPid),
      );
      graph.add(rdf.sym(incompleteRoot), ns.RDF("type"), ns.ORE("ResourceMap"));

      const resourceMap = constructResourceMap({ resourceMapPid, graph });

      resourceMap.resourceMapUri.should.equal(selectedRoot);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(incompleteRoot),
          predicate: ns.RDF("type"),
          object: ns.ORE("ResourceMap"),
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(incompleteRoot),
          predicate: ns.ORE("describes"),
        })
        .should.equal(false);
    });

    it("adds missing types and the selected reciprocal without changing identity", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.recoverable.1";
      const rootUri = "https://example.org/imported-resource-map";
      const aggregationUri = "https://example.org/imported-aggregation";
      const graph = rdf.graph();
      graph.add(
        rdf.sym(rootUri),
        ns.DCTERMS("identifier"),
        rdf.literal(resourceMapPid),
      );
      graph.add(rdf.sym(rootUri), ns.ORE("describes"), rdf.sym(aggregationUri));

      const resourceMap = constructResourceMap({
        resourceMapPid,
        graph,
      });

      resourceMap.resourceMapUri.should.equal(rootUri);
      resourceMap.aggregationUri.should.equal(aggregationUri);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(rootUri),
          predicate: ns.RDF("type"),
          object: ns.ORE("ResourceMap"),
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(aggregationUri),
          predicate: ns.RDF("type"),
          object: ns.ORE("Aggregation"),
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(rootUri),
          predicate: ns.ORE("describes"),
          object: rdf.sym(aggregationUri),
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: rdf.sym(aggregationUri),
          predicate: ns.ORE("isDescribedBy"),
          object: rdf.sym(rootUri),
        })
        .should.equal(true);
    });

    it("exposes contradictory root identifiers as model-level edit blockers", () => {
      const resourceMapPid = "resource_map_urn:uuid:rm.conflicting-id.1";
      const rootUri = "https://example.org/conflicting-resource-map";
      const aggregationUri = `${rootUri}#aggregation`;
      const graph = rdf.graph();
      addCompleteBackbone(graph, {
        pid: resourceMapPid,
        rootUri,
        aggregationUri,
      });
      graph.add(
        rdf.sym(rootUri),
        ns.DCTERMS("identifier"),
        rdf.literal("resource_map_urn:uuid:different.1"),
      );

      const resourceMap = constructResourceMap({ resourceMapPid, graph });

      getIssueCodes(resourceMap.getEditBlockers()).should.include(
        "resourceMapIdentifierMismatch",
      );
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(rootUri),
          predicate: ns.DCTERMS("identifier"),
        })
        .map(({ object }) => object.value)
        .should.have.members([
          resourceMapPid,
          "resource_map_urn:uuid:different.1",
        ]);
    });

    it("preserves an arbitrary absolute member identity with its literal PID", () => {
      const resourceMapPid = "resource_map_urn:uuid:custom-member.1";
      const rootUri = "https://example.org/resource-map";
      const aggregationUri = `${rootUri}#aggregation`;
      const memberUri = "https://example.org/resolvedata.1";
      const graph = rdf.graph();
      addCompleteBackbone(graph, {
        pid: resourceMapPid,
        rootUri,
        aggregationUri,
      });
      graph.add(
        rdf.sym(aggregationUri),
        ns.ORE("aggregates"),
        rdf.sym(memberUri),
      );
      graph.add(
        rdf.sym(memberUri),
        ns.ORE("isAggregatedBy"),
        rdf.sym(aggregationUri),
      );
      graph.add(
        rdf.sym(memberUri),
        ns.DCTERMS("identifier"),
        rdf.literal("data.1"),
      );

      const resourceMap = constructResourceMap({ resourceMapPid, graph });

      resourceMap.getNodeUriForPid("data.1").should.equal(memberUri);
      resourceMap.getEditBlockers().should.deep.equal([]);
    });

    it("repairs missing ore:Aggregation typing during fromXml normalization", () => {
      const xmlMissingAggregationType = COMPREHENSIVE_XML.replace(
        `<rdf:Description rdf:about="${TEST_RESOLVE_BASE}resource_map_urn%3Auuid%3Arm.1#aggregation">\n      <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>`,
        `<rdf:Description rdf:about="${TEST_RESOLVE_BASE}resource_map_urn%3Auuid%3Arm.1#aggregation">`,
      );

      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        xmlMissingAggregationType,
      );
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);

      resourceMap.graph
        .findStatements({
          subject: aggregationNode,
          predicate: resourceMap.ns.RDF("type"),
          object: resourceMap.ns.ORE("Aggregation"),
        })
        .length.should.equal(1);
      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidPackageStructure",
      );
    });

    it("preserves a selected complete non-hash aggregation URI", () => {
      const source = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.nonhash.1",
      });
      const legacyAggregationUri = `${source.resourceMapUri}/aggregation`;
      const xml = source
        .serialize()
        .split(source.aggregationUri)
        .join(legacyAggregationUri);

      const resourceMap = parseResourceMap(source.resourceMapPid, xml);

      resourceMap.hasUnsavedChanges().should.equal(false);
      resourceMap.aggregationUri.should.equal(legacyAggregationUri);
      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidPackageStructure",
      );
      const serialized = resourceMap.serialize();
      serialized.should.contain(resourceMap.aggregationUri);
      serialized.should.contain(legacyAggregationUri);
    });

    it("includes explicit ore:Aggregation typing in serialized XML", () => {
      const xml = createBaseResourceMap().serialize();

      xml.should.contain(
        'rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"',
      );
    });

    // Contract test for package updates on legacy maps: RDF this model does
    // not manage (foreign vocabularies, external subjects, blank-node
    // annotations from other tools) must survive parse → membership edit →
    // serialize, or updating a package would silently destroy it.
    it("preserves foreign RDF through a parse, membership edit, and serialize round trip", () => {
      const resolve = (pid) =>
        `${TEST_RESOLVE_BASE}/${encodeURIComponent(pid)}`;
      const rmPid = "resource_map_urn:uuid:rm.foreign.1";
      const metaPid = "meta.foreign.1";
      const dataPid = "data.foreign.1";
      const addedPid = "data.foreign.2";
      const externalUri = "https://example.org/external/thing";
      const EX = rdf.Namespace("https://example.org/vocab#");
      const legacyXml = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<rdf:RDF xmlns:cito="http://purl.org/spar/cito/"',
        '         xmlns:dcterms="http://purl.org/dc/terms/"',
        '         xmlns:ore="http://www.openarchives.org/ore/terms/"',
        '         xmlns:ex="https://example.org/vocab#"',
        '         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
        `  <rdf:Description rdf:about="${resolve(rmPid)}">`,
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
        `    <dcterms:identifier>${rmPid}</dcterms:identifier>`,
        `    <ore:describes rdf:resource="${resolve(rmPid)}#aggregation"/>`,
        "    <dcterms:description>Produced by legacy-tool 1.2</dcterms:description>",
        "  </rdf:Description>",
        `  <rdf:Description rdf:about="${resolve(rmPid)}#aggregation">`,
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
        `    <ore:isDescribedBy rdf:resource="${resolve(rmPid)}"/>`,
        `    <ore:aggregates rdf:resource="${resolve(metaPid)}"/>`,
        `    <ore:aggregates rdf:resource="${resolve(dataPid)}"/>`,
        "  </rdf:Description>",
        `  <rdf:Description rdf:about="${resolve(metaPid)}">`,
        `    <dcterms:identifier>${metaPid}</dcterms:identifier>`,
        `    <cito:documents rdf:resource="${resolve(dataPid)}"/>`,
        '    <ex:annotation rdf:nodeID="ann1"/>',
        "  </rdf:Description>",
        '  <rdf:Description rdf:nodeID="ann1">',
        "    <ex:label>legacy annotation</ex:label>",
        "  </rdf:Description>",
        `  <rdf:Description rdf:about="${resolve(dataPid)}">`,
        `    <dcterms:identifier>${dataPid}</dcterms:identifier>`,
        `    <cito:isDocumentedBy rdf:resource="${resolve(metaPid)}"/>`,
        "    <ex:qualityLevel>high</ex:qualityLevel>",
        "  </rdf:Description>",
        `  <rdf:Description rdf:about="${externalUri}">`,
        `    <ex:relatedTo rdf:resource="${resolve(dataPid)}"/>`,
        "  </rdf:Description>",
        "</rdf:RDF>",
      ].join("\n");

      const resourceMap = parseResourceMap(rmPid, legacyXml);
      resourceMap.setPackageStructure(
        [...resourceMap.getMemberPids(), addedPid],
        resourceMap.getDocumentationLinks(),
      );
      resourceMap.linkDocumentation(metaPid, addedPid);

      const reparsed = rdf.graph();
      rdf.parse(
        resourceMap.serialize(),
        reparsed,
        `${TEST_RESOLVE_BASE}/`,
        "application/rdf+xml",
      );
      const objectValues = (subjectUri, predicate) =>
        reparsed
          .statementsMatching(rdf.sym(subjectUri), predicate, undefined)
          .map((statement) => statement.object.value);
      // Parsing canonicalizes the legacy percent-encoded node URIs, so read
      // the expected subject URIs back from the model.
      const dataUri = resourceMap.getNodeUriForPid(dataPid);
      const metaUri = resourceMap.getNodeUriForPid(metaPid);

      objectValues(
        resourceMap.aggregationUri,
        ns.ORE("aggregates"),
      ).should.include(resourceMap.getNodeUriForPid(addedPid));
      objectValues(
        resourceMap.resourceMapUri,
        ns.DCTERMS("description"),
      ).should.deep.equal(["Produced by legacy-tool 1.2"]);
      objectValues(dataUri, EX("qualityLevel")).should.deep.equal(["high"]);
      objectValues(externalUri, EX("relatedTo")).should.deep.equal([dataUri]);
      const annotations = reparsed.statementsMatching(
        rdf.sym(metaUri),
        EX("annotation"),
        undefined,
      );
      annotations.should.have.lengthOf(1);
      reparsed
        .statementsMatching(annotations[0].object, EX("label"), undefined)
        .map((statement) => statement.object.value)
        .should.deep.equal(["legacy annotation"]);
    });

    it("throws parsed DataONE service errors from XML preflight", () => {
      let caught = null;

      try {
        parseResourceMap("resource_map_urn:uuid:rm.1", ERROR_XML);
      } catch (error) {
        caught = error;
      }

      expect(caught).to.be.instanceOf(Error);
      expect(caught.name).to.equal("NotAuthorized");
      expect(caught.message).to.equal("READ not allowed");
      expect(caught.status).to.equal("401");
    });

    it("keeps validate() pure and returns issues without storing model state", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.validation.pure.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [],
      });

      const issues = resourceMap.validate();

      issues.should.deep.equal([]);
      resourceMap.getEditBlockers().should.deep.equal([]);
      expect("validationErrors" in resourceMap).to.equal(false);
    });

    it("preserves an explicit modified timestamp on first serialization of created maps", () => {
      const modified = "2024-01-02T03:04:05.000Z";
      const resourceMap = createResourceMap({
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

      const reparsed = parseResourceMap(
        "resource_map_urn:uuid:rm.modified.preserve.1",
        xml,
      );
      reparsed.getSummary().modified.should.equal(modified);
    });

    it("preserves raw prov:atLocation values", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.display.1",
        members: [
          { pid: "meta.1" },
          { pid: "data.1", atLocations: ["./q/../w.csv"] },
          { pid: "data.2", atLocations: ["~/q/w.csv"] },
          { pid: "data.3", atLocations: ["folder1///folder2/file.txt"] },
          { pid: "data.4", atLocations: ["."] },
        ],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      resourceMap.graphState.getMember("data.1").should.deep.include({
        atLocations: ["./q/../w.csv"],
      });
      resourceMap.graphState.getMember("data.4").should.deep.include({
        atLocations: ["."],
      });
      resourceMap.graphState.getMember("data.2").should.deep.include({
        atLocations: ["~/q/w.csv"],
      });

      const xml = resourceMap.serialize();
      xml.should.contain(">./q/../w.csv<");
      xml.should.contain(">~/q/w.csv<");
      xml.should.contain(">folder1///folder2/file.txt<");

      const reparsed = parseResourceMap(
        "resource_map_urn:uuid:rm.atlocation.display.1",
        xml,
      );

      reparsed.graphState.getMember("data.2").should.deep.include({
        atLocations: ["~/q/w.csv"],
      });
      reparsed.graphState.getMember("data.3").should.deep.include({
        atLocations: ["folder1///folder2/file.txt"],
      });
    });

    it("stores root-escaping prov:atLocation values without rewriting them", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.escape.write.1",
        memberPids: ["meta.1", "data.1"],
      });

      resourceMap.setLocation("data.1", "../x.csv");
      resourceMap.graphState.getMember("data.1").should.deep.include({
        atLocations: ["../x.csv"],
      });

      resourceMap.setLocation("data.1", "a/../../x.csv");
      resourceMap.graphState.getMember("data.1").should.deep.include({
        atLocations: ["a/../../x.csv"],
      });
    });

    it("rejects location updates for indexed nonmembers", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.nonmember.1",
        memberPids: ["meta.1", "data.1"],
      });
      const externalPid = "external.data.1";
      const externalNode = rdf.sym("https://example.org/external-data");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: externalNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(externalPid),
          });
        },
        { markDirty: false },
      );

      expect(() =>
        resourceMap.setLocation(resourceMap.resourceMapPid, "map.rdf"),
      ).to.throw("is not aggregated");
      expect(() =>
        resourceMap.setMemberLocations([
          { pid: externalPid, atLocations: ["external/data.csv"] },
        ]),
      ).to.throw("is not aggregated");
    });

    it("writes locations to the exact aggregated member node", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.member-node.1",
        memberPids: ["meta.1", "data.1"],
      });
      const memberPid = "data.1";
      const canonicalUri = resourceMap.pidToUri(memberPid);
      const customMemberUri = "https://example.org/aggregated-data";

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.replaceNodeValue(canonicalUri, customMemberUri);
          resourceMap.graph.addStatement({
            subject: rdf.sym(canonicalUri),
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(memberPid),
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState
        .getMember(memberPid)
        .uri.should.equal(customMemberUri);
      resourceMap.graphState
        .findNodeUriForPid(memberPid)
        .should.equal(customMemberUri);

      resourceMap.setLocation(memberPid, "member/data.csv");
      resourceMap.addLocation(memberPid, "member/second.csv");
      resourceMap.removeLocation(memberPid, "member/data.csv");

      resourceMap.graph
        .findStatements({
          subject: rdf.sym(customMemberUri),
          predicate: resourceMap.ns.PROV("atLocation"),
        })
        .map(({ object }) => object.value)
        .should.deep.equal(["member/second.csv"]);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(canonicalUri),
          predicate: resourceMap.ns.PROV("atLocation"),
        })
        .should.deep.equal([]);
      resourceMap.graphState
        .getMember(memberPid)
        .atLocations.should.deep.equal(["member/second.csv"]);
    });

    it("sets prov:atLocation values for multiple members in one mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.batch.1",
        memberPids: ["meta.1", "data.1", "data.2", "data.3"],
      });
      resourceMap.setLocation("data.1", "data/original.csv");
      const mutateSpy = sandbox.spy(resourceMap, "mutateGraph");

      resourceMap.setMemberLocations([
        {
          pid: "data.1",
          atLocations: ["data/replacement.csv", "data/second.csv"],
        },
        { pid: "data.2", atLocations: ["data/other.csv"] },
      ]);

      mutateSpy.callCount.should.equal(1);
      resourceMap.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal([
          "data/replacement.csv",
          "data/second.csv",
        ]);
      resourceMap.graphState
        .getMember("data.2")
        .atLocations.should.deep.equal(["data/other.csv"]);
      resourceMap.graphState
        .getMember("data.3")
        .atLocations.should.deep.equal([]);
    });

    it("clears member locations with an empty batch atLocations array", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.batch.clear.1",
        memberPids: ["meta.1", "data.1", "data.2"],
      });
      resourceMap.setMemberLocations([
        { pid: "data.1", atLocations: ["data/first.csv"] },
        { pid: "data.2", atLocations: ["data/second.csv"] },
      ]);

      resourceMap.setMemberLocations([{ pid: "data.1", atLocations: [] }]);

      resourceMap.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal([]);
      resourceMap.graphState
        .getMember("data.2")
        .atLocations.should.deep.equal(["data/second.csv"]);
    });

    it("preserves multiple prov:atLocation values through serialization", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.multiple.1",
        memberPids: ["meta.1", "data.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.setLocation("data.1", "data/first.csv");
      resourceMap.graph.addStatement({
        subject: dataNode,
        predicate: resourceMap.ns.PROV("atLocation"),
        object: rdf.literal("data/second.csv"),
      });

      resourceMap.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/first.csv", "data/second.csv"]);

      const xml = resourceMap.serialize();
      const reparsed = parseResourceMap(
        "resource_map_urn:uuid:rm.atlocation.multiple.1",
        xml,
      );

      reparsed.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/first.csv", "data/second.csv"]);
    });

    it("creates members with multiple prov:atLocation values", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.create.multiple.1",
        members: [
          {
            pid: "data.1",
            atLocations: ["data/first.csv", "data/second.csv"],
          },
        ],
      });

      resourceMap.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal(["data/first.csv", "data/second.csv"]);
    });

    it("requires member atLocations to be an array", () => {
      expect(() =>
        createResourceMap({
          resourceMapPid: "resource_map_urn:uuid:rm.atlocation.create.scalar.1",
          members: [{ pid: "data.1", atLocations: "data/file.csv" }],
        }),
      ).to.throw("atLocations must be an array");
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
      resourceMap.graphState.getMember("data.2").should.deep.include({
        atLocations: ["nested/data.csv"],
      });

      resourceMap.unlinkDocumentation("meta.1", "data.2");
      resourceMap.removeLocation("data.2", "nested/data.csv");

      resourceMap.getDocumentationLinks().should.deep.equal([]);
      resourceMap.graphState
        .getMember("data.2")
        .atLocations.should.deep.equal([]);
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
      const mutateGraphSpy = sandbox.spy(resourceMap, "mutateGraph");

      resourceMap.setDocumentationLinks(links);
      mutateGraphSpy.callCount.should.equal(1);
      resourceMap.getDocumentationLinks().should.deep.equal(links);

      resourceMap.setDocumentationLinks(links);
      mutateGraphSpy.callCount.should.equal(1);
    });

    it("repairs an incomplete reciprocal documentation link", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.docs.repair.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [],
      });
      const metadataNode = rdf.sym(resourceMap.getNodeUriForPid("meta.1"));
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const link = { metadataPid: "meta.1", dataPid: "data.1" };

      resourceMap.graph.addStatement({
        subject: metadataNode,
        predicate: resourceMap.ns.CITO("documents"),
        object: dataNode,
      });
      resourceMap.graphState.invalidate();

      resourceMap.setDocumentationLinks([link]);

      resourceMap.getDocumentationLinks().should.deep.equal([link]);
      resourceMap.graph
        .hasStatement({
          subject: dataNode,
          predicate: resourceMap.ns.CITO("isDocumentedBy"),
          object: metadataNode,
        })
        .should.equal(true);
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

      resourceMap.graph.addStatement({
        subject: rdf.sym(resourceMap.aggregationUri),
        predicate: resourceMap.ns.ORE("aggregates"),
        object: rdf.literal("literal.member.pid"),
      });
      resourceMap.graph.addStatement({
        subject: rdf.sym(resourceMap.getNodeUriForPid("meta.1")),
        predicate: resourceMap.ns.CITO("documents"),
        object: rdf.literal("literal.data.pid"),
      });
      resourceMap.graphState.invalidate();

      resourceMap.getMemberPids().should.deep.equal(["meta.1"]);
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "meta.1",
        },
      ]);
    });

    it("round-trips root-escaping prov:atLocation values without rewriting them", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.atlocation.escape.read.1",
        memberPids: ["meta.1", "data.1", "data.2"],
      });
      const data1Node = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const data2Node = rdf.sym(resourceMap.getNodeUriForPid("data.2"));

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: data1Node,
            predicate: resourceMap.ns.PROV("atLocation"),
            object: rdf.literal("../x.csv"),
          });
          resourceMap.graph.addStatement({
            subject: data2Node,
            predicate: resourceMap.ns.PROV("atLocation"),
            object: rdf.literal("a/../../x.csv"),
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState.getMember("data.1").should.deep.include({
        atLocations: ["../x.csv"],
      });
      resourceMap.graphState.getMember("data.2").should.deep.include({
        atLocations: ["a/../../x.csv"],
      });

      const xml = resourceMap.serialize({
        validate: false,
      });
      xml.should.contain(">../x.csv<");
      xml.should.contain(">a/../../x.csv<");

      const reparsed = parseResourceMap(
        "resource_map_urn:uuid:rm.atlocation.escape.read.1",
        xml,
      );

      reparsed.graphState.getMember("data.1").should.deep.include({
        atLocations: ["../x.csv"],
      });
    });

    it("reads creator names from both creator predicates and arbitrary prefixes", () => {
      const dctermsCreatorMap = parseResourceMap(
        "resource_map_urn:uuid:rm.creator.1",
        DCTERMS_CREATOR_XML,
      );
      dctermsCreatorMap
        .getSummary()
        .creatorName.should.equal("DCTERMS Creator");

      const prefixedCreatorMap = parseResourceMap(
        "urn:uuid:rm.prefixed.1",
        PREFIX_ALIAS_CREATOR_XML,
      );
      prefixedCreatorMap
        .getSummary()
        .creatorName.should.equal("Prefixed Creator");
    });

    it("preserves unrelated identifiers when changing the resource map PID", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:old.1",
      });

      resourceMap.normalization.synchronizeCoreGraph(
        resourceMap.graphState.getMemberDescriptors(),
      );
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: rdf.sym(resourceMap.resourceMapUri),
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              "alternate-resource map-id",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
        },
        { markDirty: false },
      );

      resourceMap.setResourceMapPid("resource_map_urn:uuid:new.1");

      resourceMap.resourceMapPid.should.equal("resource_map_urn:uuid:new.1");
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(resourceMap.resourceMapUri),
          predicate: resourceMap.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .filter(Boolean)
        .should.have.members([
          "resource_map_urn:uuid:new.1",
          "alternate-resource map-id",
        ]);
    });

    it("rewrites only the selected root and aggregation when the PID changes", () => {
      const oldPid = "resource_map_doi:10.5063/F1+OLD";
      const newPid = "resource_map_doi:10.5063/F1+NEW";
      const resolveBase = TEST_RESOLVE_BASE;
      const rootNotePredicate = rdf.sym("https://example.org/test#rootNote");
      const aggregationNotePredicate = rdf.sym(
        "https://example.org/test#aggregationNote",
      );
      const graph = rdf.graph();
      const rootCustomNode = rdf.sym("https://example.org/custom/root.old");
      const aggregationNode = rdf.sym(
        "https://example.org/custom/aggregation.old",
      );
      const memberNode = rdf.sym("https://example.org/custom/meta.1");

      graph.add(rootCustomNode, ns.DCTERMS("identifier"), rdf.literal(oldPid));
      graph.add(rootCustomNode, ns.RDF("type"), ns.ORE("ResourceMap"));
      graph.add(rootCustomNode, ns.ORE("describes"), aggregationNode);
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

      const resourceMap = constructResourceMap({
        resourceMapPid: oldPid,
        graph,
        resolveServiceUrl: resolveBase,
      });

      resourceMap.setResourceMapPid(newPid);

      resourceMap.resourceMapUri.should.equal(
        `${resolveBase}/resource_map_doi:10.5063%2FF1%2BNEW`,
      );
      resourceMap.aggregationUri.should.equal(
        `${resolveBase}/resource_map_doi:10.5063%2FF1%2BNEW#aggregation`,
      );
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(resourceMap.resourceMapUri),
          predicate: resourceMap.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .filter(Boolean)
        .should.include(newPid);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(resourceMap.resourceMapUri),
          predicate: rootNotePredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["root note"]);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(resourceMap.aggregationUri),
          predicate: aggregationNotePredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["aggregation note"]);

      const allValues = resourceMap.graph
        .getStatements()
        .flatMap((statement) => [
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
        resolveServiceUrl: TEST_RESOLVE_BASE,
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
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      const executionId =
        resourceMap.provenance.getUsedByPrograms()[0].executionId;

      resourceMap.replaceMember("data.1", "data.renamed.1");

      resourceMap
        .getMemberPids()
        .should.have.members([
          "meta.1",
          "data.renamed.1",
          "derived.1",
          "program.1",
        ]);
      expect(resourceMap.graphState.getMember("data.1")).to.equal(null);
      resourceMap.graphState.getMember("data.renamed.1").should.deep.include({
        pid: "data.renamed.1",
        uri: `${TEST_RESOLVE_BASE}/data.renamed.1`,
        atLocations: ["data/data.csv"],
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
          executionId,
        },
      ]);
      hasNodeReferences(resourceMap, oldMemberNode).should.equal(false);
    });

    it("canonicalizes managed member nodes when replacing their PID", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.replace.member.2",
        resolveServiceUrl: TEST_RESOLVE_BASE,
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });
      const customMemberUri = "https://example.org/custom/member/data.1";
      const dataNodeUri = resourceMap.getNodeUriForPid("data.1");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.replaceNodeValue(dataNodeUri, customMemberUri);
        },
        { markDirty: false },
      );

      resourceMap.replaceMember("data.1", "data.custom.1");

      resourceMap
        .getNodeUriForPid("data.custom.1")
        .should.equal(`${TEST_RESOLVE_BASE}/data.custom.1`);
      expect(resourceMap.graphState.getMember("data.1")).to.equal(null);
      resourceMap.graphState.getMember("data.custom.1").should.deep.include({
        pid: "data.custom.1",
        uri: `${TEST_RESOLVE_BASE}/data.custom.1`,
      });
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(`${TEST_RESOLVE_BASE}/data.custom.1`),
          predicate: resourceMap.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .filter(Boolean)
        .should.deep.equal(["data.custom.1"]);
      hasNodeReferences(resourceMap, rdf.sym(customMemberUri)).should.equal(
        false,
      );
    });

    it("rewrites every package and provenance reference when replacing a weirdly encoded member PID", () => {
      const oldPid = "doi:10.5063/F1+OLDDATA";
      const newPid = "doi:10.5063/F1+NEWDATA";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.replace.member.weird.1",
        resolveServiceUrl: TEST_RESOLVE_BASE,
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

      resourceMap.graph.replaceNodeValue(
        oldCanonicalUri,
        "https://example.org/custom/member/old-data",
      );
      resourceMap.provenance.addWasDerivedFrom("derived.1", oldPid);
      resourceMap.provenance.addUsedByProgram(oldPid, "program.1");
      const executionId =
        resourceMap.provenance.getUsedByPrograms()[0].executionId;

      resourceMap.replaceMember(oldPid, newPid);

      expect(resourceMap.graphState.getMember(oldPid)).to.equal(null);
      resourceMap.graphState.getMember(newPid).should.deep.include({
        pid: newPid,
        uri: `${TEST_RESOLVE_BASE}/doi:10.5063%2FF1%2BNEWDATA`,
        atLocations: ["data/old.csv"],
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
          executionId,
        },
      ]);

      const graphValues = resourceMap.graph
        .getStatements()
        .flatMap((statement) => [
          statement.subject?.value,
          statement.object?.value,
        ]);
      graphValues.should.not.include(oldPid);
      graphValues.should.not.include(oldCanonicalUri);
      graphValues.should.not.include(
        "https://example.org/custom/member/old-data",
      );
      resourceMap.graph
        .findStatements({
          predicate: resourceMap.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
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

    it("refuses member mutations before choosing between duplicate URIs", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.member.ambiguity.1",
        memberPids: ["meta.1", "data.1"],
      });
      const duplicateUri = "https://foreign.example.org/cn/v2/resolve/data.1";
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
      const before = resourceMap.graph
        .getStatements()
        .map((statement) => statement.toNT())
        .sort();

      [
        () => resourceMap.removeMembers(["data.1"]),
        () => resourceMap.replaceMember("data.1", "data.2"),
      ].forEach((mutate) => {
        let conflict;
        try {
          mutate();
        } catch (error) {
          conflict = error;
        }
        conflict.code.should.equal("ambiguousMemberPid");
        conflict.details.should.deep.equal({
          pid: "data.1",
          memberUris: [resourceMap.pidToUri("data.1"), duplicateUri].sort(),
        });
        resourceMap.graph
          .getStatements()
          .map((statement) => statement.toNT())
          .sort()
          .should.deep.equal(before);
      });
    });

    it("ignores absent PIDs when removing members", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.absent.1",
        memberPids: ["meta.1", "data.1"],
      });
      resourceMap.markSaved();

      resourceMap
        .removeMembers(["never.aggregated.1"])
        .should.equal(resourceMap);

      resourceMap.getMemberPids().should.have.members(["meta.1", "data.1"]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("ignores indexed provenance PIDs that are not members", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.external.1",
        memberPids: ["meta.1", "data.1"],
      });
      const externalPid = "urn:uuid:external-source.remove.1";
      const externalNode = rdf.sym(externalPid);
      const notePredicate = rdf.sym("https://example.org/vocab#note");
      resourceMap.provenance.addWasDerivedFrom("data.1", externalPid);
      resourceMap.graph.addStatement({
        subject: externalNode,
        predicate: notePredicate,
        object: rdf.literal("keep external provenance"),
      });
      resourceMap.markSaved();

      resourceMap.removeMembers([externalPid]).should.equal(resourceMap);

      resourceMap.provenance
        .getWasDerivedFromLinks()
        .should.deep.equal([{ derivedPid: "data.1", sourcePid: externalPid }]);
      resourceMap.graph
        .findStatements({
          subject: externalNode,
          predicate: notePredicate,
          object: rdf.literal("keep external provenance"),
        })
        .should.have.lengthOf(1);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("rolls back every nested mutation when the outer mutation fails", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.rollback.nested.1",
        memberPids: ["meta.1", "data.1", "source.1"],
      });

      resourceMap.markSaved();
      resourceMap.graphState.getIndex();
      const originalPid = resourceMap.resourceMapPid;
      const originalResourceMapUri = resourceMap.resourceMapUri;
      const originalAggregationUri = resourceMap.aggregationUri;

      expect(() =>
        resourceMap.mutateGraph(
          () => {
            // Inner mutations succeed before the outer mutator throws; the
            // outer rollback must undo them too.
            resourceMap.provenance.addWasDerivedFrom("data.1", "source.1");
            resourceMap.setLocation("data.1", "data/rolled-back.csv");
            resourceMap.setResourceMapPid(
              "resource_map_urn:uuid:rm.rollback.nested.changed.1",
            );
            throw new Error("Outer mutation failed");
          },
          { rollbackOnError: true },
        ),
      ).to.throw("Outer mutation failed");

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.graphState
        .getMember("data.1")
        .atLocations.should.deep.equal([]);
      resourceMap.resourceMapPid.should.equal(originalPid);
      resourceMap.resourceMapUri.should.equal(originalResourceMapUri);
      resourceMap.aggregationUri.should.equal(originalAggregationUri);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("throws on XML that cannot be parsed", () => {
      expect(() =>
        parseResourceMap("resource_map_urn:uuid:rm.bad.xml.1", "   "),
      ).to.throw("resourceMapXml required");
      expect(() =>
        parseResourceMap("resource_map_urn:uuid:rm.bad.xml.2", "<rdf:RDF>"),
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
        parseResourceMap("resource_map_urn:uuid:rm.bad.rdf.1", invalidRdfXml),
      ).to.throw("Parse failed");
    });

    it("adds singleton self-documentation only to validated output", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:meta.only.1",
        members: [{ pid: "meta.only.1" }],
        documentationLinks: [],
      });
      const metadataNode = rdf.sym(resourceMap.getNodeUriForPid("meta.only.1"));

      resourceMap.getDocumentationLinks().should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: metadataNode,
          predicate: resourceMap.ns.CITO("documents"),
          object: metadataNode,
        })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({
          subject: metadataNode,
          predicate: resourceMap.ns.CITO("isDocumentedBy"),
          object: metadataNode,
        })
        .length.should.equal(0);

      const rawXml = resourceMap.serialize({ validate: false });
      parseResourceMap("resource_map_urn:uuid:meta.only.1", rawXml)
        .getDocumentationLinks()
        .should.deep.equal([]);

      const validatedXml = resourceMap.serialize({ validate: true });
      const reparsed = parseResourceMap(
        "resource_map_urn:uuid:meta.only.1",
        validatedXml,
      );

      resourceMap.getDocumentationLinks().should.deep.equal([]);
      reparsed.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.only.1",
          dataPid: "meta.only.1",
        },
      ]);
    });

    it("adds either missing singleton self-documentation direction to validated output", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:meta.partial-self.1",
        members: [{ pid: "meta.partial-self.1" }],
        documentationLinks: [],
      });
      const memberNode = rdf.sym(
        resourceMap.getNodeUriForPid("meta.partial-self.1"),
      );
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: memberNode,
          predicate: resourceMap.ns.CITO("documents"),
          object: memberNode,
        });
      });

      const validatedXml = resourceMap.serialize({ validate: true });

      resourceMap.graph
        .hasStatement({
          subject: memberNode,
          predicate: resourceMap.ns.CITO("isDocumentedBy"),
          object: memberNode,
        })
        .should.equal(false);
      parseResourceMap(resourceMap.resourceMapPid, validatedXml)
        .getDocumentationLinks()
        .should.deep.equal([
          {
            metadataPid: "meta.partial-self.1",
            dataPid: "meta.partial-self.1",
          },
        ]);
    });

    it("serializes singleton compatibility links alongside opaque CiTO RDF", () => {
      const memberPid = "solo.member.external-cito.1";
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:solo.external-cito.1",
        members: [{ pid: memberPid }],
      });
      const externalMetadata = rdf.sym(resourceMap.pidToUri("external.meta.1"));
      const externalData = rdf.sym(resourceMap.pidToUri("external.data.1"));

      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: externalMetadata,
          predicate: resourceMap.ns.CITO("documents"),
          object: externalData,
        });
        resourceMap.graph.addStatement({
          subject: externalData,
          predicate: resourceMap.ns.CITO("isDocumentedBy"),
          object: externalMetadata,
        });
      });

      const reparsed = parseResourceMap(
        resourceMap.resourceMapPid,
        resourceMap.serialize(),
      );

      const packageLinks = [
        {
          metadataPid: memberPid,
          dataPid: memberPid,
        },
      ];
      reparsed.getDocumentationLinks().should.deep.equal(packageLinks);
      reparsed.setPackageStructure(
        [memberPid, "solo.member.external-cito.2"],
        packageLinks,
      );
      reparsed.graph
        .findStatements({
          subject: externalMetadata,
          predicate: reparsed.ns.CITO("documents"),
          object: externalData,
        })
        .should.have.lengthOf(1);
    });

    it("requires both documentation endpoints to be exact package members", () => {
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:opaque.external-cito.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
      });
      const externalMetadata = rdf.sym(resourceMap.pidToUri("external.meta.1"));
      const externalData = rdf.sym(resourceMap.pidToUri("external.data.1"));
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: externalMetadata,
          predicate: resourceMap.ns.CITO("documents"),
          object: externalData,
        });
        resourceMap.graph.addStatement({
          subject: externalData,
          predicate: resourceMap.ns.CITO("isDocumentedBy"),
          object: externalMetadata,
        });
      });
      resourceMap.markSaved();

      expect(() =>
        resourceMap.unlinkDocumentation("external.meta.1", "external.data.1"),
      ).to.throw("Metadata PID required");
      expect(() =>
        resourceMap.unlinkDocumentation("meta.1", "external.data.1"),
      ).to.throw("Data PID required");

      resourceMap.graph
        .hasStatement({
          subject: externalMetadata,
          predicate: resourceMap.ns.CITO("documents"),
          object: externalData,
        })
        .should.equal(true);
      resourceMap.hasUnsavedChanges().should.equal(false);
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
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      const executionId =
        resourceMap.provenance.getGeneratedByPrograms()[0].executionId;

      resourceMap.graph.addStatement({
        subject: dataNode,
        predicate: customPredicate,
        object: rdf.literal("remove this custom statement"),
      });
      resourceMap.removeMembers(["data.1"]);

      resourceMap.getMemberPids().should.not.include("data.1");
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "derived.1",
        },
      ]);
      expect(resourceMap.graphState.getMember("data.1")).to.equal(null);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "derived.1",
          programPid: "program.1",
          executionId,
        },
      ]);
      hasNodeReferences(resourceMap, dataNode).should.equal(false);

      const xml = resourceMap.serialize();
      xml.should.not.contain(">data.1<");
      xml.should.not.contain(`${TEST_RESOLVE_BASE}/data.1`);
    });

    it("removes multiple members and their provenance references in one mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.members.batch.1",
        memberPids: [
          "meta.1",
          "data.1",
          "data.2",
          "derived.1",
          "source.keep",
          "program.1",
          "program.2",
        ],
        documentationLinks: [
          { metadataPid: "meta.1", dataPid: "data.1" },
          { metadataPid: "meta.1", dataPid: "data.2" },
          { metadataPid: "meta.1", dataPid: "derived.1" },
          { metadataPid: "meta.1", dataPid: "source.keep" },
        ],
      });
      const data1Node = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const data2Node = rdf.sym(resourceMap.getNodeUriForPid("data.2"));
      resourceMap.setMemberLocations([
        { pid: "data.1", atLocations: ["data/data-1.csv"] },
        { pid: "data.2", atLocations: ["data/data-2.csv"] },
        { pid: "derived.1", atLocations: ["data/derived.csv"] },
      ]);
      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addWasDerivedFrom("derived.1", "source.keep");
      resourceMap.provenance.addUsedByProgram("data.2", "program.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.addUsedByProgram("source.keep", "program.2");
      const program1ExecutionId =
        resourceMap.provenance.getGeneratedByPrograms()[0].executionId;
      const program2ExecutionId = resourceMap.provenance
        .getUsedByPrograms()
        .find(({ programPid }) => programPid === "program.2").executionId;
      const mutateSpy = sandbox.spy(resourceMap, "mutateGraph");

      resourceMap.removeMembers([
        "data.1",
        "data.2",
        "data.1",
        "never.aggregated.1",
      ]);

      mutateSpy.callCount.should.equal(1);
      resourceMap
        .getMemberPids()
        .should.have.members([
          "meta.1",
          "derived.1",
          "source.keep",
          "program.1",
          "program.2",
        ]);
      resourceMap.getDocumentationLinks().should.deep.equal([
        { metadataPid: "meta.1", dataPid: "derived.1" },
        { metadataPid: "meta.1", dataPid: "source.keep" },
      ]);
      resourceMap.provenance
        .getWasDerivedFromLinks()
        .should.deep.equal([
          { derivedPid: "derived.1", sourcePid: "source.keep" },
        ]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "derived.1",
          programPid: "program.1",
          executionId: program1ExecutionId,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "source.keep",
          programPid: "program.2",
          executionId: program2ExecutionId,
        },
      ]);
      [data1Node, data2Node].forEach((node) => {
        hasNodeReferences(resourceMap, node).should.equal(false);
      });
      resourceMap.graphState
        .getMember("derived.1")
        .atLocations.should.deep.equal(["data/derived.csv"]);
    });

    it("preserves unrelated standalone blank-node RDF when removing a member", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.blank.1",
        memberPids: ["meta.1", "data.1"],
      });
      const blankNode = rdf.blankNode("custom-standalone");
      const customPredicate = rdf.sym("https://example.org/custom#note");

      resourceMap.graph.addStatement({
        subject: blankNode,
        predicate: customPredicate,
        object: rdf.literal("preserve me"),
      });

      resourceMap.removeMembers(["data.1"]);

      resourceMap.graph
        .findStatements({ subject: blankNode, predicate: customPredicate })
        .should.have.lengthOf(1);

      const reparsed = parseResourceMap(
        resourceMap.resourceMapPid,
        resourceMap.serialize(),
      );
      reparsed.graph
        .findStatements({ predicate: customPredicate })
        .map(({ object }) => object.value)
        .should.deep.equal(["preserve me"]);
    });

    it("round-trips an unrelated object-only blank node", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.blank.object.1",
      });
      const subject = rdf.sym("https://example.org/custom/subject");
      const predicate = rdf.sym("https://example.org/custom#location");
      const blankNode = rdf.blankNode("custom-location");

      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject,
          predicate,
          object: blankNode,
        });
      });

      const reparsed = parseResourceMap(
        resourceMap.resourceMapPid,
        resourceMap.serialize(),
      );

      resourceMap.graph
        .findStatements({ subject, predicate, object: blankNode })
        .should.have.lengthOf(1);
      const [reparsedStatement] = reparsed.graph.findStatements({
        subject,
        predicate,
      });
      RDFGraph.isBlankNode(reparsedStatement.object).should.equal(true);
    });

    it("removes every package and provenance reference to a weirdly encoded member PID", () => {
      const removedPid = "doi:10.5063/F1+REMOVE";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.remove.member.weird.1",
        resolveServiceUrl: TEST_RESOLVE_BASE,
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

      resourceMap.graph.replaceNodeValue(
        removedCanonicalUri,
        "https://example.org/custom/member/remove",
      );
      resourceMap.provenance.addWasDerivedFrom("derived.1", removedPid);
      resourceMap.provenance.addUsedByProgram(removedPid, "program.1");
      resourceMap.provenance.addUsedByProgram("data.2", "program.1");
      const executionId =
        resourceMap.provenance.getUsedByPrograms()[0].executionId;

      resourceMap.removeMembers([removedPid]);

      resourceMap.getMemberPids().should.not.include(removedPid);
      resourceMap.getDocumentationLinks().should.deep.equal([
        {
          metadataPid: "meta.1",
          dataPid: "derived.1",
        },
      ]);
      expect(resourceMap.graphState.getMember(removedPid)).to.equal(null);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.2",
          programPid: "program.1",
          executionId,
        },
      ]);

      const graphValues = resourceMap.graph
        .getStatements()
        .flatMap((statement) => [
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
      const resourceMap = createResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.invalid.serialize.1",
        members: [{ pid: "meta.1" }, { pid: "data.1" }],
        documentationLinks: [],
      });
      const memberNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      resourceMap.mutateGraph(() => {
        resourceMap.graph.removeStatementsMatching({
          subject: memberNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
        });
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
        resourceMap.graph.replaceNodeValue(canonicalUri, customUri);
      });

      const rawXml = resourceMap.serialize({ validate: false });
      rawXml.should.contain(customUri);
      rawXml.should.not.contain(resourceMap.pidToUri("data.1"));

      resourceMap.normalize();

      const normalizedXml = resourceMap.serialize({ validate: false });
      normalizedXml.should.contain(customUri);
    });

    it("keeps singleton compatibility output-only after member removal", () => {
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

      resourceMap.removeMembers(["meta.1"]);

      resourceMap.getDocumentationLinks().should.deep.equal([]);
      resourceMap.validate().should.deep.equal([]);
      resourceMap.getDocumentationLinks().should.deep.equal([]);
      const serialized = resourceMap.serialize({ validate: true });
      resourceMap.getDocumentationLinks().should.deep.equal([]);
      parseResourceMap(resourceMap.resourceMapPid, serialized)
        .getDocumentationLinks()
        .should.deep.equal([
          {
            metadataPid: "data.1",
            dataPid: "data.1",
          },
        ]);

      resourceMap.normalize();
      resourceMap.getDocumentationLinks().should.deep.equal([]);
    });

    it("prunes a qualifiedAssociation left empty when its hadPlan program is deleted, so the map still serializes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.delete.hadplan.1",
        memberPids: ["meta.1", "program.1"],
        documentationLinks: [{ metadataPid: "meta.1", dataPid: "meta.1" }],
      });

      // An execution whose only link to the package is a qualifiedAssociation ->
      // hadPlan pointing at program.1, the shape the prov editor writes.
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.delete.hadplan.1",
          programPid: "program.1",
        },
      );
      resourceMap.graph
        .findStatements({
          subject: associationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
        })
        .length.should.equal(1);

      resourceMap.removeMembers(["program.1"]);

      // Deleting program.1 removes its hadPlan statement (program is the
      // object), leaving the association blank node empty. Orphan cleanup must
      // then drop both the empty association and the dangling
      // qualifiedAssociation edge that still pointed at it.
      resourceMap.graph
        .findStatements({
          subject: associationNode,
        })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
        .length.should.equal(0);

      // Before the fix the serializer threw
      // "Serializing XML - Cant find statements for _:nN" on the empty
      // association; the package now serializes to valid RDF/XML.
      const xml = resourceMap.serialize({ validate: true });
      xml.should.be.a("string");
      xml.should.not.contain("hadPlan");
    });

    it("cleans only qualified associations affected by member removal", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:rm.delete.owned.association.1",
        memberPids: ["meta.1", "program.1"],
        documentationLinks: [{ metadataPid: "meta.1", dataPid: "meta.1" }],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.delete.owned.association.1",
          programPid: "program.1",
        },
      );
      const executionNote = rdf.sym("https://example.test/execution-note");
      const externalExecutionNode = rdf.sym(
        "urn:uuid:exec.unrelated.empty.association.1",
      );
      const externalAssociationNode = rdf.blankNode(
        "unrelated-empty-association",
      );
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: executionNode,
          predicate: executionNote,
          object: rdf.literal("keep execution"),
        });
        resourceMap.graph.addStatement({
          subject: externalExecutionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: externalAssociationNode,
        });
      });

      resourceMap.removeMembers(["program.1"]);

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: executionNote,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: associationNode,
        })
        .should.have.lengthOf(0);
      resourceMap.graph
        .findStatements({
          subject: externalExecutionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: externalAssociationNode,
        })
        .should.have.lengthOf(1);
    });

    it("preserves an unsupported qualifiedAssociation on import", () => {
      // An execution whose qualifiedAssociation points at a blank node that was
      // never defined (rdf:nodeID with no matching Description) — the residue of
      // a hadPlan program removed by another tool before this map was saved.
      const danglingXml = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<rdf:RDF xmlns:cito="http://purl.org/spar/cito/"',
        '         xmlns:dcterms="http://purl.org/dc/terms/"',
        '         xmlns:ore="http://www.openarchives.org/ore/terms/"',
        '         xmlns:prov="http://www.w3.org/ns/prov#"',
        '         xmlns:provone="http://purl.dataone.org/provone/2015/01/15/ontology#"',
        '         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
        '         xmlns:xsd="http://www.w3.org/2001/XMLSchema#">',
        `  <rdf:Description rdf:about="${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.dangling.1">`,
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
        '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">resource_map_urn:uuid:rm.dangling.1</dcterms:identifier>',
        `    <ore:describes rdf:resource="${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.dangling.1#aggregation"/>`,
        "  </rdf:Description>",
        `  <rdf:Description rdf:about="${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.dangling.1#aggregation">`,
        '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
        `    <ore:isDescribedBy rdf:resource="${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.dangling.1"/>`,
        `    <ore:aggregates rdf:resource="${TEST_RESOLVE_BASE}/meta.1"/>`,
        "  </rdf:Description>",
        `  <rdf:Description rdf:about="${TEST_RESOLVE_BASE}/meta.1">`,
        '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">meta.1</dcterms:identifier>',
        `    <cito:documents rdf:resource="${TEST_RESOLVE_BASE}/meta.1"/>`,
        `    <cito:isDocumentedBy rdf:resource="${TEST_RESOLVE_BASE}/meta.1"/>`,
        `    <ore:isAggregatedBy rdf:resource="${TEST_RESOLVE_BASE}/resource_map_urn%3Auuid%3Arm.dangling.1#aggregation"/>`,
        "  </rdf:Description>",
        '  <rdf:Description rdf:about="urn:uuid:exec.dangling.1">',
        '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">urn:uuid:exec.dangling.1</dcterms:identifier>',
        '    <rdf:type rdf:resource="http://purl.dataone.org/provone/2015/01/15/ontology#Execution"/>',
        '    <prov:qualifiedAssociation rdf:nodeID="assoc-empty"/>',
        "  </rdf:Description>",
        "</rdf:RDF>",
      ].join("\n");

      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.dangling.1",
        danglingXml,
      );

      // Unsupported PROV stays opaque; ResourceMap import does not reinterpret
      // or remove the association.
      resourceMap.graph
        .findStatements({
          subject: rdf.sym("urn:uuid:exec.dangling.1"),
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
        .length.should.equal(1);
      resourceMap.serialize({ validate: false }).should.be.a("string");
    });

    it("round-trips unknown RDF attached to managed nodes without losing it", () => {
      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.1",
        COMPREHENSIVE_XML,
      );
      const creatorNode = resourceMap.graph.findStatements({
        subject: rdf.sym(resourceMap.resourceMapUri),
        predicate: resourceMap.ns.DC("creator"),
      })[0].object;
      const executionNode = rdf.sym("urn:uuid:execution-1");
      const associationNode = resourceMap.graph.findStatements({
        subject: executionNode,
        predicate: resourceMap.ns.PROV("qualifiedAssociation"),
      })[0].object;
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

      resourceMap.graph.addStatement({
        subject: rdf.sym(resourceMap.resourceMapUri),
        predicate: rootPredicate,
        object: rdf.literal("keep resource map note"),
      });
      resourceMap.graph.addStatement({
        subject: rdf.sym(resourceMap.aggregationUri),
        predicate: aggregationPredicate,
        object: rdf.literal("keep aggregation note"),
      });
      resourceMap.graph.addStatement({
        subject: rdf.sym(resourceMap.getNodeUriForPid("data.1")),
        predicate: memberPredicate,
        object: rdf.literal("keep member note"),
      });
      resourceMap.graph.addStatement({
        subject: creatorNode,
        predicate: creatorPredicate,
        object: rdf.literal("keep creator note"),
      });
      resourceMap.graph.addStatement({
        subject: executionNode,
        predicate: executionPredicate,
        object: rdf.literal("keep execution note"),
      });
      resourceMap.graph.addStatement({
        subject: associationNode,
        predicate: associationPredicate,
        object: rdf.literal("keep association note"),
      });

      const xml = resourceMap.serialize();
      const reparsed = parseResourceMap("resource_map_urn:uuid:rm.1", xml);
      const reparsedCreatorNode = reparsed.graph.findStatements({
        subject: rdf.sym(reparsed.resourceMapUri),
        predicate: reparsed.ns.DC("creator"),
      })[0].object;
      const reparsedExecutionNode = rdf.sym("urn:uuid:execution-1");
      const reparsedAssociationNode = reparsed.graph.findStatements({
        subject: reparsedExecutionNode,
        predicate: reparsed.ns.PROV("qualifiedAssociation"),
      })[0].object;

      reparsed.graph
        .findStatements({
          subject: rdf.sym(reparsed.resourceMapUri),
          predicate: rootPredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep resource map note"]);
      reparsed.graph
        .findStatements({
          subject: rdf.sym(reparsed.aggregationUri),
          predicate: aggregationPredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep aggregation note"]);
      reparsed.graph
        .findStatements({
          subject: rdf.sym(reparsed.getNodeUriForPid("data.1")),
          predicate: memberPredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep member note"]);
      reparsed.graph
        .findStatements({
          subject: reparsedCreatorNode,
          predicate: creatorPredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep creator note"]);
      reparsed.graph
        .findStatements({
          subject: reparsedExecutionNode,
          predicate: executionPredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep execution note"]);
      reparsed.graph
        .findStatements({
          subject: reparsedAssociationNode,
          predicate: associationPredicate,
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["keep association note"]);
    });

    it("auto-fixes missing aggregation back-links and member identifiers during parsing", () => {
      const resourceMap = parseResourceMap(
        "resource_map_urn:uuid:rm.fix.1",
        MISSING_IDENTIFIER_XML,
      );

      getIssueCodes(resourceMap.validate()).should.not.include(
        "invalidPackageStructure",
      );

      const xml = resourceMap.serialize({ validate: true });
      xml.should.contain("resource_map_doi:10.18739/A22Z9V");

      const reparsed = parseResourceMap("resource_map_urn:uuid:rm.fix.1", xml);
      getIssueCodes(reparsed.validate()).should.not.include(
        "invalidPackageStructure",
      );
      reparsed.graph
        .findStatements({
          subject: rdf.sym(
            `${TEST_RESOLVE_BASE}/resource_map_doi:10.18739%2FA22Z9V`,
          ),
          predicate: reparsed.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .should.include("resource_map_doi:10.18739/A22Z9V");
    });
  });
});
