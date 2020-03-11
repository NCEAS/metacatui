/* global define */
"use strict";

define(["jquery", "underscore", "backbone"], function($, _, Backbone) {

    /*
     * A Citation Model represents a single Citation Object returned by the metrics-service
     * See: https://app.swaggerhub.com/apis/nenuji/data-metrics/1.0.0.3
     */
    var Citation = Backbone.Model.extend({
        
        //The name of this type of model
        type: "CitationModel",

        /* The default Citation fields */
        defaults: function() {
            return {
                origin: null,
                title: null,
                year_of_publishing: null,
                source_url: null,
                source_id: null,
                target_id: null,
                publisher: null,
                journal: null,
                volume: null,
                page: null,
                citationMetadata: null
            };
        },

        /* Constructs a new instance */
        initialize: function(attrs, options) {

        }
    });

    return Citation;
});
