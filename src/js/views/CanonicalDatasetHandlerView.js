define([
  "backbone",
  "views/CitationView",
  "models/CitationModel",
  "models/CrossRefModel",
], (Backbone, CitationView, CitationModel, CrossRefModel) => {
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
        this.citationModel = new CitationModel();
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
        this.fieldItem = this.addFieldItem();
        this.infoIcon = this.addInfoIcon();
        this.getCitationInfo();
        this.modifyCitationModal();
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
        this.citationModel.reset();
        this.canonicalUri = null;
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
        const matches = this.findCanonicalAnnotations();
        if (!matches) return false;
        this.canonicalUri = matches.uri;
        return true;
      },

      /**
       * Given a set annotation views for the sameAs property and a set of
       * annotation views for the derivedFrom property, this method finds any
       * matches between the two sets. A match is found if the URI of the sameAs
       * annotation is the same as the URI of the derivedFrom annotation.
       * @returns {{sameAs: AnnotationView, derivedFrom: AnnotationView, uri: string}}
       * An object containing the matching sameAs and derivedFrom annotation and
       * the URI they share.
       */
      findCanonicalAnnotations() {
        // The annotation views provide the URI and value of annotations on the
        // metadata. We consider the dataset to be canonical if the sameAs and
        // derivedFrom annotations both point to the same URI.
        const sameAs = this.getSameAsAnnotationViews();
        if (!sameAs?.length) return null;
        const derivedFrom = this.getDerivedFromAnnotationViews();
        if (!derivedFrom?.length) return null;

        const sameAsUnique = this.removeDuplicateAnnotations(sameAs);
        const derivedFromUnique = this.removeDuplicateAnnotations(derivedFrom);

        // Find any matches between the two sets
        const matches = [];
        sameAsUnique.forEach((sameAsAnno) => {
          derivedFromUnique.forEach((derivedFromAnno) => {
            if (sameAsAnno.value.uri === derivedFromAnno.value.uri) {
              matches.push({
                sameAs: sameAsAnno,
                derivedFrom: derivedFromAnno,
                uri: sameAsAnno.value.uri,
              });
            }
          });
        });
        // There can only be one canonical dataset. If multiple matches are
        // found, we cannot determine the canonical dataset.
        if (!matches.length || matches.length > 1) return null;
        return matches[0];
      },

      /**
       * Removes duplicate annotations from an array of AnnotationView instances.
       * @param {AnnotationView[]} annotationViews An array of AnnotationView all
       * with the same property URI.
       * @returns {AnnotationView[]} An array of AnnotationView instances with
       * duplicates removed.
       */
      removeDuplicateAnnotations(annotationViews) {
        return annotationViews.filter(
          (anno, i, self) =>
            i === self.findIndex((a) => a.value.uri === anno.value.uri),
        );
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
       * @returns {AnnotationView[]} An array of sameAs AnnotationViews.
       */
      getSameAsAnnotationViews() {
        return this.getAnnotationViews().filter(
          (view) => view.property.uri === SCHEMA_ORG_SAME_AS,
        );
      },

      /**
       * Gets the AnnotationView for the prov:wasDerivedFrom annotation.
       * @returns {AnnotationView[]} An array of derivedFrom AnnotationViews.
       */
      getDerivedFromAnnotationViews() {
        return this.getAnnotationViews().filter(
          (view) => view.property.uri === PROV_WAS_DERIVED_FROM,
        );
      },

      /**
       * Given the canonical dataset URI, fetches citation information for the
       * canonical dataset, like the title, authors, publication date, etc. Saves
       * this information in a CitationModel instance.
       */
      getCitationInfo() {
        const view = this;
        this.crossRef = new CrossRefModel({
          doi: this.canonicalUri,
        });
        this.stopListening(this.crossRef);
        this.listenToOnce(this.crossRef, "sync", () => {
          view.citationModel.setSourceModel(this.crossRef);
          view.updateFieldItemWithCitation();
        });
        this.crossRef.fetch();
      },

      /**
       * Hides the sameAs and derivedFrom annotations from the MetadataView.
       * This is done to prevent redundancy in the metadata display.
       */
      hideAnnotations() {
        // Sometimes the MetadataView re-renders, so we must always query for
        // the annotation views when we want to remove them.
        const sameAs = this.getSameAsAnnotationViews();
        const derivedFrom = this.getDerivedFromAnnotationViews();
        sameAs.forEach((sameAsAnno) => {
          if (sameAsAnno?.value.uri === this.canonicalUri) {
            const view = sameAsAnno;
            view.el.style.display = "none";
            if (!this.hiddenSameAs) this.hiddenSameAs = [];
            this.hiddenSameAs.push(sameAsAnno);
          }
        });
        derivedFrom.forEach((derivedFromAnno) => {
          if (derivedFromAnno?.value.uri === this.canonicalUri) {
            const view = derivedFromAnno;
            view.el.style.display = "none";
            if (!this.hiddenDerivedFrom) this.hiddenDerivedFrom = [];
            this.hiddenDerivedFrom.push(derivedFromAnno);
          }
        });
      },

      /** Show previously hidden annotations in the MetadataView. */
      showAnnotations() {
        this.hiddenSameAs?.el.style.removeProperty("display");
        this.hiddenSameAs = null;
        this.hiddenDerivedFrom?.el.style.removeProperty("display");
        this.hiddenDerivedFrom = null;
      },

      /**
       * Add a row in the MetadataView to display the canonical dataset URI
       * @returns {Element} The field item element that was added to the view.
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

      /**
       * Replaces the DOI in the field item with a full citation for the
       * canonical dataset.
       */
      updateFieldItemWithCitation() {
        const { citationModel, fieldItem } = this;
        if (!fieldItem) return;

        const citationView = new CitationView({
          model: citationModel,
          className: "canonical-citation",
          createTitleLink: false,
          openLinkInNewTab: true,
        }).render();

        // Replace the DOI with the citation
        const fieldValueEl = fieldItem.querySelector(
          `.${METADATA_VIEW_CLASS_NAMES.fieldValue.join(".")}`,
        );
        fieldValueEl.innerHTML = "";
        fieldValueEl.appendChild(citationView.el);
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
        const view = this;
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
          citationModalView.insertCitation(view.citationModel);
        });
      },

      /**
       * Adds a icon to the header of the MetadataView to indicate that the
       * dataset being displayed is essentially a duplicate
       * @returns {Element} The info icon element that was added to the view.
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
