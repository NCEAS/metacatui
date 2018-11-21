/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

	var BooleanFilter = Filter.extend({

    type: "BooleanFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {

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
      modelJSON.value = this.parseTextNode(xml, "value");

      if(modelJSON.value === "true"){
        modelJSON.value = true;
      }
      else if(modelJSON.value === "false"){
        modelJSON.value = false;
      }

      return modelJSON;
    }

  });

  return BooleanFilter;
});
