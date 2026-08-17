define(["models/fileTable/FileTableViewModel"], (FileTableViewModel) => {
  const should = chai.should();

  describe("FileTableViewModel", () => {
    it("merges changed row data without replacing existing row models", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          {
            id: "data.1",
            label: "Data",
            typeLabel: "text/plain",
            actions: [{ id: "download", title: "Download Data" }],
          },
          {
            id: "data.2",
            label: "Other",
            typeLabel: "text/plain",
          },
        ],
      });
      const rows = viewModel.getRows();
      const firstRow = rows.get("data.1");
      const secondRow = rows.get("data.2");
      const changed = [];
      let tableUpdated = false;

      firstRow.on("change", () => changed.push("data.1"));
      secondRow.on("change", () => changed.push("data.2"));
      viewModel.on("rows:update", () => {
        tableUpdated = true;
      });

      viewModel.mergeRows([
        {
          id: "data.1",
          label: "Data",
          typeLabel: "CSV",
          actions: [{ id: "download", title: "Download Data" }],
        },
        {
          id: "data.2",
          label: "Other",
          typeLabel: "text/plain",
        },
      ]);

      rows.get("data.1").should.equal(firstRow);
      rows.get("data.2").should.equal(secondRow);
      firstRow.get("typeLabel").should.equal("CSV");
      changed.should.deep.equal(["data.1"]);
      tableUpdated.should.equal(false);
    });

    it("preserves derived hierarchy state while merging row data", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "folder:data", label: "data", isContainer: true },
          { id: "data.1", parentId: "folder:data", label: "a.csv" },
        ],
      });
      const folder = viewModel.getRows().get("folder:data");
      const child = viewModel.getRows().get("data.1");

      viewModel.collapseRow("folder:data");
      folder.get("hasChildren").should.equal(true);
      folder.get("isExpanded").should.equal(false);
      child.get("isVisible").should.equal(false);

      viewModel.mergeRows([
        { id: "folder:data", label: "Data files", isContainer: true },
        { id: "data.1", parentId: "folder:data", label: "a.csv" },
      ]);

      folder.get("label").should.equal("Data files");
      folder.get("hasChildren").should.equal(true);
      folder.get("isExpanded").should.equal(false);
      child.get("isVisible").should.equal(false);
    });

    it("removes rows that are absent from the merged set", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "data.1", label: "A" },
          { id: "data.2", label: "B" },
          { id: "data.3", label: "C" },
        ],
      });
      const rows = viewModel.getRows();
      const keptRow = rows.get("data.1");
      let rowsUpdated = 0;
      viewModel.on("rows:update", () => {
        rowsUpdated += 1;
      });

      viewModel.mergeRows([
        { id: "data.1", label: "A" },
        { id: "data.3", label: "C" },
      ]);

      rows.length.should.equal(2);
      should.not.exist(rows.get("data.2"));
      rows.get("data.1").should.equal(keptRow);
      rowsUpdated.should.equal(1);
    });

    it("reorders rows in place to match the merged order", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "data.1", label: "A" },
          { id: "data.2", label: "B" },
          { id: "data.3", label: "C" },
        ],
      });
      const rows = viewModel.getRows();
      const firstRow = rows.get("data.1");
      let sorted = false;
      let rowsUpdated = 0;
      rows.on("sort", () => {
        sorted = true;
      });
      viewModel.on("rows:update", () => {
        rowsUpdated += 1;
      });

      viewModel.mergeRows([
        { id: "data.3", label: "C" },
        { id: "data.1", label: "A" },
        { id: "data.2", label: "B" },
      ]);

      rows
        .map((row) => row.id)
        .should.deep.equal(["data.3", "data.1", "data.2"]);
      // The surviving row models are reused, not rebuilt.
      rows.get("data.1").should.equal(firstRow);
      sorted.should.equal(true);
      rowsUpdated.should.equal(1);
    });

    it("emits one rows update when rows are reordered directly", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "data.1", label: "A" },
          { id: "data.2", label: "B" },
        ],
      });
      let rowsUpdated = 0;
      viewModel.on("rows:update", () => {
        rowsUpdated += 1;
      });

      viewModel.orderRows(["data.2", "data.1"]);

      rowsUpdated.should.equal(1);
    });

    it("notifies a reentrant reorder during a structural merge", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "data.1", label: "A" },
          { id: "data.2", label: "B" },
        ],
      });
      const rows = viewModel.getRows();
      let rowsUpdated = 0;
      let reordered = false;
      viewModel.on("rows:update", () => {
        rowsUpdated += 1;
      });
      rows.on("sort", () => {
        if (reordered) return;
        reordered = true;
        viewModel.orderRows(["data.2", "data.1", "data.3"]);
      });

      viewModel.mergeRows([
        { id: "data.1", label: "A" },
        { id: "data.2", label: "B" },
        { id: "data.3", label: "C" },
      ]);

      rowsUpdated.should.equal(2);
    });

    it("notifies a reentrant reorder before a structural merge completes", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "data.1", label: "A" },
          { id: "data.2", label: "B" },
        ],
      });
      const rows = viewModel.getRows();
      let rowsUpdated = 0;
      let reordered = false;
      viewModel.on("rows:update", () => {
        rowsUpdated += 1;
      });
      rows.on("add", (row, collection, options) => {
        if (reordered) return;
        reordered = true;
        viewModel.orderRows(["data.2", "data.1", "data.3"], options);
        rowsUpdated.should.equal(1);
      });

      viewModel.mergeRows([
        { id: "data.1", label: "A" },
        { id: "data.2", label: "B" },
        { id: "data.3", label: "C" },
      ]);

      rowsUpdated.should.equal(2);
    });

    it("emits one rows update for each reentrant structural change", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "data.1", label: "A" },
          { id: "data.2", label: "B" },
        ],
      });
      const rows = viewModel.getRows();
      let rowsUpdated = 0;
      viewModel.on("rows:update", () => {
        rowsUpdated += 1;
      });
      rows.on("add", (row) => {
        if (row.id !== "data.3") return;
        viewModel.addRow({ id: "data.4", label: "D" });
      });

      viewModel.mergeRows([
        { id: "data.1", label: "A" },
        { id: "data.2", label: "B" },
        { id: "data.3", label: "C" },
      ]);

      rows
        .map((row) => row.id)
        .should.deep.equal(["data.1", "data.2", "data.3", "data.4"]);
      rowsUpdated.should.equal(2);
    });

    it("inserts a new row at its merged position", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "folder:data", label: "data", isContainer: true },
          { id: "data.1", parentId: "folder:data", label: "a.csv" },
        ],
      });
      const rows = viewModel.getRows();
      let rowsUpdated = 0;
      viewModel.on("rows:update", () => {
        rowsUpdated += 1;
      });

      viewModel.mergeRows([
        { id: "folder:data", label: "data", isContainer: true },
        { id: "data.1", parentId: "folder:data", label: "a.csv" },
        { id: "data.2", parentId: "folder:data", label: "b.csv" },
      ]);

      rows.length.should.equal(3);
      rows
        .map((row) => row.id)
        .should.deep.equal(["folder:data", "data.1", "data.2"]);
      rows.get("data.2").collection.should.equal(rows);
      rowsUpdated.should.equal(1);
    });

    it("does not reorder or rebuild when the merged order is unchanged", () => {
      const viewModel = new FileTableViewModel({
        rows: [
          { id: "data.1", label: "A" },
          { id: "data.2", label: "B" },
        ],
      });
      const rows = viewModel.getRows();
      let tableUpdated = false;
      let sorted = false;
      viewModel.on("rows:update", () => {
        tableUpdated = true;
      });
      rows.on("sort", () => {
        sorted = true;
      });

      viewModel.mergeRows([
        { id: "data.1", label: "A2" },
        { id: "data.2", label: "B" },
      ]);

      rows.map((row) => row.id).should.deep.equal(["data.1", "data.2"]);
      rows.get("data.1").get("label").should.equal("A2");
      sorted.should.equal(false);
      tableUpdated.should.equal(false);
    });
  });
});
