"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/ontologies/Bioontology",
], (cleanState, Bioontology) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("Bioontology Test Suite ☎️", () => {
    const state = cleanState(() => {
      const ontology = new Bioontology({
        queryField: "children",
      });
      return { ontology };
    }, beforeEach);

    it("creates a Bioontology instance", () => {
      state.ontology.should.be.instanceof(Bioontology);
    });

    it("creates a collection for the Bioontology classes", () => {
      state.ontology
        .get("collection")
        .should.be.instanceof(Backbone.Collection);
    });

    it("forms valid search URLs", () => {
      state.ontology.set({
        apiBaseURL: "https://base.url",
        apiKey: "key",
        queryType: "search",
        pageSize: 10,
        displayContext: true,
        displayLinks: true,
        subTree: "subTree",
        ontology: "ontology",
        include: ["prefLabel", "definition"],
        searchTerm: "searchTerm",
      });
      const url = state.ontology.url();
      const expectedUrl =
        "https://base.url/search?q=searchTerm*&ontologies=ontology&ontology=ontology&subtree_root_id=subTree&apikey=key&pagesize=10&display_context=true&display_links=true&include=prefLabel%2Cdefinition";
      url.should.equal(expectedUrl);
    });

    it("forms valid children URLs", () => {
      state.ontology.set({
        apiBaseURL: "https://base.url",
        apiKey: "key",
        queryType: "children",
        pageSize: 99,
        displayContext: false,
        displayLinks: false,
        subTree: "subTree",
        ontology: "ontology",
        include: ["prefLabel", "definition"],
        searchTerm: "searchTerm",
      });
      const url = state.ontology.url();
      const expectedUrl =
        "https://base.url/ontologies/ontology/classes/subTree/children?apikey=key&pagesize=99&display_context=false&display_links=false&include=prefLabel%2Cdefinition";
      url.should.equal(expectedUrl);
    });

    it("parses the response correctly", () => {
      const response = {
        collection: [{ "@id": 1 }, { "@id": 2 }],
      };
      const options = { replaceCollection: true };
      const parsed = state.ontology.parse(response, options);
      const json = parsed.collection.toJSON();
      json[0].id.should.equal(1);
      json[1].id.should.equal(2);
    });
  });
});
