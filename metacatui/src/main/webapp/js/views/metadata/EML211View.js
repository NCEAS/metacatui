define(['underscore', 'jquery', 'backbone',
        'views/metadata/ScienceMetadataView',
        'models/metadata/eml211/EML211',
        'models/metadata/eml211/EMLText',
        'models/metadata/eml211/EMLTemporalCoverage',
        'text!templates/eml.html',
        'text!templates/metadataOverview.html'], 
	function(_, $, Backbone, ScienceMetadataView, EML, EMLText, EMLTemporalCoverage, Template, OverviewTemplate){
    
    var EMLView = ScienceMetadataView.extend({
    	
    	type: "EML211",
        
        el: '#metadata-container',
        
        /* Templates */
        
        events: {
        	"change .text" : "updateText",
            "change .temporal-coverage" : "updateTemporalCoverage"
        },
                
        /* A list of the subviews */
        subviews: [],
        
        template: _.template(Template),
        overviewTemplate: _.template(OverviewTemplate),
        
        initialize: function(options) {
            
        	//Set up all the options
        	if(typeof options == "undefined") var options = {};
        	
        	//The EML Model and ID
    		this.model = options.model || new EML();    		
    		if(!this.model.get("id") && options.id) this.model.set("id", options.id);
    		
    		//This is a new EML doc being created
    		if(!this.model.get("id")) console.log("No data set id is specified");
    		
    		//Get the current mode
    		this.edit = options.edit || false;
    		    		
            return this;
        },
        
        /* Render the view */
        render: function() {        
			MetacatUI.appModel.set('headerType', 'default');

			//Render the basic structure of the page and table of contents
			this.$el.html(this.template());
			this.$container = this.$(".metadata-container");
			
			//Render all the EML sections when the model is synced
			this.renderAllSections();
			this.listenTo(this.model, "sync", this.renderAllSections);
	    	
            return this;
        },
        
        renderAllSections: function(){
        	this.renderOverview();
	    	this.renderPeople();
	    	this.renderDates();
	    	this.renderLocations();
	    	this.renderTaxa();
	    	this.renderMethods();
	    	this.renderProject();
	    	this.renderSharing();
        },
	    
        /*
         * Renders the Overview section of the page
         */
	    renderOverview: function(){
	    	//Get the overall view mode
	    	var edit = this.edit;
	    	
	    	//Append the empty layout
	    	var overviewEl = this.$container.find(".overview");
	    	$(overviewEl).html(this.overviewTemplate());
	    	
	    	//Abstract
	    	_.each(this.model.get("abstract"), function(abs){
		    	var abstractEl = this.createEMLText(abs, edit, "abstract");
		    	
		    	//Add the abstract element to the view
		    	$(overviewEl).find(".abstract").append(abstractEl);	    		
	    	}, this);
	    	
	    	if(!this.model.get("abstract").length){
	    		var abstractEl = this.createEMLText(null, edit, "abstract");
	    		
	    		//Add the abstract element to the view
		    	$(overviewEl).find(".abstract").append(abstractEl);	  
	    	}
	    	
	    	//Keywords
	    	var keywords = this.createKeywords(edit);	    	
	    	$(overviewEl).find(".keywords").append(keywords);
	    	
	    	//Alternate Ids
	    	var altIds = this.createAltIds(edit);
	    	$(overviewEl).find(".altids").append(altIds);
	    	
	    	//Usage
	    	var usage = this.createUsage(edit);
	    	$(overviewEl).find(".usage").append(usage);
	    },
	    
	    /*
         * Renders the People section of the page
         */
	    renderPeople: function(){
	    	
	    },
	    
	    /*
         * Renders the Dates section of the page
         */
	    renderDates: function(){
            //Get the overall view mode
            var edit = this.edit;

            var datesEl = this.$container.find(".dates");
            $(datesEl).html(this.createDates());
	    },
	    
	    /*
         * Renders the Locations section of the page
         */
	    renderLocations: function(){
	    	
	    },
	    
	    /*
         * Renders the Taxa section of the page
         */
	    renderTaxa: function(){
	    	
	    },
	    
	    /*
         * Renders the Methods section of the page
         */
	    renderMethods: function(){
	    	
	    },
	    
	    /*
         * Renders the Projcet section of the page
         */
	    renderProject: function(){
	    	
	    },
	    
	    /*
         * Renders the Sharing section of the page
         */
	    renderSharing: function(){
	    	
	    },
	    
	    createKeywords: function(){
	    	//Keywords
	    	var keywords = this.model.get("keywordset"),
	    		keywordInputTemp = $(document.createElement("input")).attr("type", "text").addClass("keyword span10"),
	    		thesInputTemp = $(document.createElement("select")).addClass("thesaurus span2").append(
	    				$(document.createElement("option")).val("none").text("None")).append(
	    				$(document.createElement("option")).val("GCMD").text("GCMD")),
	    		keywordsForm = $(document.createElement("div")).addClass("row-fluid");
	    	
	    	//Iterate over each keyword and add a text input for the keyword value and a dropdown menu for the thesaurus
	    	_.each(keywords, function(keyword){
	    		var keywordInput = $(keywordInputTemp).clone().val(keyword.keyword);
	    		var thesInput = $(thesInputTemp).clone();
	    		
	    		//Get the thesaurus value
	    		if(keyword.keywordthesaurus && keyword.keywordthesaurus.indexOf("GCMD") > -1)
	    			thesInput.val("GCMD");
	    		
	    		keywordsForm.append(keywordInput, thesInput);
	    	});
	    	
	    	keywordsForm.append($(keywordInputTemp).clone().attr("placeholder", "Add a new keyword"), $(thesInputTemp).clone());
	    	
	    	return keywordsForm;
	    },
	    
	    createAltIds: function(){
	    	return "";
	    },
	    
	    createUsage: function(){
	    	return "";
	    },

        // Create the DOM for the Dates section
        createDates: function () {
            var edit = this.edit;

            // TODO: Temporary hack. Replace this with better JS or a template maybe
            var ele = $('<div><h2>Dates</h2></div>');

            // TODO: Another hack... this just gets the first ele
            var temporal = this.model.get('temporalCoverage')[0];


            var beginDate = temporal ? temporal.get('beginDate') : null;
            var beginEl = this.createEMLSingleDateTime(beginDate, edit);

            $(beginEl).data({
                model: temporal
            })
                .attr('data-category', 'beginDate');

            var endDate = temporal ? temporal.get("endDate") : null;
            var endEl = this.createEMLSingleDateTime(endDate, edit);

            $(endEl).data({
                model: temporal
            })
                .attr('data-category', 'endDate');

            ele.append("<h5>Begin</h5>");
            ele.append(beginEl);
            ele.append("<h5>End</h5>");
            ele.append(endEl);

            return ele;
        },
		
	    /*
         * Creates the text elements
         */
	    createEMLText: function(textModel, edit, category){
	    	
	    	if(!textModel && edit){
	    		return $(document.createElement("textarea"))
	    				.attr("data-category", category)
	    				.addClass("xlarge text");
	    	}
	    	else if(!textModel && !edit){
	    		return $(document.createElement("div"))
						.attr("data-category", category);
	    	}

	    	//Get the EMLText from the EML model
	    	var finishedEl;
	    	
	    	//Get the text attribute from the EMLText model
	    	var	paragraphs = textModel.get("text"),
	    		paragraphsString = "";
	    	
	    	//If the text should be editable,
	    	if(edit){	    		
		    	//Format the paragraphs with carriage returns between paragraphs
		    	_.each(paragraphs, function(p){
		    		paragraphsString += p + String.fromCharCode(13);
		    	})
		    		
		    	//Create the textarea element
		    	finishedEl = $(document.createElement("textarea"))
	    						 .addClass("xlarge text")
	    						 .attr("data-category", category)
	    						 .html(paragraphsString);
	    	}
	    	else{
	    		//Format the paragraphs with HTML
		    	_.each(paragraphs, function(p){
		    		paragraphsString += "<p>" + p + "</p>";
		    	});
		    	
		    	//Create a div
		    	finishedEl = $(document.createElement("div"))
		    				.attr("data-category", category)
		    				.append(paragraphsString);
	    	}
	    	
		    $(finishedEl).data({ model: textModel });
	    	
	    	//Return the finished DOM element
	    	return finishedEl;
	    },
	    
        // Create the DOM to represent an EML SingleDateTime
        createEMLSingleDateTime: function (datetimeModel, edit) {
            // Set aside a variable to accumulate DOM nodes
            var finishedEl;

            // If the text should be editable, use form inputs
            if (edit) {
                finishedEl = $(document.createElement("div")).addClass('form-inline');

                var dateEl = $(document.createElement("input"))
                    .attr("type", "date")
                    .addClass("temporal-coverage");

                // Set a value if the model has one
                if (datetimeModel && datetimeModel.calendarDate) {
                    dateEl.attr('value', datetimeModel.calendarDate);
                }

                finishedEl.append("<label>Date</label>");
                finishedEl.append(dateEl);

                var timeEl = $(document.createElement("input"))
                    .attr("type", "time")
                    .addClass("temporal-coverage");

                // Set a value if the model has one
                if (datetimeModel && datetimeModel.time) {
                    timeEl.attr('value', datetimeModel.time);
                }

                finishedEl.append("<label>Time</label>");
                finishedEl.append(timeEl);
            } else {
                // Just show a string representing the datetime, with an 
                // optional time
                var tokens = [];

                if (datetimeModel) {
                    if (datetimeModel.calendarDate) {
                        tokens.push(datetimeModel.calendarDate);
                    }

                    if (datetimeModel.time) {
                        tokens.push(datetimeModel.time);
                    }
                }

                finishedEl = $(document.createElement("div")).append(tokens.join(' '));
            }

            // Return the finished DOM element
            return finishedEl;
        },

	    /*
	     * Updates a basic text field in the EML after the user changes the value
	     */
	    updateText: function(e){
	    	if(!e) return false;
	    	
	    	var category  = $(e.target).attr("data-category"),
	    		textModel = $(e.target).data("model"),
	    		value     = $(e.target).val().trim();

	    	//We can't update anything without a category
	    	if(!category) return false;

	    	//Get the list of paragraphs - checking for carriage returns and line feeds
	    	var paragraphsCR = value.split(String.fromCharCode(13));
	    	var paragraphsLF = value.split(String.fromCharCode(10));
	    	
	    	//Use the paragraph list that has the most
	    	var paragraphs = (paragraphsCR > paragraphsLF)? paragraphsCR : paragraphsLF;
	    	
	    	//If this category isn't set yet, then create a new EMLText model
	    	if(!textModel){
	    		this.model.set(category, 
	    						new EMLText({ text: paragraphs, parentModel: this.model, parentAttribute: category }));
	    		
	    		// Save the new model onto the underlying DOM node
	    		$(e.target).data({ "model" : this.model.get(category) });
	    	}
	    	//Update the existing EMLText model
	    	else{
	    		textModel.set("text", paragraphs);
	    		textModel.trigger("change:text");
	    	}
	    },

        // Update an EMLTemporalCoverage instance
        updateTemporalCoverage: function (e) {
            if (!e) return false;

            // Grab the values we need to update the underlying EMLTemporalCoverage
            // model. Notice that we use the 'data-category' attribute on the parent
            // div to figure out if this is the begin or end date and that use the
            // 'type' attribute on the input element to determine whether this is a
            // calendarDate or a time that's being updated
            var parent = $(e.target).parent(),
                category = parent.attr("data-category"),
                model = parent.data("model"),
                attrib = $(e.target).attr('type'),
                value = $(e.target).val().trim();

            // We can't update anything without a category
            if (!category) return false;

            // Map natural values of 'attrib' to the corresponding attribute on the
            // EMLTemporalCoverage element. Natural values of 'attrib' are from the
            // HTML5 input 'type' attribute: Either 'date' or 'time'. Corresponding
            // attributes on the EMLTemporalCoverage model are from the EML schema
            // and are either 'calendarDate' or 'time'.
            if (attrib == 'date') attrib = 'calendarDate';

            // If this datetime isn't paired with an existing
            // EMLTemporalCoverage instance, create one. Otherwise, mutate
            // the existing one
            if (!model) {
                // Create a new Object for the the attribute on the
                // EMLTemporalCoverage instance in 'attrib' (either
                // beginDate or endDate). Then merge it into the model and
                // merge the EMLTemporalCoverage model into the EML model.
                newval = {};
                newval[attrib] = value;

                model = new EMLTemporalCoverage({
                    parentModel: this.model, 
                    parentAttribute: 'temporalCoverage'
                });

                model.set(category, newval);

                // Add the newly-created model to the array with concat
                this.model.set('temporalCoverage', this.model.get('temporalCoverage').concat(model));

                // Save the new model onto the underlying DOM node
                parent.data({ 'model': model });
            } else {
                // Grab the current value from the model,
                // x = { calendarDate : ..., time: ... }
                // and merge in the new value
                var currentValue = model.get(category);
                currentValue[attrib] = value;

                // Set the merged value
                model.set(category, currentValue);
            }

            // Trigger the tricking up of this change for which part of the 
            // temporal coverage is set by category
            model.trigger("change:" + category);
        },

        /* Close the view and its sub views */
        onClose: function() {
            this.remove(); // remove for the DOM, stop listening           
            this.off();    // remove callbacks, prevent zombies
            
            this.model = null;
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
    });
    return EMLView;
});