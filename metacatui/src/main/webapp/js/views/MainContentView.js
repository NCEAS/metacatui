/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/mainContent.html'], 				
	function($, _, Backbone, MainContentTemplate) {
	'use strict';
	
	// Build the main content view of the application
	var MainContentView = Backbone.View.extend({

		el: '#mainContent',
		
		tagName: 'section',
		
		template: _.template(MainContentTemplate),
		
		initialize: function () {
		},
		
		events: {
			'click #search_btn_main': 'triggerSearch',
			'keypress #search_txt_main': 'triggerOnEnter',
		},
				
		render: function () {
			console.log('Rendering the main content section');
			
			this.$el.html(this.template());
			
			return this;
		},	
		
		triggerSearch: function() {
			// alert the model that a search should be performed
			var searchTerm = $("#search_txt_main").val();		
			appModel.set('searchTerm', searchTerm);
		},
		
		triggerOnEnter: function(e) {
			if (e.keyCode != 13) return;
			this.triggerSearch();
		}
			
				
	});
	return MainContentView;		
});
