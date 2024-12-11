"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/bioportalAnnotationTemplate.html",
], ($, _, Backbone, AnnotationPopoverTemplate) => {
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
       * The template for the popover content that appears when the user clicks
       * on the annotation.
       * @type {UnderscoreTemplate}
       */
      popoverTemplate: _.template(AnnotationPopoverTemplate),

      /** @inheritdoc */
      events: {
        click: "handleClick",
        "click .annotation-popover-findmore": "findMore",
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
       * @property {jQuery|null} popover - The popover instance associated with
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
       * The property part of the annotation
       * @type {AnnotationPart}
       */
      property: null,

      /**
       * The value part of the annotation
       * @type {AnnotationPart}
       */
      value: null,

      /** @inheritdoc */
      initialize() {
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

          return;
        }

        this.property = {
          type: "property",
          el: null,
          popover: null,
          label: null,
          uri: null,
          definition: null,
          ontology: null,
          ontologyName: null,
          resolved: false,
        };

        this.value = {
          type: "value",
          el: null,
          popover: null,
          label: null,
          uri: null,
          definition: null,
          ontology: null,
          ontologyName: null,
          resolved: false,
        };

        this.property.el = this.$el.children(".annotation-property");
        this.value.el = this.$el.children(".annotation-value");

        // Bail now if things aren't set up right
        if (!this.property.el || !this.value.el) {
          return;
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
      },

      /**
       * Click handler for when the user clicks either the property or the value
       * portion of the pill.
       *
       * If the popover hasn't yet been created for either, we create the
       * popover and query BioPortal for more information. Otherwise, we do
       * nothing and Bootstrap's default popover handling is triggered, showing
       * the popover.
       * @param {Event} e - Click event
       */
      handleClick(e) {
        if (!this.property || !this.value) {
          return;
        }

        if (e.target.className === "annotation-property") {
          if (this.property.popover) {
            return;
          }

          this.createPopover("property");
          this.property.popover.popover("show");
          this.queryAndUpdate("property");
        } else if (
          e.target.className === "annotation-value" ||
          e.target.className === "annotation-value-text"
        ) {
          if (this.value.popover) {
            return;
          }

          this.createPopover("value");
          this.value.popover.popover("show");
          this.queryAndUpdate("value");
        }
      },

      /**
       * Update the value popover with the current state
       * @param {"property"|"value"} annotationPart - Which annotation part to
       * create a popover for.
       */
      createPopover(annotationPart) {
        const popoverTarget = this[annotationPart];

        const newContent = this.popoverTemplate({
          context: this.context,
          label: popoverTarget.label,
          uri: popoverTarget.uri,
          definition: popoverTarget.definition,
          ontology: popoverTarget.ontology,
          ontologyName: popoverTarget.ontologyName,
          resolved: popoverTarget.resolved,
          propertyURI: this.property.uri,
          propertyLabel: this.property.label,
          valueURI: this.value.uri,
          valueLabel: this.value.label,
        });

        popoverTarget.el.data("content", newContent);

        popoverTarget.popover = popoverTarget.el.popover({
          container: popoverTarget.el,
          delay: 500,
          trigger: "click",
        });
      },

      /**
       * Find a definition for the value URI either from cache or from
       * Bioportal. Updates the popover if necessary.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * query for a definition.
       */
      queryAndUpdate(annotationPart) {
        const popoverTarget = this[annotationPart];

        if (popoverTarget.resolved) {
          return;
        }

        const viewRef = this;
        const cache = MetacatUI.appModel.get("bioportalLookupCache");
        const token = MetacatUI.appModel.get("bioportalAPIKey");

        // Attempt to grab from cache first
        if (cache && cache[popoverTarget.uri]) {
          popoverTarget.definition = cache[popoverTarget.uri].definition;
          popoverTarget.ontology = cache[popoverTarget.uri].links.ontology;

          // Try to get a simpler name for the ontology, rather than just using
          // the ontology URI, which is all Bioportal gives back
          popoverTarget.ontologyName = this.getFriendlyOntologyName(
            cache[popoverTarget.uri].links.ontology,
          );
          popoverTarget.resolved = true;
          viewRef.updatePopover(annotationPart);

          return;
        }

        // Verify token before moving on
        if (typeof token !== "string" || token.length === 0) {
          popoverTarget.resolved = true;

          return;
        }

        // Query the API and handle the response TODO: Looks like we should
        // proxy this so the token doesn't leak
        const url = `${MetacatUI.appModel.get(
          "bioportalSearchUrl",
        )}?q=${encodeURIComponent(popoverTarget.uri)}&apikey=${token}`;

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
            (result) => result["@id"] && result["@id"] === popoverTarget.uri,
          );

          // Verify structure of response looks right and bail out if it doesn't
          if (
            !match ||
            !match.definition ||
            !match.definition.length ||
            !match.definition.length > 0
          ) {
            popoverTarget.resolved = true;

            return;
          }

          const [definition] = match.definition;
          popoverTarget.definition = definition;
          popoverTarget.ontology = match.links.ontology;

          // Try to get a simpler name for the ontology, rather than just using
          // the ontology URI, which is all Bioportal gives back
          popoverTarget.ontologyName = viewRef.getFriendlyOntologyName(
            match.links.ontology,
          );

          popoverTarget.resolved = true;
          viewRef.updateCache(popoverTarget.uri, match);
          viewRef.updatePopover(annotationPart);
        });
      },

      /**
       * Update the popover data and raw HTML. This is necessary because we want
       * to create the popover before we fetch the data to populate it from
       * BioPortal and Bootstrap Popovers are designed to be static.
       *
       * The main trick I had to figure out here was that I could access the
       * underlying content member of the popover with
       * popoverData.options.content which wasn't documented in the API.
       * @param {"property"|"value"} annotationPart - The annotation part to
       * update
       */
      updatePopover(annotationPart) {
        const popoverTarget = this[annotationPart];

        const popoverContent = $(popoverTarget.popover).find(
          ".popover-content",
        );

        const newContent = this.popoverTemplate({
          context: this.context,
          label: popoverTarget.label,
          uri: popoverTarget.uri,
          definition: popoverTarget.definition,
          ontology: popoverTarget.ontology,
          ontologyName: popoverTarget.ontologyName,
          resolved: popoverTarget.resolved,
          propertyURI: popoverTarget.uri,
          propertyLabel: popoverTarget.label,
          valueURI: this.value.uri,
          valueLabel: this.value.label,
        });

        // Update both the existing DOM and the underlying data attribute in
        // order to persist the updated content between displays of the popover

        // Update the Popover first
        //
        // This is a hack to work around the fact that we're updating the
        // content of the popover after it is created. I read the source for
        // Bootstrap's Popover and it showed the popover is generated from the
        // data-popover attribute's content which has an options.content member
        // we can modify directly
        const popoverData = $(popoverTarget.el).data("popover");

        if (popoverData && popoverData.options && popoverData.options) {
          popoverData.options.content = newContent;
        }

        $(popoverTarget.el).data("popover", popoverData);

        // Then update the DOM on the open popover
        $(popoverContent).html(newContent);
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

        // Find the URI we need to filter on. Try the value first
        let parent = $(e.target).parents(".annotation-value");

        // Fall back to finding the URI from the property
        if (parent.length <= 0) {
          parent = $(e.target).parents(".annotation-property");
        }

        // Bail if we found neither
        if (parent.length <= 0) {
          return;
        }

        // Now grab the label and URI and filter
        const label = $(parent).data("label");
        const uri = $(parent).data("uri");

        if (!label || !uri) {
          return;
        }

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
