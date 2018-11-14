/* global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {

	var FilterModel = Backbone.Model.extend({

    //Default attributes for this model
    defaults: {
      objectDOM: null,
      fields: [],
      values: [],
      operator: "AND",
      exclude: false,
      label: null,
      placeholder: null,
      icon: null,
      description: null
    },

    /*
    * This function is executed whenever a new FilterModel is created.
    */
    initialize: function(){
      if( this.get("objectDOM") ){
        this.set( this.parse(this.get("objectDOM")) );
      }
    },

    /*
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
        modelJSON.exclude = this.parseTextNode(xml, "exclude");

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
        return node[0].textContent;
      }
      //If more than one node is found, parse into an array
      else{

        return _.map(node, function(node){
          return node.textContent || null;
        });

      }
    }

  });

  return FilterModel;

});
