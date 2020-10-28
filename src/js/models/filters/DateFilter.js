/* global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter'],
    function($, _, Backbone, Filter) {

  /**
  * @class DateFilter
  * @classdesc A search filter whose search term is an exact date or date range
  * @classcategory Models/Filters
  * @constructs DateFilter
  * @extends Filter
  */
	var DateFilter = Filter.extend(
    /** @lends DateFilter.prototype */{

    type: "DateFilter",

    /**
    * The Backbone Model attributes set on this DateFilter
    * @type {object}
    * @extends Filter#defaultts
    * @property {Date} min - The minimum Date to use in the query for this filter
    * @property {Date} max - The maximum Date to use in the query for this filter
    * @property {Date} rangeMin - The earliest possible Date that 'min' can be
    * @property {Date} rangeMax - The latest possible Date that 'max' can be
    * @property {Boolean} matchSubstring - Will always be stet to false, since Dates don't have substrings
    * @property {string} nodeName - The XML node name to use when serializing this model into XML
    */
    defaults: function(){
      return _.extend(Filter.prototype.defaults(), {
        min: 0,
        max: (new Date()).getUTCFullYear(),
        rangeMin: 0,
        rangeMax: (new Date()).getUTCFullYear(),
        matchSubstring: false,
        nodeName: "dateFilter"
      });
    },

    /**
    * Parses the dateFilter XML node into JSON
    *
    * @param {Element} xml - The XML Element that contains all the DateFilter elements
    * @return {JSON} - The JSON object literal to be set on the model
    */
    parse: function(xml){

      try{
        var modelJSON = Filter.prototype.parse.call(this, xml);

        //Get the rangeMin and rangeMax nodes
        var rangeMinNode = $(xml).find("rangeMin"),
            rangeMaxNode = $(xml).find("rangeMax");

        //Parse the range min
        if( rangeMinNode.length ){
          modelJSON.rangeMin = new Date(rangeMinNode[0].textContent).getUTCFullYear();
        }
        //Parse the range max
        if( rangeMaxNode.length ){
          modelJSON.rangeMax = new Date(rangeMaxNode[0].textContent).getUTCFullYear();
        }

        //If this Filter is in a filter group, don't parse the values
        if( !this.get("inFilterGroup") ){
          //Get the min, max, and value nodes
          var minNode = $(xml).find("min"),
              maxNode = $(xml).find("max"),
              valueNode = $(xml).find("value");

          //Parse the min value
          if( minNode.length ){
            modelJSON.min = new Date(minNode[0].textContent).getUTCFullYear();
          }
          //Parse the max value
          if( maxNode.length ){
            modelJSON.max = new Date(maxNode[0].textContent).getUTCFullYear();
          }
          //Parse the value
          if( valueNode.length ){
            modelJSON.values = [new Date(valueNode[0].textContent).getUTCFullYear()];
          }
        }

        //If a range min and max was given, or if a min and max value was given,
        // then this DateFilter should be presented as a date range (rather than
       // an exact date value).
        if( rangeMinNode.length || rangeMinNode.length || minNode || maxNode ){
          //Set the range attribute on the JSON
          modelJSON.range = true;
        }
        else{
          //Set the range attribute on the JSON
          modelJSON.range = false;
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
      if( ((this.get("min") != this.defaults().min) && (this.get("min") != this.get("rangeMin"))) ||
           ((this.get("max") != this.defaults().max)) && (this.get("max") != this.get("rangeMax")) ){

        //Iterate over each filter field and add to the query string
        _.each(this.get("fields"), function(field, i, allFields){

          //Add the date range for this field to the query string
          queryString += field + ":" + this.getRangeQuery().replace(/ /g, "%20");

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
    * Constructs a subquery string from the minimum and maximum dates.
    * @return {string} - THe subquery string
    */
    getRangeQuery: function(){
      //Get the minimum and maximum values
      var max = this.get("max"),
          min = this.get("min");

      //If no min or max was set, but there is a value, construct an exact value match query
      if( !min && min !== 0 && !max && max !== 0 &&
               (this.get("values")[0] || this.get("values")[0] === 0) ){
        return this.get("values")[0];
      }
      //If there is no min or max or value, set an empty query string
      else if( !min && min !== 0 && !max && max !== 0 &&
               ( !this.get("values")[0] && this.get("values")[0] !== 0) ){
         return "";
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

        if(min != "*"){
          min = min + "-01-01T00:00:00Z";
        }
        if(max != "*"){
          max = max + "-12-31T23:59:59Z";
        }

        //Add the range for this field to the query string
        return "[" + min + "%20TO%20" + max + "]";
      }

    },

    /**
     * Updates the XML DOM with the new values from the model
     *
     *  @inheritdoc
    */
    updateDOM: function(options){

      var objectDOM = Filter.prototype.updateDOM.call(this, options);

      //Date Filters don't use matchSubstring nodes, and the value node will be recreated later
      $(objectDOM).children("matchSubstring, value").remove();

      //Get a clone of the original DOM
      var originalDOM;
      if( this.get("objectDOM") ){
        originalDOM = this.get("objectDOM").cloneNode(true);
      }

      if( typeof options == "undefined" ){
        var options = {};
      }

      // Get min and max dates
      var dateData = {
        min: this.get("min"),
        max: this.get("max")
      };

      var isRange = false;

      // Make subnodes <min> and <max> and append to DOM
      _.map(dateData, function(value, nodeName){

        if( nodeName == "min" ){
          var dateTime = "-01-01T00:00:00Z";
        }
        else{
          var dateTime = "-12-31T23:59:59Z";
        }

        //If this value is the same as the default value, but it wasn't previously serialized,
        if( (value == this.defaults()[nodeName]) &&
            ( !$(originalDOM).children(nodeName).length ||
              ($(originalDOM).children(nodeName).text() != value + dateTime) )){
            return;
        }

        //Create an XML node
        var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);

        //Add the date string to the XML node
        $(nodeSerialized).text( value + dateTime );

        $(objectDOM).append(nodeSerialized);

        //If either a min or max was serialized, then mark this as a range
        isRange = true;

      }, this);

      //If a value is set on this model,
      if( !isRange && this.get("values").length ){

        //Create a value XML node
        var valueNode = $(objectDOM.ownerDocument.createElement("value"));
        //Get a Date object for this value
        var date = new Date();
        date.setUTCFullYear(this.get("values")[0] + "-12-31T23:59:59Z");
        //Set the text of the XML node to the date string
        valueNode.text( date.toISOString() );
        $(objectDOM).append( valueNode );

      }


      if( !options.forCollection ){

        // Get new date data
        var dateData = {
          rangeMin: this.get("rangeMin"),
          rangeMax: this.get("rangeMax")
        };

        // Make subnodes <min> and <max> and append to DOM
        _.map(dateData, function(value, nodeName){

          if( nodeName == "rangeMin" ){
            var dateTime = "-01-01T00:00:00Z";
          }
          else{
            var dateTime = "-12-31T23:59:59Z";
          }

          //If this value is the same as the default value, but it wasn't previously serialized,
          if( (value == this.defaults()[nodeName]) &&
              ( !$(originalDOM).children(nodeName).length ||
                ($(originalDOM).children(nodeName).text() != value + dateTime) )){
              return;
          }

          //Create an XML node
          var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);

          //Add the date string to the XML node
          $(nodeSerialized).text( value + dateTime );

          //Remove existing nodes and add the new one
          $(objectDOM).children(nodeName).remove();
          $(objectDOM).append(nodeSerialized);

        }, this);

        //Move the filterOptions node to the end of the filter node
        var filterOptionsNode = $(objectDOM).find("filterOptions");
        filterOptionsNode.detach();
        $(objectDOM).append(filterOptionsNode);
      }
      //Remove filterOptions for Date filters in collection definitions
      else{
        $(objectDOM).find("filterOptions").remove();
      }

      return objectDOM;
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
          readableValue = "Before " + max;
        }
        else{
          readableValue = "After " + min;
        }
      }
      else{
        readableValue = value;
      }

      return readableValue;

    },

    /**
    * @inheritdoc
    */
    hasChangedValues: function(){

      return ((this.get("min") > this.get("rangeMin") && this.get("min") !== this.defaults().min) ||
              (this.get("max") < this.get("rangeMax") && this.get("max") !== this.defaults().max))

    },

    /**
    * Checks if the values set on this model are valid and expected
    * @return {object} - Returns a literal object with the invalid attributes and their corresponding error message
    */
    validate: function(){

      //Validate most of the DateFilter attributes using the parent validate function
      var errors = Filter.prototype.validate.call(this);

      //Delete error messages for the attributes that are going to be validated specially for the DateFilter
      delete errors.values;
      delete errors.min;
      delete errors.max;

      //If everything is valid so far, then we have to create a new object to store errors
      if( typeof errors != "object" ){
        errors = {};
      }

      //Check that there aren't any negative numbers
      if( this.get("min") < 0 ){
        errors.min = "The minimum year cannot be a negative number."
      }
      if( this.get("max") < 0 ){
        errors.max = "The maximum year cannot be a negative number."
      }
      if( this.get("rangeMin") < 0 ){
        errors.min = "The range minimum year cannot be a negative number."
      }
      if( this.get("rangeMax") < 0 ){
        errors.min = "The range maximum year cannot be a negative number."
      }

      //Check that the min and max values are in order, if the minimum is not the default value of 0
      if( this.get("min") > this.get("max") && this.get("min") != 0 ){
        errors.min = "The minimum year is after the maximum year. The minimum year must be a year before the maximum year of " + this.get("max");
      }

      //Check that all the values are numbers
      if( !errors.min && typeof this.get("min") != "number" ){
        errors.min = "The minimum year must be a number.";
      }
      if( !errors.max && typeof this.get("max") != "number" ){
        errors.max = "The maximum year must be a number.";
      }
      if( !errors.rangeMax && typeof this.get("rangeMax") != "number" ){
        errors.rangeMax = "The maximum year in the date slider must be a number.";
      }
      if( !errors.rangeMin && typeof this.get("rangeMin") != "number" ){
        errors.rangeMin = "The minimum year in the date slider must be a number.";
      }

    }

  });

  return DateFilter;
});
