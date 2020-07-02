/* global define */
define(["jquery",
        "underscore",
        "backbone",
        "uuid",
        "collections/Filters",
        "collections/SolrResults",
        "models/DataONEObject",
        "models/filters/Filter",
        "models/filters/DateFilter",
        "models/Search"],
    function($, _, Backbone, uuid, Filters, SolrResults, DataONEObject, Filter, DateFilter, Search) {

  /**
  * @class CollectionModel
  * @classdesc A collection of datasets, defined by one or more search filters
  * @name CollectionModel
  * @extends DataONEObject
  * @constructor
  */
	var CollectionModel = DataONEObject.extend(
    /** @lends CollectionModel.prototype */{

    /**
    * The name of this Model
    * @type {string}
    * @readonly
    */
    type: "Collection",

    /**
    * Default attributes for CollectionModels
    * @type {Object}
    * @property {string[]} ignoreQueryGroups - The Filter query groups to not serialize to the collection definition part of the XML document
    * @property {Filters} definitionFilters - A Filters collection that stores filters that have been serialized to the Collection.
    * @property {Search} searchModel - A Search model with a Filters collection that contains the filters associated with this collection
    * @property {SolrResults} searchResults - A SolrResults collection that contains the filtered search results of datasets in this collection
    * @property {SolrResults} allSearchResults - A SolrResults collection that contains the unfiltered search results of all datasets in this collection
    */
    defaults: function(){
      return _.extend(DataONEObject.prototype.defaults(), {
        name: null,
        label: null,
        originalLabel: null,
        labelBlockList: ["new"],
        description: null,
        formatId: "https://purl.dataone.org/collections-1.0.0",
        formatType: "METADATA",
        type: "collection",
        ignoreQueryGroups: ["catalog"],
        definitionFilters: null,
        searchModel: null,
        searchResults: new SolrResults(),
        allSearchResults: null
      });
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

      //Create a search model
      this.set("searchModel", this.createSearchModel());

      //Create a Filters collection to store the definition filters
      this.set("definitionFilters", new Filters());

      // Update the blocklist with the node/repository labels
      var nodeBlockList = MetacatUI.appModel.get("portalLabelBlockList");
      if (nodeBlockList !== undefined && Array.isArray(nodeBlockList)) {
        this.set("labelBlockList", this.get("labelBlockList").concat(nodeBlockList));
      }

      //When this Collection has been saved, re-save the collection definition
      this.on("successSaving", function(){
        this.get("definitionFilters").reset(this.getAllDefinitionFilters());
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
          url: MetacatUI.appModel.get("metaServiceUrl") + encodeURIComponent(this.get("id") || this.get("seriesId")),
          dataType: "text",
          success: function(response){
            model.set(DataONEObject.prototype.parse.call(model, response));
            model.trigger("systemMetadataSync");
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

      //Create a Filters collection to contain the collection definition Filters
      modelJSON.definitionFilters = new Filters();

      // Parse the collection definition
      _.each( $(rootNode).children("definition").children(), function(filterNode){

        //Add this filter to the Filters collection
        modelJSON.definitionFilters.add({
          objectDOM: filterNode
        });

      });

      //Create a Search model for this collection's filters
      modelJSON.searchModel = this.createSearchModel();
      //Add all the filters from the Collection definition to the search model
      modelJSON.searchModel.get("filters").add(modelJSON.definitionFilters.models);

      return modelJSON;

    },

    /**
     * Generate a UUID, reserve it using the DataOne API, and set it on the model
     */
    reserveSeriesId: function(){

      // Create a new series ID
      var seriesId = "urn:uuid:" + uuid.v4();

      // Set the seriesId on the portal model right away, since reserving takes
      // time. This will be updated in the rare case that the first seriesId was
      // already taken.
      this.set("seriesId", seriesId);

      // Reserve a series ID for the new portal
      var model = this;
      var options = {
        url: MetacatUI.appModel.get("reserveServiceUrl"),
        type: "POST",
        data: { pid: seriesId },
        tryCount : 0,
        // If a generated seriesId is already reserved, how many times to retry
        retryLimit : 5,
        success: function(xhr){
          // If the first seriesId was taken, then update the model with the
          // successfully reserved seriesId.
          if(this.tryCount > 0) {
            model.set("seriesId", $(xhr).find("identifier").text());
          }
        },
        error : function(xhr) {
          // If the seriesId was already reserved, try again
          if (xhr.status == 409) {
              this.tryCount++;
              if (this.tryCount <= this.retryLimit) {
                  // Generate another seriesId
                  this.data = { pid:"urn:uuid:" + uuid.v4() };
                  // Send the reserve request again
                  $.ajax(this);
                  return;
              }
              return;
          // If the user isn't logged in, or doesn't have write access
          } else if (xhr.status = 401 ){
            model.set("isAuthorized", false);
          } else {
            parsedResponse = $(xhr.responseText).not("style, title").text();
            model.set("errorMessage", parsedResponse);
          }
        }
      }
      _.extend(options, MetacatUI.appUserModel.createAjaxSettings());
      $.ajax(options);
    },

    /**
     * Creates a FilterModel with isPartOf as the field and the seriesId as
     * the value. Adds the filter to the searchModel and the filters model
     * attributes.
     * @param {string} [seriesId] - the seriesId of the collection or portal
     */
    addIsPartOfFilter: function(seriesId){
      // If no seriesId is given
      if(!seriesId){
        // Use the seriesId set on the model
        if(this.get("seriesId")){
          seriesId = this.get("seriesId");
        // If there's no seriesId on the model, make and reserve one
        } else {
          //Create and reserve a new seriesId
          this.reserveSeriesId();
          seriesId = this.get("seriesId");

          // Set a listener to create an isPartOf filter using the seriesId once
          // the series Id is set. Just in case the first seriesId generated was
          // already reserved, update the isPartOf filters on the subsequent
          // attempts to create and resere an ID.
          this.on("change:seriesId", function(seriesId){
            this.addIsPartOfFilter();
          });

        }
      }

      //Create an isPartOf filter
      var filterModel = this.createIsPartOfFilter(seriesId);

      //Remove any existing isPartOf filters
      this.get("searchModel").get("filters").removeFiltersByField("isPartOf");
      this.get("definitionFilters").removeFiltersByField("isPartOf");

      //Add the new isPartOf filter
      this.get("searchModel").get("filters").add(filterModel);
      this.get("definitionFilters").add(filterModel);
    },

    /**
     * Creates a FilterModel with isPartOf as the field and this collection's
     * seriesId as the value.
     * @param {string} [seriesId] - the seriesId of the collection or portal
     * @return {Filter}
     */
    createIsPartOfFilter: function(seriesId){

      // If no seriesId is given, use the one from the model
      if(!seriesId){
        var seriesId = this.get("seriesId");
      }

      // Create the new filterModel
      var filterModel = new Filter({
        fields: ["isPartOf"],
        values: [seriesId],
        label: "Datasets added manually",
        matchSubstring: false,
        operator: "OR"
      });

      return filterModel;

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
    updateCollectionDOM: function(objectDOM){

      // Get or make objectDOM
      if(!objectDOM){
        if (this.get("objectDOM")) {
          var objectDOM = this.get("objectDOM").cloneNode(true);
          $(objectDOM).empty();
        } else {
            // create an XML collection element from scratch
            var objectDOM = $(this.createXML()).children()[0];
        }
      }

      // Remove definition node if it exists in XML already
      $(objectDOM).find("definition").remove();

      // Create new definition element
      var definitionSerialized = objectDOM.ownerDocument.createElement("definition");

      //Get the filters that are currently applied to the search.
      var filtersToSerialize = this.getAllDefinitionFilters();

      // Iterate through the filter models
      _.each(filtersToSerialize, function(filterModel){

        // updateDOM of portal definition filters, then append to <definition>
        var filterSerialized = filterModel.updateDOM({
          forCollection: true
        });

        //Add the filter node to the XMLDocument
        objectDOM.ownerDocument.adoptNode(filterSerialized);

        //Append the filter node to the definition node
        definitionSerialized.appendChild(filterSerialized);

      }, this);

      //If at least one filter was serialized, add the <definition> node
      if( definitionSerialized.childNodes.length ){
        $(objectDOM).prepend(definitionSerialized);
      }

      // Get and update the simple text strings (everything but definition)
      // in reverse order because we prepend them consecutively to objectDOM
      var collectionTextData = {
        description: this.get("description"),
        name: this.get("name"),
        label: this.get("label")
      }

      _.map(collectionTextData, function(value, nodeName){

        // Remove the node if it exists
        // Use children() and not find() as there are sub-children named label
        $(objectDOM).children(nodeName).remove();

        // Don't serialize falsey values
        if(value && (typeof value == "string" && value.trim().length)){
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
     * Initialize the object XML for a brand spankin' new collection
     * @return {Element}
    */
    createXML: function() {

      // TODO: which attributes should a new XML portal doc should have?
      var xmlString = "<col:collection xmlns:col=\"https://purl.dataone.org/collections-1.0.0\"></col:collection>",
          xmlNew = $.parseXML(xmlString),
          colNode = xmlNew.getElementsByTagName("col:collections")[0];

      // set attributes
      colNode.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
      colNode.setAttribute("xsi:schemaLocation", "https://purl.dataone.org/collections-1.0.0");

      this.set("ownerDocument", colNode.ownerDocument);

      return(xmlNew);
    },

    /**
    * Creates a new instance of a Search model with a Filters collection.
    * The Search model is created and returned and NOT set directly on the model in
    * this function, because this function is called during parse(), when we're not ready
    * to set attributes directly on the model yet.
    * @return {Search}
    */
    createSearchModel: function(){
      var search = new Search();
      search.set("filters", new Filters(null, { catalogSearch: true }));
      return search;
    },

    /**
    * Returns an array of the Filter models that have a value set
    */
    getAllDefinitionFilters: function(){

      return this.get("searchModel").get("filters").filter(function(filterModel){

        // If this filter has a value set by the user, and it's not in a query group
        // marked to ignore, then include it
        return( filterModel.hasChangedValues() &&
                !this.get("ignoreQueryGroups").includes( filterModel.get("queryGroup") ));

      }, this);
    },

    /**
    * This is a shortcut function that returns the query for the datasets in this portal,
    *  using the Search model for this portal. This is the full query that includes the filters not
    *  serialized to the portal XML, such as the filters used for the DataCatalogView.
    *
    */
    getQuery: function(){

      return this.get("searchModel").get("filters").getQuery();

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

    },

    /**
     * Overrides the default Backbone.Model.validate.function() to
     * check if this portal model has all the required values necessary
     * to save to the server.
     *
     * @param {Object} [attrs] - A literal object of model attributes to validate.
     * @param {Object} [options] - A literal object of options for this validation process
     * @return {Object} If there are errors, an object comprising error
     *                   messages. If no errors, returns nothing.
    */
    validate: function(attrs, options) {

      try{

        var errors = {};

        // ---- Validate label----
        var labelError = this.validateLabel(this.get("label"));
        if( labelError ){
          errors.label = labelError;
        }

        // ---- Validate the definition filters ----
        if( this.getAllDefinitionFilters().length == 0 ){
          errors.definition = "Your dataset collection hasn't been created. Add at least one search " +
                              "term below to find datasets for this " +
                              this.type.toLowerCase() + ". For example, to create a " + this.type.toLowerCase() +
                              " for datasets from a specific research project, try searching for the project name.";
        }
        else{
          _.each( this.getAllDefinitionFilters(), function(filter){

            if( !filter.isValid() ){
              errors.definition = "At least one filter is invalid.";
            }

          }, this);
        }

        if( Object.keys(errors).length )
          return errors;
        else{
          return;
        }

      }
      catch(e){
        console.error(e);
      }

    },

    /**
     * Checks that a label does not equal a restricted value
     * (e.g. new temporary name), and that it's encoded properly
     * for use as part of a url
     *
     * @param {string} label - The label to be validated
     * @return {string} - If the label is invalid, an error message string is returned
    */
    validateLabel: function(label){

      try{

        //Validate the label set on the model if one isn't given
        if(typeof label != "string" ){
          var label = this.get("label");
        }

        //If the label is empty
        if( typeof label != "string" || !label.trim().length ){
          var type = this.type.toLowerCase();
          return "Please choose a name for this " + type + " to use in the URL.";
        }

        // If the label is a restricted string
        var blockList = this.get("labelBlockList");
        if( blockList && Array.isArray(blockList) ){
          if(blockList.includes(label)){
            return "This URL is already taken, please try something else";
          }
        }

        // If the label includes illegal characers
        // (Only allow letters, numbers, underscores and dashes)
        if(label.match(/[^A-Za-z0-9_-]/g)){
          return "URLs may only contain letters, numbers, underscores (_), and dashes (-).";
        }

      }
      catch(e){
        //Trigger an error event
        this.trigger("errorValidatingLabel");
        console.error(e);
      }

    }

	});

	return CollectionModel;
});
