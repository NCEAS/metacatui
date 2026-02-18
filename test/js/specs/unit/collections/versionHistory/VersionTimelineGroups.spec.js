define([
  "collections/versionHistory/VersionTimelineGroups",
  "collections/DataONEObjects",
], function (VersionTimelineGroups, DataONEObjects) {
  var should = chai.should();
  var expect = chai.expect;
  const FUTURE_DATE_LABEL = "Future Date (Newer)";
  const PAST_DATE_LABEL = "Unknown Date (Older)";
  const NO_DATE_LABEL = "Unknown Date";

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
      it("creates models keyed by id", function () {
        const model = groups.add({
          id: "date:2024-01-01",
          date: new Date(2024, 0, 1),
        });
        model.idAttribute.should.equal("id");
        model.get("models").should.be.an("array");
        model.get("date").should.be.instanceof(Date);
      });
    });

    describe("Sorting", function () {
      it("orders date groups newest to oldest", function () {
        groups.set([
          { id: "date:2024-01-01", date: new Date(2024, 0, 1), models: [] },
          { id: "date:2023-12-15", date: new Date(2023, 11, 15), models: [] },
          { id: "date:2024-02-01", date: new Date(2024, 1, 1), models: [] },
        ]);

        groups.pluck("id").should.deep.equal([
          "date:2024-02-01",
          "date:2024-01-01",
          "date:2023-12-15",
        ]);
      });

      it("keeps future/unknown labels at the extremes", function () {
        groups.set([
          {
            id: PAST_DATE_LABEL,
            date: null,
            label: PAST_DATE_LABEL,
            models: [],
          },
          { id: "date:2024-01-01", date: new Date(2024, 0, 1), models: [] },
          { id: "date:2024-02-01", date: new Date(2024, 1, 1), models: [] },
          {
            id: NO_DATE_LABEL,
            date: null,
            label: NO_DATE_LABEL,
            models: [],
          },
          {
            id: FUTURE_DATE_LABEL,
            date: null,
            label: FUTURE_DATE_LABEL,
            models: [],
          },
        ]);

        groups
          .map((model) => model.get("label") || "DATE")
          .should.deep.equal([
            FUTURE_DATE_LABEL,
            "DATE",
            "DATE",
            NO_DATE_LABEL,
            PAST_DATE_LABEL,
          ]);
      });
    });

    describe("Updating via set", function () {
      it("uses the idAttribute to merge updates", function () {
        groups.set([
          { id: "date:2024-04-01", date: new Date(2024, 3, 1), models: ["initial"] },
          { id: "date:2024-03-01", date: new Date(2024, 2, 1), models: ["older"] },
        ]);

        groups.set(
          [
            { id: "date:2024-04-01", date: new Date(2024, 3, 1), models: ["updated"] },
            { id: "date:2024-05-01", date: new Date(2024, 4, 1), models: ["new"] },
          ],
          { remove: true },
        );

        groups.length.should.equal(2);
        groups.pluck("id").should.deep.equal(["date:2024-05-01", "date:2024-04-01"]);
        groups
          .findWhere({ id: "date:2024-04-01" })
          .get("models")[0]
          .should.equal("updated");
      });
    });

    describe("fromDataONEObjects", function () {
      it("groups by date and keeps undated records when no reference pid", function () {
        const collection = new DataONEObjects([
          { identifier: "a", dateUploaded: "2024-01-01T12:00:00Z" },
          { identifier: "b" },
        ]);

        groups.fromDataONEObjects(collection);

        const datedGroup = groups.find((group) => group.get("date") instanceof Date);
        expect(datedGroup).to.exist;
        expect(datedGroup.get("label")).to.equal(null);

        const undatedGroup = groups.findWhere({ label: NO_DATE_LABEL });
        expect(undatedGroup).to.exist;
        expect(undatedGroup.get("date")).to.equal(null);
        undatedGroup.get("models").length.should.equal(1);
        undatedGroup
          .get("models")[0]
          .get("identifier")
          .should.equal("b");
      });

      it("splits undated models into future/past/no-ref when reference pid is provided", function () {
        const referencePid = "ref.1";
        const collection = new DataONEObjects([
          {
            identifier: "dated",
            dateUploaded: "2024-01-02T12:00:00Z",
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
          .map((group) => group.get("label") || "DATE")
          .should.deep.equal([
            FUTURE_DATE_LABEL,
            "DATE",
            NO_DATE_LABEL,
            PAST_DATE_LABEL,
          ]);

        const datedGroup = groups.find((group) => group.get("date") instanceof Date);
        expect(datedGroup).to.exist;

        groups
          .findWhere({ label: FUTURE_DATE_LABEL })
          .get("models")[0]
          .get("identifier")
          .should.equal("future");
        groups
          .findWhere({ label: PAST_DATE_LABEL })
          .get("models")[0]
          .get("identifier")
          .should.equal("past");
        groups
          .findWhere({ label: NO_DATE_LABEL })
          .get("models")[0]
          .get("identifier")
          .should.equal("no-ref");
      });
    });
  });
});
