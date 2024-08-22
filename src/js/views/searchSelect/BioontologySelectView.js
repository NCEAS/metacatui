"use strict";

define([
  "jquery",
  "semantic",
  "models/ontologies/BioontologyBatch",
  "views/searchSelect/SolrAutocompleteView",
  "views/ontologies/BioontologyBrowserView",
], (
  $,
  Semantic,
  BioontologyBatch,
  SolrAutocompleteView,
  BioontologyBrowserView,
) => {
  // The base class for the view
  const BASE_CLASS = "bioontology-select";

  // The class names used in the view
  const CLASS_NAMES = {
    button: [
      Semantic.CLASS_NAMES.base,
      Semantic.CLASS_NAMES.button.base,
      Semantic.CLASS_NAMES.variations.attached,
      Semantic.CLASS_NAMES.colors.blue,
      "right",
    ],
    closeIcon: [Semantic.CLASS_NAMES.modal.closeButton, "icon", "icon-remove"],
    modal: [Semantic.CLASS_NAMES.base, Semantic.CLASS_NAMES.modal.base],
    modalContent: Semantic.CLASS_NAMES.modal.content,
  };

  // The text to display on the button tht opens the ontology browser
  const BUTTON_TEXT = "Browse";

  /**
   * @class
   * @classdesc
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 0.0.0
   * @screenshot views/searchSelect/BioontologySelectView.png
   */
  return SolrAutocompleteView.extend(
    /** @lends BioontologySelectView.prototype */
    {
      /** @inheritdoc */
      type: "OntologySelect",

      /** @inheritdoc */
      className: `${BASE_CLASS} ${SolrAutocompleteView.prototype.className}`,

      /**
       * The name of the field in the Solr schema that the user is searching.
       * @type {string} TODO: Should we use the annotation fields configured in
       * MetacatUI appConfig?
       */
      queryField: "sem_annotation",

      /**
       * Set this to false to avoid fetching class labels from BioPortal. The
       * labels will be displayed as the values that are returned from the Solr
       * query.
       * @type {boolean}
       */
      showClassLabels: true,

      /** @inheritdoc */
      initialize(opts = {}) {
        if (opts?.showClassLabels === false) this.showClassLabels = false;
        const attrs = opts || {};
        attrs.queryField = opts?.queryField || this.queryField;
        attrs.fluid = false;
        SolrAutocompleteView.prototype.initialize.call(this, attrs);
        if (this.showClassLabels) this.fetchClassLabels();
      },

      /** @inheritdoc */
      render() {
        SolrAutocompleteView.prototype.render.call(this);
        this.renderButton();
        this.renderOntologyModal();
        this.addListeners();
      },

      /** Create the button to open the ontology browser */
      renderButton() {
        const button = document.createElement("button");
        button.classList.add(...CLASS_NAMES.button);
        button.innerHTML = BUTTON_TEXT;
        this.el.appendChild(button);
        this.button = button;
      },

      /**  Render the ontology browser modal */
      renderOntologyModal() {
        this.browser = new BioontologyBrowserView();

        const closeIcon = document.createElement("i");
        closeIcon.classList.add(...CLASS_NAMES.closeIcon);

        const contentDiv = document.createElement("div");
        contentDiv.classList.add(CLASS_NAMES.modalContent);

        const modal = document.createElement("div");
        modal.classList.add(...CLASS_NAMES.modal);

        modal.appendChild(closeIcon);
        modal.appendChild(contentDiv);
        contentDiv.appendChild(this.browser.el);
        this.el.appendChild(modal);

        this.modal = $(modal).modal();

        this.hideOntologyBrowser();
      },

      /**
       * Listen to when a class is selected in the browser & when the button is
       * clicked to open the browser
       */
      addListeners() {
        this.listenTo(this.browser, "selected", (cls) => {
          this.modal.modal("hide");
          this.selectClass(cls);
        });
        this.button.addEventListener("click", () => {
          this.showOntologyBrowser();
        });
      },

      /** Show the ontology browser modal */
      showOntologyBrowser() {
        // Don't render until the first time the modal is shown
        if (!this.browserRendered) {
          this.browser.render();
          this.browserRendered = true;
        }
        this.modal.modal("show");
      },

      /** Hide the ontology browser modal */
      hideOntologyBrowser() {
        this.modal.modal("hide");
      },

      /**
       * Set the value of the select element to the given ontology class
       * @param {OntologyClass} ontologyClass - The class model to select
       */
      selectClass(ontologyClass) {
        const option = ontologyClass.toSearchSelectOption();
        const selectedValue = option.value;
        this.model.addSelected(selectedValue);
        this.model.get("options").add(option);
      },

      /** Fetch the labels select element from BioPortal */
      async fetchClassLabels() {
        const options = this.model.get("options");

        if (!options.length) {
          this.listenToOnce(options, "add reset", this.fetchClassLabels);
          return;
        }

        const values = options.pluck("value");
        const preSelected = this.model.get("selected");
        const classesToFetch = [...values, ...preSelected];

        // We want to used a cached version of the classes to avoid making
        // unnecessary requests
        if (!MetacatUI.bioontologySearch) {
          MetacatUI.bioontologySearch = new BioontologyBatch();
        }
        const bioModel = MetacatUI.bioontologySearch;
        this.listenTo(bioModel.get("collection"), "update", (collection) => {
          this.addOptionDetails(collection);
        });
        const allClasses = await bioModel.getClasses(classesToFetch);
        // If any of the classes were cached, add them to the options
        this.addOptionDetails(allClasses);
      },

      /**
       * Add the details of the ontology classes to the options in the select
       * element
       * @param {Collection} collection - The collection of ontology classes
       */
      addOptionDetails(collection) {
        const options = this.model.get("options");
        // Get only the options that don't already at least have a label
        const toUpdate = options.filter((option) => {
          const label = option.get("label");
          const value = option.get("value");
          return !label || value === label;
        });
        toUpdate.forEach((option) => {
          const classId = option.get("value");
          const cls = collection.get(classId);
          if (cls) {
            const newAttrs = cls.toSearchSelectOption();
            const existingDescription = option.get("description");
            if (existingDescription) {
              newAttrs.description = `${newAttrs.description} (${existingDescription})`;
            }
            option.set(newAttrs);
          }
        });
      },
    },
  );
});
