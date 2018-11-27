/* global define */
define(['jquery', 'underscore', 'backbone', "collections/Search",
 "models/metadata/eml211/EMLParty", "models/metadata/eml220/EMLText",
 "models/CollectionModel", "models/filters/FilterGroup", "collections/SolrResults"],
    function($, _, Backbone, Search, EMLParty, EMLText, CollectionModel, FilterGroup, SearchResults) {

	var ProjectModel = CollectionModel.extend({

		defaults: function(){ return _.extend(CollectionModel.prototype.defaults(), {
  			logo: null,
        overview: null,
        results: null,
        associatedParties: [],
        acknowledgments: null,
        acknowledgmentsLogos: [],
        filterGroups: [],
        //A Search collection that contains all the filters assoc. with this project
        search: new Search(),
        //The project document options may specify section to hide
        hideMetrics: false,
        hideHome: false,
        hidePeople: false,
        hideMap: false,
        //Map options, as specified in the project document options
        mapZoolLevel: 9,
        mapCenterLatitude: 0,
        mapCenterLongitude: 0,
        mapShapeColor: "#333",
        //Project view colors, as specified in the project document options
        primaryColor: "#333",
        secondaryColor: "#333",
        accentColor: "#333"
  		});
    },

		initialize: function(options){
		},

    url: function(){
			return MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id"));
		},

    /*
    * Overrides the default Backbone.Model.fetch() function to provide some custom
    * fetch options
    */
    fetch: function(){
      var model = this;

      var requestSettings = {
        dataType: "xml",
        error: function(){
          model.trigger('error');
        }
      }

      //Add the user settings to the fetch settings
      requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());

      //Call Backbone.Model.fetch()
      return Backbone.Model.prototype.fetch.call(this, requestSettings);

    },

    /*
    * Overrides the default Backbone.Model.parse() function to parse the custom
    * project XML document
    *
    * @param {XMLDocument} response - The XMLDocument returned from the fetch() AJAX call
    * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
    */
		parse: function(response){

      //Start the empty JSON object
      var modelJSON = {},
          projectNode;

      //Iterate over each root XML node to find the project node
      $(response).children().each(function(i, el){
        if( el.tagName.indexOf("project") > -1 ){
          projectNode = el;
          return false;
        }
      });

      //If a project XML node wasn't found, return an empty JSON object
      if( typeof projectNode == "undefined" || !projectNode )
        return {};

      //Parse the collection elements
      modelJSON = this.parseCollectionXML(projectNode);

      //Parse the simple text nodes
      modelJSON.logo = this.parseTextNode(projectNode, "logo");
      modelJSON.acknowledgmentsLogo = this.parseTextNode(projectNode, "acknowledgmentsLogo", true);

      //Parse the EMLText elements
      modelJSON.overview = this.parseEMLTextNode(projectNode, "overview");
      modelJSON.results = this.parseEMLTextNode(projectNode, "results");
      modelJSON.acknowledgments = this.parseEMLTextNode(projectNode, "acknowledgments");

      //Parse the associatedParties
      modelJSON.associatedParties = [];
      $(projectNode).children("associatedParty").each(function(i, associatedParty){

        modelJSON.associatedParties.push( new EMLParty({ objectDOM: associatedParty }) );

      });

      //Parse the options
      $(projectNode).find("option").each(function(i, option){

        var optionName  = $(option).find("optionName")[0].textContent,
            optionValue = $(option).find("optionValue")[0].textContent;

        if( optionValue === "true" ){
          optionValue = true;
        }
        else if( optionValue === "false" ){
          optionValue = false;
        }

        modelJSON[optionName] = optionValue;

      });

      //Parse the filterGroups
      modelJSON.filterGroups = [];
      $(projectNode).find("filterGroup").each(function(i, filterGroup){

        modelJSON.filterGroups.push( new FilterGroup({ objectDOM: filterGroup }) );

      });

      console.log(modelJSON);

      return modelJSON;
		},

    /*
    * Parses the XML nodes that are of type EMLText
    *
    * @param {Element} parentNode - The XML Element that contains all the EMLText nodes
    * @param {string} nodeName - The name of the XML node to parse
    * @param {boolean} isMultiple - If true, parses the nodes into an array
    * @return {(string|Array)} - Returns a string or array of strings of the text content
    */
		parseEMLTextNode: function(parentNode, nodeName, isMultiple){

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
        return new EMLText({ objectDOM: node[0] });
      }
      //If more than one node is found, parse into an array
      else{

        return _.map(node, function(node){
          return new EMLText({ objectDOM: node });
        });

      }

    },

    /*
    * Creates a Search collection with all filters associated with this collection
    * and project. Sets it on the `search` attribute.
    *
    * @return {Search} - Returns a Search collection that contains all the Filter
    * models associated with this project
    */
    createSearch: function(){

      var search = new Search();

      _.each(this.get("filterGroups"), function(filterGroup){
        search.add(filterGroup.get("filters").models);
      });

      search.add(this.get("filters").models);

      this.set("search", search);


      return search;

    }

	});

	return ProjectModel;
});
