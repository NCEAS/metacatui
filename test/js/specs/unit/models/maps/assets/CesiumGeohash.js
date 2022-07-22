define([
    "../../../../../../../../../src/js/models/maps/assets/CesiumGeohash",
    "../../../../../../../../../src/components/cesium/Cesium"
  ], function (CesiumGeohash, Cesium) {
  
    // Configure the Chai assertion library
    var should = chai.should();
    var expect = chai.expect;
  
    describe("CesiumGeohash Test Suite", function () {
      /* Set up */
      beforeEach(function () {

      })
  
      /* Tear down */
      afterEach(function () {

      })
  
      describe("Initialization", function () {
        it("should create a CesiumGeohash model", function () {
          (new CesiumGeohash()).should.be.instanceof(CesiumGeohash)
        });
      });
  
      describe("Working with Geohashes", function () {
  
        it("gets the geohash level", function () {

            let g = new CesiumGeohash();
            g.setGeohashLevel(20000);
            g.get("geohashLevel").should.eql(5);

        })
  
      });
  
    });
  });