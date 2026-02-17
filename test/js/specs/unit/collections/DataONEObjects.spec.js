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

    describe("groupByDate", function () {
      it("returns an empty object for empty collections", function () {
        collection.reset([]);
        const grouped = collection.groupByDate();
        Object.keys(grouped).should.have.length(0);
      });

      it("groups models by the YYYY-MM-DD portion of dateUploaded", function () {
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
          {
            identifier: "no-date",
          },
        ]);

        const grouped = collection.groupByDate();
        Object.keys(grouped).should.have.length(3);
        grouped["2024-01-02"].should.have.length(2);
        grouped["2024-01-03"].should.have.length(1);
        grouped["2024-01-03"][0].get("identifier").should.equal("c");
        grouped[""].should.have.length(1);
        grouped[""][0].get("identifier").should.equal("no-date");
      });

      it("places invalid dates into the empty-date bucket", function () {
        const warnStub = sinon.stub(console, "warn");
        collection.reset([
          {
            identifier: "bad",
            dateUploaded: "not-a-date",
          },
        ]);

        const grouped = collection.groupByDate();

        grouped[""].should.have.length(1);
        grouped[""][0].get("identifier").should.equal("bad");
        warnStub.calledOnce.should.be.true;
        warnStub.restore();
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
