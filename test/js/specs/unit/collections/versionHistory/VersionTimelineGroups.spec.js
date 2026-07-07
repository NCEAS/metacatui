define([
  "collections/versionHistory/VersionTimelineGroups",
  "collections/DataONEObjects",
], function (VersionTimelineGroups, DataONEObjects) {
  var should = chai.should();
  var expect = chai.expect;
  const NO_DATE_LABEL = VersionTimelineGroups.NO_DATE_LABEL || "Unknown Date";

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
      it("orders groups by sequence", function () {
        groups.set([
          { id: "g2", sequence: 2, date: new Date(2024, 0, 1), models: [] },
          { id: "g0", sequence: 0, date: new Date(2023, 11, 15), models: [] },
          { id: "g1", sequence: 1, date: new Date(2024, 1, 1), models: [] },
        ]);

        groups.pluck("id").should.deep.equal(["g0", "g1", "g2"]);
      });
    });

    describe("Updating via set", function () {
      it("uses the idAttribute to merge updates", function () {
        groups.set([
          {
            id: "segment:0:a",
            sequence: 0,
            date: new Date(2024, 3, 1),
            models: ["initial"],
          },
          {
            id: "segment:1:b",
            sequence: 1,
            date: new Date(2024, 2, 1),
            models: ["older"],
          },
        ]);

        groups.set(
          [
            {
              id: "segment:0:a",
              sequence: 0,
              date: new Date(2024, 3, 1),
              models: ["updated"],
            },
            {
              id: "segment:2:c",
              sequence: 2,
              date: new Date(2024, 4, 1),
              models: ["new"],
            },
          ],
          { remove: true },
        );

        groups.length.should.equal(2);
        groups.pluck("id").should.deep.equal(["segment:0:a", "segment:2:c"]);
        groups
          .findWhere({ id: "segment:0:a" })
          .get("models")[0]
          .should.equal("updated");
      });
    });

    describe("fromDataONEObjects", function () {
      it("throws when referencePid is missing", function () {
        const collection = new DataONEObjects([
          { identifier: "a", dateUploaded: "2024-01-01T12:00:00Z" },
        ]);

        expect(() => groups.fromDataONEObjects(collection)).to.throw(
          /referencePid/i,
        );
      });

      it("preserves strict chain order across grouped segments", function () {
        const referencePid = "ref.1";
        const collection = new DataONEObjects(
          [
            {
              identifier: "older",
              dateUploaded: "2024-01-09T12:00:00Z",
              versionHistory: { [referencePid]: -1 },
            },
            {
              identifier: "newest",
              dateUploaded: "2024-01-10T12:00:00Z",
              versionHistory: { [referencePid]: 2 },
            },
            {
              identifier: "ref",
              dateUploaded: "2024-01-10T11:00:00Z",
              versionHistory: { [referencePid]: 0 },
            },
            {
              identifier: "newer",
              dateUploaded: "2024-01-11T12:00:00Z",
              versionHistory: { [referencePid]: 1 },
            },
          ],
          { sort: false },
        );

        groups.fromDataONEObjects(collection, { referencePid });

        groups.length.should.equal(4);
        groups.pluck("sequence").should.deep.equal([0, 1, 2, 3]);

        groups
          .at(0)
          .get("models")
          .map((m) => m.get("identifier"))
          .should.deep.equal(["newest"]);
        groups
          .at(1)
          .get("models")
          .map((m) => m.get("identifier"))
          .should.deep.equal(["newer"]);
        groups
          .at(2)
          .get("models")
          .map((m) => m.get("identifier"))
          .should.deep.equal(["ref"]);
        groups
          .at(3)
          .get("models")
          .map((m) => m.get("identifier"))
          .should.deep.equal(["older"]);
      });

      it("creates repeated date buckets when the same day is non-contiguous in chain order", function () {
        const referencePid = "ref.1";
        const collection = new DataONEObjects(
          [
            {
              identifier: "jan10-a",
              dateUploaded: "2024-01-10T10:00:00Z",
              versionHistory: { [referencePid]: 2 },
            },
            {
              identifier: "jan11",
              dateUploaded: "2024-01-11T10:00:00Z",
              versionHistory: { [referencePid]: 1 },
            },
            {
              identifier: "jan10-b",
              dateUploaded: "2024-01-10T20:00:00Z",
              versionHistory: { [referencePid]: 0 },
            },
          ],
          { sort: false },
        );

        groups.fromDataONEObjects(collection, { referencePid });

        groups.length.should.equal(3);
        groups.at(0).get("date").should.be.instanceof(Date);
        groups.at(1).get("date").should.be.instanceof(Date);
        groups.at(2).get("date").should.be.instanceof(Date);
        groups
          .at(0)
          .get("date")
          .getTime()
          .should.equal(groups.at(2).get("date").getTime());
      });

      it("creates contiguous unknown-date buckets instead of global future/past buckets", function () {
        const referencePid = "ref.1";
        const collection = new DataONEObjects(
          [
            {
              identifier: "unknown-a",
              versionHistory: { [referencePid]: 2 },
            },
            {
              identifier: "dated",
              dateUploaded: "2024-01-11T10:00:00Z",
              versionHistory: { [referencePid]: 1 },
            },
            {
              identifier: "unknown-b",
              dateUploaded: "not-a-date",
              versionHistory: { [referencePid]: 0 },
            },
          ],
          { sort: false },
        );

        groups.fromDataONEObjects(collection, { referencePid });

        groups.length.should.equal(3);
        groups.at(0).get("label").should.equal(NO_DATE_LABEL);
        expect(groups.at(0).get("date")).to.equal(null);
        expect(groups.at(2).get("date")).to.equal(null);
        groups.at(2).get("label").should.equal(NO_DATE_LABEL);
      });

      it("uses sequence for sorting rather than date rank", function () {
        const referencePid = "ref.1";
        const collection = new DataONEObjects(
          [
            {
              identifier: "older-date-but-newer-chain",
              dateUploaded: "2024-01-01T10:00:00Z",
              versionHistory: { [referencePid]: 1 },
            },
            {
              identifier: "newer-date-but-older-chain",
              dateUploaded: "2024-02-01T10:00:00Z",
              versionHistory: { [referencePid]: 0 },
            },
          ],
          { sort: false },
        );

        groups.fromDataONEObjects(collection, { referencePid });

        groups
          .at(0)
          .get("models")[0]
          .get("identifier")
          .should.equal("older-date-but-newer-chain");
        groups
          .at(1)
          .get("models")[0]
          .get("identifier")
          .should.equal("newer-date-but-older-chain");
      });

      it("preserves model references in group models arrays", function () {
        const referencePid = "ref.1";
        const collection = new DataONEObjects([
          {
            identifier: "dated",
            dateUploaded: "2024-01-02T12:00:00Z",
            versionHistory: { [referencePid]: 0 },
          },
        ]);

        groups.fromDataONEObjects(collection, { referencePid });
        const models = groups.at(0).get("models");
        models.should.be.an("array");
        expect(models[0]).to.equal(collection.at(0));
      });
    });
  });
});
