"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/ontologies/BioontologyClass",
], (cleanState, BioontologyClass) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("BioontologyClass Test Suite", () => {
    const state = cleanState(() => {
      const ontontolgyClass = new BioontologyClass({
        queryField: "children",
      });
      return { ontontolgyClass };
    }, beforeEach);

    it("creates a BioontologyClass instance", () => {
      state.ontontolgyClass.should.be.instanceof(BioontologyClass);
    });

    it("adds the classID as a model ID", () => {
      const response = {
        "@id": "http://example.com/ontology/123",
      };
      const parsedResponse = state.ontontolgyClass.parse(response);
      parsedResponse.id.should.equal(response["@id"]);
    });

    it("creates a searchSelect option", () => {
      state.ontontolgyClass.set({
        prefLabel: "Label",
        definition: ["Description"],
        "@id": "http://example.com/ontology/123",
      });
      const searchSelectOption = state.ontontolgyClass.toSearchSelectOption();
      searchSelectOption.label.should.equal("Label");
      searchSelectOption.description.should.equal("Description");
      searchSelectOption.value.should.equal("http://example.com/ontology/123");
    });

    it("creates an accordion item", () => {
      state.ontontolgyClass.set({
        prefLabel: "Label",
        definition: ["Description"],
        hasChildren: true,
        "@id": "http://example.com/ontology/123",
        subClassOf: ["http://example.com/ontology/parent"],
      });
      const accordionItem = state.ontontolgyClass.toAccordionItem();
      accordionItem.title.should.equal("Label");
      accordionItem.description.should.equal("Description");
      accordionItem.hasChildren.should.be.true;
      accordionItem.itemId.should.equal("http://example.com/ontology/123");
      accordionItem.parent.should.equal("http://example.com/ontology/parent");
      accordionItem.content.should.equal("loading...");
      accordionItem.id.should.equal("http://example.com/ontology/123");
    });
  });
});
