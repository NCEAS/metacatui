"use strict";

define(["jquery", "underscore", "backbone", "views/BaseTextView", "text!templates/preservation.html"],
    function($, _, Backbone, BaseTextView, PreservationTemplate) {
        
        /*
         * Extend the TextView to provide new templates
         */
        var TextView = BaseTextView.extend({
            // Add the preservation page template
            preservation: _.template(PreservationTemplate)
        });
        return TextView;
    });