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

    fetch: function(){      
      var model = this;
      $.ajax({
        url: this.url(),
        dataType: "xml",
        error: function(){
          model.trigger('error');
        },
        success: function(response){
          //Stash the project XML so we can parse it later
          model.projectXML = response;

          //Get the collection id
          var collection = $(response).find("projectCollection")
          if ( collection ){
            model.collectionID = collection.find("collectionID").text() || null;
          }

          //Set up the request to get the collection json
          var requestSettings = {
            url: "https://dev.nceas.ucsb.edu/knb/d1/mn/v2/object/" + model.collectionID, // need to replace hard-coding of dev
            dataType: "json",
            error: function(){
              model.trigger('error');
            }
          }

          requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());
          return Backbone.Model.prototype.fetch.call(model, requestSettings);
        }
      });
    },

		parse: function(response){
      // console.log(response);
      var xmlDoc = this.projectXML;
			var modelJSON = response;

      //Parse the title
      //There are multiple title nodes nested within funding elements - only want top level
      var titleNode = _.first($(xmlDoc).find("title"));
      if( titleNode ){
          modelJSON.title = titleNode.innerHTML || null;
      }

      //Parse the synopsis
      var synopsis = $(xmlDoc).find("synopsis");
      if( synopsis ){
        modelJSON.synopsis = synopsis.text() || null;
      }

      //TODO This will need to be farmed out to a markdown processor
      var description = $(xmlDoc).find("projectDescription");
      if( description ){
        modelJSON.projectDescription = description.text() || null;
      }

      //TODO need to talk more about different ways that we can store logos. Haven't finalized this.
      // options: URL to external source, stored as an object w/ pid, or raw bytes
      var logos = $(xmlDoc).find("logos");
      // For now, find all logos that have external URLS
      var logoImages = logos.find("image");
      modelJSON.logos = [];
      _.each(logoImages, function(logo){
        modelJSON.logos.push( new Image({ imageURL: $(logo).find("imageURL").text() }));
      });

      //Get the collection id and model
      var collection = $(xmlDoc).find("projectCollection")
      if ( collection ){
        modelJSON.projectCollection = collection.find("collectionID").text() || null;
      }

      // modelJSON.collectionJSON = this.collectionFetch.responseText;
			//TODO fix this: Parse the funding info
			modelJSON.funding = [];
			var fundingEl    = $(xmlDoc).find("funding"),
				  fundingNodes = fundingEl.children("para").length ? fundingEl.children("para") : fundingEl;

      //Iterate over each funding node and put the text into the funding array
			_.each(fundingNodes, function(fundingNode){
        if( $(fundingNode).text() ){
            modelJSON.funding.push( $(fundingNode).text() );
        }

			}, this);

      //Parse the project personnel
			var personnelNodes = $(xmlDoc).find("personnel");
			modelJSON.personnel = [];

      //TODO - I'm running into problems with parsing the xml every time there are children nodes.
      // I'm not sure if this is a problem with the xml document itself or if something else needs to be done while parsing.
      _.each(personnelNodes, function(personnelNode){
         modelJSON.personnel.push( new EMLParty({
           objectDOM: personnelNode,
           parentModel: this }))
      });

      //Parse the acknowledgments -
      var acknowledgments = $(xmlDoc).find("acknowledgements");
      if( acknowledgments ){
        modelJSON.acknowledgments = acknowledgments.text() || null;
      }

      // console.log(modelJSON);
      return modelJSON;
		}
	});

	return ProjectModel;
});
