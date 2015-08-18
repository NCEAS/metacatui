/*global define */
define(['jquery', 'underscore', 'backbone', 'collections/UserGroup', 'models/UserModel'], 				
	function($, _, Backbone, UserGroup, UserModel) {
	'use strict';
			
	var GroupListView = Backbone.View.extend({

		type: "GroupListView",
		
		tagName: "ul",
		
		className: "list-group collapsed",
				
		initialize: function(options){
			if(typeof options == "undefined"){
				this.collection = new UserGroup();
				return;
			}
			
			this.collection = options.collection || new UserGroup();
			this.groupId    = this.collection.groupId || null;
		},
		
		events: {
			"click .toggle" : "toggleMemberList"
		},
		
		render: function(){
			
			var group = this.collection,
				view  = this;
			
			//Create the header/first-level of the list
			var listItem = $(document.createElement("li")).addClass("list-group-header list-group-item group toggle"),
				link     = $(document.createElement("a")).attr("href", "#profile/" + group.groupId)
							.attr("data-subject", group.groupId),
				groupName = $(document.createElement("span")).text(group.name),
				icon      = $(document.createElement("i"))
							.addClass("icon icon-caret-right tooltip-this group")
							.attr("data-title", "Expand")
							.attr("data-placement", "top")
							.attr("data-trigger", "hover"),
				numMembers = $(document.createElement("span")).addClass("num-members").text(group.length);
			
			this.$numMembers = $(numMembers);
			this.$groupName  = $(groupName);
			this.$header     = $(listItem);
			
			//Put it all together
			$(listItem).append($(link).prepend(icon, groupName))
					   .append(" (", numMembers, " members)");
			this.$el.append(listItem);
			
			//Create a list of member names
			var view = this;
			group.forEach(function(member){
				view.addMember(member);
			});
			this.listenTo(group, "add", this.addMember);
			this.listenTo(group, "change:isOwnerOf", this.addOwner);
			
			return this;
		},
		
		addMember: function(member){
			var username = member.get("username"),
				name     = member.get("fullName");
			
			//If this is the currently-logged-in user, display "Me"
			if(username == appUserModel.get("username"))
				name = "Me";
			
			//Create a list item for this member
			var memberListItem = $(document.createElement("li")).addClass("list-group-item member").attr("data-username", username),
				memberIcon     = $(document.createElement("i")).addClass("icon icon-user"),	
				memberLink     = $(document.createElement("a")).attr("href", "#profile/" + username).attr("data-username", username)
								.prepend(memberIcon, name),
				memberName     = $(document.createElement("span")).addClass("details").attr("data-username", username).text(username);
						
			memberIcon.tooltip({
				placement: "top",
				trigger: "hover",
				title: "Group member"
			});
			
			//Indicate if this member is an owner of the group
			if(this.collection.isOwner(member)){
				var ownerIcon = this.getOwnerEl();
				memberIcon.after(ownerIcon);
			}
			
			//Put all the elements together
			var memberEl = $(memberListItem).append(memberLink, memberName);
			
			//If this is Me, list Me first
			if(username == appUserModel.get("username"))
				this.$header.after(memberEl)
			else
				this.$el.append(memberEl);
			
			//Update the header
			this.$numMembers.text(this.collection.length);
			this.$groupName.text(this.collection.name);
		},
		
		removeMember: function(member){
			this.$("li[data-username='" + member.get("username") + "']").detach();
			
			//Update the header
			this.$numMembers.text(this.collection.length);
			this.$groupName.text(this.collection.name);
		},
		
		addOwner: function(user){
			var memberEl = this.$(".member[data-username='" + user.get("username") + "'");
			if(!memberEl.length) return;
			
			memberEl.find(".icon-user").after(this.getOwnerEl());
		},
		
		getOwnerEl: function(){
			var ownerIcon = $(document.createElement("i")).addClass("icon icon-star owner");
			ownerIcon.tooltip({
				placement: "top",
				trigger: "hover",
				title: "Group owner"
			});
			return ownerIcon;
		},
		
		toggleMemberList: function(e){
			e.preventDefault();
			
			this.$el.toggleClass("collapsed");
			this.$(".member").slideToggle();
			this.$(".icon.group").toggleClass("icon-caret-right").toggleClass("icon-caret-down");
		},
		
		onClose: function(){
			this.remove();
		}
		
	});
	
	return GroupListView;
});