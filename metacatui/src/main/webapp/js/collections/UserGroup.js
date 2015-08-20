/*global define */
define(['jquery', 'underscore', 'backbone', 'models/UserModel'], 				
	function($, _, Backbone, UserModel) {
	'use strict';

	// UserGroup Collection
	// ------------------------
	
	// The collection of Users that represent a DataONE group
	var UserGroup = Backbone.Collection.extend({
		// Reference to this collection's model.
		model: UserModel,
		
		//Custom attributes of groups
		groupId: "",
		name: "",
		nameAvailable: null, 
		
		url: function(){
			return appModel.get("accountsUrl") + this.groupId;
		},
				
		comparator: "username",
		
		initialize: function(models, options) {
			if(typeof options !== "undefined"){
				this.groupId = options.groupId || "";
				this.name    = options.name    || "";
				this.pending = (typeof options.pending === "undefined") ? false : options.pending;
			}
			
			if(typeof models !== "undefined")
				this.add(models);
						
			return this;
		},
		
		getGroup: function(options){
			if(!this.groupId && this.name){
				this.groupId = "CN=" + this.name + ",DC=dataone,DC=org";
			}
			
			this.fetch(options);
			
			return this;
		},
		
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
			
			this.name = $(group).children("groupName").text();
			
			_.each(people, function(person){
				//If this user is not listed as a member of this group, skip it
				if($(person).children("isMemberOf:contains('" + collection.groupId + "')").length < 1)
					return;
				
				//Username of this person
				var username = $(person).children("subject").text();
				
				//If this user is already in the group, request its info and skip adding it
				if(_.contains(existing, username)) return;
				
				//User attributes
				var userAttr = new UserModel().parseXML(person);
				
				//Is this person an owner of this group?
				if(group.find("rightsHolder:contains('" + username + "')").length){
					if(!userAttr.isOwnerOf)
						userAttr.isOwnerOf = [collection.groupId];
					else if(Array.isArray(userAttr.isOwnerOf))
						userAttr.isOwnerOf.push(collection.groupId);
					else if(typeof userAttr.isOwnerOf == "string")
						userAttr.isOwnerOf = [userAttr.isOwnerOf, collection.groupId];
				}
					
				//Create User Model and add to collection
				toAdd.push(userAttr);				
			});	
			
			return toAdd;
		},
		
		/*
		 * An alternative to Backbone sync - will send a POST request to DataONE CNIdentity.createGroup()
		 * to create this collection as a new DataONE group 
		 */
		save: function(onSuccess, onError){
			if(this.pending && !this.nameAvailable) return false;
			
			var memberXML = "",
				collection = this;
			
			//Create the member and owner XML
			this.forEach(function(member){
				memberXML += "<hasMember>" + member.get("username") + "</hasMember>";
				if(collection.isOwner(member) || (appUserModel == member))
					memberXML += "<rightsHolder>" + member.get("username") + "</rightsHolder>";
			});
			
			//Create the group XML
			var groupXML = 
				'<?xml version="1.0" encoding="UTF-8"?>'
				+ '<d1:group xmlns:d1="http://ns.dataone.org/service/types/v1">'
					+ '<subject>' + this.groupId + '</subject>'
					+ '<groupName>' + this.name + '</groupName>'
					+ memberXML
				+ '</d1:group>';
			
			var xmlBlob = new Blob([groupXML], {type : 'application/xml'});
			var formData = new FormData();
			formData.append("group", xmlBlob, "group");
						
			// ajax call to update
			$.ajax({
				type: "POST",
				cache: false,
			    contentType: false,
			    processData: false,
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + appUserModel.get("token")
			    },
				url: appModel.get("groupsUrl"),
				data: formData,
				success: function(data, textStatus, xhr) {
					if(typeof onSuccess != "undefined") 
						onSuccess(data);
					
					collection.pending = false;
					collection.nameAvailable = null;
					collection.getGroup();
				},
				error: function(data, textStatus, xhr) {
					if(typeof onError != "undefined") 
						onError(data);					
				}
			});
			
			return true;
		},
		
		getOwners: function(){
			var groupId = this.groupId;
			return _.filter(this.models, function(user){
				return _.contains(user.get("isOwnerOf"), groupId);
			});
		},
		
		isOwner: function(model){
			if(typeof model === "undefined") return false;
			
			if(this.pending && (model == appUserModel)) return true; 
			
			return _.contains(this.getOwners(), model);
		}
		
	});
	
	return UserGroup;
	
});