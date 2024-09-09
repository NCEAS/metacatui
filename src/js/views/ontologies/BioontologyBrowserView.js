define([
  "backbone",
  "semantic",
  "models/connectors/Bioontology-Accordion-SearchSelect",
  "views/accordion/AccordionView",
  "views/searchSelect/SearchSelectView",
], (Backbone, Semantic, Connector, AccordionView, SearchSelectView) => {
  const BASE_CLASS = "bioontology-browser";
  const CLASS_NAMES = {
    accordion: AccordionView.prototype.className,
    searchSelect: SearchSelectView.prototype.className,
    classInfo: "class-info",
    message: [
      Semantic.CLASS_NAMES.base,
      Semantic.CLASS_NAMES.variations.floating,
      Semantic.CLASS_NAMES.message.base,
      Semantic.CLASS_NAMES.variations.info,
    ],
    metacatui: {
      loader: "icon-spinner icon-spin icon-on-left",
      icon: "icon",
      iconLeft: "icon-on-left",
      floatRight: "pull-right",
      externalLinkIcon: "icon-external-link",
      addIcon: "icon-plus",
      tagIcon: "icon-tag",
    },
  };
  const BOOTSTRAP_CLASSES = {
    floatRight: "pull-right",
  };
  const BUTTON_ID = "bioontology-select-button";

  /**
   * @class BioontologyBrowser
   * @classdesc An interface to browser BioPortal ontologies and classes
   * @classcategory Views/Ontologies
   * @augments Backbone.View
   * @since 0.0.0
   * @screenshot views/ontologies/BioontologyBrowserView.png
   */
  const BioontologyBrowser = Backbone.View.extend(
    /** @lends BioontologyBrowser.prototype */
    {
      /** @inheritdoc */
      type: "BioontologyBrowser",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The HTML string to display when no term is selected
       */
      noTermHTML: `
        <div class="${CLASS_NAMES.message.join(" ")}">
          <div class="${Semantic.CLASS_NAMES.message.header}">
            No term selected
          </div>
          <p>
            Select a term from the ontology to view details.
          </p>
        </div>`,

      events: {
        [`click #${BUTTON_ID}`]: "handleSelectButtonClick",
      },

      /**
       * Given variables, returns the HTML string the panel that shows details
       * about a class
       * @param {object} vars - The variables to use in the template
       * @param {string} vars.label - The label of the class
       * @param {string} vars.description - The description of the class
       * @param {string} vars.id - The ID of the class
       * @param {string} vars.uiLink - The link to the class on BioPortal
       * @returns {string} The HTML string for the class info panel
       */
      classInfoTemplate(vars) {
        return `<div class="${Semantic.CLASS_NAMES.base} ${Semantic.CLASS_NAMES.variations.raised} ${Semantic.CLASS_NAMES.card.base}" style="width:100%">
          <div class="content">
            
            <div class="header">
              <i class="${CLASS_NAMES.metacatui.icon} ${CLASS_NAMES.metacatui.iconLeft} ${CLASS_NAMES.metacatui.tagIcon} ${BOOTSTRAP_CLASSES.floatRight}"></i>
              ${vars.label}
            </div>
            <div class="${Semantic.CLASS_NAMES.card.meta}">
              ${vars.id}
            </div>
            <div class="${Semantic.CLASS_NAMES.card.description}">
              ${vars.description}
              <a href="${vars.uiLink}" target="_blank">
              More details on BioPortal <i class="${CLASS_NAMES.metacatui.icon} ${CLASS_NAMES.metacatui.externalLinkIcon}"></i>
            </a>
            </div>
          </div>
          <div class="${Semantic.CLASS_NAMES.base} ${Semantic.CLASS_NAMES.variations.attached} ${Semantic.CLASS_NAMES.colors.blue} ${Semantic.CLASS_NAMES.button.base}" id="${BUTTON_ID}">
            <i class="${CLASS_NAMES.metacatui.icon} ${CLASS_NAMES.metacatui.addIcon}" style="color:inherit";></i>
            Select term
          </div>
        </div>`;
      },

      /**
       * Extra CSS styles for this view.
       */
      styles: `
        .${BASE_CLASS} {
          border-radius: 5px;
          box-sizing: border-box;
          height: 100%;
          display: flex;
          flex-direction: column;
          max-height: 70vh;
          overflow: hidden;
        }

        .${BASE_CLASS} .${CLASS_NAMES.accordion} {
          overflow: auto;
          padding: 0rem 0.2rem;
        }

        .${BASE_CLASS} .${CLASS_NAMES.searchSelect} {
          box-shadow: 0 0.0.8rem 0.6rem 0 rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid #d4d4d5;
          border-radius: 5px;
          z-index: 1;
        }

        .${BASE_CLASS} .${Semantic.CLASS_NAMES.card.base}, .${BASE_CLASS} .${Semantic.CLASS_NAMES.message.base} {
          transition: 0.3s ease-in-out;
          box-shadow: 0 -0.08rem 0.6rem 0 rgba(0, 0, 0, 0.3);
        }
      `,

      /**
       * Initialize the BioontologyBrowser view
       * @param {object} options - Options for the view
       * @param {object} options.ontologyOptions - The ontologies (or classes) that
       * a user can select terms from. Each ontology should have a label and an
       * ontology acronym, and an optional subtree root.
       * @example
       * const browser = new BioontologyBrowser({
       *  ontologyOptions: [
       *   {
       *     label: "Measurement Types (ECSO)",
       *     ontology: "ECSO",
       *     subTree: "http://ecoinformatics.org/oboe/oboe.1.2/oboe-core.owl#MeasurementType"
       *    }, { ... } ]
       * });
       */
      initialize(options) {
        MetacatUI.appModel.addCSS(this.styles, "BioontologyBrowserStyles");
        const ontologyOptions = options?.ontologyOptions;
        const modelOptions = ontologyOptions ? { ontologyOptions } : {};
        this.model = new Connector(modelOptions);
        this.listenTo(
          this.model,
          "change:selectedClass",
          this.updateClassInfoEl,
        );
      },

      /** @inheritdoc */
      render() {
        this.el.innerHTML = "";

        // Ontology dropdown
        this.ontologySwitcher = new SearchSelectView({
          model: this.model.get("searchSelect"),
        });
        this.el.appendChild(this.ontologySwitcher.render().el);

        // Accordion with browseable ontology classes
        this.accordionView = new AccordionView({
          model: this.model.get("accordion"),
        });
        this.el.appendChild(this.accordionView.render().el);
        this.model.get("bioontology").fetch({ replaceCollection: true });

        // Panel with class details
        this.classInfoEl = document.createElement("div");
        this.el.appendChild(this.classInfoEl);
        this.updateClassInfoEl();
      },

      /**
       * Update the class info panel with the currently selected class
       * @param {number} transitionTime - The time in milliseconds for the fade
       * transition between changing info in the panel
       */
      updateClassInfoEl(transitionTime = 300) {
        let newHtml = this.noTermHTML;

        const ontClass = this.model.get("selectedClass");
        if (ontClass) {
          newHtml = this.classInfoTemplate({
            label: ontClass.get("prefLabel"),
            description: ontClass.get("definition"),
            id: ontClass.get("@id"),
            uiLink: ontClass.get("links")?.ui,
          });
        }

        // Change the content with a fade transition
        this.classInfoEl.style.transition = `opacity ${transitionTime}ms ease-in-out`;
        this.classInfoEl.style.opacity = "0.6";
        setTimeout(() => {
          this.classInfoEl.innerHTML = newHtml;
          setTimeout(() => {
            this.classInfoEl.style.opacity = "1";
          }, 1);
        }, transitionTime);
      },

      /**
       * Called when the select button is clicked and triggers the selected
       * event with the selected class model as the argument
       * @fires BioontologyBrowser#selected
       */
      handleSelectButtonClick() {
        const selectedClass = this.model.get("selectedClass");
        if (selectedClass) {
          this.trigger("selected", selectedClass);
        } else {
          // Show a message that no class is selected
          this.updateClassInfoEl();
        }
      },
    },
  );

  return BioontologyBrowser;
});
