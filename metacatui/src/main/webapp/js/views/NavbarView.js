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
			 		 		//'click .dropdown' : 'hideDropdown'
		},
		
		initialize: function () {
			// listen to the appModel for changes in username
			this.listenTo(appUserModel, 'change:username', this.render);
			this.listenTo(appUserModel, 'change:firstName', this.render);
			this.listenTo(appModel, 'change:headerType', this.toggleHeaderType);
		},
				
		render: function () {		
			if(appModel.get("signInUrl")){
				var target = Backbone.history.location.href;
				var signInUrl = appModel.get('signInUrl') + target;
				var signInUrlOrcid = appModel.get('signInUrlOrcid') + target;
				var signInUrlLdap = appModel.get('signInUrlLdap') + target;	
			}

			//Insert the navbar template
			this.$el.html(
				this.template({
					username:   appUserModel.get('username'),
					fullName:   appUserModel.get('fullName'),
					firstName:  appUserModel.get('firstName'),
					loggedIn:   appUserModel.get("loggedIn"),
					baseUrl:    appModel.get('baseUrl'),
					signInUrl:  signInUrl,
					signInUrlOrcid:  signInUrlOrcid,
					signInUrlLdap:  signInUrlLdap,
					currentUrl: window.location.href,
				}));
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
		
		showNewSearch: function(){
			// Clear the search model to start a fresh search
			appSearchModel.clear();
			appSearchModel.set(appSearchModel.defaults);
			
			uiRouter.navigate('data', {trigger: true});
		},
		
		myDataSearch: function() {
			
			// Get the user name
			var username = appUserModel.get('username');
			
			// Clear the search model to start a fresh search
			appSearchModel.clear().set(appSearchModel.defaults);
			
			// Create a new array with the new search term
			var newSearch = ["rightsHolder:" + username];
			
			//Set up the search model for this new term
			appSearchModel.set('additionalCriteria', newSearch);
						
			// make sure the browser knows where we are
			uiRouter.navigate("data", {trigger: true});
			
			// ...but don't want to follow links
			return false;
			
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
