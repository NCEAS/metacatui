"use strict";

define([
  "backbone",
  "jquery",
  "semantic",
  "models/ontologies/BioontologyBatch",
  "views/searchSelect/SolrAutocompleteView",
  "views/ontologies/BioontologyBrowserView",
], (
  Backbone,
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
    buttonIcon: ["icon", "icon-external-link-sign"],
    modalCloseButton: "close",
    modal: ["modal", "hide", "bioontology-select-modal"], // Bootstrap classes
    modalContent: "modal-body", // Bootstrap class
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
       * @type {string}
       */
      queryField: "sem_annotation",
      // TODO: Default to the anno fields configured in MetacatUI appConfig?

      /**
       * Set this to false to avoid fetching class labels from BioPortal. The
       * labels will be displayed as the values that are returned from the Solr
       * query.
       * @type {boolean}
       */
      showClassLabels: true,

      /**
       * The ontologies that can be searched or browsed. Each ontology needs a
       * "label" and a "ontology" (acronym) property. Optionally, a "subTree"
       * property can be provided to search a specific sub-tree of the ontology.
       * @type {Array.<{label: string, ontology: string, subTree: string}>}
       * @since 0.0.0
       */
      ontologies: MetacatUI.appModel.get("bioportalOntologies"),

      /**
       * Initialize the view
       * @param {object} [opts] - The options to initialize the view with
       * @param {boolean} [opts.showClassLabels] - Set to false to avoid
       * fetching class labels from BioPortal
       * @param {string} [opts.queryField] - The name of the field in the Solr
       * schema that the user is searching
       * @param {object[]} [opts.ontologies] - The ontoloties (& sub-trees) to
       * allow users to search for. This will override the default on the BioontologyBatch model
       * and the TODO
       */
      initialize(opts = {}) {
        if (opts?.showClassLabels === false) this.showClassLabels = false;
        const attrs = opts || {};
        attrs.queryField = opts?.queryField || this.queryField;
        attrs.fluid = false;
        if (attrs.ontologies) {
          this.ontologies = attrs.ontologies;
        }
        attrs.submenuStyle = "accordion";
        SolrAutocompleteView.prototype.initialize.call(this, attrs);
        if (this.showClassLabels) this.fetchClassLabels();
      },

      /** @inheritdoc */
      render() {
        SolrAutocompleteView.prototype.render.call(this);
        this.renderButton();
        this.renderOntologyModal();
        this.addListeners();
        return this;
      },

      /** Create the button to open the ontology browser */
      renderButton() {
        const button = document.createElement("button");
        button.classList.add(...CLASS_NAMES.button);

        const span = document.createElement("span");
        span.textContent = BUTTON_TEXT;

        const icon = document.createElement("i");
        icon.classList.add(...CLASS_NAMES.buttonIcon);
        icon.style.color = "inherit";

        button.append(span, icon);
        this.el.appendChild(button);
        this.button = button;
      },

      /**  Render the ontology browser modal */
      renderOntologyModal() {
        this.browser = new BioontologyBrowserView({
          ontologyOptions: this.ontologies,
        });
        // Bootstrap modal close button
        const closeButton = document.createElement("button");
        closeButton.classList.add(CLASS_NAMES.modalCloseButton);
        closeButton.setAttribute("data-dismiss", "modal");
        closeButton.setAttribute("aria-hidden", "true");
        closeButton.innerHTML = "&times;";

        const contentDiv = document.createElement("div");
        contentDiv.classList.add(CLASS_NAMES.modalContent);

        const modal = document.createElement("div");
        modal.classList.add(...CLASS_NAMES.modal);

        modal.append(contentDiv, closeButton);
        contentDiv.appendChild(this.browser.el);
        document.body.appendChild(modal);

        this.modal = $(modal).modal({ show: false });

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

        if (!MetacatUI.bioontologySearch) {
          MetacatUI.bioontologySearch = new BioontologyBatch();
        }
        this.bioBatchModel = MetacatUI.bioontologySearch;
        const ontologies = this.ontologies?.map(
          (ontology) => ontology.ontology,
        );
        this.bioBatchModel.set("ontologies", ontologies);

        this.listenTo(
          this.bioBatchModel.get("collection"),
          "update",
          (collection) => {
            this.addOptionDetails(collection);
          },
        );
        const allClasses = await this.bioBatchModel.getClasses(classesToFetch);
        this.addOptionDetails(allClasses);
      },

      /**
       * Add the details of the ontology classes to the options in the select
       * element
       * @param {Backbone.Collection|Array} classes - The collection of classes to add
       * to the options
       */
      addOptionDetails(classes) {
        if (!classes?.length) return;
        // if collection is an array, make it a collection
        let collection = classes;
        if (!classes.get) collection = new Backbone.Collection(collection);
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
        options.renameCategory("", "Unknown Ontology");
        options.sortByProp("category");
        options.trigger("update");
      },
    },
  );
});
