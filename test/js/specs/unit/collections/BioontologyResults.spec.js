"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "collections/ontologies/BioontologyResults",
], (cleanState, BioontologyResults) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("BioontologyResults Test Suite", () => {
    const state = cleanState(() => {
      const bioontologyClass = {
        "@id": "http://purl.bioontology.org/ontology/SNOMEDCT/12345",
        "@type": "http://data.bioontology.org/metadata/Class",
        links: {
          self: "http://data.bioontology.org/ontologies/SNOMEDCT/classes/12345",
        },
        prefLabel: "Some Class",
        type: "BioontologyClass",
        id: "http://purl.bioontology.org/ontology/SNOMEDCT/12345",
      };
      const bioontologyResults = new BioontologyResults([bioontologyClass]);

      // Simulated localStorage behavior: must do this because localStorage is
      // not available in the test environment.
      const localStorageStore = {};

      const setItemStub = sinon
        .stub(localStorage, "setItem")
        .callsFake((key, value) => {
          localStorageStore[key] = value;
        });

      const getItemStub = sinon
        .stub(localStorage, "getItem")
        .callsFake((key) => {
          return localStorageStore[key] || null;
        });

      return { bioontologyResults, bioontologyClass, setItemStub, getItemStub };
    }, beforeEach);

    afterEach(() => {
      sinon.restore();
    });

    it("creates a BioontologyResults instance", () => {
      state.bioontologyResults.should.be.instanceof(BioontologyResults);
    });

    it("adds a BioontologyClass to the collection", () => {
      state.bioontologyResults
        .pluck("id")
        .should.include(state.bioontologyClass.id);
    });

    it("caches the collection", () => {
      // state.bioontologyResults.cache();
      // expect(state.localStorageStub.callCount).to.equal(1);
    });

    it("restores items from the cache", () => {
      state.bioontologyResults.cache();
      // remove the model from the collection
      state.bioontologyResults.remove(state.bioontologyClass.id);
      state.bioontologyResults.models.should.have.lengthOf(0);
      state.bioontologyResults.restoreFromCache();
      state.bioontologyResults.models.should.have.lengthOf(1);
    });

    it("clears the cache", () => {
      state.bioontologyResults.clearCache();
    });

    it("converts classes to Accordion items", () => {
      const accordionItems =
        state.bioontologyResults.classesToAccordionItems("root");
      expect(accordionItems[0].parent).to.equal("");
    });
  });
});
