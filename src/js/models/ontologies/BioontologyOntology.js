"use strict";

define(["backbone"], (Backbone) => {
  /**
   * @class BioOntology
   * @classdesc This model represents an ontology from the BioPortal API, see
   * https://data.bioontology.org/documentation#Ontology
   * @classcategory Models/Ontologies
   * @since 2.31.0
   * @augments Backbone.Model
   */
  const BioOntology = Backbone.Model.extend({
    /** @lends BioOntology.prototype */

    type: "BioontologyOntology",

    /**
     * The default attributes for the BioOntology model. For definitions,
     * see https://data.bioontology.org/documentation
     * @returns {object} The default attributes
     */
    defaults() {
      return {
        acronym: "",
        name: "",
        administeredBy: "",
        flat: true,
        summaryOnly: true,
        ontologyType: "",
        submissions: [],
        projects: [],
        notes: [],
        reviews: [],
        provisionalClasses: [],
        subscriptions: [],
        group: "",
        viewingRestriction: "",
        doNotUpdate: "",
        hasDomain: "",
        acl: [],
        viewOf: "",
        views: [],
        include: ["name"],
        include_views: false,
        displayContext: false,
        displayLinks: false,
        apiKey: MetacatUI.appModel.get("bioportalAPIKey"),
        apiBaseURL: MetacatUI.appModel.get("bioportalApiBaseUrl"),
      };
    },

    /** @inheritdoc */
    url() {
      const ontologyId = this.get("acronym");
      const apikey =
        this.get("apiKey") || MetacatUI.appModel.get("bioportalAPIKey");
      const baseUrl =
        this.get("apiBaseURL") || MetacatUI.appModel.get("bioportalApiBaseUrl");
      const include = this.get("include")?.join(",") || "name";
      const paramStr = new URLSearchParams({
        apikey,
        include,
        include_views: this.get("include_views"),
        display_context: this.get("displayContext"),
        display_links: this.get("displayLinks"),
      }).toString();
      return `${baseUrl}/ontologies/${ontologyId}?${paramStr}`;
    },

    /** @inheritdoc */
    parse(response, _options) {
      const parsedResponse = response;
      parsedResponse.id = response?.acronym;
      return parsedResponse;
    },

    /** @returns {object} Attributes for a searchSelect option model */
    toSearchSelectOption() {
      return {
        label: this.get("name") || this.get("acronym"),
        description: this.get("definition")?.[0] || "",
        value: this.get("acronym"),
        // TODO: Add extras like ontology acronym & # results in catalog. Use to
        // populate a tooltip & description for the option item.
      };
    },
  });
  return BioOntology;
});
