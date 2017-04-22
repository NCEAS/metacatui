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
					this.$el.html(this.editTemplate({
						methodStepDescription: _(this.model.get('methodStepDescription')).map(function(step) { return step.toString()} ),
						studyExtentDescription: this.model.get('studyExtentDescription'),
						samplingDescription: this.model.get('samplingDescription')
					}));
				}

        		return this;
        	},

			renderTextArea: function(textModel, data) {
				if (typeof data === 'undefined') return;

				var text,
				    isNew;
				
				if (!textModel || typeof textModel === 'undefined') {
					text = '';
					isNew = true;
				} else {
					text = textModel.get('text').toString();
					isNew = false;
				}

				var el = $(document.createElement('textarea'))
					.attr('rows', data.rows)
					.attr('data-attribute', data.category)
					.attr('data-type', data.type)
					.text(text);

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
        		
				// Get the EMLText type (parent element)
				var textType = $(e.target).attr("data-type");
				if (!textType) return false;

        		//Get the current value
        		var currentValue = this.model.get(changedAttr);

				// Update either the non-Array value or the Array value depending
				// on the current class of the attribute
				if (_.isArray(this.model.get(changedAttr))) {
					// Get the DOM position so we know which one to update
					var position = $(e.target).parent().children('textarea').index($(e.target));

					// Stop if, for some odd reason, the target isn't found
					if (position === -1) {
						return;
					}

					currentValue[position] = new EMLText({
						text: [$(e.target).val()],
						type: textType
					});

					this.model.set(changedAttr, currentValue);

					// Trigger the change event manually because, without this, the change event
					// never fires. An alternative to this is to clone the Array before mutating
					// so the reference changes but this seemed more performant
					this.model.trigger('change:' + changedAttr); 
				} else {
					currentValue = $(e.target).val();
					this.model.set(changedAttr, new EMLText({
						text: [$(e.target).val()],
						type: textType
					}));
				}

				// Add new textareas as needed
				if ($(e.target).hasClass('new')) {
					$(e.target).removeClass('new');
					$(e.target).after($(this.renderTextArea(null, { category: changedAttr, type: textType, rows: $(e.target).attr('rows') })));
				}
        	},
        });
        
        return EMLMethodsView;
    });