define(["jquery", "views/ProvEntitySelectView"], ($, ProvEntitySelectView) => {
  describe("ProvEntitySelectView", () => {
    it("offers unused files as new program candidates", () => {
      const projection = {
        records: [
          { pid: "current.1", type: "data", fileName: "output.csv" },
          { pid: "unused.1", type: "data", fileName: "analysis.R" },
          { pid: "used.1", type: "data", fileName: "input.csv" },
          {
            pid: "program.1",
            type: "program",
            fileName: "existing.R",
            editable: false,
          },
        ],
        getStatements(pid) {
          return pid == "used.1" ? [{}] : [];
        },
      };
      const view = new ProvEntitySelectView({
        projection,
        context: projection.records[0],
        selectEntityType: "program",
      });

      const optionPids = $(view.render().el)
        .find("option")
        .map((_index, option) => option.value)
        .get();

      chai.expect(optionPids).to.deep.equal(["unused.1", "program.1"]);
      const programOption = view.$("option[value='program.1']");
      chai.expect(programOption.prop("disabled")).to.equal(true);
      view.$("option[value='unused.1']").prop("selected", true);
      chai.expect(view.readSelected()).to.deep.equal(["unused.1"]);
      view.onClose();
    });

    it("escapes package values in the picker markup", () => {
      const candidate = {
        pid: 'unused.1" data-injected="true',
        type: "data",
        fileName: "<img class='filename-injection'>analysis.R",
      };
      const projection = {
        records: [
          { pid: "current.1", type: "data", fileName: "output.csv" },
          candidate,
        ],
      };
      const view = new ProvEntitySelectView({
        projection,
        context: projection.records[0],
        title: "<img class='title-injection'>Add provenance",
        selectLabel: "<img class='label-injection'>Choose a file",
      });

      view.render();

      chai.expect(view.$(".title-injection")).to.have.length(0);
      chai.expect(view.$(".label-injection")).to.have.length(0);
      chai.expect(view.$(".filename-injection")).to.have.length(0);
      chai.expect(view.$("#selectModalLabel").text()).to.equal(view.title);
      chai.expect(view.$("label").text()).to.equal(view.selectLabel);
      chai.expect(view.$("option").attr("value")).to.equal(candidate.pid);
      chai.expect(view.$("option").text()).to.equal(candidate.fileName);
      view.onClose();
    });
  });
});
