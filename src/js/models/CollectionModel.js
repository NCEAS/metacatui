/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "collections/Filters",
        "collections/SolrResults",
        "models/DataONEObject",
        "models/filters/Filter",
        "models/Search"],
    function($, _, Backbone, Filters, SolrResults, DataONEObject, Filter, Search) {

	var CollectionModel = DataONEObject.extend({

    //The default attributes for this model
    defaults: function(){
      return {
        name: null,
        label: null,
        description: null,
        filters: null,
        /** @type {Search} - A Search model with a Filters collection */
        // that contains the filters associated with this collection
        searchModel: new Search(),
        /** @type {SolrResults} - A SolrResults collection that contains the */
        // filtered search results of datasets in this collection
        searchResults: new SolrResults(),
        /**  @type {SolrResults} - A SolrResults collection that contains the */
        // unfiltered search results of all datasets in this collection
        allSearchResults: null
      }
    },

    /**
     * The default Backbone.Model.initialize() function
     *
    */
    initialize: function(options){

      //Call the super class initialize function
      DataONEObject.prototype.initialize.call(this, options);

      this.listenToOnce(this.get("searchResults"), "sync", this.cacheSearchResults);

      //If the searchResults collection is replaced at any time, reset the listener
      this.on("change:searchResults", function(searchResults){
        this.listenToOnce(this.get("searchResults"), "sync", this.cacheSearchResults);
      });

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
     * Sends an AJAX request to fetch the system metadata for this object.
     * Will not trigger a sync event since it does not use Backbone.Model.fetch
     */
    fetchSystemMetadata: function(options){

      if(!options) var options = {};
      else options = _.clone(options);

      var model = this,
        fetchOptions = _.extend({
          url: MetacatUI.appModel.get("metaServiceUrl") + (this.get("id") || this.get("seriesId")),
          dataType: "text",
          success: function(response){
            model.set(DataONEObject.prototype.parse.call(model, response));
          },
          error: function(){
            model.trigger('error');
          }
        }, options);

        //Add the authorization header and other AJAX settings
        _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

        $.ajax(fetchOptions);
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

      //Create a Search model for this collection's filters
      modelJSON.searchModel = new Search();
      modelJSON.searchModel.set("filters", new Filters());
      modelJSON.searchModel.get("filters").createCatalogFilters();

      //Create a Filters collection to contain the collection definition Filters
      modelJSON.filters = new Filters();

      // This variable changes to true after iterating through all the
      // definition filters, if the field of one filter == 'isPartOf'.
      // This is used to decide whether the isPartOf filter should be created.
      var isPartOfFilterExists = false;

      // Parse the collection definition
      _.each( $(rootNode).find("definition > filter"), function(filterNode){

        // Check if this is filter is an 'isPartOf' filter
        if($(filterNode).find("field").text() == "isPartOf"){
          isPartOfFilterExists = true
        }

        //Create a new Filter model
        var filterModel = new Filter({
          objectDOM: filterNode,
          isInvisible: true,
          // projDefFilter allows us to distinguish this type of filter
          // from other filters during serialization
          projDefFilter: true
        });

        //Add the filter to the Filters collection
        modelJSON.filters.add(filterModel);

        //Add the filter to the Search model
        modelJSON.searchModel.get("filters").add(filterModel);

      });

      // If there's no filter with the field 'isPartOf', create one.
      // There must be a series ID set on this model for this to work
      if(!isPartOfFilterExists && this.get("seriesId")){
        isPartOfFilterModel = createIsPartOfFilter(this.get("seriesId"));
        modelJSON.searchModel.get("filters").add(isPartOfFilterModel);
      }

      return modelJSON;

    },

    /**
     * Creates a FilterModel that uses the seriesId in the isPartOf filter
     * @param {string} seriesId - the seriesId of the collection or project
     * @return {Filter} a filter with the field set to isPartOf and the value set to the given seriesId
     */
    createIsPartOfFilter: function(seriesId){

      // Create objectDOM for the filter
      var filterNode    = $($.parseXML("<filter></filter>")).children()[0],
          fieldElement  = filterNode.ownerDocument.createElement("field"),
          valueElement  = filterNode.ownerDocument.createElement("value");

      $(fieldElement).text("isPartOf");
      $(valueElement).text(seriesId);
      filterNode.append(fieldElement);
      filterNode.append(valueElement);

      // Create the new filterModel
      var filterModel = new Filter({
        objectDOM: filterNode,
        isInvisible: true,
        // projDefFilter allows us to distinguish this type of filter
        // from other filters during serialization
        projDefFilter: true
      });

      return filterModel
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
          var objectDOM = this.get("objectDOM").cloneNode(true);
          $(objectDOM).empty();
        } else {
            // create an XML collection element from scratch
            var objectDOM = $($.parseXML("<collection></collection>")).children()[0];
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
          // Find the filters that are project definition filters
          if(filterModel.get("projDefFilter")){
            // updateDOM of project definition filters, then append to <definition>
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

    },

    /**
     * Creates a copy of the SolrResults collection and saves it in this
     * model so that there is always access to the unfiltered list of datasets
     *
     * @param {SolrResults} searchResults - The SolrResults collection to cache
    */
    cacheSearchResults: function(searchResults){

      //Save a copy of the SolrResults so that we always have a copy of
      // the unfiltered list of datasets
      this.set("allSearchResults", searchResults.clone());

      //Make a copy of the facetCounts object
      var allSearchResults = this.get("allSearchResults");
      allSearchResults.facetCounts = Object.assign({}, searchResults.facetCounts);

    }

	});

	return CollectionModel;
});
