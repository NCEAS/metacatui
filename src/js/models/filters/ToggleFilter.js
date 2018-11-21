/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

	var ToggleFilter = Filter.extend({

    type: "ToggleFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        trueLabel: null,
        trueValue: null,
        falseLabel: null,
        falseValue: null
      });
    },

    /*
    * Parses the ToggleFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the ToggleFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      var modelJSON = Filter.prototype.parse(xml);

      //Parse the trueLabel and falseLabels
      modelJSON.trueLabel = this.parseTextNode(xml, "trueLabel");
      modelJSON.trueValue = this.parseTextNode(xml, "trueValue");
      modelJSON.falseLabel = this.parseTextNode(xml, "falseLabel");
      modelJSON.falseValue = this.parseTextNode(xml, "falseValue");

      return modelJSON;
    }

  });

  return ToggleFilter;
});
