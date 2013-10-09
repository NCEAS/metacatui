/*global define */

define(['jquery', 'underscore', 'backbone', 'text!templates/navbar.html'], 				
	function($, _, Backbone, NavbarTemplate) {
	'use strict';
	
	// Build the navbar view of the application
	var NavbarView = Backbone.View.extend({

		el: '#Navbar',
		
		template: _.template(NavbarTemplate),
		
		events: {
			'click #search_btn': 'triggerSearch',
			'keypress #search_txt': 'triggerOnEnter'
		},
		
		initialize: function () {
			// listen to the appModel for changes in username
			//this.listenTo(appModel, 'change:username', this.render);
			this.listenTo(appModel, 'change:fullName', this.render);
			this.listenTo(appModel, 'change:headerType', this.render);

		},
				
		render: function () {
			console.log('Rendering the navbar');
			
			// set the navbar [positioning] class based on what the page requested
			var headerType = appModel.get('headerType');
			$(this.$el).attr('class', '');
			if (headerType) {
				$(this.$el).addClass(headerType);
			}
			
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
			
			//Clear te input value
			$("#search_txt").val('');
			
			//Clear the search model to start a fresh search
			searchModel.clear().set(searchModel.defaults);
			
			//Create a new array with the new search term
			var newSearch = [searchTerm];
			
			//Set up the search model for this new term
			searchModel.set('all', newSearch);
			
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
				
	});
	return NavbarView;		
});
