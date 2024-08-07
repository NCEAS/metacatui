"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/ontologies/Bioontology",
], (cleanState, Bioontology) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("Bioontology Test Suite", () => {
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
      state.ontology.get("collection").should.be.instanceof(Backbone.Collection);
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
      })
      const url = state.ontology.url();
      url.should.equal("https://base.url/search?q=searchTerm*&ontologies=ontology&ontology=ontology&subtree_root_id=subTree&apikey=key&pagesize=10&include=prefLabel%2Cdefinition");
    });

    if("forms valid children URLs", () => {
      state.ontology.set({
        apiBaseURL: "https://base.url",
        apiKey: "key",
        queryType: "children",
        pageSize: 10,
        displayContext: true,
        displayLinks: true,
        subTree: "subTree",
        ontology: "ontology",
        include: ["prefLabel", "definition"],
        searchTerm: "searchTerm",
      })
      const url = state.ontology.url();
      url.should.equal("https://base.url/ontologies/ontology/classes/subTree/children?apikey=key&pagesize=10&display_context=true&display_links=true&include=prefLabel%2Cdefinition");
    });

    it("parses the response correctly", () => {
      const response = {
        collection: [{ "@id": 1 }, { "@id": 2 }],
      };
      const options = { replaceCollection: true };
      const parsed = state.ontology.parse(response, options);
      parsed.collection.toJSON().should.deep.equal([{ "@id": 1 }, { "@id": 2 }]);
    });

  });
});
