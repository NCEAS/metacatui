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
    PROV: rdf.Namespace("http://www.w3.org/ns/prov#"),
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
      addMember(graph, aggregation, {
        uri: `${objectServiceUrl}/doi:10.5063%2FF1`,
        pid: null,
      });

      // The configured MN URL supplies the missing PID doi:10.5063/F1.
      // Import also moves the member to the CN resolver URL checked below.
      const resourceMap = construct(resourceMapPid, graph, {
        objectServiceUrl,
      });

      resourceMap.getMemberPids().should.deep.equal([memberPid]);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(`${TEST_RESOLVE_BASE}/doi:10.5063%2FF1`),
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
      // data.1 and our configured /resolve/data.1 URL name the same PID.
      // Import should keep just the identifier value data.1.
      graph.add(
        member,
        NS.DCTERMS("identifier"),
        rdf.literal(`${TEST_RESOLVE_BASE}/data.1`),
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

    it("normalizes a configured nonmember identifier without aggregating it", () => {
      const resourceMapPid = "resource_map_urn:uuid:nonmember-id.1";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      addMember(graph, aggregation, {
        uri: "https://example.org/member",
        pid: "data.1",
      });
      const nonmember = rdf.sym(`${TEST_RESOLVE_BASE}/external.1`);
      graph.add(
        nonmember,
        NS.DCTERMS("identifier"),
        rdf.literal(nonmember.value),
      );

      const resourceMap = construct(resourceMapPid, graph);

      resourceMap.getMemberPids().should.deep.equal(["data.1"]);
      resourceMap.graph
        .findStatements({
          subject: nonmember,
          predicate: NS.DCTERMS("identifier"),
        })
        .map(({ object }) => object.value)
        .should.deep.equal(["external.1"]);
      resourceMap.getEditBlockers().should.deep.equal([]);
    });

    for (const {
      description,
      memberUri,
      nonmemberUri,
      nonmemberIdentifier,
    } of [
      {
        description: "an MN member with an equivalent CN nonmember",
        memberUri: "https://mn.example/mn/v2/object/data.1",
        nonmemberUri: `${TEST_RESOLVE_BASE}/data.1`,
        nonmemberIdentifier: `${TEST_RESOLVE_BASE}/data.1`,
      },
      {
        description: "an MN nonmember with an equivalent CN member",
        memberUri: `${TEST_RESOLVE_BASE}/data.1`,
        nonmemberUri: "https://mn.example/mn/v2/object/data.1",
        nonmemberIdentifier: "https://mn.example/mn/v2/object/data.1",
      },
      {
        description: "an MN member with an unidentified CN destination",
        memberUri: "https://mn.example/mn/v2/object/data.1",
        nonmemberUri: `${TEST_RESOLVE_BASE}/data.1`,
        nonmemberIdentifier: null,
      },
    ]) {
      it(`merges ${description} with one bare identifier`, () => {
        const resourceMapPid = "resource_map_urn:uuid:merge-nonmember.1";
        const graph = rdf.graph();
        const { aggregation } = addOwner(graph, resourceMapPid);
        addMember(graph, aggregation, { uri: memberUri, pid: "data.1" });
        // This second node has no package membership link. Both URLs point at
        // data.1, so its title must survive when the nodes are combined.
        const nonmember = rdf.sym(nonmemberUri);
        if (nonmemberIdentifier) {
          graph.add(
            nonmember,
            NS.DCTERMS("identifier"),
            rdf.literal(nonmemberIdentifier),
          );
        }
        graph.add(
          nonmember,
          NS.DCTERMS("title"),
          rdf.literal("Preserved annotation"),
        );

        const resourceMap = construct(resourceMapPid, graph, {
          objectServiceUrl: "https://mn.example/mn/v2/object",
        });
        const resolveNode = rdf.sym(`${TEST_RESOLVE_BASE}/data.1`);

        resourceMap.getEditBlockers().should.deep.equal([]);
        resourceMap.getMemberPids().should.deep.equal(["data.1"]);
        resourceMap.getNodeUriForPid("data.1").should.equal(resolveNode.value);
        resourceMap.graph
          .findStatements({
            subject: resolveNode,
            predicate: NS.DCTERMS("identifier"),
          })
          .map(({ object }) => object.value)
          .should.deep.equal(["data.1"]);
        resourceMap.graph
          .hasStatement({
            subject: resolveNode,
            predicate: NS.DCTERMS("title"),
            object: rdf.literal("Preserved annotation"),
          })
          .should.equal(true);
        resourceMap.serialize({ validate: true });
      });
    }

    it("repairs documentation links exposed by merging an equivalent nonmember", () => {
      const resourceMapPid = "resource_map_urn:uuid:merge-documentation.1";
      const objectServiceUrl = "https://mn.example/mn/v2/object";
      const graph = rdf.graph();
      const { aggregation } = addOwner(graph, resourceMapPid);
      const metadata = addMember(graph, aggregation, {
        uri: `${TEST_RESOLVE_BASE}/meta.1`,
        pid: "meta.1",
        inverse: false,
      });
      const member = addMember(graph, aggregation, {
        uri: `${objectServiceUrl}/data.1`,
        pid: "data.1",
        forward: false,
      });
      const nonmember = rdf.sym(`${TEST_RESOLVE_BASE}/data.1`);
      graph.add(nonmember, NS.DCTERMS("identifier"), rdf.literal("data.1"));
      graph.add(nonmember, NS.CITO("isDocumentedBy"), metadata);

      const resourceMap = construct(resourceMapPid, graph, {
        objectServiceUrl,
      });

      resourceMap.getEditBlockers().should.deep.equal([]);
      resourceMap.hasUnsavedChanges().should.equal(false);
      const raw = new RDFGraph().parseXml(resourceMap.serialize(), "");
      for (const node of [metadata, nonmember]) {
        raw
          .hasStatement({
            subject: aggregation,
            predicate: NS.ORE("aggregates"),
            object: node,
          })
          .should.equal(true);
        raw
          .hasStatement({
            subject: node,
            predicate: NS.ORE("isAggregatedBy"),
            object: aggregation,
          })
          .should.equal(true);
      }
      raw
        .hasStatement({
          subject: metadata,
          predicate: NS.CITO("documents"),
          object: nonmember,
        })
        .should.equal(true);
      raw
        .hasStatement({
          subject: nonmember,
          predicate: NS.CITO("isDocumentedBy"),
          object: metadata,
        })
        .should.equal(true);
      raw.hasStatement({ subject: member }).should.equal(false);
    });

    for (const identifier of [
      rdf.literal("different.1"),
      rdf.sym(`${TEST_RESOLVE_BASE}/data.1`),
    ]) {
      it(`preserves a destination with a conflicting ${identifier.termType} identifier`, () => {
        const resourceMapPid = "resource_map_urn:uuid:merge-conflict.1";
        const graph = rdf.graph();
        const { aggregation } = addOwner(graph, resourceMapPid);
        const member = addMember(graph, aggregation, {
          uri: "https://mn.example/mn/v2/object/data.1",
          pid: "data.1",
        });
        // The destination either says different.1 or uses a node instead of a
        // text identifier. Keep it separate from the data.1 package member.
        const destination = rdf.sym(`${TEST_RESOLVE_BASE}/data.1`);
        graph.add(destination, NS.DCTERMS("identifier"), identifier);

        const resourceMap = construct(resourceMapPid, graph, {
          objectServiceUrl: "https://mn.example/mn/v2/object",
        });

        resourceMap.getEditBlockers().should.deep.equal([]);
        resourceMap.getNodeUriForPid("data.1").should.equal(member.value);
        resourceMap.graph
          .hasStatement({
            subject: aggregation,
            predicate: NS.ORE("aggregates"),
            object: member,
          })
          .should.equal(true);
        resourceMap.graph
          .findStatements({
            subject: destination,
            predicate: NS.DCTERMS("identifier"),
          })
          .map(({ object }) => ({
            termType: object.termType,
            value: object.value,
          }))
          .should.deep.equal([
            { termType: identifier.termType, value: identifier.value },
          ]);
        resourceMap.serialize({ validate: true });
      });
    }

    for (const inverseOnly of [false, true]) {
      it(`keeps a full URL map PID with ${inverseOnly ? "inverse-only" : "forward"} ownership`, () => {
        // The caller supplied this whole URL as the map PID, not just map.1.
        const resourceMapPid = "https://foreign.example/cn/v2/resolve/map.1";
        const graph = rdf.graph();
        const { root, aggregation } = addOwner(graph, resourceMapPid);
        if (inverseOnly) {
          graph.remove(
            graph.statementsMatching(root, NS.ORE("describes"), aggregation)[0],
          );
        }
        addMember(graph, aggregation, {
          uri: "https://example.org/data",
          pid: "data.1",
        });

        const resourceMap = construct(resourceMapPid, graph);

        resourceMap.getEditBlockers().should.deep.equal([]);
        resourceMap.graph
          .findStatements({
            subject: root,
            predicate: NS.DCTERMS("identifier"),
          })
          .map(({ object }) => object.value)
          .should.deep.equal([resourceMapPid]);
        resourceMap.serialize({ validate: true });
      });
    }

    for (const serviceUrl of [
      TEST_RESOLVE_BASE,
      "https://mn.example/mn/v2/object",
    ]) {
      it(`keeps a full URL member PID encoded in ${serviceUrl}`, () => {
        const resourceMapPid = "resource_map_urn:uuid:url-pid.1";
        // The entire foreign URL is the PID. Its encoded form is the suffix
        // of a separate download or resolve URL; do not shorten it to data.1.
        const memberPid = "https://foreign.example/cn/v2/resolve/data.1";
        const encodedPid =
          "https:%2F%2Fforeign.example%2Fcn%2Fv2%2Fresolve%2Fdata.1";
        const graph = rdf.graph();
        const { aggregation } = addOwner(graph, resourceMapPid);
        addMember(graph, aggregation, {
          uri: `${serviceUrl}/${encodedPid}`,
          pid: memberPid,
        });

        const resourceMap = construct(resourceMapPid, graph, {
          objectServiceUrl: "https://mn.example/mn/v2/object",
        });
        const resolveUri = `${TEST_RESOLVE_BASE}/${encodedPid}`;

        resourceMap.getEditBlockers().should.deep.equal([]);
        resourceMap.getMemberPids().should.deep.equal([memberPid]);
        resourceMap.getNodeUriForPid(memberPid).should.equal(resolveUri);
        resourceMap.graph
          .findStatements({
            subject: rdf.sym(resolveUri),
            predicate: NS.DCTERMS("identifier"),
          })
          .map(({ object }) => object.value)
          .should.deep.equal([memberPid]);
        resourceMap.serialize({ validate: true });
      });
    }

    for (const objectServiceUrl of [
      "https://mn.example/mn/v2/object",
      TEST_RESOLVE_BASE,
    ]) {
      it(`normalizes resolver URL encoding when reads use ${objectServiceUrl}`, () => {
        const resourceMapPid = "resource_map_urn:uuid:resolver-encoding.1";
        const graph = rdf.graph();
        const { aggregation } = addOwner(graph, resourceMapPid);
        const member = addMember(graph, aggregation, {
          uri: `${TEST_RESOLVE_BASE}/urn%3Auuid%3Aabc`,
          pid: "urn:uuid:abc",
        });
        // Changing the RDF URL to /resolve/urn:uuid:abc must still preserve the
        // original encoded URL as the download location.
        graph.add(member, NS.PROV("atLocation"), member);

        const resourceMap = construct(resourceMapPid, graph, {
          objectServiceUrl,
        });
        const resolveUri = `${TEST_RESOLVE_BASE}/urn:uuid:abc`;

        resourceMap.getEditBlockers().should.deep.equal([]);
        resourceMap.getMemberPids().should.deep.equal(["urn:uuid:abc"]);
        resourceMap.getNodeUriForPid("urn:uuid:abc").should.equal(resolveUri);
        resourceMap.graph
          .hasStatement({
            subject: rdf.sym(resolveUri),
            predicate: NS.PROV("atLocation"),
            object: member,
          })
          .should.equal(true);
        resourceMap.hasUnsavedChanges().should.equal(false);
      });
    }

    for (const { description, uri, identifier } of [
      {
        description: "a URL-valued identifier on an arbitrary member URI",
        uri: "https://archive.example/member",
        identifier: "https://foreign.example/cn/v2/resolve/data.1",
      },
      {
        description: "a foreign object URL used as both URI and identifier",
        uri: "https://foreign.example/mn/v2/object/data.1",
        identifier: "https://foreign.example/mn/v2/object/data.1",
      },
      {
        description: "an identifier on the configured host at another endpoint",
        uri: "https://archive.example/member",
        identifier: "https://cn.test.com/resolve/other/data.1",
      },
    ]) {
      it(`preserves ${description}`, () => {
        // None of these identifier URLs uses the configured service endpoint.
        // Preserve the full URL as the PID, even when it ends with data.1.
        const graph = rdf.graph();
        const resourceMapPid = "resource_map_urn:uuid:legacy-url-id.1";
        const { aggregation } = addOwner(graph, resourceMapPid);
        const member = addMember(graph, aggregation, { uri, pid: identifier });

        const resourceMap = construct(resourceMapPid, graph);

        resourceMap.getEditBlockers().should.deep.equal([]);
        resourceMap.getMemberPids().should.deep.equal([identifier]);
        resourceMap.getNodeUriForPid(identifier).should.equal(uri);
        resourceMap.graph
          .findStatements({
            subject: member,
            predicate: NS.DCTERMS("identifier"),
          })
          .map(({ object }) => object.value)
          .should.deep.equal([identifier]);
        const reparsed = ResourceMap.fromXml(
          resourceMapPid,
          resourceMap.serialize({ validate: true }),
          { resolveServiceUrl: TEST_RESOLVE_BASE },
        );
        reparsed.getMemberPids().should.deep.equal([identifier]);
        reparsed.getNodeUriForPid(identifier).should.equal(uri);
      });
    }

    for (const serviceUrl of [
      TEST_RESOLVE_BASE,
      "https://mn.example/mn/v2/object",
    ]) {
      it(`decodes an identifier at ${serviceUrl} without changing an arbitrary member URI`, () => {
        const graph = rdf.graph();
        const resourceMapPid = "resource_map_urn:uuid:configured-url-id.1";
        const { aggregation } = addOwner(graph, resourceMapPid);
        // Only the identifier changes to data.1. The archive's RDF URL does
        // not use a configured endpoint, so it stays as supplied.
        const member = addMember(graph, aggregation, {
          uri: "https://archive.example/member",
          pid: `${serviceUrl}/data.1`,
        });

        const resourceMap = construct(resourceMapPid, graph, {
          objectServiceUrl: "https://mn.example/mn/v2/object",
        });

        resourceMap.getEditBlockers().should.deep.equal([]);
        resourceMap.getMemberPids().should.deep.equal(["data.1"]);
        resourceMap.getNodeUriForPid("data.1").should.equal(member.value);
        resourceMap.graph
          .findStatements({
            subject: member,
            predicate: NS.DCTERMS("identifier"),
          })
          .map(({ object }) => object.value)
          .should.deep.equal(["data.1"]);
      });
    }

    it("keeps distinct foreign identifier URLs separate", () => {
      const graph = rdf.graph();
      const resourceMapPid = "resource_map_urn:uuid:foreign-url-ids.1";
      const { aggregation } = addOwner(graph, resourceMapPid);
      const member = addMember(graph, aggregation, {
        uri: "https://archive.example/member",
        pid: "https://foreign.example/cn/v2/resolve/data.1",
      });
      // These foreign URLs both end in data.1, but neither is a configured
      // service URL. Keep both full identifiers and report the conflict.
      graph.add(
        member,
        NS.DCTERMS("identifier"),
        rdf.literal("https://other.example/mn/v2/object/data.1"),
      );

      const resourceMap = construct(resourceMapPid, graph);

      getIssueCodes(resourceMap.getEditBlockers()).should.include(
        "memberIdentifierMismatch",
      );
      resourceMap.graph
        .findStatements({
          subject: member,
          predicate: NS.DCTERMS("identifier"),
        })
        .map(({ object }) => object.value)
        .should.deep.equal([
          "https://foreign.example/cn/v2/resolve/data.1",
          "https://other.example/mn/v2/object/data.1",
        ]);
    });

    it("does not interpret a foreign identifier as the PID of a configured member URI", () => {
      const graph = rdf.graph();
      const resourceMapPid = "resource_map_urn:uuid:foreign-id-conflict.1";
      const { aggregation } = addOwner(graph, resourceMapPid);
      // Our resolver URL names data.1, while the identifier is an entire
      // foreign URL. Matching final path segments do not make the PIDs equal.
      const member = addMember(graph, aggregation, {
        uri: `${TEST_RESOLVE_BASE}/data.1`,
        pid: "https://foreign.example/cn/v2/resolve/data.1",
      });

      const resourceMap = construct(resourceMapPid, graph);

      getIssueCodes(resourceMap.getEditBlockers()).should.include(
        "memberIdentifierMismatch",
      );
      resourceMap.graph
        .findStatements({
          subject: member,
          predicate: NS.DCTERMS("identifier"),
        })
        .map(({ object }) => object.value)
        .should.deep.equal(["https://foreign.example/cn/v2/resolve/data.1"]);
    });

    it("recovers inverse ownership with a configured URL-valued map identifier", () => {
      const graph = rdf.graph();
      const resourceMapPid = "resource_map_urn:uuid:inverse-url-id.1";
      const { root, aggregation } = addOwner(graph, resourceMapPid);
      // Leave only the aggregation-to-map link. Import must restore the reverse
      // link and remove our resolver prefix from the map's identifier value.
      graph.remove(
        graph.statementsMatching(root, NS.ORE("describes"), aggregation)[0],
      );
      graph.remove(graph.statementsMatching(root, NS.DCTERMS("identifier"))[0]);
      graph.add(
        root,
        NS.DCTERMS("identifier"),
        rdf.literal(`${TEST_RESOLVE_BASE}/${resourceMapPid}`),
      );
      addMember(graph, aggregation, {
        uri: "https://archive.example/member",
        pid: "data.1",
      });

      const resourceMap = construct(resourceMapPid, graph);

      resourceMap.getEditBlockers().should.deep.equal([]);
      resourceMap.graph
        .hasStatement({
          subject: root,
          predicate: NS.ORE("describes"),
          object: aggregation,
        })
        .should.equal(true);
      resourceMap.graph
        .findStatements({ subject: root, predicate: NS.DCTERMS("identifier") })
        .map(({ object }) => object.value)
        .should.deep.equal([resourceMapPid]);
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
