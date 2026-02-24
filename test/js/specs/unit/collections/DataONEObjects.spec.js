define(["collections/DataONEObjects", "models/DataONEObject"], function (
  DataONEObjects,
  DataONEObject,
) {
  var should = chai.should();
  var expect = chai.expect;

  describe("DataONEObjects Collection", function () {
    let collection;

    beforeEach(function () {
      collection = new DataONEObjects();
    });

    afterEach(function () {
      collection.reset();
      collection = null;
    });

    describe("Initialization", function () {
      it("creates DataONEObject models", function () {
        collection.add({ identifier: "p1" });
        collection.at(0).should.be.instanceof(DataONEObject);
      });
    });

    describe("Version comparison helpers", function () {
      beforeEach(function () {
        collection.reset([
          {
            identifier: "oldest",
            dateUploaded: "2023-01-01T00:00:00Z",
          },
          {
            identifier: "middle",
            dateUploaded: "2023-06-01T00:00:00Z",
          },
          {
            identifier: "newest",
            dateUploaded: "2023-12-01T00:00:00Z",
          },
        ]);
      });

      it("identifies the newest identifier", function () {
        collection.isNewest("newest").should.equal(true);
        collection.isNewest("middle").should.equal(false);
      });

      it("identifies the oldest identifier", function () {
        collection.isOldest("oldest").should.equal(true);
        collection.isOldest("middle").should.equal(false);
      });

      it("throws if the identifier is missing", function () {
        expect(() => collection.isNewest("unknown")).to.throw(
          "Identifier not found in collection",
        );
      });

      it("throws when collection is empty or identifier is falsy", function () {
        collection.reset([]);
        expect(() => collection.isOldest("pid")).to.throw(
          "Identifier not found in collection",
        );
        expect(() => collection.isNewest("")).to.throw(
          "Identifier not found in collection",
        );
      });
    });

    describe("getChainOrdered", function () {
      it("orders models newest-to-oldest by versionHistory index for a reference PID", function () {
        const referencePid = "ref.1";
        collection.reset(
          [
            {
              identifier: "older",
              versionHistory: { [referencePid]: -1 },
            },
            {
              identifier: "newest",
              versionHistory: { [referencePid]: 2 },
            },
            {
              identifier: "ref",
              versionHistory: { [referencePid]: 0 },
            },
            {
              identifier: "newer",
              versionHistory: { [referencePid]: 1 },
            },
          ],
          { sort: false },
        );

        const ordered = collection.getChainOrdered(referencePid);
        ordered
          .map((m) => m.get("identifier"))
          .should.deep.equal(["newest", "newer", "ref", "older"]);
      });

      it("places models without chain index after indexed models deterministically", function () {
        const referencePid = "ref.1";
        collection.reset(
          [
            { identifier: "z-missing", versionHistory: {} },
            { identifier: "a-missing" },
            { identifier: "indexed", versionHistory: { [referencePid]: 0 } },
          ],
          { sort: false },
        );

        const ordered = collection.getChainOrdered(referencePid);
        ordered
          .map((m) => m.get("identifier"))
          .should.deep.equal(["indexed", "a-missing", "z-missing"]);
      });

      it("throws when referencePid is missing", function () {
        expect(() => collection.getChainOrdered()).to.throw(/referencePid/i);
      });
    });

    describe("groupByDate", function () {
      it("returns an empty array for empty collections", function () {
        collection.reset([]);
        const grouped = collection.groupByDate();
        grouped.should.deep.equal([]);
      });

      it("groups models by local calendar day and returns Date values at midnight", function () {
        collection.reset([
          {
            identifier: "a",
            dateUploaded: "2024-01-02T12:00:00Z",
          },
          {
            identifier: "b",
            dateUploaded: "2024-01-02T14:00:00Z",
          },
          {
            identifier: "c",
            dateUploaded: "2024-01-04T12:00:00Z",
          },
          {
            identifier: "no-date",
          },
        ]);

        const grouped = collection.groupByDate();
        grouped.should.have.length(3);

        const groupWithA = grouped.find((group) =>
          group.models.some((model) => model.get("identifier") === "a"),
        );
        const groupWithB = grouped.find((group) =>
          group.models.some((model) => model.get("identifier") === "b"),
        );
        const groupWithC = grouped.find((group) =>
          group.models.some((model) => model.get("identifier") === "c"),
        );
        const undatedGroup = grouped.find((group) => group.date === null);

        expect(groupWithA).to.equal(groupWithB);
        groupWithA.models.should.have.length(2);
        groupWithA.date.should.be.instanceof(Date);
        Object.keys(groupWithA).sort().should.deep.equal(["date", "models"]);

        groupWithC.date.should.be.instanceof(Date);
        groupWithC.models[0].get("identifier").should.equal("c");
        undatedGroup.models.should.have.length(1);
        undatedGroup.models[0].get("identifier").should.equal("no-date");
      });

      it("places invalid dates into the null-date bucket", function () {
        const warnStub = sinon.stub(console, "warn");
        try {
          collection.reset([
            {
              identifier: "bad",
              dateUploaded: "not-a-date",
            },
          ]);

          const grouped = collection.groupByDate();

          grouped.should.have.length(1);
          expect(grouped[0].date).to.equal(null);
          grouped[0].models.should.have.length(1);
          grouped[0].models[0].get("identifier").should.equal("bad");
          warnStub.calledOnce.should.be.true;
        } finally {
          warnStub.restore();
        }
      });

      it("groups by UTC day when groupingTimeZone is UTC", function () {
        collection.reset([
          {
            identifier: "a",
            dateUploaded: "2024-01-02T10:00:00Z",
          },
          {
            identifier: "b",
            dateUploaded: "2024-01-02T20:00:00Z",
          },
          {
            identifier: "c",
            dateUploaded: "2024-01-03T01:00:00Z",
          },
        ]);

        const grouped = collection.groupByDate({ groupingTimeZone: "UTC" });
        grouped.should.have.length(2);

        const jan2Group = grouped.find((group) =>
          group.models.some((model) => model.get("identifier") === "a"),
        );
        const jan3Group = grouped.find((group) =>
          group.models.some((model) => model.get("identifier") === "c"),
        );

        jan2Group.models.should.have.length(2);
        jan3Group.models.should.have.length(1);
        jan2Group.date.should.be.instanceof(Date);
        jan3Group.date.should.be.instanceof(Date);
      });

      it("sorts automatically models by dateUploaded", function () {
        collection.reset([
          {
            identifier: "a",
            dateUploaded: "2024-01-02T10:00:00Z",
          },
          {
            identifier: "c",
            dateUploaded: "2024-01-03T01:00:00Z",
          },
          {
            identifier: "b",
            dateUploaded: "2024-01-02T20:00:00Z",
          },
        ]);

        collection.at(0).get("identifier").should.equal("a");
        collection.at(1).get("identifier").should.equal("b");
        collection.at(2).get("identifier").should.equal("c");

        collection.add({
          identifier: "earliest",
          dateUploaded: "2021-01-01T12:00:00Z",
        });

        collection.at(0).get("identifier").should.equal("earliest");
      });
    });
  });
});
