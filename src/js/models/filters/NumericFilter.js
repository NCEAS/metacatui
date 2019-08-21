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
        nodeName: "numericFilter",
        min: null,
        max: null,
        rangeMin: null,
        rangeMax: null,
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

      try{
        var modelJSON = Filter.prototype.parse(xml);

        //Find the min XML node
        var minNode = $(xml).find("min"),
            maxNode = $(xml).find("max"),
            rangeMinNode = $(xml).find("rangeMin"),
            rangeMaxNode = $(xml).find("rangeMax"),
            valueNode = $(xml).find("value");

        if( minNode.length ){
          modelJSON.min = parseFloat(minNode[0].textContent);
        }
        if( maxNode.length ){
          modelJSON.max = parseFloat(maxNode[0].textContent);
        }
        if( rangeMinNode.length ){
          modelJSON.rangeMin = parseFloat(rangeMinNode[0].textContent);
        }
        if( rangeMaxNode.length ){
          modelJSON.rangeMax = parseFloat(rangeMaxNode[0].textContent);
        }
        if( valueNode.length ){
          modelJSON.values = [parseFloat(valueNode[0].textContent)];
        }

        //If a range min and max was given, or if a min and max value was given,
        // then this NumericFilter should be presented as a numeric range (rather than
       // an exact numeric value).
        if( rangeMinNode.length || rangeMinNode.length || minNode || maxNode ){
          //Set the range attribute on the JSON
          modelJSON.range = true;
        }
        else{
          //Set the range attribute on the JSON
          modelJSON.range = false;
        }

        //If a range step was given, save it
        if( modelJSON.range ){
          var stepNode = $(xml).find("step");

          if( stepNode.length ){
            //Parse the text content of the node into a float
            modelJSON.step = parseFloat(stepNode[0].textContent);
          }
        }
      }
      catch(e){
        //If an error occured while parsing the XML, return a blank JS object
        //(i.e. this model will just have the default values).
        return {};
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
      if( this.get("min") != this.get("rangeMin") || this.get("max") != this.get("rangeMax") ){

        //Iterate over each filter field and add to the query string
        _.each(this.get("fields"), function(field, i, allFields){

          //Construct a query string for ranges
          if( this.get("range") ){

            //Get the minimum and maximum values
            var max = this.get("max"),
                min = this.get("min");

            //If no min or max was set, but there is a value, construct an exact value match query
            if( !min && min !== 0 && !max && max !== 0 &&
                     (this.get("values")[0] || this.get("values")[0] === 0) ){
              queryString += field + ":" + this.get("values")[0];
            }
            //If there is no min or max or value, set an empty query string
            else if( !min && min !== 0 && !max && max !== 0 &&
                     ( !this.get("values")[0] && this.get("values")[0] !== 0) ){
              queryString = "";
            }
            //If there is at least a min or max
            else{
              //If there's a min but no max, set the max to a wildcard (unbounded)
              if( (min || min === 0) && !max ){
                max = "*";
              }
              //If there's a max but no min, set the min to a wildcard (unbounded)
              else if ( !min && min !== 0 && max ){
                min = "*";
              }
              //If the max is higher than the min, set the max to a wildcard (unbounded)
              else if( (max || max === 0) && (min || min === 0) && (max < min) ){
                max = "*";
              }

              //Add the range for this field to the query string
              queryString += field + ":[" + min + "%20TO%20" + max + "]";
            }
          }
          //If there is a value set, construct an exact numeric match query
          else if( this.get("values")[0] || this.get("values")[0] === 0 ){
            queryString += field + ":" + this.get("values")[0];
          }

          //If there is another field, add an operator
          if( allFields[i+1] && queryString.length ){
            queryString += "%20" + this.get("operator") + "%20";
          }

        }, this);

        //If there is more than one field, wrap the query in paranthesis
        if( this.get("fields").length > 1 && queryString.length ){
          queryString = "(" + queryString + ")";
        }

      }

      return queryString;

    },

    /**
     * Updates the XML DOM with the new values from the model
     *  @inheritdoc
     *  @return {XMLElement} An updated numericFilter XML element from a project document
    */
    updateDOM:function(options){

      try{
        if( typeof options == "undefined" ){
          var options = {};
        }

        var objectDOM = Filter.prototype.updateDOM.call(this);

        //Numeric Filters don't use matchSubstring nodes
        $(objectDOM).children("matchSubstring").remove();

        //Get a clone of the original DOM
        var originalDOM;
        if( this.get("objectDOM") ){
          originalDOM = this.get("objectDOM").cloneNode(true);
        }

        // Get new numeric data
        var numericData = {
          min: this.get("min"),
          max: this.get("max")
        };

        if( !options.forCollection ){
          numericData = _.extend(numericData, {
            rangeMin: this.get("rangeMin"),
            rangeMax: this.get("rangeMax"),
            step: this.get("step")
          });
        }

        // Make subnodes and append to DOM
        _.map(numericData, function(value, nodeName){

          if( value || value === 0 ){

            //If this value is the same as the default value, but it wasn't previously serialized,
            if( (value == this.defaults()[nodeName]) &&
                ( !$(originalDOM).children(nodeName).length ||
                  ($(originalDOM).children(nodeName).text() != value + "-01-01T00:00:00Z") )){
                return;
            }

            var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
            $(nodeSerialized).text(value);
            $(objectDOM).append(nodeSerialized);
          }

        }, this);

        //Remove filterOptions for collection definition filters
        if( options.forCollection ){
          $(objectDOM).children("filterOptions").remove();
        }
        else{
          //Make sure the filterOptions are listed last
          //Get the filterOptions element
          var filterOptions = $(objectDOM).children("filterOptions");
          //If the filterOptions exist
          if( filterOptions.length ){
            //Detach from their current position and append to the end
            filterOptions.detach();
            $(objectDOM).append(filterOptions);
          }
        }

        return objectDOM;
      }
      catch(e){
        return "";
      }

    },

    /**
    * Creates a human-readable string that represents the value set on this model
    * @return {string}
    */
    getReadableValue: function(){

      var readableValue = "";

      var min = this.get("min"),
          max = this.get("max"),
          value = this.get("values")[0];

      if( !value && value !== 0 ){
        //If there is a min and max
        if( (min || min === 0) && (max || max === 0) ){
          readableValue = min + " to " + max;
        }
        //If there is only a max
        else if(max || max === 0){
          readableValue = "No more than " + max;
        }
        else{
          readableValue = "At least " + min;
        }
      }
      else{
        readableValue = value;
      }

      return readableValue;

    }

  });

  return NumericFilter;
});
