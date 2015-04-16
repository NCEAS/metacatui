/*global define */
define(['jquery', 'underscore', 'backbone', 'models/Search', "collections/SolrResults"], 				
	function($, _, Backbone, SearchModel, SearchResults) {
	'use strict';

	// User Model
	// ------------------
	var UserModel = Backbone.Model.extend({
		defaults: {
			lastName: null,
			firstName: null,
			verified: null,
			username: null,
			searchModel: null,
			searchResults: null
		},
		
		initialize: function(){
			if(!this.get("username"))
				this.set("username", appModel.get("profileUsername"));
			
			this.set("searchModel", new SearchModel({
				username: [this.get("username")]
			}));
			var searchResults = new SearchResults([], { rows: 3 });
			this.set("searchResults", searchResults);
		},
		
		getInfo: function(){
			var model = this;
			
			//Get the user info using the DataONE API
			var url = appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));
			
			$.get(url, function(data, textStatus, xhr){				
				model.set("verified", $(data).find("person verified").text());
				model.set("firstName", $(data).find("person givenName").text());
				model.set("lastName", $(data).find("person familyName").text());
			});
		}
	});
	
	return UserModel;
});
		