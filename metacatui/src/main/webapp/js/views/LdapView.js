/*global define */
define(['jquery', 'underscore', 'backbone', 'bootstrap'], 				
	function($, _, Backbone, BootStrap) {
	'use strict';
	
	// Build the main header view of the application
	var LdapView = Backbone.View.extend({

		el: '#Content',
		
		template: null,
				
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
			this.$el.load(
					this.ldapwebUrl + this.ldapwebQueryString,
					function() {
						viewRef.$el.hide();
						viewRef.$el.fadeIn('slow');
					});
			
			return this;
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
			var contentArea = this.$el;
			$.post(
					this.ldapwebUrl,
					formData,
					function(data, textStatus, jqXHR) {
						contentArea.html(data);
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
