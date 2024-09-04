"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/ontologies/BioontologyOntology",
], (cleanState, BioontologyOntology) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("BioontologyOntology Test Suite", () => {
    const state = cleanState(() => {
      const ontology = new BioontologyOntology({
        queryField: "children",
      });
      return { ontology };
    }, beforeEach);

    it("creates a BioontologyOntology instance", () => {
      state.ontology.should.be.instanceof(BioontologyOntology);
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
        "https://base.url/ontologies/?apikey=key&include=prefLabel%2Cdefinition&include_views=false&display_context=true&display_links=true";
      url.should.equal(expectedUrl);
    });

    it("uses the ontology id as the model id", () => {
      const response = { acronym: "id" };
      const parsedResponse = state.ontology.parse(response);
      parsedResponse.id.should.equal("id");
    });

    it("returns search select options", () => {
      state.ontology.set({
        name: "name",
        acronym: "acronym",
        definition: ["definition"],
      });
      const searchSelectOption = state.ontology.toSearchSelectOption();
      searchSelectOption.label.should.equal("name");
      searchSelectOption.description.should.equal("definition");
      searchSelectOption.value.should.equal("acronym");
    });
  });
});
