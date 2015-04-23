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
			fullName: null,
			verified: null,
			username: null,
			searchModel: null,
			searchResults: null,
			loggedIn: false
		},
		
		initialize: function(){
			//If no username was provided at time of initialization, then use the profile username (username sent to #profile view)
			if(!this.get("username"))
				this.set("username", appModel.get("profileUsername"));
			
			this.on("change:username", this.createSearchModel);
			this.createSearchModel();
			
			//Create a search results model for this person
			var searchResults = new SearchResults([], { rows: 5, start: 0 });
			this.set("searchResults", searchResults);
		},
		
		createSearchModel: function(){
			//Create a search model that will retrieve data created by this person
			this.set("searchModel", new SearchModel({
				username: [this.get("username")]
			}));
		},
		
		getInfo: function(){
			var model = this;
			
			//Get the user info using the DataONE API
			var url = appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));
			
			$.get(url, function(data, textStatus, xhr){
				var firstName = $(data).find("person givenName").first().text();
				var lastName = $(data).find("person familyName").first().text();
				
				model.set("verified",  $(data).find("person verified").first().text());
				model.set("firstName", firstName);
				model.set("lastName",  lastName);
				if(!model.get("fullName")) model.set("fullName",  firstName + " " + lastName);
			});
		},
		
		// call Metacat or the DataONE CN to validate the session and tell us the user's name
		checkStatus: function() {
			var model = this;
			
			// look up the URL
			var metacatUrl = appModel.get('metacatServiceUrl');
			
			if (metacatUrl) {				
				// ajax call to validate the session/get the user info
				$.ajax({
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: metacatUrl,
					data: { action: "validatesession" },
					success: function(data, textStatus, xhr) {
						
						// the Metacat (XML) response should have a fullName element
						var username = $(data).find("name").text();
						
						// set in the model
						model.set('username', username);
						model.set("loggedIn", true);
						
						model.getInfo();
					}
				});
			} else {
				// use the token method for checking authentication
				this.checkToken();
			}			
		},
		
		checkToken: function() {
			var tokenUrl = appModel.get('tokenUrl');
			var model = this;
			
			if(!tokenUrl) return false;
			
			// ajax call to get token
			$.ajax({
				type: "GET",
				xhrFields: {
					withCredentials: true
				},
				url: tokenUrl,
				data: {},
				success: function(data, textStatus, xhr) {
					
					// the response should have the token
					var payload = model.parseToken(data);
					var username = payload.userId;
					var fullName = payload.fullName;

					// set in the model
					model.set('fullName', fullName);
					model.set('username', username);
					model.set("loggedIn", true);
					model.getInfo();
				}
			});
		},
		
		parseToken: function(token) {
			
			var jws = new KJUR.jws.JWS();
			var result = 0;
			try {
				result = jws.parseJWS(token);
			} catch (ex) {
				console.log("JWT warning: " + ex);
			    result = 0;
			}
			
			var payload = $.parseJSON(jws.parsedJWS.payloadS);
			return payload;			
		}
	});
	
	return UserModel;
});
		