/* global define */
define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EMLMethods', 'models/metadata/eml211/EMLText', 
        'text!templates/metadata/EMLMethods.html'], 
    function(_, $, Backbone, EMLMethods, EMLText, EMLMethodsTemplate){
        
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
					var methodSteps = _.map(this.model.get('methodStep'), function(textModel) {
						return this.renderTextArea(textModel, 'methodStep');
					}, this);

					var samplingDescriptions = _.map(this.model.get('samplingDescription'), function(textModel) {
						return this.renderTextArea(textModel, 'sampling');
					}, this);

					this.$el.html(this.editTemplate());

					var methodsDiv = this.$el.find("div.row-fluid.methodStep");

					if (methodsDiv.length > 0) {
						$(methodsDiv[0]).append(methodSteps);
						$(methodsDiv[0]).append(this.renderTextArea(null, 'methodStep'));
					}

					var samplingDiv = this.$el.find("div.row-fluid.sampling");

					if (samplingDiv.length > 0) {
						$(samplingDiv[0]).append(samplingDescriptions);
						$(samplingDiv[0]).append(this.renderTextArea(null, 'sampling'));
					}
				}

        		return this;
        	},

			renderTextArea: function(textModel, category) {
				if (typeof category === 'undefined') return;

				var text,
				    isNew;
				
				if (!textModel || typeof textModel === 'undefined') {
					text = '';
					isNew = true;
				} else {
					text = textModel.get('text').join('\n\n');
					isNew = false;
				}

				var el = $(document.createElement('textarea')).
					attr('rows', 10).
					attr('data-attribute', category).
					addClass('methods').
					text(text);

				if (isNew) {
					$(el).addClass('new')
				}

				return el;
			},
        	
        	updateModel: function(e){
        		if(!e) return false;
        		
        		//Get the attribute that was changed
        		var changedAttr = $(e.target).attr("data-attribute");
        		if(!changedAttr) return false;
        		
        		//Get the current value
        		var currentValue = this.model.get(changedAttr);

				// Get the DOM position so we know which one to update
				var position = $(e.target).parent().children('textarea.methods').index($(e.target));

				// Stop if, for some odd reason, the target isn't found
				if (position === -1) {
					return;
				}

				currentValue[position] = new EMLText({text: $(e.target).val() });
				this.model.set(changedAttr, currentValue);

				// Add new textareas as needed
				if ($(e.target).hasClass('new')) {
					$(e.target).removeClass('new');
					$(e.target).after($(this.renderTextArea(null, changedAttr)));
				}
        	},
        });
        
        return EMLMethodsView;
    });