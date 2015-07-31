/*global define */

define(['jquery', 'underscore', 'backbone', 'text!templates/navbar.html'], 				
	function($, _, Backbone, NavbarTemplate) {
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
			 		 	    'click .dropdown' : 'showDropdown'
		},
		
		initialize: function () {
			// listen to the appModel for changes in username
			this.listenTo(appUserModel, 'change:username', this.render);
			this.listenTo(appUserModel, 'change:fullName', this.render);
			this.listenTo(appUserModel, 'change:loggedIn', this.render);
			this.listenTo(appModel, 'change:headerType', this.toggleHeaderType);
		},
				
		render: function () {		
			if(appModel.get("signInUrl")){
				var target = Backbone.history.location.href;
				var signInUrl = appModel.get('signInUrl') + target;
				var signInUrlOrcid = appModel.get('signInUrlOrcid') + target;
				var signInUrlLdap = appModel.get('signInUrlLdap') + target;	
			}

			var name = appUserModel.get('fullName') ? appUserModel.get('fullName').charAt(0).toUpperCase() + appUserModel.get("fullName").substring(1) : appUserModel.get("username");
			
			//Insert the navbar template
			this.$el.html(
				this.template({
					username:   appUserModel.get('username'),
					formattedName:   name,
					firstName:  appUserModel.get('firstName'),
					loggedIn:   appUserModel.get("loggedIn"),
					baseUrl:    appModel.get('baseUrl'),
					signInUrl:  signInUrl,
					signInUrlOrcid:  signInUrlOrcid,
					signInUrlLdap:  signInUrlLdap,
					currentUrl: window.location.href,
				}));
			
			//Initialize the fancybox elements
			this.$(".fancybox").fancybox({
				transitionIn: "elastic"
			});
			
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
