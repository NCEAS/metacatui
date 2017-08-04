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
			this.selectMode    = options.selectMode    || "multiple";
			this.packageModel  = options.packageModel  || null
			this.displayRows   = options.displayRows   || 0;
		},
		
		tagName: "div",
		
		className: "prov-entity-select",
		
		template: _.template(provEntitySelectTemplate),
		
		events: {
		},
		
		render: function(){
			var members = this.packageModel.get("members")
			console.log("i'm rendering!");
			// Reset the rendered view
			this.$el.html('');
			
			if(!members) return false;
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
			console.log("read selected");
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