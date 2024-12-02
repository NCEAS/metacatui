"use strict";

define(["/test/js/specs/shared/clean-state.js", "models/CrossRefModel"], (
  cleanState,
  CrossRef,
) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("CrossRef Test Suite", () => {
    const state = cleanState(() => {
      // Example DOI from:

      // Jerrentrup, A., Mueller, T., Glowalla, U., Herder, M., Henrichs, N.,
      // Neubauer, A., & Schaefer, J. R. (2018). Teaching medicine with the
      // help of “Dr. House.” PLoS ONE, 13(3), Article e0193972.
      // https://doi.org/10.1371/journal.pone.0193972
      const crossRef = new CrossRef({
        doi: "https://doi.org/10.1371/journal.pone.0193972",
      });
      return { crossRef };
    }, beforeEach);

    it("creates a CrossRef instance", () => {
      state.crossRef.should.be.instanceof(CrossRef);
    });

    it("forms valid fetch URLs", () => {
      const url = state.crossRef.url();

      url.should.be.a("string");
      url.should.include("https://api.crossref.org/works/");
      url.should.include("10.1371%2Fjournal.pone.0193972");
      url.should.include("?mailto:knb-help@nceas.ucsb.edu");
    });
  });
});
