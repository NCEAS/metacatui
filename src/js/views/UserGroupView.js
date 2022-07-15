/*global define */
define(['jquery', 'underscore', 'backbone', 'collections/UserGroup', 'views/GroupListView', 'text!templates/userGroup.html'],
	function($, _, Backbone, UserGroup, GroupListView, Template) {
		'use strict';

		/**
		 * @class UserGroupView
		 * @classdesc A subview that displays group management. View controls creation of groups and addition
		 * of members to groups
		 * @classcategory Views
		 * @screenshot views/UserGroupView.png
		 */
		var UserGroupView = Backbone.View.extend(
			/** @lends UserGroupView.prototype */ {

			tagName: "div",
			className: "span8 subsection",
			attributes: {'data-section': 'groups'},
			type: "UserGroupView",
			events: {
				"blur #add-group-name"    : "checkGroupName",
				"click #add-group-submit" : "createGroup"
			},

			template: _.template(Template),

			initialize: function(options){
				if((typeof options == "undefined"))
					var options = {};
				this.model = options.model;
				this.subviews = new Array();
			},

			render: function(){
				this.$el.html(this.template());
				this.insertCreateGroupForm();
				this.listenTo(this.model, "change:isMemberOf", this.getGroups);
				this.getGroups();
				this.delegateEvents();
				return this;
			},

				/**
				 * Creates a view of a list of groups that the User is a member of
				 *
				 * @param {UserGroup} userGroup A user group model
				 * @param {Object} viewOptions an object of options for the view
				 */
				createGroupList: function(userGroup, viewOptions) {
				//Only create a list for new groups that aren't yet on the page
				var existingGroupLists = _.where(this.subviews, {type: "GroupListView"});
				if(existingGroupLists)
					var groupIds = _.pluck(existingGroupLists, "groupId");
				if(groupIds && (_.contains(groupIds, userGroup.groupId)))
					return;

				//Create a list of the view options
				if(typeof viewOptions == "object")
					viewOptions.collection = userGroup;
				else
					viewOptions = { collection: userGroup };

				//Create the view and save it as a subview
				var groupView = new GroupListView(viewOptions);
				this.subviews.push(groupView);

				//Collapse the views if need be
				if((userGroup.get("isMemberOf") && (userGroup.get("isMemberOf").length > 3)) || (userGroup.length > 3))
					groupView.collapseMemberList();

				//Finally, render it and return
				return groupView.render().el;
			},

				/**
				 * Gets the groups the this user is a part of and creates a UserGroup collection for each
				 */
				getGroups: function(){
				var view = this,
					groups = [],
					model = this.model;
				//Create a group Collection for each group this user is a member of
				_.each(_.sortBy(model.get("isMemberOf"), "name"), function(group){
					var userGroup = new UserGroup([model], group);
					groups.push(userGroup);

					view.listenTo(userGroup, "sync", function(){
						var list = this.createGroupList(userGroup);
						this.$("#group-list-container").append(list);
					});
					userGroup.getGroup();
				});
			},

				/**
				 * Inserts a new form for this user to create a new group.
				 * The form container is grabbed from the template
				 */
				insertCreateGroupForm: function(){
				//Reset the form
				$("#add-group-form-container").find("input[type='text']").val("").removeClass("has-error");
				$("#group-name-notification-container").empty().removeClass("notification success error");

				//Create a pending group that is stored locally until the user submits it
				this.pendingGroup = new UserGroup([this.model], { pending: true });
				var groupView = new GroupListView({ collection: this.pendingGroup });
				this.subviews.push(groupView)
				groupView.setElement(this.$("#add-group-container .member-list"));
				groupView.render();
			},

				/**
				 * Returns a container that includes a view of the user's group membership
				 * @param {UserGroup[]} groups An array of UserGroup models
				 * @param {String} listContainer An html string template of a container that will get appended
				 * @returns {String} HTML string filled with groups information
				 */
				insertMembership: function(groups, listContainer){
				var	model  = this.model,
					list   = $(document.createElement("ul")).addClass("list-group member-list"),
					listHeader = $(document.createElement("h5")).addClass("list-group-item list-group-header").text("Member of " + groups.length + " groups")

				_.each(groups, function(group, i){
					var name = group.name || "Group",
						listItem = $(document.createElement("li")).addClass("list-group-item"),
						groupLink = group.groupId? $(document.createElement("a")).attr("href", MetacatUI.root + "/profile/" + group.groupId).text(name).appendTo(listItem) : "<a></a>";

					$(list).append(listItem);
				});

				if(this.model.get("username") == MetacatUI.appUserModel.get("username")){
					var link = $(document.createElement("a")).attr("href", MetacatUI.root + "/profile/" + MetacatUI.appUserModel.get("username") + "/s=settings/s=groups").text("Create New Group"),
						icon = $(document.createElement("i")).addClass("icon icon-on-left icon-plus"),
						listItem = $(document.createElement("li")).addClass("list-group-item create-group").append( $(link).prepend(icon) );

					$(list).append(listItem);
				}

				listContainer.html(list);
				list.before(listHeader);
				return listContainer;
			},

				/**
				 * Will send a request for info about this user and their groups, and redraw the group lists.
				 * Will also reset the "Create New Group" form
				 */
				refreshGroupLists: function(){
				this.insertCreateGroupForm();
				this.model.getInfo();
			},


				/**
				 * Gets the group name the user has entered and attempts to get this group from the server
				 * If no group is found, then the group name is marked as available. Otherwise an error msg is displayed
				 * @param {Event} e
				 */
				checkGroupName: function(e){
				if(!e || !e.target) return;

				var view = this,
					$notification = $("#group-name-notification-container"),
					$input = $(e.target);

				//Get the name typed in by the user
				var name = $input.val().trim();
				if(!name) return;

				this.listenToOnce(this.pendingGroup, "nameChecked", function(collection){
					//If the group name/id is available, then display so
					if(collection.nameAvailable){
						var icon = $(document.createElement("i")).addClass("icon icon-ok"),
							message = "The name " + collection.name + " is available",
							container = $(document.createElement("div")).addClass("notification success");

						$notification.html($(container).append(icon, message));
						$input.removeClass("has-error");
					}
					else{
						var icon = $(document.createElement("i")).addClass("icon icon-remove"),
							message = "The name " + collection.name + " is already taken",
							container = $(document.createElement("div")).addClass("notification error");

						$notification.html($(container).append(icon, message));
						$input.addClass("has-error");
					}

				});

				this.pendingGroup.checkName(name);
			},

				/**
				 * Syncs the pending group with the server
				 * @param {Event} e
				 */
				createGroup: function(e){
				e.preventDefault();

				//If there is no name specified, give warning
				if(!this.pendingGroup.name){
					var $notification = $("#group-name-notification-container"),
						$input = $("#add-group-name");

					var icon = $(document.createElement("i")).addClass("icon icon-exclamation"),
						message = "You must enter a group name",
						container = $(document.createElement("div")).addClass("notification error");

					$notification.html($(container).append(icon, message));
					$input.addClass("has-error");

					return;
				}
				//If this name is not available, exit
				else if(this.pendingGroup.nameAvailable == false) return;

				var view = this,
					group = this.pendingGroup;
				var success = function(data){
					view.showAlert("Success! Your group has been saved. View it <a href='" + MetacatUI.root + "/profile/" + group.groupId + "'>here</a>", "alert-success", "#add-group-alert-container");
					view.refreshGroupLists();
				}
				var error = function(xhr){
					var response = xhr? $.parseHTML(xhr.responseText) : null,
						description = "";
					if(response && response.length)
						description = $(response).find("description").text();

					if(description) description = "(" + description + ").";
					else description = "";

					view.showAlert("Your group could not be created. " + description + " Please try again.", "alert-error", "#add-group-alert-container")
				}

				//Create it!
				if(!this.pendingGroup.save(success, error))
					error();
			},

				/**
				 * Displays an alert message to the user
				 * @param {String} msg Message of the alert
				 * @param {String} classes A class tag
				 * @param {String} container The container tag
				 */
				showAlert: function(msg, classes, container) {
				if(!classes)
					var classes = 'alert-success';
				if(!container || !$(container).length)
					var container = this.$el;

				//Remove any alerts that are already in this container
				if($(container).children(".alert-container").length > 0)
					$(container).children(".alert-container").remove();

				$(container).prepend(
					this.alertTemplate({
						msg: msg,
						classes: classes
					})
				);
			},

				/**
				 * Closes the view and clears any subviews
				 */
				onClose: function() {
				this.$el.html("");
				this.stopListening(this.model)
				this.subviews = new Array();
			},

		});

		return UserGroupView;
	});
