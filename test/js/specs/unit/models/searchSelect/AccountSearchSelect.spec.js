"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/searchSelect/AccountSearchSelect",
], (cleanState, AccountSearchSelect) => {
  const should = chai.should();
  const expect = chai.expect;

  const state = cleanState(() => {
    const accountSearchSelect = new AccountSearchSelect();
    return { accountSearchSelect };
  }, beforeEach);

  describe("AccountSearchSelect Test Suite", () => {
    it("creates an AccountSearchSelect instance", () => {
      state.accountSearchSelect.should.be.instanceof(AccountSearchSelect);
    });

    it("has default properties", () => {
      const defaults = state.accountSearchSelect.defaults();
      expect(defaults).to.have.property("placeholderText");
      expect(defaults).to.have.property("inputLabel");
      expect(defaults).to.have.property("allowMulti");
      expect(defaults).to.have.property("allowAdditions");
      expect(defaults).to.have.property("apiSettings");
    });

    it("fetches account details", () => {
      const accountDetails =
        state.accountSearchSelect.getAccountDetails("searchTerm");
      accountDetails.should.be.instanceof(Promise);
    });

    it("formats a result", () => {
      const result = { label: "John Doe (123)", type: "person" };
      const formattedResult = state.accountSearchSelect.formatResult(result);
      formattedResult.should.have.property("name");
      formattedResult.should.have.property("value");
    });

    it("formats results", () => {
      const results = [
        { label: "John Doe (123)", type: "person" },
        { label: "Group (456)", type: "group" },
      ];
      const formattedResults = state.accountSearchSelect.formatResults(
        results,
        true,
      );
      formattedResults.should.have.lengthOf(2);
      formattedResults[0].should.have.property("icon");
      formattedResults[0].should.have.property("description");
      formattedResults[0].should.have.property("label");
    });

    it("promisifies getAccountsAutocomplete", () => {
      const accountDetails =
        state.accountSearchSelect.getAccountDetails("searchTerm");
      accountDetails.should.be.instanceof(Promise);
    });
  });
});
