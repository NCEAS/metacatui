/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

  /**
  * @constructs DateFilter
  * @extends Filter
  */
	var DateFilter = Filter.extend({

    type: "DateFilter",

    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        min: 0,
        max: (new Date()).getUTCFullYear(),
        minDefault: 0,
        maxDefault: (new Date()).getUTCFullYear()
      });
    },

    /*
    * Parses the dateFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the DateFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      var modelJSON = Filter.prototype.parse(xml);

      //Find the min XML node
      var minNode = $(xml).find("min");

      //If a min XML node is found
      if(minNode.length){
        //Parse the text content of the node into a float
        modelJSON.minDefault = (new Date(minNode[0].textContent)).getUTCFullYear();
        modelJSON.min = modelJSON.minDefault;

        //Find the max XML node
        var maxNode = $(xml).find("max");

        //If a max XML node is found
        if(maxNode.length){
          //Parse the text content of the node into a float
          modelJSON.maxDefault = (new Date(maxNode[0].textContent)).getUTCFullYear();
          modelJSON.max = modelJSON.maxDefault;
        }
      }

      return modelJSON;
    },

    /*
     * Builds a query string that represents this filter.
     *
     * @return {string} The query string to send to Solr
     */
    getQuery: function(){

      //Start the query string
      var queryString = "";

      //Only construct the query if the min or max is different than the default
      if( ((this.get("min") != this.defaults().min) && (this.get("min") != this.get("minDefault"))) ||
           ((this.get("max") != this.defaults().max)) && (this.get("max") != this.get("maxDefault")) ){

        //Iterate over each filter field and add to the query string
        _.each(this.get("fields"), function(field, i, allFields){

          //Add the date range for this field to the query string
          queryString += field + ":[" + this.get("min") + "-01-01T00:00:00Z%20TO%20" +
           this.get("max") + "-12-31T00:00:00Z]";

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
     *  @return {XMLElement} An updated dateFilter XML element from a project document
    */
    updateDOM: function(){

      var objectDOM = Filter.prototype.updateDOM.call(this);

      // Get new date data
      var dateData = {
        min: this.get("min"),
        max: this.get("max")
      };

      // Make subnodes <min> and <max> and append to DOM
      _.map(dateData, function(value, nodeName){

        if(value){
          var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
          $(nodeSerialized).text(value);
          $(objectDOM).append(nodeSerialized);
        }

      });

      return objectDOM
    }

  });

  return DateFilter;
});
