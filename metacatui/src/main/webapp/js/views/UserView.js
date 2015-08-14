/*global define */
define(['jquery', 'underscore', 'backbone', 'models/UserModel', 'views/StatsView', 'views/DataCatalogView', 'text!templates/userProfile.html', 'text!templates/alert.html', 'text!templates/loading.html', 'text!templates/userProfileMenu.html', 'text!templates/userSettings.html'], 				
	function($, _, Backbone, UserModel, StatsView, DataCatalogView, userProfileTemplate, AlertTemplate, LoadingTemplate, ProfileMenuTemplate, SettingsTemplate) {
	'use strict';
			
	var UserView = Backbone.View.extend({

		el: '#Content',
		
		//Templates
		profileTemplate:  _.template(userProfileTemplate),
		alertTemplate:    _.template(AlertTemplate),
		loadingTemplate:  _.template(LoadingTemplate),
		settingsTemplate: _.template(SettingsTemplate),		
		menuTemplate:     _.template(ProfileMenuTemplate),
		
		events: {
			"click .section-link"          : "switchToSection",
			"click .subsection-link"       : "switchToSubSection",
			"click .list-group-item.group" : "toggleMemberList",
			"click .token-generator"       : "getToken",
			"click #map-request-btn"	   : "mapRequest",
			"click #mod-save-btn"		   : "saveUser",
			"click .confirm-request-btn"   : "confirmRequest",
			"click .reject-request-btn"	   : "rejectRequest",
			"click .remove-identity-btn"   : "removeIdentity",
			"click [highlight-subsection]" : "highlightSubSection"
		},
		
		initialize: function(){			
			this.subviews = new Array();
		},
				
		render: function () {
			var view = this;
			
			this.stopListening();
			//If the logged-in status changes, refresh the page
			this.listenToOnce(appUserModel, "change:loggedIn", function(){
				view.onClose();
				view.render();
			});
			
			//Add the container element for our profile sections
			this.sectionHolder = $(document.createElement("section")).addClass("user-view-section");
			this.$el.html(this.sectionHolder);
			
			//Show the loading sign first
			$(this.sectionHolder).html(this.loadingTemplate());
			this.$el.show();
						
			// set the header type
			appModel.set('headerType', 'default');
			
			//Is this our currently-logged in user?
			var username = appModel.get("profileUsername");
			if(username == appUserModel.get("username")){
				this.model = appUserModel;
				
				//If the user is logged in, display the settings options
				if(this.model.get("loggedIn")){
					this.insertMenu();
				}
			}
			//Create a user model for this person
			else{
				var user = new UserModel({
					username: username
				});
				this.model = user;				
			}
			
			//Render all the sections of the User View
			this.renderProfile();
			this.renderSettings();
			
			//Hide all the sections first and display the default "profile" section first
			$(this.sectionHolder).children().hide();
			this.$("[data-section='profile']").slideDown();				
			this.$(".subsection").hide();					

			
			return this;
		},
		
		switchToSection: function(e){
			
			e.preventDefault();
			
			//Hide all the sections first
			$(this.sectionHolder).children().slideUp().removeClass(".active");

			//Get the section name
			var sectionName = $(e.target).attr("data-section");
			
			//Display the specified section
			var activeSection = this.$(".section[data-section='" + sectionName + "']");
			$(activeSection).addClass("active").slideDown();
			this.$(".nav-tab").removeClass("active");
			$(e.target).parents(".nav-tab").addClass("active");
			
			//Find all the subsections, if there are any
			if($(activeSection).find(".subsection").length > 0){
				//Find any item classified as "active"
				var activeItem = $(activeSection).find(".active");
				if(activeItem.length > 0){
					//Find the data section this active item is referring to
					if($(activeItem).children("[data-section]").length > 0){
						//Get the section name
						var subsectionName = $(activeItem).find("[data-section]").first().attr("data-section");
						//If we found a section name, find the subsection element and display it
						if(subsectionName) this.switchToSubSection(null, subsectionName);
					}
				}
			}
		},
		
		switchToSubSection: function(e, subsectionName){
			if(e) e.preventDefault();
			if(!subsectionName) var subsectionName = $(e.target).attr("data-section");
						
			//Mark its links as active
			$(".section.active").find(".subsection-link").removeClass("active");
			$(".section.active").find(".subsection-link[data-section='" + subsectionName + "']").addClass("active");
			
			//Hide all the other sections
			$(".section.active").find(".subsection").hide();
			$(".section.active").find(".subsection[data-section='" + subsectionName + "']").show();
		},
		
		renderProfile: function(){
			//Insert the template first
			this.sectionHolder.append(this.profileTemplate());
			
			//Insert the user data statistics
			this.insertStats();
			
			//Insert the user's basic information
			if((this.model.get("username") == appUserModel.get("username")) && appUserModel.get("loggedIn"))
				this.insertUserInfo();
			else{
				this.listenTo(this.model, "change:lastName", this.insertUserInfo);
				this.model.getInfo();				
			}

			//Insert this user's data content
			this.insertContent();
		},
		
		renderSettings: function(){
			//Insert the template first
			this.sectionHolder.append(this.settingsTemplate({
				username: this.model.get("username")
			}));
			
			//Listen for the group list to draw the group list
			this.listenTo(this.model, "change:groups", this.insertGroupList);
			this.insertGroupList();
			
			//Listen for the identity list
			this.listenTo(this.model, "change:identities", this.insertIdentityList);
			this.insertIdentityList();
			
			//Listen for the pending list
			this.listenTo(this.model, "change:pending", this.insertPendingList);
			this.insertPendingList();
			
			//Listen for updates to person details
			this.listenTo(this.model, "change:lastName", this.updateModForm);
			this.listenTo(this.model, "change:firstName", this.updateModForm);
			this.listenTo(this.model, "change:email", this.updateModForm);
			this.listenTo(this.model, "change:registered", this.updateModForm);
			this.updateModForm();

			// init autocomplete fields
			this.setUpAutocomplete();
		},
		
		highlightSubSection: function(e){
			e.preventDefault();
			if(!e.target) return;
			
			//Get the subsection name
			var subsectionName = $(e.target).attr("highlight-subsection");
			if(!subsectionName) return;
			
			//Visually highlight the subsection
			var subsection = this.$("[data-subsection='" + subsectionName + "']");
			subsection.addClass("highlight");
			appView.scrollTo(subsection);
			//Wait about a second and then remove the highlight style
			window.setTimeout(function(){ subsection.removeClass("highlight"); }, 1500);
		},
		
		insertGroupList: function(){
			var groups = this.model.get("groups");
			
			//Empty the container first
			this.$("#group-list-container").empty();

			//Create the list element
			if(groups.length < 1)
				var groupList = $(document.createElement("p")).text("You are not a member of any groups.");
			else
				var groupList = $(document.createElement("ul")).addClass("list-group").attr("id", "group-list");
			
			//Create a list item for each group
			_.each(groups, function(group, i){
				var listItem = $(document.createElement("li")).addClass("list-group-item group"),
					link     = $(document.createElement("a")).attr("href", "#").attr("data-subject", group.subject).text(group.groupName),
					icon     = $(document.createElement("i")).addClass("icon icon-expand-alt tooltip-this").attr("data-title", "Expand").attr("data-placement", "top").attr("data-trigger", "hover");
				$(groupList).append($(listItem).append($(link).prepend(icon)));
				
				//Create a list of member names
				var memberList     = $(document.createElement("ul")).addClass("list-group group-member-list collapsed");
				_.each(group.members, function(member){
					//Create a list item for this member
					var memberListItem = $(document.createElement("li")).addClass("list-group-item member"),
						memberLink     = $(document.createElement("a")).attr("href", "#").attr("data-username", member).text(member);
					
					$(memberList).append($(memberListItem).append(memberLink));
				});
				//Add the member list to the group list
				$(listItem).append(memberList);
			});
			
			//Add to the page
			$(groupList).find(".collapsed").hide();
			this.$("#group-list-container").append(groupList);
		},
		
		insertIdentityList: function(){
			var identities = this.model.get("identities");
			
			//Remove the equivalentIdentities list if it was drawn already so we don't do it twice
			this.$("#identity-list-container").empty();
			
			//Create the list element
			if (identities.length < 1){
				var highlightLink = $(document.createElement("a")).attr("href", window.location.hash + "/settings/add-account").attr("highlight-subsection", "add-account").text("here."),
					identityList = $(document.createElement("p")).text("Your account is not mapped to any other accounts. Send a request below, ").append(highlightLink);
			}
			else
				var identityList = $(document.createElement("ul")).addClass("list-identity").attr("id", "identity-list");
			
			//Create a list item for each identity
			_.each(identities, function(identity, i){
				var listItem = $(document.createElement("li")).addClass("list-identity-item identity"),
					link     = $(document.createElement("a")).attr("href", "#profile/" + identity).attr("data-subject", identity).text(identity),
					remove   = $(document.createElement("a")).attr("href", '#')
							   .addClass('remove-identity-btn')
							   .attr("data-identity", identity)
							   .prepend("<i class='icon icon-remove-sign'/>");
				$(identityList).append($(listItem).append($(link).append(remove)));
				$(remove).tooltip({
					trigger: "hover",
					placement: "top",
					title: "Delete equivalent account"
				})
			});
			
			//Add to the page
			//$(identityList).find(".collapsed").hide();
			this.$("#identity-list-container").append(identityList);
		},
		
		insertPendingList: function(){
			var pending = this.model.get("pending");
			
			//Remove the equivalentIdentities list if it was drawn already so we don't do it twice
			this.$("#pending-list-container").empty();
	
			//Create the list element
			if (pending.length < 1){
				this.$("[data-subsection='pending-accounts']").hide();
				return;
			}
			else{
				this.$("#pending-list-container").prepend($(document.createElement("p")).text("You have " + pending.length + " new request to map accounts. If these requests are from you, accept them below. If you do not recognize a username, reject the request."));
				var pendingList = $(document.createElement("ul")).addClass("list-identity").attr("id", "pending-list");
				var pendingCount = $(document.createElement("span")).addClass("badge").attr("id", "pending-count").text(pending.length);
				this.$("#pending-list-heading").append(pendingCount);
			}
			
			//Create a list item for each pending id
			_.each(pending, function(identity, i){
				var listItem = $(document.createElement("li")).addClass("list-identity-item identity"),
					link     = $(document.createElement("a")).attr("href", "#profile/" + identity).attr("data-subject", identity).text(identity),				
				    acceptIcon = $(document.createElement("i")).addClass("icon icon-check-sign icon-large icon-positive tooltip-this").attr("data-title", "Accept Request").attr("data-trigger", "hover").attr("data-placement", "top"),
				    rejectIcon = $(document.createElement("i")).addClass("icon icon-trash icon-large icon-negative tooltip-this").attr("data-title", "Reject Request").attr("data-trigger", "hover").attr("data-placement", "top"),
					confirm = $(document.createElement("a")).attr("href", "#").addClass('confirm-request-btn').attr("data-identity", identity).append(acceptIcon),
					reject = $(document.createElement("a")).attr("href", "#").addClass("reject-request-btn").attr("data-identity", identity).append(rejectIcon);

				$(pendingList).append(
						$(listItem).append($(link))
						.prepend(confirm)
						.prepend(reject)
				);
				
			});
			
			//Add to the page
			this.$("#pending-list-container").append(pendingList);
		},
		
		updateModForm: function() {
			this.$("#mod-givenName").val(this.model.get("firstName"));
			this.$("#mod-familyName").val(this.model.get("lastName"));
			this.$("#mod-email").val(this.model.get("email"));
			
			if (this.model.get("registered")) {
				this.$("#registered-user-container").show();
			} else {
				this.$("#registered-user-container").hide();
			}
			
		},
		
		getToken: function(){		
			var model = this.model;
			
			//When the token is retrieved, then show it
			this.listenToOnce(this.model, "change:token", this.showToken);
			
			//Get the token from the CN
			this.model.checkToken(function(data, textStatus, xhr){				
				model.set("token", data);
			});			
		},
		
		showToken: function(){
			var token = this.model.get("token");
			
			var tokenInput = $(document.createElement("textarea")).attr("type", "text").attr("rows", "11").attr("disabled", "disabled").addClass("token").text(token),
				copyButton = $(document.createElement("a")).attr("href", "#").addClass("btn").attr("type", "button").text("Copy");
						
			var	successMessage = this.alertTemplate({
					msg: '<i class="icon icon-ok"></i>  <strong>Success!</strong> Copy your token: <br/>' + $(tokenInput)[0].outerHTML,
					classes: "alert-success"
				});
			
			this.$("#token-generator-container").html(successMessage);
		},
		
		setUpAutocomplete: function() {
			
			// look up registered identities 
			$('#map-request-field').hoverAutocomplete({
				source: function (request, response) {
		            var term = $.ui.autocomplete.escapeRegex(request.term);
		            
		            var list = [];

		            var url = appModel.get("accountsUrl") + "?query=" + encodeURIComponent(term);					
					$.get(url, function(data, textStatus, xhr) {
						_.each($(data).find("person"), function(person, i){
							var item = {};
							item.value = $(person).find("subject").text();
							item.label = $(person).find("givenName").text() + " " + $(person).find("familyName").text();
							list.push(item);
						});
						
			            response(list);

					});
		            
		        },
				select: function(event, ui) {
					// set the text field
					$('#map-request-field').val(ui.item.value);
					// prevent default action
					return false;
				},
				position: {
					my: "left top",
					at: "left bottom",
					collision: "fit"
				}
			});
			
		},
		
		saveUser: function(e) {
			
			e.preventDefault();
			
			var view = this,
				container = this.$('[data-subsection="edit-account"] .content') || $(e.target).parent();
			
			var success = function(data){
				$(container).find(".loading").detach();
				$(container).children().show();
				view.showAlert("Success! Your profile has been updated.", 'alert-success', container);
			}
			var error = function(data){
				$(container).find(".loading").detach();
				$(container).children().show();
				var msg = (data && data.responseText) ? data.responseText : "Sorry, updating your profile failed. Please try again.";
				if(!data.responseText)
					view.showAlert(msg, 'alert-error', container);
			}

			//Get info entered into form
			var givenName = this.$("#mod-givenName").val();
			var familyName = this.$("#mod-familyName").val();
			var email = this.$("#mod-email").val();
			
			//Update the model
			this.model.set("firstName", givenName);
			this.model.set("lastName", familyName);
			this.model.set("email", email);
			
			//Loading icon
			$(container).children().hide();
			$(container).prepend(this.loadingTemplate());
			
			//Send the update
			this.model.update(success, error);
			
		},
		
		showAlert: function(msg, classes, container) {
			if(!classes)
				var classes = 'alert-success';
			if(!container)
				var container = this.$el;

			//Remove any alerts that are already in this container
			if(container.children(".alert-container").length > 0)
				container.children(".alert-container").detach();
			
			$(container).prepend(
					this.alertTemplate({
						msg: msg,
						classes: classes
					})
			);
		},
		
		mapRequest: function(e) {
			
			e.preventDefault();
			
			var model = this.model;

			//Get the identity entered into the input
			var equivalentIdentity = this.$("#map-request-field").val();
			if (!equivalentIdentity || equivalentIdentity.length < 1) {
				return;
			}
			//Clear the text input
			this.$("#map-request-field").val("");
			 
			var mapUrl = appModel.get("accountsUrl") + "pendingmap";
				
			var viewRef = this,
				container = this.$("#identity-request-container");
			
			// ajax call to map
			$.ajax({
				type: "POST",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.model.get("token")
			    },
				url: mapUrl,
				data: {
					subject: equivalentIdentity
				},
				success: function(data, textStatus, xhr) {
					var message = "A username map request has been sent to " + equivalentIdentity +
								  "<h4>Next step:</h4><p>Login with this other account and approve this request.</p>"
					viewRef.showAlert(message, null, container);
					model.getInfo();
				},
				error: function(data, textStatus, xhr) {
					viewRef.showAlert(data.responseText, 'alert-error', container);
					model.getInfo();
				}
			});
		},
		
		confirmRequest: function(e) {
			
			var model = this.model;

			e.preventDefault();
			var equivalentIdentity = $(e.target).parents("a").attr("data-identity");	
			
			var mapUrl = appModel.get("accountsUrl") + "pendingmap/" + encodeURIComponent(equivalentIdentity);	
			
			var viewRef = this;
			
			// ajax call to confirm map
			$.ajax({
				type: "PUT",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.model.get("token")
			    },
				url: mapUrl,
				success: function(data, textStatus, xhr) {
					viewRef.showAlert("Confirmed mapping request for " + equivalentIdentity);
					model.getInfo();
				},
				error: function(data, textStatus, xhr) {
					viewRef.showAlert(data.responseText, 'alert-error');
					model.getInfo();
				}
			});
		},
		
		rejectRequest: function(e) {
			
			var model = this.model;
			
			e.preventDefault();
			var equivalentIdentity = $(e.target).parents("a").attr("data-identity");	
			
			var mapUrl = appModel.get("accountsUrl") + "pendingmap/" + encodeURIComponent(equivalentIdentity);
			
			var viewRef = this;
			
			// ajax call to reject map
			$.ajax({
				type: "DELETE",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.model.get("token")
			    },
				url: mapUrl,
				success: function(data, textStatus, xhr) {
					viewRef.showAlert("Removed mapping request for " + equivalentIdentity);
					model.getInfo();
				},
				error: function(data, textStatus, xhr) {
					viewRef.showAlert(data.responseText, 'alert-error');
					model.getInfo();
				}
			});
		},
		
		removeIdentity: function(e) {
			
			var model = this.model;

			e.preventDefault();
			var equivalentIdentity = $(e.target).parents("a").attr("data-identity");	
			
			var mapUrl = appModel.get("accountsUrl") + "map/" + encodeURIComponent(equivalentIdentity);	
			
			var viewRef = this;
			
			// ajax call to remove mapping
			$.ajax({
				type: "DELETE",
				xhrFields: {
					withCredentials: true
				},
				headers: {
			        "Authorization": "Bearer " + this.model.get("token")
			    },
				url: mapUrl,
				success: function(data, textStatus, xhr) {
					viewRef.showAlert("Removed mapping for " + equivalentIdentity);
					model.getInfo();
				},
				error: function(data, textStatus, xhr) {
					viewRef.showAlert(data.responseText, 'alert-error');
					model.getInfo();
				}
			});
		},
		
		insertStats: function(){
			var username = this.model.get("username");
			
			//Render the Stats View for this person
			this.listenToOnce(statsModel, "change:firstUpload", this.insertFirstUpload);
			statsModel.set("query", '(rightsHolder:"' + username + '" OR submitter:"' + username + '")');
			this.statsView = new StatsView({
				title: "",
				el: this.$("#user-stats")
			});
			this.subviews.push(this.statsView);
			this.statsView.render();
		},
		
		/*
		 * Insert the name of the user
		 */
		insertUserInfo: function(){
			
			this.listenTo(this.model, "change:firstName", this.insertUserInfo);
			this.listenTo(this.model, "change:lastName", this.insertUserInfo);

			//Don't try to insert anything if we haven't gotten all the user info yet
			if(!this.model.get("lastName") && !this.model.get("firstName")) return;
				
			//Construct the full name
			var name = this.model.get("firstName") + " " + this.model.get("lastName");
			
			//Insert the name into this page
			this.$("#fullname").text(name);
		},
		
		/*
		 * Insert the first year of contribution for this user
		 */
		insertFirstUpload: function(){
			var firstUpload = new Date(statsModel.get("firstUpload"));
			
			var monthNames = [ "January", "February", "March", "April", "May", "June",
				                 "July", "August", "September", "October", "November", "December" ];
			
			var m = monthNames[firstUpload.getUTCMonth()],
				y = firstUpload.getUTCFullYear(),
				d = firstUpload.getUTCDate();
			
			this.$("#first-upload").text("Contributor since " + m + " " + d + ", " + y);
		},
		
		/*
		 * Insert a list of this user's content
		 */
		insertContent: function(){				
			var view = new DataCatalogView({
				el            : this.$("#data-list")[0],
				searchModel   : this.model.get("searchModel"),
				searchResults : this.model.get("searchResults"),
				mode          : "list",
				isSubView     : true
			});
			this.subviews.push(view);
			view.render();
			view.$el.addClass("list-only");
			view.$(".auto-height").removeClass("auto-height").css("height", "auto");
			$("#metacatui-app").removeClass("DataCatalog mapMode");
		}, 
		
		/*
		 * Displays a menu for the user to switch between different views of the user profile
		 */
		insertMenu: function(){
			//If the user is not logged in, then remove the menu 
			if(!appUserModel.get("loggedIn")){
				this.$(".nav").detach();
				return;
			}
			
			//Otherwise, insert the menu
			var menu = this.menuTemplate({
				username: this.model.get("username")
			});
			
			this.$el.prepend(menu);
		},
		
		toggleMemberList: function(e){
			e.preventDefault();
			
			var listItem = e.target;
			
			if(!$(listItem).hasClass("list-group-item")){
				listItem = $(listItem).parents("li.list-group-item");
			}
			
			$(listItem).find(".group-member-list").toggleClass("collapsed").slideToggle();
			$(listItem).find(".icon").toggleClass("icon-expand-alt").toggleClass("icon-collapse-alt");
		},
		
		onClose: function () {			
			//Clear the template
			this.$el.html("");
			
			//Stop listening to changes in models
			this.stopListening(statsModel);		
			this.stopListening(this.model);
			this.stopListening(appUserModel);
			
			//Close the subviews
			_.each(this.subviews, function(view){
				view.onClose();
			});
			this.subviews = new Array();
		}
		
	});
	
	return UserView;		
});
