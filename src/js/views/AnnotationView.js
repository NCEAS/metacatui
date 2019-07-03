/*global define */
define(['jquery',
    'underscore',
    'backbone',
    'text!templates/bioportalAnnotationTemplate.html',],
    function($, _, Backbone, AnnotationPopoverTemplate) {
    'use strict';

    var AnnotationView = Backbone.View.extend({
        className: 'annotation-view',

        // TODO: Consider removing this and just using the underlying HTML as the template
        template: _.template('<div class="annotation" title="<%= propertyLabel %> <%= valueLabel %>" data-content=""><div class="annotation-property"><%= propertyLabel %></div><div class="annotation-value"><%= valueLabel %></div></span>'),

        // TODO: XSS protect
        // TODO: Consider adding a template for this
        annotationPopoverTemplate: _.template(AnnotationPopoverTemplate),

        el: null,
        context: null,
        propertyLabel: null,
        propertyURI: null,
        propertyDefinition: null,
        properyOntology: null,
        valueLabel: null,
        valueURI: null,
        valueDefinition: null,
        valueOntology: null,

        // Stores a reference to the child .annotation el which is handy but
        // I'm no sure it's needed
        // TODO: Rename to popoverReference or something or remove entirley
        popoverSource: null,

        // Helps track visibility of the popover so we know when it's safe to
        // destroy it and update it with new content
        visible: null,

        // Stores whether we successfully looked and did or did not find the
        // definition of the annotation's property or label, either from cache
        // or from Bioportal
        propertyResolved: null,
        valueResolved: null,

        events: {
            "click" : "onClick",
            "click .annotation-popover-findmore" : "findMore"
        },

        initialize: function () {
            this.context = this.$el.data('context');
            this.propertyLabel = this.$el.data('propertyLabel');
            this.propertyURI = this.$el.data('propertyUri');
            this.valueLabel = this.$el.data('valueLabel');
            this.valueURI = this.$el.data('valueUri');

            this.propertyResolved = false;
            this.valueResolved = false;
        },

        render: function () {
            this.createPopover();

            return this;
        },

        // Helps us fetch data from the API on first interaction
        onClick: function () {
            this.queryAndUpdateProperty();
            this.queryAndUpdateValue();
        },

        /* Either look up from cache or query Bioportal to find definitions for
        the annotation property and value and then update the tooltip */
        queryAndUpdateProperty: function () {
            if (this.propertyResolved) {
                return;
            }

            var viewRef = this,
                cache = MetacatUI.appModel.get("bioportalLookupCache"),
                token = MetacatUI.appModel.get("bioportalAPIKey");

            // Attempt to grab from cache first

            // TODO: Update for new popover model
            if (cache && cache[this.propertyURI]) {
                this.propertyDefinition = cache[this.propertyURI].definition;
                this.propertyOntology = cache[this.propertyURI].links.ontology;
                this.updatePopover();
                this.propertyResolved = true;

                return;
            }

            // Verify token before moving on
            if (typeof token !== "string") {
                this.propertyResolved = true;

                return;
            }

            // Query the API and handle the response
            // TODO: Looks like we should proxy this so the token doesn't leak
            var url = "https://data.bioontology.org/search?q=" +
                encodeURIComponent(this.propertyURI) +
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
                    return result["@id"] && result["@id"] === viewRef.propertyURI;
                });

                // Verify structure of response looks right and bail out if it
                // doesn't
                if (!match ||
                    !match.definition ||
                    !match.definition.length ||
                    !match.definition.length > 0) {
                    viewRef.propertyResolved = true;

                    return;
                }

                viewRef.propertyDefinition = match.definition[0];
                viewRef.propertyOntology = match.links.ontology;
                viewRef.updatePopover();
                viewRef.updateCache(viewRef.propertyURI, match);

                viewRef.propertyResolved = true;
            });
        },

        queryAndUpdateValue: function () {
            if (this.valueResolved) {
                return;
            }

            var viewRef = this,
                cache = MetacatUI.appModel.get("bioportalLookupCache"),
                token = MetacatUI.appModel.get("bioportalAPIKey");

            // Attempt to grab from cache first

            // TODO: Update for new popover model
            if (cache && cache[this.valueURI]) {
                this.valueDefinition = cache[this.valueURI].definition;
                this.valueOntology = cache[this.valueURI].links.ontology;
                this.updatePopover();
                this.valueResolved = true;

                return;
            }

            // Verify token before moving on
            if (typeof token !== "string") {
                this.valueResolved = true;

                return;
            }

            // Query the API and handle the response
            // TODO: Looks like we should proxy this so the token doesn't leak
            var url = "https://data.bioontology.org/search?q=" +
                encodeURIComponent(this.valueURI) +
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

                    return;
                }

                viewRef.valueDefinition = match.definition[0];
                viewRef.valueOntology = match.links.ontology;

                viewRef.updatePopover();
                viewRef.updateCache(viewRef.valueURI, match);
                viewRef.valueResolved = true;
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
                propertyDefinition: this.propertyDefinition,
                propertyOntology: this.propertyOntology,
                valueLabel: this.valueLabel,
                valueURI: this.valueURI,
                valueDefinition: this.valueDefinition,
                valueOntology: this.valueOntology
            });

            $(this.$el).data("content", new_content);

            this.popoverSource = $(this.$el).popover({
                container: this.$el,
            });
        },


        updatePopover: function() {
            var popover_content = $(this.$el).find(".popover-content").first();

            var new_content = this.annotationPopoverTemplate({
                context: this.context,
                propertyLabel: this.propertyLabel,
                propertyURI: this.propertyURI,
                propertyDefinition: this.propertyDefinition,
                propertyOntology: this.propertyOntology,
                valueLabel: this.valueLabel,
                valueURI: this.valueURI,
                valueDefinition: this.valueDefinition,
                valueOntology: this.valueOntology
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

        /** */
        updateCache: function(term, match) {
            var cache = MetacatUI.appModel.get("bioportalLookupCache");

            if (cache &&
                typeof term === "string" &&
                typeof match === "string") {
                cache[term] = match;
            }
        },

        findMore: function(e) {
            e.preventDefault();

            var term = $(e.target).text();

            // Direct the user towards a search for the annotation
            MetacatUI.appSearchModel.clear();
			MetacatUI.appSearchModel.set('annotation', [term]);
			MetacatUI.uiRouter.navigate('data', {trigger: true});
        }
    });

    return AnnotationView;
  });
