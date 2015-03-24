/*global define */
define(['jquery', 'underscore', 'backbone', 'moment', 'text!templates/resultsItem.html'], 				
	function($, _, Backbone, moment, ResultItemTemplate) {
	
	'use strict';

	// SearchResult View
	// --------------

	// The DOM element for a SearchResult item...
	var SearchResultView = Backbone.View.extend({
		tagName:  'div',
		className: 'row-fluid result-row pointer',

		// Cache the template function for a single item.
		//template: _.template($('#result-template').html()),
		template: _.template(ResultItemTemplate),

		// The DOM events specific to an item.
		events: {
			'click .result-selection' : 'toggleSelected',
			'click'                   : "routeToMetadata"
			//'dblclick label': 'edit',
			//'click .destroy': 'clear',
			//'keypress .edit': 'updateOnEnter',
			//'blur .edit': 'close'
		},

		// The SearchResultView listens for changes to its model, re-rendering. Since there's
		// a one-to-one correspondence between a **SolrResult** and a **SearchResultView** in this
		// app, we set a direct reference on the model for convenience.
		initialize: function () {
			this.listenTo(this.model, 'change', this.render);
			this.listenTo(this.model, 'reset', this.render);
			//this.listenTo(this.model, 'destroy', this.remove);
			//this.listenTo(this.model, 'visible', this.toggleVisible);
		},

		// Re-render the citation of the result item.
		render: function () {
			var json = this.model.toJSON();
			
			this.pid = this.model.get("id");
			
			var ri = this.template(json);
			this.$el.html(ri);
			//this.$el.toggleClass('selected', this.model.get('selected'));
			//this.toggleVisible();
			//this.$input = this.$('.edit');
			return this;
		},

		// Toggle the `"selected"` state of the model.
		toggleSelected: function () {
			this.model.toggle();
		},
		
		routeToMetadata: function(e){
			
			//If the user clicked on the download button or any element with the class 'stop-route', we don't want to navigate to the metadata
			if ($(e.target).hasClass('stop-route') || (typeof this.pid === "undefined") || !this.pid)
				return;
			
			uiRouter.navigate('view/'+this.pid, true);
		},

		// Remove the item, destroy the model from *localStorage* and delete its view.
		clear: function () {
			this.model.destroy();
		}
	});
	return SearchResultView;
});
