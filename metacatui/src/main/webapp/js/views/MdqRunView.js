/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/mdqRun.html'], 				
	function($, _, Backbone, MdqRunTemplate) {
	'use strict';
	
	// Build the Footer view of the application
	var MdqRunView = Backbone.View.extend({

		el: '#Content',
				
		events: {
			"click input[type='submit']"	:	"submitForm"
		},
				
		url: "/mdq-webapp/webapi/suites/test-lter-suite.1.1/run",
		
		template: _.template(MdqRunTemplate),
		
		initialize: function () {
			
		},
				
		render: function () {
			this.$el.html(this.template({}));
			
		},
		
		submitForm: function(event) {
			console.log("running MDQ");
				
			var form = $(event.target).parents("form");

			var viewRef = this;
			
			try {
				var formData = new FormData($(form)[0]);
				
				var args = {
						url: this.url,
						cache: false,
						data: formData,
					    contentType: false, //"multipart/form-data",
					    processData: false,
					    type: 'POST',
						success: function(data, textStatus, xhr) {
							viewRef.$el.html(viewRef.template(data));
							//Initialize all popover elements
							$('.popover-this').popover();
						}
				};
				$.ajax(args);
			} catch (error) {
				console.log(error.stack);
			}
			
			
			
			return false;

		}
				
	});
	return MdqRunView;		
});
