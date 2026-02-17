define([
  "collections/versionHistory/VersionTimelineGroups",
  "collections/DataONEObjects",
], function (VersionTimelineGroups, DataONEObjects) {
  var should = chai.should();
  var expect = chai.expect;

  describe("VersionTimelineGroups Collection", function () {
    let groups;

    beforeEach(function () {
      groups = new VersionTimelineGroups();
    });

    afterEach(function () {
      groups.reset();
      groups = null;
    });

    describe("Initialization", function () {
      it("creates models keyed by date", function () {
        const model = groups.add({ date: "2024-01-01" });
        model.idAttribute.should.equal("date");
        model.get("models").should.be.an("array");
      });
    });

    describe("Sorting", function () {
      it("orders parseable dates newest to oldest", function () {
        groups.set([
          { date: "2024-01-01", models: [] },
          { date: "2023-12-15", models: [] },
          { date: "2024-02-01", models: [] },
        ]);

        groups
          .pluck("date")
          .should.deep.equal(["2024-02-01", "2024-01-01", "2023-12-15"]);
      });

      it("falls back to lexical ordering for non-date strings", function () {
        groups.set([
          { date: "zzz", models: [] },
          { date: "aaa", models: [] },
          { date: "mmm", models: [] },
        ]);

        groups.pluck("date").should.deep.equal(["zzz", "mmm", "aaa"]);
      });

      it("keeps future/unknown labels at the extremes", function () {
        groups.set([
          { date: "Unknown Date (Older)", models: [] },
          { date: "2024-01-01", models: [] },
          { date: "Unknown Date", models: [] },
          { date: "Future Date (Newer)", models: [] },
        ]);

        groups
          .pluck("date")
          .should.deep.equal([
            "Future Date (Newer)",
            "2024-01-01",
            "Unknown Date",
            "Unknown Date (Older)",
          ]);
      });
    });

    describe("Updating via set", function () {
      it("uses the date idAttribute to merge updates", function () {
        groups.set([
          { date: "2024-04-01", models: ["initial"] },
          { date: "2024-03-01", models: ["older"] },
        ]);

        groups.set(
          [
            { date: "2024-04-01", models: ["updated"] },
            { date: "2024-05-01", models: ["new"] },
          ],
          { remove: true },
        );

        groups.length.should.equal(2);
        groups.pluck("date").should.deep.equal(["2024-05-01", "2024-04-01"]);
        groups
          .findWhere({ date: "2024-04-01" })
          .get("models")[0]
          .should.equal("updated");
      });
    });

    describe("fromDataONEObjects", function () {
      it("groups by date and keeps undated records when no reference pid", function () {
        const collection = new DataONEObjects([
          { identifier: "a", dateUploaded: "2024-01-01T00:00:00Z" },
          { identifier: "b" },
        ]);

        groups.fromDataONEObjects(collection);

        const dates = groups.pluck("date");
        dates.should.include("2024-01-01");
        dates.should.include("");
        groups.findWhere({ date: "" }).get("models").length.should.equal(1);
      });

      it("splits undated models into future/past/no-ref when reference pid is provided", function () {
        const referencePid = "ref.1";
        const collection = new DataONEObjects([
          {
            identifier: "dated",
            dateUploaded: "2024-01-02T00:00:00Z",
            versionHistory: { [referencePid]: 0 },
          },
          {
            identifier: "future",
            versionHistory: { [referencePid]: 2 },
          },
          {
            identifier: "past",
            versionHistory: { [referencePid]: -1 },
          },
          {
            identifier: "no-ref",
            versionHistory: {},
          },
        ]);

        groups.fromDataONEObjects(collection, { referencePid });

        groups
          .pluck("date")
          .should.deep.equal([
            "Future Date (Newer)",
            "2024-01-02",
            "Unknown Date",
            "Unknown Date (Older)",
          ]);

        groups
          .findWhere({ date: "Future Date (Newer)" })
          .get("models")[0]
          .get("identifier")
          .should.equal("future");
        groups
          .findWhere({ date: "Unknown Date (Older)" })
          .get("models")[0]
          .get("identifier")
          .should.equal("past");
        groups
          .findWhere({ date: "Unknown Date" })
          .get("models")[0]
          .get("identifier")
          .should.equal("no-ref");
      });
    });
  });
});
