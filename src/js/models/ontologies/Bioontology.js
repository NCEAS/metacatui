"use strict";

define(["backbone"], (Backbone) => {
  /**
   * @class Bioontology
   * @classdesc A model that fetches data from the BioPortal API for a given
   * ontology.
   * @classcategory Models/Ontologies
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const Bioontology = Backbone.Model.extend({
    /** @lends Bioontology.prototype */

    /**
     * The default attributes for this model. All attributes not documented here
     * are detailed on the BioPortal API docs:
     * https://data.bioontology.org/documentation.
     * @returns {object} The default attributes for this model
     * @property {"children"|"search"} queryType - The type of query to perform.
     * Only "children" and "search" are supported.
     * @property {string} searchTerm - The term to search for. Only used when
     * queryType is "search".
     */
    defaults() {
      return {
        page: 1,
        pageCount: null,
        prevPage: null,
        nextPage: null,
        links: {},
        collection: new Backbone.Collection(),
        apiKey: null,
        apiBaseURL: "https://data.bioontology.org",
        subTree:
          "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType",
        ontology: "ECSO",
        pageSize: 500,
        displayContext: false,
        displayLinks: false,
        include: ["prefLabel", "definition", "subClassOf", "hasChildren"],
        queryType: "children",
        searchTerm: "",
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
      const root = this.get("apiBaseURL");
      const key = this.get("apiKey");
      const queryType = this.get("queryType");
      const pageSize = this.get("pageSize");
      const displayContext = this.get("display_context");
      const displayLinks = this.get("display_links");

      let subTree = this.get("subTree");
      subTree = subTree ? encodeURIComponent(subTree) : null;

      let ontology = this.get("ontology");
      ontology = ontology ? encodeURIComponent(ontology) : null;

      let include = this.get("include");
      // subClassOf and hasChildren does not work with search queries
      if (queryType === "search") {
        include = include.filter(
          (item) => item !== "subClassOf" && item !== "hasChildren",
        );
      }
      include = include?.length ? include.join(",") : null;
      include = include ? encodeURIComponent(include) : null;

      let searchTerm = this.get("searchTerm");
      searchTerm = searchTerm ? encodeURIComponent(searchTerm) : null;

      let url = `${root}`;

      if (queryType === "children" && ontology) {
        url += `/ontologies/${ontology}/classes/`;
        if (subTree) {
          url += `${subTree}/children`;
        } else {
          url += `roots`;
        }
        url += `?`;
      } else if (queryType === "search" && searchTerm) {
        url += `/search?q=${searchTerm}*`;
        if (ontology) {
          url += `&ontologies=${ontology}`;
          url += `&ontology=${ontology}`;
        }
        if (subTree) {
          url += `&subtree_root_id=${subTree}`;
        }
      }

      url += `&apikey=${key}`;

      if (pageSize) url += `&pagesize=${pageSize}`;
      if (displayContext === false) url += `&display_context=false`;
      if (displayLinks === false) url += `&display_links=false`;
      if (include) url += `&include=${include}`;

      return url;
    },

    /**
     * Parse the response from the BioPortal API
     * @param {object} response - The response from the BioPortal API
     * @param {object} options - The options object
     * @param {boolean} options.replaceCollection - Whether to replace the
     * collection or add to it. Adds to it by default.
     * @returns {object} The parsed response
     */
    parse(response, options) {
      let parsedResponse = response;

      // when querying for the "roots" (no subTree) of an ontology, the
      // collection is the response itself
      if (!parsedResponse.collection) {
        parsedResponse = {
          collection: response,
        };

        // In this case, there is also no returned pagination info.
        // Ensure any previous pagination info is reset to defaults.
        this.resetPageInfo();
      }

      const collection = this.get("collection");

      if (options.replaceCollection === true) {
        collection.reset(parsedResponse.collection);
      } else {
        collection.add(parsedResponse.collection);
      }
      parsedResponse.collection = collection;
      return parsedResponse;
    },

    /**
     * Fetch the next page of results from the BioPortal API and add them to the
     * collection
     */
    getNextPage() {
      const nextPage = this.get("nextPage");
      if (nextPage) {
        this.set("page", nextPage);
        this.fetch();
      }
    },

    /**
     * Get the children of a given class ID and add them to the collection
     * @param {string} classId - The class ID to get the children of
     */
    getChildren(classId) {
      this.set("subTree", classId);
      this.set("queryType", "children");
      this.fetch();
    },

    /**
     * Clears the pagination info that has been fetched from the BioPortal API
     */
    resetPageInfo() {
      const defaults = this.defaults();
      const pageAttrs = ["page", "pageCount", "prevPage", "nextPage"];
      pageAttrs.forEach((attr) => this.set(attr, defaults[attr]));
    },

    /**
     * Queries the BioPortal API for the label of an arbitrary ontology or
     * class.
     * @param {string} acronym - The ontology acronym
     * @param {string} [subTree] - The class ID, if querying for a class
     * @returns {Promise<string>} A promise that resolves to the label of the
     * ontology or class
     */
    async fetchOntologyLabel(acronym, subTree) {
      let url = `${this.get("apiBaseURL")}/ontologies/${acronym}`;

      if (subTree) {
        url += `/classes/${encodeURIComponent(subTree)}`;
      }

      const params = {
        apikey: this.get("apiKey"),
        include: "name,prefLabel",
        include_views: false,
        display_context: false,
        display_links: false,
      };

      url += `?${new URLSearchParams(params).toString()}`;

      return fetch(url)
        .then((response) => response.json())
        .then((data) => data)
        .then((data) => data.name || data.prefLabel);
    },
  });

  return Bioontology;
});
