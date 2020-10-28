"use strict";

define(["jquery", "underscore", "backbone"], function($, _, Backbone) {

    /**
     * @class EMLUnit
     * @classdesc An EMLUnit represents a single unit defined in the EML Unit Dictionary
     * @classcategory Models/Metadata/EML211
     */
    var EMLUnit = Backbone.Model.extend(
      /** @lends EMLUnit.prototype */{

        /* The default unit fields */
        defaults: function() {
            return {
                /* With X2JS, attributes are prefixed with _ */
                _id: null,
                _name: null,
                _parentSI: null,
                _multiplierToSI: null,
                _abbreviation: null,
                _unitType: null,
                /* Child elements are not */
                description: null,
            };
        },

        /* Constructs a new instance */
        initialize: function(attrs, options) {
        },

        /* No op - Units are read only */
        save: function() {
            console.log("EMLUnit is read only. Not implemented.");

            return false;
        }
    });

    return EMLUnit;
});
