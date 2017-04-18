/* global define */
define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EMLMethods', 
        'text!templates/metadata/EMLMethods.html'], 
    function(_, $, Backbone, EMLMethods, EMLMethodsTemplate){
        
        /* 
            The EMLMethods renders the content of an EMLMethods model
        */
        var EMLMethodsView = Backbone.View.extend({
        	
        	type: "EMLMethodsView",
        	
        	tagName: "div",
        	
        	className: "row-fluid eml-methods",
        	
        	editTemplate: _.template(EMLMethodsTemplate),
        	
        	initialize: function(options){
				options = options || {};
        		
        		this.isNew = options.isNew || (options.model? false : true);
        		this.model = options.model || new EMLMethods();
        		this.edit  = options.edit  || false;
        		
        		this.$el.data({ model: this.model });
        	},
        	
        	events: {
        		"change" : "updateModel",
        	},
        	
        	render: function() {
        		//Save the view and model on the element
        		this.$el.data({
        			model: this.model,
        			view: this
        		});

				if (this.edit) {
					var methodSteps = _.map(this.model.get('methodSteps'), function(textModel) {
						return this.renderMethodsStep(textModel);
					}, this);

					var samplingDescriptions = _.map(this.model.get('samplingDescriptions'), function(textModel) {
						return this.renderSamplingDescrptions(textModel);
					}, this);

					this.$el.append("<h4>Methods</h4>");
					this.$el.append(methodSteps);
					this.$el.append("<h4>Sampling</h4>");
					this.$el.append(samplingDescriptions);
				}

        		return this;
        	},

			renderMethodsStep: function(textModel) {
				return $("<textarea rows='10'></textarea>").
					text(textModel.get('text').join('\n'));

			},

			renderSamplingDescrptions: function(textModel) {
				return $("<textarea rows='10'></textarea>").text(textModel.get('text').join('\n'));
			},
        	
        	updateModel: function(e){
        		if(!e) return false;
        		
        		//Get the attribute that was changed
        		var changedAttr = $(e.target).attr("data-attribute");
        		if(!changedAttr) return false;
        		
        		//Get the current value
        		var currentValue = this.model.get(changedAttr);
        	},
        });
        
        return EMLMethodsView;
    });