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
		
		url: "",
		
		comparator: "username",
		
		initialize: function(models, options) {
			if(typeof options !== "undefined"){
				this.groupId = options.groupId || "";
			}
			
			if(typeof models !== "undefined")
				this.add(models);
			
			this.url = appModel.get("accountsUrl") + this.groupId;
				
			return this;
		},
		
		getGroup: function(){
			if(!this.groupId)
				return;
			
			this.fetch();
			
			return this;
		},
		
		fetch: function (options) {
	        options = options || { silent: false, reset: false };
	        options.dataType = "xml";
	        return Backbone.Collection.prototype.fetch.call(this, options);
	    },
		
		parse: function(response, options){
			if(!response) return;
			
			var group = $(response).find("group subject:contains('" + this.groupId + "')").parent("group"),
				people = $(response).find("person"),
				collection = this,
				toAdd = new Array();
			
			this.name = $(group).children("groupName").text();
			
			_.each(people, function(person){
				//If this user is not listed as a member of this group, skip it
				if($(person).children("isMemberOf:contains('" + collection.groupId + "')").length < 1)
					return;
				
				//Username of this person
				var username = $(person).children("subject").text();
				
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
		
		getOwners: function(){
			var groupId = this.groupId;
			return _.filter(this.models, function(user){
				return _.contains(user.get("isOwnerOf"), groupId);
			});
		},
		
		isOwner: function(model){
			if(typeof model === "undefined") return false;
			
			return _.contains(this.getOwners(), model);
		}
		
	});
	
	return UserGroup;
	
});