/* global define */
define(["jquery", "underscore", "backbone", "collections/Filters", "models/filters/Filter",
    "models/filters/BooleanFilter", "models/filters/ChoiceFilter", "models/filters/DateFilter",
    "models/filters/NumericFilter", "models/filters/ToggleFilter"],
    function($, _, Backbone, Filters, Filter, 
        BooleanFilter, ChoiceFilter, DateFilter, 
        NumericFilter, ToggleFilter) {

	var FilterGroup = Backbone.Model.extend({

    //Default attributes for this model
    defaults: function(){
      return {
        label: null,
        description: null,
        icon: null,
        filters:  new Filters()
      }
    },

    /*
    * This function is executed whenever a new model is created.
    */
    initialize: function(){
      if( this.get("objectDOM") ){
        this.set( this.parse(this.get("objectDOM")) );
      }
    },

    /*
    * Overrides the default Backbone.Model.parse() function to parse the filterGroup
    * XML snippet
    *
    * @param {Element} xml - The XML Element that contains all the FilterGroup elements
    * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
    */
    parse: function(xml){
      var modelJSON = {};

      //Parse all the text nodes
      modelJSON.label = this.parseTextNode(xml, "label");
      modelJSON.description = this.parseTextNode(xml, "description");
      modelJSON.icon = this.parseTextNode(xml, "icon");

      //Start an array for the filters
      modelJSON.filters = new Filters();

      //Iterate over each child and look for filter elements
      $(xml).children().each(function(i, filterNode){

        var filterType = filterNode.tagName;

        switch (filterType) {
          case "textFilter":
            modelJSON.filters.add( new Filter({ objectDOM: filterNode }) );
            break;
          case "numericFilter":
            modelJSON.filters.add( new NumericFilter({ objectDOM: filterNode }) );
            break;
          case "booleanFilter":
            modelJSON.filters.add( new BooleanFilter({ objectDOM: filterNode }) );
            break;
          case "choiceFilter":
            modelJSON.filters.add( new ChoiceFilter({ objectDOM: filterNode }) );
            break;
          case "dateFilter":
            modelJSON.filters.add( new DateFilter({ objectDOM: filterNode }) );
            break;
          case "toggleFilter":
            modelJSON.filters.add( new ToggleFilter({ objectDOM: filterNode }) );
            break;
        }

      });

      return modelJSON;
    },

    /*
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
        return node[0].textContent.trim();
      }
      //If more than one node is found, parse into an array
      else{

        return _.map(node, function(node){
          return node.textContent.trim() || null;
        });

      }
    }

  });

  return FilterGroup;
});
