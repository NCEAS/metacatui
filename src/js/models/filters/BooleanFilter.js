/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

	var BooleanFilter = Filter.extend({

    type: "BooleanFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        //Boolean filters can't match substrings
        matchSubstring: false,
        //Boolean filters don't use operators
        operator: null
      });
    },

    /*
    * Parses the booleanFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the BooleanFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      var modelJSON = Filter.prototype.parse(xml);

      //Parse the boolean value
      modelJSON.values = this.parseTextNode(xml, "value");

      if(modelJSON.values === "true"){
        modelJSON.values = true;
      }
      else if(modelJSON.values === "false"){
        modelJSON.values = false;
      }

      return modelJSON;
    }

  });

  return BooleanFilter;
});
