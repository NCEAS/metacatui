"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/connectors/Bioontology-Accordion-SearchSelect",
], (cleanState, Connector) => {
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
      const testItem = new Backbone.Model({
        "@id": "someId",
      });

      state.connector.get("bioontology").get("collection").add(testItem);

      // Select the item
      state.connector.selectSelectedClass(
        new Backbone.Model({
          itemId: "someId",
        }),
      );

      expect(state.connector.get("selectedClass")).to.equal(testItem);
    });

    it("syncs the accordion display model with the bioontology results model", () => {
      const bioontology = state.connector.get("bioontology");
      const accordion = state.connector.get("accordion");

      const cls = new Backbone.Model({
        prefLabel: "some label",
        definition: ["some definition"],
        hasChildren: false,
        "@id": "someId",
        subClassOf: ["some parent"],
      });

      bioontology.get("collection").add(cls);

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

    it("converts an ontology class model to an accordion item model", () => {
      const cls = new Backbone.Model({
        prefLabel: "some label",
        definition: ["some definition"],
        hasChildren: false,
        "@id": "someId",
        subClassOf: ["some parent"],
      });

      const item = state.connector.ontologyClassToAccordionItem(cls);

      expect(item.title).to.equal("some label");
      expect(item.description).to.equal("some definition");
      expect(item.hasChildren).to.equal(false);
      expect(item.itemId).to.equal("someId");
      expect(item.parent).to.equal("some parent");
      expect(item.content).to.equal("");
      expect(item.id).to.equal("someId");
    });

    it("switches the ontology in the bioontology model", () => {
      const bioontology = state.connector.get("bioontology");

      const newOntology = new Backbone.Model({
        ontology: "XYZ",
        subTree: "Id-Class-3",
      });

      state.connector.switchOntology(newOntology);

      expect(bioontology.get("ontology")).to.equal("XYZ");
      expect(bioontology.get("subTree")).to.equal("Id-Class-3");
      expect(state.connector.get("originalRoot")).to.equal("Id-Class-3");
    });
  });
});
