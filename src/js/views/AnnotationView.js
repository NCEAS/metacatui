"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "semantic",
  "models/ontologies/Bioontology",
  "text!templates/bioportalAnnotationTemplate.html",
], ($, _, Backbone, _Semantic, Bioontology, AnnotationPopupTemplate) => {
  const CLASS_NAMES = {
    property: ["annotation-property"],
    value: ["annotation-value", "annotation-value-text"],
  };
  /**
   * @class AnnotationView
   * @classdesc A view of a single semantic annotation for a metadata field. It
   * is usually displayed on the {@link MetadataView}.
   * @classcategory Views
   * @augments Backbone.View
   * @screenshot views/AnnotationView.png
   * @class
   */
  const AnnotationView = Backbone.View.extend(
    /** @lends AnnotationView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "AnnotationView",

      /** @inheritdoc */
      className: "annotation-view",

      /**
       * The template for the popup content that appears when the user clicks on
       * the annotation.
       * @type {UnderscoreTemplate}
       */
      popupTemplate: _.template(AnnotationPopupTemplate),

      /** @inheritdoc */
      events: {
        click: "handleClick",
        "click .annotation-popup-findmore": "findMore",
      },

      /**
       * Context string is a human-readable bit of text that comes out of the
       * Metacat view service and describes the context of the annotation i.e.,
       * what entity, or which attribute within which entity the annotation is
       * on
       * @type {string}
       */
      context: null,

      /**
       * @typedef {object} AnnotationPart
       * @property {string} type - The type of the annotation part. Either
       * "property" or "value".
       * @property {jQuery|null} el - The jQuery element associated with this
       * part.
       * @property {jQuery|null} popup - The popup instance associated with this
       * part, if created.
       * @property {string|null} label - The human-readable label for this part.
       * @property {string|null} uri - The URI associated with this part.
       * @property {string|null} definition - A textual definition or
       * description of this part.
       * @property {string|null} ontology - The ontology ID or abbreviation this
       * part belongs to.
       * @property {string|null} ontologyName - The full name of the ontology
       * this part belongs to.
       * @property {boolean} resolved - Indicates whether this part has been
       * resolved (e.g., details fetched from BioPortal).
       */

      /**
       * The property part of the annotation. Created in initialize.
       * @type {AnnotationPart}
       */
      property: {},

      /**
       * The value part of the annotation. Created in initialize.
       * @type {AnnotationPart}
       */
      value: {},

      /** @inheritdoc */
      initialize() {
        // Set up the annotation parts
        const annotationParts = ["property", "value"];
        annotationParts.forEach((part) => {
          this[part] = {
            type: part,
            el: null,
            popup: null,
            label: null,
            uri: null,
            definition: null,
            ontology: null,
            ontologyName: null,
            resolved: false,
          };
        });

        // Set up a model to query the BioPortal API
        this.bioontology = new Bioontology({
          ontology: null,
          queryType: "search",
          pageSize: 100,
          include: ["definition"],
          displayLinks: true,
        });
      },

      /** @inheritdoc */
      render() {
        // make main el position relative this.$el.css("position", "relative");
        // this.$el.css("display", "block");

        // Detect legacy pill DOM structure with the old arrow,
        //
        //     ┌───────────┬───────┬───┐
        //     │ property  │ value │ ↗ │
        //     └───────────┴───────┴───┘
        //
        // clean up, and disable ourselves. This can be removed at some point in
        // the future
        if (this.$el.find(".annotation-findmore").length > 0) {
          this.$el.find(".annotation-findmore").remove();
          this.$el.find(".annotation-value").attr("style", "color: white");
          return this;
        }

        this.setAnnotationDataFromDOM();

        return this;
      },

      /**
       * Given the DOM element that was passed in (via {el: ...}), extract the
       * label and URI for both the annoation property and value.
       * @since 0.0.0
       */
      setAnnotationDataFromDOM() {
        const propertyClasses = CLASS_NAMES.property
          .map((cls) => `.${cls}`)
          .join(", ");
        const valueClasses = CLASS_NAMES.value
          .map((cls) => `.${cls}`)
          .join(", ");
        const propertyEl = this.$el.find(propertyClasses).first();
        const valueEl = this.$el.find(valueClasses).first();

        // Bail now if things aren't set up right
        if (!propertyEl || !valueEl) return;

        // Some elements passed in have data direct on the main element
        const annotationData = this.$el.data();
        const { propertyLabel, propertyUri, valueLabel, valueUri, context } =
          annotationData;

        // If the data is not on the main element, it may be on the children.
        const propertyData = propertyEl.data();
        const valueData = valueEl.data();

        // Set the values we've found on the view's annotation part objects
        this.context = context;
        this.property.label = propertyLabel || propertyData.label;
        this.property.uri = propertyUri || propertyData.uri;
        this.value.label = valueLabel || valueData.label;
        this.value.uri = valueUri || valueData.uri;
        this.value.el = valueEl;
        this.property.el = propertyEl;

        // Decode HTML tags in the context string, which is passed in as an HTML
        // attribute from the XSLT so it needs encoding of some sort Note: Only
        // supports < and > at this point
        if (this.context) {
          this.context = this.context.replace("&lt;", "<").replace("&gt;", ">");
        }
      },

      /**
       * Click handler for when the user clicks either the property or the value
       * portion of the pill.
       *
       * If the popup hasn't yet been created for either, we create the popup
       * and query BioPortal for more information. Otherwise, we do nothing and
       * Semantic's default popup handling is triggered, showing the popup.
       * @param {Event} e - Click event
       */
      handleClick(e) {
        if (!this.property || !this.value) {
          return;
        }

        // Determine which part of the annotation was clicked, the property or
        // the value
        let annotationPart = null;
        const classes = e.target.classList;
        if (CLASS_NAMES.property.some((cls) => classes.contains(cls))) {
          annotationPart = "property";
        } else if (CLASS_NAMES.value.some((cls) => classes.contains(cls))) {
          annotationPart = "value";
        }

        // Don't re-create the popup if it already exists or if we can't
        // determine which part was clicked
        if (!annotationPart || this[annotationPart].el.popup("exists")) {
          return;
        }

        // Create & show the popup and query BioPortal for more information
        this.createPopup(annotationPart);
        this.queryAndUpdate(annotationPart);
        this.updatePopup(annotationPart);
        this.showPopup(annotationPart);
      },

      /**
       * Create a new popup for the given annotation part.
       * @param {"property"|"value"} annotationPart Which annotation part to
       * create a popup for.
       */
      createPopup(annotationPart) {
        const popupTarget = this[annotationPart];

        if (popupTarget.el.popup("exists")) return;

        // The parent annotation element must have a position set for the popup
        // to be positioned correctly, particularly in the Attribute editor modal.
        this.$el.css("position", "relative");

        popupTarget.el.popup({
          on: "click",
          content: "Loading...",
          variation: "mini",
          // Create popup within this view (rather than at the end of the body)
          inline: true,
          // Close all other popups when this one is shown
          exclusive: true,
          // Keep the content in the DOM even when hidden so we don't need to
          // recreate it every time
          preserve: true,
        });

        popupTarget.popup = popupTarget.el.popup("get popup");
      },

      /**
       * Show the popup for the given annotation part.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * show the popup for.
       * @since 0.0.0
       */
      showPopup(annotationPart) {
        this[annotationPart].el.popup("show");
      },

      /**
       * Update the popup data and raw HTML.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * update
       */
      updatePopup(annotationPart) {
        const popupTarget = this[annotationPart];

        const newContent = this.popupTemplate({
          ...popupTarget,
          context: this.context,
          propertyURI: this.property.uri,
          propertyLabel: this.property.label,
          valueURI: this.value.uri,
          valueLabel: this.value.label,
          annotationPart,
        });

        popupTarget.el?.popup("change content", newContent);
      },

      /**
       * Find a definition for the value URI either from cache or from
       * Bioportal. Updates the popup if necessary.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * query for a definition.
       */
      async queryAndUpdate(annotationPart) {
        const popupTarget = this[annotationPart];

        // Don't re-query if we already have a definition
        if (popupTarget.resolved) return;

        // Get the BiontologyClass model from either the cache or BioPortal
        const bioClass = await this.findClass(annotationPart);
        const definition = bioClass?.get("definition");

        if (!bioClass || !definition?.length) {
          popupTarget.resolved = true;
          return;
        }

        const ontology =
          bioClass.get("ontology") || bioClass.get("links")?.ontology;
        const ontologyName = this.getFriendlyOntologyName(ontology);

        Object.assign(popupTarget, {
          definition: definition[0],
          ontology,
          ontologyName,
          resolved: true,
        });

        this.updatePopup(annotationPart);
      },

      /**
       * Find a BioPortal class for the given annotation part, either from the
       * cache or by fetching it.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * find a class for
       * @returns {Promise<BioontologyClass|null>} The BioontologyClass model
       * for the annotation part, or null if it could not be found.
       * @since 0.0.0
       */
      async findClass(annotationPart) {
        const { uri } = this[annotationPart];

        // Can't make a query without a URI to search for
        if (!uri) return null;

        // Don't re-fetch if we already have class info
        const cachedClass = this.getClassFromCache(uri);
        if (cachedClass) return cachedClass;

        // Fetch from BioPortal otherwise
        return this.fetchClass(uri);
      },

      /**
       * Get a BioPortal class from the cache.
       * @param {string} uri - The URI of the class to get from the cache
       * @returns {BioontologyClass|null} The BioontologyClass model for the
       * given URI, or null if it could not be found.
       * @since 0.0.0
       */
      getClassFromCache(uri) {
        const cachedClasses = this.bioontology
          .get("collection")
          .restoreFromCache([uri]);

        // We need a definition for the popup, otherwise we must fetch it
        return cachedClasses.find((cls) => cls.get("definition")?.length);
      },

      /**
       * Fetch a BioPortal class from the BioPortal API.
       * @param {string} uri - The URI of the class to fetch
       * @returns {Promise<BioontologyClass|null>} The BioontologyClass model
       * for the given URI, or null if it could not be found.
       * @since 0.0.0
       */
      fetchClass(uri) {
        this.bioontology.set({ searchTerm: uri });

        return new Promise((resolve, reject) => {
          this.listenToOnce(this.bioontology, "sync", (bioontology) => {
            resolve(bioontology.get("collection").get(uri));
          });

          this.bioontology.fetch({
            error: (_model, response) => {
              reject(response);
            },
          });
        });
      },

      /**
       * Send the user to a pre-canned search for a term.
       * @param {Event} e - Click event
       */
      findMore(e) {
        e.preventDefault();

        const { uri, label } = e.target.dataset;
        if (!label || !uri) return;

        // Direct the user towards a search for the annotation
        MetacatUI.appSearchModel.clear();
        MetacatUI.appSearchModel.set("annotation", [
          {
            label,
            value: uri,
          },
        ]);
        MetacatUI.uiRouter.navigate("data", { trigger: true });
      },

      /**
       * Get a friendly name (ie ECSO) from a long BioPortal URI
       * @param {string} uri - A URI returned from the BioPortal API
       * @returns {string} A friendly name for the ontology
       */
      getFriendlyOntologyName(uri) {
        if (typeof uri !== "string") return uri;
        return uri.replace("http://data.bioontology.org/ontologies/", "");
      },
    },
  );

  return AnnotationView;
});
