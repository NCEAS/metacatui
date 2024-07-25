"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/searchSelect/SearchSelectOption",
], (cleanState, SearchSelectOption) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("SearchSelectOption Test Suite", () => {
    const state = cleanState(() => {
      const searchSelectOption = new SearchSelectOption();
      return { searchSelectOption };
    }, beforeEach);

    it("creates a SearchSelectOption instance", () => {
      state.searchSelectOption.should.be.instanceof(SearchSelectOption);
    });

    it("has default properties", () => {
      const defaults = state.searchSelectOption.defaults();
      expect(defaults).to.have.property("icon");
      expect(defaults).to.have.property("image");
      expect(defaults).to.have.property("label");
      expect(defaults).to.have.property("description");
      expect(defaults).to.have.property("value");
      expect(defaults).to.have.property("category");
    });
  });
});
