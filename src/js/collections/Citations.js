/* global define */
"use strict";

define(['jquery', 'underscore', 'backbone','models/CitationModel'], 
    function($, _, Backbone, CitationModel) {

    /*
     * Citations represents the Citations list
     * found at https://app.swaggerhub.com/apis/nenuji/data-metrics/1.0.0.3.
     * For details regarding a single Citation Entity, refer `models/CitationModel`
     */
    var Citations = Backbone.Collection.extend({

        model: CitationModel,
        
        //The name of this type of collection
        type: "Citations",

        
        /* Parse the JSON response from the metrics-service */
        parse: function(data, options) {
            
            // If the collection is already parsed, just return it
            // Since the response from Metrics Service is JSON objcet we'll
            // simply return it to calling object.
            if ( typeof data === "object" ) return data;
        }

    });

    return Citations;
});
