/*global define */
define(['jquery', 'underscore', 'backbone', 'models/Search', "collections/SolrResults"], 				
	function($, _, Backbone, SearchModel, SearchResults) {
	'use strict';

	// User Model
	// ------------------
	var UserModel = Backbone.Model.extend({
		defaults: function(){
			return{
				type: "person", //assume this is a person unless we are told otherwise - other possible type is a "group"
				checked: false, //Set to true when we have checked the status of this user
				basicUser: false, //Set to true to only query for basic info about this user - prevents sending queries for info that will never be displayed in the UI
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
				identitiesUsernames: [],
				pending: [],
				token: null,
				rawData: null
			}
		},
		
		initialize: function(options){
			if(typeof options !== "undefined"){
				if(options.username) this.set("username", options.username);
				if(options.rawData)  this.set(this.parseXML(options.rawData));
			}
			
			this.on("change:identities", this.pluckIdentityUsernames);
						
			this.on("change:username change:identities", this.updateSearchModel);
			this.createSearchModel();
						
			//Create a search results model for this person
			var searchResults = new SearchResults([], { rows: 5, start: 0 });
			this.set("searchResults", searchResults);
		},
		
		createSearchModel: function(){			
			//Create a search model that will retrieve data created by this person
			this.set("searchModel", new SearchModel());	
			this.updateSearchModel();
		},
		
		updateSearchModel: function(){	
			//Get all the identities for this person
			var ids = [this.get("username")];
			
			_.each(this.get("identities"), function(equivalentUser){
				ids.push(equivalentUser.get("username"));
			});
			
			this.get("searchModel").set("username", ids);			
			this.trigger("change:searchModel");
		},
		
		parseXML: function(data){
			var model = this,
				username = this.get("username");
			
			//Reset the group list so we don't just add it to it with push()
			this.set("isMemberOf", this.defaults().isMemberOf, {silent: true});
			this.set("isOwnerOf", this.defaults().isOwnerOf, {silent: true});
			//Reset the equivalent id list so we don't just add it to it with push()
			this.set("identities", this.defaults().identities, {silent: true});
			
			//Find this person's node in the XML
			var userNode = null;
			if(!username)
				var username = $(data).children("subject").text();			
			if(username){			
				var subjects = $(data).find("subject");
				for(var i=0; i<subjects.length; i++){
					if($(subjects[i]).text().toLowerCase() == username.toLowerCase()){
						userNode = $(subjects[i]).parent();
						break;
					}
				}
			}
			if(!userNode)
				userNode = $(data).first();
			
			//Get the type of user - either a person or group
			var type = $(userNode).prop("tagName").toLowerCase();
			if(type == "group"){
				var fullName = $(userNode).find("groupName").first().text();
			}
			else{
				//Find the person's info
				var	firstName  = $(userNode).find("givenName").first().text(),
					lastName   = $(userNode).find("familyName").first().text(),
					email      = $(userNode).find("email").first().text(),
					verified   = $(userNode).find("verified").first().text(),
					memberOf   = this.get("isMemberOf"),
					ownerOf	   = this.get("isOwnerOf"),
					identities = this.get("identities");
				
				//Sometimes names are saved as "NA" when they are not available - translate these to false values
				if(firstName == "NA")
					firstName = null;
				if(lastName == "NA")
					lastName = null;
				
				//Construct the fullname from the first and last names, but watch out for falsely values
				var fullName = "";
					fullName += firstName? firstName : "";
					fullName += lastName? (" " + lastName) : "";
					
				//Don't get this detailed info about basic users
				if(!this.get("basicUser")){
					//Get all the equivalent identities for this user
					var equivalentIds = $(userNode).find("equivalentIdentity");
					if(equivalentIds.length > 0)
						var allPersons = $(data).find("person subject");
	
					_.each(equivalentIds, function(identity, i){
						//push onto the list
						var username = $(identity).text(),
							equivUserNode;
						
						//Find the matching person node in the response
						_.each(allPersons, function(person){
							if($(person).text().toLowerCase() == username.toLowerCase()){
								equivUserNode = $(person).parent().first();
								allPersons = _.without(allPersons, person);
							}
						});
						
						var equivalentUser = new UserModel({ username: username, basicUser: true, rawData: equivUserNode });						
						identities.push(equivalentUser);
					});
				}
				
				//Get each group and save
				_.each($(data).find("group"), function(group, i){
					//Save group ID
					var groupId = $(group).find("subject").first().text(),
						groupName = $(group).find("groupName").text();
					
					memberOf.push({ groupId: groupId, name: groupName });
									
					//Check if this person is a rightsholder
					var allRightsHolders = [];
					_.each($(group).children("rightsHolder"), function(rightsHolder){
						allRightsHolders.push($(rightsHolder).text().toLowerCase());
					});
					if(_.contains(allRightsHolders, username.toLowerCase()))
						ownerOf.push(groupId);
				});
			}
			
			return {
				isMemberOf: memberOf,
				isOwnerOf: ownerOf,
				identities: identities,
				verified: verified,
				username: username,
				firstName: firstName,
				lastName: lastName,
				fullName: fullName,
				email: email,
				registered: true,
				type: type,
				rawData: data
			}
		},
		
		getInfo: function(){
			var model = this;
			
			//Only proceed if the accounts API service is being utilized and there is a username
			if(!this.get("username")) return;
				
			//Check if this is an ORCiD
			if(this.isOrcid()){
				//Get the person's info from their ORCiD bio
				appLookupModel.orcidGetBio({ 
					userModel: this,
					success: function(){
						model.set("checked", true);
					},
					error: function(){
						model.set("checked", true);						
					}
				});
				return;
			}
			
			//Otherwise, check the accounts service
			if(!appModel.get("accountsUrl")){
				this.getNameFromSubject();
				this.set("checked", true);
				return;
			}
			//Get the user info using the DataONE API
			var url = appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));
			
			var accountsRequestOptions = {
				type: "GET",
				url: url, 
				success: function(data, textStatus, xhr) {	
					//Parse the XML response to get user info
					model.set(model.parseXML(data));
					
					 //Trigger the change events
					model.trigger("change:isMemberOf");
					model.trigger("change:isOwnerOf");
					model.trigger("change:identities");
					
					model.set("checked", true);
				},
				error: function(xhr, textStatus, errorThrown){
					if(xhr.status == 404){
						model.getNameFromSubject();
						model.set("checked", true);
					}
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
		
		//Get the pending identity map requests, if the service is turned on
		getPendingIdentities: function(){
			if(!appModel.get("pendingMapsUrl")) return false;
			
			var model = this;
			
			//Get the pending requests			
			$.ajax({
				url: appModel.get("pendingMapsUrl") + encodeURIComponent(this.get("username")),
				success: function(data, textStatus, xhr){
					//Reset the equivalent id list so we don't just add it to it with push()
					model.set("pending", model.defaults().pending);
					var pending = model.get("pending");
					_.each($(data).find("person"), function(person, i) {
						
						//Don't list yourself as a pending map request
						var personsUsername = $(person).find("subject").text();
						if(personsUsername.toLowerCase() == model.get("username").toLowerCase())
							return;
						
						//Create a new User Model for this pending identity
						var pendingUser = new UserModel({ rawData: person });
						
						if(pendingUser.isOrcid())
							pendingUser.getInfo();
						
						pending.push(pendingUser);
					});
					model.set("pending", pending);	
					model.trigger("change:pending"); //Trigger the change event
				},
				error: function(xhr, textStatus){
					if(xhr.responseText.indexOf("error code 34")){
						model.set("pending", model.defaults().pending);
						model.trigger("change:pending"); //Trigger the change event
					}
				}
			});
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
		
		isOrcid: function(orcid){
			var username = (typeof orcid === "string")? orcid : this.get("username");
			
			//Have we already verified this?
			if((typeof orcid == "undefined") && (username == this.get("orcid"))) return true;

			//A simple and fast check first
			//ORCiDs are 16 digits and 3 dashes - 19 characters
			if(username.length != 19) return false;
								
			/* The ORCiD checksum algorithm to determine is a character string is an ORCiD 
			 * http://support.orcid.org/knowledgebase/articles/116780-structure-of-the-orcid-identifier
			 */	
			var total = 0,
				baseDigits = username.replace(/-/g, "").substr(0, 15);
			
			for(var i=0; i<baseDigits.length; i++){
				var digit = parseInt(baseDigits.charAt(i));
				total = (total + digit) * 2;
			}
			
			var remainder = total % 11,
				result = (12 - remainder) % 11,
				checkDigit = (result == 10) ? "X" : result.toString(),
				isOrcid = (checkDigit == username.charAt(username.length-1));
			
			if(isOrcid)
				this.set("orcid", username);
			
			return isOrcid;
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
				var username = payload ? payload.userId : null;
				var fullName = payload ? payload.fullName : null;
				var token    = payload ? data : null;
				var loggedIn = payload ? true : false;

				// set in the model
				model.set('fullName', fullName);
				model.set('username', username);
				model.set("token", token);
				model.set("loggedIn", loggedIn);
				
				if(username && model.isOrcid())
					model.set("checked", true);
				else if(username)
					model.getInfo();
				else
					model.set("checked", true);
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
			if(typeof token == "undefined")
				var token = this.get("token");
			
			var jws = new KJUR.jws.JWS();
			var result = 0;
			try {
				result = jws.parseJWS(token);
			} catch (ex) {
			    result = 0;
			}
				
			if(!jws.parsedJWS) return "";
				
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
				}
			});
		},
		
		confirmMapRequest: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;

			var mapUrl = appModel.get("pendingMapsUrl") + encodeURIComponent(otherUsername),
				model = this;	

			if(!onSuccess)
				var onSuccess = function(){};
			if(!onError)
				var onError = function(){};
			
			// ajax call to confirm map
			$.ajax({
				type: "PUT",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.get("token")
			    },
				url: mapUrl,
				success: function(data, textStatus, xhr) {
					if(onSuccess)
						onSuccess(data, textStatus, xhr);
					
					//Get updated info
					model.getInfo();
				},
				error: function(xhr, textStatus, error) {
					if(onError)
						onError(xhr, textStatus, error);
				}
			});
		},
		
		denyMapRequest: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;
			
			var mapUrl = appModel.get("pendingMapsUrl") + encodeURIComponent(otherUsername),
				model = this;	
		
			// ajax call to reject map
			$.ajax({
				type: "DELETE",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.get("token")
			    },
				url: mapUrl,
				success: function(data, textStatus, xhr) {
					if(typeof onSuccess == "function")
						onSuccess(data, textStatus, xhr);
					
					model.getInfo();
				},
				error: function(xhr, textStatus, error) {
					if(typeof onError == "function")
						onError(xhr, textStatus, error);
				}
			});
		},
		
		addMap: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;
			
			var mapUrl = appModel.get("pendingMapsUrl"),
				model = this;
			
			// ajax call to map
			$.ajax({
				type: "POST",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.get("token")
			    },
				url: mapUrl,
				data: {
					subject: otherUsername
				},
				success: function(data, textStatus, xhr) {
					if(typeof onSuccess == "function")
						onSuccess(data, textStatus, xhr);
					
					model.getInfo();
				},
				error: function(xhr, textStatus, error) {
					if(typeof onError == "function")
						onError(xhr, textStatus, error);
				}
			});
		},
		
		removeMap: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;
			
			var mapUrl = appModel.get("accountsMapsUrl") + encodeURIComponent(otherUsername),
				model = this;
						
			// ajax call to remove mapping
			$.ajax({
				type: "DELETE",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.get("token")
			    },
				url: mapUrl,
				success: function(data, textStatus, xhr) {					
					if(typeof onSuccess == "function")
						onSuccess(data, textStatus, xhr);
					
					model.getInfo();
				},
				error: function(xhr, textStatus, error) {
					if(typeof onError == "function")
						onError(xhr, textStatus, error);
				}
			});
		},
		
		pluckIdentityUsernames: function(){
			var models = this.get("identities"),
				usernames = [];
			
			_.each(models, function(m){
				usernames.push(m.get("username").toLowerCase());
			});
			
			this.set("identitiesUsernames", usernames);
			this.trigger("change:identitiesUsernames");
		},
		
		reset: function(){
			this.set(_.clone(this.defaults()));
		}
	});
	
	return UserModel;
});
		