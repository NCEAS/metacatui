/* global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {

  /**
  * @class Filter
  * @classdesc A single search filter that is used in queries sent to the DataONE search service.
  * @classcategory Models/Filters
  * @extends Backbone.Model
  * @constructs
  */
  var FilterModel = Backbone.Model.extend(
    /** @lends Filter.prototype */
    {

    /**
    * The name of this Model
    * @name Filter#type
    * @type {string}
    * @readonly
    */
    type: "Filter",

    /**
    * Default attributes for this model
    * @type {object}
    * @returns {object}
    * @property {Element} objectDOM - The XML DOM for this filter
    * @property {string} nodeName - The XML node name for this filter's XML DOM
    * @property {string[]} fields - The search index fields to search
    * @property {string[]} values - The values to search for in the given search fields
    * @property {string} operator - The operator to use between values set on this model. "AND" or "OR"
    * @property {string} queryGroup - The name of the group this Filter is a part of, which is
    * primarily used when creating a query string from multiple Filter models. Filters
    * in the same group will be wrapped in parenthesis in the query.
    * @property {boolean} exclude - If true, search index docs matching this filter will be excluded from the search results
    * @property {boolean} matchSubstring - If true, the search values will be wrapped in wildcard characters to match substrings
    * @property {string} label - A human-readable short label for this Filter
    * @property {string} placeholder - A short example or description of this Filter
    * @property {string} icon - A term that identifies a single icon in a supported icon library
    * @property {string} description - A longer description of this Filter's function
    * @property {boolean} isInvisible - If true, this filter will be added to the query but will
    * act in the "background", like a default filter
    * @property {boolean} inFilterGroup - If true, this filter belongs to a FilterGroup model
    */
    defaults: function(){
      return{
        objectDOM: null,
        nodeName: "filter",
        fields: [],
        values: [],
        operator: "AND",
        queryGroup: null,
        exclude: false,
        matchSubstring: false,
        label: null,
        placeholder: null,
        icon: null,
        description: null,
        isInvisible: false,
        inFilterGroup: false
      }
    },

    /**
    * Creates a new Filter model
    */
    initialize: function(){
      if( this.get("objectDOM") ){
        this.set( this.parse(this.get("objectDOM")) );
      }

      // Assign a random query group to Filters that are specifying very specific datasets,
      // such as by id, seriesId, or the isPartOf relationship. This is done so that
      // the query string is constructed with these filters "OR"ed into the query.
      // For example, a query might be to look for datasets by a certain scientist OR
      // with the given id. If those filters were ANDed together, the search would essentially
      // ignore the creator filter and only return the dataset with the matching id.
      if( this.get("fields").includes("isPartOf") || this.get("fields").includes("id") ||
          this.get("fields").includes("seriesId") ){
        this.set("queryGroup", Math.floor(Math.random() * Math.floor(10000)).toString());
      }
      
      //If this is an isPartOf filter, then add a label and description
      if( this.get("fields").length == 1 && this.get("fields").includes("isPartOf") ){
        this.set({
          label: "Datasets added manually",
          description: "Datasets added to this collection manually by dataset owners",
          isInvisible: MetacatUI.appModel.get("hideIsPartOfFilter") === true ? true : false,
        });
      }
    
    },

    /**
    * Parses the given XML node into a JSON object to be set on the model
    *
    * @param {Element} xml - The XML element that contains all the filter elements
    * @return {JSON} - The JSON object of all the filter attributes
    */
    parse: function(xml){

      //If an XML element wasn't sent as a parameter, get it from the model
      if(!xml){
        var xml = this.get("objectDOM");

        //Return an empty JSON object if there is no objectDOM saved in the model
        if(!xml)
          return {};
      }

      var modelJSON = {};

      if( $(xml).children("field").length ){
        //Parse the field(s)
        modelJSON.fields = this.parseTextNode(xml, "field", true);
      }

      if( $(xml).children("label").length ){
        //Parse the label
        modelJSON.label = this.parseTextNode(xml, "label");
      }

      //Parse the operator, if it exists
      if( $(xml).find("operator").length ){
        modelJSON.operator = this.parseTextNode(xml, "operator");
      }
      else{
        if( modelJSON.fields.includes('id') ){
          modelJSON.operator = "OR";
        }
      }

      //Parse the exclude, if it exists
      if( $(xml).find("exclude").length ){
        modelJSON.exclude = (this.parseTextNode(xml, "exclude") === "true")? true : false;
      }

      //Parse the matchSubstring
      if( $(xml).find("matchSubstring").length ){
        modelJSON.matchSubstring = (this.parseTextNode(xml, "matchSubstring") === "true")? true : false;
      }

      var filterOptionsNode = $(xml).children("filterOptions");
      if( filterOptionsNode.length ){
        //Parse the filterOptions XML node
        modelJSON = _.extend(this.parseFilterOptions(filterOptionsNode), modelJSON);
      }

      //If this Filter is in a filter group, don't parse the values
      if( !this.get("inFilterGroup") ){
        if( $(xml).children("value").length ){
          //Parse the value(s)
          modelJSON.values = this.parseTextNode(xml, "value", true);
        }
      }

      return modelJSON;

    },

    /**
    * Gets the text content of the XML node matching the given node name
    *
    * @param {Element} parentNode - The parent node to select from
    * @param {string} nodeName - The name of the XML node to parse
    * @param {boolean} isMultiple - If true, parses the nodes into an array
    * @return {(string|Array)} - Returns a string or array of strings of the text content
    */
    parseTextNode: function( parentNode, nodeName, isMultiple ){
      var node = $(parentNode).children(nodeName);

      //If no matching nodes were found, return falsey values
      if( !node || !node.length ){

        //Return an empty array if the isMultiple flag is true
        if( isMultiple )
          return [];
        //Return null if the isMultiple flag is false
        else
          return null;
      }
      //If exactly one node is found and we are only expecting one, return the text content
      else if( node.length == 1 && !isMultiple ){
        if( !node[0].textContent )
          return null;
        else
          return node[0].textContent;
      }
      //If more than one node is found, parse into an array
      else{

        var allContents = [];

         _.each(node, function(node){
           if(node.textContent || node.textContent === 0)
             allContents.push( node.textContent );
        });

        return allContents;

      }
    },

    /**
    * Parses the filterOptions XML node into a literal object
    * @param {Element} filterOptionsNode - The filterOptions XML element to parse
    * @return {Object} - The parsed filter options, in literal object form
    */
    parseFilterOptions: function(filterOptionsNode){

      if( typeof filterOptionsNode == "undefined" ){
        return {};
      }

      var modelJSON = {};

      try{
        //The list of options to parse
        var options = ["placeholder", "icon", "description"];

        //Parse the text nodes for each filter option
        _.each(options, function(option){
          if( $(filterOptionsNode).children(option).length ){
            modelJSON[option] = this.parseTextNode(filterOptionsNode, option, false);
          }
        }, this);

        //Parse the generic option name and value pairs and set on the model JSON
        $(filterOptionsNode).children("option").each(function(i, optionNode){
          var optName = $(optionNode).children("optionName").text();
          var optValue = $(optionNode).children("optionValue").text();

          modelJSON[optName] = optValue;
        });

        //Return the JSON to be set on this model
        return modelJSON;

      }
      catch(e){
        return {};
      }

    },

    /**
     * Builds a query string that represents this filter.
     *
     * @return {string} The query string to send to Solr
     */
    getQuery: function(){

      //Get the values of this filter in Array format
      var values = this.get("values");
      if( !Array.isArray(values) ){
        values = [values];
      }

      //Check that there are actually values to serialize
      if( !values.length ){
        return "";
      }

      //Filter out any invalid values (can't use _.compact() because we want to keep 'false' values)
      values = _.reject(values, function(value){
                return (value === null || typeof value == "undefined" ||
                        value === NaN || value === "" || (Array.isArray(value) && !value.length));
              });

      if(!values.length){
        return "";
      }

      //Start a query string for this model and get the fields
      var queryString = "",
          fields = this.get("fields");

      //If the fields are not an array, convert it to an array
      if( !Array.isArray(fields) ){
        fields = [fields];
      }

      //Iterate over each field
      _.each( fields, function(field, i){

        //Add the query string for this field to the overall model query string
        queryString += field + ":" + this.getValueQuerySubstring(values);

        //Add the OR operator between field names
        if( fields.length > i+1 && queryString.length ){
          queryString += "%20" + this.get("operator") + "%20";
        }

      }, this);

      //If there is more than one field, wrap the multiple fields in parenthesis
      if( fields.length > 1 ){
        queryString = "(" + queryString + ")"
      }

      //If this filter should be excluding matches from the results,
      // then add a hyphen in front
      if( this.get("exclude") ){
        queryString = "-" + queryString + "%20AND%20*:*";
      }

      return queryString;

    },

    /**
    * Constructs a query substring for each of the values set on this model
    *
    * @example
    *   values: ["walker", "jones"]
    *   Returns: "(walker%20OR%20jones)"
    *
    * @param {string[]} [values] - The values to use in this query substring.
    * If not provided, the values set on the model are used.
    * @return {string} The query substring
    */
    getValueQuerySubstring: function(values){
      //Start a query string for this field and get the values
      var valuesQueryString = "",
          values = values || this.get("values");

      //If the values are not an array, convert it to an array
      if( !Array.isArray(values) ){
        values = [values];
      }

      //Iterate over each value set on the model
      _.each( values, function(value, i){

        //If the value is not a string, then convert it to a string
        if( typeof value != "string" ){
          value = value.toString();
        }

        //Trim off whitespace
        value = value.trim();

        var dateRangeRegEx = /^\[((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d*Z)|\*)( |%20)TO( |%20)((\d{4}-[01]\d-[0-3]\dT[0-2]\d(:|\\:)[0-5]\d(:|\\:)[0-5]\d\.\d*Z)|\*)\]/,
            isDateRange = dateRangeRegEx.test(value);

        //Escape special characters
        value = this.escapeSpecialChar(value);

        //If the value is a search phrase (more than one word), and not a date range string, wrap in quotes
        if( value.indexOf(" ") > -1 && !isDateRange ){
          valuesQueryString += "\"" + value + "\"";
        }
        else if( this.get("matchSubstring") && !isDateRange ){

          //Look for existing wildcard characters at the end of the value string
          if( value.match( /^\*|\*$/ ) ){
            valuesQueryString += value;
          }
          //Wrap the value string in wildcard characters
          else{
            valuesQueryString += "*" + value + "*";
          }

        }
        else{
          //Add the value to the query string
          valuesQueryString += value;
        }

        //Add the operator between values
        if( values.length > i+1 && valuesQueryString.length ){
          valuesQueryString += "%20" + this.get("operator") + "%20";
        }

      }, this);

      if( values.length > 1 ){
        valuesQueryString = "(" + valuesQueryString + ")"
      }

      return valuesQueryString;
    },

    /**
    * Resets the values attribute on this filter
    */
    resetValue: function(){
      this.set("values", this.defaults().values);
    },

    /**
    * Checks if this Filter has values different than the default values.
    * @return {boolean} - Returns true if this Filter has values set on it, otherwise will return false
    */
    hasChangedValues: function(){

      return (this.get("values").length > 0);

    },
    
    /**    
     * isEmpty - Checks whether this Filter has any values or fields set
     *      
     * @return {boolean}  returns true if the Filter's values and fields are empty
     */     
    isEmpty: function(){
      try {
        var fields      =   this.get("fields"),
            values      =   this.get("values"),
            noFields    =   fields.length == 0;
            fieldsEmpty =   _.every(fields, function(item) { return item == "" }),
            noValues    =   values.length == 0;
            valuesEmpty =   _.every(values, function(item) { return item == "" });
            
        var noMinNoMax = _.every(
          [this.get("min"), this.get("max")],
          function(num) {
            return (typeof num === "undefined") || (!num && num !== 0);
          }
        );
            
        return noFields && fieldsEmpty && noValues && valuesEmpty && noMinNoMax
      } catch (e) {
        console.log("Failed to check if a Filter is empty, error message: " + e);
      }
    },

    /**
    * Escapes Solr query reserved characters so that search terms can include
    *  those characters without throwing an error.
    *
    * @param {string} term - The search term or phrase to escape
    * @return {string} - The search term or phrase, after special characters are escaped
    */
    escapeSpecialChar: function(term) {
        term = term.replace(/%7B/g, "\\%7B");
        term = term.replace(/%7D/g, "\\%7D");
        term = term.replace(/%3A/g, "\\%3A");
        term = term.replace(/:/g, "\\:");
        term = term.replace(/\(/g, "\\(");
        term = term.replace(/\)/g, "\\)");
        term = term.replace(/\?/g, "\\?");
        term = term.replace(/%3F/g, "\\%3F");
        term = term.replace(/\"/g, '\\"');
        term = term.replace(/\'/g, "\\'");
        term = term.replace(/\#/g, "\\%23");
        term = term.replace(/\-/g, "\\%2D");

        return term;
    },

    /**
     * Updates XML DOM with the new values from the model
     *
     *  @param {object} [options] A literal object with options for this serialization
     *  @property {boolean} [options.forCollection] - If true, will create an XML DOM for Collection definitions, not FilterGroups
     *  @return {Element} A new XML element with the updated values
    */
    updateDOM: function(options){

      try{

        if(typeof options == "undefined"){
          var options = {};
        }

        var objectDOM = this.get("objectDOM"),
            filterOptionsNode;

        if( typeof objectDOM == "undefined" || !objectDOM || !$(objectDOM).length ){
          // Create an XML filter element from scratch
          var objectDOM = new DOMParser().parseFromString("<" + this.get("nodeName") +
                          "></" + this.get("nodeName") + ">", "text/xml");
          var $objectDOM = $(objectDOM).find(this.get("nodeName"));
        }
        else{
          objectDOM = objectDOM.cloneNode(true);
          var $objectDOM = $(objectDOM);

          //Detach the filterOptions so they are saved
          filterOptionsNode = $objectDOM.children("filterOptions");
          filterOptionsNode.detach();

          //Empty the DOM
          $objectDOM.empty();
        }

        var xmlDocument = $objectDOM[0].ownerDocument;

        // Get new values. Set the key as the DOM element name (i.e. "field" instead of "fields")
        var filterData = {
          // The following values are common to all FilterType elements
          label: this.get("label"),
          field: this.get("fields"),
          operator: this.get("operator"),
          exclude: this.get("exclude"),
          matchSubstring: this.get("matchSubstring"),
          value: this.get("values")
        };

        // Make new sub nodes using the new model data
        _.map(filterData, function(values, nodeName){

          // Serialize the nodes with multiple occurrences
          if( Array.isArray(values) ){
              _.each(values, function(value){
                // Don't serialize empty, null, or undefined values
                if( value || value === false || value === 0 ){
                  var nodeSerialized = xmlDocument.createElement(nodeName);
                  $(nodeSerialized).text(value);
                  $objectDOM.append(nodeSerialized);
                }
              }, this);
          // Serialize the single occurrence nodes
          }
          // Don't serialize falsey or default values
          else if((values || values === false) && values != this.defaults()[nodeName]) {
            var nodeSerialized = xmlDocument.createElement(nodeName);
            $(nodeSerialized).text(values);
            $objectDOM.append(nodeSerialized);
          }

        }, this);

        //If this is a UIFilterType that won't be serialized into a Collection definition,
        // then add extra XML nodes
        if( !options.forCollection ){

          //Update the filterOptions XML DOM
          filterOptionsNode = this.updateFilterOptionsDOM(filterOptionsNode);

          //Add the filterOptions to the filter DOM
          if( typeof filterOptionsNode != "undefined" && $(filterOptionsNode).children().length ){
            $objectDOM.append(filterOptionsNode);
          }

        }

        return $objectDOM[0];
      }
      catch(e){
        console.error("Unable to serialize a Filter.", e);
        return this.get("objectDOM") || "";
      }
    },

    /**
    * Serializes the filter options into an XML DOM and returns it
    * @param {Element} [filterOptionsNode] - The XML filterOptions node to update
    * @return {Element} - The updated DOM
    */
    updateFilterOptionsDOM: function(filterOptionsNode){

      try{

        //If a filterOptions XML node was not given, create one
        if( typeof filterOptionsNode == "undefined" || !filterOptionsNode.length ){
          var filterOptionsNode = new DOMParser().parseFromString("<filterOptions></filterOptions>", "text/xml");
          var $filterOptionsNode = $(filterOptionsNode).find("filterOptions");
        }
        else{
          //Convert the XML node into a jQuery object
          var $filterOptionsNode = $(filterOptionsNode);
        }

        //Get the first option element
        var firstOptionNode = $filterOptionsNode.children("option").first();

        // The following values are for UIFilterOptionsType
        var optionsData = {};
        optionsData.placeholder = this.get("placeholder");
        optionsData.icon = this.get("icon");
        optionsData.description = this.get("description");

        var xmlDocument;

        if( filterOptionsNode.length ){
          xmlDocument = filterOptionsNode[0].ownerDocument;
        }
        if(!xmlDocument){
          xmlDocument = filterOptionsNode.ownerDocument;
        }
        if(!xmlDocument){
          xmlDocument = filterOptionsNode;
        }

        //Update the text value of existing
        _.map(optionsData, function(value, nodeName){
          //Remove the existing node, if it exists
          $filterOptionsNode.children(nodeName).remove();

          //If there is a value set on the model for this attribute, then create an XML
          // node for this attribute and set the text value
          if( value ){
            var newNode = $(xmlDocument.createElement(nodeName)).text(value);

            if( firstOptionNode.length )
              firstOptionNode.before(newNode);
            else
              $filterOptionsNode.append(newNode);
          }
        });

        //If no options were serialized, then return an empty string
        if( !$filterOptionsNode.children().length ){
          return "";
        }
        else{
          return filterOptionsNode;
        }
      }
      catch(e){
        return "";
      }

    },

    /**
    * Returns true if the given value or value set on this filter is a date range query
    * @param {string} value - The string to test
    * @return {boolean}
    */
    isDateQuery: function(value){

      if( typeof value == "undefined" && this.get("values").length == 1 ){
        var value = this.get("values")[0];
      }

      if( value ){
        var dateMatch = value.match(/[\d|\-|:|T]*Z TO [\d|\-|:|T]*Z/);

        return (Array.isArray(dateMatch) && dateMatch.length);
      }
      else{
        return false;
      }
    },

    /**
    * Checks if the values set on this model are valid.
    * Some of the attributes are changed during this process if they are found to be invalid,
    * since there aren't any easy ways for users to fix these issues themselves in the UI.
    * @return {object} - Returns a literal object with the invalid attributes and their corresponding error message
    */
    validate: function(){

      try{

        var errors = {};

        //---Validate fields----
        var fields = this.get("fields");
        //All fields should be strings
        var nonStrings = _.filter(fields, function(field){
          return (typeof field != "string" || !field.trim().length);
        });

        if( nonStrings.length ){
          //Remove the nonstrings from the model, rather than returning an error
          this.set("fields", _.without(fields, nonStrings));
        }
        //If there are no fields, set an error message
        if( !this.get("fields").length ){
          errors.fields = "Filters should have at least one search field.";
        }

        //---Validate values----
        var values = this.get("values");
        //All values should be strings, booleans, numbers, or dates
        var invalidValues = _.filter(values, function(value){
          //Empty strings are invalid
          if( typeof value == "string" && !value.trim().length ){
            return true;
          }
          //Non-empty strings, booleans, numbers, or dates are valid
          else if( typeof value == "string" || typeof value == "boolean" ||
                   typeof value == "number" || Date.prototype.isPrototypeOf(value) ){
            return false;
          }
        });

        if( invalidValues.length ){
          //Remove the invalid values from the model, rather than returning an error
          this.set("values", _.without(values, invalidValues));
        }

        //If there are no values, set an error message
        if( !this.get("values").length ){
          errors.values = "Filters should include at least one search term.";
        }

        //---Validate operator----
        //The operator must be either AND or OR
        if( this.get("operator") !== "AND" && this.get("operator") !== "OR" ){
          //Reset the value to the default rather than return an error
          this.set("operator", this.defaults().operator);
        }

        //---Validate exclude and matchSubstring----
        //Exclude should always be a boolean
        if( typeof this.get("exclude") != "boolean" ){
          //Reset the value to the default rather than return an error
          this.set("exclude", this.defaults().exclude);
        }
        //matchSubstring should always be a boolean
        if( typeof this.get("matchSubstring") != "boolean" ){
          //Reset the value to the default rather than return an error
          this.set("matchSubstring", this.defaults().matchSubstring);
        }

        //---Validate label, placeholder, icon, and description----
        var textAttributes = ["label", "placeholder", "icon", "description"];
        //These fields should be strings
        _.each(textAttributes, function(attr){
          if( typeof this.get(attr) != "string" ){
            //Reset the value to the default rather than return an error
            this.set(attr, this.defaults()[attr]);
          }
        }, this);

        if( Object.keys(errors).length )
          return errors;
        else{
          return;
        }
      }
      catch(e){
        console.error(e);
      }

    }

  });

  return FilterModel;

});
