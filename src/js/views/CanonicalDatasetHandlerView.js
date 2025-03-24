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

  // The text to show in the alert box at the top of the MetadataView
  const ALERT_TEXT =
    "This version of the dataset is a replica or minor variant of the original dataset:";
  // The text to display in the info tooltip to explain what the info icon means
  const INFO_ICON_TOOLTIP_TEXT =
    "This dataset is replica or minor variant of another, original dataset.";
  // In the citation modal, the heading to use for the dataone version citation
  const CITATION_TITLE_DATAONE = "This Version of the Dataset";
  // In the citation modal, the heading to use for the canonical dataset
  // citation
  const CITATION_TITLE_CANONICAL = "Canonical Dataset";
  // The class to use for the info icon
  const INFO_ICON_CLASS = "info";
  // The bootstrap icon name to use for the info icon
  const INFO_ICON_NAME = "icon-copy";

  // Class names used in this view
  const CLASS_NAMES = {
    alertBox: ["alert", "alert-info", "alert-block"], // TODO: need alert-block?
    alertIcon: ["icon", "icon-info-sign", "icon-on-left"],
    alertCitation: "canonical-citation",
  };

  // The following properties are used to identify parts of the MetadataView.
  // If the MetadataView changes, these properties may need to be updated.
  const METADATA_VIEW = {
    // The selector for the container that contains the info icons and metrics buttons
    controlsSelector: "#metadata-controls-container",
    // The name of the property on the MetadataView that contains the citation
    // modal
    citationModalProp: "citationModal",
    // The name of the property on the MetadataView that contains subviews
    subviewProp: "subviews",
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
   * @since 2.32.0
   * @screenshot views/CanonicalDatasetHandlerViewView.png
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
        this.infoIcon = this.addInfoIcon();
        this.alertBox = this.addAlertBox();
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
        this.infoIcon?.remove();
        this.alertBox?.remove();
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
        return this.metadataView[METADATA_VIEW.subviewProp].filter(
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
        // Set the URL as the url for now, incase it is not a DOI or we fail to
        // fetch the citation information.
        this.citationModel.set({
          pid: this.canonicalUri,
          pid_url: this.canonicalUri,
        });

        this.crossRef = new CrossRefModel({
          doi: this.canonicalUri,
        });
        this.stopListening(this.crossRef);
        this.listenToOnce(this.crossRef, "sync", () => {
          view.citationModel.setSourceModel(this.crossRef);
          view.updateAlertBox();
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
       * Adds an alert box to the top of the MetadataView to indicate that the
       * dataset being displayed is a replica or minor variant of the original
       * dataset.
       * @returns {Element} The alert box element that was added to the view.
       */
      addAlertBox() {
        const controls = this.metadataView.el.querySelector(
          METADATA_VIEW.controlsSelector,
        );

        const alertBox = document.createElement("section");
        alertBox.classList.add(...CLASS_NAMES.alertBox);

        const icon = document.createElement("i");
        icon.classList.add(...CLASS_NAMES.alertIcon);

        const heading = document.createElement("h5");
        heading.textContent = ALERT_TEXT;

        // Add a div that will contain the citation information
        const citeContainer = document.createElement("div");
        citeContainer.classList.add(CLASS_NAMES.alertCitation);
        // Just add the URI for now
        citeContainer.textContent = this.canonicalUri;

        heading.prepend(icon);
        alertBox.append(heading, citeContainer);

        alertBox.style.marginTop = "-1rem";
        heading.style.marginTop = "0";
        citeContainer.style.marginLeft = "1rem";

        this.alertBox = alertBox;

        // Insert the citation view before the metadata controls
        controls.before(alertBox);

        return alertBox;
      },

      /** Updates the citation information in the alert box. */
      updateAlertBox() {
        const alertBox = this.alertBox || this.addAlertBox();
        const citeContainer = alertBox.querySelector(
          `.${CLASS_NAMES.alertCitation}`,
        );
        const { citationModel } = this;
        const citationView = new CitationView({
          model: citationModel,
          // Don't use styles from default class
          className: "",
          createTitleLink: false,
          openLinkInNewTab: true,
        }).render();
        citeContainer.innerHTML = "";
        citeContainer.appendChild(citationView.el);
      },

      /** Open the citation modal. */
      openCitationModal() {
        this.metadataView[METADATA_VIEW.citationModalProp].show();
      },

      /**
       * Modifies the CitationModalView to add the citation information for the
       * canonical dataset in addition to the citation information for the
       * current dataset.
       */
      modifyCitationModal() {
        const view = this;
        // The CitationModalView is recreated each time it is shown.
        const citationModalView =
          this.metadataView[METADATA_VIEW.citationModalProp];
        this.listenToOnce(citationModalView, "rendered", () => {
          citationModalView.canonicalDatasetMods = true;
          // Add heading for each citation
          const heading = document.createElement("h5");
          heading.textContent = CITATION_TITLE_DATAONE;
          citationModalView.citationContainer.prepend(heading);

          // Add the citation for the canonical dataset
          citationModalView.insertCitation(view.citationModel, false);

          // Add a heading for the canonical dataset citation
          const headingOriginal = document.createElement("h5");
          headingOriginal.textContent = CITATION_TITLE_CANONICAL;
          citationModalView.citationContainer.prepend(headingOriginal);
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
