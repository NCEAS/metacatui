"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/searchSelect/SolrAutocomplete",
], (cleanState, SolrAutocomplete) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("SolrAutocomplete Test Suite", () => {
    const state = cleanState(() => {
      const autocomplete = new SolrAutocomplete({
        queryField: "kingdom",
      });
      return { autocomplete };
    }, beforeEach);

    it("creates a SolrAutocomplete instance", () => {
      state.autocomplete.should.be.instanceof(SolrAutocomplete);
    });

    it("has default properties", () => {
      const defaults = state.autocomplete.defaults();
      expect(defaults).to.have.property("queryField");
    });

    it("has a searchResults collection", (done) => {
      const searchResults = state.autocomplete.get("searchResults");
      if (searchResults) {
        searchResults.type.should.equal("SolrResults");
        done();
      }
      state.autocomplete.once("change:searchResults", () => {
        const searchResults = state.autocomplete.get("searchResults");
        searchResults.type.should.equal("SolrResults");
        done();
      });
    });

    it("formats options correctly", (done) => {
      state.autocomplete.once("change:searchResults", () => {
        const searchResults = state.autocomplete.get("searchResults");

        searchResults.facetCounts = {
          kingdom: ["kingdom1", 10, "kingdom2", 5],
        };
        state.autocomplete.formatOptions();
        const options = state.autocomplete.optionsAsJSON();

        expect(options).to.have.length(2);
        expect(options[0].label).to.equal("kingdom1");
        expect(options[0].value).to.equal("kingdom1");

        expect(options[1].label).to.equal("kingdom2");
        expect(options[1].value).to.equal("kingdom2");

        done();
      });
      state.autocomplete.initialize();
    });
  });
});
