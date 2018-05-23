/* global define */
define(['jquery', 'underscore', 'backbone', "models/metadata/eml211/EMLParty", "models/CollectionModel"],
    function($, _, Backbone, EMLParty, CollectionModel) {

	var ProjectModel = Backbone.Model.extend({

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
      funding: null,
      award: null,
      synopsis: null,
      logos: [],
      projectLogo: null
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
      this.setURL();
		},

    setURL: function(){
			this.set("url", MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id")));
		},

    fetch: function(){
      var model = this;
      var requestSettings = {
        url: model.get("url"),
        dataType: "xml",
        success: function(response){
          model.parse(response);
        },
        error: function(){
          model.trigger('error');
        }
      }

      //Add the authorization header and other AJAX settings
      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },

		parse: function(response){
      var xmlDoc = response;
      MetacatUI.docTest = xmlDoc;
			var modelJSON = {};

      //Parse the title
      //There are multiple title nodes nested within funding elements - only want top level
      var titleNode = _.first($(xmlDoc).find("title"));
      if( titleNode ){
          modelJSON.title = titleNode.innerHTML || null;
          this.set("title", titleNode.innerHTML);
      }

      //Parse the synopsis
      var synopsis = $(xmlDoc).find("synopsis");
      if( synopsis ){
        modelJSON.synopsis = synopsis.text() || null;
        this.set("synopsis", synopsis.text())
      }

      //TODO This will need to be farmed out to a markdown processor
      var description = $(xmlDoc).find("projectDescription");
      if( description ){
        modelJSON.projectDescription = description.text() || null;
        this.set("projectDescription", description.text())
      }

      //TODO need to talk more about different ways that we can store logos. Haven't finalized this.
      // options: URL to external source, stored as an object w/ pid, or raw bytes
      var logos = $(xmlDoc).find("logos");
      _.each(logos, function(logo) {
        //var logoType = logo.children()
        //if( logo.find("imageURL") ){
        //}
      }, this);

      //Get the collection id and model
      var collection = $(xmlDoc).find("projectCollection")
      MetacatUI.responsetest = response;
      if ( collection ){
        modelJSON.projectCollection = new CollectionModel({
          id: collection.find("collectionID").text()
        });
      }

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

			var personnelNodes = $(xmlDoc).find("personnel");
			modelJSON.personnel = [];
      _.each(personnelNodes, function(personnelNode){
         modelJSON.personnel.push( new EMLParty({ objectDOM: personnelNode, parentModel: this }))
      })

      this.set("personnel", modelJSON.personnel);

      MetacatUI.jsontest = modelJSON;

			return modelJSON;
		}
	});

	return ProjectModel;
});
