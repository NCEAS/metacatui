"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/searchSelect/SearchSelect",
], (cleanState, SearchSelect) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("SearchSelect Test Suite", () => {
    const state = cleanState(() => {
      const searchSelect = new SearchSelect({
        submenuStyle: "popout",
      });
      return { searchSelect };
    }, beforeEach);

    it("creates a SearchSelect instance", () => {
      state.searchSelect.should.be.instanceof(SearchSelect);
    });

    it("updates options for the dropdown", () => {
      const options = [
        { label: "Option 1", value: "option1" },
        { label: "Option 2", value: "option2" },
      ];
      state.searchSelect.updateOptions(options);
      const searchSelectOptions = state.searchSelect.get("options");
      searchSelectOptions.should.have.lengthOf(2);
      searchSelectOptions.at(0).get("label").should.equal("Option 1");
      searchSelectOptions.at(1).get("label").should.equal("Option 2");
    });

    it("should save the original submenu style", () => {
      state.searchSelect.get("originalSubmenuStyle").should.equal("popout");
    });

    it("should change submenu style when search term is present", () => {
      state.searchSelect.set("searchTerm", "some term");
      state.searchSelect.get("submenuStyle").should.equal("list");
    });

    it("should revert to original submenu style when search term is removed", () => {
      state.searchSelect.set("searchTerm", "jdlkasa");
      state.searchSelect.set("searchTerm", "");
      state.searchSelect.get("submenuStyle").should.equal("popout");
    });

    it("returns options as JSON", () => {
      const options = [
        { label: "Option 1", value: "option1" },
        { label: "Option 2", value: "option2" },
      ];
      state.searchSelect.updateOptions(options);
      const optionsJSON = state.searchSelect.optionsAsJSON();
      optionsJSON.should.have.lengthOf(2);
      optionsJSON[0].label.should.equal("Option 1");
      optionsJSON[1].label.should.equal("Option 2");
    });

    it("checks if a value is valid", () => {
      const options = [
        { label: "Option 1", value: "option1" },
        { label: "Option 2", value: "option2" },
      ];
      state.searchSelect.updateOptions(options);
      state.searchSelect.isValidValue("option1").should.be.true;
      state.searchSelect.isValidValue("invalid").should.be.false;
    });

    it("checks if there are any invalid selections", () => {
      const options = [
        { label: "Option 1", value: "option1" },
        { label: "Option 2", value: "option2" },
      ];
      state.searchSelect.updateOptions(options);
      state.searchSelect.setSelected(["option1", "invalid"]);
      state.searchSelect.hasInvalidSelections().should.deep.equal(["invalid"]);
    });

    it("adds a selected value", () => {
      state.searchSelect.addSelected("option1");
      state.searchSelect.get("selected").should.deep.equal(["option1"]);
    });

    it("replaces existing value if not multi-select", () => {
      state.searchSelect.set("allowMulti", false);
      state.searchSelect.addSelected("option1");
      state.searchSelect.addSelected("option2");
      state.searchSelect.get("selected").should.deep.equal(["option2"]);
    });

    it("adds multiple values if multi-select", () => {
      state.searchSelect.addSelected("option1");
      state.searchSelect.addSelected("option2");
      state.searchSelect
        .get("selected")
        .should.deep.equal(["option1", "option2"]);
    });

    it("changes the selected values", () => {
      state.searchSelect.setSelected(["option1", "option2"]);
      state.searchSelect
        .get("selected")
        .should.deep.equal(["option1", "option2"]);
    });

    it("removes a selected value", () => {
      state.searchSelect.setSelected(["option1", "option2"]);
      state.searchSelect.removeSelected("option1");
      state.searchSelect.get("selected").should.deep.equal(["option2"]);
    });

    it("checks if a separator is required", () => {
      state.searchSelect.set("selected", ["option1", "option2"]);
      state.searchSelect.separatorRequired("option1").should.be.false;
      state.searchSelect.separatorRequired("option2").should.be.true;
    });

    it("checks if separator can be changed", () => {
      state.searchSelect.canChangeSeparator().should.be.true;
    });
  });
});
