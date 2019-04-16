/*global define */
define(['jquery',
    'underscore',
    'backbone',
    'MetricsChart',
    'text!templates/metricModalTemplate.html',
    'collections/Citations',
    'views/CitationListView'],
    function($, _, Backbone) {
    'use strict';

    var AnnotationView = Backbone.View.extend({
        className: 'annotation-view',
        template: _.template('<span class="annotation" title="<%= termLabel %>" data-content="<%= termURI %>"><%= termLabel %></span>'),
        bioportalTooltipTemplate: _.template('<strong>Definition:</strong> <%= definition %><br /><a href="<%= termURI %>" target="_blank"><%= termURI %></a>'),

        termURI: null,
        termLabel: null,
        termDefinition: null,
        popoverSource: null, // Stores a reference to the child .annotation el
                             // which is handy but I'm no sure it's needed
        visible: null,       // Helps track visibility of the popover so we know
                             // when it's safe to destroy it and update it with
                             // new content
        resolved: null,      // Stores whether we successfully looked and did or
                             // did not find the definition of the annotaiton

        events: {
            "click" : "toggle"
        },

        initialize: function (options) {
            this.termURI = options.termURI;
            this.termLabel = options.termLabel;
            this.termDefinition = ""; // Fulfilled later via this.query()
            this.visible = false;
            this.resolved = false; // Whether we queried for more details,
                                   // successful or not
        },

        render: function () {
            this.$el.html(this.template({
                termLabel: this.termLabel,
                termURI: this.termURI,
                termDefinition: this.termDefinition
            }));

            this.createPopover(
                '<a href="' + this.termURI + '" target="_blank">' +
                this.termURI +
                '</a>'
            );

            return this;
        },

        // Destroy the popover if it's visible, stale
        toggle: function (e) {
            // Don't do anything if we clicked on the popover
            // (This lets people click and copy/paste on the popover text, aka
            // normal behavior, since we're overriding the normal click
            // behavior in order to edit the popover after we create and show
            // it )
            if ($(e.target).parent().parent().is(this.$el)) {
                return;
            }

            if (!this.resolved) {
                this.query();
            }

            if (this.visible) {
                // Re-create the popover
                this.popoverSource.popover("destroy");
                this.createPopover();
            }

            this.visible = !this.visible;
        },

        query: function () {
            var viewRef = this,
                popover_content = $(this.$el).find(".popover-content").first(),
                cache = MetacatUI.appModel.get("bioportalLookupCache"),
                token = MetacatUI.appModel.get("bioportalAPIKey");

            // Attempt to grab from cache first
            if (cache && cache[this.termURI]) {
                this.updatePopover(popover_content, cache[this.termURI]);
                this.resolved = true;

                return;
            }

            // Verify token before moving on
            if (typeof token !== "string") {
                this.resolved = true;

                return;
            }

            // Query the API and handle the response
            var url = "https://data.bioontology.org/search?q=" +
                encodeURIComponent(this.termURI) +
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
                    return result["@id"] && result["@id"] === viewRef.termURI;
                });

                // Verify structure of response looks right and bail out if it
                // doesn't
                if (!match ||
                    !match.definition ||
                    !match.definition.length ||
                    !match.definition.length > 0) {
                    viewRef.resolved = true;

                    return;
                }

                viewRef.updatePopover(popover_content, match.definition[0]);

                // Cache the result for next time
                if (cache) {
                    cache[viewRef.termURI] = match.definition[0];
                }

                viewRef.resolved = true;
            });
        },

        /**
         * Create the Popover for the annotation
         *
         * Note: Has a side-effect of updating this.popoverSource;
         *
         * @param {string} content - Optional. HTML content for the popover. If
         * omitted, uses Popover uses the `data-content` attribute on the
         * annotation source element. If provided, overrides.
         */
        createPopover: function (content) {
            var el = $(this.$el).children("span").first();
            var options = {
                trigger: "click",
                placement: "bottom",
                container: this.$el,
                title: this.termLabel,
                html: true
            };

            // Override the content if provided, allows us to get around an
            // apparently limitation in underscore related to double quotes
            // in template strings I couldn't figure out
            options.content = content;

            this.popoverSource = el.popover(options);
        },

        /**
         * Update the existing Popover for this annotation
         *
         * @param {*} popover_content - A JQuery selector or something that can
         * be passed into a JQuery selector to get the container element for the
         * popover's content
         * @param {string} definition - The definition of the annotation's URI
         */
        updatePopover: function(popover_content, definition) {
            // Render updated popover content
            var new_content = this.bioportalTooltipTemplate({
                definition: definition,
                termURI: this.termURI
            });

            // Update both the existing DOM and the underlying data
            // attribute in order to persist the updated content between
            // displays of the popover
            $(this.popoverSource).data("content", new_content);
            $(popover_content).html(new_content);
        }
    });

     return AnnotationView;
  });
