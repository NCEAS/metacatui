/* global define */
define(['jquery', 'underscore', 'backbone', "models/metadata/eml211/EMLParty", "models/CollectionModel", "models/ImageModel", "collections/SolrResults"],
    function($, _, Backbone, EMLParty, CollectionModel, Image, SearchResults) {

	var ProjectModel = CollectionModel.extend({

		defaults: {
      id: null,
      url: null,
      projectCollection: null,
			title: null,
			funding: [],
			personnel: null,
			parentModel: null,
      projectDescription: null,
      resultsOverview: null,
      acknowledgments: null,
      award: [],
      synopsis: null,
      logos: [],
      projectLogo: null,
      searchResults: null
		},

    //Don't need this yet
    nodeNameMap: function(){
      return {
        "projectid" : "projectId",
        "projectcollection" : "projectCollection",
        "projectdescription" : "projectDescription",
        "resultsoverview" : "resultsOverview",
        "studyareadescription" : "studyAreaDescription",
        "relatedproject" : "relatedProject",
        "researchproject" : "researchProject"
      }
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

/*
      //Parse the synopsis
      var synopsis = $(projectNode).find("synopsis");
      if( synopsis ){
        modelJSON.synopsis = synopsis.text() || null;
      }

      //TODO need to talk more about different ways that we can store logos. Haven't finalized this.
      // options: URL to external source, stored as an object w/ pid, or raw bytes
      var logos = $(projectNode).find("logos");
      // For now, find all logos that have external URLS
      var logoImages = logos.find("image");
      modelJSON.logos = [];
      _.each(logoImages, function(logo){
        modelJSON.logos.push( new Image({ imageURL: $(logo).find("imageURL").text() }));
      });


      // modelJSON.collectionJSON = this.collectionFetch.responseText;
			//TODO fix this: Parse the funding info
			modelJSON.funding = [];
			var fundingEl    = $(projectNode).find("funding"),
				  fundingNodes = fundingEl.children("para").length ? fundingEl.children("para") : fundingEl;

      //Iterate over each funding node and put the text into the funding array
			_.each(fundingNodes, function(fundingNode){
        if( $(fundingNode).text() ){
            modelJSON.funding.push( $(fundingNode).text() );
        }

			}, this);

      //Parse the project personnel
			var personnelNodes = $(projectNode).find("personnel");
			modelJSON.personnel = [];

      //TODO - I'm running into problems with parsing the xml every time there are children nodes.
      // I'm not sure if this is a problem with the xml document itself or if something else needs to be done while parsing.
      _.each(personnelNodes, function(personnelNode){
         modelJSON.personnel.push( new EMLParty({
           objectDOM: personnelNode,
           parentModel: this }))
      });
    */

      return modelJSON;
		},

	});

	return ProjectModel;
});
