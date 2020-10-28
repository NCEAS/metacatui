"use strict";

define(["jquery", "underscore", "backbone", "x2js", "models/metadata/eml211/EMLUnit"],
    function($, _, Backbone, X2JS, EMLUnit) {

    /**
     * @class Units
     * @classdesc Units represents the Ecological Metadata Language units list
     * @classcategory Collections
     */
    var Units = Backbone.Collection.extend(
      /** @lends Units.prototype */{

        model: EMLUnit,

        comparator: function(unit){
        	return unit.get("_name").charAt(0).toUpperCase() + unit.get("_name").slice(1);
        },

        /*
         * The URL of the EML unit Dictionary
         */
        url: "https://raw.githubusercontent.com/NCEAS/eml/RELEASE_EML_2_2_0/eml-unitDictionary.xml",

        /* Retrieve the units from the tagged EML Github Repository */
        fetch: function(options) {
        	if(typeof options != {})
        		var options = {};

            var fetchOptions = _.extend({dataType: "text"}, options);

            return Backbone.Model.prototype.fetch.call(this, fetchOptions);

        },

        /* Parse the XML response */
        parse: function(response) {

            // If the collection is already parsed, just return it
            if ( typeof response === "object" ) return response;

            // Otherwise, parse it
            var x2js = new X2JS();
            var units = x2js.xml_str2json(response);

            return units.unitList.unit;
        }

    });

    return Units;
});
