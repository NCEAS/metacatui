/* global define */
define(['jquery', 'underscore', 'backbone', 'models/Search', 'collections/SolrResults'],
    function($, _, Backbone, SearchModel, SearchResults) {

	var CollectionModel = Backbone.Model.extend({

		defaults: {
      id: null,
      name: null,
      label: null,
      synopsis: null,
			definition: null,
			optionalFilterGroups: null,

      searchModel: null,
      searchResults: null,
      definitionFilters: []
		},

		initialize: function(options){
      this.setURL();
      this.createCollectionDefinition();

      this.on("change:definition", this.createCollectionDefinition);

			var searchResults = new SearchResults([], { rows: 5, start: 0 });
			this.set("searchResults", searchResults);
		},

    setURL: function(){
			this.set("url", MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id")));
		},

    createCollectionDefinition: function(){
      this.set("searchModel", new SearchModel());

      //Need to iterate through the list of filter groups, extract each filter,
      // then field and value for each filter

      //Placeholder for now for SASAP
      this.get("searchModel").set("rightsHolder", "CN=SASAP,DC=dataone,DC=org");
      this.trigger("change:searchModel");
    },

    updateCollectionDefinition: function(){
			if(this.get("type") == "node"){
				this.get("searchModel").set("dataSource", [this.get("node").identifier]);
				this.get("searchModel").set("username", []);
			}
			else{
				//Get all the identities for this person
				var ids = [this.get("username")];

				_.each(this.get("identities"), function(equivalentUser){
					ids.push(equivalentUser.get("username"));
				});
				this.get("searchModel").set("username", ids);
			}

			this.trigger("change:searchModel");
		},

    fetch: function(){
      var model = this;
      var requestSettings = {
        url: model.get("url"),
        dataType: "json",
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
      this.set("synopsis", response.synopsis);
      this.set("name", response.name);
      this.set("label", response.label);
      this.set("definition", response.definition);
      this.set("optionalFilterGroups", response.optionalFilterGroups);
    }
	});

	return CollectionModel;
});
