"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "collections/metadata/eml/EMLAnnotations",
], (cleanState, EMLAnnotations) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("Accordion Test Suite", () => {
    const state = cleanState(() => {
      const annotations = new EMLAnnotations({
        propertyLabel: "Property Label",
        propertyURI: "http://example.com/property",
        valueLabel: "Value Label",
        valueURI: "http://example.com/value",
      });
      return { annotations };
    }, beforeEach);

    it("creates an EMLAnnotations collection", () => {
      state.annotations.should.be.instanceof(EMLAnnotations);
    });

    it("checks for duplicates", () => {
      state.annotations.hasDuplicateOf(state.annotations.at(0)).should.be.true;
    });

    it("replaces duplicates", () => {
      state.annotations.replaceDuplicateWith(state.annotations.at(0));
      state.annotations.length.should.equal(1);
    });

    it("adds annotations", () => {
      state.annotations.add({
        propertyLabel: "Property Label2",
        propertyURI: "http://example.com/property2",
        valueLabel: "Value Label2",
        valueURI: "http://example.com/value2",
      });
      state.annotations.length.should.equal(2);
    });

    it("removes annotations", () => {
      state.annotations.remove(state.annotations.at(0));
      state.annotations.length.should.equal(0);
    });
  });
});
