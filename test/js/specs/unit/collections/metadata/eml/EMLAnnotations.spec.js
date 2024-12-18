"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "collections/metadata/eml/EMLAnnotations",
], (cleanState, EMLAnnotations) => {
  const should = chai.should();
  const expect = chai.expect;

  const SCHEMA_ORG_SAME_AS = "http://www.w3.org/2002/07/owl#sameAs";
  const PROV_WAS_DERIVED_FROM = "http://www.w3.org/ns/prov#wasDerivedFrom";

  describe("EML Annotations Test Suite", () => {
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

    it("finds annotations by property", () => {
      state.annotations
        .findByProperty("http://example.com/property")
        .length.should.equal(1);
    });

    it("adds canonical dataset annotations", () => {
      const annotations =
        state.annotations.addCanonicalDatasetAnnotation("http://example.com");
      state.annotations.length.should.equal(3);
      annotations[0].get("propertyURI").should.equal(PROV_WAS_DERIVED_FROM);
      annotations[0].get("valueURI").should.equal("http://example.com");
      annotations[1].get("propertyURI").should.equal(SCHEMA_ORG_SAME_AS);
      annotations[1].get("valueURI").should.equal("http://example.com");
    });

    it("finds canonical dataset annotations", () => {
      state.annotations.addCanonicalDatasetAnnotation("http://example.com");
      const annotations = state.annotations.findCanonicalDatasetAnnotation();
      annotations.should.have.property("derived");
      annotations.should.have.property("same");
      annotations.derived.get("valueURI").should.equal("http://example.com");
      annotations.same.get("valueURI").should.equal("http://example.com");
      annotations.derived
        .get("propertyURI")
        .should.equal(PROV_WAS_DERIVED_FROM);
      annotations.same.get("propertyURI").should.equal(SCHEMA_ORG_SAME_AS);
    });

    it("updates canonical dataset annotations", () => {
      state.annotations.addCanonicalDatasetAnnotation("http://example.com");
      state.annotations.updateCanonicalDataset("http://newexample.com");
      state.annotations.getCanonicalURI().should.equal("http://newexample.com");
    });

    it("removes canonical dataset annotations", () => {
      state.annotations.addCanonicalDatasetAnnotation("http://example.com");
      state.annotations.removeCanonicalDatasetAnnotation();
      state.annotations.length.should.equal(1);
    });

    it("gets the URI of the canonical dataset", () => {
      state.annotations.addCanonicalDatasetAnnotation("http://example.com");
      state.annotations.getCanonicalURI().should.equal("http://example.com");
    });

    it("adds annotations if they didn't exist when updating", () => {
      state.annotations.updateCanonicalDataset("http://example.com");
      state.annotations.length.should.equal(3);
    });

    it("removes canonical dataset annotations if the ID is falsy", () => {
      state.annotations.addCanonicalDatasetAnnotation("http://example.com");
      state.annotations.updateCanonicalDataset("");
      state.annotations.length.should.equal(1);
    });

    it("does not update canonical dataset annotations if the ID is the same", () => {
      state.annotations.addCanonicalDatasetAnnotation("http://example.com");
      state.annotations.updateCanonicalDataset("http://example.com");
      state.annotations.length.should.equal(3);
    });

    it("returns null if there are no validation errors", () => {
      const errors = state.annotations.validate();
      expect(errors).to.be.null;
    });

    it("shows validation errors if canonical dataset is not a valid URI", () => {
      state.annotations.addCanonicalDatasetAnnotation("not-a-valid-uri");
      const errors = state.annotations.validate();
      expect(errors).to.be.an("array");
      expect(errors.length).to.equal(1);
      expect(errors[0].attr).to.equal("canonicalDataset");
    });

    it("removes duplicates during validation", () => {
      state.annotations.add([
        {
          propertyLabel: "Property Label",
          propertyURI: "http://example.com/property",
          valueLabel: "Value Label",
          valueURI: "http://example.com/value",
        },
        {
          propertyLabel: "Property Label",
          propertyURI: "http://example.com/property",
          valueLabel: "Value Label",
          valueURI: "http://example.com/value",
        },
      ]);
      const errors = state.annotations.validate();
      expect(errors).to.be.null;
      expect(state.annotations.length).to.equal(1);
    });
  });
});
