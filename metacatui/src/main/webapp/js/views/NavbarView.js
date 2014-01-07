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
			'click .show-new-dataCatalogView' : 'showNewSearch'
		},
		
		initialize: function () {
			// listen to the appModel for changes in username
			//this.listenTo(appModel, 'change:username', this.render);
			this.listenTo(appModel, 'change:fullName', this.render);
			this.listenTo(appModel, 'change:headerType', this.toggleHeaderType);
		},
				
		render: function () {
			console.log('Rendering the navbar');
			
			// set the username in the template (can be null if not logged in)
			this.$el.html(
					this.template( 
							{
								username: appModel.get('username'),
								fullName: appModel.get('fullName')
							} 
					)
			);
		},
		
		triggerSearch: function() {
			// Get the search term entered
			var searchTerm = $("#search_txt").val();
			
			//Clear the input value
			$("#search_txt").val('');
			
			//Clear the search model to start a fresh search
			searchModel.clear().set(searchModel.defaults);
			
			//Create a new array with the new search term
			var newSearch = [searchTerm];
			
			//Set up the search model for this new term
			searchModel.set('all', newSearch);
			
			// make sure the browser knows where we are
			uiRouter.navigate("data", {trigger: true});
			
			// ...but don't want to follow links
			return false;
			
		},
		
		showNewSearch: function(){
			// Clear the search model to start a fresh search
			searchModel.clear().set(searchModel.defaults);
			
			uiRouter.navigate('data', {trigger: true});
		},
		
		myDataSearch: function() {
			
			// Get the user name
			var username = appModel.get('username');
			
			// Clear the search model to start a fresh search
			searchModel.clear().set(searchModel.defaults);
			
			// Create a new array with the new search term
			var newSearch = ["+rightsHolder:" + username];
			
			//Set up the search model for this new term
			searchModel.set('additionalCriteria', newSearch);
			
			console.log(searchModel);
			
			// make sure the browser knows where we are
			uiRouter.navigate("data", {trigger: true});
			
			// ...but don't want to follow links
			return false;
			
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
