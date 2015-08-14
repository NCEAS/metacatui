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
				registered: false,
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
			
			//Only proceed if the accounts API service is being utilized and there is a username
			if(!this.get("username")) return;
			if(!appModel.get("accountsUrl")){
				this.getNameFromSubject();
				return;
			}
			
			//Get the user info using the DataONE API
			var url = appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));
			
			var accountsRequestOptions = {
				type: "GET",
				url: url, 
				success: function(data, textStatus, xhr) {	
				
					//Get the pending identity map requests, if the service is turned on
					if(appModel.get("pendingMapsUrl")){					
						//Get the pending requests			
						$.ajax({
							url: appModel.get("pendingMapsUrl") + encodeURIComponent(model.get("username")),
							success: function(data, textStatus, xhr){
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
							}
						});
					}
					
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
							ownerEls = $(group).find("rightsHolder"),
							members   = new Array(),
							owners    = new Array(),
							groupName = $(group).find("groupName").first().text(),
							subject   = $(group).find("subject").first().text();
						
						//Go through each member element and grab the member's username
						_.each(memberEls, function(member, i){
							members.push($(member).text());
						});
						
						//Go through each owner element and grab the owner's username
						_.each(ownerEls, function(owner, i){
							owners.push($(owner).text());
						});
						
						//Create the group object and add it to the model
						groups.push({
							groupName : groupName,
							subject   : subject,
							members   : members,
							owners    : owners
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
					model.set("registered",  true);
				},
				error: function(xhr, textStatus, errorThrown){
					if(xhr.status == 404)
						model.getNameFromSubject();
				}
			}
			
			//Send a token with the request if there is one
			if(this.get("token")){
				accountsRequestOptions.xhrFields = { withCredentials: true }
				accountsRequestOptions.headers = { "Authorization": "Bearer " + this.get("token") }
			}
			
			//Send the request
			$.ajax(accountsRequestOptions);
		},
		
		getNameFromSubject: function(){
			var username  = this.get("username"),
				fullName = "";
			
			if((username.indexOf("uid=") > -1) && (username.indexOf(",") > -1))
				fullName = username.substring(username.indexOf("uid=") + 4, username.indexOf(","));
			else if((username.indexOf("CN=") > -1) && (username.indexOf(",") > -1))
				fullName = username.substring(username.indexOf("CN=") + 3, username.indexOf(","));
			else
				fullName = this.get("fullname") || username;
			
			this.set("fullName", fullName);
		},
		
		loginLdap: function(formData, success, error){
			if(!formData || !appModel.get("signInUrlLdap")) return false;
			
			var model = this;
			
			$.ajax({
				type: "POST",
				url: appModel.get("signInUrlLdap") + window.location.href, 
				data: formData, 
			/*	success: function(data, textStatus, xhr){
					if(success)
						success(this);
					
					$("#SignInLdap")
					//Direct to the Ldap sign in
					//window.location = appModel.get("signInUrlLdap") + window.location.href;
				},*/
				error: function(){
					if(error)
						error(this);
				}
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
						
						//Are we logged in?
						if(username)
							model.set("loggedIn", true);
						else
							model.set("loggedIn", false);
						
						model.getInfo();
					},
					error: function(data, textStatus, xhr){
						//User is not logged in
						//model.set("loggedIn", false);
						//model.set("username", model.defaults().username);
						model.reset();
						model.trigger("change:loggedIn");
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
		},
		
		update: function(onSuccess, onError){
			var model = this;
			
			var person = 
				'<?xml version="1.0" encoding="UTF-8"?>'
				+ '<d1:person xmlns:d1="http://ns.dataone.org/service/types/v1">'
					+ '<subject>' + this.get("username") + '</subject>'
					+ '<givenName>' + this.get("firstName") + '</givenName>'
					+ '<familyName>' + this.get("lastName") + '</familyName>'
					+ '<email>' + this.get("email") + '</email>'
				+ '</d1:person>';
			
			var xmlBlob = new Blob([person], {type : 'application/xml'});
			var formData = new FormData();
			formData.append("subject", this.get("username"));
			formData.append("person", xmlBlob, "person");

			var updateUrl = appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));
						
			// ajax call to update
			$.ajax({
				type: "PUT",
				cache: false,
			    contentType: false,
			    processData: false,
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.get("token")
			    },
				url: updateUrl,
				data: formData,
				success: function(data, textStatus, xhr) {
					if(typeof onSuccess != "undefined") 
						onSuccess(data);
					
					//model.getInfo();
				},
				error: function(data, textStatus, xhr) {
					if(typeof onError != "undefined") 
						onError(data);
					
					//model.getInfo();
				}
			});
		},
		
		reset: function(){
			this.set(_.clone(this.defaults()));
		}
	});
	
	return UserModel;
});
		