"use strict";

define([
  "backbone",
  "models/ontologies/Bioontology",
  "models/accordion/Accordion",
  "models/searchSelect/SearchSelect",
], (Backbone, Bioontology, Accordion, SearchSelect) =>
  /**
   * @class BioontologyAccordionSearchSelect
   * @classdesc A model that handles the connection between the BioPortal API,
   * the Accordion model that holds the BioPortal search results for display,
   * and the SearchSelect model that determines which ontology to search.
   * Updating the selected ontology in the SearchSelect model will trigger a new
   * search for classes under the given ontology in the BioPortal API. When new
   * search results are fetched, the Accordion model is updated with the new
   * search results formatted for display in an accordion. When a class is
   * selected in the Accordion, this model also tracks the selected ontology and
   * class for use in other parts of the application. This model is used for the
   * BioontologyBrowser view.
   * @name  BioontologyAccordionSearchSelect
   * @augments Backbone.Model
   * @class
   * @classcategory Models/Connectors
   * @since 0.0.0
   */
  Backbone.Model.extend(
    /** @lends  BioontologyAccordionSearchSelect.prototype */ {
      /**
       * @inheritdoc
       */
      defaults() {
        return {
          bioontology: null,
          accordion: null,
          searchSelect: null,
          selectedClass: null,
          originalOntologyRoot: null,
          // TODO: Test if this default works for all cases
          defaultSubtree: "http://www.w3.org/2002/07/owl#Thing",
          ontologyOptions: [
            {
              label: "Measurement Type",
              ontology: "ECSO",
              subTree:
                "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType",
            },
          ],
        };
      },

      /** @inheritdoc */
      initialize(attributes, _options) {
        const ontologyOptions =
          attributes?.ontologyOptions || this.defaults().ontologyOptions;

        const updatedOntologyOptions = ontologyOptions.map((option, index) => ({
          ...option,
          value: `ontology-${index}`,
        }));
        const firstOntology = updatedOntologyOptions[0];

        this.set(
          "bioontology",
          new Bioontology({
            ontology: firstOntology.ontology,
            subTree: firstOntology.subTree,
          }),
        );
        this.get("bioontology").fetch();
        this.set(
          "accordion",
          new Accordion({
            onOpening: this.fetchChildren.bind(this),
            onChanging: this.selectSelectedClass.bind(this),
            items: [{ title: "loading..." }], // TODO
          }),
        );
        this.set(
          "searchSelect",
          new SearchSelect({
            buttonStyle: true,
            icon: "sitemap",
            allowMulti: false,
            allowAdditions: false,
            clearable: false,
            selected: [firstOntology.value],
            inputLabel: "Browse for an ontology or class",
            options: updatedOntologyOptions,
          }),
        );

        this.set(
          "originalRoot",
          this.get("bioontology").get("subTree") || this.get("defaultSubtree"),
        );

        this.connect();
      },

      /**
       * Connects the three models together. When the bioontology results change,
       * the accordion display model is updated to reflect the new results. When
       * the selected ontology model changes in the searchSelect, the bioontology
       * model is updated to reflect the new ontology.
       */
      connect() {
        this.listenTo(
          this.get("bioontology").get("collection"),
          "update reset",
          this.syncAccordion,
        );
        this.listenTo(
          this.get("searchSelect"),
          "change:selected",
          (model, _selected) => {
            const ontology = model.getSelectedModels()[0];
            this.switchOntology(ontology);
          },
        );
      },

      /**
       * Fetches the children of an ontology class from the BioPortal API.
       * @param {Backbone.Model} itemModel - The model of the ontology class to
       * fetch children for.
       */
      fetchChildren(itemModel) {
        if (itemModel.get("hasChildren") && !itemModel.get("childrenFetched")) {
          const classId = itemModel.get("itemId");
          this.get("bioontology").getChildren(classId);
          itemModel.set("childrenFetched", true);
        }
      },

      /**
       * Selects a class in the accordion and sets the selectedClass attribute
       * in this connector to the selected class.
       * @param {Backbone.Model} itemModel - The model of the selected class.
       */
      selectSelectedClass(itemModel) {
        const ontologyId = itemModel.get("itemId");

        const ontClass = this.get("bioontology")
          .get("collection")
          .find((cls) => cls.get("@id") === ontologyId);
        this.set("selectedClass", ontClass);
      },

      /**
       * Syncs the accordion display model with the bioontology results model.
       * This method is called when the bioontology results model changes.
       */
      syncAccordion() {
        const data = this.get("bioontology")
          .get("collection")
          .map((cls) => this.ontologyClassToAccordionItem(cls));
        this.get("accordion").get("items").set(data);
      },

      /**
       * Converts an ontology class model to an accordion item model.
       * @param {Backbone.Model} cls - The ontology class model to convert.
       * @returns {object} Attributes for an accordion item model.
       */
      ontologyClassToAccordionItem(cls) {
        const root = this.get("originalRoot");
        const title = cls.get("prefLabel");
        const definitions = cls.get("definition");
        const description = definitions?.length ? definitions[0] : "";
        const hasChildren = cls.get("hasChildren");
        const itemId = cls.get("@id");
        const parents = cls.get("subClassOf");

        const content = hasChildren ? "loading..." : "";
        let parent = parents?.length ? parents[0] : "";
        parent = parent === root ? "" : parent;

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

      /**
       * Switches the ontology in the bioontology model to the selected ontology
       * and fetches the new ontology classes.
       * @param {Backbone.Model} newOntology - The selected ontology model, with
       * ontology and subTree attributes.
       */
      switchOntology(newOntology) {
        const bioontology = this.get("bioontology");
        const newOntologyName = newOntology.get("ontology");
        const newSubtree = newOntology.get("subTree");

        bioontology.resetPageInfo();
        bioontology.set("ontology", newOntologyName);
        bioontology.set("subTree", newSubtree);
        this.set("originalRoot", newSubtree || this.get("defaultSubtree"));
        bioontology.fetch({ replaceCollection: true });
      },
    },
  ));
