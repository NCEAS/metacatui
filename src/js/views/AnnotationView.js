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
        popoverSource: null,
        visible: null,
        loaded: null,

        events: {
            "click" : "toggle"
        },

        initialize: function (options) {
            this.termURI = options.termURI;
            this.termLabel = options.termLabel;
            this.termDefinition = "";

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
            if (e.target.className !== "annotation") {
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
            var viewRef = this;
            var popover_content = $(this.$el).find(".popover-content").first();

            // Grab and verify token before moving on
            var token = MetacatUI.appModel.get("bioportalAPIKey");

            if (typeof token !== "string") {
                this.resolved = true;

                return;
            }

            var url = "https://data.bioontology.org/search?q=" +
                encodeURIComponent(this.termURI) +
                "&apikey=" +
                token;

            $.get(url, function (data) {
                var match = null;

                // TODO: Make sure to handle not-found case
                data.collection.filter(function(result) {
                    if (result["@id"] === viewRef.termURI) {
                        match = result;
                    }
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

                // Render updated popover content
                var new_content = viewRef.bioportalTooltipTemplate({
                    definition: match.definition[0],
                    termURI: viewRef.termURI
                });

                // Update both the existing DOM and the underlying data
                // attribute in order to persist the updated content between
                // displays of the popover
                $(viewRef.popoverSource).data("content", new_content);
                $(popover_content).html(new_content);

                viewRef.resolved = true;
            });
        },

        // Note: Has a side-effect of updating this.popoverSource;
        createPopover: function (content) {
            var el = $(this.$el).children("span").first();
            var options = {
                trigger: "click",
                placement: "right",
                container: this.$el,
                title: this.termLabel,
                html: true
            };

            // Override the content if provided, allows us to get around an
            // apparently limitation in underscore related to double quotes
            // in template strings I couldn't figure out
            options.content = content;

            this.popoverSource = el.popover(options);
        }
    });

     return AnnotationView;
  });
