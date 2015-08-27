/*global define */
define(['jquery', 'underscore', 'backbone', 'models/Search', "models/LookupModel", "collections/SolrResults"], 				
	function($, _, Backbone, SearchModel, LookupModel, SearchResults) {
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
				orcid: null,
				searchModel: null,
				searchResults: null,
				loggedIn: false,
				registered: false,
				isMemberOf: [],
				isOwnerOf: [],
				identities: [],
				pending: [],
				token: null
			}
		},
		
		initialize: function(options){
			if(typeof options !== "undefined"){
				if(options.username) this.set("username", options.username);
				if(options.rawData)  this.parseXML(options.rawData);
			}
			
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
		
		parseXML: function(data){
			var model = this;
			
			//Reset the group list so we don't just add it to it with push()
			this.set("isMemberOf", this.defaults().isMemberOf);
			//Reset the equivalent id list so we don't just add it to it with push()
			this.set("identities", this.defaults().identities);
			
			//Get the person's name and verification status
			var username   = $(data).find("person subject").first().text(),
				firstName  = $(data).find("person givenName").first().text(),
				lastName   = $(data).find("person familyName").first().text(),
				fullName   = firstName + " " + lastName,
				email      = $(data).find("person email").first().text(),
				verified   = $(data).find("person verified").first().text(),
				groups     = this.get("isMemberOf"),
				ownerOf	   = this.get("isOwnerOf"),
				identities = this.get("identities");
			
			//Get each equivalent identity and save
			_.each($(data).find("person").first().find("equivalentIdentity"), function(identity, i){
				//push onto the list
				// TODO: include person details?
				var id = $(identity).text();
				identities.push(id);
			});
			
			//Get each group and save
			_.each($(data).find("group"), function(group, i){
				var groupId = $(group).find("subject").first().text();
				groups.push(groupId);
								
				if($(group).children("rightsHolder:contains('" + model.get("username") + "')").length > 0)
					ownerOf.push(groupId);
			});
			
			return {
				isMemberOf: groups,
				isOwnerOf: ownerOf,
				identities: identities,
				verified: verified,
				username: username,
				firstName: firstName,
				lastName: lastName,
				fullName: fullName,
				email: email,
				registered: true
			}
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
					//Parse the response
					model.set(model.parseXML(data));
					 //Trigger the change events
					model.trigger("change:isMemberOf");
					model.trigger("change:isOwnerOf");
					model.trigger("change:identities");

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
		