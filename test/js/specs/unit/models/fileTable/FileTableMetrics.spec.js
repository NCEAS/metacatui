define(["models/fileTable/FileTableMetrics"], (FileTableMetrics) => {
  const { expect } = chai;
  chai.should();

  describe("FileTableMetrics", () => {
    describe("parse", () => {
      it("parses the array-of-rows response shape", () => {
        const map = FileTableMetrics.parse({
          results: [
            { pid: "a", views: 120, downloads: 42, citations: 3 },
            { pid: "b", views: 66, downloads: 17 },
          ],
        });
        map.get("a").should.deep.equal({
          views: 120,
          downloads: 42,
          citations: 3,
        });
        map.get("b").should.deep.equal({
          views: 66,
          downloads: 17,
          citations: 0,
        });
      });

      it("parses the parallel-array response shape", () => {
        const map = FileTableMetrics.parse({
          results: {
            pid: ["a", "b"],
            views: [120, 66],
            downloads: [42, 17],
            citations: [3, 1],
          },
        });
        map.get("a").views.should.equal(120);
        map.get("b").downloads.should.equal(17);
      });

      it("parses dataset metrics package counts", () => {
        const map = FileTableMetrics.parse({
          resultDetails: {
            metrics_package_counts: {
              "meta.1": { viewCount: 38, downloadCount: 0 },
              resource_map_1: { viewCount: 8, downloadCount: 2 },
            },
          },
        });

        map.get("meta.1").should.deep.equal({
          views: 38,
          downloads: 0,
          citations: 0,
        });
        map.get("resource_map_1").downloads.should.equal(2);
      });

      it("returns an empty map for an empty or malformed response", () => {
        FileTableMetrics.parse({}).size.should.equal(0);
        FileTableMetrics.parse(null).size.should.equal(0);
      });
    });

    describe("getRowMetric", () => {
      const map = new Map([["meta.1", { views: 566, downloads: 0 }]]);
      map.set("data.1", { views: 0, downloads: 80 });

      it("shows views for metadata and downloads for data", () => {
        const resolve = FileTableMetrics.getRowMetric(map);

        const metaMetric = resolve({ pid: "meta.1" }, "METADATA");
        metaMetric.label.should.equal("566");
        metaMetric.title.should.match(/views/);
        metaMetric.iconClass.should.equal("icon icon-eye-open");

        const dataMetric = resolve({ pid: "data.1" }, "DATA");
        dataMetric.label.should.equal("80");
        dataMetric.title.should.match(/downloads/);
      });

      it("returns null when a member has no metrics", () => {
        const resolve = FileTableMetrics.getRowMetric(map);
        expect(resolve({ pid: "unknown" }, "DATA")).to.equal(null);
      });
    });
  });
});
