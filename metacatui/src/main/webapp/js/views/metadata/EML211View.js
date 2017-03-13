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
		'text!templates/metadata/taxonomicClassificationTable.html', 
		'text!templates/metadata/taxonomicClassificationRow.html'], 
	function(_, $, Backbone, ScienceMetadataView, EMLPartyView, 
			EML, EMLKeywordSet, EMLParty, EMLProject, EMLText, EMLTaxonCoverage,
			EMLTemporalCoverage, Template, OverviewTemplate, DatesTemplate,
			TaxonomicClassificationTable, TaxonomicClassificationRow){
    
    var EMLView = ScienceMetadataView.extend({
    	
    	type: "EML211",
        
        el: '#metadata-container',
        
        /* Templates */
        
        events: {
        	"change .text"              : "updateText",
        	"change .basic-text"        : "updateBasicText",
        	"keypress .basic-text.new"  : "addBasicText",
        	"change .temporal-coverage" : "updateTemporalCoverage",
			"change .taxonomic-coverage": "updateTaxonCoverage",
			"keypress .taxonomic-coverage .new input"   : "addNewTaxon",
			"change   .taxonomic-coverage .new select"  : "addNewTaxon",
			"focusout .taxonomic-coverage tr" : "showTaxonValidation",
        	"change .keywords"          : "updateKeywords",
        	"keypress .keyword.new"		: "addKeyword",
        	"change .usage"             : "updateRadioButtons",
        	"keypress .funding"           : "updateFunding",
        	"keypress .funding.new"     : "addFunding",
        	"click .side-nav-item a"    : "scrollToSection",
        	"change #new-party-menu"    : "chooseNewPersonType",
			"click  .remove"			: "handleRemove"
        },
                
        /* A list of the subviews */
        subviews: [],
        
        template: _.template(Template),
        overviewTemplate: _.template(OverviewTemplate),
        datesTemplate: _.template(DatesTemplate),
		taxonomicClassificationTableTemplate: _.template(TaxonomicClassificationTable),
        taxonomicClassificationRowTemplate: _.template(TaxonomicClassificationRow),
        
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
			
			console.log("rendering EML");

			//Render the basic structure of the page and table of contents
			this.$el.html(this.template());
			this.$container = this.$(".metadata-container");
			
			//Render all the EML sections when the model is synced
			this.renderAllSections();
			if(!this.model.get("synced"))
				this.listenToOnce(this.model, "sync", this.renderAllSections);
			
			//Listen to updates on the data package collections
			_.each(this.model.get("collections"), function(dataPackage){
				if(dataPackage.type != "DataPackage") return;
				
				//When the data package has been saved, render the EML again
				this.listenTo(dataPackage, "successSaving", this.renderAllSections);
			}, this);

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
	    	//Iterate over each keyword and add a text input for the keyword value and a dropdown menu for the thesaurus
	    	_.each(this.model.get("keywordSets"), function(keywordSetModel){
	    		_.each(keywordSetModel.get("keywords"), function(keyword){
		    		this.addKeyword(keyword, keywordSetModel);	    			
	    		}, this);
	    	}, this);
	    	
	    	//Add an empty row for adding a new keyword
	    	this.addKeyword();	  
	    		    	
	    	//Alternate Ids
		    var altIdsEls = this.createBasicTextFields("alternateIdentifier", "Add a new alternate identifier");
		    $(overviewEl).find(".altids").append(altIdsEls);
		    
		    //Usage
		    //Find the model value that matches a radio button and check it
		    $(".checkbox .usage[value='" + this.model.get("intellectualRights") + "']").attr("checked", "checked");
	    	
		    //Funding
		    this.renderFunding();
			
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
	    	
	    	var emptyTypes = [];
	    	
	    	this.partyTypeMap = {
	    			"collaboratingPrincipalInvestigator" : "Collborating-Principal Investigators",
	    			"coPrincipalInvestigator" : "Co-Principal Investigators",
	    			"principalInvestigator" : "Principal Investigators",
	    			"creator" : "Dataset Creators (Authors/Owners/Originators)",
	    			"contact" : "Contacts",
	    			"metadataProvider" : "Metadata Provider",
	    			"custodianSteward" : "Custodian/Steward",
	    			"publisher" : "Publishers",
	    			"user" : "Users"
	    	}
	    	
	    	//Creators
	    	this.$(".section.people").append("<h4>" + this.partyTypeMap["creator"] + "</h4>",
	    			'<div class="row-striped" data-attribute="creator"></div>');	    	
	    	_.each(this.model.get("creator"), this.renderPerson, this);
	    	this.renderPerson(null, "creator");
	    		    	
	    	//Principal Investigators
	    	if(PIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["principalInvestigator"] + "</h4>",
		    			'<div class="row-striped" data-attribute="principalInvestigator"></div>');	    	
		    	_.each(PIs, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "principalInvestigator");
	    	}
	    	else{
	    		emptyTypes.push("principalInvestigator");
	    	}
	    	
	    	//Co-PIs
	    	if(coPIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["coPrincipalInvestigator"] + "</h4>",
		    			'<div class="row-striped" data-attribute="coPrincipalInvestigator"></div>');
		    	_.each(coPIs, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "coPrincipalInvestigator");
	    	}
	    	else
	    		emptyTypes.push("coPrincipalInvestigator");
	    	
	    	//Collab PIs
	    	if(collbalPIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["collaboratingPrincipalInvestigator"] + "</h4>",
		    			'<div class="row-striped" data-attribute="collaboratingPrincipalInvestigator"></div>');
		    	_.each(collbalPIs, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "collaboratingPrincipalInvestigator");
	    	}
	    	else
	    		emptyTypes.push("collaboratingPrincipalInvestigator");
	    	
	    	//Contact
	    	if(this.model.get("contact").length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["contact"] + "</h4>",
	    			'<div class="row-striped" data-attribute="contact"></div>');
	    		_.each(this.model.get("contact"), this.renderPerson, this);
	    	
	    		this.renderPerson(null, "contact");
	    	}
	    	else
	    		emptyTypes.push("contact");

	    	//Metadata Provider
	    	if(this.model.get("metadataProvider").length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["metadataProvider"] + "</h4>",
		    			'<div class="row-striped" data-attribute="metadataProvider"></div>');
		    	_.each(this.model.get("metadataProvider"), this.renderPerson, this);
		    	
		    	this.renderPerson(null, "metadataProvider");
	    	}
	    	else
	    		emptyTypes.push("metadataProvider");
	    	
	    	//Custodian/Steward
	    	if(custodian.length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["custodianSteward"] + "</h4>",
	    			'<div class="row-striped" data-attribute="custodianSteward"></div>');
	    		
	    		_.each(custodian, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "custodianSteward");
	    	}
	    	else
	    		emptyTypes.push("custodianSteward");
	    	
	    	//Publisher
	    	if(this.model.get("publisher").length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["publisher"] + "</h4>",
	    			'<div class="row-striped" data-attribute="publisher"></div>');
	    		
	    		_.each(this.model.get("publisher"), this.renderPerson, this);
	    	
	    		this.renderPerson(null, "publisher");
	    	}
	    	else
	    		emptyTypes.push("publisher");

	    	//User
	    	if(user.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["user"] + "</h4>",
		    			'<div class="row-striped" data-attribute="user"></div>');
		    	
		    	_.each(user, this.renderPerson, this);
		    	
		    	this.renderPerson(null, "user");
	    	}
	    	else
	    		emptyTypes.push("user");
	    	
	    	//Display a drop-down menu for all the empty party types
	    	if(emptyTypes.length){
		    	var menu = $(document.createElement("select")).attr("id", "new-party-menu").addClass("header-dropdown");
		    	$(menu).append( $(document.createElement("option")).text("Choose new person or organization role ...") );
		    	
		    	var newPartyContainer = $(document.createElement("div"))
		    							.attr("data-attribute", "new")
		    							.addClass("row-striped");
		    	
		    	_.each(emptyTypes, function(type){
		    		
		    		$(menu).append( $(document.createElement("option")).val(type).text(this.partyTypeMap[type]) );
		    		
		    	}, this);
		    	
		    	this.$(".section.people").append(menu, newPartyContainer);
		    	
		    	this.renderPerson(null, "new");
	    	}
	    	
	    	//Listen to the EML model for new EMLParty models that are added behind the scenes 
	    	// (mainly from EMLParty.createFromUser()
	    	var view = this;
	    	this.listenTo(this.model, "change:creator change:contact", function(emlModel, changedModels){
	    		
	    		this.renderPerson(changedModels[0], changedModels[0].get("type"));
	    	});
	    	
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
	    	else{
	    		var isNew = false;
	    	
		    	//Get the party type, if it was not sent as a parameter
		    	if(!partyType || typeof partyType != "string")
		    		var partyType = emlParty.get("role") || emlParty.get("type");
	    	}
	    	
	    	var partyView = new EMLPartyView({
    			model: emlParty,
    			edit: this.edit,
    			isNew: isNew
    		});	    	
    		
	    	//Find the container section for this party type
	    	var container = this.$(".section.people").find('[data-attribute="' + partyType + '"]');
	    	
	    	//If this person type is not on the page yet, add it
	    	if(!container.length){
	    		this.addNewPersonType(emlParty.get("type") || emlParty.get("role"));
	    		container = this.$(".section.people").find('[data-attribute="' + partyType + '"]');
	    	}
	    	
	    	if(isNew)
	    		container.append(partyView.render().el);	 
	    	else
	    		container.find(".new").before(partyView.render().el);
	    		
	    	//Listen for changes to the required fields to know when to add a new party row
    		if(isNew){
	    		var view = this;
	    		emlParty.on("valid", function(){
	    			if(emlParty.isValid()){
	    				
	    				if(partyView.isNew)
	    					partyView.notNew();
	    				
	    				//Render the new blank person row
	    				view.renderPerson(undefined, (emlParty.get("role") || emlParty.get("type")));
	    			}
	    		});
    		}
	    },
	    
	    chooseNewPersonType: function(e){
	    	var partyType = $(e.target).val();
	    	
	    	if(!partyType) return;
	    	
	    	//Get the form and model
	    	var partyForm  = this.$(".section.people").find('[data-attribute="new"]'),
	    		partyModel = partyForm.find(".eml-party").data("model");
	    	
	    	//Set the type on this person form
	    	partyForm.attr("data-attribute", partyType);
	    	
	    	//Add a new header
	    	this.$("#new-party-menu").before("<h4>" + this.partyTypeMap[partyType] + "</h4>");
	    			
	    	//Remove this type from the dropdown menu
	    	this.$("#new-party-menu").find("[value='" + partyType + "']").remove();
	    	
	    	//Remove the menu from the page temporarily
	    	var menu = this.$("#new-party-menu").detach();
	    	
	    	//Add the new party type form
	    	var newPartyContainer = $(document.createElement("div"))
									.attr("data-attribute", "new")
									.addClass("row-striped");
	    	this.$(".section.people").append(newPartyContainer);
	    	this.renderPerson(null, "new");
	    	$(newPartyContainer).before(menu);
	    	
	    	//Update the model
	    	var attrToUpdate = _.contains(partyModel.get("roleOptions"), partyType)? "role" : "type";
	    	partyModel.set(attrToUpdate, partyType);
	    	
	    	if(partyModel.isValid())
	    		partyModel.mergeIntoParent();
	    },
	    
	    /*
	     * Gets the party type chosen by the user and adds that section to the view
	     */
	    addNewPersonType: function(partyType){	    	
	    	if(!partyType) return;
	    	
	    	//Add a new header
	    	var header = $(document.createElement("h4")).text(this.partyTypeMap[partyType]);
	    	this.$("#new-party-menu").before(header);
	    	
	    	//Remove this type from the dropdown menu
	    	this.$("#new-party-menu").find("[value='" + partyType + "']").remove();

	    	//Add the new party type container
	    	var container = $(document.createElement("div"))
									.attr("data-attribute", partyType)
									.addClass("row-striped");
	    	header.after(container);
	    	
	    	//Add a blank form to the new person type section
	    	this.renderPerson(null, partyType);
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

			// Render a set of tables for each taxonomicCoverage
			if (typeof taxonomy !== "undefined" && (Array.isArray(taxonomy) && taxonomy.length)) {
				for (var i = 0; i < taxonomy.length; i++) {
					this.$(".section.taxa").append(this.createTaxonomicCoverage(taxonomy[i]));
				}
			} else {
				// Create a new one
				var taxonCov = new EMLTaxonCoverage({
					parentModel: this.model
				});

				this.model.set('taxonCoverage', [taxonCov], {silent: true});

				this.$(".section.taxa").append(this.createTaxonomicCoverage(taxonCov));
			}
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
	    
	    /*
	     * Renders the funding field of the EML
	     */
	    renderFunding: function(){
	    	//Funding
		    var funding = this.model.get("project") ? this.model.get("project").get("funding") : [];
			   
		    //Clear the funding section
		    $(".section.overview .funding").empty();
		    
		    //Create the funding input elements
		    _.each(funding, function(fundingItem, i){
		    	
		    	this.addFunding(fundingItem);
		    	 
		    }, this);
		    
		    //Add a blank funding input
		    this.addFunding();	
	    },
	    
	    /*
	     * Adds a single funding input row. Can either be called directly or used as an event callback
	     */
	    addFunding: function(argument){
	    	if(this.edit){
	    		
	    		if(typeof argument == "string")
	    			var value = argument;
	    		
	    		//Don't add another new funding input if there already is one
	    		if( !value && (typeof argument == "object") && !$(argument.target).is(".new") )
	    			return;
	    		
		    	var fundingInput       = $(document.createElement("input"))
		    								.attr("type", "text")
		    								.attr("data-category", "funding")
		    								.addClass("span12 funding hover-autocomplete-target")
		    								.attr("placeholder", "Search for NSF awards by keyword or enter custom funding information")
		    								.val(value),
			    	hiddenFundingInput = fundingInput.clone().attr("type", "hidden").val(value).attr("id", "").addClass("hidden"),
			    	loadingSpinner     = $(document.createElement("i")).addClass("icon icon-spinner input-icon icon-spin subtle hidden"); 
		    	
		    	//Append all the elements to a container
		    	var containerEl = $(document.createElement("div"))
		    						.addClass("ui-autocomplete-container funding-row")

				if (!value) {
					$(containerEl).addClass("new");
				}

				// Add a remove button if this is a non-new funding element
				if (value) {
					$(containerEl).append(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));
				}

		    	$(containerEl).append(fundingInput, 
									  loadingSpinner, 
									  hiddenFundingInput);
		    	
		    	var view = this;
		    	
			    //Setup the autocomplete widget for the funding input
			    fundingInput.autocomplete({
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
										
						var value = "NSF Award " + ui.item.value + " (" + ui.item.label + ")";
						hiddenFundingInput.val(value);
						fundingInput.val(value);
						
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
			    
			    this.$(".funding-container").append(containerEl);
	    	}
	    },
	    
	    addKeyword: function(keyword, model){
	    	if(typeof keyword != "string" || !keyword){
	    		var keyword = "";
	    		
	    		//Only show one new keyword row at a time
	    		if((this.$(".keyword.new").length == 1) && !this.$(".keyword.new").val())
	    			return;
	    		else if(this.$(".keyword.new").length > 1)
	    			return;
	    	}
	    	
	    	if(!model) var model = new EMLKeywordSet({ parentModel: this.model });
	    	
	    	var thesaurus    = model.get("thesaurus"),
	    		row          = $(document.createElement("div")).addClass("row-fluid keyword-row").data({ model: model }),
	    		keywordInput = $(document.createElement("input")).attr("type", "text").addClass("keyword span10").val(keyword),
    			thesInput    = $(document.createElement("select")).addClass("thesaurus span2").append(
			    				$(document.createElement("option")).val("None").text("None")).append(
			    				$(document.createElement("option")).val("GCMD").text("GCMD")),
				removeButton;
	    	
	    	if(thesaurus && thesaurus.indexOf("GCMD") > -1)
    			thesInput.val("GCMD");
	    	
	    	if(!keyword) 
	    		keywordInput.addClass("new").attr("placeholder", "Add one new keyword");
			
			// Start adding children to the row
			row.append(keywordInput, thesInput);

			// Add a remove button unless this is the .new keyword
			if(keyword) {
				row.prepend(this.createRemoveButton(null, 'keywordSets', 'div.keyword-row', 'div.text-container'));
			}

	    	this.$(".keywords").append(row);
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
	    	
	    	if($(row).is(".new")){
	    		$(row).removeClass("new");
				
				// Add in a remove button
				$(e.target).parent().prepend(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));

	    		this.addFunding();
	    	}
	    	
	    },
	    
	    //TODO: Comma and semi-colon seperate keywords
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
				row.prepend(this.createRemoveButton(null, "keywordSets", "div.keyword-row", "div.text-container"));
	    		this.addKeyword();
	    	}
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
	    
	    /*
	     * Creates and returns an array of basic text input field for editing
	     */
	    createBasicTextFields: function(category, placeholder, appendNew){
	    	
	    	var textContainer = $(document.createElement("div")).addClass("text-container"),
	    		modelValues = this.model.get(category),
				textRow; // Holds the DOM for each field
	    	
	    	if(typeof appendNew == "undefined")
	    		var appendNew = true;
	    	
	    	//Format as an array
	    	if(!Array.isArray(modelValues) && modelValues) modelValues = [modelValues];
	    	
	    	//For each value in this category, create an HTML element with the value inserted
	    	_.each(modelValues, function(value, i, allModelValues){
		    	if(this.edit){
		    		var textRow = $(document.createElement("div")).addClass("basic-text-row"),
					    input   = $(document.createElement("input"))
				    			.attr("type", "text")
				    			.attr("data-category", category)
				    			.addClass("basic-text");
					textRow.append(this.createRemoveButton(null, category, null, 'div.text-container'));
					textRow.append(input.clone().val(value));
		    		textContainer.append(textRow);
		    		
		    		//At the end, append an empty input for the user to add a new one
		    		if(i+1 == allModelValues.length && appendNew) {
						var newRow = $($(document.createElement("div")).addClass("basic-text-row"));
						newRow.append(input.clone().addClass("new").attr("placeholder", placeholder || "Add a new " + category));
						textContainer.append(newRow);
					}	
		    		
		    	}
		    	else{
		    		textContainer.append($(document.createElement("div"))
		    				.addClass("basic-text-row")
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
	    		
	    		textContainer.append($(document.createElement("div")).addClass("basic-text-row").append(input));
	    	}
	    	
	    	return textContainer;
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
	    		var position = $(e.target).parents("div.text-container").first().children("div").index($(e.target).parent());
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
	    	
    		//Add another blank text input
	    	if($(e.target).is(".new")){
				this.addBasicText(e);
				$(e.target).removeClass("new");
	    	}
	    	
	    },
	    
	    /*
	     * Adds a basic text input
	     */
	    addBasicText: function(e){
	    	var category = $(e.target).attr("data-category"),
	    		allBasicTexts = $(".basic-text.new[data-category='" + category + "']");
    
	    	//Only show one new keyword row at a time
    		if((allBasicTexts.length == 1) && !allBasicTexts.val())
    			return;
    		else if(allBasicTexts.length > 1)
    			return;
    		
	    	//Add another blank text input
			var newRow = $(document.createElement("div")).addClass("basic-text-row");
			
			newRow.append($(document.createElement("input"))
				.attr("type", "text")
				.attr("data-category", category)
				.attr("placeholder", $(e.target).attr("placeholder"))
				.addClass("new basic-text"));
			
	    	$(e.target).parent().after(newRow);
	    	
	    	//Remove the new class	    	
			$(e.target).before(this.createRemoveButton(null, 'alternateIdentifier', null, "div.text-container"));
	    },
	    
	    
		// Creates a table to hold a single EMLTaxonCoverage element (table) for
		// each root-level taxonomicClassification
		createTaxonomicCoverage: function(coverage) {
            var finishedEl = $('<div class="row-fluid taxonomic-coverage"></div>');
			$(finishedEl).data({ model: coverage });
			$(finishedEl).attr("data-category", "taxonomic-coverage");

			var classifications = coverage.get("taxonomicClassification");

			// Make a textarea for the generalTaxonomicCoverage
			var generalCoverageEl = $(document.createElement('textarea'))
				.addClass("medium text")
				.attr("data-category", "generalTaxonomicCoverage")
				.text(coverage.get('generalTaxonomicCoverage') || ""	);

			$(finishedEl).append($(document.createElement('h5')).text('General Taxononic Coverage'));
			$(finishedEl).append(generalCoverageEl);

			// taxonomicClassifications
			$(finishedEl).append($(document.createElement('h5')).text('Taxononic Classification(s)'));

			// Makes a table... for the root level
			for (var i = 0; i < classifications.length; i++) {
				$(finishedEl).append(this.createTaxonomicClassifcationTable(classifications[i]));
			}

			// Create a new, blank table for another taxonomicClassification
			var newTableEl = this.createTaxonomicClassifcationTable();

			$(finishedEl).append(newTableEl);

			return finishedEl;
		},
		
		createTaxonomicClassifcationTable: function(classification) {
			var finishedEl = $('<div class="row-striped"></div>');
			var tableEl = $(this.taxonomicClassificationTableTemplate());
			var tableBodyEl = $("<tbody></tbody>");

			var queue = [classification],
			 	rows = [],
			 	cur;

			while (queue.length > 0) {				
				cur = queue.pop();

				// I threw this in here so I can this function without an 
				// argument to generate a new table from scratch
				if (typeof cur === "undefined") {
					continue;
				}

				rows.push({
					'taxonRankName' : cur.taxonRankName,
					'taxonRankValue' : cur.taxonRankValue
				});

				if (cur.taxonomicClassification) {
					for (var i = 0; i < cur.taxonomicClassification.length; i++) {
						queue.push(cur.taxonomicClassification[i]);
					}
				}
			}

			for (var j = 0; j < rows.length; j++) {
				tableBodyEl.append(this.taxonomicClassificationRowTemplate(rows[j]));
			}

			var newRowEl = $(this.taxonomicClassificationRowTemplate({
				taxonRankName: '',
				taxonRankValue: ''
			}));

			$(newRowEl).addClass("new");
			$(tableBodyEl).append(newRowEl);
			$(tableEl).append(tableBodyEl);

			// Add the new class to the entire table if it's a new one
			if (typeof classification === "undefined") {
				$(tableEl).addClass("new");
			}

			$(finishedEl).append(tableEl);

			return finishedEl;
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

		
		/* Update the underlying model and DOM for an EML TaxonomicCoverage
		section. This method handles updating the underlying TaxonomicCoverage
		models when the user changes form fields as well as inserting new
		form fields automatically when the user needs them.

		Since a dataset has multiple TaxonomicCoverage elements at the dataset
		level, each Taxonomic Coverage is represented by a table element and
		all taxonomicClassifications within are rows in that table.

		TODO: Finish this function
		TODO: Link this function into the DOM
		*/
		updateTaxonCoverage: function(e) {
			if (!e) return false;
			
			/*	Getting `model` here is different than in other places because
				the thing being updated is an `input` or `select` element which
				is part of a `taxonomicClassification`. The model is
				`TaxonCoverage` which has one or more
				`taxonomicClassifications`. So we have to walk up to the
				hierarchy from input < td < tr < tbody < table < div to get at
				the underlying TaxonCoverage model.
			*/
	    	var coverage = $(e.target).parents("div.taxonomic-coverage"),
				classification = $(e.target).parents("table.root-taxonomic-classification"),
	    		model =  $(coverage).data("model") || this.model,
				category = $(e.target).attr("data-category"),
				value = $(e.target).val().trim();
	    	
	    	//We can't update anything without a coverage, or
	    	//classification
			if (!coverage) return false;
			if (!classification) return false;

			// Use `category` to determine if we're updating the generalTaxonomicCoverage or
			// the taxonomicClassification
			if (category && category === "generalTaxonomicCoverage") {
				model.set('generalTaxonomicCoverage', value);
				
				return;
			}
			
			// Find all of the root-level taxonomicClassifications
			var classificationTables = $(coverage).find("table.root-taxonomic-classification");

			if (!classificationTables) return false;

			//TODO :This should probably (at least) be in its own View and
			//definitely refactored into tidy functions.*/

			var rows,
				collectedClassifications = [];

			for (var i = 0; i < classificationTables.length; i++) {

				rows = $(classificationTables[i]).find("tbody tr");

				if (!rows) continue;
				
				var topLevelClassification = {},
					classification = topLevelClassification,
					currentRank,
					currentValue;
				
				for (var j = 0; j < rows.length; j++) {

					currentRank = $(rows[j]).find("select").val() || "";
					currentValue = $(rows[j]).find("input").val() || "";

					// Skip over rows with empty Rank or Value
					if (!currentRank.length || !currentValue.length) {
						continue;
					}
					
					//After the first row, start nesting taxonomicClassification objectss
					if(j > 0){
						classification.taxonomicClassification = {};
						classification = classification.taxonomicClassification;
					}
					
					// Add it to the classification object
					classification.taxonRankName = currentRank;
					classification.taxonRankValue = currentValue;
					
				}
				
				
				//Add the top level classification to the array
				if(Object.keys(topLevelClassification).length)
					collectedClassifications.push(topLevelClassification);
			}

			if (!(_.isEqual(collectedClassifications, model.get('taxonomicClassification')))) {
				model.set('taxonomicClassification', collectedClassifications);
				this.model.trigger("change");
			}
			
			// Handle adding new tables and rows
			// Do nothing if the value isn't set
			if (value !== "") {
				// If the table is new and we have some content, make a new table
				if ($(classification).is(".new")) {
					$(coverage).append(this.createTaxonomicClassifcationTable());
					$(classification).removeClass("new");
				}
			}
		},
		
		/*
		 * Adds a new row and/or table to the taxonomic coverage section
		 */
		addNewTaxon: function(e){
			// If the row is new, add a new row to the table
			if ($(e.target).parents("tr").is(".new")) {
				var newRow = $(this.taxonomicClassificationRowTemplate({ 
								taxonRankName: '', 
								taxonRankValue: ''
							 }))
							 .addClass("new");

				//Append the new row and remove the new class from the old row
				$(e.target).parents("tr").removeClass("new").after(newRow);
			}
			
			//If the table is new, add a new table to the page
			if($(e.target).parents(".root-taxonomic-classification").is(".new")){
				this.$(".taxonomic-coverage").append(this.createTaxonomicClassifcationTable());
				$(e.target).parents(".root-taxonomic-classification").removeClass("new");
			}
		},
		
		/*
		 * After the user focuses out, show validation help, if needed
		 */
		showTaxonValidation: function(e){
			
			//Get the text inputs and select menus
			var row = $(e.target).parents("tr"),
				allInputs = row.find("input, select"),
				tableContainer = $(e.target).parents("table"),
				errorInputs = [];
						
			//If none of the inputs have a value and this is a new row, then do nothing
			if(_.every(allInputs, function(i){ return !i.value }) && row.is(".new"))				
				return;
				
			//Add the error styling to any input with no value
			_.each(allInputs, function(input){
				// Keep track of the number of clicks of each input element so we only show the 
				// error message after the user has focused on both input elements
				if(!input.value)
					errorInputs.push(input);				
			});
						
			if(errorInputs.length){
				
				//Show the error message after a brief delay
				setTimeout(function(){
					//If the user focused on another element in the same row, don't do anything
					if(_.contains(allInputs, document.activeElement))
						return;
						
					//Add the error styling
					$(errorInputs).addClass("error");
					
					//Add the error message
					if( !tableContainer.prev(".notification").length ){
						tableContainer.before($(document.createElement("p"))
														.addClass("error notification")
														.text("Enter a rank name AND value in each row."));
					}
					
				}, 200);
			}
			else{
				allInputs.removeClass("error");
				
				if(!tableContainer.find(".error").length)
					tableContainer.prev(".notification").remove();
			}

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
        		var top = $(window).scrollTop() + $("#Navbar").outerHeight() + 70,
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
        
        /*
         *  -- This function is for development/testing purposes only --
         *  Trigger a change on all the form elements
		 *	so that when values are changed by Javascript, we make sure the change event
		 *  is fired. This is good for capturing changes by Javascript, or
		 *  browser plugins that fill-in forms, etc.
         */
        triggerChanges: function(){
			$("#metadata-container input").change();
			$("#metadata-container textarea").change();
			$("#metadata-container select").change();
			console.log("changes fired");
        },
        
		/* Creates "Remove" buttons for removing non-required sections
		of the EML from the DOM */
		createRemoveButton: function(submodel, attribute, selector, container) {
			return $(document.createElement("span"))
				.addClass("icon icon-remove remove pointer")
				.attr("title", "Remove")
				.data({
					'submodel' : submodel,
					'attribute': attribute,
					'selector': selector,
					'container': container
				})
		},

		/* Generic event handler for removing sections of the EML (both
		the DOM and inside the EML211Model) */
		handleRemove: function(e) {
			var submodel = $(e.target).data('submodel'), // Optional sub-model to remove attribute from
			    attribute = $(e.target).data('attribute'), // Attribute on the EML211 model we're removing from
			    selector = $(e.target).data('selector'), // Selector to find the parent DOM elemente we'll remove
				container = $(e.target).data('container'), // Selector to find the parent container so we can remove by index
				parentEl, // Element we'll remove
				model; // Specific sub-model we're removing

			if (!attribute) return;
			if (!container) return;

			// Find the element we'll remove from the DOM
			if (selector) {
				parentEl = $(e.target).parent(selector);
			} else {
				parentEl = $(e.target).parent();
			}

			if (parentEl.length == 0) return;


			// Handle remove on a EML model / sub-model
			if (submodel) {
				if (!attribute) return;

				model = this.model.get(submodel);

				if (!model) return;

				var position = $(e.target).parents(container).first().children("div").index($(e.target).parent());
				var currentValue = this.model.get(submodel).get(attribute);
				
				// Remove from the EML Model
				if (position >= 0) {
					currentValue.splice(position, 1); // Splice returns the removed members
					this.model.get(submodel).set(attribute, currentValue);
				}
			} else if (selector) {
				model = $(parentEl).data('model');

				if (!model) return;

				// Remove the model from the parent model
				this.model.set(attribute, _.without(this.model.get(attribute), model));
			} else { // Handle remove on a basic text field
				model = $(e.target).siblings("input").first().val(); // TODO Rename me?
				
				if (!model) { return; }

				// The DOM order matches the EML model attribute order so we can remove
				// by that
				var position = $(e.target).parents(container).first().children("div").index($(e.target).parent());
				var currentValue = this.model.get(attribute);
				
				// Remove from the EML Model
				if (position >= 0) {
					this.model.set(attribute, currentValue.splice(position, 1));
				}
			}

			// Trigger a change on the entire package
			MetacatUI.rootDataPackage.packageModel.set("changed", true);

			// Remove the DOM
			$(parentEl).remove();
		},

        /* Close the view and its sub views */
        onClose: function() {
            this.remove(); // remove for the DOM, stop listening           
            this.off();    // remove callbacks, prevent zombies
            this.model.off();
            
            //Remove the scroll event listeners
            $(document).unbind("scroll");
            
            this.model = null;
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
    });
    return EMLView;
});