/*global define */
define(['jquery',
    'underscore',
    'backbone',
    'text!templates/bioportalAnnotationTemplate.html',],
    function($, _, Backbone, AnnotationPopoverTemplate) {
    'use strict';

    var AnnotationView = Backbone.View.extend(
      /** @lends AnnotationView.prototype */{
        className: 'annotation-view',
        annotationPopoverTemplate: _.template(AnnotationPopoverTemplate),

        el: null,
        context: null,
        propertyLabel: null,
        propertyURI: null,
        valueLabel: null,
        valueURI: null,
        valueDefinition: null,
        valueOntology: null,
        valueOntologyName: null,

        // Stores a reference to the child .annotation el which is handy but
        // I'm no sure it's needed
        // TODO: Rename to popoverReference or something or remove entirley
        popoverSource: null,

        // Helps track visibility of the popover so we know when it's safe to
        // destroy it and update it with new content
        visible: null,

        // Stores whether we successfully looked and did or did not find the
        // definition of the annotation value, either from cache or from
        // Bioportal
        valueResolved: null,

        events: {
            "click" : "onClick",
            "click .annotation-popover-findmore" : "findMore",
            "click .annotation-findmore" : "findMore"
        },

        initialize: function () {
            this.context = this.$el.data('context');
            this.propertyLabel = this.$el.data('propertyLabel');
            this.propertyURI = this.$el.data('propertyUri');
            this.valueLabel = this.$el.data('valueLabel');
            this.valueURI = this.$el.data('valueUri');

            // Decode HTML tags in the context string, which is passed in as
            // an HTML attribute from the XSLT so it needs encoding of some sort
            // Note: Only supports < and > at this point
            if( this.context ){
              this.context = this.context.replace("&lt;", "<").replace("&gt;", ">");
            }

            this.valueResolved = false;
        },

        render: function () {

          //If there is no value URI, then there is probably no annotation
          // metadata to render, so exit the function.
          if( typeof this.valueURI == "undefined" ){
            return this;
          }

          this.createPopover();

          return this;
        },

        // Helps us fetch data from the API on first interaction
        onClick: function () {
            this.queryAndUpdateValue();
        },

        /**
         * Find a definition for the value URI either from cache or from
         * Bioportal. Updates the popover if necessary.
         */
        queryAndUpdateValue: function () {
            if (this.valueResolved) {
                return;
            }

            var viewRef = this,
                cache = MetacatUI.appModel.get("bioportalLookupCache"),
                token = MetacatUI.appModel.get("bioportalAPIKey");

            // Attempt to grab from cache first

            if (cache && cache[this.valueURI]) {
                this.valueDefinition = cache[this.valueURI].definition;
                this.valueOntology = cache[this.valueURI].links.ontology;

                // Try to get a simpler name for the ontology, rather than just
                // using the ontology URI, which is all Bioportal gives back
                this.valueOntologyName = this.getFriendlyOntologyName(cache[this.valueURI].links.ontology);

                this.updatePopover();
                this.valueResolved = true;

                return;
            }

            // Verify token before moving on
            if (typeof token !== "string" || token.length === 0) {
                this.valueResolved = true;

                return;
            }

            // Query the API and handle the response
            // TODO: Looks like we should proxy this so the token doesn't leak
            var url = MetacatUI.appModel.get("bioportalSearchUrl") +
                "?q=" + encodeURIComponent(this.valueURI) +
                "&apikey=" +
                token;

            $.get(url, function (data) {
                var match = null;

                // Verify response structure before trusting it
                if (!data.collection ||
                    !data.collection.length ||
                    !data.collection.length > 0) {
                    return;
                }

                // Find the first match by URI
                match = _.find(data.collection, function(result) {
                    return result["@id"] && result["@id"] === viewRef.valueURI;
                });

                // Verify structure of response looks right and bail out if it
                // doesn't
                if (!match ||
                    !match.definition ||
                    !match.definition.length ||
                    !match.definition.length > 0) {
                    viewRef.valueResolved = true;
                    viewRef.updatePopover();

                    return;
                }

                viewRef.valueDefinition = match.definition[0];
                viewRef.valueOntology = match.links.ontology;

                // Try to get a simpler name for the ontology, rather than just
                // using the ontology URI, which is all Bioportal gives back
                viewRef.valueOntologyName = viewRef.getFriendlyOntologyName(match.links.ontology);

                viewRef.valueResolved = true;
                viewRef.updatePopover();
                viewRef.updateCache(viewRef.valueURI, match);
            });
        },

        /**
         * Create the Popover for the annotation
         *
         * Note: Has a side-effect of updating this.popoverSource;
         */
        createPopover: function () {
            var new_content = this.annotationPopoverTemplate({
                context: this.context,
                propertyLabel: this.propertyLabel,
                propertyURI: this.propertyURI,
                valueLabel: this.valueLabel,
                valueURI: this.valueURI,
                valueDefinition: this.valueDefinition,
                valueOntology: this.valueOntology,
                valueOntologyName: this.valueOntologyName,
                valueResolved: this.valueResolved
            });

            this.$el.data("content", new_content);

            this.popoverSource = this.$el.popover({
                container: this.$el,
                delay: 500,
                trigger: "click"
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
         */
        updatePopover: function() {
            var popover_content = $(this.$el).find(".popover-content").first();

            var new_content = this.annotationPopoverTemplate({
                context: this.context,
                propertyLabel: this.propertyLabel,
                propertyURI: this.propertyURI,
                valueLabel: this.valueLabel,
                valueURI: this.valueURI,
                valueDefinition: this.valueDefinition,
                valueOntology: this.valueOntology,
                valueOntologyName: this.valueOntologyName,
                valueResolved: this.valueResolved
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
            var popover_data = $(this.$el).data('popover');

            if (popover_data && popover_data.options && popover_data.options) {
                popover_data.options.content = new_content;
            }

            $(this.$el).data('popover', popover_data);

            // Then update the DOM on the open popover
            $(popover_content).html(new_content);
        },

        /**
         * Update the cache for a given term.
         * @param term: (string) The URI
         * @param match: (object) The BioPortal match object for the term
        */
        updateCache: function(term, match) {
            var cache = MetacatUI.appModel.get("bioportalLookupCache");

            if (cache &&
                typeof term === "string" &&
                typeof match === "string") {
                cache[term] = match;
            }
        },

        /**
         * Send the user to a pre-canned search for a term.
         *
         * This gets called either from the popover or from clicking on the pill
         * itself.
         */
        findMore: function(e) {
            e.preventDefault();

            var valueURI,
                valueLabel,
                pill = $(e.target).parents(".annotation");

            // Decide whether we clicked from the pill first
            if (pill.length == 1) {
                valueURI = $(pill).data("value-uri");
                valueLabel = $(pill).data("value-label");
            } else {
                valueURI = $(e.target).data("uri");
                valueLabel = $(e.target).text();
            }

            // Bail out if we didn't get a valueURI to search
            if (typeof valueURI === "undefined") {
                return;
            }

            // Direct the user towards a search for the annotation
            MetacatUI.appSearchModel.clear();
            MetacatUI.appSearchModel.set('annotation', [{
                label: valueLabel,
                value: valueURI
            }]);
            MetacatUI.uiRouter.navigate('data', {trigger: true});
        },

        getFriendlyOntologyName: function(uri) {
            if ((typeof uri === "string")) {
                return uri;
            }

            return uri.replace("http://data.bioontology.org/ontologies/", "");
        }
    });

    return AnnotationView;
  });
