define([
  "rdflib",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, testUtils) => {
  chai.should();
  const expect = chai.expect;
  const { addExecutionScaffold, createBaseResourceMap } = testUtils;

  function addExecutionEdge(resourceMap, executionNode, dataPid, predicate) {
    const dataNode = rdf.sym(resourceMap.getNodeUriForPid(dataPid));
    resourceMap.mutateGraph(
      () => {
        resourceMap.graph.addStatement({
          subject: predicate === "used" ? executionNode : dataNode,
          predicate: resourceMap.ns.PROV(predicate),
          object: predicate === "used" ? dataNode : executionNode,
        });
      },
      { markDirty: false },
    );
  }

  function expectReadOnly(action, programPid = "program.1") {
    let caught;
    try {
      action();
    } catch (error) {
      caught = error;
    }

    expect(caught).to.be.an("error");
    expect(caught.name).to.equal("ResourceMapConflictError");
    expect(caught.code).to.equal("programProvenanceReadOnly");
    expect(caught.details).to.deep.equal({ programPid });
    expect(caught.message).to.contain(
      "Only programs with no run or one unambiguous run can be edited here.",
    );
  }

  describe("ProvenanceExecutionMutation", () => {
    it("creates and reuses one execution for a program", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.reuse.1",
        memberPids: ["meta.1", "data.1", "data.2", "program.1"],
      });

      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");
      resourceMap.provenance.addUsedByProgram("data.2", "program.1");

      const executionNodes =
        resourceMap.graphState.getExecutionNodesForProgram("program.1");
      executionNodes.should.have.lengthOf(1);
      const executionId = resourceMap.graphState.getExecutionSummary(
        executionNodes[0],
      ).identifier;
      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
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
    });

    it("uses exact aggregated data and program URIs when creating provenance", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.member-uri.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const dataNode = rdf.sym("https://cn.dataone.org/cn/v2/resolve/data.1");
      const programNode = rdf.sym(
        "https://cn.dataone.org/cn/v2/resolve/program.1",
      );
      const currentDataUri = resourceMap.graphState.getMember("data.1").uri;
      const currentProgramUri =
        resourceMap.graphState.getMember("program.1").uri;
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.replaceNodeValue(currentDataUri, dataNode.value);
          resourceMap.graph.replaceNodeValue(
            currentProgramUri,
            programNode.value,
          );
          resourceMap.graph.addStatement({
            subject: rdf.sym(currentProgramUri),
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              "program.1",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
        },
        { markDirty: false },
      );

      resourceMap.graphState.getIndex();
      resourceMap.mutateGraph(() => {
        resourceMap.provenance.addUsedByProgram("data.1", "program.1");
        resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");
      });

      const executionNodes =
        resourceMap.graphState.getExecutionNodesForProgram("program.1");
      executionNodes.should.have.lengthOf(1);
      const [executionNode] = executionNodes;
      const [associationNode] = resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
        .map(({ object }) => object);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("used"),
          object: dataNode,
        })
        .should.have.lengthOf(1);
      resourceMap.graph
        .findStatements({
          subject: associationNode,
          predicate: resourceMap.ns.PROV("hadPlan"),
          object: programNode,
        })
        .should.have.lengthOf(1);
    });

    it("projects and removes all mixed-CN data edges on a sole execution", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.cross-cn.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const dataNode = rdf.sym("https://cn.dataone.org/cn/v2/resolve/data.1");
      const programNode = rdf.sym(
        "https://cn.dataone.org/cn/v2/resolve/program.1",
      );
      const dataAlias = rdf.sym(resourceMap.pidToUri("data.1"));
      const currentDataUri = resourceMap.graphState.getMember("data.1").uri;
      const currentProgramUri =
        resourceMap.graphState.getMember("program.1").uri;
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.replaceNodeValue(currentDataUri, dataNode.value);
          resourceMap.graph.replaceNodeValue(
            currentProgramUri,
            programNode.value,
          );
          resourceMap.graph.addStatement({
            subject: dataAlias,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              "data.1",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
        },
        { markDirty: false },
      );
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.cross-cn.1",
          programPid: "program.1",
        },
      );
      const agent = rdf.sym("https://orcid.org/0000-0000-0000-0013");
      const customPredicate = rdf.sym("https://example.test/vocab/input-note");
      resourceMap.mutateGraph(
        () => {
          [dataNode, dataAlias].forEach((node) => {
            resourceMap.graph.addStatement({
              subject: node,
              predicate: resourceMap.ns.PROV("wasGeneratedBy"),
              object: executionNode,
            });
            resourceMap.graph.addStatement({
              subject: executionNode,
              predicate: resourceMap.ns.PROV("used"),
              object: node,
            });
          });
          resourceMap.graph.addStatement({
            subject: associationNode,
            predicate: resourceMap.ns.PROV("agent"),
            object: agent,
          });
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: customPredicate,
            object: dataAlias,
          });
        },
        { markDirty: false },
      );

      resourceMap.provenance.getGeneratedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "program.1",
          executionId: executionNode.value,
        },
      ]);
      resourceMap.provenance.getUsedByPrograms().should.deep.equal([
        {
          dataPid: "data.1",
          programPid: "program.1",
          executionId: executionNode.value,
        },
      ]);
      resourceMap.provenance.validate().should.deep.equal([]);

      resourceMap.provenance.removeGeneratedByProgram("data.1", "program.1");
      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");

      resourceMap.graph
        .findStatements({
          predicate: resourceMap.ns.PROV("wasGeneratedBy"),
        })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({ predicate: resourceMap.ns.PROV("used") })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: customPredicate,
          object: dataAlias,
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

    it("reuses an execution created earlier in one grouped mutation", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.reuse.grouped.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      resourceMap.graphState.getIndex();

      resourceMap.mutateGraph(() => {
        resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");
        resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      });

      resourceMap.graphState
        .getExecutionNodesForProgram("program.1")
        .should.have.lengthOf(1);
      resourceMap.provenance.getGeneratedByPrograms().should.have.lengthOf(1);
      resourceMap.provenance.getUsedByPrograms().should.have.lengthOf(1);
    });

    it("keeps one anonymous execution editable", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.anonymous.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionNode: rdf.blankNode(),
        programPid: "program.1",
        identified: false,
      });

      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");

      resourceMap.graphState
        .getExecutionNodesForProgram("program.1")
        .should.deep.equal([executionNode]);
      resourceMap.graph
        .findStatements({
          subject: rdf.sym(resourceMap.getNodeUriForPid("data.1")),
          predicate: resourceMap.ns.PROV("wasGeneratedBy"),
          object: executionNode,
        })
        .should.have.lengthOf(1);
    });

    it("keeps custom run metadata while editing the sole execution", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.metadata.1",
        memberPids: ["meta.1", "data.1", "data.2", "program.1"],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.metadata.1",
          programPid: "program.1",
        },
      );
      const customPredicate = rdf.sym("https://example.test/run-time");
      const agent = rdf.sym("https://orcid.org/0000-0000-0000-0013");
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: customPredicate,
            object: rdf.literal("2026-01-15T10:00:00Z"),
          });
          resourceMap.graph.addStatement({
            subject: associationNode,
            predicate: resourceMap.ns.PROV("agent"),
            object: agent,
          });
        },
        { markDirty: false },
      );

      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      resourceMap.provenance.addGeneratedByProgram("data.2", "program.1");
      resourceMap.provenance.removeGeneratedByProgram("data.2", "program.1");

      resourceMap.graph
        .findStatements({
          subject: executionNode,
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
    });

    it("preserves an enriched execution after its final managed edge is removed", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.metadata.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.metadata.cleanup.1",
          programPid: "program.1",
        },
      );
      const customPredicate = rdf.sym("https://example.test/software-version");
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: customPredicate,
            object: rdf.literal("4.5.1"),
          });
        },
        { markDirty: false },
      );
      addExecutionEdge(resourceMap, executionNode, "data.1", "used");

      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: customPredicate,
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

    it("preserves imported association metadata after its final managed edge is removed", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.agent.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.agent.cleanup.1",
          programPid: "program.1",
        },
      );
      const agent = rdf.sym("https://orcid.org/0000-0000-0000-0013");
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: associationNode,
            predicate: resourceMap.ns.PROV("agent"),
            object: agent,
          });
        },
        { markDirty: false },
      );
      addExecutionEdge(resourceMap, executionNode, "data.1", "used");

      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");

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
          predicate: resourceMap.ns.PROV("agent"),
          object: agent,
        })
        .should.have.lengthOf(1);
    });

    it("removes a bare execution after its final managed edge is removed", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.cleanup.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });

      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      const [executionNode] =
        resourceMap.graphState.getExecutionNodesForProgram("program.1");
      const [associationNode] = resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
        .map(({ object }) => object);

      resourceMap.provenance.removeUsedByProgram("data.1", "program.1");

      resourceMap.graph
        .findStatements({ subject: executionNode })
        .should.deep.equal([]);
      resourceMap.graph
        .findStatements({ subject: associationNode })
        .should.deep.equal([]);
    });

    it("does not create execution RDF for a non-aggregated program", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.invalid.program.1",
        memberPids: ["meta.1", "data.1"],
      });

      expect(() =>
        resourceMap.provenance.addUsedByProgram("data.1", "missing-program.1"),
      ).to.throw("Program PID required");
      resourceMap.graphState.getExecutionNodes().should.deep.equal([]);
    });

    it("refuses program provenance edits when managed membership is ambiguous", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.member.ambiguous.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      resourceMap.provenance.addUsedByProgram("data.1", "program.1");
      const duplicateUri = "https://another-cn.example/cn/v2/resolve/program.1";
      const duplicateNode = rdf.sym(duplicateUri);
      const aggregationNode = rdf.sym(resourceMap.aggregationUri);
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: duplicateNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal(
              "program.1",
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
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
        },
        { markDirty: false },
      );
      const before = resourceMap.graph
        .getStatements()
        .map((statement) => statement.toNT())
        .sort();

      [
        () => resourceMap.provenance.removeUsedByProgram("data.1", "program.1"),
        () =>
          resourceMap.provenance.addGeneratedByProgram("data.1", "program.1"),
      ].forEach((action) => {
        let caught;
        try {
          action();
        } catch (error) {
          caught = error;
        }
        expect(caught?.name).to.equal("ResourceMapConflictError");
        expect(caught?.code).to.equal("ambiguousMemberPid");
        expect(caught?.details).to.deep.equal({
          pid: "program.1",
          memberUris: [resourceMap.pidToUri("program.1"), duplicateUri].sort(),
        });
        resourceMap.graph
          .getStatements()
          .map((statement) => statement.toNT())
          .sort()
          .should.deep.equal(before);
      });
    });

    it("keeps programs with multiple executions read-only", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.multiple.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const executions = [
        addExecutionScaffold(resourceMap, {
          executionId: "urn:uuid:exec.multiple.1",
          programPid: "program.1",
        }).executionNode,
        addExecutionScaffold(resourceMap, {
          executionId: "urn:uuid:exec.multiple.2",
          programPid: "program.1",
        }).executionNode,
      ];
      executions.forEach((executionNode) => {
        addExecutionEdge(
          resourceMap,
          executionNode,
          "data.1",
          "wasGeneratedBy",
        );
      });

      expectReadOnly(() =>
        resourceMap.provenance.removeGeneratedByProgram("data.1", "program.1"),
      );
      expectReadOnly(() =>
        resourceMap.provenance.removeUsedByProgram(
          "missing.data.1",
          "program.1",
        ),
      );

      resourceMap.provenance.getGeneratedByPrograms().should.have.lengthOf(2);
    });

    it("keeps an execution shared by multiple programs read-only", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.shared.1",
        memberPids: ["meta.1", "data.1", "program.1", "program.2"],
      });
      const { executionNode, associationNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.shared.1",
          programPid: "program.1",
        },
      );
      addExecutionScaffold(resourceMap, {
        executionNode,
        associationNode,
        programPid: "program.2",
      });
      addExecutionEdge(resourceMap, executionNode, "data.1", "used");

      expectReadOnly(() =>
        resourceMap.provenance.removeUsedByProgram("data.1", "program.1"),
      );

      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("used"),
        })
        .should.have.lengthOf(1);
    });

    it("keeps an execution with ambiguous identifiers read-only", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.identifiers.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionNode: rdf.blankNode(),
        executionId: "urn:uuid:exec.identifiers.1",
        programPid: "program.1",
      });
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: resourceMap.ns.DCTERMS("identifier"),
            object: rdf.literal("urn:uuid:exec.identifiers.2"),
          });
        },
        { markDirty: false },
      );

      expectReadOnly(() =>
        resourceMap.provenance.addGeneratedByProgram("data.1", "program.1"),
      );
    });

    it("keeps an execution with multiple associations read-only", () => {
      const resourceMap = createBaseResourceMap({
        resourceMapPid: "resource_map_urn:uuid:exec.associations.1",
        memberPids: ["meta.1", "data.1", "program.1"],
      });
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.associations.1",
        programPid: "program.1",
      });
      addExecutionScaffold(resourceMap, {
        executionNode,
        programPid: "program.1",
      });

      expectReadOnly(() =>
        resourceMap.provenance.addUsedByProgram("data.1", "program.1"),
      );
      resourceMap.graph
        .findStatements({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("qualifiedAssociation"),
        })
        .should.have.lengthOf(2);
    });
  });
});
