/*global define */
define(['jquery', 'underscore', 'backbone', 'jws', 'models/Search', "collections/SolrResults"],
	function($, _, Backbone, JWS, SearchModel, SearchResults) {
	'use strict';

	/**
  * @class UserModel
  * @extends Backbone.Model
  * @constructor
  */
	var UserModel = Backbone.Model.extend(
    /** @lends UserModel.prototype */{
		defaults: function(){
			return{
				type: "person", //assume this is a person unless we are told otherwise - other possible type is a "group"
				checked: false, //Is set to true when we have checked the account/subject info of this user
        tokenChecked: false, //Is set to true when the uer auth token has been checked
				basicUser: false, //Set to true to only query for basic info about this user - prevents sending queries for info that will never be displayed in the UI
				lastName: null,
				firstName: null,
				fullName: null,
				email: null,
				logo: null,
				description: null,
				verified: null,
				username: null,
				usernameReadable: null,
				orcid: null,
				searchModel: null,
				searchResults: null,
				loggedIn: false,
				ldapError: false, //Was there an error logging in to LDAP
				registered: false,
				isMemberOf: [],
				isOwnerOf: [],
				identities: [],
				identitiesUsernames: [],
        allIdentitiesAndGroups: [],
				pending: [],
				token: null,
				expires: null,
				timeoutId: null,
				rawData: null,
        portalQuota: -1,
        isAuthorizedCreatePortal: null
			}
		},

		initialize: function(options){
			if(typeof options !== "undefined"){
				if(options.username) this.set("username", options.username);
				if(options.rawData)  this.set(this.parseXML(options.rawData));
			}

			this.on("change:identities", this.pluckIdentityUsernames);

			this.on("change:username change:identities change:type", this.updateSearchModel);
			this.createSearchModel();

			this.on("change:username", this.createReadableUsername());

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
			var type = $(userNode).prop("tagName");
			if(type) type = type.toLowerCase();

			if(type == "group"){
				var fullName = $(userNode).find("groupName").first().text();
			}
			else if(type){
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

				if(!fullName)
					fullName = this.getNameFromSubject(username);

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

      var allSubjects = _.pluck( this.get("isMemberOf"), "groupId" );
      allSubjects.push(this.get("username"));
      allSubjects.push(this.get("identities"));

			return {
				isMemberOf: memberOf,
				isOwnerOf: ownerOf,
				identities: identities,
        allIdentitiesAndGroups: allSubjects,
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

			//If the accounts service is not on, flag this user as checked/completed
			if(!MetacatUI.appModel.get("accountsUrl")){
				this.set("fullName", this.getNameFromSubject());
				this.set("checked", true);
				return;
			}

			//Only proceed if there is a username
			if(!this.get("username")) return;

			//Get the user info using the DataONE API
			var url = MetacatUI.appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));

			var requestSettings = {
				type: "GET",
				url: url,
				success: function(data, textStatus, xhr) {
					//Parse the XML response to get user info
					var userProperties = model.parseXML(data);
					//Filter out all the falsey values
					_.each(userProperties, function(v, k) {
				      if(!v) {
				        delete userProperties[k];
				      }
				    });
					model.set(userProperties);

					 //Trigger the change events
					model.trigger("change:isMemberOf");
					model.trigger("change:isOwnerOf");
					model.trigger("change:identities");

					model.set("checked", true);
				},
				error: function(xhr, textStatus, errorThrown){
					// Sometimes the node info has not been received before this getInfo() is called.
					// If the node info was received while this getInfo request was pending, and this user was determined
					// to be a node, then we can skip any further action here.
					if(model.get("type") == "node")
						return;

					if((xhr.status == 404) && MetacatUI.nodeModel.get("checked")){
						model.set("fullName", model.getNameFromSubject());
						model.set("checked", true);
					}
					else if((xhr.status == 404) && !MetacatUI.nodeModel.get("checked")){
						model.listenToOnce(MetacatUI.nodeModel, "change:checked", function(){
							if(!model.isNode()){
								model.set("fullName", model.getNameFromSubject());
								model.set("checked", true);
							}
						});
					}
					else{
						//As a backup, search for this user instead
						var requestSettings = {
								type: "GET",
								url: MetacatUI.appModel.get("accountsUrl") + "?query=" + encodeURIComponent(model.get("username")),
								success: function(data, textStatus, xhr) {
									//Parse the XML response to get user info
									model.set(model.parseXML(data));

									 //Trigger the change events
									model.trigger("change:isMemberOf");
									model.trigger("change:isOwnerOf");
									model.trigger("change:identities");

									model.set("checked", true);
								},
								error: function(){
									//Set some blank values and flag as checked
									//model.set("username", "");
									//model.set("fullName", "");
									model.set("notFound", true);
									model.set("checked", true);
								}
							}
						//Send the request
						$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

					}
				}
			}

			//Send the request
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		//Get the pending identity map requests, if the service is turned on
		getPendingIdentities: function(){
			if(!MetacatUI.appModel.get("pendingMapsUrl")) return false;

			var model = this;

			//Get the pending requests
			var requestSettings = {
				url: MetacatUI.appModel.get("pendingMapsUrl") + encodeURIComponent(this.get("username")),
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
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getNameFromSubject: function(username){
			var username  = username || this.get("username"),
				fullName = "";

			if(!username) return;

			if((username.indexOf("uid=") > -1) && (username.indexOf(",") > -1))
				fullName = username.substring(username.indexOf("uid=") + 4, username.indexOf(","));
			else if((username.indexOf("CN=") > -1) && (username.indexOf(",") > -1))
				fullName = username.substring(username.indexOf("CN=") + 3, username.indexOf(","));

			//Cut off the last string after the name when it contains digits - not part of this person's names
			if(fullName.lastIndexOf(" ") > fullName.indexOf(" ")){
				var lastWord = fullName.substring(fullName.lastIndexOf(" "));
				if(lastWord.search(/\d/) > -1)
					fullName = fullName.substring(0, fullName.lastIndexOf(" "));
			}

			//Default to the username
			if(!fullName) fullName = this.get("fullname") || username;

			return fullName;
		},

		isOrcid: function(orcid){
			var username = (typeof orcid === "string")? orcid : this.get("username");

			//Have we already verified this?
			if((typeof orcid == "undefined") && (username == this.get("orcid"))) return true;

			//Checks for ORCIDs using the orcid base URL as a prefix
			if(username.indexOf("orcid.org/") > -1){
				return true;
			}

			//If the ORCID base url is not present, we will check if this is a 19-digit ORCID ID
			//A simple and fast check first
			//ORCiDs are 16 digits and 3 dashes - 19 characters
			if(username.length != 19) return false;

			/* The ORCID checksum algorithm to determine is a character string is an ORCiD
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

		isNode: function(){
			var node = _.where(MetacatUI.nodeModel.get("members"), { shortIdentifier: this.get("username") });
			return (node && node.length)
		},

		// Will check if this user is a Member Node. If so, it will save the MN info to the model
		saveAsNode: function(){
			if(!this.isNode()) return;

			var node = _.where(MetacatUI.nodeModel.get("members"), { shortIdentifier: this.get("username") })[0];

			this.set({
				type: "node",
				logo: node.logo,
				description: node.description,
				node: node,
				fullName: node.name,
				usernameReadable: this.get("username")
			});
			this.updateSearchModel();
			this.set("checked", true);
		},

		loginLdap: function(formData, success, error){
			if(!formData || !appModel.get("signInUrlLdap")) return false;

			var model = this;

			var requestSettings = {
				type: "POST",
				url: MetacatUI.appModel.get("signInUrlLdap") + window.location.href,
				data: formData,
				success: function(data, textStatus, xhr){
					if(success)
						success(this);

					model.getToken();

				},
				error: function(){
					/*if(error)
						error(this);
					*/
					model.getToken();
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		logout: function(){

			//Construct the sign out url and redirect
			var signOutUrl = MetacatUI.appModel.get('signOutUrl'),
				  target = Backbone.history.location.href;

			// DO NOT include the route otherwise we have an infinite redirect
			// target  = target.split("#")[0];
			target = target.slice(0, -8);

			// make sure to include the target
			signOutUrl += "?target=" + target;

			// do it!
			window.location.replace(signOutUrl);
		},

		// call Metacat or the DataONE CN to validate the session and tell us the user's name
		checkStatus: function(onSuccess, onError) {
			var model = this;

			if (!MetacatUI.appModel.get("tokenUrl")) {
				// look up the URL
				var metacatUrl = MetacatUI.appModel.get('metacatServiceUrl');

				// ajax call to validate the session/get the user info
				var requestSettings = {
					type: "POST",
					url: metacatUrl,
					data: { action: "validatesession" },
					success: function(data, textStatus, xhr) {
						// the Metacat (XML) response should have a fullName element
						var username = $(data).find("name").text();

						// set in the model
						model.set('username', username);

						//Are we logged in?
						if(username){
							model.set("loggedIn", true);
							model.getInfo();
						}
						else{
							model.set("loggedIn", false);
							model.trigger("change:loggedIn");
							model.set("checked", true);
						}

						if(onSuccess) onSuccess(data);

					},
					error: function(data, textStatus, xhr){
						//User is not logged in
						model.reset();

						if(onError) onError();
					}
				}

				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
			} else {
				// use the token method for checking authentication
				this.getToken();
			}
		},

		getToken: function(customCallback) {
			var tokenUrl = MetacatUI.appModel.get('tokenUrl');
			var model = this;

			if(!tokenUrl) return false;

			//Set up the function that will be called when we retrieve a token
			var callback = (typeof customCallback === "function") ? customCallback : function(data, textStatus, xhr) {

				// the response should have the token
				var payload = model.parseToken(data),
					username = payload ? payload.userId : null,
					fullName = payload ? payload.fullName : model.getNameFromSubject(username) || null,
					token    = payload ? data : null,
					loggedIn = payload ? true : false;

				// set in the model
				model.set('fullName', fullName);
				model.set('username', username);
				model.set("token", token);
				model.set("loggedIn", loggedIn);
        model.set("tokenChecked", true);

				model.getTokenExpiration(payload);

				if(username)
					model.getInfo();
				else
					model.set("checked", true);
			};

			// ajax call to get token
			var requestSettings = {
				type: "GET",
				dataType: "text",
				xhrFields: {
					withCredentials: true
				},
				url: tokenUrl,
				data: {},
				success: callback,
				error: function(xhr, textStatus, errorThrown){
					model.set("checked", true);
				}
			}

			$.ajax(requestSettings);
		},

		getTokenExpiration: function(payload){
			if(!payload && this.get("token")) var payload = this.parseToken(this.get("token"));
			if(!payload) return;

			//The exp claim should be standard - it is in UTC seconds
			var expires = payload.exp? new Date(payload.exp * 1000) : null;

			//Use the issuedAt and ttl as a backup (only used in d1 2.0.0 and 2.0.1)
			if(!expires){
				var issuedAt = payload.issuedAt? new Date(payload.issuedAt) : null,
					lifeSpan = payload.ttl? payload.ttl : null;

				if(issuedAt && lifeSpan && (lifeSpan > 99999))
					issuedAt.setMilliseconds(lifeSpan);
				else if(issuedAt && lifeSpan)
					issuedAt.setSeconds(lifeSpan);

				expires = issuedAt;
			}

			this.set("expires", expires);
		},

		checkToken: function(onSuccess, onError){

			//First check if the token has expired
			if(MetacatUI.appUserModel.get("expires") > new Date()){
				if(onSuccess) onSuccess();

				return;
			}

			var model = this;

			var url = MetacatUI.appModel.get("tokenUrl");
			if(!url) return;

			var requestSettings = {
					type: "GET",
					url: url,
          headers: {
			      "Cache-Control": "no-cache"
				  },
					success: function(data, textStatus, xhr){
						if(data){
							// the response should have the token
							var payload = model.parseToken(data),
								username = payload ? payload.userId : null,
								fullName = payload ? payload.fullName : null,
								token    = payload ? data : null,
								loggedIn = payload ? true : false;

							// set in the model
							model.set('fullName', fullName);
							model.set('username', username);
							model.set("token", token);
							model.set("loggedIn", loggedIn);

							model.getTokenExpiration(payload);

							MetacatUI.appUserModel.set("checked", true);

							if(onSuccess) onSuccess(data, textStatus, xhr);
						}
						else if(onError)
							onError(data, textStatus, xhr);
					},
					error: function(data, textStatus, xhr){
						//If this token in invalid, then reset the user model/log out
						MetacatUI.appUserModel.reset();

						if(onError) onError(data, textStatus, xhr);
					}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
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

			var updateUrl = MetacatUI.appModel.get("accountsUrl") + encodeURIComponent(this.get("username"));

			// ajax call to update
			var requestSettings = {
				type: "PUT",
				cache: false,
			    contentType: false,
			    processData: false,
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
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		confirmMapRequest: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;

			var mapUrl = MetacatUI.appModel.get("pendingMapsUrl") + encodeURIComponent(otherUsername),
				model = this;

			if(!onSuccess)
				var onSuccess = function(){};
			if(!onError)
				var onError = function(){};

			// ajax call to confirm map
			var requestSettings = {
				type: "PUT",
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
			}
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		denyMapRequest: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;

			var mapUrl = MetacatUI.appModel.get("pendingMapsUrl") + encodeURIComponent(otherUsername),
				model = this;

			// ajax call to reject map
			var requestSettings = {
				type: "DELETE",
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
			}
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		addMap: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;

			var mapUrl = MetacatUI.appModel.get("pendingMapsUrl"),
				model = this;

			if(mapUrl.charAt(mapUrl.length-1) == "/"){
				mapUrl = mapUrl.substring(0, mapUrl.length-1)
			}

			// ajax call to map
			var requestSettings = {
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

					//Check if the username might have been spelled or formatted incorrectly
					//ORCIDs, in particular, have different formats that we should account for
					if(xhr.responseText.indexOf("LDAP: error code 32 - No Such Object") > -1 && model.isOrcid(otherUsername)){
						if(otherUsername.length == 19)
							model.addMap("http://orcid.org/" + otherUsername, onSuccess, onError);
						else if(otherUsername.indexOf("https://orcid.org") == 0)
							model.addMap(otherUsername.replace("https", "http"), onSuccess, onError);
						else if(otherUsername.indexOf("orcid.org") == 0)
							model.addMap("http://" + otherUsername, onSuccess, onError);
						else if(otherUsername.indexOf("www.orcid.org") == 0)
								model.addMap(otherUsername.replace("www.", "http://"), onSuccess, onError);
						else if(otherUsername.indexOf("http://www.orcid.org") == 0)
								model.addMap(otherUsername.replace("www.", ""), onSuccess, onError);
						else if(otherUsername.indexOf("https://www.orcid.org") == 0)
								model.addMap(otherUsername.replace("https://www.", "http://"), onSuccess, onError);
						else if(typeof onError == "function")
							onError(xhr, textStatus, error);
					}
					else{
						if(typeof onError == "function")
							onError(xhr, textStatus, error);
				  }
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		removeMap: function(otherUsername, onSuccess, onError){
			if(!otherUsername) return;

			var mapUrl = MetacatUI.appModel.get("accountsMapsUrl") + encodeURIComponent(otherUsername),
				model = this;

			// ajax call to remove mapping
			var requestSettings = {
				type: "DELETE",
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
			}
			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		failedLdapLogin: function(){
			this.set("loggedIn", false);
			this.set("checked", true);
			this.set("ldapError", true);
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

		createReadableUsername: function(){
			if(!this.get("username")) return;

			var username = this.get("username"),
				readableUsername = username.substring(username.indexOf("=")+1, username.indexOf(",")) || username;

			this.set("usernameReadable", readableUsername);
		},

		createAjaxSettings: function(){
			if(!this.get("token")) return {}

			return { xhrFields: {
					withCredentials: true
					},
				  headers: {
			        "Authorization": "Bearer " + this.get("token")
				  }
				}
		},

    /**
    * Checks if this user has the quota to perform the given action
    * @param {string} action - The action to be performed
    * @param {string} customerGroup - The subject or identifier of the customer/membership group
    * to use this quota against
    */
    checkQuota: function(action, customerGroup){

      //Temporarily reset the quota so a trigger event is changed when the XHR is complete
      this.set("portalQuota", -1, {silent: true});

      //Start of temporary code
      //TODO: Replace this function with real code once the quota service is working
      this.set("portalQuota", 999);
      return;
      //End of temporary code

      var model = this;

      var requestSettings = {
        url: "",
        type: "GET",
        success: function(data, textStatus, xhr) {
          model.set("portalQuota", data.remainingQuota);
        },
        error: function(xhr, textStatus, errorThrown) {
          model.set("portalQuota", 0);
        }
      }

      $.ajax(_.extend(requestSettings, this.createAjaxSettings()));

    },

    /**
    * Checks if the user has authorization to perform the given action.
    */
    isAuthorizedCreatePortal: function(){

      //Reset the isAuthorized attribute silently so a change event is always triggered
      this.set("isAuthorizedCreatePortal", null, {silent: true});

      //If the user isn't logged in, set authorization to false
      if( !this.get("loggedIn") ){
        this.set("isAuthorizedCreatePortal", false);
        return;
      }

      //If creating portals has been disabled app-wide, then set to false
      if( MetacatUI.appModel.get("enableCreatePortals") === false ){
        this.set("isAuthorizedCreatePortal", false);
        return;
      }
      //If creating portals has been limited to only certain subjects, check if this user is one of them
      else if( MetacatUI.appModel.get("limitPortalsToSubjects").length ){
        if( !this.get("allIdentitiesAndGroups").length ){
          this.on("change:allIdentitiesAndGroups", this.isAuthorizedCreatePortal);
          return;
        }

        //Find the subjects that have access to create portals. Could be specific users or groups.
        var subjectsThatHaveAccess = _.intersection(MetacatUI.appModel.get("limitPortalsToSubjects"), this.get("allIdentitiesAndGroups"));
        if( !subjectsThatHaveAccess.length ){
          //If this user is not in the whitelist, set to false
          this.set("isAuthorizedCreatePortal", false);
        }
        else{
          //If this user is in the whitelist, set to true
          this.set("isAuthorizedCreatePortal", true);
        }
        return;
      }
      //If anyone is allowed to create a portal, check if they have the quota to create a portal
      else{
        //Listen to the response from the quota check
        this.once("change:portalQuota", function(){
          //If the quota is at least 1, set to true
          if( this.get("portalQuota") > 0 ){
            this.set("isAuthorizedCreatePortal", true);
          }
          //If the quota is less than or equal to zero, set to false
          else{
            this.set("isAuthorizedCreatePortal", false);
          }
        });
        //Check the quota
        this.checkQuota("createPortal");
        return;
      }

    },

    /**
    * Given a list of user and/or group subjects, this function checks if this user
    * has an equivalent identity in that list, or is a member of a group in the list.
    * A single subject string can be passed instead of an array of subjects.
    * TODO: This needs to support nested group membership.
    * @param {string|string[]} subjects
    * @returns {boolean}
    */
    hasIdentityOverlap: function(subjects){

      try{
        //If only a single subject is given, put it in an array
        if( typeof subjects == "string" ){
          subjects = [subjects];
        }
        //If the subjects are not a string or an array, or if it's an empty array, exit this function.
        else if( !Array.isArray(subjects) || !subjects.length ){
          return false;
        }

        return _.intersection(this.get("allIdentitiesAndGroups"), subjects).length;
      }
      catch(e){
        console.error(e);
        return false;
      }

    },

		reset: function(){
			var defaults = _.omit(this.defaults(), ["searchModel", "searchResults"]);
			this.set(defaults);
		}
	});

	return UserModel;
});
