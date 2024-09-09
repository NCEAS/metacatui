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
     * Initialize the Bioontology mode
     * @param {object} attributes - The model attributes
     * @param {string} attributes.apiKey - An alternative API key to use. If not
     * set, the appModel's API key will be used.
     * @param {object} _options - The options object
     */
    initialize(attributes, _options) {
      // Fall back to the appModel's API key if one is not provided
      if (!attributes.apiKey && !this.get("apiKey")) {
        this.set("apiKey", MetacatUI.appModel.get("bioportalAPIKey"));
      }
    },

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
        subTree: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType",
        ontology: "ECSO",
        pageSize: 500,
        displayContext: false,
        displayLinks: false,
        include: ["prefLabel", "definition", "subClassOf", "hasChildren"],
        queryType: "children",
        searchTerm: "",
      };
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
        include = include.filter((item) => item !== "subClassOf" && item !== "hasChildren");
      }
      include = include?.length ? include.join(",") : null;
      include = include ? encodeURIComponent(include) : null;

      let searchTerm = this.get("searchTerm");
      searchTerm = searchTerm ? encodeURIComponent(searchTerm) : null;

      let url = `${root}`;

      if (queryType === "children" && subTree && ontology) {
        url += `/ontologies/${ontology}/classes/${subTree}/children?`;

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
      const collection = this.get("collection");
      if (options.replaceCollection === true) {
        collection.reset(response.collection);
      } else {
        collection.add(response.collection);
      }
      response.collection = collection;
      return response;
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

  });

  return Bioontology;

});