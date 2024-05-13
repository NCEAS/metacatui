"use strict";

define(["models/geocoder/Prediction"], (Prediction) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("Prediction Test Suite", () => {
    it("creates a Prediction instance", () => {
      const prediction = new Prediction();

      prediction.should.be.instanceof(Prediction);
    });

    it("sets the given description", () => {
      const prediction = new Prediction({
        description: "I am a predicted location",
      });

      expect(prediction.get("description")).to.equal(
        "I am a predicted location",
      );
    });

    it("sets the given Google Maps Place ID", () => {
      const prediction = new Prediction({
        googleMapsPlaceId: "GOOGLE-PLACE-ID",
      });

      expect(prediction.get("googleMapsPlaceId")).to.equal("GOOGLE-PLACE-ID");
    });
  });
});
