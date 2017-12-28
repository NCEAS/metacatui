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
        		"keyup .method-step.new" : "addNewMethodStep",
        		"click .remove" : "removeMethodStep",
        		"mouseover .remove" : "previewRemove",
        		"mouseout .remove"  : "previewRemove"
        	},
        	
        	render: function() {
        		//Save the view and model on the element
        		this.$el.data({
	        			model: this.model,
	        			view: this
	        		})
	        		.attr("data-category", "methods");

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
					.attr('rows', '7')
					.attr('data-attribute', data.category)
					.attr('data-type', data.type)
					.addClass("method-step").addClass(data.classes || "")
					.text(text);

				if (isNew) {
					$(el).addClass('new')
				}

				return el;
			},
        	
        	updateModel: function(e){
        		if(!e) return false;
        		
        		var updatedInput = $(e.target);
        		
        		//Get the attribute that was changed
        		var changedAttr = updatedInput.attr("data-attribute");
        		if(!changedAttr) return false;
        		
				// Get the EMLText type (parent element)
				var textType = updatedInput.attr("data-type");
				if (!textType) return false;

        		//Get the current value
        		var currentValue = this.model.get(changedAttr);

				// Update either the non-Array value or the Array value depending
				// on the current class of the attribute
				if (changedAttr == "methodStepDescription") {
					
					// Get the DOM position so we know which one to update
					var position = this.$(".method-step").index(updatedInput);
					
					// Stop if, for some odd reason, the target isn't found
					if (position === -1) {
						return;
					}

					currentValue[position] = new EMLText({
						text: [updatedInput.val()],
						type: textType
					});

					this.model.set(changedAttr, currentValue);

					// Trigger the change event manually because, without this, the change event
					// never fires. An alternative to this is to clone the Array before mutating
					// so the reference changes but this seemed more performant
					this.model.trigger('change:' + changedAttr); 
				} else {

					this.model.set(changedAttr, new EMLText({
						text: [updatedInput.val()],
						type: textType
					}));
				
				}
				
				//Add this model to the parent EML model when it is valid
				if(this.model.isValid()){
					this.model.get("parentModel").set("methods", this.model);
				}
				
				//Show the remove button
				$(e.target).parents(".step-container").find(".remove").show();
        	},
        	
        	/*
        	 * Add a new method step
        	 */
        	addNewMethodStep: function(){
        		// Add new textareas as needed
        		var newStep = this.$(".method-step.new"),
        			nextStepNum = this.$(".method-step").length + 1,
        			methodStepContainer =  $(document.createElement("div")).addClass("step-container");
        		
        		newStep.removeClass("new");

        		//Put it all together
        		newStep.parent(".step-container")
        				.after(methodStepContainer.append(
        						$(document.createElement("h5"))
        							.append("Step ", $(document.createElement("span")).addClass("step-num").text(nextStepNum)),
			        				this.renderTextArea(null, { 
			        					category: "methodStepDescription", 
										type: "description",
										classes: "new"
			        				}),
			        				$(document.createElement("i")).addClass("icon icon-remove remove hidden")
						));   		
        	},
        	
        	/*
        	 * Remove this method step
        	 */
        	removeMethodStep: function(e){
        		//Get the index of this step
        		var stepEl = $(e.target).parent(".step-container").find(".method-step"),
        			index  = this.$(".method-step").index(stepEl),
        			view   = this;
        		
        		//Remove this step from the model
        		this.model.set("methodStepDescription", _.without(this.model.get("methodStepDescription"), this.model.get("methodStepDescription")[index]));
        	
        		//Remove the step elements from the page
        		stepEl.parent(".step-container").slideUp("fast", function(){
        			this.remove();
        			
            		//Bump down all the step numbers
            		var stepNums = view.$(".step-num");
            		
            		for(var i=index; i < stepNums.length; i++){
            			$(stepNums[i]).text(i+1);
            		}
        		});
    
        	},
        	
        	previewRemove: function(e){
        		$(e.target).parents(".step-container").toggleClass("remove-preview");
        	}
        });
        
        return EMLMethodsView;
    });