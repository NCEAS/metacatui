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
			"click .section-link" : "switchToSection"
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
			
			//Switch to the section of the User View we want
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
			
			return this;
		},
		
		switchToSection: function(e){
			
			e.preventDefault();
			
			//Hide all the sections first
			$(this.sectionHolder).children().slideUp();

			//Get the section name
			var section = $(e.target).attr("data-section");
			
			//Display the specified section
			this.$("[data-section='" + section + "']").slideDown();
			this.$(".nav-tab").removeClass("active");
			$(e.target).parents(".nav-tab").addClass("active");
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
			$("#metacatui-app").removeClass("DataCatalog");
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
