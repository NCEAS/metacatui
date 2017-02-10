define(['underscore', 'jquery', 'backbone',
        'views/metadata/ScienceMetadataView',
        'views/metadata/EMLPartyView',
        'models/metadata/eml211/EML211',
        'models/metadata/eml211/EMLKeywordSet',
        'models/metadata/eml211/EMLParty',
        'models/metadata/eml211/EMLProject',
        'models/metadata/eml211/EMLText',
        'models/metadata/eml211/EMLTaxonCoverage',
        'models/metadata/eml211/EMLTemporalCoverage',
        'text!templates/metadata/eml.html',
        'text!templates/metadata/metadataOverview.html',
        'text!templates/metadata/dates.html',
		'text!templates/metadata/taxonomicClassification.html'], 
	function(_, $, Backbone, ScienceMetadataView, EMLPartyView, 
			EML, EMLKeywordSet, EMLParty, EMLProject, EMLText, EMLTaxonCoverage, EMLTemporalCoverage,
			Template, OverviewTemplate, DatesTemplate, TaxonomicClassificationTemplate){
    
    var EMLView = ScienceMetadataView.extend({
    	
    	type: "EML211",
        
        el: '#metadata-container',
        
        /* Templates */
        
        events: {
        	"change .text"              : "updateText",
        	"change .basic-text"        : "updateBasicText",
        	"blur   .temporal-coverage" : "updateTemporalCoverage",
        	"change .keywords"          : "updateKeywords",
        	"change .usage"             : "updateRadioButtons",
        	"change .funding"           : "updateFunding",
        	"click  .side-nav-item a"   : "scrollToSection"
        },
                
        /* A list of the subviews */
        subviews: [],
        
        template: _.template(Template),
        overviewTemplate: _.template(OverviewTemplate),
        datesTemplate: _.template(DatesTemplate),
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
	    	$(overviewEl).html(this.overviewTemplate({
	    		intellRightsOptions : this.model.get("intellRightsOptions"),
	    		intellectualRights  : this.model.get("intellectualRights")
	    	}));
	    	
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
	    	//Iterate over each keyword and add a text input for the keyword value and a dropdown menu for the thesaurus
	    	_.each(this.model.get("keywordSets"), function(keywordSetModel){
	    		_.each(keywordSetModel.get("keywords"), function(keyword){
		    		$(overviewEl).find(".keywords").append(this.createKeyword(keyword, keywordSetModel));	    			
	    		}, this);
	    	}, this);
	    	
	    	//Add an empty row for adding a new keyword
	    	$(overviewEl).find(".keywords").append(this.createKeyword());	  
	    		    	
	    	//Alternate Ids
		    var altIdsEls = this.createBasicTextFields("alternateIdentifier", "Add a new alternate identifier");
		    $(overviewEl).find(".altids").append(altIdsEls);
	    	
	    	//Funding
		    var funding = this.model.get("project") ? this.model.get("project").get("funding") : [];
			   
		    //Clear the funding section
		    $(".section.overview .funding").empty();
		    
		    //Create the funding input elements
		    _.each(funding, function(fundingItem, i){
		    	
		    	$(".section.overview .funding").append(this.createFunding(fundingItem));
		    	 
		    }, this);
		    
		    //Add a blank funding input
		    $(".section.overview .funding").append(this.createFunding());	    
			
			//Initialize all the tooltips
			this.$(".tooltip-this").tooltip();
		    
	    },
	    
	    /*
         * Renders the People section of the page
         */
	    renderPeople: function(){
	    	this.$(".section.people").empty().append("<h2>People</h2>");
	
	    	var PIs        = _.filter(this.model.get("associatedParty"), function(party){ return party.get("role") == "principalInvestigator" }),
	    		coPIs      = _.filter(this.model.get("associatedParty"), function(party){ return party.get("role") == "coPrincipalInvestigator" }),
	    		collbalPIs = _.filter(this.model.get("associatedParty"), function(party){ return party.get("role") == "collaboratingPrincipalInvestigator" }),
	    		custodian  = _.filter(this.model.get("associatedParty"), function(party){ return party.get("role") == "custodianSteward" }),
	    		user       = _.filter(this.model.get("associatedParty"), function(party){ return party.get("role") == "user" });
	    	
	    	//Creators
	    	this.$(".section.people").append("<h4>Dataset Creators (Authors/Owners/Originators)</h4>",
	    			'<div class="row-striped" data-attribute="creator"></div>');	    	
	    	_.each(this.model.get("creator"), this.renderPerson, this);
	    	this.renderPerson(null, "creator");
	    	
	    	//Principal Investigators
	    	this.$(".section.people").append("<h4>Principal Investigators</h4>",
	    			'<div class="row-striped" data-attribute="principalInvestigator"></div>');	    	
	    	_.each(PIs, this.renderPerson, this);
	    	this.renderPerson(null, "principalInvestigator");
	    	
	    	//Co-PIs
	    	this.$(".section.people").append("<h4>Co-Principal Investigators</h4>",
	    			'<div class="row-striped" data-attribute="coPrincipalInvestigator"></div>');
	    	_.each(coPIs, this.renderPerson, this);
	    	this.renderPerson(null, "coPrincipalInvestigator");
	    	
	    	//Collab PIs
	    	this.$(".section.people").append("<h4>Collborating-Principal Investigators</h4>",
	    			'<div class="row-striped" data-attribute="collaboratingPrincipalInvestigator"></div>');
	    	_.each(collbalPIs, this.renderPerson, this);
	    	this.renderPerson(null, "collaboratingPrincipalInvestigator");
	    	
	    	//Contact
	    	this.$(".section.people").append("<h4>Contacts</h4>",
	    			'<div class="row-striped" data-attribute="contact"></div>');
	    	_.each(this.model.get("contact"), this.renderPerson, this);
	    	this.renderPerson(null, "contact");

	    	//Metadata Provider
	    	this.$(".section.people").append("<h4>Metadata Provider</h4>",
	    			'<div class="row-striped" data-attribute="metadataProvider"></div>');
	    	_.each(this.model.get("metadataProvider"), this.renderPerson, this);
	    	this.renderPerson(null, "metadataProvider");
	    	
	    	//Custodian/Steward
	    	this.$(".section.people").append("<h4>Custodian/Steward</h4>",
	    			'<div class="row-striped" data-attribute="custodianSteward"></div>');
	    	_.each(custodian, this.renderPerson, this);
	    	this.renderPerson(null, "custodianSteward");
	    	
	    	//Publisher
	    	this.$(".section.people").append("<h4>Publisher</h4>",
	    			'<div class="row-striped" data-attribute="publisher"></div>');
	    	_.each(this.model.get("publisher"), this.renderPerson, this);
	    	this.renderPerson(null, "publisher");

	    	//User
	    	this.$(".section.people").append("<h4>User</h4>",
	    			'<div class="row-striped" data-attribute="user"></div>');
	    	_.each(user, this.renderPerson, this);
	    	this.renderPerson(null, "user");

    		//Initialize the tooltips
    		this.$("input.tooltip-this").tooltip({
    			placement: "top",
    			title: function(){
    				return $(this).attr("placeholder")
    			},
    			delay: 1000
    		});

	    },
	    
	    renderPerson: function(emlParty, partyType){
	    	//If no model is given, create a new model
	    	if(!emlParty){
	    		var emlParty = new EMLParty({
	    			parentModel: this.model
	    		});
	    		
	    		//Mark this model as new
	    		var isNew = true;
	    		
	    		//Find the party type or role based on the type given
	    		if(_.contains(emlParty.get("roleOptions"), partyType))
	    			emlParty.set("role", partyType);
	    		else if(_.contains(emlParty.get("typeOptions"), partyType))
	    			emlParty.set("type", partyType);
	    		
	    	}
	    	else
	    		var isNew = false;
	    	
	    	//Get the party type, if it was not sent as a parameter
	    	if(!partyType || typeof partyType != "string")
	    		var partyType = emlParty.get("role") || emlParty.get("type");
	    	
	    	var view = new EMLPartyView({
    			model: emlParty,
    			edit: this.edit,
    			isNew: isNew
    		});
    		
	    	//Find the container section for this party type	    	
    		this.$(".section.people").find('[data-attribute="' + partyType + '"]').append(view.render().el);
	    },
	    
	    /*
         * Renders the Dates section of the page
         */
	    renderDates: function(){
	    	
            var temporal = this.model.get('temporalCoverage') || new EMLTemporalCoverage();

            //Update the begin date
            var beginDate = temporal.get('beginDate'),
            	beginTime = temporal.get("beginTime"),
            	endDate   = temporal.get("endDate"),
            	endTime   = temporal.get("endTime"),
            	html      = this.datesTemplate({
			    				beginDate: beginDate,
			    				beginTime: beginTime,
			    				endDate: endDate,
			    				endTime: endTime
    						});
            	
	    	this.$(".section.dates").html(html);
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
					this.$(".section.taxa").append(this.createTaxaonomicClassification(classifications[i]));
				}
			}

			this.$(".section.taxa").append(this.createTaxaonomicClassification());
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
	    
	    createFunding: function(value){
	    	var fundingInput       = $(document.createElement("input"))
	    								.attr("type", "text")
	    								.attr("data-category", "funding")
	    								.addClass("span12")
	    								.attr("placeholder", "Search for NSF awards by keyword or enter custom funding information")
	    								.val(value),
		    	hiddenFundingInput = fundingInput.clone().attr("type", "hidden").val(value).attr("id", "").addClass("hidden"),
		    	loadingSpinner     = $(document.createElement("i")).addClass("icon icon-spinner input-icon icon-spin subtle hidden"); 
	    	
	    	if(!value){
	    		fundingInput.addClass("new");
	    		hiddenFundingInput.addClass("new");
	    	}
	    	
	    	//Append all the elements to a container
	    	var containerEl = $(document.createElement("div"))
	    						.addClass("ui-autocomplete-container funding-row")
	    						.append(fundingInput, loadingSpinner, hiddenFundingInput);
	    	
	    	var view = this;
	    	
		    //Setup the autocomplete widget for the funding input
		    fundingInput.hoverAutocomplete({
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
										
					hiddenFundingInput.val("NSF Award " + ui.item.value);
					fundingInput.val(ui.item.label);
					
					$(".funding .ui-helper-hidden-accessible").hide();
					loadingSpinner.css("top", "5px");
					
					view.updateFunding(e);
					
				},
				position: {
					my: "left top",
					at: "left bottom",
					of: fundingInput,
					collision: "fit"
				},
				appendTo: containerEl,
				minLength: 3
			});
		    
		    return containerEl;
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
	    
	    createKeyword: function(keyword, model){
	    	if(!keyword) var keyword = "";
	    	
	    	if(!model) var model = new EMLKeywordSet({ parentModel: this.model });
	    	
	    	var thesaurus    = model.get("thesaurus"),
	    		row          = $(document.createElement("div")).addClass("row-fluid keyword-row").data({ model: model }),
	    		keywordInput = $(document.createElement("input")).attr("type", "text").addClass("keyword span10").val(keyword),
    			thesInput    = $(document.createElement("select")).addClass("thesaurus span2").append(
			    				$(document.createElement("option")).val("None").text("None")).append(
			    				$(document.createElement("option")).val("GCMD").text("GCMD"));
	    	
	    	if(thesaurus && thesaurus.indexOf("GCMD") > -1)
    			thesInput.val("GCMD");
	    	
	    	if(!keyword) 
	    		keywordInput.addClass("new").attr("placeholder", "Add a new keyword");
	    	
	    	return row.append(keywordInput, thesInput);
	    },
	    
	    /*
	     * Update the funding info when the form is changed
	     */
	    updateFunding: function(e){
	    	if(!e) return;
	    	
	    	var newValue = $(e.target).siblings("input.hidden").val() || $(e.target).val(),
	    		row      = $(e.target).parent(".funding-row").first(),
	    		rowNum   = this.$(".funding-row").index(row);
	    	
	    	//If there is no project model
	    	if(!this.model.get("project")){
	    		var model = new EMLProject({ parentModel: this.model });
	    		this.model.set("project", model);
	    	}
	    	else
	    		var model = this.model.get("project");
	    	
	    	var currentFundingValues = model.get("funding")
	    	currentFundingValues[rowNum] = newValue;
	    	
	    	if($(e.target).is(".new")){
	    		$(e.target).removeClass("new");
	    		row.after(this.createFunding());
	    	}
	    	
	    },
	    
	    //TODO: Comma-seperate keywords
	    updateKeywords: function(e){
	    	if(!e) return;
	    	
	    	var row        = $(e.target).parent(".keyword-row"),
	    		keyword    = row.find("input").val(),
	    		thesaurus  = row.find("select").val(),
	    		model      = row.data("model"),
	    		allKeywords = [];
	    	
	    	if(!keyword) return;

	    	//If the thesaurus has changed or if there is no model
	    	if(!model || (thesaurus != model.get("thesaurus") && model.get("keywords").length > 2)){
	    		
	    		//Remove the keyword from the model that has a changed thesaurus
	    		if(model)
	    			model.set("keywords", _.without(model.get("keywords"), keyword));	    		
	    		
	    		//Create a new EMLKeywordSet model
	    		model = new EMLKeywordSet({ parentModel: this.model });
	    		
	    		//This is the only keyword in the new model
	    		allKeywords = [keyword];
	    		
	    		//Update the keywordSets array in the EML211 model
    			this.model.get("keywordSets").push(model);
    			
    			//Update the model attached to the DOM
    			row.data({ model: model });
    			
	    	}	    	
	    	//If the thesaurus hasn't changed, then find all the keywords that belong in this model
	    	else{
		    	//Get all the keywords in the model
		    	_.each(this.$(".keyword-row"), function(thisRow){
		    		if($(thisRow).data("model") == model){
			    		allKeywords.push($(thisRow).find("input").val());	    			
		    		}
		    	}, this);
		    	
		    	//Make sure this model is set on the EML211 model
		    	if(!_.contains(this.model.get("keywordSets"), model))
		    		this.model.get("keywordSets").push(model);
	    	}
	    	
	    	//Update the model with the new keywords and thesaurus
	    	model.set("keywords",  allKeywords);
	    	model.set("thesaurus", thesaurus);
	    	
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
	    		model.set(category, currentValue);
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
									.attr("placeholder", $(e.target).attr("placeholder"))
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
        	var category     = $(e.target).attr("data-category"),
	        	tempCovModel = this.model.get("temporalCoverage"),
	        	value        = $(e.target).val().trim();

        	// We can't update anything without a category
        	if (!category) return false;

        	// If this datetime isn't paired with an existing
        	// EMLTemporalCoverage instance, create one. Otherwise, mutate
        	// the existing one
        	if (!tempCovModel) {

        		tempCovModel = new EMLTemporalCoverage({
	        		parentModel: this.model
	        	});
	
        		tempCovModel.set(category, value);
	
	        	// Add the newly-created model to the array
	        	this.model.set("temporalCoverage", tempCovModel);

        	} else {
        		//If the value hasn't changed, exit
        		if(value == tempCovModel.get(category))
        			return;
        		
	        	// Set the new value
        		tempCovModel.set(category, value);
        	}

        	// Trigger the tricking up of this change for which part of the
        	// temporal coverage is set by category
        	this.model.trigger("change");
        },

		// TODO: Finish this function
		// TODO: Link this function into the DOM
		updateTaxonCoverage: function(e) {
			if (!e) return false;
			
		},
        
        updateRadioButtons: function(e){
        	//Get the element of this radio button set that is checked
        	var choice = this.$("[name='" + $(e.target).attr("name") + "']:checked").val();
        	
        	if(typeof choice == "undefined" || !choice)
        		this.model.set($(e.target).attr("data-category"), "");
        	else
        		this.model.set($(e.target).attr("data-category"), choice);
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