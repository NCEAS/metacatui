"use strict";

define(["backbone", "collections/ontologies/BioontologyResults"], (
  Backbone,
  BioontologyResults,
) => {
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
     * @property {"children"|"search"|"ontology"} queryType - The type of query
     * to perform. Only "children", "search", and "ontology" are supported.
     * @property {string} searchTerm - The term to search for. Only used when
     * queryType is "search".
     * @property {BioontologyResults} collection - The collection classes
     * returned from the query.
     * @property {string} subTree - The class ID to get the children of. Only
     * used when queryType is "children". e.g.
     * http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType
     * @property {string} ontology - The ontology acronym to query. e.g. "ECSO"
     */
    defaults() {
      return {
        page: 1,
        pageCount: null,
        prevPage: null,
        nextPage: null,
        links: {},
        collection: new BioontologyResults(),
        apiKey: null,
        apiBaseURL: MetacatUI.appModel.get("bioportalApiBaseUrl"),
        subTree: "",
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
      const queryType = this.get("queryType");

      const subTree = this.encodeIfPresent(this.get("subTree"));
      const ontology = this.encodeIfPresent(this.get("ontology"));
      const searchTerm = this.encodeIfPresent(this.get("searchTerm"));

      let queryUrl = "";
      if (queryType === "children") {
        queryUrl = this.buildChildrenUrl(ontology, subTree);
      } else if (queryType === "search" && searchTerm) {
        queryUrl = this.buildSearchUrl(searchTerm, ontology, subTree);
      } else if (queryType === "ontology") {
        queryUrl = `/ontologies/${ontology}?`;
      }

      const paramStr = new URLSearchParams({
        apikey: this.get("apiKey"),
        pagesize: this.get("pageSize"),
        display_context: this.get("displayContext") === true,
        display_links: this.get("displayLinks") === true,
        include: this.getIncludeParam(queryType),
      }).toString();
      const root = this.get("apiBaseURL");
      return `${root}${queryUrl}${paramStr}`;
    },

    /**
     * Encode a value if it is exists
     * @param {string} value - The value to encode
     * @returns {string} The encoded value or null if the value is falsy
     */
    encodeIfPresent(value) {
      return value ? encodeURIComponent(value) : null;
    },

    /**
     * Construct the include url parameter for the BioPortal API
     * @param {string} queryType - The type of query to perform
     * @returns {string} The include parameter for the BioPortal API
     */
    getIncludeParam(queryType) {
      let include = this.get("include");
      if (queryType === "search") {
        // subClassOf and hasChildren does not work with search queries
        include = include.filter(
          (item) => item !== "subClassOf" && item !== "hasChildren",
        );
      }
      return include?.length ? include.join(",") : null;
    },

    /**
     * Build the URL component for a "children" query
     * @param {string} ontology - The ontology to query, encoded
     * @param {string} subTree - The subTree to query, encoded
     * @returns {string} The URL component for the query
     */
    buildChildrenUrl(ontology, subTree) {
      if (ontology) {
        return subTree
          ? `/ontologies/${ontology}/classes/${subTree}/children?`
          : `/ontologies/${ontology}/classes/roots?`;
      }
      return "";
    },

    /**
     * Build the URL component for a "search" query
     * @param {string} searchTerm - The search term, encoded
     * @param {string} ontology - The ontology to query, encoded
     * @param {string} subTree - The subTree to query, encoded
     * @returns {string} The URL component
     */
    buildSearchUrl(searchTerm, ontology, subTree) {
      let searchUrl = `/search?q=${searchTerm}*`;
      if (ontology) {
        searchUrl += `&ontologies=${ontology}&ontology=${ontology}`;
      }
      if (subTree) {
        searchUrl += `&subtree_root_id=${subTree}`;
      }
      return `${searchUrl}&`;
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

      const collection = this.get("collection") || new BioontologyResults();

      if (options.replaceCollection === true) {
        collection.reset(parsedResponse.collection, { parse: true });
      } else {
        collection.add(parsedResponse.collection, { parse: true });
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
  });

  return Bioontology;
});
