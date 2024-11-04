define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/bioportalAnnotationTemplate.html",
], function ($, _, Backbone, AnnotationPopoverTemplate) {
  "use strict";

  /**
   * @class AnnotationView
   * @classdesc A view of a single semantic annotation for a metadata field. It is usually displayed on the {@link MetadataView}.
   * @classcategory Views
   * @extends Backbone.View
   * @screenshot views/AnnotationView.png
   * @constructor
   */
  var AnnotationView = Backbone.View.extend(
    /** @lends AnnotationView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "AnnotationView",
      className: "annotation-view",
      annotationPopoverTemplate: _.template(AnnotationPopoverTemplate),

      el: null,

      events: {
        click: "handleClick",
        "click .annotation-popover-findmore": "findMore",
      },

      /**
       * Context string is a human-readable bit of text that comes out of the
       * Metacat view service and describes the context of the annotation
       * i.e., what entity, or which attribute within which entity the
       * annotation is on
       */
      context: null,

      // State. See initialize(), we store a bunch of info in these
      property: null,
      value: null,

      initialize: function () {
        // Detect legacy pill DOM structure with the old arrow,
        // ┌───────────┬───────┬───┐
        // │ property  │ value │ ↗ │
        // └───────────┴───────┴───┘
        // clean up, and disable ourselves. This can be removed at some
        // point in the future
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

        // Decode HTML tags in the context string, which is passed in as
        // an HTML attribute from the XSLT so it needs encoding of some sort
        // Note: Only supports < and > at this point
        if (this.context) {
          this.context = this.context.replace("&lt;", "<").replace("&gt;", ">");
        }
      },

      /**
       * Click handler for when the user clicks either the property or the
       * value portion of the pill.
       *
       * If the popover hasn't yet been created for either, we create the
       * popover and query BioPortal for more information. Otherwise, we do
       * nothing and Bootstrap's default popover handling is triggered,
       * showing the popover.
       *
       * @param {Event} e - Click event
       */
      handleClick: function (e) {
        if (!this.property || !this.value) {
          return;
        }

        if (e.target.className === "annotation-property") {
          if (this.property.popover) {
            return;
          }

          this.createPopover(this.property);
          this.property.popover.popover("show");
          this.queryAndUpdate(this.property);
        } else if (
          e.target.className === "annotation-value" ||
          e.target.className === "annotation-value-text"
        ) {
          if (this.value.popover) {
            return;
          }

          this.createPopover(this.value);
          this.value.popover.popover("show");
          this.queryAndUpdate(this.value);
        }
      },

      /**
       * Update the value popover with the current state
       *
       * @param {Object} which - Which popover to create. Either this.property
       * or this.value.
       */
      createPopover: function (which) {
        var new_content = this.annotationPopoverTemplate({
          context: this.context,
          label: which.label,
          uri: which.uri,
          definition: which.definition,
          ontology: which.ontology,
          ontologyName: which.ontologyName,
          resolved: which.resolved,
          propertyURI: this.property.uri,
          propertyLabel: this.property.label,
          valueURI: this.value.uri,
          valueLabel: this.value.label,
        });

        which.el.data("content", new_content);

        which.popover = which.el.popover({
          container: which.el,
          delay: 500,
          trigger: "click",
        });
      },

      /**
       * Find a definition for the value URI either from cache or from
       * Bioportal. Updates the popover if necessary.
       *
       * @param {Object} which - Which popover to create. Either this.property
       * or this.value.
       */
      queryAndUpdate: function (which) {
        if (which.resolved) {
          return;
        }

        var viewRef = this,
          cache = MetacatUI.appModel.get("bioportalLookupCache"),
          token = MetacatUI.appModel.get("bioportalAPIKey");

        // Attempt to grab from cache first
        if (cache && cache[which.uri]) {
          which.definition = cache[which.uri].definition;
          which.ontology = cache[which.uri].links.ontology;

          // Try to get a simpler name for the ontology, rather than just
          // using the ontology URI, which is all Bioportal gives back
          which.ontologyName = this.getFriendlyOntologyName(
            cache[which.uri].links.ontology,
          );
          which.resolved = true;
          viewRef.updatePopover(which);

          return;
        }

        // Verify token before moving on
        if (typeof token !== "string" || token.length === 0) {
          which.resolved = true;

          return;
        }

        // Query the API and handle the response
        // TODO: Looks like we should proxy this so the token doesn't leak
        var url =
          MetacatUI.appModel.get("bioportalSearchUrl") +
          "?q=" +
          encodeURIComponent(which.uri) +
          "&apikey=" +
          token;

        $.get(url, function (data) {
          var match = null;

          // Verify response structure before trusting it
          if (
            !data.collection ||
            !data.collection.length ||
            !data.collection.length > 0
          ) {
            return;
          }

          // Find the first match by URI
          match = _.find(data.collection, function (result) {
            return result["@id"] && result["@id"] === which.uri;
          });

          // Verify structure of response looks right and bail out if it
          // doesn't
          if (
            !match ||
            !match.definition ||
            !match.definition.length ||
            !match.definition.length > 0
          ) {
            which.resolved = true;

            return;
          }

          which.definition = match.definition[0];
          which.ontology = match.links.ontology;

          // Try to get a simpler name for the ontology, rather than just
          // using the ontology URI, which is all Bioportal gives back
          which.ontologyName = viewRef.getFriendlyOntologyName(
            match.links.ontology,
          );

          which.resolved = true;
          viewRef.updateCache(which.uri, match);
          viewRef.updatePopover(which);
        });
      },

      /**
       * Update the popover data and raw HTML. This is necessary because
       * we want to create the popover before we fetch the data to populate
       * it from BioPortal and Bootstrap Popovers are designed to be static.
       *
       * The main trick I had to figure out here was that I could access
       * the underlying content member of the popover with
       * popover_data.options.content which wasn't documented in the API.
       *
       * @param {Object} which - Which popover to create. Either this.property
       * or this.value.
       */
      updatePopover: function (which) {
        var popover_content = $(which.popover).find(".popover-content");

        var new_content = this.annotationPopoverTemplate({
          context: this.context,
          label: which.label,
          uri: which.uri,
          definition: which.definition,
          ontology: which.ontology,
          ontologyName: which.ontologyName,
          resolved: which.resolved,
          propertyURI: which.uri,
          propertyLabel: which.label,
          valueURI: this.value.uri,
          valueLabel: this.value.label,
        });

        // Update both the existing DOM and the underlying data
        // attribute in order to persist the updated content between
        // displays of the popover

        // Update the Popover first
        //
        // This is a hack to work around the fact that we're updating the
        // content of the popover after it is created. I read the source
        // for Bootstrap's Popover and it showed the popover is generated
        // from the data-popover attribute's content which has an
        // options.content member we can modify directly
        var popover_data = $(which.el).data("popover");

        if (popover_data && popover_data.options && popover_data.options) {
          popover_data.options.content = new_content;
        }

        $(which.el).data("popover", popover_data);

        // Then update the DOM on the open popover
        $(popover_content).html(new_content);
      },

      /**
       * Update the cache for a given term.
       *
       * @param {string} term - The term URI
       * @param {Object} match - The BioPortal match object for the term
       */
      updateCache: function (term, match) {
        var cache = MetacatUI.appModel.get("bioportalLookupCache");

        if (cache && typeof term === "string" && typeof match === "string") {
          cache[term] = match;
        }
      },

      /**
       * Send the user to a pre-canned search for a term.
       *
       * @param {Event} e - Click event
       */
      findMore: function (e) {
        e.preventDefault();

        // Find the URI we need to filter on. Try the value first
        var parent = $(e.target).parents(".annotation-value");

        // Fall back to finding the URI from the property
        if (parent.length <= 0) {
          parent = $(e.target).parents(".annotation-property");
        }

        // Bail if we found neither
        if (parent.length <= 0) {
          return;
        }

        // Now grab the label and URI and filter
        var label = $(parent).data("label"),
          uri = $(parent).data("uri");

        if (!label || !uri) {
          return;
        }

        // Direct the user towards a search for the annotation
        MetacatUI.appSearchModel.clear();
        MetacatUI.appSearchModel.set("annotation", [
          {
            label: label,
            value: uri,
          },
        ]);
        MetacatUI.uiRouter.navigate("data", { trigger: true });
      },

      /**
       * Get a friendly name (ie ECSO) from a long BioPortal URI
       *
       * @param {string} uri - A URI returned from the BioPortal API
       * @return {string}
       */
      getFriendlyOntologyName: function (uri) {
        if (typeof uri === "string") {
          return uri;
        }

        return uri.replace("http://data.bioontology.org/ontologies/", "");
      },
    },
  );

  return AnnotationView;
});
