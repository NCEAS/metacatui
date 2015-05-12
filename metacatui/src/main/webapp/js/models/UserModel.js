/*global define */
define(['jquery', 'underscore', 'backbone', 'models/Search', "collections/SolrResults"], 				
	function($, _, Backbone, SearchModel, SearchResults) {
	'use strict';

	// User Model
	// ------------------
	var UserModel = Backbone.Model.extend({
		defaults: function(){
			return{
				lastName: null,
				firstName: null,
				fullName: null,
				email: null,
				verified: null,
				username: null,
				searchModel: null,
				searchResults: null,
				loggedIn: false,
				groups: [],
				identities: [],
				pending: [],
				token: null
			}
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
				//Reset the group list so we don't just add it to it with push()
				model.set("groups", model.defaults().groups);
				//Reset the equivalent id list so we don't just add it to it with push()
				model.set("identities", model.defaults().identities);
				
				//Get the person's name and verification status
				var firstName = $(data).find("person givenName").first().text(),
					lastName  = $(data).find("person familyName").first().text(),
					fullName  = firstName + " " + lastName,
					email  = $(data).find("person email").first().text(),
					verified  = $(data).find("person verified").first().text(),
					groups    = model.get("groups"),
					identities = model.get("identities");

				//For each group this user is in, create a group object and store it in this model
				_.each($(data).find("group"), function(group, i){
					//Get all the group information
					var memberEls = $(group).find("hasMember"),
						members   = new Array(),
						groupName = $(group).find("groupName").first().text(),
						subject   = $(group).find("subject").first().text();
					
					//Go through each member element and grab the member's name
					_.each(memberEls, function(member, i){
						members.push($(member).text());
					});
					
					//Create the group object and add it to the model
					groups.push({
						groupName : groupName,
						subject   : subject,
						members   : members
					});
				});
				
				//For each equiv id, store in the model
				_.each($(data).find("person").first().find("equivalentIdentity"), function(identity, i){
					//push onto the list
					// TODO: include person details?
					var id = $(identity).text();
					identities.push(id);
				});

				//Save all these attributes in the model
				model.set("groups",    groups);	
				model.trigger("change:groups"); //Trigger the change event since it's an array and won't fire a change event on its own				
				model.set("identities", identities);	
				model.trigger("change:identities"); //Trigger the change event
				model.set("verified",  verified);
				model.set("firstName", firstName);
				model.set("lastName",  lastName);
				model.set("fullName",  fullName);
				model.set("email",  email);
			});
			
			
			//Get the pending requests
			url = appModel.get("accountsUrl") + "pendingmap/" + encodeURIComponent(this.get("username"));
			
			$.get(url, function(data, textStatus, xhr){
				//Reset the equivalent id list so we don't just add it to it with push()
				model.set("pending", model.defaults().pending);
				var pending = model.get("pending");
				_.each($(data).find("person"), function(person, i) {
					var subject = $(person).find("subject").text();
					if (subject.toLowerCase() != model.get("username").toLowerCase()) {
						pending.push(subject);
					}
				});
				model.set("pending", pending);	
				model.trigger("change:pending"); //Trigger the change event
				
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
		
		checkToken: function(customCallback) {
			var tokenUrl = appModel.get('tokenUrl');
			var model = this;
			
			if(!tokenUrl) return false;
			
			//Set up the function that will be called when we retrieve a token
			var callback = (typeof customCallback === "function") ? customCallback : function(data, textStatus, xhr) {
				
				// the response should have the token
				var payload = model.parseToken(data);
				var username = payload.userId;
				var fullName = payload.fullName;
				var token    = data;

				// set in the model
				model.set('fullName', fullName);
				model.set('username', username);
				model.set("loggedIn", true);
				model.set("token", token);
				model.getInfo();
			};
			
			// ajax call to get token
			$.ajax({
				type: "GET",
				xhrFields: {
					withCredentials: true
				},
				url: tokenUrl,
				data: {},
				success: callback
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
		