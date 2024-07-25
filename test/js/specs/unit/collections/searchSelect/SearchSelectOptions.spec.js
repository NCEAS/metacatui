"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "collections/searchSelect/SearchSelectOptions",
], (cleanState, SearchSelectOptions) => {
  const should = chai.should();
  const expect = chai.expect;

  const state = cleanState(() => {
    const searchSelectOptions = new SearchSelectOptions([
      {
        label: "Option 1",
        value: "option1",
        category: "Category A",
      },
      {
        label: "Option 2",
        value: "option2",
        category: "Category A",
      },
      {
        label: "Option 3",
        value: "option3",
        category: "Category B",
      },
    ]);
    return { searchSelectOptions };
  }, beforeEach);

  describe("SearchSelectOptions Test Suite", () => {
    it("creates a SearchSelectOptions instance", () => {
      state.searchSelectOptions.should.be.instanceof(SearchSelectOptions);
    });

    it("parses an array of options", () => {
      const options = state.searchSelectOptions.parse([
        { label: "Option 1" },
        { label: "Option 2" },
      ]);
      options.should.have.lengthOf(2);
    });

    it("parses an object of categorized options", () => {
      const options = state.searchSelectOptions.parse({
        "Category A": [{ label: "Option 1" }, { label: "Option 2" }],
        "Category B": [{ label: "Option 3" }, { label: "Option 4" }],
      });
      options.should.have.lengthOf(4);
    });

    it("gets category names", () => {
      const categories = state.searchSelectOptions.getCategoryNames();
      categories.should.have.lengthOf(2);
    });

    it("gets options by category", () => {
      const options =
        state.searchSelectOptions.getOptionsByCategory("Category A");
      options.should.have.lengthOf(2);
    });

    it("checks if a value is valid", () => {
      const isValid = state.searchSelectOptions.isValidValue("option1");
      isValid.should.be.true;
    });

    it("gets an option by label or value", () => {
      const option =
        state.searchSelectOptions.getOptionByLabelOrValue("option1");
      option.get("label").should.equal("Option 1");
    });

    it("returns JSON representation of the collection", () => {
      const json = state.searchSelectOptions.toJSON();
      json.should.have.lengthOf(3);
    });

    it("returns categorized JSON representation of the collection", () => {
      const json = state.searchSelectOptions.toJSON(true);
      json.should.have.property("Category A");
    });
  });
});
