"use strict";

define(["backbone", "models/ontologies/BioontologyClass"], (
  Backbone,
  BioontologyClass,
) => {
  /**
   * @class BioontologyBatch
   * @classdesc A model that fetches data from the BioPortal API using the batch
   * endpoint. This can be used to store data about classes that have been
   * fetched from BioPortal, and to fetch additional classes as needed.
   * @classcategory Models/Ontologies
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const BioontologyBatch = Backbone.Model.extend({
    /** @lends BioontologyBatch.prototype */

    /**
     * The default attributes for this model. All attributes not documented here
     * are detailed on the BioPortal API docs:
     * https://data.bioontology.org/documentation.
     * @returns {object} The default attributes for this model
     * @property {Backbone.Collection} collection - The collection of classes
     * fetched from BioPortal
     * @property {string} apiKey - The API key to use for requests to BioPortal.
     * If not set, the appModel's API key will be used.
     * @property {string} apiBaseURL - The base URL for the BioPortal API.
     * @property {string} ontologyPrefix - A string to prepend to ontology
     * acronyms to form the full ontology ID for batch requests.
     * @property {string[]} ontologies - The ontologies to search for classes
     * in, in order of priority. Only the acronyms are needed.
     * @property {string[]} include - The fields to include in the response.
     * @property {string[]} classesToFetch - The classes (classIds) to fetch
     * from BioPortal.
     */
    defaults() {
      return {
        collection: new Backbone.Collection([], { model: BioontologyClass }),
        apiKey: null,
        apiBaseURL: "https://data.bioontology.org",
        ontologyPrefix: "http://data.bioontology.org/ontologies/",
        ontologies: [
          "ECSO",
          "SENSO",
          "SALMON",
          "ADCAD",
          "MOSAIC",
          "SASAP",
          "ARCRC",
        ],
        include: ["prefLabel", "definition", "subClassOf", "hasChildren"],
        classesToFetch: [],
      };
    },

    /**
     * Initialize the Bioontology mode
     * @param {object} attributes - The model attributes
     * @param {string} attributes.apiKey - An alternative API key to use. If not
     * set, the appModel's API key will be used.
     * @param {object} _options - The options object
     */
    initialize(attributes, _options) {
      // Fall back to the appModel's API key if one is not provided
      if (!attributes?.apiKey && !this.get("apiKey")) {
        this.set("apiKey", MetacatUI.appModel.get("bioportalAPIKey"));
      }
    },

    /** @inheritdoc */
    url() {
      return `${this.get("apiBaseURL")}/batch`;
    },

    /**
     * Add classes from a response to the collection. This method is async and
     * will return a promise that resolves when the collection has been updated.
     * @param {object} response - The response from the BioPortal API
     * @returns {Promise<void>} A promise that resolves when the collection has
     * been updated
     */
    async addClassesFromResponse(response) {
      const collection = this.get("collection");
      const parsedResponse = Object.values(response).flat();
      const updated = new Promise((resolve) => {
        this.listenToOnce(this.get("collection"), "update", resolve);
      });
      collection.add(parsedResponse, { parse: true });
      return updated;
    },

    /**
     * Create a payload for a batch request to the BioPortal API.
     * @param {string[]} classes - The classes to fetch
     * @param {string} ontology - The ontology to search in
     * @returns {string} The JSON stringified payload
     */
    createBatchPayload(classes, ontology) {
      const payload = {
        "http://www.w3.org/2002/07/owl#Class": {
          collection: classes.map((cls) => ({
            class: cls,
            ontology: `${this.get("ontologyPrefix")}${ontology}`,
          })),
          display: this.get("include")?.join(",") || "prefLabel,definition",
        },
      };
      return JSON.stringify(payload);
    },

    /**
     * Create the headers for a request to the BioPortal API.
     * @returns {object} The headers object
     * @property {string} Content-Type - The content type of the request
     * @property {string} Authorization - The authorization header with the API
     * key
     */
    createHeaders() {
      return {
        "Content-Type": "application/json",
        Authorization: `apikey token=${this.get("apiKey")}`,
      };
    },

    /**
     * If some of the classes to fetch are already in the collection, remove
     * them from the list of classes to fetch.
     */
    filterClassesToFetch() {
      const classesToFetch = this.get("classesToFetch");
      const collection = this.get("collection");
      const existingClasses = collection.pluck("@id");
      this.set(
        "classesToFetch",
        classesToFetch.filter((cls) => !existingClasses.includes(cls)),
      );
    },

    /**
     * Make a batch request for a given set of classes and a single ontology.
     * @param {string[]} classes - The classes to fetch
     * @param {string} ontology - The ontology to search in
     * @returns {Promise<object>} A promise that resolves to the response from
     * the BioPortal API
     */
    async fetchClassesFromOntology(classes, ontology) {
      try {
        const payload = this.createBatchPayload(classes, ontology);
        const response = await fetch(this.url(), {
          method: "POST",
          headers: this.createHeaders(),
          body: payload,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        this.recordError(error);
        return null;
      }
    },

    /**
     * Record an error that occurred during the fetch process.
     * @param {Error} error - The error that occurred
     */
    recordError(error) {
      const currentErrors = this.get("errors") || [];
      this.set("errors", [...currentErrors, error]);
    },

    /**
     * Move the classes that were not found to the list of classes not found. This
     * should be called after all classes have been fetched.
     */
    moveClassesToNotFound() {
      const classesNotFound = this.get("classesNotFound") || [];
      const leftOverClasses = this.get("classesToFetch") || [];
      this.set("classesNotFound", [...classesNotFound, ...leftOverClasses]);
      this.set("classesToFetch", []);
    },

    /**
     * Wait for the fetch process to complete. This will return a promise that
     * resolves when the fetch process is complete.
     * @returns {Promise<boolean>} A promise that resolves to true if the fetch
     * process is complete, and false if it is not complete
     */
    async waitForFetchComplete() {
      if (this.get("status") === "fetching") {
        await new Promise((resolve) => {
          this.listenToOnce(this, "fetchComplete", resolve);
        });
        return true;
      }
      return false;
    },

    /**
     * Initialize the fetch process. This will set the status to "fetching" and
     * set the list of classes to fetch to the provided classes.
     * @param {string[]} classes - The classes to fetch
     */
    initializeFetch(classes) {
      this.set("status", "fetching");
      const leftOverClasses = this.get("classesToFetch");
      this.set("classesNotFound", leftOverClasses);
      this.set("classesToFetch", classes);
      this.filterClassesToFetch();
    },

    /**
     * Fetch classes from the BioPortal API. This method is async and will
     * return a promise that resolves when the classes have been fetched.
     * @returns {Promise<object[]>} A promise that resolves to an array of
     * objects containing the classes fetched from BioPortal
     */
    async fetchFromOntologies() {
      const ontologies = this.get("ontologies");
      const responses = [];

      ontologies.forEach(async (ontology) => {
        const classesToFetch = this.get("classesToFetch");
        if (!classesToFetch.length) {
          return;
        }

        const response = await this.fetchClassesFromOntology(
          classesToFetch,
          ontology,
        ).catch((error) => {
          this.recordError(error);
          return null;
        });
        if (response) {
          responses.push(response);
          await this.addClassesFromResponse(response);
          // Update the list of classes to fetch based on what was found
          this.filterClassesToFetch();
        }
      });

      return responses;
    },

    /**
     * Finalize the fetch process. This will set the status to "fetched" and
     * trigger the "fetchComplete" event.
     */
    finalizeFetch() {
      this.moveClassesToNotFound();
      this.set("status", "fetched");
      this.trigger("fetchComplete");
    },

    /**
     * Fetch classes from the BioPortal API. This method is async and will
     * return a promise that resolves when the classes have been fetched.
     * @param {string[]} classes - The classes to fetch
     * @returns {Promise<Backbone.Model[]>} A promise that resolves to an array
     * of Backbone models
     */
    async fetchClasses(classes) {
      try {
        if (await this.waitForFetchComplete()) {
          return this.fetchClasses(classes);
        }
        this.initializeFetch(classes);
        const responses = await this.fetchFromOntologies();
        return responses.flatMap((response) =>
          response ? response.classes : [],
        );
      } catch (error) {
        this.recordError(error);
        return [];
      } finally {
        this.finalizeFetch();
      }
    },

    /**
     * Gets the models for given classes. For classes that exist already, the
     * model will be fetched from the collection. For classes that do not exist
     * yet, the bioportal API will be queried. The promise will resolve when all
     * models have been fetched.
     * @param {string[]} classes - The classes to fetch
     * @returns {Promise<Backbone.Model[]>} A promise that resolves to an array
     * of Backbone models
     */
    async getClasses(classes) {
      const existingClasses = this.getCachedClasses(classes);
      const newClasses = await this.fetchClasses(classes);
      return [...existingClasses, ...newClasses];
    },

    /**
     * Get the models for classes that have already been fetched from BioPortal.
     * @param {string[]} classes - The classes to get models for
     * @returns {Backbone.Model[]} The models for the classes that have already
     * been fetched
     */
    getCachedClasses(classes) {
      const collection = this.get("collection");
      const models = [];
      classes.forEach((cls) => {
        const model = collection.get(cls);
        if (model) {
          models.push(model);
        }
      });
      return models;
    },
  });

  return BioontologyBatch;
});
