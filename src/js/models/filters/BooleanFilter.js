/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

	var BooleanFilter = Filter.extend({

    type: "BooleanFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        trueLabel: null,
        falseLabel: null
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

      //Parse the trueLabel and falseLabels
      modelJSON.trueLabel = this.parseTextNode(xml, "trueLabel");
      modelJSON.falseLabel = this.parseTextNode(xml, "falseLabel");

      return modelJSON;
    }

  });

  return BooleanFilter;
});
