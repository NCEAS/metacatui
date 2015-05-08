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
			"click #map-request-btn"			: "mapRequest",
			"click .confirm-request-btn"		: "confirmRequest",
			"click .reject-request-btn"			: "rejectRequest",
			"click .remove-identity-btn"		: "removeIdentity",
			
		},
		
		initialize: function(){			
			this.subviews = new Array();
		},
				
		render: function () {
			var view = this;
			
			this.stopListening();
			this.listenToOnce(appUserModel, "change:loggedIn", function(){
				view.onClose();
				view.render();
			});
			
			//Add the container element for our profile sections
			this.sectionHolder = $(document.createElement("section")).addClass("user-view-section");
			this.$el.html(this.sectionHolder);
			
			//Show the loading sign first
			$(this.sectionHolder).html(this.loadingTemplate());
						
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
			$(this.sectionHolder).children().slideUp();
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
			this.sectionHolder.append(this.settingsTemplate());
			
			//Listen for the group list to draw the group list
			this.listenTo(this.model, "change:groups", this.insertGroupList);
			
			//Listen for the identity list
			this.listenTo(this.model, "change:identities", this.insertIdentityList);
			
			//Listen for the pending list
			this.listenTo(this.model, "change:pending", this.insertPendingList);
		},
		
		insertGroupList: function(){
			var groups = this.model.get("groups");
			if(groups.length < 1) return;
			
			//Remove the group list if it was draw already so we don't do it twice
			if(this.$("#group-list").length > 0) this.$("#group-list").detach();
				
			//Create the list element
			var groupList = $(document.createElement("ul")).addClass("list-group").attr("id", "group-list");
			
			//Create a list item for each group
			_.each(groups, function(group, i){
				var listItem = $(document.createElement("li")).addClass("list-group-item group"),
					link     = $(document.createElement("a")).attr("href", "#").attr("data-subject", group.subject).text(group.groupName),
					icon     = $(document.createElement("i")).addClass("icon icon-expand-alt");
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
			if (identities.length < 1) {
				return;
			}
			
			//Remove the equivalentIdentities list if it was drawn already so we don't do it twice
			if(this.$("#identity-list").length > 0) this.$("#identity-list").detach();
				
			//Create the list element
			var identityList = $(document.createElement("ul")).addClass("list-identity").attr("id", "identity-list");
			
			//Create a list item for each identity
			_.each(identities, function(identity, i){
				var listItem = $(document.createElement("li")).addClass("list-identity-item identity"),
					link     = $(document.createElement("a")).attr("href", "#profile/" + identity).attr("data-subject", identity).text(identity);
				var remove = "<a href='#' class='remove-identity-btn' data-identity='" + identity + "'><i class='icon icon-trash'/></a>";
				$(identityList).append($(listItem).append($(link).prepend(remove)));
				
			});
			
			//Add to the page
			//$(identityList).find(".collapsed").hide();
			this.$("#identity-list-container").append(identityList);
		},
		
		insertPendingList: function(){
			var pending = this.model.get("pending");
			if (pending.length < 1) {
				return;
			}
			
			//Remove the equivalentIdentities list if it was drawn already so we don't do it twice
			if(this.$("#pending-list").length > 0) this.$("#pending-list").detach();
				
			//Create the list element
			var pendingList = $(document.createElement("ul")).addClass("list-identity").attr("id", "pending-list");
			
			//Create a list item for each pending id
			_.each(pending, function(identity, i){
				var listItem = $(document.createElement("li")).addClass("list-identity-item identity"),
					link     = $(document.createElement("a")).attr("href", "#profile/" + identity).attr("data-subject", identity).text(identity);				
				var confirm = "<a href='#' class='confirm-request-btn' data-identity='" + identity + "'><i class='icon icon-check-sign'/></a>";
				var reject = "<a href='#' class='reject-request-btn' data-identity='" + identity + "'><i class='icon icon-trash'/></a>";

				$(pendingList).append(
						$(listItem).append($(link))
						.prepend(confirm)
						.prepend(reject)
				);
				
			});
			
			//Add to the page
			this.$("#pending-list-container").append(pendingList);
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
		
		mapRequest: function() {
			
			var model = this.model;

			var equivalentIdentity = this.$("#map-request-field").val();
			if (!equivalentIdentity || equivalentIdentity.length < 1) {
				return;
			}
			//equivalentIdentity = encodeURIComponent(equivalentIdentity);
				
			var mapUrl = appModel.get("accountsUrl") + "pendingmap";
				
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
					// TODO: render alert in DOM
					alert("Added mapping request for " + equivalentIdentity);
					model.getInfo();
				}
			});
		},
		
		confirmRequest: function(e) {
			
			var model = this.model;

			e.preventDefault();
			var equivalentIdentity = $(e.target).parents("a").attr("data-identity");	
			
			var mapUrl = appModel.get("accountsUrl") + "pendingmap/" + encodeURIComponent(equivalentIdentity);	
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
					// TODO: render alert in DOM
					alert("Confirmed mapping request for " + equivalentIdentity);
					model.getInfo();
				}
			});
		},
		
		rejectRequest: function(e) {
			
			var model = this.model;
			
			e.preventDefault();
			var equivalentIdentity = $(e.target).parents("a").attr("data-identity");	
			
			var mapUrl = appModel.get("accountsUrl") + "pendingmap/" + encodeURIComponent(equivalentIdentity);	
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
					// TODO: render alert in DOM
					alert("Removed mapping request for " + equivalentIdentity);
					model.getInfo();
				}
			});
		},
		
		removeIdentity: function(e) {
			
			var model = this.model;

			e.preventDefault();
			var equivalentIdentity = $(e.target).parents("a").attr("data-identity");	
			
			var mapUrl = appModel.get("accountsUrl") + "map/" + encodeURIComponent(equivalentIdentity);	
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
					// TODO: render alert in DOM
					alert("Removed mapping for " + equivalentIdentity);
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
