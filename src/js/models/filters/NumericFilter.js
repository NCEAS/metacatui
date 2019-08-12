/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

  /**
  * @constructs NumericFilter
  * @extends Filter
  */
	var NumericFilter = Filter.extend({

    type: "NumericFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        min: null,
        max: null,
        minDefault: null,
        maxDefault: null,
        range: true,
        step: 0
      });
    },

    /**
    * Parses the numericFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the NumericFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      var modelJSON = Filter.prototype.parse(xml);

      //Find the min XML node
      var minNode = $(xml).find("min"),
          stepNode = $(xml).find("step"),
          rangeNode = $(xml).find("range");

      //If a min XML node is found
      if(minNode.length){
        //Parse the text content of the node into a float
        modelJSON.minDefault = parseFloat(minNode[0].textContent);
        modelJSON.min = modelJSON.minDefault;

        //Find the max XML node
        var maxNode = $(xml).find("max");

        //If a max XML node is found
        if(maxNode.length){
          //Parse the text content of the node into a float
          modelJSON.maxDefault = parseFloat(maxNode[0].textContent);
          modelJSON.max = modelJSON.maxDefault;
        }
      }

      //If a step XML node is found
      if(stepNode.length){
        //Parse the text content of the node into a float
        modelJSON.step = parseFloat(stepNode[0].textContent);
      }

      //If a range XML node is found
      if(rangeNode.length){
        //Parse the text content as a Boolean
        var booleanValue = rangeNode[0].textContent === "false"? false : true;

        //Set the range attribute on the JSON
        modelJSON.range = booleanValue;
      }

      return modelJSON;
    },

    /**
     * Builds a query string that represents this filter.
     *
     * @return {string} The query string to send to Solr
     */
    getQuery: function(){

      //Start the query string
      var queryString = "";

      //Only construct the query if the min or max is different than the default
      if( this.get("min") != this.get("minDefault") || this.get("max") != this.get("maxDefault") ){

        //Iterate over each filter field and add to the query string
        _.each(this.get("fields"), function(field, i, allFields){

          if( this.get("range") ){
            //Add the date range for this field to the query string
            queryString += field + ":[" + this.get("min") + "%20TO%20" + this.get("max") + "]";
          }
          else{
            queryString += field + ":" + this.get("min");
          }

          //If there is another field, add an operator
          if( allFields[i+1] ){
            queryString += "%20" + this.get("operator") + "%20";
          }

        }, this);

        //If there is more than one field, wrap the query in paranthesis
        if( this.get("fields").length > 1 ){
          queryString = "(" + queryString + ")";
        }

      }

      return queryString;

    },

    /**
     * Updates the XML DOM with the new values from the model
     *
     *  @return {XMLElement} An updated numericFilter XML element from a project document
    */
    updateDOM:function(){

      var objectDOM = Filter.prototype.updateDOM.call(this);

      // Get new numeric data
      var numericData = {
        min: this.get("min"),
        max: this.get("max"),
        range: this.get("range"),
        step: this.get("step")
      };

      // Make subnodes and append to DOM
      _.map(numericData, function(value, nodeName){

        if(value){
          var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
          $(nodeSerialized).text(value);
          $(objectDOM).append(nodeSerialized);
        }

      });

      return objectDOM

    }

  });

  return NumericFilter;
});
