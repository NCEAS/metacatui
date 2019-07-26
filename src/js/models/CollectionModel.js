/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "collections/Filters",
        "models/DataONEObject",
        "models/filters/Filter",
        "models/Search"],
    function($, _, Backbone, Filters, DataONEObject, Filter, Search) {

	var CollectionModel = DataONEObject.extend({

    //The default attributes for this model
		defaults: function(){
      return {
        name: null,
        label: null,
        description: null,
  			filters: null
  		}
    },

    /**
     * The default Backbone.Model.initialize() function
     *
    */
		initialize: function(options){

		},

    /**
     *
     *
    */
    url: function(){
			return MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id"));
		},

    /**
     * Overrides the default Backbone.Model.fetch() function to provide some custom
     * fetch options
     *
    */
    fetch: function(){
      var model = this;

      var requestSettings = {
        dataType: "xml",
        error: function(){
          model.trigger("error");
        }
      }

      //Add the authorization header and other AJAX settings
      requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());
      return Backbone.Model.prototype.fetch.call(this, requestSettings);
    },

    /**
     * Overrides the default Backbone.Model.parse() function to parse the custom
     * collection XML document
     *
     * @param {XMLDocument} response - The XMLDocument returned from the fetch() AJAX call
     * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
    */
    parse: function(json){

      //Start the empty JSON object
      var modelJSON = {},
          collectionNode;

      //Iterate over each root XML node to find the collection node
      $(response).children().each(function(i, el){
        if( el.tagName.indexOf("collection") > -1 ){
          collectionNode = el;
          return false;
        }
      });

      //If a collection XML node wasn't found, return an empty JSON object
      if( typeof collectionNode == "undefined" || !collectionNode )
        return {};

      //Parse the collection XML and return it
      return this.parseCollectionXML(collectionNode);

    },

    /**
     * Parses the collection XML into a JSON object
     *
     * @param {Element} rootNode - The XML Element that contains all the collection nodes
     * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
    */
    parseCollectionXML: function( rootNode ){
      var modelJSON = {};

      //Parse the simple text nodes
      modelJSON.name = this.parseTextNode(rootNode, "name");
      modelJSON.label = this.parseTextNode(rootNode, "label");
      modelJSON.description = this.parseTextNode(rootNode, "description");
      modelJSON.searchModel = new Search();
      modelJSON.searchModel.set("filters", new Filters());
      modelJSON.searchModel.get("filters").createCatalogFilters();

      // Parse the collection definition
      _.each( $(rootNode).find("definition > filter"), function(filterNode){

        //Create a new Filter model
        var filterModel = new Filter({
          objectDOM: filterNode,
          isInvisible: true,
          // projDefFilter allows us to distinguish this type of filter
          // from the filters during serialization
          projDefFilter: true
        });

        //Add the filter to the Filters collection
        modelJSON.searchModel.get("filters").add(filterModel);

      });

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
        return node[0].textContent.trim();
      }
      //If more than one node is found, parse into an array
      else{

        return _.map(node, function(node){
          return node.textContent.trim() || null;
        });

      }
    },

    /**
     * Updates collection XML with values in the collection model
     *
     * @param {XMLDocument} objectDOM the XML element to be updated
     * @return {XMLElement} An updated XML element
    */
    serializeCollectionXML: function(objectDOM){

      // Get or make objectDOM
      if(!objectDOM){
        if (this.get("objectDOM")) {
          objectDOM = this.get("objectDOM").cloneNode(true);
          $(objectDOM).empty();
        } else {
            // create an XML collection element from scratch
            var xmlText = "<collection></collection>",
                objectDOM = new DOMParser().parseFromString(xmlText, "text/xml"),
                objectDOM = $(objectDOM).children()[0];
        }
      };

      // Serialize filters
      // Get all the search filter models (not all of which are project definition filters)
      var filterModels = this.get("searchModel").get("filters").models;

      // Remove definition node if it exists in XML already
      $(objectDOM).find("definition").remove();
      // Create new definition element
      var definitionSerialized = objectDOM.ownerDocument.createElement("definition");

      // Iterate through the filter models
      $(filterModels).each(function(i, filterModel){
          // Find the filter that is the project definition filter and update the DOM
          if(filterModel.get("projDefFilter")){
            var filterSerialized = filterModel.updateDOM();
            $(definitionSerialized).append(filterSerialized);
          };
      });

      $(objectDOM).prepend(definitionSerialized);

      // Get and update the simple text strings (everything but definition)
      // in reverse order because we prepend them consecutively to objectDOM
      var collectionTextData = {
        description: this.get("description"),
        label: this.get("label"),
        name: this.get("name")
      }

      _.map(collectionTextData, function(value, nodeName){

        // Remove the node if it exists
        // Use children() and not find() as there are sub-children named label
        $(objectDOM).children(nodeName).remove();

        // Don't serialize falsey values
        if(value){
          // Make new sub-node
          var collectionSubnodeSerialized = objectDOM.ownerDocument.createElement(nodeName);
          $(collectionSubnodeSerialized).text(value);
          // Append new sub-node to the start of the objectDOM
          $(objectDOM).prepend(collectionSubnodeSerialized);
        }

      });

      return objectDOM;

    }

	});

	return CollectionModel;
});
