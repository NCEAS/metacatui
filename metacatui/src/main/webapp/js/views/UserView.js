/*global define */
define(['jquery', 'underscore', 'backbone', 'models/UserModel', 'views/StatsView', 'text!templates/userProfile.html', 'text!templates/alert.html', 'text!templates/loading.html'], 				
	function($, _, Backbone, UserModel, StatsView, userProfileTemplate, AlertTemplate, LoadingTemplate) {
	'use strict';
			
	var UserView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(userProfileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		loadingTemplate: _.template(LoadingTemplate),
				
		initialize: function(){

		},
				
		render: function () {
			
			var username = appModel.get("profileUsername")
			
			//Clear the page first
			this.$el.append("<div id='stats'></div>");
			
			// set the header type
			appModel.set('headerType', 'default');
			
			//Insert the template
			this.$el.html(this.template());
			
			//Render the Stats View for this person
			statsModel.set("query", '(rightsHolder:"' + username + '" OR submitter:"' + username + '")');
			var statsView = new StatsView({
				title: "",
				el: this.$("#user-stats")
			});
			statsView.render();
			
			//Create a user model for this person
			var user = new UserModel();
			this.model = user;
			this.listenTo(user, "change:completeFlag", this.insertUserInfo);
			user.getInfo();
		
			return this;
		},
		
		/*
		 * Insert the name of the user
		 */
		insertUserInfo: function(){
			//Don't try to insert anything if we haven't gotten all the user info yet
			if(this.model.get("completeFlag") !== true) return;
				
			//Construct the full name
			var name = this.model.get("firstName") + " " + this.model.get("lastName");
			
			//Insert the name into this page
			this.$("#fullname").text(name);
		},
		
		onClose: function () {			
			//Clear the template
			this.$el.html("");
			
			//Stop listening to changes in the model
			this.stopListening(statsModel);			
		}
		
	});
	
	return UserView;		
});
