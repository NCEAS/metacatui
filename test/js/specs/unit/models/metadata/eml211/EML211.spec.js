"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLParty",
  "models/metadata/eml211/EMLTaxonCoverage",
], function (cleanState, EML, EMLParty, EMLTaxonCoverage) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EML211 Test Suite", function () {
    const state = cleanState(() => {
      const eml = new EML();
      return { eml };
    }, beforeEach);

    // describe("EML Required Fields", function () {
    //   describe("EMLParty", function () {
    //     it("requires a creator and contact");
    //     it("can require a PI");
    //   });
    // });

    describe("Taxonomic Coverage", function () {
      it("should detect when there is not a taxonomic coverage model", function () {
        state.eml.set("taxonCoverage", []);
        state.eml.hasTaxonomicCoverage().should.be.false;
        state.eml.set("taxonCoverage", null);
        state.eml.hasTaxonomicCoverage().should.be.false;
        state.eml.set("taxonCoverage", ["not a taxon coverage model"]);
        state.eml.hasTaxonomicCoverage().should.be.false;
      });

      it("should detect when there is a taxonomic coverage model", function () {
        state.eml.set("taxonCoverage", [
          new EMLTaxonCoverage({
            parentModel: state.eml,
          }),
        ]);
        state.eml.hasTaxonomicCoverage().should.be.true;
      });

      it("should add a taxonomic coverage model", function () {
        state.eml.addTaxonomicCoverage();
        state.eml.hasTaxonomicCoverage().should.be.true;
        state.eml.get("taxonCoverage").should.have.lengthOf(1);
        state.eml
          .get("taxonCoverage")[0]
          .should.be.instanceof(EMLTaxonCoverage);
      });
    });
  });
});
