"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/geocoder/GoogleMapsAutocompleter",
], (cleanState, GoogleMapsAutocompleter) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("GoogleMapsAutocompleter Test Suite", () => {
    const state = cleanState(() => {
      const googleMapsAutocompleter = new GoogleMapsAutocompleter();
      const sandbox = sinon.createSandbox();
      sandbox
        .stub(googleMapsAutocompleter.autocompleter, "getPlacePredictions")
        .returns({ predictions: [{ description: "some result" }] });

      return { googleMapsAutocompleter, sandbox };
    }, beforeEach);

    it("creates a GoogleMapsAutocompleter instance", () => {
      state.googleMapsAutocompleter.should.be.instanceof(
        GoogleMapsAutocompleter,
      );
    });

    it("calls the Google Maps API", async () => {
      await state.googleMapsAutocompleter.autocomplete("some place");

      expect(
        state.googleMapsAutocompleter.autocompleter.getPlacePredictions
          .callCount,
      ).to.equal(1);
    });

    it("calls the Google Maps API with the provided input", async () => {
      await state.googleMapsAutocompleter.autocomplete("some place");

      expect(
        state.googleMapsAutocompleter.autocompleter.getPlacePredictions.getCall(
          0,
        ).firstArg,
      ).to.deep.equal({
        input: "some place",
      });
    });

    it("returns results from the Google Maps API", async () => {
      const response =
        await state.googleMapsAutocompleter.autocomplete("some place");

      expect(response[0].get("description")).to.equal("some result");
    });

    it("throws an error if the Google Maps API throws", async () => {
      state.sandbox.restore();
      state.sandbox
        .stub(
          state.googleMapsAutocompleter.autocompleter,
          "getPlacePredictions",
        )
        .rejects();

      expect(
        async () =>
          await state.googleMapsAutocompleter.autocomplete("some place"),
      ).to.throw;
    });
  });
});
