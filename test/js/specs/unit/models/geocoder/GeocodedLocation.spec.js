"use strict";

define(["models/geocoder/GeocodedLocation"], (GeocodedLocation) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("GeocodedLocation Test Suite", () => {
    it("creates a GeocodedLocation instance", () => {
      const geocodedLocation = new GeocodedLocation();

      geocodedLocation.should.be.instanceof(GeocodedLocation);
    });

    it("sets the given bounds for a GeoBoundingBox", () => {
      const geocodedLocation = new GeocodedLocation({
        box: {
          east: 1,
          west: 2,
          north: 3,
          south: 4,
        },
      });

      expect(geocodedLocation.get("box").getCoords()).to.deep.equal({
        east: 1,
        west: 2,
        north: 3,
        south: 4,
      });
    });

    it("sets the given display name", () => {
      const geocodedLocation = new GeocodedLocation({ displayName: "Example" });

      expect(geocodedLocation.get("displayName")).to.equal("Example");
    });
  });
});
