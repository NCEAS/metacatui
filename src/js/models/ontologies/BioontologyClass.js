"use strict";

define(["backbone"], (Backbone) => {
  /**
   * @class BioontologyClass
   * @classdesc This model is designed to handle ontology class data from the
   * BioPortal API. All attributes not documented here are detailed on the
   * BioPortal API docs: https://data.bioontology.org/documentation.
   * @classcategory Models/Ontologies
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const BioontologyClass = Backbone.Model.extend({
    /** @lends BioontologyClass.prototype */

    type: "BioontologyClass",

    /**
     * The default attributes for the OntologyClassModel. See also:
     * https://data.bioontology.org/documentation.
     * @returns {object} The default attributes for this model
     * @property {string} id - The unique identifier for the ontology class.
     * @property {string} prefLabel - The preferred label for the ontology class.
     * @property {string[]} definition - Definitions of the ontology class.
     * @property {string[]} synonym - Synonyms of the ontology class.
     * @property {boolean} obsolete - Indicates if the class is obsolete.
     * @property {string[]} subClassOf - An array of identifiers for parent classes in the ontology.
     * @property {object[]} parents - Detailed parent class information including identifiers and links.
     * @property {string[]} cui - Concept Unique Identifiers associated with the class.
     * @property {stringp[]} semanticType - Semantic types associated with the class.
     * @property {string} label - Label of the class (may be empty).
     * @property {string} prefixIRI - Prefix IRI if available.
     * @property {string} notation - Notation number associated with the class.
     * @property {string} xref - External reference identifiers.
     * @property {string} created - Creation date of the class entry.
     * @property {string} modified - Last modification date of the class entry.
     * @property {object} properties - Additional properties specific to the ontology class.
     * @property {string} '@id' - The unique identifier for the ontology class.
     * @property {string} '@type' - The type of the entity in RDF/OWL.
     * @property {object} links - A collection of links related to the ontology class for API interaction.
     * @property {object} '@context' - Context for understanding the property values and relations.
     * @property {Array} ancestors - An array of ancestor classes of the ontology class.
     * @property {Array} children - An array of child classes of the ontology class.
     * @property {Array} notes - Additional notes associated with the ontology class.
     * @property {number} childrenCount - The number of children of the ontology class.
     * @property {boolean} hasChildren - Boolean indicating whether the ontology class has children.
     */
    defaults() {
      return {
        id: "",
        prefLabel: "",
        definition: [],
        synonym: [],
        obsolete: false,
        subClassOf: [],
        parents: [],
        cui: [],
        semanticType: [],
        label: [],
        prefixIRI: null,
        notation: "",
        xref: null,
        created: null,
        modified: null,
        properties: {},
        "@id": "",
        "@type": "http://www.w3.org/2002/07/owl#Class",
        links: {
          self: "",
          ontology: "",
          children: "",
          parents: "",
          descendants: "",
          ancestors: "",
          instances: "",
          tree: "",
          notes: "",
          mappings: "",
          ui: "",
        },
        "@context": {
          "@vocab": "http://data.bioontology.org/metadata/",
          label: "http://www.w3.org/2000/01/rdf-schema#label",
          prefLabel: "http://www.w3.org/2004/02/skos/core#prefLabel",
          synonym: "http://www.w3.org/2004/02/skos/core#altLabel",
          definition: "http://www.w3.org/2004/02/skos/core#definition",
          obsolete: "http://www.w3.org/2002/07/owl#deprecated",
          notation: "http://www.w3.org/2004/02/skos/core#notation",
          prefixIRI: "http://data.bioontology.org/metadata/prefixIRI",
          parents: "http://www.w3.org/2000/01/rdf-schema#parents",
          subClassOf: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
          semanticType:
            "http://bioportal.bioontology.org/ontologies/umls/hasSTY",
          cui: "http://bioportal.bioontology.org/ontologies/umls/cui",
          xref: "http://www.geneontology.org/formats/oboInOwl#hasDbXref",
          created: "http://purl.org/dc/terms/created",
          modified: "http://purl.org/dc/terms/modified",
          "@language": "en",
        },
        ancestors: [],
        children: [],
        notes: [],
        childrenCount: 0,
        hasChildren: false,
      };
    },

    /** @inheritdoc */
    url() {
      // TODO: We could create a mechanism to fetch more info for a specific
      // class here.
    },

    /** @inheritdoc */
    parse(response, _options) {
      const parsedResponse = response;
      // Use the ontology ID as the model ID
      parsedResponse.id = response["@id"];
      return parsedResponse;
    },

    /**
     * Reformat for a searchSelect option
     * @returns {object} Attributes for a searchSelect option model
     */
    toSearchSelectOption() {
      return {
        label: this.get("prefLabel") || this.get("label") || this.get("@id"),
        description: this.get("definition")?.[0] || "",
        value: this.get("@id"),
        category: this.get("ontology") || "",
      };
    },

    /**
     * Reformat for an accordion item
     * @returns {object} Attributes for an accordion item model
     */
    toAccordionItem() {
      const title = this.get("prefLabel");
      const definitions = this.get("definition");
      const description = definitions?.length ? definitions[0] : "";
      const hasChildren = this.get("hasChildren");
      const itemId = this.get("@id");
      const parents = this.get("subClassOf");

      const content = hasChildren ? "loading..." : "";
      const parent = parents?.length ? parents[0] : "";

      return {
        title,
        description,
        hasChildren,
        itemId,
        parent,
        content,
        // ID needed to prevent re-adding existing items on sync
        id: itemId,
      };
    },
  });
  return BioontologyClass;
});
