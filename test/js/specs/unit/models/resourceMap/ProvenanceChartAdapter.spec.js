define([
  "rdflib",
  "models/dataPackage/DataPackage",
  "models/resourceMap/ProvenanceChartAdapter",
  "models/resourceMap/ResourceMap",
  "/test/js/specs/unit/models/resourceMap/ResourceMapTestUtils.js",
], (rdf, DataPackage, ProvenanceChartAdapter, ResourceMap, testUtils) => {
  chai.should();
  const { addExecutionScaffold, TEST_RESOLVE_BASE } = testUtils;

  describe("ProvenanceChartAdapter", () => {
    function buildPackage() {
      const resourceMap = ResourceMap.create({
        resourceMapPid: "rm.1",
        resolveServiceUrl: TEST_RESOLVE_BASE,
        memberPids: [
          "meta.1",
          "data.1",
          "image.1",
          "pdf.1",
          "program.1",
          "program.2",
        ],
        documentationLinks: [{ metadataPid: "meta.1", dataPid: "data.1" }],
      });
      const dataPackage = new DataPackage({
        members: [
          {
            pid: "rm.1",
            formatType: "RESOURCE",
            objectModel: resourceMap,
          },
          { pid: "meta.1", formatType: "METADATA" },
          { pid: "data.1", formatType: "DATA", fileName: "data.csv" },
          {
            pid: "image.1",
            formatType: "DATA",
            formatId: "image/png",
            fileName: "plot.png",
          },
          {
            pid: "pdf.1",
            formatType: "DATA",
            formatId: "application/pdf",
            fileName: "report.pdf",
          },
          {
            pid: "program.1",
            formatType: "DATA",
            fileName: "analysis.R",
          },
          {
            pid: "program.2",
            formatType: "DATA",
            fileName: "prepare.py",
          },
        ],
      });
      dataPackage.rootResourceMapPid = "rm.1";
      return { dataPackage, resourceMap };
    }

    function addGeneratedEdge(resourceMap, executionNode, dataPid = "data.1") {
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid(dataPid));
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: dataNode,
            predicate: resourceMap.ns.PROV("wasGeneratedBy"),
            object: executionNode,
          });
        },
        { markDirty: false },
      );
    }

    it("keeps image and PDF chart presentation types", () => {
      const { dataPackage } = buildPackage();

      const projection = ProvenanceChartAdapter.build(dataPackage);

      projection.getRecord("image.1").type.should.equal("image");
      projection.getRecord("pdf.1").type.should.equal("PDF");
    });

    it("projects one editable program-level relationship", () => {
      const { dataPackage, resourceMap } = buildPackage();
      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");

      const projection = ProvenanceChartAdapter.build(dataPackage);
      const [program] = projection.getSources("data.1");

      program.pid.should.equal("program.1");
      program.type.should.equal("program");
      program.editable.should.equal(true);
      chai.expect(program.executionId).to.equal(undefined);
      chai.expect(program.executionKey).to.equal(undefined);
      projection.getRecord("program.1").editable.should.equal(true);
      projection.getStatements("data.1").should.deep.include({
        predicate: "generatedByProgram",
        subject: projection.getRecord("data.1"),
        object: projection.getRecord("program.1"),
      });
    });

    it("keeps an external program relationship visible but read-only", () => {
      const { dataPackage, resourceMap } = buildPackage();
      const externalProgramPid = "external.program.1";
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.external.1",
        programPid: externalProgramPid,
      });
      addGeneratedEdge(resourceMap, executionNode);

      const projection = ProvenanceChartAdapter.build(dataPackage);
      const [program] = projection.getSources("data.1");

      program.pid.should.equal(externalProgramPid);
      program.editable.should.equal(false);
      chai.expect(program.member).to.equal(null);
      projection.getRecord(externalProgramPid).editable.should.equal(false);
    });

    it("collapses multiple executions into one read-only program relationship", () => {
      const { dataPackage, resourceMap } = buildPackage();
      ["urn:uuid:exec.multiple.1", "urn:uuid:exec.multiple.2"].forEach(
        (executionId) => {
          const { executionNode } = addExecutionScaffold(resourceMap, {
            executionId,
            programPid: "program.1",
          });
          addGeneratedEdge(resourceMap, executionNode);
        },
      );

      const projection = ProvenanceChartAdapter.build(dataPackage);
      const sources = projection.getSources("data.1");

      sources.should.have.lengthOf(1);
      sources[0].pid.should.equal("program.1");
      sources[0].editable.should.equal(false);
      projection.getRecord("program.1").editable.should.equal(false);
      chai
        .expect(projection.getRecord("program.1").executions)
        .to.equal(undefined);
      projection
        .getStatements("data.1")
        .filter(({ predicate }) => predicate === "generatedByProgram")
        .should.have.lengthOf(1);
      resourceMap.provenance
        .getGeneratedByPrograms()
        .map(({ executionId }) => executionId)
        .should.deep.equal([
          "urn:uuid:exec.multiple.1",
          "urn:uuid:exec.multiple.2",
        ]);
    });

    it("keeps one anonymous execution editable without exposing its graph key", () => {
      const { dataPackage, resourceMap } = buildPackage();
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionNode: rdf.blankNode(),
        programPid: "program.1",
        identified: false,
      });
      addGeneratedEdge(resourceMap, executionNode);

      const [program] =
        ProvenanceChartAdapter.build(dataPackage).getSources("data.1");

      program.editable.should.equal(true);
      chai.expect(program.executionId).to.equal(undefined);
      chai.expect(program.executionKey).to.equal(undefined);
    });

    it("keeps a sole execution editable when it has extra run metadata", () => {
      const { dataPackage, resourceMap } = buildPackage();
      resourceMap.provenance.addGeneratedByProgram("data.1", "program.1");
      const [executionNode] =
        resourceMap.graphState.getExecutionNodesForProgram("program.1");
      resourceMap.mutateGraph(
        () => {
          resourceMap.graph.addStatement({
            subject: executionNode,
            predicate: rdf.sym("https://example.test/run-time"),
            object: rdf.literal("2026-01-15T10:00:00Z"),
          });
        },
        { markDirty: false },
      );

      const [program] =
        ProvenanceChartAdapter.build(dataPackage).getSources("data.1");

      program.editable.should.equal(true);
    });

    it("marks a program with multiple associations read-only", () => {
      const { dataPackage, resourceMap } = buildPackage();
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.associations.1",
        programPid: "program.1",
      });
      addExecutionScaffold(resourceMap, {
        executionNode,
        programPid: "program.1",
      });
      addGeneratedEdge(resourceMap, executionNode);

      const projection = ProvenanceChartAdapter.build(dataPackage);

      projection.getSources("data.1")[0].editable.should.equal(false);
      projection.getRecord("program.1").editable.should.equal(false);
    });

    it("keeps wasInformedBy program lineage display-only", () => {
      const { dataPackage, resourceMap } = buildPackage();
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.lineage.current.1",
        programPid: "program.1",
      });
      const { executionNode: previousExecutionNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.lineage.previous.1",
          programPid: "program.2",
        },
      );
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("wasInformedBy"),
          object: previousExecutionNode,
        });
      });

      const projection = ProvenanceChartAdapter.build(dataPackage);
      const [previousProgram] = projection.getSources("program.1");

      previousProgram.pid.should.equal("program.2");
      previousProgram.editable.should.equal(false);
      projection.getStatements("program.1").should.deep.include({
        predicate: "wasInformedByProgram",
        subject: projection.getRecord("program.1"),
        object: projection.getRecord("program.2"),
      });
    });

    it("projects external current-program lineage from its member predecessor", () => {
      const { dataPackage, resourceMap } = buildPackage();
      const externalProgramPid = "external.program.current.1";
      const { executionNode } = addExecutionScaffold(resourceMap, {
        executionId: "urn:uuid:exec.lineage.external.current.1",
        programPid: externalProgramPid,
      });
      const { executionNode: previousExecutionNode } = addExecutionScaffold(
        resourceMap,
        {
          executionId: "urn:uuid:exec.lineage.member.previous.1",
          programPid: "program.2",
        },
      );
      resourceMap.mutateGraph(() => {
        resourceMap.graph.addStatement({
          subject: executionNode,
          predicate: resourceMap.ns.PROV("wasInformedBy"),
          object: previousExecutionNode,
        });
      });

      const projection = ProvenanceChartAdapter.build(dataPackage);
      const [previousProgram] = projection.getSources(externalProgramPid);
      const [currentProgram] = projection.getDerivations("program.2");

      previousProgram.pid.should.equal("program.2");
      previousProgram.editable.should.equal(false);
      currentProgram.pid.should.equal(externalProgramPid);
      currentProgram.editable.should.equal(false);
      chai.expect(currentProgram.member).to.equal(null);
    });

    it("projects external relationship endpoints without synthetic fields", () => {
      const { dataPackage, resourceMap } = buildPackage();
      resourceMap.provenance.addWasDerivedFrom("data.1", "external.source.1");
      resourceMap.provenance.addWasDerivedFrom("external.derived.1", "data.1");
      resourceMap.provenance.addGeneratedByProgram(
        "external.derived.1",
        "program.1",
      );
      resourceMap.provenance.addUsedByProgram("external.source.1", "program.1");

      const projection = ProvenanceChartAdapter.build(dataPackage);

      chai
        .expect(projection.getRecord("external.source.1").member)
        .to.equal(null);
      chai
        .expect(projection.getRecord("external.derived.1").member)
        .to.equal(null);
      projection
        .getSources("program.1")
        .map(({ pid }) => pid)
        .should.include("external.source.1");
      projection
        .getDerivations("program.1")
        .map(({ pid }) => pid)
        .should.include("external.derived.1");
      projection.records
        .map(({ pid }) => pid)
        .should.not.include("external.source.1");
      projection.records
        .map(({ pid }) => pid)
        .should.not.include("external.derived.1");
    });

    it("projects 700 relationships without duplicate program records", () => {
      const count = 700;
      const dataPids = Array.from(
        { length: count },
        (_, index) => `data.${String(index).padStart(3, "0")}`,
      );
      const resourceMap = ResourceMap.create({
        resourceMapPid: "rm.large.chart.1",
        resolveServiceUrl: TEST_RESOLVE_BASE,
        memberPids: ["meta.1", "program.1", ...dataPids],
        documentationLinks: dataPids.map((dataPid) => ({
          metadataPid: "meta.1",
          dataPid,
        })),
      });
      resourceMap.graphState.getIndex();
      resourceMap.mutateGraph(() => {
        dataPids.forEach((dataPid) => {
          resourceMap.provenance.addGeneratedByProgram(dataPid, "program.1");
        });
      });
      const dataPackage = new DataPackage({
        members: [
          {
            pid: "rm.large.chart.1",
            formatType: "RESOURCE",
            objectModel: resourceMap,
          },
          { pid: "meta.1", formatType: "METADATA" },
          { pid: "program.1", formatType: "DATA", fileName: "analysis.R" },
          ...dataPids.map((pid) => ({
            pid,
            formatType: "DATA",
            fileName: `${pid}.csv`,
          })),
        ],
      });
      dataPackage.rootResourceMapPid = "rm.large.chart.1";

      const projection = ProvenanceChartAdapter.build(dataPackage);
      const derivations = projection.getDerivations("program.1");

      derivations.should.have.lengthOf(count);
      new Set(derivations.map(({ pid }) => pid)).size.should.equal(count);
      const [program] = projection.getSources("data.000");
      program.pid.should.equal("program.1");
      program.editable.should.equal(true);
    });
  });
});
