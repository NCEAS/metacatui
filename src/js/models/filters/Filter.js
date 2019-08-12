/* global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {

  var FilterModel = Backbone.Model.extend({

    type: "Filter",

    //Default attributes for this model
    defaults: function(){
      return{
        objectDOM: null,
        fields: [],
        values: [],
        operator: "AND",
        queryGroup: null,
        exclude: false,
        matchSubstring: true,
        label: null,
        placeholder: null,
        icon: null,
        description: null,
        //@type {boolean} - If true, this filter will be added to the query but will
        // act in the "background", like a default filter
        isInvisible: false
      }
    },

    /**
    * This function is executed whenever a new FilterModel is created.
    */
    initialize: function(){
      if( this.get("objectDOM") ){
        this.set( this.parse(this.get("objectDOM")) );
      }

      //Assign a random query group to Filters that are specifing very specific datasets,
      // such as bby id, seriesId, or the isPartOf relationship. This is done so that
      // the query string is constructed with these filters "OR"ed into the query.
      // For example, a query might be to look for datasets by a certain scientist OR
      // with the given id. If those filters were ANDed together, the search would essentially
      // ignore the creator filter and only return the dataset with the matching id.
      if( this.get("fields").includes("isPartOf") || this.get("fields").includes("id") ||
          this.get("fields").includes("seriesId") ){
        this.set("queryGroup", Math.floor(Math.random() * Math.floor(10000)).toString());
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

      //Parse the field(s)
      modelJSON.fields = this.parseTextNode(xml, "field", true);
      //Parse the value(s)
      modelJSON.values = this.parseTextNode(xml, "value", true);
      //Parse the label
      modelJSON.label = this.parseTextNode(xml, "label");
      //Parse the icon
      modelJSON.icon = this.parseTextNode(xml, "icon");
      //Parse the placeholder
      modelJSON.placeholder = this.parseTextNode(xml, "placeholder");
      //Parse the description
      modelJSON.description = this.parseTextNode(xml, "description");

      //Parse the operator, if it exists
      if( $(xml).find("operator").length )
        modelJSON.operator = this.parseTextNode(xml, "operator");

      //Parse the exclude, if it exists
      if( $(xml).find("exclude").length )
        modelJSON.exclude = (this.parseTextNode(xml, "exclude") === "true")? true : false;

      //Parse the matchSubstring
      if( $(xml).find("matchSubstring").length )
        modelJSON.matchSubstring = (this.parseTextNode(xml, "matchSubstring") === "true")? true : false;

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
      else if( _.every(values, function(value){
        return (value === null || typeof value == "undefined" || value === NaN || value === "");
      }) ){
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
        queryString += field + ":" + this.getValueQuerySubstring();

        //Add the OR operator between field names
        if( fields.length > i+1 && queryString.length ){
          queryString += "%20OR%20";
        }

      }, this);

      //If there is more than one field, wrap the multiple fields in parenthesis
      if( fields.length > 1 ){
        queryString = "(" + queryString + ")"
      }

      //If this filter should be excluding matches from the results,
      // then add a hyphen in front
      if( this.get("exclude") ){
        queryString = "-" + queryString;
      }

      return queryString;

    },

    /**
    * Constructs a query substring for each of the values set on this model
    *
    * @example
    *    Model `value` attribute: ["walker", "jones"]
    *    Returns: "(walker%20OR%20jones)"
    *
    * return {string} The query substring
    */
    getValueQuerySubstring: function(){
      //Start a query string for this field and get the values
      var valuesQueryString = "",
          values = this.get("values");

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

        //Escape special characters
        value = this.escapeSpecialChar(value);

        //Add the value to the query string. Wrap in wildcards, if specified
        if( value.indexOf(" ") > -1 ){
          valuesQueryString += '*"' + value + '"*';
        }
        else if( this.get("matchSubstring") ){

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

    /*
    * Resets the values attribute on this filter
    */
    resetValue: function(){
      this.set("values", this.defaults().values);
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

        return term;
    },

    /**
     * Updates XML DOM with the new values from the model
     *
     *  @return {XMLElement} An updated filter XML element from a project document
    */
    updateDOM: function(objectDOM){

      var objectDOM = this.get("objectDOM");

      if (objectDOM) {
        // Empty to DOM so we can replace with new subnodes
        objectDOM = objectDOM.cloneNode(true);
        $(objectDOM).empty();
      } else {
          // Create an XML filter element from scratch
          var objectDOM = new DOMParser().parseFromString("<filter></filter>", "text/xml"),
              objectDOM = $(objectDOM).children()[0];
      }

      // Get new values
      var filterData = {
        // The following values are common to all FilterType elements
        field: this.get("fields"),
        value: this.get("values"),
        operator: this.get("operator"),
        exclude: this.get("exclude"),
        matchSubstring: this.get("matchSubstring"),
        // The following values are set for UserInterfaceFilterType,
        // a subtype of FilterType
        label: this.get("label"),
        placeholder: this.get("placeholder"),
        icon: this.get("icon"),
        description: this.get("description")
      };

      // Make new sub nodes using the new model data
      _.map(filterData, function(values, nodeName){

        // Serialize the nodes with multiple occurences
        if(nodeName == "field" || nodeName == "value"){
          if(values){
            _.each(values, function(value){
              if(value){
                var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
                $(nodeSerialized).text(value);
                $(objectDOM).append(nodeSerialized);
              }
            })
          }
        // Serialize the single occurence nodes
        } else {
          if(values){
            var nodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
            $(nodeSerialized).text(values);
            $(objectDOM).append(nodeSerialized);
          }
        }

      });

      return objectDOM
    }

  });

  return FilterModel;

});
