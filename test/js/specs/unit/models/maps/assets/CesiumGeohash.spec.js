define([
  "../../../../../../../../src/js/models/maps/assets/CesiumGeohash",
  "../../../../../../../../src/js/collections/maps/Geohashes",
  "../../../../../../../../src/js/models/maps/Map",
], function (CesiumGeohash, Geohashes) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("CesiumGeohash Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.map = new Map();
      this.model = new CesiumGeohash();
      this.model.set("mapModel", this.map);
    });

    /* Tear down */
    afterEach(function () {
      this.model = null;
    });

    describe("Initialization", function () {
      it("should create a CesiumGeohash instance", function () {
        new CesiumGeohash().should.be.instanceof(CesiumGeohash);
      });

      it("should configure labels", function () {
        this.model.get("type").should.equal("CzmlDataSource");
        const noLabelModel = new CesiumGeohash({ showLabels: false });
        noLabelModel.get("type").should.equal("GeoJsonDataSource");
      });
    });

    describe("getGeohashes", function () {
      it("should return the geohashes", function () {
        const geohashes = this.model.getGeohashes();
        geohashes.type.should.equal("Geohashes");
      });

      it("should return the geohashes in the current extent", function () {
        const geohashes = this.model.getGeohashesForExtent();
        geohashes.type.should.equal("Geohashes");
      });
    });

    describe("Output Formats", function () {
      it("should return the GeoJSON", function () {
        const geojson = this.model.getGeoJSON();
        geojson.type.should.equal("FeatureCollection");
      });

      it("should return the CZML", function () {
        const czml = this.model.getCZML();
        czml.should.be.an("array");
        czml[0].should.have.property("id");
        czml[0].should.have.property("name");
        czml[0].should.have.property("version");
      });
    });

    describe("Cesium", function () {
      it("should create a Cesium model", function () {
        this.model.get("cesiumModel").should.be.an("object");
      });
    });

    describe("Geohash Layer Specific", function () {
      it("should replace the geohashes", function () {
        this.model.replaceGeohashes([
          { hashString: "9q" },
          { hashString: "9r" },
          { hashString: "9x" },
        ]);
        this.model.get("geohashes").length.should.equal(3);
      });

      it("should empty the geohashes", function () {
        this.model.replaceGeohashes();
        this.model.get("geohashes").length.should.equal(0);
      });

      it("should get the precision", function () {
        this.model.replaceGeohashes();
        this.model.set("maxGeoHashes", 32);
        this.map.set("currentViewExtent", {
          north: 90,
          south: -90,
          east: 180,
          west: -180,
        });
        this.model.getPrecision().should.equal(1);
      });

      it("should get the property of interest", function () {
        this.model.getPropertyOfInterest().should.equal("count");
      });

      it("should calculate the min and max vals for the color palette", function () {
        this.model.replaceGeohashes([
          { hashString: "9q", count: 10 },
          { hashString: "9r", count: 50 },
        ]);
        this.model.updateColorRangeValues();
        this.model.get("colorPalette").get("minVal").should.equal(10);
        this.model.get("colorPalette").get("maxVal").should.equal(50);
      });
    });
  });
});
