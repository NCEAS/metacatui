"use strict";

define([
  "/test/js/specs/shared/clean-state.js",
  "models/ontologies/BioontologyBatch",
], (cleanState, Bioontology) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("Bioontology Batch Test Suite", () => {
    const state = cleanState(() => {
      const ontologyBatch = new Bioontology({
        queryField: "children",
      });
      return { ontologyBatch };
    }, beforeEach);

    it("creates a BioontologyBatch instance", () => {
      state.ontologyBatch.should.be.instanceof(Bioontology);
    });

    it("creates a collection for the Bioontology classes", () => {
      state.ontologyBatch
        .get("collection")
        .should.be.instanceof(Backbone.Collection);
    });

    it("the Bioontology collection has models of type BioontologyClass", () => {
      const collection = state.ontologyBatch.get("collection");
      const newModel = collection.add({ "@id": "class1" });
      newModel.type.should.equal("BioontologyClass");
    });

    it("forms valid search URLs", () => {
      state.ontologyBatch.set("apiBaseURL", "https://baseurl.com");
      const url = state.ontologyBatch.url();
      url.should.equal("https://baseurl.com/batch");
    });

    it("creates a payload for a batch request", () => {
      state.ontologyBatch.set("include", ["prefLabel", "definition"]);
      const payload = state.ontologyBatch.createBatchPayload(
        ["class1", "class2"],
        "ontology",
      );
      const expectedPayload = {
        "http://www.w3.org/2002/07/owl#Class": {
          collection: [
            {
              class: "class1",
              ontology: "http://data.bioontology.org/ontologies/ontology",
            },
            {
              class: "class2",
              ontology: "http://data.bioontology.org/ontologies/ontology",
            },
          ],
          display: "prefLabel,definition",
        },
      };
      JSON.parse(payload).should.deep.equal(expectedPayload);
    });

    it("creates headers for a request", () => {
      state.ontologyBatch.set("apiKey", "key");
      const headers = state.ontologyBatch.createHeaders();
      headers.should.deep.equal({
        "Content-Type": "application/json",
        Authorization: "apikey token=key",
      });
    });

    it("filters classes to fetch", () => {
      state.ontologyBatch.set({
        classesToFetch: ["class1", "class2"],
        collection: new Backbone.Collection([{ "@id": "class1" }]),
      });
      state.ontologyBatch.filterClassesToFetch();
      state.ontologyBatch.get("classesToFetch").should.deep.equal(["class2"]);
    });

    it("records errors", () => {
      state.ontologyBatch.recordError("error");
      state.ontologyBatch.get("errors").should.deep.equal(["error"]);
    });

    it("moves classes to not found", () => {
      state.ontologyBatch.set({
        classesNotFound: ["term1"],
        classesToFetch: ["term2"],
      });
      state.ontologyBatch.moveClassesToNotFound();
      state.ontologyBatch
        .get("classesNotFound")
        .should.deep.equal(["term1", "term2"]);
      state.ontologyBatch.get("classesToFetch").should.deep.equal([]);
    });

    it("waits for fetch complete", async () => {
      state.ontologyBatch.set("status", "fetching");
      const promise = state.ontologyBatch.waitForFetchComplete();
      state.ontologyBatch.trigger("fetchComplete");
      const result = await promise;
      result.should.be.true;
    });

    it("finalizes fetch", () => {
      state.ontologyBatch.finalizeFetch();
      state.ontologyBatch.get("status").should.equal("fetched");
    });

    it("gets cached classes", () => {
      state.ontologyBatch
        .get("collection")
        .add({ "@id": "class2" }, { parse: true });
      const models = state.ontologyBatch.getCachedClasses(["class1", "class2"]);
      models.should.have.lengthOf(1);
      models[0].get("@id").should.equal("class2");
    });
  });
});
