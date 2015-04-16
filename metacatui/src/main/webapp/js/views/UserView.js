/*global define */
define(['jquery', 'underscore', 'backbone', 'models/UserModel', 'views/StatsView', 'views/DataCatalogView', 'text!templates/userProfile.html', 'text!templates/alert.html', 'text!templates/loading.html'], 				
	function($, _, Backbone, UserModel, StatsView, DataCatalogView, userProfileTemplate, AlertTemplate, LoadingTemplate) {
	'use strict';
			
	var UserView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(userProfileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		loadingTemplate: _.template(LoadingTemplate),
								
		initialize: function(){			
			this.subviews = new Array();
		},
				
		render: function () {
			
			var username = appModel.get("profileUsername")
			
			//Clear the page first
			this.$el.append("<div id='stats'></div>");
			
			// set the header type
			appModel.set('headerType', 'default');
			
			//Insert the template
			this.$el.html(this.template());
			
			this.listenToOnce(statsModel, "change:firstUpload", this.insertFirstUpload);
			
			//Render the Stats View for this person
			statsModel.set("query", '(rightsHolder:"' + username + '" OR submitter:"' + username + '")');
			this.statsView = new StatsView({
				title: "",
				el: this.$("#user-stats")
			});
			this.subviews.push(this.statsView);
			this.statsView.render();
			
			//Create a user model for this person
			var user = new UserModel({
				username: username
			});
			this.model = user;
			this.listenTo(user, "change:lastName", this.insertUserInfo);
			user.getInfo();
		
			//Insert this user's data content
			this.insertContent();
			
			$("#metacatui-app").removeClass("DataCatalog");
			
			return this;
		},
		
		/*
		 * Insert the name of the user
		 */
		insertUserInfo: function(){
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
		
		insertContent: function(){				
			var view = new DataCatalogView({
				el            : this.$("#data-list")[0],
				searchModel   : this.model.get("searchModel"),
				searchResults : this.model.get("searchResults"),
				mode          : "list"
			});
			this.subviews.push(view);
			view.render();
			view.$el.addClass("list-only");
			view.$(".auto-height").removeClass("auto-height").css("height", "auto");
		}, 
		
		onClose: function () {			
			//Clear the template
			this.$el.html("");
			
			//Stop listening to changes in models
			this.stopListening(statsModel);		
			this.stopListening(this.model);
			
			//Close the subviews
			_.each(this.subviews, function(view){
				view.onClose();
			});
			this.subviews = new Array();
		}
		
	});
	
	return UserView;		
});
