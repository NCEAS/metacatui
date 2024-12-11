"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "semantic",
  "text!templates/bioportalAnnotationTemplate.html",
], ($, _, Backbone, _Semantic, AnnotationPopupTemplate) => {
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
       * The template for the popup content that appears when the user clicks
       * on the annotation.
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
       * @property {jQuery|null} popup - The popup instance associated with
       * this part, if created.
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
      },

      /** @inheritdoc */
      render() {
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

        this.property.el = this.$el.children(".annotation-property");
        this.value.el = this.$el.children(".annotation-value");

        // Bail now if things aren't set up right
        if (!this.property.el || !this.value.el) {
          return this;
        }

        this.context = this.$el.data("context");
        this.property.label = this.property.el.data("label");
        this.property.uri = this.property.el.data("uri");
        this.value.label = this.value.el.data("label");
        this.value.uri = this.value.el.data("uri");

        // Decode HTML tags in the context string, which is passed in as an HTML
        // attribute from the XSLT so it needs encoding of some sort Note: Only
        // supports < and > at this point
        if (this.context) {
          this.context = this.context.replace("&lt;", "<").replace("&gt;", ">");
        }
        return this;
      },

      /**
       * Click handler for when the user clicks either the property or the value
       * portion of the pill.
       *
       * If the popup hasn't yet been created for either, we create the
       * popup and query BioPortal for more information. Otherwise, we do
       * nothing and Semantic's default popup handling is triggered, showing
       * the popup.
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
        const propertyClasses = ["annotation-property"];
        const valueClasses = ["annotation-value", "annotation-value-text"];
        if (propertyClasses.some((cls) => classes.contains(cls))) {
          annotationPart = "property";
        } else if (valueClasses.some((cls) => classes.contains(cls))) {
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

        popupTarget.el.popup({
          on: "click",
          content: "Loading...",
          variation: "mini",
          context: this.$el,
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
       * Find a definition for the value URI either from cache or from
       * Bioportal. Updates the popup if necessary.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * query for a definition.
       */
      queryAndUpdate(annotationPart) {
        const popupTarget = this[annotationPart];

        if (popupTarget.resolved) {
          return;
        }

        const viewRef = this;
        const cache = MetacatUI.appModel.get("bioportalLookupCache");
        const token = MetacatUI.appModel.get("bioportalAPIKey");

        // Attempt to grab from cache first
        if (cache && cache[popupTarget.uri]) {
          popupTarget.definition = cache[popupTarget.uri].definition;
          popupTarget.ontology = cache[popupTarget.uri].links.ontology;

          // Try to get a simpler name for the ontology, rather than just using
          // the ontology URI, which is all Bioportal gives back
          popupTarget.ontologyName = this.getFriendlyOntologyName(
            cache[popupTarget.uri].links.ontology,
          );
          popupTarget.resolved = true;
          viewRef.updatePopup(annotationPart);

          return;
        }

        // Verify token before moving on
        if (typeof token !== "string" || token.length === 0) {
          popupTarget.resolved = true;

          return;
        }

        // Query the API and handle the response TODO: Looks like we should
        // proxy this so the token doesn't leak
        const url = `${MetacatUI.appModel.get(
          "bioportalSearchUrl",
        )}?q=${encodeURIComponent(popupTarget.uri)}&apikey=${token}`;

        $.get(url, (data) => {
          let match = null;

          // Verify response structure before trusting it
          if (
            !data.collection ||
            !data.collection.length ||
            !data.collection.length > 0
          ) {
            return;
          }

          // Find the first match by URI
          match = _.find(
            data.collection,
            (result) => result["@id"] && result["@id"] === popupTarget.uri,
          );

          // Verify structure of response looks right and bail out if it doesn't
          if (
            !match ||
            !match.definition ||
            !match.definition.length ||
            !match.definition.length > 0
          ) {
            popupTarget.resolved = true;

            return;
          }

          const [definition] = match.definition;
          popupTarget.definition = definition;
          popupTarget.ontology = match.links.ontology;

          // Try to get a simpler name for the ontology, rather than just using
          // the ontology URI, which is all Bioportal gives back
          popupTarget.ontologyName = viewRef.getFriendlyOntologyName(
            match.links.ontology,
          );

          popupTarget.resolved = true;
          viewRef.updateCache(popupTarget.uri, match);
          viewRef.updatePopup(annotationPart);
        });
      },

      /**
       * Update the popup data and raw HTML.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * update
       */
      updatePopup(annotationPart) {
        const popupTarget = this[annotationPart];

        const newContent = this.popupTemplate({
          context: this.context,
          label: popupTarget.label,
          uri: popupTarget.uri,
          definition: popupTarget.definition,
          ontology: popupTarget.ontology,
          ontologyName: popupTarget.ontologyName,
          resolved: popupTarget.resolved,
          propertyURI: this.property.uri,
          propertyLabel: this.property.label,
          valueURI: this.value.uri,
          valueLabel: this.value.label,
          annotationPart,
        });

        popupTarget.el?.popup("change content", newContent);
      },

      /**
       * Update the cache for a given term.
       * @param {string} term - The term URI
       * @param {object} match - The BioPortal match object for the term
       */
      updateCache(term, match) {
        const cache = MetacatUI.appModel.get("bioportalLookupCache");

        if (cache && typeof term === "string" && typeof match === "string") {
          cache[term] = match;
        }
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
        if (typeof uri === "string") {
          return uri;
        }

        return uri.replace("http://data.bioontology.org/ontologies/", "");
      },
    },
  );

  return AnnotationView;
});
