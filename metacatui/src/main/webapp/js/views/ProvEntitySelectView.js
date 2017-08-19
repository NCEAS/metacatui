define(['jquery', 'underscore', 'backbone', "text!templates/provEntitySelect.html"],
	function($, _, Backbone, provEntitySelectTemplate) {
	'use strict';

	// Obtain a list of provenance entities from the packageModel and display to the
	// user for selection. The selected package members will be added to the provenance
	// of the package member being edited.
	var ProvEntitySelectView = Backbone.View.extend({
		initialize: function(options){
			if((typeof options === "undefined") || !options) var options = {};
			this.parentView    = options.parentView    || null;		
			this.title 		   = options.title         || "Add provenance";
			this.selectLabel   = options.selectLabel   || "Choose from the files in this dataset";
			this.selectEntityType  = options.selectEntityType || "data";
			this.packageModel  = options.packageModel  || null;
			this.context       = options.context       || null;
			this.displayRows   = options.displayRows   || 0;
			
			(this.selectEntityType == "program") ? this.selectMode = "" : this.selectMode = "multiple";
		},
		
		tagName: "div",
		
		className: "prov-entity-select",
		
		template: _.template(provEntitySelectTemplate),
		
		events: {
		},
		
		render: function(){
			var members = this.packageModel.get("members")
			console.log("rendering selection modal!");
			// Reset the rendered view
			this.$el.html('');
			
			if(!members) return false;
			var view = this;
			// Remove the current package member from the list of prov entities to select
			// (a package member can't be related to itself).
			members = _.filter(members, function(item) {
					return item.get("id") != view.context.get("id");
			});	
			// Don't display metadata in the selection view
			members = _.filter(members, function(item) {
					return item.get("formatType") != "METADATA";
			});	
			
			// Set the number of items to display in the select list
			if(this.displayRows == 0) this.displayRows == Math.min(10, members.length);
			
			return this.$el.html(this.template({
				title         : this.title,
				selectLabel   : this.selectLabel,
				selectMode    : this.selectMode,
				members       : members,
				displayRows   : this.displayRows
			}));
		},
		
		readSelected: function() {
			// First see if a pid value was entered in the text box.
			// If yes then this value will be used instead of the
			// select list.
			console.log("reading selected entities");
			var values = $('#pidValue').val();
			if(typeof values !== undefined && values != "") {
			    console.log("returning text: " + values);
				return values;
			} else {
				values = $('#select-prov-entity').val();
			}
            console.log("pes: selected entities: " + values);
			return values;
		}
	});
	
	return ProvEntitySelectView;
});