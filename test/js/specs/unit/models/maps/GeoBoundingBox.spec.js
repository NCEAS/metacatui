define(["../../../../../../../../src/js/models/maps/GeoBoundingBox"], function (
  GeoBoundingBox,
) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoBoundingBox Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.geoBoundingBox = new GeoBoundingBox();
    });

    /* Tear down */
    afterEach(function () {
      this.geoBoundingBox.destroy();
    });

    describe("Initialization", function () {
      it("should create a GeoBoundingBox instance", function () {
        new GeoBoundingBox().should.be.instanceof(GeoBoundingBox);
      });
    });

    describe("Defaults", function () {
      it("should have a north attribute", function () {
        expect(this.geoBoundingBox.get("north")).to.equal(null);
      });

      it("should have a south attribute", function () {
        expect(this.geoBoundingBox.get("south")).to.equal(null);
      });

      it("should have an east attribute", function () {
        expect(this.geoBoundingBox.get("east")).to.equal(null);
      });

      it("should have a west attribute", function () {
        expect(this.geoBoundingBox.get("west")).to.equal(null);
      });

      it("should have a height attribute", function () {
        expect(this.geoBoundingBox.get("height")).to.equal(null);
      });
    });

    describe("Validation", function () {
      it("should be valid with valid attributes", function () {
        const valid = new GeoBoundingBox({
          north: 90,
          south: -90,
          east: 180,
          west: -180,
        });
        expect(valid.isValid()).to.equal(true);
      });

      it("should be invalid with invalid attributes", function () {
        const invalid = new GeoBoundingBox({
          north: 91,
          south: -91,
          east: 181,
          west: -181,
        });
        expect(invalid.isValid()).to.equal(false);
      });
    });

    describe("methods", function () {
      it("should split a bounding box that crosses the prime meridian", function () {
        const bbox = new GeoBoundingBox({
          north: 90,
          south: -90,
          east: -180,
          west: 180,
        });
        const split = bbox.split();
        expect(split.length).to.equal(2);
        expect(split[0].get("east")).to.equal(180);
        expect(split[1].get("west")).to.equal(-180);
      });

      it("should not split a bounding box that does not cross the prime meridian", function () {
        const bbox = new GeoBoundingBox({
          north: 90,
          south: -90,
          east: 10,
          west: 0,
        });
        const split = bbox.split();
        expect(split.length).to.equal(1);
        expect(split[0].get("east")).to.equal(10);
        expect(split[0].get("west")).to.equal(0);
      });

      it("should calculate area", function () {
        const bbox = new GeoBoundingBox({
          north: 90,
          south: -90,
          east: 180,
          west: -180,
        });
        expect(bbox.getArea()).to.equal(360 * 180);
      });
    });
  });
});
