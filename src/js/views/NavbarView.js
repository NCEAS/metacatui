/*global define */

define(['jquery', 'underscore', 'backbone', 'views/SignInView', 'text!templates/navbar.html'],
	function($, _, Backbone, SignInView, NavbarTemplate) {
	'use strict';

	/**
  * @class NavbarView
  * @classdesc Build the navbar view of the application
  * @extends Backbone.View
  * @constructor
  */
	var NavbarView = Backbone.View.extend(
    /** @lends NavbarView.prototype */ {

    /**
    * @type {string}
    */
		el: '#Navbar',

    /**
    * @type {Underscore.Template}
    */
		template: _.template(NavbarTemplate),

    /**
    * @type {object}
    */
		events: {
						  'click #search_btn' : 'triggerSearch',
					   'keypress #search_txt' : 'triggerOnEnter',
			         'click .show-new-search' : 'resetSearch',
			 		 'click .dropdown-menu a' :  'hideDropdown',
			 		 	'mouseenter .dropdown' : 'showDropdown',
			 		 	 'mouseleave .dropdown' : 'hideDropdown',
			 		 	'click #nav-trigger'  : 'showNav',
			 		 		  'click .nav li' : 'showSubNav'
		},

		initialize: function () {
			// listen to the MetacatUI.appModel for changes in username
			this.listenTo(MetacatUI.appUserModel, 'change:username', this.render);
			this.listenTo(MetacatUI.appUserModel, 'change:fullName', this.render);
			this.listenTo(MetacatUI.appUserModel, 'change:loggedIn', this.render);
			this.listenTo(MetacatUI.appModel, 'change:headerType', this.toggleHeaderType);
		},

		render: function () {
			var name = MetacatUI.appUserModel.get('fullName') ? MetacatUI.appUserModel.get('fullName').charAt(0).toUpperCase() + MetacatUI.appUserModel.get("fullName").substring(1) : MetacatUI.appUserModel.get("username");

			//Insert the navbar template
			this.$el.html(
				this.template({
					username:   MetacatUI.appUserModel.get('username'),
					formattedName:   name,
					firstName:  MetacatUI.appUserModel.get('firstName'),
					loggedIn:   MetacatUI.appUserModel.get("loggedIn"),
					baseUrl:    MetacatUI.appModel.get('baseUrl')
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

			this.changeBackground();
		},

		changeBackground: function(){
			// Change the background image if there is one
			var imageEl = $('#bg_image');
			if ($(imageEl).length > 0) {
				var imgCnt = $(imageEl).attr('data-image-count');

				//Randomly choose the next background image
				var bgNum = Math.ceil(Math.random() * imgCnt);

				$(imageEl).css('background-image', "url('" +  MetacatUI.root + "/js/themes/" +  MetacatUI.theme + "/img/backgrounds/bg" + bgNum + ".jpg')");
			}
		},

		triggerSearch: function() {
			// Get the search term entered
			var searchTerm = $("#search_txt").val();

			//Clear the input value
			$("#search_txt").val('');

			//Clear the search model to start a fresh search
			MetacatUI.appSearchModel.clear().set(MetacatUI.appSearchModel.defaults);

			//Create a new array with the new search term
			var newSearch = [searchTerm];

			//Set up the search model for this new term
			MetacatUI.appSearchModel.set('all', newSearch);

			// make sure the browser knows where we are
			MetacatUI.uiRouter.navigate("data", {trigger: true});

			// ...but don't want to follow links
			return false;

		},

		resetSearch: function(e){
			e.preventDefault();
			MetacatUI.appView.resetSearch();
		},

		hideDropdown: function(e){
			this.$('.dropdown-menu').addClass('hidden');
			this.$('.dropdown').removeClass('open');
		},

		showDropdown: function(e){
			this.$('.dropdown-menu').removeClass('hidden');

			// Prevent click events immediately following mouseenter events, otherwise
			// toggleDropdown() is called right after showDropdown on touchscreen devices.
			// (on touch screen, both mouseenter and click are called when user touches element)
			this.$('.dropdown .dropdown-toggle').off('click');
			var view = this;
			setTimeout(function () {
				view.$('.dropdown .dropdown-toggle').on('click', function(e){
					view.toggleDropdown(e)
				});
			}, 10);
		},

		toggleDropdown: function(e){
			// this.$(".navbar-inner").append(" TOGG: " + e.handleObj.origType)
			// console.log(e);
			this.$('.dropdown-menu').toggleClass('hidden');
			this.$('.dropdown').removeClass('open');
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
			var headerType = MetacatUI.appModel.get('headerType');
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
