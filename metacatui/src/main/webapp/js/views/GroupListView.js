/*global define */
define(['jquery', 'underscore', 'backbone', 'collections/UserGroup', 'models/UserModel'], 				
	function($, _, Backbone, UserGroup, UserModel) {
	'use strict';
			
	var GroupListView = Backbone.View.extend({

		type: "GroupListView",
		
		tagName: "ul",
		
		className: "list-group member-list",
				
		initialize: function(options){
			if(typeof options == "undefined"){
				this.collection = new UserGroup();
				return;
			}
			
			this.collection = options.collection || new UserGroup();
			this.groupId    = this.collection.groupId || null;
		},
		
		events: {
			"click .toggle"               : "toggleMemberList",
			"click .add-member .submit"   : "addToCollection",
			"keypress input"              : "checkForReturn"
		},
		
		render: function(){
			
			var group = this.collection,
				view  = this;
			
			//Empty first
			this.$el.empty();
						
			//Create the header/first-level of the list			
			var listItem   = $(document.createElement("li")).addClass("list-group-header list-group-item group toggle"),
				icon       = $(document.createElement("i")).addClass("icon icon-caret-down tooltip-this group");
			
			if(!this.collection.pending){
				var link       = $(document.createElement("a")).attr("href", "#profile/" + group.groupId).attr("data-subject", group.groupId),
					groupName  = $(document.createElement("span")).text(group.name),
					numMembers = $(document.createElement("span")).addClass("num-members").text(group.length);

				//Save some elements for later use
				this.$numMembers = $(numMembers);
				this.$groupName  = $(groupName);
			}
			else{
				var link       = $(document.createElement("a")).attr("href", "#"),
					groupName  = $(document.createElement("span")).text("Members");
			}

			//Save some elements for later use
			this.$header     = $(listItem);
			
			//Put it all together
			$(listItem).append($(link).prepend(icon, groupName));			
			if(this.numMembers) $(listItem).append(" (", numMembers, " members)");			
			this.$el.append(listItem);
			
			//Create a list of member names
			var view = this;
			group.forEach(function(member){
				view.addMember(member);
			});
			
			if(this.collection.isOwner(appUserModel)){
				this.addControls();
			}
			
			this.listenTo(group, "add", this.addMember);
			this.listenTo(group, "change:isOwnerOf", this.addOwner);
			this.listenTo(group, "change:isOwnerOf", this.addControls);
			
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
				memberLink     = $(document.createElement("a")).attr("href", "#profile/" + username).attr("data-username", username).prepend(memberIcon, name),
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
			//Append after the last member listed
			else if(this.$(".member").length)
				this.$(".member").last().after(memberEl);
			//If no members are listed yet, append to the main el
			else
				this.$el.append(memberEl);
			
			//Update the header
			if(this.$numMembers)
				this.$numMembers.text(this.collection.length);
			if(this.$groupName)
				this.$groupName.text(this.collection.name);
		},
		
		removeMember: function(member){
			this.$("li[data-username='" + member.get("username") + "']").detach();
			
			//Update the header
			if(this.$numMembers)
				this.$numMembers.text(this.collection.length);
			if(this.$groupName)
				this.$groupName.text(this.collection.name);
		},
		
		addOwner: function(user){
			//Make sure this user is an owner of this group 
			//(may have been sent here by a trigger that this user's ownership has changed in general, not specifically for this group
			if(!this.collection.isOwner(user)) return;
			
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
		
		addControls: function(){
			if(!appUserModel.get("loggedIn") || (!this.collection.isOwner(appUserModel)) || this.$addMember) return;
			
			//Add a form for adding a new member
			var addMemberInput    = $(document.createElement("input"))
									.attr("type", "text")
									.attr("name", "username")
	   							    .attr("placeholder", "Username or Name (cn=me, o=my org...)")
	   							    .attr("data-submit-callback", "addToCollection")
									.addClass("input-xlarge account-autocomplete submit-enter"),
				addMemberName     = $(document.createElement("input"))
									.attr("type", "hidden")
									.attr("name", "fullName")
									.attr("disabled", "disabled"),
				addMemberIcon     = $(document.createElement("i")).addClass("icon icon-plus"),
				addMemberSubmit   = $(document.createElement("button")).addClass("btn submit").append(addMemberIcon),
				addMemberLabel    = $(document.createElement("label")).text("Add Member"),
				addMemberForm     = $(document.createElement("form")).append(addMemberLabel, addMemberInput, addMemberName, addMemberSubmit),
				addMemberListItem = $(document.createElement("li")).addClass("list-group-item add-member input-append").append(addMemberForm);
			
			this.$addMember = $(addMemberForm);
									
			this.$el.append(addMemberListItem);
			
			this.setUpAutocomplete();
		},
		
		addToCollection: function(e){
			if(e) e.preventDefault();
			
			//Get form values
			var username = this.$addMember.find("input[name='username']").val();
			var fullName = this.$addMember.find("input[name='fullName']").val();
			
			//Reset the form
			this.$addMember.find("input[name='username']").val("");
			this.$addMember.find("input[name='fullName']").val("");
			
			//Create User Model
			var user = new UserModel({
				username: username,
				fullName: fullName
			});
			
			//Add this user
			this.collection.add(user);
		},
		
		checkForReturn: function(e){
			if(e.keyCode != 13) return;
		
			if($.contains(e.target, this.$addMember.find("input[name='fullName']"))){
				e.preventDefault();
				return;
			}
			else if($(e.target).is(".submit-enter")){
				e.preventDefault();
				var callback = $(e.target).attr("data-submit-callback");
				this[callback]();
				return;
			}
		},
		
		toggleMemberList: function(e){
			e.preventDefault();
			
			this.$el.toggleClass("collapsed");
			this.$(".member").slideToggle();
			this.$(".icon.group").toggleClass("icon-caret-right").toggleClass("icon-caret-down");
		},
		
		setUpAutocomplete: function() {
			var input = this.$(".account-autocomplete");
			if(!input || !input.length) return;
			
			// look up registered identities 
			$(input).hoverAutocomplete({
				source: function (request, response) {
		            var term = $.ui.autocomplete.escapeRegex(request.term);
		            
		            var list = [];

		            var url = appModel.get("accountsUrl") + "?query=" + encodeURIComponent(term);					
					$.get(url, function(data, textStatus, xhr) {
						_.each($(data).find("person"), function(person, i){
							var item = {};
							item.value = $(person).find("subject").text();
							item.label = $(person).find("fullName").text() || ($(person).find("givenName").text() + " " + $(person).find("familyName").text());
							list.push(item);
						});
						
			            response(list);

					});
		            
		        },
				select: function(e, ui) {
					e.preventDefault();
					
					// set the text field
					$(e.target).val(ui.item.value);
					$(e.target).parents("form").find("input[name='fullName']").val(ui.item.label);
				},
				position: {
					my: "left top",
					at: "left bottom",
					collision: "none"
				}
			});
			
		},
		
		onClose: function(){
			this.remove();
		}
		
	});
	
	return GroupListView;
});