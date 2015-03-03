/*global define */
define(['jquery', 'underscore', 'backbone', 'moment', 'models/SolrResult', 'views/CitationView', 'text!templates/resultsItem.html'], 				
	function($, _, Backbone, moment, SolrResult, CitationView, ResultItemTemplate) {
	
	'use strict';

	// SearchResult View
	// --------------

	// The DOM element for a SearchResult item...
	var SearchResultView = Backbone.View.extend({
		tagName:  'div',
		className: 'row-fluid view-link result-row pointer',

		// Cache the template function for a single item.
		//template: _.template($('#result-template').html()),
		template: _.template(ResultItemTemplate),

		// The DOM events specific to an item.
		events: {
			'click .result-selection' : 'toggleSelected',
			'click'                   : 'routeToMetadata'
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
			//Convert the model to JSON and create the result row from the template
			var json = this.model.toJSON();
			json.hasProv = this.model.hasProvTrace();
			var resultRow = this.template(json);
			this.$el.append(resultRow);
			
			//Create the citation
			var citation = new CitationView({metadata: this.model}).render().el;
			var placeholder = this.$(".citation");
			if(placeholder.length < 1) this.$el.append(citation);
			else $(placeholder).replaceWith(citation);
						
			//Save the id in the DOM for later use
			var id = json.id;
			this.$el.attr("data-id", id);
			
				//If this object has a provenance trace, we want to display information about it
				if(json.hasProv || appModel.provDev){
					
					var numSources = this.model.get("prov_hasSources"),
						numDerivations = this.model.get("prov_hasDerivations");
					
					if(appModel.provDev){
						numSources = 2;
						numDerivations = 2;
					}
					
					//Create the title of the popover
					var title = "This dataset";
					if(numSources > 0) title += " was created using " + numSources + " source";
					if(numSources > 1) title += "s";
					if(numSources > 0 && numDerivations > 0) title += " and";
					if(numDerivations > 0) title += " has been used by " + numDerivations + " other dataset";
					if(numDerivations > 1) title += "s";
					title += ".";
					
					//Make a tooltip with basic info for mouseover
					this.$el.find(".provenance.active").tooltip({
						placement: "top",
						trigger: "hover",
						container: this.el,
						title: title
					});
				}
			
			return this;
		},

		// Toggle the `"selected"` state of the model.
		toggleSelected: function () {
			this.model.toggle();
		},
		
		routeToMetadata: function(e){			
			//If the user clicked on a download button or any element with the class 'stop-route', we don't want to navigate to the metadata
			if ($(e.target).hasClass('stop-route')){
				return;
			}
			
			var id = this.model.get("id");
			
			uiRouter.navigate('view/'+id, true);
		},

		// Remove the item, destroy the model from *localStorage* and delete its view.
		clear: function () {
			this.model.destroy();
		},
		
		onClose: function(){
			this.clear();
		}
	});
	return SearchResultView;
});
