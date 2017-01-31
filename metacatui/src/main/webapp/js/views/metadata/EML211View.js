define(['underscore', 'jquery', 'backbone',
        'views/metadata/ScienceMetadataView',
        'models/metadata/eml211/EML211',
        'models/metadata/eml211/EMLText',
        'models/metadata/eml211/EMLTaxonCoverage',
        'text!templates/metadata/eml.html',
        'text!templates/metadata/metadataOverview.html',
		'text!templates/metadata/taxonomicClassification.html'], 
	function(_, $, Backbone, ScienceMetadataView, EML, EMLText, EMLTaxonCoverage, Template, OverviewTemplate, TaxonomicClassificationTemplate){
    
    var EMLView = ScienceMetadataView.extend({
    	
    	type: "EML211",
        
        el: '#metadata-container',
        
        /* Templates */
        
        events: {
        	"change .text"              : "updateText",
        	"change .basic-text"        : "updateBasicText",
        	"change .temporal-coverage" : "updateTemporalCoverage",
        	"change .keywords"          : "updateKeywords",
        	"click .side-nav-item a"    : "scrollToSection"
        },
                
        /* A list of the subviews */
        subviews: [],
        
        template: _.template(Template),
        overviewTemplate: _.template(OverviewTemplate),
        taxonomicClassificationTemplate: _.template(TaxonomicClassificationTemplate),
        
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
	    	
			//When scrolling through the metadata, highlight the side navigation
	    	$(document).scroll(this.highlightTOC);
        },
	    
        /*
         * Renders the Overview section of the page
         */
	    renderOverview: function(){
	    	//Get the overall view mode
	    	var edit = this.edit;
	    	
	    	var view = this;
	    	
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
	    	var keywordset   = this.model.get("keywordset"),
	    		keywordsContainer = $(document.createElement("div")).addClass("row-fluid");
	    	
	    	//Iterate over each keyword and add a text input for the keyword value and a dropdown menu for the thesaurus
	    	_.each(keywordset, function(keyword){
	    		$(overviewEl).find(".keywords")(this.createKeyword(keyword.keyword, keyword.keywordthesaurus));
	    	}, this);
	    	
	    	//Add an empty row for adding a new keyword
	    	$(overviewEl).find(".keywords").append(this.createKeyword());	  
	    		    	
	    	//Alternate Ids
		    var altIdsEls = this.createBasicTextFields("alternateIdentifier", "Add a new alternate identifier");
		    $(overviewEl).find(".altids").append(altIdsEls);
	    	
	    	
	    	//Funding
		    var fundingEl = $(this.createBasicTextFields("funding", "Add a funding number", false)).addClass("ui-autocomplete-container"),
		    	fundingInput = $(fundingEl).find("input").attr("id", "funding-visible"),
		    	hiddenFundingInput = fundingInput.clone().attr("type", "hidden").attr("id", "funding"),
		    	loadingSpinner = $(document.createElement("i")).addClass("icon icon-spinner input-icon icon-spin subtle hidden");
		    
		    $(overviewEl).find(".funding").empty().append(fundingEl, loadingSpinner, hiddenFundingInput);
		    
		    //Setup the autocomplete widget for the funding input
			$(fundingInput).hoverAutocomplete({
				source: function(request, response){
					var beforeRequest = function(){
						loadingSpinner.show();
					}
					
					var afterRequest = function(){
						loadingSpinner.hide().css("top", "30px");
					}
					
					return MetacatUI.appLookupModel.getGrantAutocomplete(request, response, beforeRequest, afterRequest)
				},
				select: function(e, ui) {
					e.preventDefault();
										
					//view.addAward({ title: ui.item.label, id: ui.item.value });
					hiddenFundingInput.val(ui.item.value);
					fundingInput.val(ui.item.label);
					
					$(".funding .ui-helper-hidden-accessible").hide();
					loadingSpinner.css("top", "5px");
					
				},
				position: {
					my: "left top",
					at: "left bottom",
					of: "#funding-visible",
					collision: "fit"
				},
				appendTo: this.$(".funding"),
				minLength: 3
			});
			
			//Initialize all the tooltips
			this.$(".tooltip-this").tooltip({
				position:{
					my: "center bottom",
					at: "left top"
				}
			});

	    },
	    
	    /*
         * Renders the People section of the page
         */
	    renderPeople: function(){
	    	this.$(".section.people").empty().append("<h2>People</h2>");
	    },
	    
	    /*
         * Renders the Dates section of the page
         */
	    renderDates: function(){
	    	this.$(".section.dates").empty().append("<h2>Dates</h2>");
	    	
	    	// TODO: Another hack... this just gets the first ele
            var temporal = this.model.get('temporalCoverage')[0];

            var beginDate = temporal ? temporal.get('beginDate') : null;
            var beginEl = this.createEMLSingleDateTime(beginDate);

            $(beginEl).data({
                model: temporal
            })
                .attr('data-category', 'beginDate');

            var endDate = temporal ? temporal.get("endDate") : null;
            var endEl = this.createEMLSingleDateTime(endDate);

            $(endEl).data({
                model: temporal
            })
                .attr('data-category', 'endDate');

            var beginContainerEl = $('<div class="span6"></div>').append("<h5>Begin</h5>", beginEl),
            	endContainerEl   = $('<div class="span6"></div>').append("<h5>End</h5>", endEl),
            	rowEl            = $('<div class="row-fluid"></div>').append(beginContainerEl, endContainerEl);

            this.$(".section.dates").append(rowEl);
	    },
	    
	    /*
         * Renders the Locations section of the page
         */
	    renderLocations: function(){
	    	this.$(".section.locations").empty().append("<h2>Locations</h2>");
	    },
	    
	    /*
         * Renders the Taxa section of the page
         */
	    renderTaxa: function(){
	    	this.$(".section.taxa").empty().append("<h2>Taxa</h2>");

			var taxonomy = this.model.get('taxonCoverage');
			
			// Render forms for existing classifications
			if (typeof taxonomy !== "undefined" && (Array.isArray(taxonomy) && taxonomy.length)) {
				var classifications = taxonomy[0].get('taxonomicClassification');

				for (var i = 0; i < classifications.length; i++) {
					console.log(classifications[i]);
					this.$(".section.taxa").append(this.createTaxaonomicClassification(classifications[i]));
				}
			}

			this.$(".section.taxa").append(this.createTaxaonomicClassification());
	    },

		createTaxaonomicClassification: function(classification) {
			// Set aside a variable to accumulate DOM nodes
            var finishedEl = $('<div class="row-fluid"></div>');

			// If the text should be editable, use form inputs
            if (this.edit) {
				// Fill in fields if they are empty
				if (typeof classification === "undefined") {
					classification = {};
				}

				if (!classification.taxonRankName) {
					classification.taxonRankName = '';
				}
				
				if (!classification.taxonRankValue) {
					classification.taxonRankValue = '';
				}

				if (!classification.commonName) {
					classification.commonName = '';
				}
				
				taxonEl = this.taxonomicClassificationTemplate(classification);
				
				$(taxonEl)
					.data({ model: classification })
					.attr('data-category', 'taxonomicClassification');

				$(finishedEl).append(taxonEl);
			} else {
				// TODO: This needs a ton of work but it does render the basics (badly)
				if (classification) {
					if (classification.taxonRankName) {
						$(finishedEl).append($("<div><label>Rank Name</label> " + classification.taxonRankName + "</div>"));
					}

					if (classification.taxonRankValue) {
						$(finishedEl).append($("<div><label>Rank Value</label> " + classification.taxonRankValue + "</div>"));
					}
				}
			}

			return finishedEl;
		},
	    
	    /*
         * Renders the Methods section of the page
         */
	    renderMethods: function(){
	    	this.$(".section.methods").empty().append("<h2>Methods</h2>");
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
	    
	    createKeyword: function(keyword, thesaurus){
	    	if(!keyword) var keyword = "", thesaurus = "None";
	    	
	    	var row          = $(document.createElement("div")).addClass("row-fluid keyword-row"),
	    		keywordInput = $(document.createElement("input")).attr("type", "text").addClass("keyword span10").val(keyword),
    			thesInput    = $(document.createElement("select")).addClass("thesaurus span2").append(
			    				$(document.createElement("option")).val("none").text("None")).append(
			    				$(document.createElement("option")).val("GCMD").text("GCMD"));
	    	
	    	if(thesaurus && thesaurus.indexOf("GCMD") > -1)
    			thesInput.val("GCMD");
	    	
	    	if(!keyword) 
	    		keywordInput.addClass("new").attr("placeholder", "Add a new keyword");
	    	
	    	return row.append(keywordInput, thesInput);
	    },
	    
	    updateKeywords: function(e){
	    	if(!e) return;
	    	
	    	var row        = $(e.target).parent(".keyword-row"),
	    		keyword    = row.find("input").val(),
	    		thesaurus  = row.find("select").val(),
	    		rowNum     = this.$(".keywords .keyword-row").index(row);
	    	
	    	this.model.updateKeywords(keyword, thesaurus, rowNum);
	    	
	    	//Add a new row when the user has added a new keyword just now
	    	if(row.find(".new").length){
	    		row.find(".new").removeClass("new");
	    		this.$(".keywords").append(this.createKeyword());
	    	}
	    },
	    
	    /*
	     * Creates and returns an array of basic text input field for editing
	     */
	    createBasicTextFields: function(category, placeholder, appendNew){
	    	
	    	var textContainer = $(document.createElement("div")).addClass("text-container"),
	    		modelValues = this.model.get(category);
	    	
	    	if(typeof appendNew == "undefined")
	    		var appendNew = true;
	    	
	    	//Format as an array
	    	if(!Array.isArray(modelValues) && modelValues) modelValues = [modelValues];
	    	
	    	//For each value in this category, create an HTML element with the value inserted
	    	_.each(modelValues, function(value, i, allModelValues){
		    	if(this.edit){
		    		var input = $(document.createElement("input"))
				    			.attr("type", "text")
				    			.attr("data-category", category)
				    			.addClass("basic-text");
			    	
		    		textContainer.append(input.clone().val(value));
		    		
		    		//At the end, append an empty input for the user to add a new one
		    		if(i+1 == allModelValues.length && appendNew)
		    			textContainer.append(input.clone().addClass("new").attr("placeholder", placeholder || "Add a new " + category));
		    		
		    	}
		    	else{
		    		textContainer.append($(document.createElement("div"))
			    			.attr("data-category", category)
			    			.text(value));
		    	}
	    	}, this);
	    	
	    	if((!modelValues || !modelValues.length) && this.edit){
	    		var input = $(document.createElement("input"))
			    			.attr("type", "text")
			    			.attr("data-category", category)
			    			.addClass("basic-text new")
			    			.attr("placeholder", placeholder || "Add a new " + category);
	    		textContainer.append(input);
	    	}
	    	
	    	return textContainer;
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
        createEMLSingleDateTime: function (datetimeModel) {
            // Set aside a variable to accumulate DOM nodes
            var finishedEl;

            // If the text should be editable, use form inputs
            if (this.edit) {
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
	    
	    
	    updateBasicText: function(e){
	    	if(!e) return false;
	    	
	    	//Get the category, new value, and model
	    	var category = $(e.target).attr("data-category"),
	    		value    = $(e.target).val().trim(),
	    		model    = $(e.target).data("model") || this.model;
	    	
	    	//We can't update anything without a category
	    	if(!category) return false;
	    	
	    	//Get the current value
	    	var currentValue = model.get(category);
	    	
	    	//Insert the new value into the array
	    	if(Array.isArray(currentValue)){
	    		//Find the position this text input is in
	    		var position = $(e.target).parent().children(".basic-text").index(e.target);
	    		currentValue[position] = value;
	    		model.trigger("change");
	    	}
	    	//Update the model if the current value is a string
	    	else if(typeof currentValue == "string"){
	    		model.set(category, [currentValue, value]);
	    		model.trigger("change");
	    	}
	    	else if(!currentValue)
	    		model.set(category, [value]);
	    	
	    	if($(e.target).is(".new")){
	    		//Add another blank text input
		    	$(e.target).after($(document.createElement("input"))
									.attr("type", "text")
									.attr("data-category", category)
									.addClass("new basic-text"));
		    	
		    	//Remove the new class
		    	$(e.target).removeClass("new");
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

		// TODO: Finish this function
		// TODO: Link this function into the DOM
		updateTaxonCoverage: function(e) {
			if (!e) return false;
			
		},
        
        /*
         * When a user clicks on the section names in the side tabs, jump to the section
         */
        scrollToSection: function(e){
        	if(!e) return false;
        	
        	//Stop navigation
        	e.preventDefault();
        	
        	var section = $(e.target).attr("data-section"),
        		sectionEl = this.$(".section." + section);
        	
        	if(!sectionEl) return false;
        	
        	//Temporarily unbind the scroll listener while we scroll to the clicked section
        	$(document).unbind("scroll");
        	
        	var highlightTOC = this.highlightTOC;
        	setTimeout(function(){ 
        		$(document).scroll(highlightTOC);
        	}, 1500);
        	
        	//Scroll to the section
        	if(sectionEl == section[0])
        		MetacatUI.appView.scrollToTop();
        	else
        		MetacatUI.appView.scrollTo(sectionEl, $("#Navbar").outerHeight());
        	
        	//Remove the active class from all the menu items
        	$(".side-nav-item a.active").removeClass("active");
        	//Set the clicked item to active
        	$(".side-nav [data-section='" + section + "']").addClass("active");
        },
        
        /*
         * Highlight the given menu item.
         * The first argument is either an event object or the section name
         */
        highlightTOC: function(section){
        	
        	//Check if we have scrolled past the data package table, so the table of contents is heightened
        	if($("#data-package-container").offset().top + $("#data-package-container").height() <= $(document).scrollTop() + $("#Navbar").outerHeight())
        		$(".metadata-toc").css("top", $("#Navbar").outerHeight());
        	else
        		$(".metadata-toc").css("top", "auto");
        	
        	//Remove the active class from all the menu items
        	$(".side-nav-item a.active").removeClass("active");
        	
        	if(typeof section == "string"){
            	$(".side-nav [data-section='" + section + "']").addClass("active");
            	return;
        	}
        	else{
        		//Get the section
        		var top = $(window).scrollTop() + $("#Navbar").outerHeight(),
        			sections = $(".metadata-container .section");
        		
        		//If we are at the bottom, highlight the last section
        		if(sections.last().offset().top < top){
        			$(".side-nav-item a").last().addClass("active");
        			return;
        		}
        		//If we're at the top, highlight the top section
        		else if( top < sections.first().offset().top + sections.first().outerHeight()){
        			$(".side-nav-item a").first().addClass("active");
        			return;
        		}
        		//If we're somewhere in the middle, find the right section
        		else{
        			
        			for(var i=1; i < sections.length-1; i++){
        				if( top > $(sections[i]).offset().top && top < $(sections[i+1]).offset().top ){
        					$($(".side-nav-item a")[i]).addClass("active");
        					break;
        				}
        			}

        		}
        	}        	        	
        },
        
        /* Close the view and its sub views */
        onClose: function() {
            this.remove(); // remove for the DOM, stop listening           
            this.off();    // remove callbacks, prevent zombies
            
            //Remove the scroll event listeners
            $(document).unbind("scroll");
            
            this.model = null;
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
    });
    return EMLView;
});