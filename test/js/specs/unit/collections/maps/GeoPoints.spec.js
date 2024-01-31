define(["../../../../../../../../src/js/collections/maps/GeoPoints"], function (
  GeoPoints
) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPoints Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.geoPoints = new GeoPoints();
    });

    /* Tear down */
    afterEach(function () {
      this.geoPoints = null;
    });

    describe("Initialization", function () {
      it("should create a GeoPoints instance", function () {
        new GeoPoints().should.be.instanceof(GeoPoints);
      });
    });

    describe("Manipulating points", function () {
      it("should add a point", function () {
        this.geoPoints.addPoint([0, 0]);
        this.geoPoints.length.should.equal(1);
      });

      it("should remove a point by index", function () {
        this.geoPoints.addPoint([0, 0]);
        this.geoPoints.removePointByIndex(0);
        this.geoPoints.length.should.equal(0);
      });

      it("should remove a point by attribute", function () {
        this.geoPoints.addPoint([0, 0]);
        this.geoPoints.removePointByAttr(0, 0);
        this.geoPoints.length.should.equal(0);
      });

      it("should remove a point by model", function () {
        const that = this;
        const model = this.geoPoints.addPoint([0, 0]);
        this.geoPoints.removePoint(model);
        this.geoPoints.length.should.equal(0);
      });
    });

    describe("Serialization", function () {
      it("should convert to GeoJSON", function () {
        this.geoPoints.addPoint([0, 0]);
        const geoJson = this.geoPoints.toGeoJson("Point");
        geoJson.features.length.should.equal(1);
        geoJson.features[0].geometry.type.should.equal("Point");
      });

      it("should convert to CZML", function () {
        this.geoPoints.addPoint([5, 5]);
        const czml = this.geoPoints.toCzml("Point");
        czml.length.should.equal(2);
        czml[1].position.cartesian.length.should.equal(3);
        czml[1].point.should.be.instanceof(Object);
      });
    });
  });
});
