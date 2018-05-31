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
      this.createCollectionDefinition();

			var searchResults = new SearchResults([], { rows: 5, start: 0 });
			this.set("searchResults", searchResults);
		},

    url: function(){
			return MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id"));
		},

    createCollectionDefinition: function(){
      this.set("searchModel", new SearchModel());

      //Need to iterate through the list of filter groups, extract each filter,
      // then field and value for each filter

      //Placeholder for now for SASAP
      this.get("searchModel").set("project", "State of Alaska's Salmon and People");
      this.trigger("change:searchModel");
    },

    fetch: function(){
      var model = this;
      var requestSettings = {
        url: this.url(),
        dataType: "json",
        error: function(){
          model.trigger('error');
        }
      }

      //Add the authorization header and other AJAX settings
      requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());
      return Backbone.Model.prototype.fetch.call(this, requestSettings);
    }
	});

	return CollectionModel;
});
