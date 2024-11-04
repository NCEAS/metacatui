"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/connectors/Bioontology-Accordion-SearchSelect",
  "models/ontologies/BioontologyClass",
], (cleanState, Connector, BioontologyClass) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("BioontologyAccordionSearchSelect Test Suite", () => {
    const state = cleanState(() => {
      const connector = new Connector({
        ontologyOptions: [
          {
            label: "Some Ontology",
            ontology: "ABC",
            subTree: "Id-Class-1",
          },
          {
            label: "Another Ontology",
            ontology: "DEF",
            subTree: "Id-Class-2",
          },
        ],
      });

      return { connector };
    }, beforeEach);

    it("creates a BioontologyAccordionSearchSelect instance", () => {
      state.connector.should.be.instanceof(Connector);
    });

    it("selects a class in the accordion", () => {
      // Add the item to the bioontology collection
      const testItem = state.connector.get("bioontology").get("collection").add(
        {
          "@id": "someId",
        },
        { parse: true },
      );

      // Select the item
      state.connector.setSelectedClass(
        new Backbone.Model({
          itemId: "someId",
        }),
      );

      state.connector.get("selectedClass").get("id").should.equal("someId");
    });

    it("syncs the accordion display model with the bioontology results model", () => {
      const bioontology = state.connector.get("bioontology");
      const accordion = state.connector.get("accordion");

      bioontology.get("collection").add({
        prefLabel: "some label",
        definition: ["some definition"],
        hasChildren: false,
        "@id": "someId",
        subClassOf: ["some parent"],
      });

      state.connector.syncAccordion();

      const item = accordion.get("items").at(0);

      expect(item.get("title")).to.equal("some label");
      expect(item.get("description")).to.equal("some definition");
      expect(item.get("hasChildren")).to.equal(false);
      expect(item.get("itemId")).to.equal("someId");
      expect(item.get("parent")).to.equal("some parent");
      expect(item.get("content")).to.equal("");
      expect(item.get("id")).to.equal("someId");
    });

    it("switches the ontology in the bioontology model", () => {
      const bioontology = state.connector.get("bioontology");

      const newOntology = bioontology.get("collection").add({
        ontology: "XYZ",
        subTree: "Id-Class-3",
      });

      state.connector.switchOntology(newOntology);

      expect(bioontology.get("ontology")).to.equal("XYZ");
      expect(bioontology.get("subTree")).to.equal("Id-Class-3");
      expect(state.connector.get("accordionRoot")).to.equal("Id-Class-3");
    });
  });
});
