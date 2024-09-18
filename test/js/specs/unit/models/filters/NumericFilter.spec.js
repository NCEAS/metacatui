define([
  "../../../../../../../../src/js/models/filters/NumericFilter",
], function (NumericFilter) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;
  let filter;
  let latitudeFields = MetacatUI.appModel.get("queryLatitudeFields");
  let longitudeFields = MetacatUI.appModel.get("queryLongitudeFields");

  describe("Numeric Filter Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      filter = new NumericFilter();
    });

    /* Tear down */
    afterEach(function () {
      filter = undefined;
    });

    describe("The NumericFilter model", function () {
      it("should create a NumericFilter model", function () {
        filter.should.be.instanceof(NumericFilter);
      });
    });

    describe("Constructing queries when there is a min and max", function () {
      it("should create range queries", function () {
        filter.set({
          fields: ["numberReplicas"],
          min: 0,
          max: 5,
        });
        filter.getQuery().should.equal("numberReplicas:[0%20TO%205]");
      });

      it("should create range queries when there is just a min (and assume max is infinite)", function () {
        filter.set({
          fields: ["numberReplicas"],
          min: 0,
          max: null,
        });
        filter.getQuery().should.equal("numberReplicas:[0%20TO%20*]");
      });

      it("should create range queries when there is just a max (and assume min is negative infinity)", function () {
        filter.set({
          fields: ["numberReplicas"],
          min: null,
          max: 5,
        });
        filter.getQuery().should.equal("numberReplicas:[*%20TO%205]");
      });

      it("should create single value queries when there is only a value set", function () {
        filter.set({
          fields: ["numberReplicas"],
          values: [5],
        });
        filter.getQuery().should.equal("numberReplicas:5");
      });
    });

    describe("Parsing", function () {
      it("should parse numericFilter xml");
    });

    describe("Serializing", function () {
      it("should update the XML DOM");
    });

    describe("Validating", function () {
      it("should be invalid if fields are not strings");

      it("should only have an AND or OR fields operator");

      it("should have boolean exclude and matchSubstring");

      it("should be invalid if min is a non-null value that is not a number");

      it("should be invalid if max is a non-null value that is not a number");

      it(
        "should be invalid if rangeMax is a non-null value that is not a number",
      );

      it(
        "should be invalid if rangeMin is a non-null value that is not a number",
      );

      it("should be invalid if min is less than rangeMin");

      it("should be invalid if max is greater than rangeMax");

      it("should be invalid if min is greater than max");
    });

    describe("Utilities", function () {
      it("should recognize coordinate filters", function () {
        filter.set({
          fields: latitudeFields,
        });
        filter.isCoordinateQuery().should.be.true;
      });

      it("should automatically set step to 0.00001 for coordinate filters", function () {
        filter.set({
          fields: latitudeFields,
          min: 0,
          max: 5,
        });
        filter.get("step").should.equal(0.00001);
      });

      it("should automatically set rangeMin -90 for latitude filters", function () {
        filter.set({
          fields: latitudeFields,
        });
        filter.get("rangeMin").should.equal(-90);
      });

      it("should automatically set rangeMax 90 for latitude filters", function () {
        filter.set({
          fields: latitudeFields,
        });
        filter.get("rangeMax").should.equal(90);
      });

      it("should automatically set rangeMin -180 for longitude filters", function () {
        filter.set({
          fields: longitudeFields,
        });
        filter.get("rangeMin").should.equal(-180);
      });

      it("should automatically set rangeMax 180 for longitude filters", function () {
        filter.set("fields", longitudeFields);
        filter.get("rangeMax").should.equal(180);
      });

      it("should switch back to the default step when a coordinate filter becomes a regular numeric filter", function () {
        filter.set("fields", latitudeFields);
        filter.set("fields", "numberReplicas");
        const defaults = filter.defaults();
        filter.get("step").should.equal(defaults["step"]);
      });

      it("should switch back to the default rangeMin when a coordinate filter becomes a regular numeric filter", function () {
        filter.set("fields", latitudeFields);
        filter.set("fields", "numberReplicas");
        const defaults = filter.defaults();
        const newRangeMin = filter.get("rangeMin");
        if (defaults["rangeMin"]) {
          newRangeMin.should.equal(defaults["rangeMin"]);
        } else {
          should.not.exist(newRangeMin);
        }
      });

      it("should switch back to the default rangeMax when a coordinate filter becomes a regular numeric filter", function () {
        filter.set("fields", latitudeFields);
        filter.set("fields", "numberReplicas");
        const defaults = filter.defaults();
        const newRangeMax = filter.get("rangeMax");
        if (defaults["rangeMax"]) {
          newRangeMax.should.equal(defaults["rangeMax"]);
        } else {
          should.not.exist(newRangeMax);
        }
      });
    });
  });
});
