define([
  "rdflib",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMap",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, RDFGraph, ResourceMap, testUtils) => {
  chai.should();

  const { TEST_RESOLVE_BASE, getIssueCodes } = testUtils;
  const NS = {
    RDF: rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    DC: rdf.Namespace("http://purl.org/dc/elements/1.1/"),
    DCTERMS: rdf.Namespace("http://purl.org/dc/terms/"),
    FOAF: rdf.Namespace("http://xmlns.com/foaf/0.1/"),
    ORE: rdf.Namespace("http://www.openarchives.org/ore/terms/"),
    CITO: rdf.Namespace("http://purl.org/spar/cito/"),
    XSD: rdf.Namespace("http://www.w3.org/2001/XMLSchema#"),
  };

  function addOwner(graph, resourceMapPid) {
    const root = rdf.sym("https://example.org/resource-map");
    const aggregation = rdf.sym("https://example.org/resource-map#aggregation");
    graph.add(root, NS.RDF("type"), NS.ORE("ResourceMap"));
    graph.add(root, NS.DCTERMS("identifier"), rdf.literal(resourceMapPid));
    graph.add(root, NS.ORE("describes"), aggregation);
    graph.add(aggregation, NS.RDF("type"), NS.ORE("Aggregation"));
    graph.add(aggregation, NS.ORE("isDescribedBy"), root);
    return { root, aggregation };
  }

  function addMember(
    graph,
    aggregation,
    { uri, pid, forward = true, inverse = true },
  ) {
    const member = rdf.sym(uri);
    if (forward) {
      graph.add(aggregation, NS.ORE("aggregates"), member);
    }
    if (inverse) {
      graph.add(member, NS.ORE("isAggregatedBy"), aggregation);
    }
    if (pid) {
      graph.add(member, NS.DCTERMS("identifier"), rdf.literal(pid));
    }
    return member;
  }

  function construct(resourceMapPid, graph, options = {}) {
    return new ResourceMap({
      resourceMapPid,
      graph,
      resolveServiceUrl: TEST_RESOLVE_BASE,
      ...options,
    });
  }

  describe("ResourceMapNormalization", () => {
    it("repairs exact forward-only and inverse-only membership non-dirty", () => {
      const resourceMapPid = "resource_map_urn:uuid:membership-repair.1";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const forwardMember = addMember(graph, aggregation, {
        uri: "https://example.org/forward-member",
        pid: "forward.1",
        inverse: false,
      });
      const inverseMember = addMember(graph, aggregation, {
        uri: "https://example.org/inverse-member",
        pid: "inverse.1",
        forward: false,
      });

      const resourceMap = construct(resourceMapPid, graph);

      resourceMap.graph
        .hasStatement({
          subject: forwardMember,
          predicate: NS.ORE("isAggregatedBy"),
          object: aggregation,
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: aggregation,
          predicate: NS.ORE("aggregates"),
          object: inverseMember,
        })
        .should.equal(true);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("repairs a missing identifier from an exact configured object endpoint", () => {
      const resourceMapPid = "resource_map_urn:uuid:object-id-repair.1";
      const objectServiceUrl = "https://mn.example/mn/v2/object";
      const memberPid = "doi:10.5063/F1";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const member = addMember(graph, aggregation, {
        uri: `${objectServiceUrl}/doi:10.5063%2FF1`,
        pid: null,
      });

      const resourceMap = construct(resourceMapPid, graph, {
        objectServiceUrl,
      });

      resourceMap.getMemberPids().should.deep.equal([memberPid]);
      resourceMap.graph
        .findStatements({
          subject: member,
          predicate: NS.DCTERMS("identifier"),
        })
        .map(({ object }) => object.value)
        .should.deep.equal([memberPid]);
      resourceMap.hasUnsavedChanges().should.equal(false);
    });

    it("does not infer a missing identifier from an arbitrary absolute URI", () => {
      const resourceMapPid = "resource_map_urn:uuid:foreign-id.1";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const member = addMember(graph, aggregation, {
        uri: "https://archive.example/files/data.1",
        pid: null,
      });

      const resourceMap = construct(resourceMapPid, graph);

      getIssueCodes(resourceMap.getEditBlockers()).should.include(
        "missingMemberIdentifier",
      );
      resourceMap.graph
        .findStatements({
          subject: member,
          predicate: NS.DCTERMS("identifier"),
        })
        .should.deep.equal([]);
    });

    it("preserves configured endpoint and literal PID contradictions", () => {
      const resourceMapPid = "resource_map_urn:uuid:object-id-conflict.1";
      const objectServiceUrl = "https://mn.example/mn/v2/object";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const member = addMember(graph, aggregation, {
        uri: `${objectServiceUrl}/data.1`,
        pid: "different.1",
      });

      const resourceMap = construct(resourceMapPid, graph, {
        objectServiceUrl,
      });

      getIssueCodes(resourceMap.getEditBlockers()).should.include(
        "memberIdentifierMismatch",
      );
      resourceMap.graph
        .findStatements({
          subject: member,
          predicate: NS.DCTERMS("identifier"),
        })
        .map(({ object }) => object.value)
        .should.deep.equal(["different.1"]);
    });

    it("canonicalizes equivalent identifier literals only after raw checks", () => {
      const resourceMapPid = "resource_map_urn:uuid:equivalent-ids.1";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const member = addMember(graph, aggregation, {
        uri: "https://example.org/custom-data",
        pid: "data.1",
      });
      graph.add(
        member,
        NS.DCTERMS("identifier"),
        rdf.literal("https://foreign.example/cn/v2/resolve/data.1"),
      );

      const resourceMap = construct(resourceMapPid, graph);

      resourceMap.getEditBlockers().should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: member,
          predicate: NS.DCTERMS("identifier"),
        })
        .map(({ object }) => ({
          termType: object.termType,
          value: object.value,
        }))
        .should.deep.equal([
          { termType: RDFGraph.NODE_TYPES.LITERAL, value: "data.1" },
        ]);
    });

    it("repairs only the exact issue #946 malformed inverse artifact", () => {
      const resourceMapPid = "resource_map_urn:uuid:issue-946.1";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const repairedMember = addMember(graph, aggregation, {
        uri: "https://example.org/repaired-member",
        pid: "repaired.1",
        inverse: false,
      });
      const preservedMember = addMember(graph, aggregation, {
        uri: "https://example.org/preserved-member",
        pid: "preserved.1",
        inverse: false,
      });
      const exactArtifact = rdf.sym(
        `file:///tmp/R/"${aggregation.value}"^^<${NS.XSD("anyURI").value}>`,
      );
      const nearArtifact = rdf.sym(
        `file:///tmp/R/"${aggregation.value}/other"^^<${NS.XSD("anyURI").value}>`,
      );
      const whitespaceArtifact = rdf.sym(
        `file:///tmp/R/" ${aggregation.value} "^^<${NS.XSD("anyURI").value}>`,
      );
      const literalArtifact = rdf.literal(
        aggregation.value,
        undefined,
        NS.XSD("anyURI"),
      );
      graph.add(repairedMember, NS.ORE("isAggregatedBy"), exactArtifact);
      graph.add(preservedMember, NS.ORE("isAggregatedBy"), nearArtifact);
      graph.add(preservedMember, NS.ORE("isAggregatedBy"), whitespaceArtifact);
      graph.add(preservedMember, NS.ORE("isAggregatedBy"), literalArtifact);

      const resourceMap = construct(resourceMapPid, graph);

      resourceMap.graph
        .hasStatement({
          subject: repairedMember,
          predicate: NS.ORE("isAggregatedBy"),
          object: exactArtifact,
        })
        .should.equal(false);
      resourceMap.graph
        .hasStatement({
          subject: repairedMember,
          predicate: NS.ORE("isAggregatedBy"),
          object: aggregation,
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: preservedMember,
          predicate: NS.ORE("isAggregatedBy"),
          object: nearArtifact,
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: preservedMember,
          predicate: NS.ORE("isAggregatedBy"),
          object: whitespaceArtifact,
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: preservedMember,
          predicate: NS.ORE("isAggregatedBy"),
          object: literalArtifact,
        })
        .should.equal(true);
    });

    it("repairs reciprocal CiTO only between exact selected members", () => {
      const resourceMapPid = "resource_map_urn:uuid:cito-repair.1";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const metadata = addMember(graph, aggregation, {
        uri: "https://example.org/meta",
        pid: "meta.1",
      });
      const data = addMember(graph, aggregation, {
        uri: "https://example.org/data",
        pid: "data.1",
      });
      const external = rdf.sym("https://example.org/external");
      graph.add(metadata, NS.CITO("documents"), data);
      graph.add(external, NS.CITO("documents"), data);

      const resourceMap = construct(resourceMapPid, graph);

      resourceMap.graph
        .hasStatement({
          subject: data,
          predicate: NS.CITO("isDocumentedBy"),
          object: metadata,
        })
        .should.equal(true);
      resourceMap.graph
        .hasStatement({
          subject: data,
          predicate: NS.CITO("isDocumentedBy"),
          object: external,
        })
        .should.equal(false);
      resourceMap.graph
        .hasStatement({
          subject: external,
          predicate: NS.CITO("documents"),
          object: data,
        })
        .should.equal(true);
    });

    it("reads valid creator resources but does not decode malformed names", () => {
      const resourceMapPid = "resource_map_urn:uuid:creator-reading.1";
      const graph = rdf.graph();
      const { root, aggregation } = addOwner(graph, resourceMapPid);
      addMember(graph, aggregation, {
        uri: "https://example.org/data",
        pid: "data.1",
      });
      const validCreator = rdf.blankNode("valid-creator");
      const malformedCreator = rdf.blankNode("malformed-creator");
      const malformedName = rdf.sym(
        'file:///tmp/R/"Recovered Name"^^<http://www.w3.org/2001/XMLSchema#string>',
      );
      graph.add(root, NS.DC("creator"), malformedCreator);
      graph.add(malformedCreator, NS.FOAF("name"), malformedName);
      graph.add(root, NS.DC("creator"), validCreator);
      graph.add(validCreator, NS.FOAF("name"), rdf.literal("Literal Name"));

      const resourceMap = construct(resourceMapPid, graph);

      resourceMap.getSummary().creatorName.should.equal("Literal Name");
      resourceMap.graph
        .hasStatement({
          subject: malformedCreator,
          predicate: NS.FOAF("name"),
          object: malformedName,
        })
        .should.equal(true);
    });
  });
});
