define(["../../../../../../../../src/js/collections/maps/Geohashes"], function (
  Geohashes
) {
  // Configure the Chai assertion library
  const should = chai.should();
  const expect = chai.expect;

  describe("Geohashes Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.precision_min = 1;
      this.precision_max = 12;
      this.geohashes = new Geohashes([], {
        minPrecision: this.precision_min,
        maxPrecision: this.precision_max,
      });
    });

    /* Tear down */
    afterEach(function () {
      this.precision_min = null;
      this.precision_max = null;
      this.geohashes = null;
    });

    describe("Initialization", function () {
      it("should create a Geohashes instance", function () {
        new Geohashes().should.be.instanceof(Geohashes);
      });

      it("should set the min and max precision levels", function () {
        this.geohashes.MIN_PRECISION.should.equal(this.precision_min);
        this.geohashes.MAX_PRECISION.should.equal(this.precision_max);
      });
    });

    describe("Validation", function () {
      it("should validate a valid precision", function () {
        this.geohashes.validatePrecision(5).should.equal(5);
      });

      it("should fix a precision that is too high", function () {
        this.geohashes.validatePrecision(13).should.equal(12);
      });

      it("should fix a precision that is too low", function () {
        this.geohashes.validatePrecision(-1).should.equal(1);
      });

      it("should throw an error for an invalid precision if fix is false", function () {
        expect(() => {
          this.geohashes.validatePrecision(-1, false);
        }).to.throw();
      });

      it("should handle precision arrays", function () {
        this.geohashes
          .validatePrecision([1, 2, 3])
          .should.deep.equal([1, 2, 3]);
      });

      it("should validate a valid bounding box", function () {
        const bounds = { north: 80, south: -80, east: 170, west: 160 };
        this.geohashes.boundsAreValid(bounds).should.be.true;
      });

      it("should invalidate a bounding box with invalid bounds", function () {
        const bounds = { north: 80, south: -80, east: 170, west: 190 };
        this.geohashes.boundsAreValid(bounds).should.be.false;
      });

      it("should invalidate a bounding box with missing bounds", function () {
        const bounds = { north: 80, south: -80, east: 170 };
        this.geohashes.boundsAreValid(bounds).should.be.false;
      });

      it("should invalidate a bounding box with non-number bounds", function () {
        const bounds = { north: 80, south: -80, east: 170, west: "west" };
        this.geohashes.boundsAreValid(bounds).should.be.false;
      });
    });

    describe("Bounds", function () {
      it("should split a bounding box that crosses the prime meridian", function () {
        const bounds = { north: 80, south: -80, east: -170, west: 170 };
        const expected = [
          { north: 80, south: -80, east: 180, west: 170 },
          { north: 80, south: -80, east: -170, west: -180 },
        ];
        this.geohashes.splitBoundingBox(bounds).should.deep.equal(expected);
      });

      it("should not split a bounding box that does not cross the prime meridian", function () {
        const bounds = { north: 80, south: -80, east: 170, west: 160 };
        const expected = [{ north: 80, south: -80, east: 170, west: 160 }];
        this.geohashes.splitBoundingBox(bounds).should.deep.equal(expected);
      });

      it("should get the area of a geohash tile", function () {
        const precision = 5;
        const expected = 0.0019311904907226562;
        this.geohashes.getGeohashArea(precision).should.equal(expected);
      });

      it("should get the area of a geohash tile for a range of precisions", function () {
        const minPrecision = 1;
        const maxPrecision = 3;
        const area1 = (180 * 360) / 32;
        const area2 = area1 / 32;
        const area3 = area2 / 32;
        const expected = {
          1: area1,
          2: area2,
          3: area3,
        };
        this.geohashes
          .getGeohashAreas(minPrecision, maxPrecision)
          .should.deep.equal(expected);
      });

      it("should get the area of the world", function () {
        const bounds = { north: 90, south: -90, east: 180, west: -180 };
        const expected = 360 * 180;
        this.geohashes.getBoundingBoxArea(bounds).should.equal(expected);
      });

      it("should get the area of a small bounding box", function () {
        const bounds = { north: 45, south: 44, east: 45, west: 44 };
        const expected = 1;
        this.geohashes.getBoundingBoxArea(bounds).should.equal(expected);
      });
    });

    describe("Precision", function () {
      it("should get the max precision for a small area", function () {
        const area = 1;
        const maxGeohashes = Infinity;
        const expected = 12;
        this.geohashes
          .getMaxPrecision(area, maxGeohashes)
          .should.equal(expected);
      });

      it("should get the max precision for a large area", function () {
        const area = 360 * 180;
        const maxGeohashes = 32 * 32;
        const expected = 2;
        this.geohashes
          .getMaxPrecision(area, maxGeohashes)
          .should.equal(expected);
      });

      it("should get the min precision for a small area", function () {
        const area = 1;
        const expected = 3;
        this.geohashes.getMinPrecision(area).should.equal(expected);
      });

      it("should get the min precision for a large area", function () {
        const area = 360 * 180;
        const expected = 1;
        this.geohashes.getMinPrecision(area).should.equal(expected);
      });

      it("should get the unique precision levels in the collection", function () {
        const geohashes = new Geohashes([
          { hashString: "a" },
          { hashString: "ab" },
          { hashString: "abc" },
        ]);
        const expected = [1, 2, 3];
        geohashes.getPrecisions().should.deep.equal(expected);
      });
    });

    describe("Geohash Generation & Retrieval", function () {
      it("should return the geohashes as a GeoJSON FeatureCollection", function () {
        const geohashes = new Geohashes([{ hashString: "gw" }]);
        const expected = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-22.5, 78.75],
                    [-11.25, 78.75],
                    [-11.25, 84.375],
                    [-22.5, 84.375],
                    [-22.5, 78.75],
                  ],
                ],
              },
              properties: {
                hashString: "gw",
              },
            },
          ],
        };
        geohashes.toGeoJSON().should.deep.equal(expected);
      });
      it("should find a geohash that contains the provided hashString", function () {
        const geohashes = new Geohashes([{ hashString: "gw" }]);
        const expected = geohashes.at(0);
        geohashes.getContainingGeohash("gwa").should.deep.equal(expected);
      });

      it("should find a geohash that is the provided hashString", function () {
        const geohashes = new Geohashes([{ hashString: "gw" }]);
        const expected = geohashes.at(0);
        geohashes.getContainingGeohash("gw").should.deep.equal(expected);
      });
    });
  });
});
