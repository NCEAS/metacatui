define(["backbone", "models/CitationModel"], (Backbone, CitationModel) => {
  // The "Type" property of the annotation view
  const ANNO_VIEW_TYPE = "AnnotationView";
  // The URI for the schema.org:sameAs annotation
  const SCHEMA_ORG_SAME_AS = "http://www.w3.org/2002/07/owl#sameAs";
  // The URI for the prov:wasDerivedFrom annotation
  const PROV_WAS_DERIVED_FROM = "http://www.w3.org/ns/prov#wasDerivedFrom";

  // What to call the field that links to the original dataset
  const CANONICAL_LABEL = "Canonical Dataset";
  // The text to display in the info tooltip to explain what the canonical
  // dataset field means
  const CANONICAL_TOOLTIP_TEXT =
    "The original dataset this version was derived from. This dataset is essentially a duplicate of the original.";
  // The text to display in the info tooltip to explain what the info icon means
  const INFO_ICON_TOOLTIP_TEXT =
    "This dataset is essentially a duplicate of of another, original dataset.";
  // In the citation modal, the heading to use for the dataone version citation
  const CITATION_TITLE_DATAONE = "This Version of the Dataset";
  // In the citation modal, the heading to use for the canonical dataset
  // citation
  const CITATION_TITLE_CANONICAL = "Canonical Dataset";
  // The class to use for the info icon
  const INFO_ICON_CLASS = "info";
  // The bootstrap icon name to use for the info icon
  const INFO_ICON_NAME = "icon-copy";

  // The following properties are used to identify parts of the MetadataView.
  // If the MetadataView changes, these properties may need to be updated.

  // The name of the property on the MetadataView that contains subviews
  const SUBVIEW_PROP = "subviews";
  // The name of the property on the MetadataView that contains the citation
  // modal
  const CITATION_MODAL_PROP = "citationModal";
  // Class names used in the MetadataView that we also need to use in this view
  const METADATA_VIEW_CLASS_NAMES = {
    fieldItem: "control-group",
    fieldLabel: "control-label",
    fieldValue: ["controls", "controls-well"],
    fieldInfoIcon: ["tooltip-this", "icon", "icon-info-sign"],
  };

  /**
   * @class CanonicalDatasetHandlerView
   * @classdesc A scoped subview responsible for inspecting the rendered DOM
   * within the MetadataView to identify and highlight the canonical (original)
   * dataset based on schema.org:sameAs and prov:derivedFrom annotations. This
   * view modifies specific parts of the MetadataView when a canonical dataset
   * is detected, providing a clearer distinction between original and derived
   * datasets.
   * @classcategory Views
   * @augments Backbone.View
   * @class
   * @since 0.0.0
   * @screenshot views/CanonicalDatasetHandlerViewView.png TODO
   */
  const CanonicalDatasetHandlerView = Backbone.View.extend(
    /** @lends CanonicalDatasetHandlerView.prototype */
    {
      /** @inheritdoc */
      type: "CanonicalDatasetHandlerView",

      /**
       * The MetadataView instance this view is scoped to.
       * @type {MetadataView}
       */
      metdataView: null,

      /**
       * The value of the label to insert the canonical dataset field before.
       * @type {string}
       */
      insertFieldBefore: "Identifier",

      /**
       * Creates a field item for the MetadataView.
       * @param {string} label - The label for the field.
       * @param {string} value - The value for the field.
       * @param {string} tooltipText - The text to display in the info tooltip.
       * @param {object} classes - The classes to apply to the field item.
       * @returns {string} The HTML for the field item.
       */
      fieldItemTemplate(label, value, tooltipText, classes) {
        return `<div class="${classes.fieldItem}">
          <label class="${classes.fieldLabel}">
            ${label}
            <span style="display: inline-block; width: 1em; text-align: center;">
              <i class="${classes.fieldInfoIcon.join(" ")}" data-toggle="tooltip" title="${tooltipText}"></i>
            </span>
          </label>
          <div class="${classes.fieldValue.join(" ")}">${value}</div>
        </div>`;
      },

      /**
       * Initialize the CanonicalDatasetHandlerView.
       * @param {object} options - A set of options to initialize the view with.
       * @param {MetadataView} options.metadataView - The MetadataView instance
       * this view is scoped to. Required.
       */
      initialize(options) {
        this.metadataView = options?.metadataView;
        if (!this.metadataView) {
          throw new Error(
            "The CanonicalDatasetHandlerView requires a MetadataView instance.",
          );
        }
      },

      /** @inheritdoc */
      render() {
        // In case it's a re-render, remove any modifications made previously
        this.reset();
        const hasCanonical = this.detectCanonicalDataset();
        if (!hasCanonical) return this;
        this.getCitationInfo();
        this.fieldItem = this.addFieldItem();
        this.modifyCitationModal();
        this.infoIcon = this.addInfoIcon();
        this.hideAnnotations();
        return this;
      },

      /**
       * Resets the MetadataView to its original state by removing any changes
       * made by this view.
       */
      reset() {
        this.fieldItem?.remove();
        this.infoIcon?.remove();
        this.showAnnotations();
      },

      /**
       * Inspects the MetadataView DOM to determine if a canonical dataset is
       * present based on schema.org:sameAs and prov:wasDerivedFrom annotations.
       * If a canonical dataset is detected, this method sets the appropriate
       * properties on the view instance.
       * @returns {boolean} True if a canonical dataset is detected, false
       * otherwise.
       */
      detectCanonicalDataset() {
        // The annotation views provide the URI and value of annotations on the
        // metadata. We consider the dataset to be canonical if the sameAs and
        // derivedFrom annotations both point to the same URI.
        const sameAsAnno = this.getSameAsAnnotationView();
        if (!sameAsAnno) return false;
        const derivedFromAnno = this.getDerivedFromAnnotationView();
        if (!derivedFromAnno) return false;
        const sameAsUri = sameAsAnno.value.uri;
        const derivedFromUri = derivedFromAnno.value.uri;
        if (sameAsUri !== derivedFromUri) return false;
        this.canonicalUri = sameAsUri;
        return true;
      },

      /**
       * Gets all annotation views from the MetadataView.
       * @returns {AnnotationView[]} An array of AnnotationView instances.
       */
      getAnnotationViews() {
        return this.metadataView[SUBVIEW_PROP].filter(
          (view) => view?.type === ANNO_VIEW_TYPE,
        );
      },

      /**
       * Gets the AnnotationView for the schema.org:sameAs annotation.
       * @returns {AnnotationView} The AnnotationView instance for the sameAs
       */
      getSameAsAnnotationView() {
        return this.getAnnotationViews().find(
          (view) => view.property.uri === SCHEMA_ORG_SAME_AS,
        );
      },

      /**
       * Gets the AnnotationView for the prov:wasDerivedFrom annotation.
       * @returns {AnnotationView} The AnnotationView instance for derivedFrom
       */
      getDerivedFromAnnotationView() {
        return this.getAnnotationViews().find(
          (view) => view.property.uri === PROV_WAS_DERIVED_FROM,
        );
      },

      /**
       * Given the canonical dataset URI, fetches citation information for the
       * canonical dataset, like the title, authors, publication date, etc. Saves
       * this information in a CitationModel instance.
       */
      getCitationInfo() {
        // TODO: Get citation info from the canonical dataset
        // what API can we use to get this info?
        // this.citationModel = new CitationModel({});
      },

      /**
       * Hides the sameAs and derivedFrom annotations from the MetadataView.
       * This is done to prevent redundancy in the metadata display.
       */
      hideAnnotations() {
        // Sometimes the MetadataView re-renders, so we must always query for
        // the annotation views when we want to remove them.
        const sameAsAnno = this.getSameAsAnnotationView();
        const derivedFromAnno = this.getDerivedFromAnnotationView();
        if (sameAsAnno?.value.uri === this.canonicalUri) {
          sameAsAnno.el.style.display = "none";
          this.hiddenSameAs = sameAsAnno;
        }
        if (derivedFromAnno?.value.uri === this.canonicalUri) {
          derivedFromAnno.el.style.display = "none";
          this.hiddenDerivedFrom = derivedFromAnno;
        }
      },

      /** Show previously hidden annotations in the MetadataView. */
      showAnnotations() {
        this.hiddenSameAs?.el.style.removeProperty("display");
        this.hiddenSameAs = null;
        this.hiddenDerivedFrom?.el.style.removeProperty("display");
        this.hiddenDerivedFrom = null;
      },

      /**
       * Adds a "row" in the MetadataView to display the canonical dataset URI.
       */
      addFieldItem() {
        const { canonicalUri, fieldItemTemplate } = this;
        const itemHTML = fieldItemTemplate(
          CANONICAL_LABEL,
          `<a href="${canonicalUri}">${canonicalUri}</a>`,
          CANONICAL_TOOLTIP_TEXT,
          METADATA_VIEW_CLASS_NAMES,
        );

        // Vivify the item so we can reference it later
        const range = document.createRange();
        const fragment = range.createContextualFragment(itemHTML);
        const item = fragment.firstElementChild;

        // Find the parent item that contains the field name the view should
        // be inserted before
        const labels = Array.from(
          this.metadataView.el.querySelectorAll("label"),
        );
        const insertBeforeLabel = labels.find(
          (label) => label.textContent.trim() === this.insertFieldBefore,
        );
        // Insert the new field item before the label
        insertBeforeLabel.parentElement.before(item);
        return item;
      },

      /** Open the citation modal. */
      openCitationModal() {
        this.metadataView[CITATION_MODAL_PROP].show();
      },

      /**
       * Modifies the CitationModalView to add the citation information for the
       * canonical dataset in addition to the citation information for the
       * current dataset.
       */
      modifyCitationModal() {
        // The CitationModalView is recreated each time it is shown.
        const citationModalView = this.metadataView[CITATION_MODAL_PROP];
        this.listenToOnce(citationModalView, "rendered", () => {
          citationModalView.canonicalDatasetMods = true;
          // Add heading for each citation
          const heading = document.createElement("h5");
          heading.textContent = CITATION_TITLE_DATAONE;
          citationModalView.citationContainer.prepend(heading);

          // Add the citation for the canonical dataset
          const headingOriginal = document.createElement("h5");
          headingOriginal.textContent = CITATION_TITLE_CANONICAL;
          citationModalView.citationContainer.append(headingOriginal);

          const testCitationModel = new CitationModel({
            // TODO: Add citation info for the canonical dataset
          });
          citationModalView.insertCitation(testCitationModel);
        });
      },

      /**
       * Adds a icon to the header of the MetadataView to indicate that the
       * dataset being displayed is essentially a duplicate
       */
      addInfoIcon() {
        const infoIcon = this.metadataView.addInfoIcon(
          "duplicate",
          INFO_ICON_NAME,
          INFO_ICON_CLASS,
          INFO_ICON_TOOLTIP_TEXT,
        );
        infoIcon.style.cursor = "pointer";
        infoIcon.addEventListener("click", () => this.openCitationModal());
        return infoIcon;
      },

      /** Called when the view is removed. */
      onClose() {
        this.reset();
        this.remove();
      },
    },
  );

  return CanonicalDatasetHandlerView;
});
