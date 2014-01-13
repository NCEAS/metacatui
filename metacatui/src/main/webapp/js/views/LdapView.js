/*global define */
define(['jquery', 'underscore', 'backbone', 'bootstrap', 'recaptcha', 'text!templates/loading.html'], 				
	function($, _, Backbone, BootStrap, Recaptcha, LoadingTemplate) {
	'use strict';
	
	// Build the main header view of the application
	var LdapView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		loadingTemplate: _.template(LoadingTemplate),
		
		containerTemplate: '<article><div class="container"><div class="row-fluid"><div id="DynamicContent" class="text-left"></div></div></div></article>',
				
		ldapwebUrl: null,
		
		ldapwebQueryString:  "?cfg=metacatui",
		
		stage:  null,

		initialize: function () {
			
		},
				
		render: function () {
			
			// look up the url from the main application model
			this.ldapwebUrl = appModel.get('ldapwebServiceUrl');
			
			// request a smaller header
			appModel.set('headerType', 'default');
			
			console.log('Calling the ldapweb to display');
			// show the loading icon
			this.showLoading();
			
			// do we have a specific stage?
			var completeUrl = this.ldapwebUrl + this.ldapwebQueryString;
			if (this.stage) {
				completeUrl += "&stage=" + this.stage;
			}
			console.log('Calling the ldapweb URL: ' + completeUrl);
			
			// load all the ldapweb content so all the js can run in what gets loaded
			var viewRef = this;
			this.$el.html(viewRef.containerTemplate);
			var contentArea = this.$("#DynamicContent");
			contentArea.load(
					completeUrl,
					function() {
						viewRef.cleanStyles();
						viewRef.$el.hide();
						viewRef.$el.fadeIn('slow');
					});
			
			return this;
		},
		
		cleanStyles: function() {
			// modify the classes to enhance the l+f without changing the ldapweb.cgi source
			//this.$(".label").removeClass("label");
			this.$(":submit").addClass("btn");

		},
		
		onClose: function () {			
			console.log('Closing the ldapweb view');
		},
		
		events: {
			"click input[type='submit']"   : "submitForm"
			//,
			//"click :submit"   : "submitForm"

				
		},
		
		submitForm: function(formId) {
			
			// which form?
			var form = $(event.target).parents("form");
			
			// get the form data before replacing everything with the loading icon!
			var formData = $(form).serialize()
			
			// show the loading icon
			this.showLoading();
			
			// ajax call to submit the given form and then render the results in the content area
			var viewRef = this;
			
			$.ajax({
					type: "POST",
					xhrFields: {
						withCredentials: true
					},
					url: this.ldapwebUrl,
					data: formData,
					success: function(data, textStatus, jqXHR) {
						viewRef.$el.hide();
						
						viewRef.$el.html(viewRef.containerTemplate);
						var contentArea = viewRef.$("#DynamicContent");
						contentArea.html(data);
						
						viewRef.cleanStyles();
						viewRef.$el.fadeIn('slow');
					}
			});
			
			return false;
			
		},
		
		showLoading: function() {
			this.scrollToTop();
			this.$el.html(this.loadingTemplate());
		},
		
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		}
				
	});
	return LdapView;		
});
