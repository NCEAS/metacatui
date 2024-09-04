"use strict";

define([
  "backbone",
  "models/ontologies/Bioontology",
  "models/accordion/Accordion",
  "models/searchSelect/SearchSelect",
], (Backbone, Bioontology, Accordion, SearchSelect) =>
  /**
   * @class BioontologyAccordionSearchSelect
   * @classdesc Manages interactions between the BioPortal API and UI components.
   * It connects the SearchSelect model, which specifies the ontology for querying,
   * with the Accordion model that displays the search results. Changes in the selected
   * ontology trigger a new search, updating the Accordion with formatted results.
   * This model also tracks selected ontology classes for use across the application,
   * primarily in the BioontologyBrowser view.
   * @name  BioontologyAccordionSearchSelect
   * @augments Backbone.Model
   * @class
   * @classcategory Models/Connectors
   * @since 0.0.0
   */
  Backbone.Model.extend(
    /** @lends  BioontologyAccordionSearchSelect.prototype */ {
      /**
       * Default model attributes
       * @type {object}
       * @property {Bioontology} bioontology - The Bioontology model
       * @property {Accordion} accordion - The Accordion model
       * @property {SearchSelect} searchSelect - The SearchSelect model
       * @property {BioontologyClass} selectedClass - The selected ontology class
       * @property {string} accordionRoot - The root-level ontology or subtree when
       * the Bioontology model is first fetched (can change when searching subtrees).
       * @property {string} defaultSubtree - The default subtree to display when
       * if no subtree is specified in the ontology options.
       * @property {Array} ontologyOptions - An array of objects specifying the
       * ontologies to choose from in the SearchSel
       */
      defaults() {
        return {
          bioontology: null,
          accordion: null,
          searchSelect: null,
          selectedClass: null,
          accordionRoot: null,
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
      initialize(attrs, _options) {
        // Each ontology needs a unique value for the searchSelect component
        const defaults = this.defaults();
        const ontologyOptions =
          attrs?.ontologyOptions || defaults.ontologyOptions;
        const updatedOntologyOptions = ontologyOptions.map((option, index) => ({
          ...option,
          value: `ontology-${index}`,
        }));
        const firstOntology = updatedOntologyOptions[0] || {};
        const firstOntologyValue = firstOntology.value || "";

        this.setupBioontology(firstOntology);
        this.setupAccordion();
        this.setupSearchSelect(updatedOntologyOptions, firstOntologyValue);
        this.setAccordionRoot();
        this.connect();
      },

      /**
       * Sets up the Bioontology model with the first ontology and fetches the
       * ontology classes.
       * @param {object} firstOntology - The first ontology object in the
       * ontologyOptions array.
       */
      setupBioontology(firstOntology) {
        const bioontology = new Bioontology({
          ontology: firstOntology.ontology,
          subTree: firstOntology.subTree,
        });
        this.set("bioontology", bioontology);
      },

      /**
       * Sets up the Accordion model with the first ontology and fetches the
       * ontology classes.
       */
      setupAccordion() {
        const accordion = new Accordion({
          onOpening: this.fetchChildren.bind(this),
          onChanging: this.setSelectedClass.bind(this),
          items: [{ title: "loading..." }],
        });
        this.set("accordion", accordion);
      },

      /**
       * Sets up the SearchSelect model with the ontology options and the first
       * ontology.
       * @param {object[]} options - An array of ontology options objects to
       * populate a search select model.
       * @param {string} selected - The value of the first ontology to select.
       */
      setupSearchSelect(options, selected) {
        const searchSelect = new SearchSelect({
          buttonStyle: true,
          icon: "sitemap",
          allowMulti: false,
          allowAdditions: false,
          clearable: false,
          selected: [selected],
          inputLabel: "Browse for an ontology or class",
          options,
        });
        this.set("searchSelect", searchSelect);
      },

      /**
       * Sets the accordionRoot attribute to the root ontology or subtree when
       * the Bioontology model is first fetched.
       * @param {string} [subTree] - The root ontology or subtree. If not
       * provided, current subTree of the Bioontology model is used or the
       * default subtree.
       */
      setAccordionRoot(subTree) {
        const root =
          subTree ||
          this.get("bioontology").get("subTree") ||
          this.get("defaultSubtree");
        this.set("accordionRoot", root);
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
      setSelectedClass(itemModel) {
        const ontologyId = itemModel.get("itemId");
        const ontClass = this.get("bioontology")
          .get("collection")
          .get(ontologyId);
        this.set("selectedClass", ontClass);
      },

      /**
       * Syncs the accordion display model with the bioontology results model.
       * This method is called when the bioontology results model changes.
       */
      syncAccordion() {
        const root = this.get("accordionRoot");
        const ontologyResults = this.get("bioontology").get("collection");
        const data = ontologyResults.classesToAccordionItems(root);
        this.get("accordion").get("items").set(data);
      },

      /**
       * Switches the ontology in the bioontology model to the selected ontology
       * and fetches the new ontology classes.
       * @param {BioontolgyClass} newOntology - The selected ontology model,
       * with ontology and subTree attributes.
       */
      switchOntology(newOntology) {
        const bioontology = this.get("bioontology");
        const newOntologyName = newOntology.get("ontology");
        const newSubtree = newOntology.get("subTree");

        bioontology.resetPageInfo();
        bioontology.set("ontology", newOntologyName);
        bioontology.set("subTree", newSubtree);
        this.setAccordionRoot(newSubtree || this.get("defaultSubtree"));
        bioontology.fetch({ replaceCollection: true });
      },
    },
  ));
