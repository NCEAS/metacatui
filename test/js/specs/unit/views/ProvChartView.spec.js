define(["jquery", "views/ProvChartView"], ($, ProvChartView) => {
  const expect = chai.expect;

  describe("ProvChartView", () => {
    it("gets package membership from projection records", () => {
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const projection = {
        records: [context],
      };

      expect(
        () =>
          new ProvChartView({
            sources: [],
            context,
            contextEl: $("<div>"),
            dataPackage: {
              toArray() {
                throw new Error("The view read raw package members");
              },
            },
            projection,
          }),
      ).not.to.throw();
    });

    it("builds citation models from plain projection fields", () => {
      const record = {
        pid: "source.csv",
        fileName: "source.csv",
        type: "data",
        title: "Source observations",
        origin: ["A. Researcher"],
        dateUploaded: "2026-01-15T00:00:00Z",
        seriesId: "source.series",
        datasource: "urn:node:TEST",
        member: {
          toJSON() {
            throw new Error("The view read a raw package member");
          },
        },
      };
      const view = new ProvChartView({
        sources: [],
        context: record,
        contextEl: $("<div>"),
        projection: { records: [record] },
      });

      const citationModel = view.getCitationModel(record);

      expect(citationModel.get("id")).to.equal(record.pid);
      expect(citationModel.get("fileName")).to.equal(record.fileName);
      expect(citationModel.get("title")).to.equal(record.title);
      expect(citationModel.get("origin")).to.deep.equal(record.origin);
      expect(citationModel.get("dateUploaded")).to.equal(record.dateUploaded);
      expect(citationModel.get("seriesId")).to.equal(record.seriesId);
      expect(citationModel.get("datasource")).to.equal(record.datasource);
      view.remove();
    });

    it("connects image and PDF sources when a program is added", () => {
      const image = {
        pid: "plot.png",
        fileName: "plot.png",
        type: "image",
        editable: true,
      };
      const pdf = {
        pid: "report.pdf",
        fileName: "report.pdf",
        type: "PDF",
        editable: true,
      };
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const addGeneratedByProgram = sinon.spy();
      const addUsedByProgram = sinon.spy();
      const view = new ProvChartView({
        sources: [image, pdf],
        context,
        contextEl: $("<div>"),
        dataPackage: {
          addGeneratedByProgram,
          addUsedByProgram,
        },
        projection: { records: [context, image, pdf] },
      });

      view.addProv(["analysis.R"], "program");

      sinon.assert.calledOnceWithExactly(
        addGeneratedByProgram,
        context.pid,
        "analysis.R",
      );
      sinon.assert.calledWithExactly(addUsedByProgram, image.pid, "analysis.R");
      sinon.assert.calledWithExactly(addUsedByProgram, pdf.pid, "analysis.R");
      expect(addUsedByProgram.callCount).to.equal(2);
      view.remove();
    });

    it("opens the program picker once per click", () => {
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const view = new ProvChartView({
        sources: [],
        parentView: { classMap: null },
        context,
        contextEl: $("<div>"),
        projection: {
          records: [context],
          getStatements: () => [],
        },
        editModeOn: true,
      });
      const selectProvEntities = sinon.stub(view, "selectProvEntities");
      view.delegateEvents();

      view.render();
      view.$(".program.editor").first().trigger("click");

      expect(selectProvEntities.callCount).to.equal(1);
      view.remove();
    });

    it("omits relationships already shown in provenance pickers", () => {
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const source = {
        pid: "source.csv",
        fileName: "source.csv",
        type: "data",
        editable: true,
      };
      const program = {
        pid: "program.R",
        fileName: "program.R",
        type: "program",
        editable: true,
      };
      const unrelatedData = {
        pid: "unrelated.csv",
        fileName: "unrelated.csv",
        type: "data",
        editable: true,
      };
      const unusedProgram = {
        pid: "unused.R",
        fileName: "unused.R",
        type: "data",
        editable: true,
      };
      const projection = {
        records: [context, source, program, unrelatedData, unusedProgram],
        getStatements(pid) {
          return pid === unusedProgram.pid ? [] : [{}];
        },
      };
      const view = new ProvChartView({
        sources: [source, program],
        parentView: { classMap: null },
        context,
        contextEl: $("<div>"),
        projection,
        editModeOn: true,
      });
      const getPickerPids = (entityType) => {
        const button = document.createElement("button");
        button.classList.add(entityType);
        view.selectProvEntities({ currentTarget: button });
        return view.selectProvEntityView
          .$("option")
          .map((_index, option) => option.value)
          .get();
      };

      expect(getPickerPids("data")).to.deep.equal([
        unrelatedData.pid,
        unusedProgram.pid,
      ]);
      expect(getPickerPids("program")).to.deep.equal([unusedProgram.pid]);

      view.onClose();
    });

    it("removes an empty selection view from its subviews", () => {
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const view = new ProvChartView({
        sources: [],
        context,
        contextEl: $("<div>"),
        projection: { records: [context] },
      });
      const selectView = {
        onClose: sinon.spy(),
        readSelected: () => [],
      };
      view.selectProvEntityView = selectView;
      view.subviews = [selectView];

      expect(view.getSelectedProvEntities()).to.equal(false);

      expect(selectView.onClose.calledOnce).to.equal(true);
      expect(view.selectProvEntityView).to.equal(null);
      expect(view.subviews).to.deep.equal([]);
      view.remove();
    });

    it("closes an active picker when the chart closes", () => {
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const view = new ProvChartView({
        sources: [],
        context,
        contextEl: $("<div>"),
        projection: { records: [context] },
      });
      const selectView = { onClose: sinon.spy() };
      view.selectProvEntityView = selectView;
      view.subviews = [selectView];

      view.onClose();

      sinon.assert.calledOnce(selectView.onClose);
      expect(view.selectProvEntityView).to.equal(null);
      expect(view.subviews).to.deep.equal([]);
    });

    it("renders a chart whose only related entity is a program", () => {
      const program = {
        pid: "clean.R",
        fileName: "clean.R",
        type: "program",
        editable: false,
      };
      const context = {
        pid: "import.R",
        fileName: "import.R",
        type: "program",
        editable: false,
      };

      const view = new ProvChartView({
        sources: [program],
        context,
        contextEl: $("<div>"),
      });
      view.createNode = () => $("<div class='program node'>");

      expect(view.render()).to.equal(view);
      expect(view.height).to.equal(view.nodeHeight);
      expect(view.$(".programs .program.node")).to.have.length(1);

      view.remove();
    });

    it("routes an added source through DataPackage", () => {
      const source = {
        pid: "source.csv",
        fileName: "source.csv",
        type: "data",
        editable: true,
      };
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const addWasDerivedFrom = sinon.spy();
      const view = new ProvChartView({
        sources: [],
        context,
        contextEl: $("<div>"),
        dataPackage: {
          addWasDerivedFrom,
        },
        projection: { records: [context, source] },
      });

      view.addProv([source.pid], "data");

      expect(
        addWasDerivedFrom.calledOnceWithExactly(context.pid, source.pid),
      ).to.equal(true);
      view.remove();
    });

    it("surfaces a rejected DataPackage removal", () => {
      const source = {
        pid: "source.csv",
        fileName: "source.csv",
        type: "data",
        editable: true,
      };
      const context = {
        pid: "derived.csv",
        fileName: "derived.csv",
        type: "data",
        editable: true,
      };
      const error = new Error("This relationship is read only");
      const removeWasDerivedFrom = sinon.stub().throws(error);
      const showMessage = sinon.spy();
      const projection = {
        records: [context, source],
        getStatements: () => [],
      };
      const view = new ProvChartView({
        sources: [source],
        parentView: { classMap: null, showMessage },
        context,
        contextEl: $("<div>"),
        dataPackage: {
          removeWasDerivedFrom,
        },
        projection,
        editModeOn: true,
      });

      view.render();
      view.$(".data.node:not(.editor) .remove").trigger("click");

      expect(
        removeWasDerivedFrom.calledOnceWithExactly(context.pid, source.pid),
      ).to.equal(true);
      expect(
        showMessage.calledOnceWithExactly(error.message, { type: "error" }),
      ).to.equal(true);
      view.remove();
    });

    it("does not render a delete control for a read-only program", () => {
      const program = {
        pid: "external.program.1",
        fileName: "external.program.1",
        type: "program",
        editable: false,
      };
      const view = new ProvChartView({
        sources: [program],
        parentView: { classMap: null },
        context: {
          pid: "data.1",
          fileName: "data.csv",
          type: "data",
          editable: true,
        },
        contextEl: $("<div>"),
        editModeOn: true,
      });

      view.render();

      expect(view.$(".programs .program.node")).to.have.length(1);
      expect(view.$(".programs .remove")).to.have.length(0);

      view.remove();
    });

    it("removes a data node once after repeated hovering", () => {
      const data = {
        pid: "source.csv",
        fileName: "source.csv",
        type: "data",
        editable: true,
      };
      const view = new ProvChartView({
        sources: [data],
        parentView: { classMap: null },
        context: {
          pid: "derived.csv",
          fileName: "derived.csv",
          type: "data",
          editable: true,
        },
        contextEl: $("<div>"),
        editModeOn: true,
      });
      const removeProv = sinon.stub(view, "removeProv");

      view.render();

      const node = view.$(".data.node:not(.editor)");
      node.trigger("mouseenter").trigger("mouseleave");
      node.trigger("mouseenter").trigger("mouseleave");
      node.trigger("mouseenter");
      node.find(".remove").trigger("click");

      expect(removeProv.calledOnce).to.equal(true);
      expect(removeProv.firstCall.args[0]).to.equal(data.pid);
      expect(removeProv.firstCall.args[1]).to.equal("data");

      view.remove();
    });

    it("removes a program node once after repeated hovering", () => {
      const program = {
        pid: "clean.R",
        fileName: "clean.R",
        type: "program",
        editable: true,
      };
      const view = new ProvChartView({
        sources: [program],
        parentView: { classMap: null },
        context: {
          pid: "derived.csv",
          fileName: "derived.csv",
          type: "data",
          editable: true,
        },
        contextEl: $("<div>"),
        editModeOn: true,
      });
      const removeProv = sinon.stub(view, "removeProv");

      view.render();

      const node = view.$(".programs svg");
      node.trigger("mouseenter").trigger("mouseleave");
      node.trigger("mouseenter").trigger("mouseleave");
      node.trigger("mouseenter");
      node.find(".remove").trigger("click");

      expect(removeProv.calledOnce).to.equal(true);
      expect(removeProv.firstCall.args[0]).to.equal(program.pid);
      expect(removeProv.firstCall.args[1]).to.equal("program");

      view.remove();
    });
  });
});
