define([
  "rdflib",
  "models/resourceMap/RDFGraph",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, RDFGraph, testUtils) => {
  chai.should();
  const { TEST_RESOLVE_BASE, addExecutionScaffold, createBaseResourceMap } =
    testUtils;

  /** Add an exact program lineage RDF fixture. */
  function addWasInformedByRelationship(
    resourceMap,
    { programPid, previousProgramPid, executionId, previousExecutionId },
  ) {
    const ensureExecution = (id, pid) => {
      const executionNode = rdf.sym(id);
      if (
        !resourceMap.graph.hasStatement({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
      ) {
        addExecutionScaffold(resourceMap, {
          executionId: id,
          programPid: pid,
        });
      }
      return executionNode;
    };
    const executionNode = ensureExecution(executionId, programPid);
    const previousExecutionNode = ensureExecution(
      previousExecutionId,
      previousProgramPid,
    );

    resourceMap.mutateGraph(() => {
      resourceMap.graph.addStatementIfMissing({
        subject: executionNode,
        predicate: resourceMap.ns.PROV("wasInformedBy"),
        object: previousExecutionNode,
      });
    });
  }

  /** Add an explicit ProvONE type statement as imported RDF test setup. */
  function addTypeStatement(resourceMap, pid, className) {
    const subject = rdf.sym(resourceMap.getNodeUriForPid(pid));
    resourceMap.mutateGraph(() => {
      resourceMap.graph.addStatementIfMissing({
        subject,
        predicate: resourceMap.ns.RDF("type"),
        object: resourceMap.ns.PROVONE(className),
      });
    });
  }

  /** Assert that an RDF node no longer appears as a subject or object. */
  function assertNodeRemoved(resourceMap, node) {
    resourceMap.graph.findStatements({ subject: node }).should.deep.equal([]);
    resourceMap.graph.findStatements({ object: node }).should.deep.equal([]);
  }

  /** Move one managed member to an exact imported RDF URI. */
  function moveMemberToUri(resourceMap, pid, uri) {
    const currentUri = resourceMap.graphState.getMember(pid).uri;
    resourceMap.mutateGraph(
      () => resourceMap.graph.replaceNodeValue(currentUri, uri),
      { markDirty: false },
    );
    return rdf.sym(uri);
  }

  /** Add a separate named node representation of one logical PID. */
  function addPidAlias(resourceMap, pid, uri) {
    const node = rdf.sym(uri);
    resourceMap.mutateGraph(
      () => {
        resourceMap.graph.addStatementIfMissing({
          subject: node,
          predicate: resourceMap.ns.DCTERMS("identifier"),
          object: rdf.literal(pid, undefined, resourceMap.ns.XSD("string")),
        });
      },
      { markDirty: false },
    );
    return node;
  }

  /** Add a second exact ORE membership endpoint for one PID. */
  function addDuplicateMemberUri(resourceMap, pid, uri) {
    const memberNode = addPidAlias(resourceMap, pid, uri);
    const aggregationNode = rdf.sym(resourceMap.aggregationUri);
    resourceMap.mutateGraph(
      () => {
        resourceMap.graph.addStatementIfMissing({
          subject: aggregationNode,
          predicate: resourceMap.ns.ORE("aggregates"),
          object: memberNode,
        });
        resourceMap.graph.addStatementIfMissing({
          subject: memberNode,
          predicate: resourceMap.ns.ORE("isAggregatedBy"),
          object: aggregationNode,
        });
      },
      { markDirty: false },
    );
    return memberNode;
  }

  describe("Provenance", () => {
    it("keeps provenance projections stable until a mutation completes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.live.roles.1",
        memberPids: ["meta.1", "data.1", "source.1", "program.1", "program.2"],
      });

      resourceMap.provenance.addWasDerivedFrom("data.1", "source.1");
      addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.live.current.1",
        programPid: "program.1",
      });
      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");
      resourceMap.provenance.addUsedByProgram("source.1", "program.1");
      addWasInformedByRelationship(resourceMap, {
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.live.current.1",
        previousExecutionId: "urn:uuid:exec.live.previous.1",
      });
      resourceMap.provenance.toJSON();
      resourceMap.provenance
        .getTypeAssertions()
        .should.deep.include({ pid: "data.1", className: "Data" });

      resourceMap.mutateGraph(() => {
        ["wasDerivedFrom", "wasGeneratedBy", "used", "wasInformedBy"].forEach(
          (predicate) => {
            resourceMap.graph
              .findStatements({ predicate: resourceMap.ns.PROV(predicate) })
              .forEach((statement) =>
                resourceMap.graph.removeStatement(statement),
              );
          },
        );
        resourceMap.provenance.getWasDerivedFromLinks().should.have.length(1);
        resourceMap.provenance.getGeneratedByPrograms().should.have.length(1);
        resourceMap.provenance.getUsedByPrograms().should.have.length(1);
        resourceMap.provenance.getWasInformedByPrograms().should.have.length(1);
        resourceMap.provenance
          .getTypeAssertions()
          .should.deep.include({ pid: "data.1", className: "Data" });
        const dataRolePids = resourceMap.graphState.getRolePidSet("Data");
        dataRolePids.has("data.1").should.equal(true);
        dataRolePids.has("source.1").should.equal(true);
      });

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([]);
    });

    it("adds, removes, and serializes provenance relationships", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
      });

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.1",
        programPid: "program.1",
      });
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      addWasInformedByRelationship(resourceMap, {
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.1",
        previousExecutionId: "urn:uuid:exec.2",
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const programNode = rdf.sym(resourceMap.getNodeUriForPid("program.1"));
      resourceMap.graph
        .findStatements({
          subject: dataNode,
          predicate: resourceMap.ns.RDF("type"),
          object: resourceMap.ns.PROVONE("Data"),
        })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({
          subject: programNode,
          predicate: resourceMap.ns.RDF("type"),
          object: resourceMap.ns.PROVONE("Program"),
        })
        .length.should.equal(0);

      resourceMap.provenance.toJSON().should.deep.equal({
        wasDerivedFrom: [
          {
            derivedPid: "derived.1",
            sourcePid: "data.1",
          },
        ],
        generatedByPrograms: [
          {
            dataPid: "derived.1",
            programPid: "program.1",
            executionId: "urn:uuid:exec.1",
          },
        ],
        usedByPrograms: [
          {
            dataPid: "data.1",
            programPid: "program.1",
            executionId: "urn:uuid:exec.1",
          },
        ],
        wasInformedByPrograms: [
          {
            programPid: "program.1",
            previousProgramPid: "program.2",
            executionId: "urn:uuid:exec.1",
            previousExecutionId: "urn:uuid:exec.2",
          },
        ],
        typeAssertions: [
          {
            pid: "data.1",
            className: "Data",
          },
          {
            pid: "derived.1",
            className: "Data",
          },
          {
            pid: "program.1",
            className: "Program",
          },
          {
            pid: "program.2",
            className: "Program",
          },
        ],
      });

      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");
      resourceMap.provenance.removeGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.removeWasDerivedFrom("derived.1", "data.1");

      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      // Program lineage is read-only in the public API, so the restored link
      // survives the other removals.
      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([
        {
          programPid: "program.1",
          previousProgramPid: "program.2",
          executionId: "urn:uuid:exec.1",
          previousExecutionId: "urn:uuid:exec.2",
        },
      ]);
    });

    it("updates execution scaffolding when execution-backed provenance is added and changed", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.change.1",
        memberPids: ["meta.1", "input.1", "output.1", "program.1", "program.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "input.1",
          },
        ],
      });
      resourceMap.provenance.addGeneratedByProgram("output.1", "program.1");
      const [firstExecutionNode] =
        resourceMap.graphState.getExecutionNodesForProgram("program.1");

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "output.1",
          programPid: "program.1",
          executionId: firstExecutionNode.value,
        },
      ]);
      resourceMap.graph
        .findStatements({
          subject: firstExecutionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
        .length.should.equal(1);
      const firstAssociationNode = resourceMap.graph.findStatements({
        subject: firstExecutionNode,
        predicate: resourceMap.ns.PROV("qualifiedAssociation"),
      })[0].object;
      resourceMap.graph
        .findStatements({
          subject: firstAssociationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: rdf.sym(resourceMap.getNodeUriForPid("program.1")),
        })
        .length.should.equal(1);

      resourceMap.provenance.removeGeneratedByProgram("output.1", "program.1");
      resourceMap.provenance.addGeneratedByProgram("output.1", "program.2");
      const [secondExecutionNode] =
        resourceMap.graphState.getExecutionNodesForProgram("program.2");

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "output.1",
          programPid: "program.2",
          executionId: secondExecutionNode.value,
        },
      ]);
      resourceMap.graph
        .findStatements({ subject: firstExecutionNode })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({
          subject: secondExecutionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
        .length.should.equal(1);
      const secondAssociationNode = resourceMap.graph.findStatements({
        subject: secondExecutionNode,
        predicate: resourceMap.ns.PROV("qualifiedAssociation"),
      })[0].object;
      resourceMap.graph
        .findStatements({
          subject: secondAssociationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: rdf.sym(resourceMap.getNodeUriForPid("program.2")),
        })
        .length.should.equal(1);
    });

    it("supports external data PIDs without turning them into aggregated members", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.external.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });

      resourceMap.provenance.addWasDerivedFrom(
        "derived.1",
        "external.source.1",
      );
      resourceMap.provenance.addWasDerivedFrom("external.derived.1", "data.1");
      addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.external.1",
        programPid: "program.1",
      });
      resourceMap.provenance.addGeneratedByProgram(
        "external.derived.1",
        "program.1",
      );
      resourceMap.provenance.addUsedByProgram("external.source.1", "program.1");

      resourceMap
        .getMemberPids()
        .should.have.members(["meta.1", "data.1", "derived.1", "program.1"]);
      resourceMap.getMemberPids().should.not.include("external.source.1");
      resourceMap.getMemberPids().should.not.include("external.derived.1");
      chai
        .expect(resourceMap.graphState.getMember("external.source.1"))
        .to.equal(null);
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([
        {
          derivedPid: "derived.1",
          sourcePid: "external.source.1",
        },
        {
          derivedPid: "external.derived.1",
          sourcePid: "data.1",
        },
      ]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "external.derived.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.external.1",
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "external.source.1",
          programPid: "program.1",
          executionId: "urn:uuid:exec.external.1",
        },
      ]);

      const externalSourceNode = rdf.sym(
        resourceMap.getNodeUriForPid("external.source.1"),
      );
      const externalDerivedNode = rdf.sym(
        resourceMap.getNodeUriForPid("external.derived.1"),
      );
      resourceMap.graph
        .findStatements({
          subject: externalSourceNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.source.1"]);
      resourceMap.graph
        .findStatements({
          subject: externalDerivedNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.derived.1"]);
      resourceMap.graph
        .findStatements({
          subject: externalSourceNode,
          predicate: resourceMap.ns.RDF("type"),
          object: resourceMap.ns.PROVONE("Data"),
        })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({
          subject: externalDerivedNode,
          predicate: resourceMap.ns.RDF("type"),
          object: resourceMap.ns.PROVONE("Data"),
        })
        .length.should.equal(0);
      resourceMap.provenance
        .getTypeAssertions()
        .should.deep.include({ pid: "external.source.1", className: "Data" });
      resourceMap.provenance
        .getTypeAssertions()
        .should.deep.include({ pid: "external.derived.1", className: "Data" });
    });

    it("round-trips the provenance projection through resource map XML", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.roundtrip.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
        documentationLinks: [
          {
            metadataPid: "meta.1",
            dataPid: "data.1",
          },
        ],
      });

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.roundtrip.1",
        programPid: "program.1",
      });
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      addWasInformedByRelationship(resourceMap, {
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.roundtrip.1",
        previousExecutionId: "urn:uuid:exec.roundtrip.2",
      });

      const expectedSnapshot = resourceMap.provenance.toJSON();
      const xml = resourceMap.serialize();
      const reparsed = resourceMap.constructor.fromXml(
        "resource_map_urn:uuid:prov.roundtrip.1",
        xml,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );

      reparsed.provenance.toJSON().should.deep.equal(expectedSnapshot);
    });

    it("round-trips external data provenance without aggregating external nodes", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.external.roundtrip.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });

      resourceMap.provenance.addWasDerivedFrom(
        "derived.1",
        "external.source.1",
      );
      addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.external.roundtrip.1",
        programPid: "program.1",
      });
      resourceMap.provenance.addGeneratedByProgram(
        "external.derived.1",
        "program.1",
      );
      resourceMap.provenance.addUsedByProgram("external.source.1", "program.1");

      const expectedSnapshot = resourceMap.provenance.toJSON();
      const xml = resourceMap.serialize();
      const reparsed = resourceMap.constructor.fromXml(
        "resource_map_urn:uuid:prov.external.roundtrip.1",
        xml,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );

      reparsed.provenance.toJSON().should.deep.equal(expectedSnapshot);
      reparsed
        .getMemberPids()
        .should.have.members(["meta.1", "data.1", "derived.1", "program.1"]);
      reparsed.getMemberPids().should.not.include("external.source.1");
      reparsed.getMemberPids().should.not.include("external.derived.1");
      reparsed.graph
        .findStatements({
          subject: rdf.sym(reparsed.getNodeUriForPid("external.source.1")),
          predicate: reparsed.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.source.1"]);
      reparsed.graph
        .findStatements({
          subject: rdf.sym(reparsed.getNodeUriForPid("external.derived.1")),
          predicate: reparsed.ns.DCTERMS("identifier"),
        })
        .map((statement) => statement.object.value)
        .should.deep.equal(["external.derived.1"]);
    });

    it("uses exact member URIs and removes every same-PID derivation backing edge", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.cross-cn.1",
        memberPids: ["meta.1", "source.1", "derived.1"],
        documentationLinks: [{ metadataPid: "meta.1", dataPid: "derived.1" }],
      });
      const sourceNode = moveMemberToUri(
        resourceMap,
        "source.1",
        "https://cn.dataone.org/cn/v2/resolve/source.1",
      );
      const derivedNode = moveMemberToUri(
        resourceMap,
        "derived.1",
        "https://cn.dataone.org/cn/v2/resolve/derived.1",
      );
      const sourceAlias = addPidAlias(
        resourceMap,
        "source.1",
        "https://cn-stage.test.dataone.org/cn/v2/resolve/source.1",
      );
      const derivedAlias = addPidAlias(
        resourceMap,
        "derived.1",
        "https://cn-stage.test.dataone.org/cn/v2/resolve/derived.1",
      );
      const customPredicate = rdf.sym("https://example.test/vocab/related");
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: derivedAlias,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: sourceAlias,
          });
          resourceMap.graph.addStatement({
            subject: derivedAlias,
            predicate: customPredicate,
            object: sourceAlias,
          });
        },
        { markDirty: false },
      );

      resourceMap.provenance.addWasDerivedFrom("derived.1", "source.1");

      resourceMap.graph
        .findStatements({
          subject: derivedNode,
          predicate: resourceMap.ns.PROV("wasDerivedFrom"),
          object: sourceNode,
        })
        .should.have.lengthOf(1);
      resourceMap.provenance
        .getWasDerivedFromLinks()
        .should.deep.equal([
          { derivedPid: "derived.1", sourcePid: "source.1" },
        ]);
      resourceMap.provenance.validate().should.deep.equal([]);

      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        resourceMap.serialize(),
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      [
        [derivedNode, sourceNode],
        [derivedAlias, sourceAlias],
      ].forEach(([subject, object]) => {
        reparsed.graph
          .findStatements({
            subject,
            predicate: reparsed.ns.PROV("wasDerivedFrom"),
            object,
          })
          .should.have.lengthOf(1);
      });

      resourceMap.provenance.removeWasDerivedFrom("derived.1", "source.1");

      resourceMap.graph
        .findStatements({ predicate: resourceMap.ns.PROV("wasDerivedFrom") })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: derivedAlias,
          predicate: customPredicate,
          object: sourceAlias,
        })
        .should.have.lengthOf(1);
    });

    it("mints a resolve URI only when no graph node represents the PID", () => {
      const pid = "urn:uuid:external.data.new.1";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.external.new.1",
        memberPids: ["meta.1", "data.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const resolveNode = rdf.sym(resourceMap.pidToUri(pid));

      resourceMap.provenance.addWasDerivedFrom("data.1", pid);

      resourceMap.graph
        .findStatements({
          subject: dataNode,
          predicate: resourceMap.ns.PROV("wasDerivedFrom"),
          object: resolveNode,
        })
        .should.have.lengthOf(1);
      assertNodeRemoved(resourceMap, rdf.sym(pid));
    });

    [
      {
        label: "URN",
        pid: "urn:uuid:external.data.direct.1",
      },
      {
        label: "HTTP",
        pid: "https://example.org/data/external.direct.1",
      },
    ].forEach(({ label, pid }) => {
      it(`preserves direct ${label} external data PID variants during import repair`, () => {
        const resourceMap = createBaseResourceMap({
          resourceMapPid: `resource_map_urn:uuid:prov.external.direct.${label}`,
          memberPids: ["meta.1", "data.1"],
        });
        const directNode = rdf.sym(pid);
        const resolveNode = rdf.sym(resourceMap.pidToUri(pid));
        const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

        resourceMap.mutateGraph(
          () => {
            resourceMap.graph.addStatementIfMissing({
              subject: dataNode,
              predicate: resourceMap.ns.PROV("wasDerivedFrom"),
              object: directNode,
            });
            resourceMap.graph.addStatementIfMissing({
              subject: directNode,
              predicate: resourceMap.ns.DCTERMS("identifier"),
              object: rdf.literal(pid, undefined, resourceMap.ns.XSD("string")),
            });
            resourceMap.graph.addStatementIfMissing({
              subject: resolveNode,
              predicate: resourceMap.ns.DCTERMS("identifier"),
              object: rdf.literal(pid, undefined, resourceMap.ns.XSD("string")),
            });
            resourceMap.graph.addStatementIfMissing({
              subject: resolveNode,
              predicate: resourceMap.ns.RDF("type"),
              object: resourceMap.ns.PROVONE("Data"),
            });
          },
          { markDirty: false },
        );

        resourceMap.getNodeUriForPid(pid).should.equal(pid);
        resourceMap.normalize();

        resourceMap.getNodeUriForPid(pid).should.equal(pid);
        resourceMap.graph
          .findStatements({ subject: resolveNode })
          .length.should.be.greaterThan(0);

        const xml = resourceMap.serialize();
        const reparsed = resourceMap.constructor.fromXml(
          resourceMap.resourceMapPid,
          xml,
          { resolveServiceUrl: TEST_RESOLVE_BASE },
        );

        reparsed.getNodeUriForPid(pid).should.equal(pid);
        reparsed.graph
          .findStatements({ subject: directNode })
          .length.should.be.greaterThan(0);
        reparsed.graph
          .findStatements({ subject: resolveNode })
          .length.should.be.greaterThan(0);
        reparsed.provenance.getWasDerivedFromLinks().should.deep.equal([
          {
            derivedPid: "data.1",
            sourcePid: pid,
          },
        ]);
        reparsed.getMemberPids().should.not.include(pid);
      });

      it(`reuses one unambiguous ${label} external data node during edit`, () => {
        const resourceMap = createBaseResourceMap({
          resourceMapPid: `resource_map_urn:uuid:prov.external.edit.${label}`,
          memberPids: ["meta.1", "data.1", "derived.1"],
        });
        const resolveNode = rdf.sym(resourceMap.pidToUri(pid));
        const derivedNode = rdf.sym(resourceMap.getNodeUriForPid("derived.1"));

        resourceMap.mutateGraph(
          () => {
            resourceMap.graph.addStatementIfMissing({
              subject: resolveNode,
              predicate: resourceMap.ns.DCTERMS("identifier"),
              object: rdf.literal(pid, undefined, resourceMap.ns.XSD("string")),
            });
            resourceMap.graph.addStatementIfMissing({
              subject: resolveNode,
              predicate: resourceMap.ns.RDF("type"),
              object: resourceMap.ns.PROVONE("Data"),
            });
            resourceMap.graph.addStatementIfMissing({
              subject: derivedNode,
              predicate: resourceMap.ns.PROV("wasDerivedFrom"),
              object: resolveNode,
            });
          },
          { markDirty: false },
        );

        resourceMap.provenance.addWasDerivedFrom("data.1", pid);

        resourceMap.graph
          .findStatements({ subject: resolveNode })
          .length.should.be.greaterThan(0);
        resourceMap.graph
          .findStatements({
            subject: rdf.sym(resourceMap.getNodeUriForPid("data.1")),
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: resolveNode,
          })
          .length.should.equal(1);
        resourceMap.provenance
          .getWasDerivedFromLinks()
          .should.have.deep.members([
            {
              derivedPid: "data.1",
              sourcePid: pid,
            },
            {
              derivedPid: "derived.1",
              sourcePid: pid,
            },
          ]);
      });
    });

    it("preserves ambiguous external data nodes while reusing one during edit", () => {
      const pid = "urn:uuid:external.data.ambiguous.1";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.external.ambiguous.1",
        memberPids: ["meta.1", "data.1"],
      });
      const firstNode = rdf.sym(resourceMap.pidToUri(pid));
      const secondNode = rdf.sym("https://example.org/also-this-pid");

      resourceMap.mutateGraph(
        () => {
          [firstNode, secondNode].forEach((node) => {
            resourceMap.graph.addStatementIfMissing({
              subject: node,
              predicate: resourceMap.ns.DCTERMS("identifier"),
              object: rdf.literal(pid, undefined, resourceMap.ns.XSD("string")),
            });
          });
        },
        { markDirty: false },
      );

      resourceMap.provenance.addWasDerivedFrom("data.1", pid);

      resourceMap.graph
        .findStatements({ subject: firstNode })
        .length.should.be.greaterThan(0);
      resourceMap.graph
        .findStatements({ subject: secondNode })
        .length.should.be.greaterThan(0);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(resourceMap.getNodeUriForPid("data.1")),
          predicate: resourceMap.ns.PROV("wasDerivedFrom"),
          object: rdf.sym(resourceMap.getNodeUriForPid(pid)),
        })
        .length.should.equal(1);
    });

    it("refuses member removal and replacement when managed membership is ambiguous", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.member.ambiguous.1",
        memberPids: ["meta.1", "data.1"],
      });
      const duplicateUri = "https://another-cn.example/cn/v2/resolve/data.1";
      addDuplicateMemberUri(resourceMap, "data.1", duplicateUri);
      const before = resourceMap.graph
        .getStatements()
        .map((statement) => statement.toNT())
        .sort();

      [
        () => resourceMap.removeMembers(["data.1"]),
        () => resourceMap.replaceMember("data.1", "data.2"),
      ].forEach((action) => {
        let caught;
        try {
          action();
        } catch (error) {
          caught = error;
        }
        chai.expect(caught?.name).to.equal("ResourceMapConflictError");
        chai.expect(caught?.code).to.equal("ambiguousMemberPid");
        chai.expect(caught?.details).to.deep.equal({
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

    it("preserves malformed literal provenance endpoints while excluding them from normalized views", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.literal.roundtrip.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1"],
      });
      const derivedNode = rdf.sym(resourceMap.getNodeUriForPid("derived.1"));
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.literal.roundtrip.1",
        programPid: "program.1",
      });

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatementIfMissing({
            subject: derivedNode,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: rdf.literal(
              "data.1",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
          resourceMap.graph.addStatementIfMissing({
            subject: executionNode,
            predicate: resourceMap.ns.PROV("used"),
            object: rdf.literal(
              "data.1",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
        },
        { markDirty: false },
      );
      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);

      const xml = resourceMap.serialize();
      const reparsed = resourceMap.constructor.fromXml(
        "resource_map_urn:uuid:prov.literal.roundtrip.1",
        xml,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );

      reparsed.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      reparsed.provenance.getUsedByPrograms().should.deep.equal([]);
      RDFGraph.isLiteral(
        reparsed.graph.findStatements({
          subject: derivedNode,
          predicate: reparsed.ns.PROV("wasDerivedFrom"),
        })[0].object,
      ).should.equal(true);
      reparsed.graph
        .findStatements({
          subject: derivedNode,
          predicate: reparsed.ns.PROV("wasDerivedFrom"),
        })[0]
        .object.value.should.equal("data.1");
      RDFGraph.isLiteral(
        reparsed.graph.findStatements({
          subject: executionNode,
          predicate: reparsed.ns.PROV("used"),
        })[0].object,
      ).should.equal(true);
      reparsed.graph
        .findStatements({
          subject: executionNode,
          predicate: reparsed.ns.PROV("used"),
        })[0]
        .object.value.should.equal("data.1");
    });

    it("keeps literal execution endpoints opaque during normalization and edits", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.literal.execution.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const literalExecution = rdf.literal("not-an-execution");

      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.PROV("wasGeneratedBy"),
            object: literalExecution,
          });
        },
        { markDirty: false },
      );

      resourceMap.provenance.normalize();
      resourceMap.graphState.getExecutionNodes().should.deep.equal([]);
      resourceMap.graph
        .findStatements({ subject: literalExecution })
        .should.deep.equal([]);

      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");

      const [generated] = resourceMap.provenance.getGeneratedByPrograms();
      generated.should.include({
        dataPid: "data.1",
        programPid: "program.1",
      });
      generated.executionId.should.be.a("string");
      resourceMap.graph
        .findStatements({
          subject: dataNode,
          predicate: resourceMap.ns.PROV("wasGeneratedBy"),
          object: literalExecution,
        })
        .should.have.lengthOf(1);

      const xml = resourceMap.serialize({ validate: false });
      xml.should.not.contain("@@@undefined@@@@");
      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        xml,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      reparsed.graph
        .findStatements({
          subject: dataNode,
          predicate: reparsed.ns.PROV("wasGeneratedBy"),
        })
        .some(
          ({ object }) =>
            RDFGraph.isLiteral(object) && object.value === "not-an-execution",
        )
        .should.equal(true);
      reparsed.provenance.getGeneratedByPrograms().should.have.lengthOf(1);
    });

    it("preserves explicit type assertions on unconnected members through XML", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.types.member.1",
        memberPids: ["meta.1", "program.1"],
        documentationLinks: [],
      });

      addTypeStatement(resourceMap, "program.1", "Program");

      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        resourceMap.serialize({ validate: false }),
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      const programNode = rdf.sym(reparsed.getNodeUriForPid("program.1"));
      reparsed.graph
        .findStatements({
          subject: programNode,
          predicate: reparsed.ns.RDF("type"),
          object: reparsed.ns.PROVONE("Program"),
        })
        .length.should.equal(1);
      reparsed.provenance
        .getTypeAssertions()
        .should.deep.include({ pid: "program.1", className: "Program" });
    });

    it("removes derived Program and Data types when the last supporting relationship is deleted", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.generated.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");

      resourceMap.provenance.getTypeAssertions().should.deep.equal([]);
    });

    it("materializes derived role types during serialization and preserves them after parsing", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.derived.types.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      resourceMap.provenance.addUsedByProgram("data.1", "program.1");

      const xml = resourceMap.serialize({ validate: false });
      xml.should.contain(
        "http://purl.dataone.org/provone/2015/01/15/ontology#Data",
      );
      xml.should.contain(
        "http://purl.dataone.org/provone/2015/01/15/ontology#Program",
      );

      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        xml,
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      const dataNode = rdf.sym(reparsed.getNodeUriForPid("data.1"));
      const programNode = rdf.sym(reparsed.getNodeUriForPid("program.1"));

      reparsed.graph
        .findStatements({
          subject: dataNode,
          predicate: reparsed.ns.RDF("type"),
          object: reparsed.ns.PROVONE("Data"),
        })
        .length.should.equal(1);
      reparsed.graph
        .findStatements({
          subject: programNode,
          predicate: reparsed.ns.RDF("type"),
          object: reparsed.ns.PROVONE("Program"),
        })
        .length.should.equal(1);
      reparsed.provenance
        .getTypeAssertions()
        .should.deep.include({ pid: "data.1", className: "Data" });
      reparsed.provenance
        .getTypeAssertions()
        .should.deep.include({ pid: "program.1", className: "Program" });
    });

    it("serializes one type triple when an explicit assertion overlaps a derived role", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.types.overlap.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      // The explicit assertion persists a type triple; the later usage link
      // derives the same Data/Program roles. Serialization must not emit the
      // triple twice.
      addTypeStatement(resourceMap, "data.1", "Data");
      addTypeStatement(resourceMap, "program.1", "Program");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");

      const xml = resourceMap.serialize({ validate: false });
      (xml.match(/ontology#Data/g) || []).length.should.equal(1);
      (xml.match(/ontology#Program/g) || []).length.should.equal(1);
    });

    it("preserves explicit Program and Data types when related relationships are deleted", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.explicit.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
        documentationLinks: [],
      });

      addTypeStatement(resourceMap, "data.1", "Data");
      addTypeStatement(resourceMap, "program.1", "Program");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");

      resourceMap.provenance.getTypeAssertions().should.deep.equal([
        {
          pid: "data.1",
          className: "Data",
        },
        {
          pid: "program.1",
          className: "Program",
        },
      ]);
    });

    it("removes provenance links when the deleted member was the only program on them", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.program.cleanup.1",
        memberPids: ["meta.1", "data.1", "derived.1", "program.1", "program.2"],
      });
      const programNode = rdf.sym(resourceMap.getNodeUriForPid("program.1"));
      const executionNode = rdf.sym("urn:uuid:exec.program.cleanup.1");
      const previousExecutionNode = rdf.sym("urn:uuid:exec.program.cleanup.2");

      addExecutionScaffold(resourceMap, {
        executionId: executionNode.value,
        programPid: "program.1",
      });
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      addWasInformedByRelationship(resourceMap, {
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: executionNode.value,
        previousExecutionId: previousExecutionNode.value,
      });

      resourceMap.removeMembers(["program.1"]);

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([]);
      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([]);
      assertNodeRemoved(resourceMap, programNode);
      resourceMap.graph
        .findStatements({ subject: executionNode })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({ subject: previousExecutionNode })
        .length.should.be.greaterThan(0);
    });

    it("preserves plan-only execution scaffolding for a remaining program", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.plan.shared.1",
        memberPids: ["meta.1", "program.1", "program.2"],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.plan.shared.1",
          programPid: "program.1",
        },
      );
      addExecutionScaffold(resourceMap, {
        executionNode,
        associationNode,
        programPid: "program.2",
      });
      const remainingProgramNode = rdf.sym(
        resourceMap.getNodeUriForPid("program.2"),
      );

      resourceMap.removeMembers(["program.1"]);

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: associationNode,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: associationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: remainingProgramNode,
        })
        .should.have.lengthOf(1);
    });

    it("preserves a surviving plan when its data and another program are removed together", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.plan.mixed-removal.1",
        memberPids: ["meta.1", "data.1", "program.1", "program.2"],
        documentationLinks: [],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.plan.mixed-removal.1",
          programPid: "program.1",
        },
      );
      addExecutionScaffold(resourceMap, {
        executionNode,
        associationNode,
        programPid: "program.2",
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const remainingProgramNode = rdf.sym(
        resourceMap.getNodeUriForPid("program.2"),
      );
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: resourceMap.ns.PROV("used"),
            object: dataNode,
          });
        },
        { markDirty: false },
      );

      resourceMap.removeMembers(["data.1", "program.1"]);

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: associationNode,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: associationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: remainingProgramNode,
        })
        .should.have.lengthOf(1);
    });

    it("preserves a plan-only execution when another association still has a plan", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.plan.separate.shared.1",
        memberPids: ["meta.1", "program.1", "program.2"],
        documentationLinks: [],
      });
      const { executionNode, associationNode: removedAssociationNode } =
        addExecutionScaffold(resourceMap, {
          executionId: "urn:uuid:exec.plan.separate.shared.1",
          programPid: "program.1",
        });
      const { associationNode: remainingAssociationNode } =
        addExecutionScaffold(resourceMap, {
          executionNode,
          programPid: "program.2",
        });
      const remainingProgramNode = rdf.sym(
        resourceMap.getNodeUriForPid("program.2"),
      );

      resourceMap.removeMembers(["program.1"]);

      assertNodeRemoved(resourceMap, removedAssociationNode);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: remainingAssociationNode,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: remainingAssociationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: remainingProgramNode,
        })
        .should.have.lengthOf(1);
    });

    it("removes a bare execution when every plan in its sole association is deleted", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.plan.shared.cleanup.1",
        memberPids: ["meta.1", "program.1", "program.2"],
        documentationLinks: [],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.plan.shared.cleanup.1",
          programPid: "program.1",
        },
      );
      addExecutionScaffold(resourceMap, {
        executionNode,
        associationNode,
        programPid: "program.2",
      });

      resourceMap.removeMembers(["program.1", "program.2"]);

      assertNodeRemoved(resourceMap, executionNode);
      assertNodeRemoved(resourceMap, associationNode);
    });

    it("removes a bare execution when batch deletion empties separate associations", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.plan.separate.cleanup.1",
        memberPids: ["meta.1", "program.1", "program.2"],
        documentationLinks: [],
      });
      const { executionNode, associationNode: firstAssociationNode } =
        addExecutionScaffold(resourceMap, {
          executionId: "urn:uuid:exec.plan.separate.cleanup.1",
          programPid: "program.1",
        });
      const { associationNode: secondAssociationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionNode,
          programPid: "program.2",
        },
      );

      resourceMap.removeMembers(["program.1", "program.2"]);

      assertNodeRemoved(resourceMap, executionNode);
      assertNodeRemoved(resourceMap, firstAssociationNode);
      assertNodeRemoved(resourceMap, secondAssociationNode);
    });

    it("preserves an imported associationless execution when deleting its data member", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid:
          "resource_map_urn:uuid:prov.execution.associationless.1",
        memberPids: ["meta.1", "data.1"],
        documentationLinks: [],
      });
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.execution.associationless.1",
      });
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: resourceMap.ns.PROV("used"),
            object: dataNode,
          });
        },
        { markDirty: false },
      );

      resourceMap.removeMembers(["data.1"]);

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("used"),
        })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.RDF("type"),
          object: resourceMap.ns.PROVONE("Execution"),
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.DCTERMS("identifier"),
        })
        .should.have.lengthOf(1);
    });

    it("removes a type-only blank association for a deleted program", () => {
      const executionId = "urn:uuid:exec.plan.typed-association.1";
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.plan.typed-association.1",
        memberPids: ["meta.1", "data.1", "program.1", "program.2"],
      });
      const { executionNode, associationNode: removedAssociation } =
        addExecutionScaffold(resourceMap, {
          executionId,
          programPid: "program.1",
        });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");

      const remainingAssociation = rdf.blankNode();
      addExecutionScaffold(resourceMap, {
        executionNode,
        associationNode: remainingAssociation,
        programPid: "program.2",
      });
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: removedAssociation,
            predicate: resourceMap.ns.RDF("type"),
            object: resourceMap.ns.PROV("Association"),
          });
        },
        { markDirty: false },
      );

      resourceMap.removeMembers(["program.1"]);

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: removedAssociation,
        })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({ subject: removedAssociation })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: remainingAssociation,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: rdf.sym(resourceMap.getNodeUriForPid("program.2")),
        })
        .should.have.lengthOf(1);
      resourceMap.graphState
        .getExecutionSummary(executionNode)
        .associations.should.have.lengthOf(1);

      // This edit proves the stale association no longer keeps the surviving
      // program read-only.
      resourceMap.provenance.addGeneratedByProgram("data.1", "program.2");
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "program.2",
          executionId,
        },
      ]);
    });

    it("preserves an imported execution shared with an unresolved plan", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.plan.external.1",
        memberPids: ["meta.1", "data.1", "program.1", "program.2"],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.plan.external.1",
          programPid: "program.1",
        },
      );
      const { executionNode: previousExecutionNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.plan.external.previous.1",
          programPid: "program.2",
        },
      );
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));
      const externalPlanNode = rdf.sym(
        "https://example.org/provenance/external-plan",
      );
      resourceMap.mutateGraph(
        () => {
          [
            [associationNode, resourceMap.ns.PROV("hadPlan"), externalPlanNode],
            [executionNode, resourceMap.ns.PROV("used"), dataNode],
            [
              executionNode,
              resourceMap.ns.PROV("wasInformedBy"),
              previousExecutionNode,
            ],
          ].forEach(([subject, predicate, object]) => {
            resourceMap.graph.addStatement({ subject, predicate, object });
          });
        },
        { markDirty: false },
      );

      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        resourceMap.serialize({ validate: false }),
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      const reparsedAssociationNode = reparsed.graph.findStatements({
        subject: executionNode,
        predicate: reparsed.ns.PROV("qualifiedAssociation"),
      })[0].object;
      chai.expect(reparsed.graphState.pidFromNode(externalPlanNode)).to.be.null;

      reparsed.removeMembers(["program.1"]);

      reparsed.graph
        .findStatements({
          subject: executionNode,
          predicate: reparsed.ns.PROV("used"),
          object: dataNode,
        })
        .should.have.lengthOf(1);
      reparsed.graph
        .findStatements({
          subject: executionNode,
          predicate: reparsed.ns.PROV("qualifiedAssociation"),
          object: reparsedAssociationNode,
        })
        .should.have.lengthOf(1);
      reparsed.graph
        .findStatements({
          subject: reparsedAssociationNode,
          predicate: reparsed.ns.PROV("hadPlan"),
          object: externalPlanNode,
        })
        .should.have.lengthOf(1);
      reparsed.graph
        .findStatements({
          subject: executionNode,
          predicate: reparsed.ns.PROV("wasInformedBy"),
          object: previousExecutionNode,
        })
        .should.have.lengthOf(1);
    });

    it("removes only the lineage links that involve a deleted program", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.lineage.partial.1",
        memberPids: ["meta.1", "program.1", "program.2", "program.3"],
      });

      addWasInformedByRelationship(resourceMap, {
        programPid: "program.1",
        previousProgramPid: "program.2",
        executionId: "urn:uuid:exec.lineage.partial.1",
        previousExecutionId: "urn:uuid:exec.lineage.partial.2",
      });
      addWasInformedByRelationship(resourceMap, {
        programPid: "program.1",
        previousProgramPid: "program.3",
        executionId: "urn:uuid:exec.lineage.partial.1",
        previousExecutionId: "urn:uuid:exec.lineage.partial.3",
      });

      resourceMap.removeMembers(["program.2"]);

      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([
        {
          programPid: "program.1",
          previousProgramPid: "program.3",
          executionId: "urn:uuid:exec.lineage.partial.1",
          previousExecutionId: "urn:uuid:exec.lineage.partial.3",
        },
      ]);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym("urn:uuid:exec.lineage.partial.2"),
        })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: rdf.sym(resourceMap.getNodeUriForPid("program.2")),
        })
        .length.should.equal(0);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym("urn:uuid:exec.lineage.partial.1"),
        })
        .length.should.be.greaterThan(0);
    });

    it("removes the exact lineage edge when execution identifiers repeat", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.lineage.duplicate-id.1",
        memberPids: ["meta.1", "program.1", "program.2", "program.3"],
      });
      const executionId = "urn:uuid:exec.lineage.shared-id.1";
      const firstExecutionNode = rdf.sym("urn:uuid:exec.lineage.node.1");
      const secondExecutionNode = rdf.sym("urn:uuid:exec.lineage.node.2");
      const previousExecutionNode = rdf.sym("urn:uuid:exec.lineage.node.3");

      addExecutionScaffold(resourceMap, {
        executionId,
        executionNode: firstExecutionNode,
        programPid: "program.1",
      });
      addExecutionScaffold(resourceMap, {
        executionId,
        executionNode: secondExecutionNode,
        programPid: "program.2",
      });
      addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.lineage.previous.1",
        executionNode: previousExecutionNode,
        programPid: "program.3",
      });
      resourceMap.mutateGraph(() => {
        [firstExecutionNode, secondExecutionNode].forEach((executionNode) => {
          resourceMap.graph.addStatementIfMissing({
            subject: executionNode,
            predicate: resourceMap.ns.PROV("wasInformedBy"),
            object: previousExecutionNode,
          });
        });
      });

      resourceMap.removeMembers(["program.2"]);

      resourceMap.graph
        .findStatements({
          subject: firstExecutionNode,
          predicate: resourceMap.ns.PROV("wasInformedBy"),
          object: previousExecutionNode,
        })
        .length.should.equal(1);
      resourceMap.graph
        .findStatements({
          subject: secondExecutionNode,
          predicate: resourceMap.ns.PROV("wasInformedBy"),
          object: previousExecutionNode,
        })
        .length.should.equal(0);
      resourceMap.provenance.getWasInformedByPrograms().should.deep.equal([
        {
          programPid: "program.1",
          previousProgramPid: "program.3",
          executionId,
          previousExecutionId: "urn:uuid:exec.lineage.previous.1",
        },
      ]);
    });

    it("preserves an unresolved external execution during lineage cleanup", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.lineage.external.1",
        memberPids: ["meta.1", "program.1"],
      });
      const executionNode = rdf.sym("urn:uuid:exec.lineage.managed.1");
      const externalExecutionNode = rdf.sym("urn:uuid:exec.lineage.external.1");
      const externalAssociationNode = rdf.blankNode("external-association");
      const externalProgramNode = rdf.sym(
        "https://example.org/provenance/external-program",
      );

      addExecutionScaffold(resourceMap, {
        executionId: executionNode.value,
        executionNode,
        programPid: "program.1",
      });
      resourceMap.mutateGraph(() => {
        [
          [
            externalExecutionNode,
            resourceMap.ns.RDF("type"),
            resourceMap.ns.PROVONE("Execution"),
          ],
          [
            externalExecutionNode,
            resourceMap.ns.DCTERMS("identifier"),
            rdf.literal(externalExecutionNode.value),
          ],
          [
            externalExecutionNode,
            resourceMap.ns.PROV("qualifiedAssociation"),
            externalAssociationNode,
          ],
          [
            externalAssociationNode,
            resourceMap.ns.PROV("hadPlan"),
            externalProgramNode,
          ],
          [
            executionNode,
            resourceMap.ns.PROV("wasInformedBy"),
            externalExecutionNode,
          ],
        ].forEach(([subject, predicate, object]) => {
          resourceMap.graph.addStatement({ subject, predicate, object });
        });
      });

      resourceMap.removeMembers(["program.1"]);

      resourceMap.graph
        .findStatements({
          subject: externalExecutionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: externalAssociationNode,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: externalAssociationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: externalProgramNode,
        })
        .should.have.lengthOf(1);
    });

    it("preserves custom execution and association RDF when deleting a program", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.program.custom.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executionNode = rdf.sym("urn:uuid:exec.program.custom.1");
      const executionPredicate = rdf.sym(
        "https://example.test/vocab/execution-note",
      );
      const associationPredicate = rdf.sym(
        "https://example.test/vocab/association-note",
      );

      addExecutionScaffold(resourceMap, {
        executionId: executionNode.value,
        programPid: "program.1",
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      const associationNode = resourceMap.graph.findStatements({
        subject: executionNode,
        predicate: resourceMap.ns.PROV("qualifiedAssociation"),
      })[0].object;
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatementIfMissing({
          subject: executionNode,
          predicate: executionPredicate,
          object: rdf.literal("keep execution"),
        });
        resourceMap.graph.addStatementIfMissing({
          subject: associationNode,
          predicate: associationPredicate,
          object: rdf.literal("keep association"),
        });
      });

      resourceMap.removeMembers(["program.1"]);

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: executionPredicate,
        })
        .length.should.equal(1);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: associationNode,
        })
        .length.should.equal(1);
      resourceMap.graph
        .findStatements({
          subject: associationNode,
          predicate: associationPredicate,
        })
        .length.should.equal(1);

      const reparsed = resourceMap.constructor.fromXml(
        resourceMap.resourceMapPid,
        resourceMap.serialize({ validate: false }),
        { resolveServiceUrl: TEST_RESOLVE_BASE },
      );
      const reparsedAssociation = reparsed.graph.findStatements({
        subject: executionNode,
        predicate: reparsed.ns.PROV("qualifiedAssociation"),
      })[0].object;
      reparsed.graph
        .findStatements({
          subject: executionNode,
          predicate: executionPredicate,
        })
        .length.should.equal(1);
      reparsed.graph
        .findStatements({
          subject: reparsedAssociation,
          predicate: associationPredicate,
        })
        .length.should.equal(1);
    });

    it("removes deleted data references while preserving unrelated provenance", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.data.cleanup.1",
        memberPids: ["meta.1", "data.1", "data.2", "derived.1", "program.1"],
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
      const removedDataNode = rdf.sym(resourceMap.getNodeUriForPid("data.1"));

      resourceMap.provenance.addWasDerivedFrom("derived.1", "data.1");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      resourceMap.provenance.addGeneratedByProgram("derived.1", "program.1");
      resourceMap.provenance.addUsedByProgram("data.2", "program.1");
      const executionId =
        resourceMap.provenance.getUsedByPrograms()[0].executionId;

      resourceMap.removeMembers(["data.1"]);

      resourceMap.provenance.getWasDerivedFromLinks().should.deep.equal([]);
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "derived.1",
          programPid: "program.1",
          executionId,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.2",
          programPid: "program.1",
          executionId,
        },
      ]);
      assertNodeRemoved(resourceMap, removedDataNode);
    });

    it("removes a member's exact footprint but preserves custom RDF on a same-PID alias", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.member.alias.cleanup.1",
        memberPids: ["meta.1", "data.1", "other.1", "program.1"],
      });
      const memberNode = moveMemberToUri(
        resourceMap,
        "data.1",
        "https://cn.dataone.org/cn/v2/resolve/data.1",
      );
      const aliasNode = addPidAlias(
        resourceMap,
        "data.1",
        "https://cn-stage.test.dataone.org/cn/v2/resolve/data.1",
      );
      const otherNode = rdf.sym(resourceMap.getNodeUriForPid("other.1"));
      const customPredicate = rdf.sym("https://example.test/vocab/note");
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      const [executionNode] =
        resourceMap.graphState.getExecutionNodesForProgram("program.1");
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: resourceMap.ns.PROV("used"),
            object: aliasNode,
          });
          resourceMap.graph.addStatement({
            subject: aliasNode,
            predicate: resourceMap.ns.PROV("wasDerivedFrom"),
            object: otherNode,
          });
          resourceMap.graph.addStatement({
            subject: aliasNode,
            predicate: customPredicate,
            object: rdf.literal("keep alias details"),
          });
          resourceMap.graph.addStatement({
            subject: memberNode,
            predicate: customPredicate,
            object: rdf.literal("remove member details"),
          });
          resourceMap.graph.addStatement({
            subject: otherNode,
            predicate: customPredicate,
            object: rdf.literal("keep other details"),
          });
        },
        { markDirty: false },
      );

      resourceMap.removeMembers(["data.1"]);

      assertNodeRemoved(resourceMap, memberNode);
      resourceMap.graph
        .findStatements({ predicate: resourceMap.ns.PROV("wasDerivedFrom") })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("used"),
        })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: aliasNode,
          predicate: customPredicate,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: otherNode,
          predicate: customPredicate,
        })
        .should.have.lengthOf(1);
    });

    it("removes managed plan links from a deleted program alias but preserves enriched RDF", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:prov.program.alias.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const programNode = moveMemberToUri(
        resourceMap,
        "program.1",
        "https://cn.dataone.org/cn/v2/resolve/program.1",
      );
      const programAlias = addPidAlias(
        resourceMap,
        "program.1",
        resourceMap.pidToUri("program.1"),
      );
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.program.alias.cleanup.1",
          programPid: "program.1",
        },
      );
      const agent = rdf.sym("https://orcid.org/0000-0000-0000-0013");
      const customPredicate = rdf.sym("https://example.test/vocab/note");
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: associationNode,
            predicate: resourceMap.ns.PROV("agent"),
            object: agent,
          });
          resourceMap.graph.addStatement({
            subject: programAlias,
            predicate: customPredicate,
            object: rdf.literal("keep alias details"),
          });
        },
        { markDirty: false },
      );
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");

      resourceMap.removeMembers(["program.1"]);

      assertNodeRemoved(resourceMap, programNode);
      resourceMap.graph
        .findStatements({
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: programAlias,
        })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: programAlias,
          predicate: customPredicate,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: associationNode,
          predicate: resourceMap.ns.PROV("agent"),
          object: agent,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
          object: associationNode,
        })
        .should.have.lengthOf(1);
    });
  });
});
