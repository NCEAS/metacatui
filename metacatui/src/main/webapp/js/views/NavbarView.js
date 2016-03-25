/*global define */

define(['jquery', 'underscore', 'backbone', 'views/SignInView', 'text!templates/navbar.html'], 				
	function($, _, Backbone, SignInView, NavbarTemplate) {
	'use strict';
	
	// Build the navbar view of the application
	var NavbarView = Backbone.View.extend({

		el: '#Navbar',
		
		template: _.template(NavbarTemplate),
		
		events: {
						  'click #search_btn' : 'triggerSearch',
					   'keypress #search_txt' : 'triggerOnEnter',
							  'click #myData' : 'myDataSearch',
			'click .show-new-dataCatalogView' : 'showNewSearch',
			 		 'click .dropdown-menu a' : 'hideDropdown',
			 		 	    'click .dropdown' : 'hideDropdown',
			 		 	'mouseover .dropdown' : 'showDropdown',
			 		 	 'mouseout .dropdown' : 'hideDropdown',
			 		 	'click #nav-trigger'  : 'showNav',
			 		 		  'click .nav li' : 'showSubNav'
		},
		
		initialize: function () {
			// listen to the appModel for changes in username
			this.listenTo(appUserModel, 'change:username', this.render);
			this.listenTo(appUserModel, 'change:fullName', this.render);
			this.listenTo(appUserModel, 'change:loggedIn', this.render);
			this.listenTo(appModel, 'change:headerType', this.toggleHeaderType);				
		},
				
		render: function () {		
			var name = appUserModel.get('fullName') ? appUserModel.get('fullName').charAt(0).toUpperCase() + appUserModel.get("fullName").substring(1) : appUserModel.get("username");
			
			//Insert the navbar template			
			this.$el.html(
				this.template({
					username:   appUserModel.get('username'),
					formattedName:   name,
					firstName:  appUserModel.get('firstName'),
					loggedIn:   appUserModel.get("loggedIn"),
					baseUrl:    appModel.get('baseUrl')
				}));
			
			//Insert the sign-in button
			var signInView = new SignInView().render();
			this.$(".login-container").append(signInView.el);
			signInView.setUpPopup();
						
			
			//Initialize the tooltips in the navbar
			this.$(".tooltip-this").tooltip({
				delay: {show: 600},
				trigger: "hover",
				placement: "bottom"
			});			
		},
		
		triggerSearch: function() {
			// Get the search term entered
			var searchTerm = $("#search_txt").val();
			
			//Clear the input value
			$("#search_txt").val('');
			
			//Clear the search model to start a fresh search
			appSearchModel.clear().set(appSearchModel.defaults);
			
			//Create a new array with the new search term
			var newSearch = [searchTerm];
			
			//Set up the search model for this new term
			appSearchModel.set('all', newSearch);
			
			// make sure the browser knows where we are
			uiRouter.navigate("data", {trigger: true});
			
			// ...but don't want to follow links
			return false;
			
		},
		
		myDataSearch: function() {
			
			//Make sure the user is logged in and there is a search model related to this user
			if(!appUserModel.get("loggedIn") || !appUserModel.get("searchModel")) return false;
			
			//The Data Catalog View will use this user's search model
			appView.dataCatalogView.searchModel = appUserModel.get("searchModel").clone(); 
				
			if(Backbone.history.fragment == "data")
				appView.dataCatalogView.render();
			else
				//Navigate to the data catalog view and update the URL
				uiRouter.navigate("data", {trigger: true});
			
			return false;			
		},
		
		showNewSearch: function(){ 
			appView.showNewSearch(); 
		},
		
		hideDropdown: function(){
			//Close the dropdown menu when a link is clicked
			this.$('.dropdown-menu').addClass('hidden');
			this.$('.dropdown').removeClass('open');
		},
		
		showDropdown: function(){
			this.$('.dropdown-menu').removeClass('hidden');
		},
		
		showNav: function(){
			this.$("nav").slideToggle();
			this.$("#nav-trigger .icon").toggle();
		},
		
		showSubNav: function(e){
			var parentEl = e.target.tagName == "LI"? e.target : $(e.target).parent("li");
			if(!parentEl || !$(parentEl).length) return;
			
			$(parentEl).find(".sub-menu").slideToggle();
		},
		
		triggerOnEnter: function(e) {
			if (e.keyCode != 13) return;
			this.triggerSearch();
		},
		
		toggleHeaderType: function(){
			// set the navbar class based on what the page requested
			var headerType = appModel.get('headerType');
			if (headerType == "default") {
				//Remove the alt class
				$(this.$el).removeClass("alt");
				//Add the class given
				$(this.$el).addClass(headerType);
			}
			else if(headerType == "alt"){
				//Remove the default class
				$(this.$el).removeClass("default");
				//Add the class given
				$(this.$el).addClass(headerType);
			}
		}
				
	});
	return NavbarView;		
});
