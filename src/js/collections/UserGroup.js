/*global define */
define(['jquery', 'underscore', 'backbone', 'models/UserModel'],
	function($, _, Backbone, UserModel) {
	'use strict';

	/**
	 * @class UserGroup
	 * @classdesc The collection of Users that represent a DataONE group
   * @classcategory Collections
	 */
	var UserGroup = Backbone.Collection.extend(
    /** @lends UserGroup.prototype */{
		// Reference to this collection's model.
		model: UserModel,

		//Custom attributes of groups
		groupId: "",
		name: "",
		nameAvailable: null,

		url: function(){
			return MetacatUI.appModel.get("accountsUrl") + encodeURIComponent(this.groupId);
		},

		comparator: "lastName", //Sort by last name

		initialize: function(models, options) {
			if((typeof models == "undefined") || !models)
				var models = [];

			if(typeof options !== "undefined"){
				//Save our options
				$.extend(this, options);
				this.groupId = options.groupId || "";
				this.name    = options.name    || "";
				this.pending = (typeof options.pending === "undefined") ? false : options.pending;

				//If raw data is passed, parse it to get a list of users to be added to this group
				if(options.rawData){

					//Get a list of UserModel attributes to add to this collection
					var toAdd = this.parse(options.rawData);

					//Create a UserModel for each user
					_.each(toAdd, function(modelAttributes){
						//Don't pass the raw data to the UserModel creation because it is redundant-
						//We already parsed the raw data when we called add() above
						var rawDataSave = modelAttributes.rawData;
						modelAttributes.rawData = null;

						//Create the model then add the raw data back
						var member = new UserModel(modelAttributes);
						member.set("rawData", rawDataSave);

						models.push(member);
					});
				}
			}

			//Add all our models to this collection
			this.add(models);
		},

		/*
		 * Gets the group from the server. Options object uses the BackboneJS options API
		 */
		getGroup: function(options){
			if(!this.groupId && this.name){
				this.groupId = "CN=" + this.name + ",DC=dataone,DC=org";
			}

			this.fetch(options);

			return this;
		},

		/*
		 * Fetches the group info from the server. Should not be called directly - use getGroup() instead
		 */
		fetch: function (options) {
	        options = options || { silent: false, reset: false, remove: false };
	        options.dataType = "xml";
	        options.error = function(collection, response, options){
	        	//If this group is not found, then the name is available
	        	if((response.status == 404) && (response.responseText.indexOf("No Such Object") > -1)){
	        		collection.nameAvailable = true;
	        		collection.trigger("nameChecked", collection);
	        	}
	        }
	        return Backbone.Collection.prototype.fetch.call(this, options);
	    },

	    /*
	     * Backbone.js override - parses the XML reponse from DataONE and creates a JSON representation that will
	     * be used to create UserModels
	     */
		parse: function(response, options){
			if(!response) return;

			//This group name is not available/already taken
			this.nameAvailable = false;
			this.trigger("nameChecked", this);

			var group = $(response).find("group subject:contains('" + this.groupId + "')").parent("group"),
				people = $(response).find("person"),
				collection = this,
				toAdd = new Array(),
				existing = this.pluck("username");

			if(!people.length)
				people = $(group).find("hasMember");

			//Make all existing usernames lowercase for string matching
			if(existing.length) existing = _.invoke(existing, "toLowerCase");

			this.name = $(group).children("groupName").text();

			_.each(people, function(person){

				//The tag name is "hasMember" if we retrieved info about this group from the group nodes only
				if(person.tagName == "hasMember"){
					var username = $(person).text();

					//If this user is already in the group, skip adding it
					if(_.contains(existing, username.toLowerCase())) return;

					var user = new UserModel({ username: username }),
						userAttr = user.toJSON();

					toAdd.push(userAttr);
				}
				//The tag name is "person" if we retrieved info about this group through the /accounts service, which includes all nodes about all members
				else{
					//If this user is not listed as a member of this group, skip it
					if($(person).children("isMemberOf:contains('" + collection.groupId + "')").length < 1)
						return;

					//Username of this person
					var username = $(person).children("subject").text();

					//If this user is already in the group, skip adding it
					if(_.contains(existing, username.toLowerCase())) return;

					//User attributes - pass the full response for the UserModel to parse
					var userAttr = new UserModel({username: username}).parseXML(response);

					//Add to collection
					toAdd.push(userAttr);
				}
			});

			return toAdd;
		},

		/*
		 * An alternative to Backbone sync
		 * - will send a POST request to DataONE CNIdentity.createGroup() to create this collection as a new DataONE group
		 * or
		 * - will send a PUT request to DataONE CNIdentity.updateGroup() to update this existing DataONE group
		 *
		 *  If this group is marked as pending, then the group is created, otherwise it's updated
		 */
		save: function(onSuccess, onError){
			if(this.pending && (this.nameAvailable == false)) return false;

			var memberXML = "",
				ownerXML = "",
				collection = this;

			//Create the member and owner XML
			this.forEach(function(member){
				//Don't list yourself as an owner or member (implied)
				if(MetacatUI.appUserModel == member) return;

				var username = member.get("username") ? member.get("username").trim() : null;
				if(!username) return;

				memberXML += "<hasMember>" + username + "</hasMember>";

				if(collection.isOwner(member))
					ownerXML += "<rightsHolder>" + username + "</rightsHolder>";
			});

			//Create the group XML
			var groupXML =
				'<?xml version="1.0" encoding="UTF-8"?>'
				+ '<d1:group xmlns:d1="http://ns.dataone.org/service/types/v1">'
					+ '<subject>'   + this.groupId + '</subject>'
					+ '<groupName>' + this.name    + '</groupName>'
					+ memberXML
					+ ownerXML
				+ '</d1:group>';

			var xmlBlob = new Blob([groupXML], {type : 'application/xml'});
			var formData = new FormData();
			formData.append("group", xmlBlob, "group");

			// AJAX call to update
			$.ajax({
				type: this.pending? "POST" : "PUT",
				cache: false,
			    contentType: false,
			    processData: false,
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + MetacatUI.appUserModel.get("token")
			    },
				url: MetacatUI.appModel.get("groupsUrl"),
				data: formData,
				success: function(data, textStatus, xhr) {
					if(typeof onSuccess != "undefined")
						onSuccess(data);

					collection.pending = false;
					collection.nameAvailable = null;
					collection.getGroup();
				},
				error: function(xhr, textStatus, error) {
					if(typeof onError != "undefined")
						onError(xhr);
				}
			});

			return true;
		},

		/*
		 * For pending groups only (those in the creation stage)
		 * Will check if the given name/id is available
		 */
		checkName: function(name){
			//Only check the name for pending groups
			if(!this.pending) return;

			//Reset the name and ID
			this.name = name || this.name;
			this.groupId = null;
			this.nameAvailable = null;

			//Get group info/check name availablity
			this.getGroup({ add: false });
		},

		/*
		 * Retrieves the UserModels that are rightsHolders of this group
		 */
		getOwners: function(){
			var groupId = this.groupId;
			return _.filter(this.models, function(user){
				return _.contains(user.get("isOwnerOf"), groupId);
			});
		},

		/*
		 * Shortcut function - will check if a specified User is an owner of this group
		 */
		isOwner: function(model){
			if(typeof model === "undefined") return false;

			if(this.pending && (model == MetacatUI.appUserModel)) return true;

			var usernames = [];
			_.each(this.getOwners(), function(user){ usernames.push(user.get("username")); });

			return _.contains(usernames, model.get("username"));
		}

	});

	return UserGroup;

});
