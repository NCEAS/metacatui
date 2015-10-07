/*global define */
define(['jquery', 'underscore', 'backbone', 'collections/UserGroup', 'models/UserModel'], 				
	function($, _, Backbone, UserGroup, UserModel) {
	'use strict';
		
	/*
	 * GroupListView
	 * Displays a list of UserModels of a UserGroup collection and allows owners to add/remove members from the group 
	 */
	var GroupListView = Backbone.View.extend({

		type: "GroupListView",
		
		tagName: "ul",
		
		className: "list-group member-list",
		
		memberEls: [],
		
		/*
		 * New instances of this view should pass a UserGroup collection in the options object
		 */
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
			"click .remove-member"		  : "removeFromCollection",
			"click .add-owner"            : "addOwnerToCollection",
			"click .remove-owner"         : "removeOwnerFromCollection",
			"keypress input"              : "checkForReturn"
		},
		
		/*
		 * The overall list layout is created, with a header and list of members.
		 * This view listens to the UserGroup collection and updates the member list as
		 * members are added and removed. 
		 */
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
			this.$header = $(listItem);
			
			//Put it all together
			$(listItem).append($(link).prepend(icon, groupName));			
			if(numMembers) $(listItem).append(" (", numMembers, " members)");			
			this.$el.append(listItem);
			
			//Create a list of member names
			var view = this;
			group.forEach(function(member){
				view.addMember(member);
			});
			
			//Collapse the list - $el must already be inserted in DOM for collapse to work
			if(group.length > 3)
				this.collapseMemberList();
			
			//Add some group controls for the owners
			if(group.isOwner(appUserModel))
				this.addControls();
			
			this.listenTo(group, "add", this.addMember);
			this.listenTo(group, "remove", this.removeMember);
			this.listenTo(group, "change:isOwnerOf", this.addControls);
			
			return this;
		},
		
		//-------- Adding members to the group --------//
		/*
		 * The specified UserModel is added to the UI, and if the current user is an owner of the group, 
		 * the owner controls are displayed
		 */
		addMember: function(member){
			var username = member.get("username"),
				name     = member.get("fullName");
			
			//If this is the currently-logged-in user, display "Me"
			if(username == appUserModel.get("username"))
				name = name + " (Me)";
			
			//Create a list item for this member
			var memberListItem = $(document.createElement("li")).addClass("list-group-item member").attr("data-username", username),
				memberNameContainer = $(document.createElement("div")).addClass("name-container"),
				memberIcon     = $(document.createElement("i")).addClass("icon icon-user"),	
				memberLink     = $(document.createElement("a")).attr("href", "#profile/" + username).attr("data-username", username).prepend(memberIcon, name),
				memberName     = $(document.createElement("span")).addClass("details").attr("data-username", username).text(username);
						
			memberIcon.tooltip({
				placement: "top",
				trigger: "hover",
				title: "Group member"
			});
		
			//Put all the elements together
			var memberEl = $(memberListItem).append($(memberNameContainer).append(memberLink, memberName));
			
			//Store this element in the view
			this.memberEls[member.cid] = memberEl;
			
			//Append after the last member listed
			if(this.$(".member").length)
				this.$(".member").last().after(memberEl);
			//If no members are listed yet, append to the main el
			else
				this.$el.append(memberEl);
			
			//Add an owner icon for owners of the group or to assign owners to the group
			if(this.collection.isOwner(member) || this.collection.isOwner(appUserModel)){
				var ownerIcon = this.getOwnerEl(member);
				memberIcon.after(ownerIcon);
			}
			
			//If the current user is an owner of this group, then display a 'remove member' button - but not for themselves
			if(this.collection.isOwner(appUserModel) && (username.toLowerCase() != appUserModel.get("username").toLowerCase())){
				//Add a remove icon for each member
				var removeIcon = $(document.createElement("i")).addClass("icon icon-remove icon-negative remove-member"),
					clearfix   = $(document.createElement("div")).addClass('clear'),
				    memberControls = $(document.createElement("div")).addClass("member-controls").append(removeIcon);
				removeIcon.tooltip({
					trigger   : "hover",
					placement : "top",
					title     : "Remove this person from the group"
				});
				memberNameContainer.addClass("has-member-controls").after(memberControls, clearfix);
			}
			
			//Update the header
			if(this.$numMembers)
				this.$numMembers.text(this.collection.length);
			if(this.$groupName)
				this.$groupName.text(this.collection.name);
			
			//Collapse members of this group is necessary
			if(this.$el.is(".collapsed"))
				this.collapseMember(memberEl);
		},
		
		/*
		 * When the user inputs a username, a UserModel is created and added to the collection.
		 * The collection is saved to the server. Failed and successful member additions are 
		 * handled and displayed to the user 
		 */
		addToCollection: function(e){
			if(e) e.preventDefault();
			
			//Get form values
			var username = this.$addMember.find("input[name='username']").val();
			var fullName = this.$addMember.find("input[name='fullName']").val();
			
			//Reset the form
			this.$addMember.find("input[name='username']").val("");
			this.$addMember.find("input[name='fullName']").val("");
			
			//Is this user already in the collection?
			if(this.collection.findWhere({username: username})){
				this.addMemberNotification({
					msg: fullName + " is already in this group",
					status: "error"
				});
				return;
			}
			
			//Don't auto-collapse the list since the user is interacting with the controls right now
			this.preventToggle = true;
			
			//Create User Model
			var user = new UserModel({
				username: username,
				fullName: fullName
			});
			
			var view = this;
			var success = function(response){
				view.addMemberNotification({
					msg: fullName + " added",
					status: "success"
				});
			}
			var error = function(response){
				if(!fullName) fullName = "that person";
				view.addMemberNotification({
					msg: "Something went wrong and " + fullName + " could not be added. " +
							"Hint: That user may not exist.",
					status: "error"
				});
				
				//Remove this user from the collection and other storage
				view.memberEls[user.cid] = null;
				view.collection.remove(user);
			}
			
			//Add this user
			this.collection.add(user);
			this.collection.save(success, error);
		},
		
		//-------- Removing members from the group ------//
		/*
		 * When the user clicks on the remove icon, the member is removed from the collection
		 * and the updated collection is saved to the server
		 */
		removeFromCollection: function(e){
			e.preventDefault();
				
			var username = $(e.target).parents(".member").attr("data-username");
			if(!username) return;
			
			if(username.toLowerCase() == appUserModel.get("username").toLowerCase()){
				this.addMemberNotification({
					status: "error",
					msg: "You can't remove yourself from a group."
				});
				return;
			}
			else if(this.collection.length == 1){
				this.addMemberNotification({
					status: "error",
					msg: "You must have at least one member in a group."
				});
				return;
			}
			
			var member = this.collection.findWhere({username: username});
			this.collection.remove(member);
			this.collection.save();
		},
		
		/*
		 * Removes the specified member from the UI
		 */
		removeMember: function(member){
			//Get DOM element for this user
			var memberEl = this.memberEls[member.cid];
			if((typeof memberEl === "undefined") || !memberEl)
				memberEl = this.$("li[data-username='" + member.get("username") + "']");
			
			//Remove from page
			memberEl.remove();
			
			//Update the header
			if(this.$numMembers)
				this.$numMembers.text(this.collection.length);
			if(this.$groupName)
				this.$groupName.text(this.collection.name);

			//Remove this member el from the view storage
			this.memberEls[member.cid] = null;
		},
		
		
		//-------------- Displaying UI elements for owners --------------//
		/*
		 * When a user clicks on the add-owner element, this view will add the user as an owner of the
		 * group and will update the collection. The collection is saved to the server.
		 */
		addOwnerToCollection: function(e){
			if(!e) return;
			e.preventDefault();
			
			var view = this;
			
			//Get this member
			var username = $(e.target).parents(".member").attr("data-username");
			if(!username) return;			
			var member = this.collection.findWhere({username: username});
			
			//Update ownership
			member.get("isOwnerOf").push(this.collection.groupId);
			member.trigger("change:isOwnerOf");
			
			//Save
			var success = function(){ view.refreshOwner(member); }			
			this.collection.save(success);
		},
		
		/*
		 * When the user clicks on the remove ownership icon for an owner, the rightsHolder is removed
		 * from the group and the updated group is saved to the server.
		 */
		removeOwnerFromCollection: function(e){
			if(!e) return;
			e.preventDefault();
			
			var view = this;
			
			//Get this member
			var username = $(e.target).parents(".member").attr("data-username");
			if(!username) return;
			var member = this.collection.findWhere({username: username});
			
			//Update ownership
			var newOwners = _.without(member.get("isOwnerOf"), this.collection.groupId);
			member.set("isOwnerOf", newOwners);
			member.trigger("change:isOwnerOf");
			
			//Save
			var success = function(){ view.refreshOwner(member); }			
			this.collection.save(success);
		},
		
		refreshOwner: function(user){
			//Get the member element on the page
			var memberEl = this.memberEls[user.cid];
			if((typeof memberEl === "undefined") || !memberEl)
				memberEl = this.$(".member[data-username='" + user.get("username") + "'");
						
			//Replace the owner element with the new one
			$(memberEl).find(".owner").tooltip("destroy").replaceWith(this.getOwnerEl(user));
		},
		
		getOwnerEl: function(member){
			var ownerIcon = $(document.createElement("i")).addClass("icon owner");
			
			if(this.collection.isOwner(member)){
				ownerIcon.addClass("icon-star is-owner remove-owner").tooltip({
					placement: "top",
					trigger: "hover",
					title: "Group owner"
				});
			}
			else{
				ownerIcon.addClass("icon-star-empty add-owner").tooltip({
					placement: "top",
					trigger: "hover",
					title: "Add this person as a co-owner of the group"
				});
			}
				
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
				addMemberMsg      = $(document.createElement("div")).addClass("notification")
									.append($(document.createElement("i")).addClass("icon"),
											$(document.createElement("span")).addClass("msg")),
				addMemberForm     = $(document.createElement("form")).append(addMemberLabel, addMemberInput, addMemberName, addMemberSubmit, addMemberMsg),
				addMemberListItem = $(document.createElement("li")).addClass("list-group-item add-member input-append").append(addMemberForm);
			
			this.$addMember = $(addMemberForm);
			this.$addMemberMsg = $(addMemberMsg);
									
			this.$el.append(addMemberListItem);
			
			this.setUpAutocomplete();
						
		},
		
		/*
		 * Display a notification in the "add member" form space
		 * Pass an options object with a msg (message string) and status ('success' or 'error')
		 */
		addMemberNotification: function(options){
			if(!options.status) options.status = "success";
			if(!options.msg) return;
			
			if(options.status == "success"){
				this.$addMemberMsg.addClass("success").removeClass("error")
								  .children(".icon").addClass("icon-ok").removeClass("icon-remove");
				this.$addMemberMsg.children(".msg").text(options.msg);
			}
			else{
				this.$addMemberMsg.removeClass("success").addClass("error")
				  .children(".icon").removeClass("icon-ok").addClass("icon-remove");
				this.$addMemberMsg.children(".msg").text(options.msg);
			}
			
			this.$addMemberMsg.show().delay(3000).fadeOut();
		},
		
		//----------- Form utilities -------------//
		setUpAutocomplete: function() {
			var input = this.$(".account-autocomplete");
			if(!input || !input.length) return;
			
			var view = this;
			
			// look up registered identities 
			$(input).hoverAutocomplete({
				source: function (request, response) {
		            var term = $.ui.autocomplete.escapeRegex(request.term);
		            
		            var list = [];
		            
		            //Ids/Usernames that we want to ignore in the autocompelte
		            var ignoreIds = view.collection.pluck("username");
		            _.each(ignoreIds, function(id){
		            	ignoreIds.push(id.toLowerCase());
		            });		            
		            ignoreIds.push(appUserModel.get("username").toLowerCase());

		            var url = appModel.get("accountsUrl") + "?query=" + encodeURIComponent(term);					
					$.get(url, function(data, textStatus, xhr) {
						_.each($(data).find("person"), function(person, i){
							var item = {};
							item.value = $(person).find("subject").text();
							
							//Ignore certain values
							if(_.contains(ignoreIds, item.value.toLowerCase())) return;
							
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
		
		//---------- Collapsing/Expanding the member list --------//
		collapseMember: function(memberEl){
			if(this.preventToggle) return;
			
			$(memberEl).slideUp();				
		},
		
		collapseMemberList: function(e){
			if(this.preventToggle && !e) return;
			
			this.$(".member, .add-member").slideUp().addClass("collapsed");
			this.$(".icon.group").addClass("icon-caret-right").removeClass("icon-caret-down");
		},
		
		toggleMemberList: function(e){
			if(e) e.preventDefault();			
			else if(this.preventToggle ) return;
			
			this.$(".member, .add-member").slideToggle().toggleClass("collapsed");
			this.$(".icon.group").toggleClass("icon-caret-right icon-caret-down");
		},
		
		// ------- When this view is closed --------//
		onClose: function(){
			this.remove();
		}
		
	});
	
	return GroupListView;
});