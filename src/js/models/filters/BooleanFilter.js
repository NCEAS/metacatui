/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

  /**
  * @class BooleanFilter
  * @name BooleanFilter
  * @extends Filter
  * @constructs
  */
	var BooleanFilter = Filter.extend(
    /** @lends BooleanFilter.prototype */
    {

    /** @inheritdoc */
    type: "BooleanFilter",

    /** @inheritdoc */
    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        //Boolean filters can't match substrings
        matchSubstring: false,
        //Boolean filters don't use operators
        operator: null
      });
    },

    /**
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
    },

    /**
     * Updates the XML DOM with the new values from the model
     *
     *  @return {Element} An updated booleanFilter XML element from a project document
    */
    updateDOM: function() {

      var objectDOM = Filter.prototype.updateDOM.call(this);

      // Get the new boolean value
      var value = this.get("value");

      // Make a <value> node with the new boolean value and append it to DOM
      if(value){
        var valueSerialized = objectDOM.ownerDocument.createElement("value");
        $(valueSerialized).text(value);
        $(objectDOM).append(valueSerialized);
      }

      return objectDOM

    }

  });

  return BooleanFilter;
});
