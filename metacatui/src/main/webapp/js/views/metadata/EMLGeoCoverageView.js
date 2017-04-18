/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/metadata/eml211/EMLGeoCoverage', 
        'text!templates/metadata/EMLGeoCoverage.html'], 
    function(_, $, Backbone, EMLGeoCoverage, EMLGeoCoverageTemplate){
        
        /* 
            The EMLGeoCoverage renders the content of an EMLGeoCoverage model
        */
        var EMLGeoCoverageView = Backbone.View.extend({
        	
        	type: "EMLGeoCoverageView",
        	
        	tagName: "div",
        	
        	className: "row-fluid eml-geocoverage",
        	
        	editTemplate: _.template(EMLGeoCoverageTemplate),
        	
        	initialize: function(options){
        		if(!options)
        			var options = {};
        		
        		this.isNew = options.isNew || (options.model? false : true);
        		this.model = options.model || new EMLGeoCoverage();
        		this.edit  = options.edit  || false;
        		
        	},
        	
        	events: {
        		"change"   : "updateModel"
        	},
        	
        	render: function(e) {
        		//Save the view and model on the element
        		this.$el.data({
        			model: this.model,
        			view: this
        		});
        		
        		this.$el.html(this.editTemplate({
        			edit: this.edit,
        			model: this.model.toJSON()
        		}));
        		
        		if(this.isNew){
        			this.$el.addClass("new");
        		}
        		
        		return this;
        	},
        	
        	/*
        	 * Updates the model 
        	 */
        	updateModel: function(e){
        		if(!e) return false;
        		
        		e.preventDefault();
        		
        		//Get the attribute and value
        		var element = $(e.target),
        			value = element.val(),
        			attribute = element.attr("data-attribute");
        		
        		//Get the attribute that was changed
        		if(!attribute) return false;
        		
        		this.model.set(attribute, value);
        	},
        	
        	/*
        	 * Unmarks this view as new
        	 */
        	notNew: function(){
        		this.$el.removeClass("new");
        	}
        });
        
        return EMLGeoCoverageView;
    });