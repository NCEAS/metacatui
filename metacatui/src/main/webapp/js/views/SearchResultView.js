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
			'click .result-selection': 'toggleSelected'
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
			//Convert the model to JSON and create the result row from the template
			var json = this.model.toJSON();
			json.hasProv = this.model.hasProvTrace();
			var resultRow = this.template(json);
			this.$el.html(resultRow);
						
			//Save the id in the DOM for later use
			var id = json.id;
			this.$el.attr("data-id", id);
			
				//If this object has a provenance trace, we want to display information about it
				if(json.hasProv || appModel.provDev){
					
					//Get the sources and derivations of this dataset
					var sources = this.model.getSources(),
						derivations = this.model.getDerivations();
					
					if(appModel.provDev){
						 sources = new Array(new SolrResult({
								pubDate: "2015-06-30T00:00:00Z",
								id: "https://pasta.lternet.edu/package/metadata/eml/ecotrends/5804/2",
								title: "Florida Coastal Everglades site, station Taylor Slough Trexler Site CPC, study of animal abundance of Elassoma evergladei in units of numberPerEffort on a yearly timescale",
								origin: ["Joel Trexler", "Florida Coastal Everglades", "EcoTrends Project"],
								formatType: "METADATA"
							}));
						 derivations = new Array(new SolrResult({
								pubDate: "2015-01-01T08:00:00Z",
								id: "https://pasta.lternet.edu/package/metadata/eml/ecotrends/4470/2",
								title: "Coweeta site, station Watershed 27 flume, study of mean daily streamflow in units of litersPerSecond on a yearly timescale",
								origin: ["Coweeta", "Climate and Hydrology Database Projects (CLIMDB/HYDRODB)", "EcoTrends Project"],
								formatType: "METADATA"
							}));	
					}
					
					var numSources = sources.length,
						numDerivations = derivations.length,
						multiple = false;
					if(numSources + numDerivations > 1) multiple = true;
					if(appModel.provDev) multiple = true;
					
					//Create the title of the popover
					var title = "This dataset";
					if(numSources > 0) title += " was created using " + numSources + " source";
					if(numSources > 1) title += "s";
					if(numSources > 0 && numDerivations > 0) title += " and";
					if(numDerivations > 0) title += " has been used by " + numDerivations + " other dataset";
					if(numDerivations > 1) title += "s";
					title += ".";
					
					//Create the citation						
					var citations = $(document.createElement("div")).addClass("citation-container");
					if(multiple) $(citations).addClass("multiple");
					_.each(sources, function(source, i){
						$(citations).append(new CitationView({model: source}).render().el);						
					});
					_.each(derivations, function(derivation, i){
						$(citations).append(new CitationView({model: derivation}).render().el);						
					});
					
					//Add a more link to view the full provenance details
					var moreLink = $(document.createElement("a")).text("More").attr("href", "#view/" + encodeURIComponent(id));
					var moreIcon = $(document.createElement("i")).addClass("icon-chevron-right");
					$(moreLink).append(moreIcon);
					$(citations).append(moreLink);
					
					//Make a popover
					this.$el.find(".provenance.active").attr("tabIndex", 99);
					this.$el.find(".provenance.active").popover({
						html: true,
						placement: "top",
						trigger: "focus",
						container: this.el,
						title: title,
						content: citations
					});
				}
			
			return this;
		},

		// Toggle the `"selected"` state of the model.
		toggleSelected: function () {
			this.model.toggle();
		},

		// Remove the item, destroy the model from *localStorage* and delete its view.
		clear: function () {
			this.model.destroy();
		}
	});
	return SearchResultView;
});
