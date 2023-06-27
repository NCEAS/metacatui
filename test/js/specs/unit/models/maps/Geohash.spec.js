define(["../../../../../../../../src/js/models/maps/Geohash"], function (
  Geohash
) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Geohash Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.hashString = "9q8yy";
      this.properties = {
        count: 21,
      };
      this.geohash = new Geohash({
        hashString: this.hashString,
        properties: this.properties,
      });
    });

    /* Tear down */
    afterEach(function () {
      this.geohash = null;
    });

    describe("Initialization", function () {
      it("should create a Geohash instance", function () {
        new Geohash().should.be.instanceof(Geohash);
      });
    });

    describe("Property Handling", function () {
      it("should set the hashString property", function () {
        this.geohash.get("hashString").should.equal(this.hashString);
      });

      it("should set the properties property", function () {
        this.geohash.get("properties").should.equal(this.properties);
      });

      it("should identify properties", function () {
        this.geohash.isProperty("count").should.be.true;
      });

      it("should get properties", function () {
        this.geohash.getProperty("count").should.equal(21);
      });

      it("should add properties", function () {
        this.geohash.addProperty("name", "test");
        this.geohash.getProperty("name").should.equal("test");
      });

      it("should remove properties", function () {
        this.geohash.removeProperty("count");
        expect(this.geohash.getProperty("count")).to.be.null;
      });
    });

    describe("Geometry", function () {
      it("should get the bounds of the geohash", function () {
        const bounds = this.geohash.getBounds();
        bounds.should.be.an("array");
        bounds.length.should.equal(4);
        const expectedBounds = [
          37.7490234375, -122.431640625, 37.79296875, -122.3876953125,
        ];
        bounds.should.deep.equal(expectedBounds);
      });

      it("should get the center point of the geohash", function () {
        const point = this.geohash.getPoint();
        point.should.be.an("object");
        point.latitude.should.equal(37.77099609375);
        point.longitude.should.equal(-122.40966796875);
      });

      it("should get the precision of the geohash", function () {
        this.geohash.getPrecision().should.equal(this.hashString.length);
      });

      it("should get the 32 child geohashes", function () {
        const childGeohashes = this.geohash.getChildGeohashes();
        childGeohashes.should.be.an("array");
        childGeohashes.length.should.equal(32);
        childGeohashes.forEach((geohash) => {
          geohash.should.be.an.instanceof(Geohash);
          // Every child should have a precision one greater than the parent.
          geohash.getPrecision().should.equal(this.geohash.getPrecision() + 1);
          // Every child should start with the same hashString as the parent.
          geohash.get("hashString").startsWith(this.geohash.get("hashString"));
        });
      });

      it("should get the parent geohash", function () {
        const parentGeohash = this.geohash.getParentGeohash();
        parentGeohash.should.be.an.instanceof(Geohash);
        // The parent should have a precision one less than the child.
        parentGeohash
          .getPrecision()
          .should.equal(this.geohash.getPrecision() - 1);
        // The parent should start with the same hashString as the child.
        this.geohash
          .get("hashString")
          .startsWith(parentGeohash.get("hashString")).should.be.true;
      });

      it("should convert geodetic coordinates to ECEF", function () {
        const coord = [-122.40966796875, 37.77099609375];
        const ecef = this.geohash.geodeticToECEF(coord);
        ecef.should.be.an("array");
        ecef.length.should.equal(3);
        ecef[0].should.be.a("number");
        ecef[1].should.be.a("number");
        ecef[2].should.be.a("number");
      });
    });

    describe("Serialization", function () {
      it("should serialize to JSON", function () {
        const json = this.geohash.toJSON();
        json.should.be.an("object");
        json.hashString.should.equal(this.hashString);
        json.properties.should.deep.equal(this.properties);
      });

      it("should serialize to CZML", function () {
        const czml = this.geohash.toCZML();
        czml.should.be.an("array");
        czml.length.should.equal(1);
        czml[0].should.be.an("object");
        czml[0].id.should.equal(this.hashString);
        czml[0].polygon.should.be.an("object");
      });
    });
  });
});
