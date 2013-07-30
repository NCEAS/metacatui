/*global define */
define(['jquery', 'underscore', 'backbone', 'bootstrap'], 				
	function($, _, Backbone, BootStrap) {
	'use strict';
	
	// Build the main header view of the application
	var LdapView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
		
		containerTemplate: '<article><div class="container"><div class="row-fluid"><div id="DynamicContent" class="text-left"></div></div></div></article>',
				
		ldapwebUrl: null,
		
		ldapwebQueryString:  "?cfg=metacatui",

		initialize: function () {
			
		},
				
		render: function () {
			
			// look up the url from the main application model
			this.ldapwebUrl = appModel.get('ldapwebServiceUrl');
			
			// request a smaller header
			appModel.set('headerType', 'default');
			appModel.set('navbarPosition', 'fixed');		
			
			console.log('Calling the ldapweb to display');
			console.log('Calling the ldapweb URL: ' + this.ldapwebUrl);
			// show the progress bar
			this.showProgressBar();
			
			// load all the ldapweb content so all the js can run in what gets loaded
			var viewRef = this;
			this.$el.html(viewRef.containerTemplate);
			var contentArea = this.$("#DynamicContent");
			contentArea.load(
					this.ldapwebUrl + this.ldapwebQueryString,
					function() {
						viewRef.cleanStyles();
						viewRef.$el.hide();
						viewRef.$el.fadeIn('slow');
					});
			
			return this;
		},
		
		cleanStyles: function() {
			// modify the classes to enhance the l+f without changing the ldapweb.cgi source
			this.$(".label").removeClass("label");
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
			
			// get the form data before replacing everything with the progressbar!
			var formData = $(form).serialize()
			
			// show the progress bar
			this.showProgressBar();
			
			// ajax call to submit the given form and then render the results in the content area
			var viewRef = this;
			
			$.post(
					this.ldapwebUrl,
					formData,
					function(data, textStatus, jqXHR) {
						viewRef.$el.hide();
						
						viewRef.$el.html(viewRef.containerTemplate);
						var contentArea = viewRef.$("#DynamicContent");
						contentArea.html(data);
						
						viewRef.cleanStyles();
						viewRef.$el.fadeIn('slow');
					}
			);
			
			return false;
			
		},
		
		showProgressBar: function() {
			this.scrollToTop();
			this.$el.html('<section id="Notification"><div class="progress progress-striped active"><div class="bar" style="width: 100%"></div></div></section>');
		},
		
		scrollToTop: function() {
			$("html, body").animate({ scrollTop: 0 }, "slow");
			return false;
		}
				
	});
	return LdapView;		
});
