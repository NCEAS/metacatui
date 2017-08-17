define(['underscore', 'jquery', 'backbone',
        'views/metadata/ScienceMetadataView',
        'views/metadata/EMLGeoCoverageView',
        'views/metadata/EMLPartyView',
		'views/metadata/EMLMethodsView',
        'models/metadata/eml211/EML211',
        'models/metadata/eml211/EMLGeoCoverage',
        'models/metadata/eml211/EMLKeywordSet',
        'models/metadata/eml211/EMLParty',
        'models/metadata/eml211/EMLProject',
        'models/metadata/eml211/EMLText',
        'models/metadata/eml211/EMLTaxonCoverage',
        'models/metadata/eml211/EMLTemporalCoverage',
		'models/metadata/eml211/EMLMethods',
        'text!templates/metadata/eml.html',
        'text!templates/metadata/metadataOverview.html',
        'text!templates/metadata/dates.html',
        'text!templates/metadata/locationsSection.html',
        'text!templates/metadata/taxonomicCoverage.html',
		'text!templates/metadata/taxonomicClassificationTable.html', 
		'text!templates/metadata/taxonomicClassificationRow.html'], 
	function(_, $, Backbone, ScienceMetadataView, EMLGeoCoverageView, EMLPartyView, EMLMethodsView,
			EML, EMLGeoCoverage, EMLKeywordSet, EMLParty, EMLProject, EMLText, EMLTaxonCoverage,
			EMLTemporalCoverage, EMLMethods, Template, OverviewTemplate,
			 DatesTemplate, LocationsTemplate, 
			 TaxonomicCoverageTemplate, TaxonomicClassificationTable, TaxonomicClassificationRow){
    
    var EMLView = ScienceMetadataView.extend({
    	
    	type: "EML211",
        
        el: '#metadata-container',
        
        /* Templates */
        
        events: {
        	"change .text"                 : "updateText",

        	"change .basic-text"            : "updateBasicText",
        	"keyup  .basic-text.new"        : "addBasicText",
        	"mouseover .basic-text-row .remove" : "previewTextRemove",
        	"mouseout .basic-text-row .remove"  : "previewTextRemove",
			
			"change .temporal-coverage"    : "updateTemporalCoverage",
			"focusout .temporal-coverage"  : "showTemporalCoverageValidation",

			"keyup .eml-geocoverage.new"        : "updateLocations",
			"click .eml-geocoverage.new .coord" : "updateLocations",
			
			"change .taxonomic-coverage"             : "updateTaxonCoverage",
			"keyup .taxonomic-coverage .new input"   : "addNewTaxon",
			"keyup .taxonomic-coverage .new select"  : "addNewTaxon",
			"focusout .taxonomic-coverage tr"        : "showTaxonValidation",
        	"click .taxonomic-coverage-row .remove"  : "removeTaxonRank",
        	"mouseover .taxonomic-coverage .remove"  : "previewTaxonRemove",
        	"mouseout .taxonomic-coverage .remove"   : "previewTaxonRemove",
			
        	"change .keywords"               : "updateKeywords",
        	"keyup .keyword-row.new input"   : "addNewKeyword",
        	"mouseover .keyword-row .remove" : "previewKeywordRemove",
        	"mouseout .keyword-row .remove"  : "previewKeywordRemove",
        	
			"change .usage"                  : "updateRadioButtons",
        	
			"change .funding"                : "updateFunding",
        	"keyup .funding.new"             : "addFunding",
        	"mouseover .funding-row .remove" : "previewFundingRemove",        	
        	"mouseout .funding-row .remove"  : "previewFundingRemove",
        	
        	"keyup .eml-party.new" : "handlePersonTyping",
        	
			"click .side-nav-item"           : "switchSection",
			
        	"change #new-party-menu"         : "chooseNewPersonType",
        	
			"click  .remove"			     : "handleRemove"
        },
                
        /* A list of the subviews */
        subviews: [],
        
        /* The active section in the view - can only be the section name (e.g. overview, people) 
         * The active section is highlighted in the table of contents and is scrolled to when the page loads 
         */
        activeSection: "overview",
        
        /* The visible section in the view - can either be the section name (e.g. overview, people) or "all" 
         * The visible section is the ONLY section that is displayed. If set to all, all sections are displayed.
         */
        visibleSection: "overview",
        
        template: _.template(Template),
        overviewTemplate: _.template(OverviewTemplate),
        datesTemplate: _.template(DatesTemplate),
        locationsTemplate: _.template(LocationsTemplate),
        taxonomicCoverageTemplate: _.template(TaxonomicCoverageTemplate),
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
			
			//Render the basic structure of the page and table of contents
			this.$el.html(this.template({
				activeSection: this.activeSection,
				visibleSection: this.visibleSection
			}));
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
			
			//Create a Unit collection for the entity and attribute section
			this.model.createUnits();
									
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
	    	
	    	this.renderRequiredIcons();
	    	
	    	//Scroll to the active section
	    	if(this.activeSection != "overview"){
	    		MetacatUI.appView.scrollTo(this.$(".section." + this.activeSection));
	    	}
	    	
			//When scrolling through the metadata, highlight the side navigation
	    	var view = this;
	    	$(document).scroll(function(){
	    		view.highlightTOC.call(view);
	    	});
	    	
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
			// Note the replace() call removing newlines and replacing them with a single space
			// character. This is a temporary hack to fix https://github.com/NCEAS/metacatui/issues/128
		    if(this.model.get("intellectualRights"))
		    	this.$(".checkbox .usage[value='" + this.model.get("intellectualRights").replace(/\r?\n|\r/g, ' ') + "']").prop("checked", true);
		    	
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
	    			"publisher" : "Publisher",
	    			"user" : "Users"
	    	}
	    	
	    	//Creators
	    	this.$(".section.people").append("<h4>" + this.partyTypeMap["creator"] + "<i class='required-icon hidden' data-category='creator'></i></h4>",
					'<p class="subtle">One or more creators is required. If none are entered, you will be set as the creator of this document.</p>',
	    			'<div class="row-striped" data-attribute="creator"></div>');	    	
	    	_.each(this.model.get("creator"), this.renderPerson, this);
	    	this.renderPerson(null, "creator");
	    		    	
	    	//Principal Investigators
	    	if(PIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["principalInvestigator"] + "<i class='required-icon hidden' data-category='principalInvestigator'></i></h4>",
		    			'<div class="row-striped" data-attribute="principalInvestigator"></div>');	    	
		    	_.each(PIs, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "principalInvestigator");
	    	}
	    	else{
	    		emptyTypes.push("principalInvestigator");
	    	}
	    	
	    	//Co-PIs
	    	if(coPIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["coPrincipalInvestigator"] + "<i class='required-icon hidden' data-category='coPrincipalInvestigator'></i></h4>",
		    			'<div class="row-striped" data-attribute="coPrincipalInvestigator"></div>');
		    	_.each(coPIs, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "coPrincipalInvestigator");
	    	}
	    	else
	    		emptyTypes.push("coPrincipalInvestigator");
	    	
	    	//Collab PIs
	    	if(collbalPIs.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["collaboratingPrincipalInvestigator"] + "<i class='required-icon hidden' data-category='collaboratingPrincipalInvestigator'></i></h4>",
		    			'<div class="row-striped" data-attribute="collaboratingPrincipalInvestigator"></div>');
		    	_.each(collbalPIs, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "collaboratingPrincipalInvestigator");
	    	}
	    	else
	    		emptyTypes.push("collaboratingPrincipalInvestigator");
	    	
	    	//Contact
	    	if(this.model.get("contact").length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["contact"] + "<i class='required-icon hidden' data-category='contact'></i></h4>",
					'<p>One or more contacts is required. If none are entered, you will be set as the contact for this document.</p>',
	    			'<div class="row-striped" data-attribute="contact"></div>');
	    		_.each(this.model.get("contact"), this.renderPerson, this);
	    	
	    		this.renderPerson(null, "contact");
	    	}
	    	else
	    		emptyTypes.push("contact");

	    	//Metadata Provider
	    	if(this.model.get("metadataProvider").length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["metadataProvider"] + "<i class='required-icon hidden' data-category='metadataProvider'></i></h4>",
		    			'<div class="row-striped" data-attribute="metadataProvider"></div>');
		    	_.each(this.model.get("metadataProvider"), this.renderPerson, this);
		    	
		    	this.renderPerson(null, "metadataProvider");
	    	}
	    	else
	    		emptyTypes.push("metadataProvider");
	    	
	    	//Custodian/Steward
	    	if(custodian.length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["custodianSteward"] + "<i class='required-icon hidden' data-category='custodianSteward'></i></h4>",
	    			'<div class="row-striped" data-attribute="custodianSteward"></div>');
	    		
	    		_.each(custodian, this.renderPerson, this);
	    	
	    		this.renderPerson(null, "custodianSteward");
	    	}
	    	else
	    		emptyTypes.push("custodianSteward");
	    	
	    	//Publisher
	    	if(this.model.get("publisher").length){
	    		this.$(".section.people").append("<h4>" + this.partyTypeMap["publisher"] + "<i class='required-icon hidden' data-category='publisher'></i></h4>",
	    			'<p class="subtle">Only one publisher can be specified.</p>',
	    			'<div class="row-striped" data-attribute="publisher"></div>');
	    		
	    		_.each(this.model.get("publisher"), this.renderPerson, this);	    	
	    	}
	    	else
	    		emptyTypes.push("publisher");

	    	//User
	    	if(user.length){
		    	this.$(".section.people").append("<h4>" + this.partyTypeMap["user"] + "<i class='required-icon hidden' data-category='user'></i></h4>",
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
	    	else{
	    		if(container.find(".new").length)
	    			container.find(".new").before(partyView.render().el);
	    		else
	    			container.append(partyView.render().el);
				
				// Add in a remove button
				$(container).find("div.eml-party").append(this.createRemoveButton(null, partyType, "div.eml-party", "div.row-striped"));
	    	}

	    },
	    
	    /*
	     * This function reacts to the user typing a new person in the person section (an EMLPartyView)
	     */
	    handlePersonTyping: function(e){
	    	var container = $(e.target).parents(".eml-party"),
    			emlParty  = container.length? container.data("model") : null,
    			partyType = container.length && emlParty? emlParty.get("role") || emlParty.get("type") : null;
    			
    		if(this.$("[data-attribute='" + partyType + "'] .eml-party.new").length > 1) return;
    		
			// Add in a remove button
			$(container).append(this.createRemoveButton(null, partyType, "div.eml-party", "div.row-striped"));

			//Render a new person
			if(partyType != "publisher")
				this.renderPerson(null, partyType);
	    },
	    
	    /*
	     * This function is called when someone chooses a new person type from the dropdown list
	     */
	    chooseNewPersonType: function(e){
	    	var partyType = $(e.target).val();
	    	
	    	if(!partyType) return;
	    	
	    	//Get the form and model
	    	var partyForm  = this.$(".section.people").find('[data-attribute="new"]'),
	    		partyModel = partyForm.find(".eml-party").data("model");
	    	
	    	//Set the type on this person form
	    	partyForm.attr("data-attribute", partyType);
	    	
	    	//Get the party type dropdown menu
	    	var partyMenu = this.$("#new-party-menu");
	    	
	    	//Add a new header
	    	partyMenu.before("<h4>" + this.partyTypeMap[partyType] + "</h4>");
	    	
	    	if(partyType == "publisher")
	    		partyMenu.before('<p class="subtle">Only one publisher can be specified.</p>');
	    			
	    	//Remove this type from the dropdown menu
	    	partyMenu.find("[value='" + partyType + "']").remove();
	    	
	    	//Remove the menu from the page temporarily
	    	partyMenu.detach();
	    	
	    	//Add the new party type form
	    	var newPartyContainer = $(document.createElement("div"))
									.attr("data-attribute", "new")
									.addClass("row-striped");
	    	this.$(".section.people").append(newPartyContainer);
	    	this.renderPerson(null, "new");
	    	$(newPartyContainer).before(partyMenu);
	    	
	    	//Update the model
	    	var attrToUpdate = _.contains(partyModel.get("roleOptions"), partyType)? "role" : "type";
	    	partyModel.set(attrToUpdate, partyType);
	    	
	    	if(partyModel.isValid()){
	    		partyModel.mergeIntoParent();
	    		
	    		//Add a new person of that type
	    		this.renderPerson(null, partyType);
	    	}
	    	else{
	    		partyForm.find(".eml-party").data("view").showRequired();
	    	}
	    },
	    
	    /*
	     * Gets the party type chosen by the user and adds that section to the view
	     */
	    addNewPersonType: function(partyType){	    	
	    	if(!partyType) return;
	    	
			// Container element to hold all parties of this type
			var partyTypeContainer = $(document.createElement("div")).addClass("party-type-container");

	    	// Add a new header for the party type
	    	var header = $(document.createElement("h4")).text(this.partyTypeMap[partyType]);
			$(partyContainer).append(header);
	    	
	    	//Remove this type from the dropdown menu
	    	this.$("#new-party-menu").find("[value='" + partyType + "']").remove();

	    	//Add the new party container
	    	var partyContainer = $(document.createElement("div"))
									.attr("data-attribute", partyType)
									.addClass("row-striped");
	    	partyTypeContainer.append(partyContainer);
	    	
			// Add in the new party type container just before the dropdown
			this.$("#new-party-menu").before(partyTypeContainer);

	    	//Add a blank form to the new person type section
	    	this.renderPerson(null, partyType);
	    },
	    
	    /*
         * Renders the Dates section of the page
         */
	    renderDates: function(){
            var model = this.model.get('temporalCoverage') || new EMLTemporalCoverage();
			var html = this.datesTemplate({
				beginDate: model.get('beginDate'),
				beginTime: model.get('beginTime'),
				endDate: model.get('endDate'),
				endTime: model.get('endTime')
			});
            	
	    	this.$(".section.dates").html(html);
	    },
	    
	    /*
         * Renders the Locations section of the page
         */
	    renderLocations: function(){
	    	var locationsSection = this.$(".section.locations");
	    	
	    	//Add the Locations header
	    	locationsSection.html(this.locationsTemplate());
	    	var locationsTable = locationsSection.find(".locations-table");
	    	
	    	//Render an EMLGeoCoverage view for each EMLGeoCoverage model
	    	_.each(this.model.get("geoCoverage"), function(geo, i){
	    		//Create an EMLGeoCoverageView
	    		var geoView = new EMLGeoCoverageView({ 
	    			model: geo,
	    			edit: this.edit
	    			});
	    		
	    		//Render the view
	    		geoView.render();
	    		
	    		geoView.$el.find(".remove-container").append(this.createRemoveButton(null, "geoCoverage", ".eml-geocoverage", ".locations-table"));
	    		
	    		//Add the locations section to the page
	    		locationsTable.append(geoView.el);
	    		
	    		//Save it in our subviews array
	    		this.subviews.push(geoView);
	    	}, this);
	    	
	    	//Now add one empty row to enter a new geo coverage
	    	if(this.edit){
	    		var newGeo = new EMLGeoCoverageView({
	    			edit: true,
	    			model: new EMLGeoCoverage({ parentModel: this.model, isNew: true}),
	    			isNew: true
	    		});
	    		locationsTable.append(newGeo.render().el);
	    		newGeo.$el.find(".remove-container").append(this.createRemoveButton(null, "geoCoverage", ".eml-geocoverage", ".locations-table"));
	    	}
	    },
	    
	    /*
         * Renders the Taxa section of the page
         */
	    renderTaxa: function(){
	    	this.$(".section.taxa").html($(document.createElement("h2")).text("Taxa"));

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
	    	var methodsModel = this.model.get("methods");
	    	
			if (!methodsModel) {
				methodsModel = new EMLMethods({ edit: this.edit, parentModel: this.model });
			}

			this.$(".section.methods").append(new EMLMethodsView({ 
				model: methodsModel, 
				edit: this.edit }).render().el);
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
	    		else if(!argument)
	    			var value = "";
	    		//Don't add another new funding input if there already is one
	    		else if( !value && (typeof argument == "object") && !$(argument.target).is(".new") )
	    			return;
	    		else if((typeof argument == "object") && argument.target) {
					var event = argument;

					// Don't add a new funding row if the current one is empty
					if ($(event.target).val().trim() === "") return;
				}
	    			
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
		    						.append(fundingInput, 
									  loadingSpinner, 
									  hiddenFundingInput);
		    	
				if (!value){
					$(fundingInput).addClass("new");
					
					if(event) {
						$(event.target).parents("div.funding-row").append(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));
						$(event.target).removeClass("new");
					}
				} else { // Add a remove button if this is a non-new funding element
					$(containerEl).append(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));
				}
		    	
		    	var view = this;
		    	
			    //Setup the autocomplete widget for the funding input
			    fundingInput.autocomplete({
					source: function(request, response){
						var beforeRequest = function(){
							loadingSpinner.show();
						}
						
						var afterRequest = function(){
							loadingSpinner.hide();
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
	    
	    previewFundingRemove: function(e){
	    	$(e.target).parents(".funding-row").toggleClass("remove-preview");
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
	    	
	    	if(!keyword) {
				row.addClass("new");
				keywordInput.attr("placeholder", "Add one new keyword");
			}
	    		
			// Start adding children to the row
			row.append(keywordInput, thesInput);

			// Add a remove button unless this is the .new keyword
			if(keyword) {
				row.append(this.createRemoveButton(null, 'keywordSets', 'div.keyword-row', 'div.keywords'));
			}

	    	this.$(".keywords").append(row);
	    },

		addNewKeyword: function(e) {
			if ($(e.target).val().trim() === "") return;

			$(e.target).parents(".keyword-row").first().removeClass("new");

			// Add in a remove button
			$(e.target).parents(".keyword-row").append(this.createRemoveButton(null, 'keywordSets', 'div.keyword-row', 'div.keywords'));
			
			var row          = $(document.createElement("div")).addClass("row-fluid keyword-row new").data({ model: new EMLKeywordSet() }),
	    		keywordInput = $(document.createElement("input")).attr("type", "text").addClass("keyword span10"),
    			thesInput    = $(document.createElement("select")).addClass("thesaurus span2").append(
			    				$(document.createElement("option")).val("None").text("None")).append(
			    				$(document.createElement("option")).val("GCMD").text("GCMD"));

			row.append(keywordInput, thesInput);

			this.$(".keywords").append(row);
		},
		
		previewKeywordRemove: function(e){
			var row = $(e.target).parents(".keyword-row").toggleClass("remove-preview");
		},
	    
	    /*
	     * Update the funding info when the form is changed
	     */
	    updateFunding: function(e){
	    	if(!e) return;
	    	
	    	var newValue = $(e.target).siblings("input.hidden").val() || $(e.target).val(),
	    		row      = $(e.target).parent(".funding-row").first(),
	    		rowNum   = this.$(".funding-row").index(row),
	    		input    = $(row).find("input");
	    	
	    	//If there is no project model
	    	if(!this.model.get("project")){
	    		var model = new EMLProject({ parentModel: this.model });
	    		this.model.set("project", model);
	    	}
	    	else
	    		var model = this.model.get("project");
	    	
	    	var currentFundingValues = model.get("funding")
	    	currentFundingValues[rowNum] = newValue;
	    	
	    	if($(row).is(".new") && newValue != ''){
	    		$(row).removeClass("new");
				
				// Add in a remove button
				$(e.target).parent().append(this.createRemoveButton('project', 'funding', '.funding-row', 'div.funding-container'));

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
	    	
	    	if(keyword.length == 0 && thesaurus === 'None') return;

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
	    	if(row.is(".new")){
	    		row.removeClass("new");
				row.append(this.createRemoveButton(null, "keywordSets", "div.keyword-row", "div.keywords"));
	    		this.addKeyword();
	    	} else {
				console.log('not new');
			}
	    },
	    
	    /*
	     * Update the EML Geo Coverage models and views when the user interacts with the locations section
	     */
	    updateLocations: function(e){
	    	if(!e) return;
	    	
	    	e.preventDefault();
	    	
	    	// Don't create a new EMLGeoCoverageView if the value isn't set
	    	if(!$(e.target).val())
	    		return;
	    	
	    	var viewEl = $(e.target).parents(".eml-geocoverage");
	    	
	    	if(viewEl.is(".new")){
	    		
	    		if(this.$(".eml-geocoverage.new").length > 1)
	    			return;
	    		
	    		//Render the new geo coverage view
	    		var newGeo = new EMLGeoCoverageView({
	    			edit: this.edit,
	    			model: new EMLGeoCoverage({ parentModel: this.model, isNew: true}),
	    			isNew: true
	    		});
	    		this.$(".locations-table").append(newGeo.render().el);
	    		newGeo.$el.find(".remove-container").append(this.createRemoveButton(null, "geoCoverage", ".eml-geocoverage", ".locations-table"));

	    		//Unmark the view as new
	    		viewEl.data("view").notNew();
	    		
	    		//Get the EMLGeoCoverage model attached to this EMlGeoCoverageView
	    		var geoModel = viewEl.data("model"),
	    		//Get the current EMLGeoCoverage models set on the parent EML model
	    			currentCoverages = this.model.get("geoCoverage");
	    		
	    		//Add this new geo coverage model to the parent EML model
	    		if(Array.isArray(currentCoverages)){
	    			if( !_.contains(currentCoverages, geoModel) ){
	    				currentCoverages.push(geoModel);
	    				this.model.trigger("change:geoCoverage");
	    			}
	    		}
	    		else{
	    			currentCoverages = [currentCoverages, geoModel];
	    			this.model.set("geoCoverage", currentCoverages);
	    		}
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
				paragraphsString = paragraphs.join(String.fromCharCode(13));
		    		
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
	    		
	    		//Get the current value for this category and create a new EMLText model
	    		var currentValue = this.model.get(category),
	    			newTextModel = new EMLText({ text: paragraphs, parentModel: this.model });
	    		
	    		// Save the new model onto the underlying DOM node
	    		$(e.target).data({ "model" : newTextModel });
	    		
	    		//Set the new EMLText model on the EML model
	    		if(Array.isArray(currentValue)){
	    			currentValue.push(newTextModel);
	    			this.model.trigger("change:" + category);
	    			this.model.trigger("change");
	    		}
	    		else{
	    			this.model.set(category, newTextModel);
	    		}

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
					textRow.append(input.clone().val(value));
					textRow.append(this.createRemoveButton(null, category, 'div.basic-text-row', 'div.text-container'));
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
	    	if($(e.target).is(".new") && value != ''){
				$(e.target).removeClass("new");
				this.addBasicText(e);
	    	}

			// Trigger a change on the entire package
			MetacatUI.rootDataPackage.packageModel.set("changed", true);	    	
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
	    	
			$(e.target).after(this.createRemoveButton(null, 'alternateIdentifier', '.basic-text-row', "div.text-container"));
	    },
	    
	    previewTextRemove: function(e){
	    	$(e.target).parents(".basic-text-row").toggleClass("remove-preview");
	    },
	    
	    renderRequiredIcons: function(){
	    	var requiredFields = MetacatUI.appModel.get("emlEditorRequiredFields");
	    	
	    	_.each( Object.keys(requiredFields), function(field){
	    		
	    		if(requiredFields[field])
	    			this.$(".required-icon[data-category='" + field + "']").show();
	    		
	    	}, this);
	    },
	    
		// Creates a table to hold a single EMLTaxonCoverage element (table) for
		// each root-level taxonomicClassification
		createTaxonomicCoverage: function(coverage) {
            var finishedEls = $(this.taxonomicCoverageTemplate({
            		generalTaxonomicCoverage: coverage.get('generalTaxonomicCoverage') || ""
            	})),
            	coverageEl = finishedEls.filter(".taxonomic-coverage");
            
            coverageEl.data({ model: coverage });

			var classifications = coverage.get("taxonomicClassification");

			// Makes a table... for the root level
			for (var i = 0; i < classifications.length; i++) {
				coverageEl.append(this.createTaxonomicClassifcationTable(classifications[i]));
			}

			// Create a new, blank table for another taxonomicClassification
			var newTableEl = this.createTaxonomicClassifcationTable();

			coverageEl.append(newTableEl);

			return finishedEls;
		},
		
		createTaxonomicClassifcationTable: function(classification) {
			var finishedEl = $('<div class="row-striped root-taxonomic-classification-container"></div>');

			// Add a remove button if this is not a new table
			if (!(typeof classification === "undefined")) {
				$(finishedEl).append(this.createRemoveButton('taxonCoverage', 'taxonomicClassification', '.root-taxonomic-classification-container', '.taxonomic-coverage'));
			}
			
			
			var tableEl = $(this.taxonomicClassificationTableTemplate());
			var tableBodyEl = $(document.createElement("tbody"));

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
					'taxonRankName' : cur.taxonRankName.toLowerCase(),
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
        	var category = $(e.target).attr("data-category"),
	        	model = this.model.get("temporalCoverage"),
	        	value = $(e.target).val().trim();

        	// We can't update anything without a category
        	if (!category) return false;

        	// If this datetime isn't paired with an existing
        	// EMLTemporalCoverage instance, create one. Otherwise, mutate
        	// the existing one
        	if (!model) {
        		model = new EMLTemporalCoverage({
	        		parentModel: this.model
	        	});

	        	// Add the newly-created model to the array
	        	this.model.set("temporalCoverage", model);
			}

			//If the value hasn't changed, exit
			if (value == model.get(category)) {
				return;
			}
				
			// Set the new value
			model.set(category, value);

        	// Trigger the tricking up of this change for which part of the
        	// temporal coverage is set by category
        	MetacatUI.rootDataPackage.packageModel.set("changed", true);
        },

		showTemporalCoverageValidation: function(e) {
			var container = $(e.target).parents('.temporal-coverage').first(),
			    inputs = $(container).find('input'),
				errors = [],
				values = {};

			// Collect the values of all inputs to simplify validation
			_.each(inputs, function(input) {
				var category = $(input).attr('data-category');

				if (!category) {
					return {} ;
				}

				values[category] = $(input).val();
			});

			// Remove existing error borders and notifications
			$(inputs).removeClass("error");
			$(container).prev('.notification').remove();

			if (values.beginDate == '') {
				if (values.beginTime == '') {
					$(inputs).filter('input[data-category="beginDate"]').removeClass("error");
				} else {
					$(inputs).filter('input[data-category="beginDate"]').addClass("error");
					errors.push('You must set a Date if you set a Time.');
				}
			} else {
				$(inputs).filter('input[data-category="beginDate"]').removeClass("error");
			}

			if (values.endDate == '') {
				if (values.endTime == '') {
					$(inputs).filter('input[data-category="endDate"]').removeClass("error");
				} else {
					$(inputs).filter('input[data-category="endDate"]').addClass("error");
					errors.push('You must set a Date if you set a Time.');
				}
			} else {
				$(inputs).filter('input[data-category="endDate"]').removeClass("error");
			}

			if (values.endDate != '') {
				if (values.beginDate != '') {
					$(inputs).filter('input[data-category="beginDate"]').removeClass("error");
				} else {
					$(inputs).filter('input[data-category="beginDate"]').addClass("error");
					errors.push('You must set a Begin Date if you set an End Time.');
				}
			} else {
				$(inputs).filter('input[data-category="beginDate"]').removeClass("error");
			}

			if (values.beginTime != '') {
				if(values.beginTime.split(':').length < 3) {
					$(inputs).filter('input[data-category="beginTime"]').addClass("error");
					errors.push("Time must follow ISO 8601 format: e.g., HH:MM:SSZ, HH:MM:SS.SSS+08:00");
				} else {
					$(inputs).filter('input[data-category="beginTime"]').removeClass("error");
				}
			} else {
				$(inputs).filter('input[data-category="beginTime"]').removeClass("error");
			}

			if (values.endTime != '') {
				if(values.endTime.split(':').length < 3) {
					$(inputs).filter('input[data-category="endTime"]').addClass("error");
					errors.push("Time must follow ISO 8601 format: e.g., HH:MM:SSZ, HH:MM:SS.SSS+08:00");
				} else {
					$(inputs).filter('input[data-category="endTime"]').removeClass("error");
				}
			} else {
				$(inputs).filter('input[data-category="endTime"]').removeClass("error");
			}

			if (errors.length > 0) {
				container.before($(document.createElement("p"))
											.addClass("error notification")
											.text(errors[0]));
			}			
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
		updateTaxonCoverage: function(options) {
			
			if(options.target){
				var e = options;
				
				/*	Getting `model` here is different than in other places because
					the thing being updated is an `input` or `select` element which
					is part of a `taxonomicClassification`. The model is
					`TaxonCoverage` which has one or more
					`taxonomicClassifications`. So we have to walk up to the
					hierarchy from input < td < tr < tbody < table < div to get at
					the underlying TaxonCoverage model.
				*/
		    	var coverage = $(e.target).parents(".taxonomic-coverage"),
					classificationEl = $(e.target).parents(".root-taxonomic-classification"),
		    		model =  $(coverage).data("model") || this.model,
					category = $(e.target).attr("data-category"),
					value = $(e.target).val().trim();
		    	
		    	//We can't update anything without a coverage, or
		    	//classification
				if (!coverage) return false;
				if (!classificationEl) return false;
	
				// Use `category` to determine if we're updating the generalTaxonomicCoverage or
				// the taxonomicClassification
				if (category && category === "generalTaxonomicCoverage") {
					model.set('generalTaxonomicCoverage', value);
					
					return;
				}
			}
			else{
				var coverage = options.coverage,
					model    = $(coverage).data("model");
			}
			
			// Find all of the root-level taxonomicClassifications
			var classificationTables = $(coverage).find(".root-taxonomic-classification");

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
			if (value) {
				// Add a new row if this is itself a new row
				if ($(e.target).parents("tr").first().is(".new")) {
					var newRowEl = $(this.taxonomicClassificationRowTemplate({
						taxonRankName: '',
						taxonRankValue: ''
					})).addClass("new");

					$(e.target).parents("tbody").first().append(newRowEl);
					$(e.target).parents("tr").first().removeClass("new");
				}

				// Add a new classification table if this is itself a new table
				if ($(classificationEl).is(".new")) {
					$(classificationEl).removeClass("new");
					$(classificationEl).append(this.createRemoveButton('taxonCoverage', 'taxonomicClassification', '.root-taxonomic-classification-container', '.taxonomic-coverage'));
					$(coverage).append(this.createTaxonomicClassifcationTable());
				}
			}
		},
		
		/*
		 * Adds a new row and/or table to the taxonomic coverage section
		 */
		addNewTaxon: function(e){
			// Don't do anything if the current classification doesn't have new content
			if ($(e.target).val().trim() === "") return;

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
		},
		
		removeTaxonRank: function(e){
			var row = $(e.target).parents(".taxonomic-coverage-row"),
				coverageEl = $(row).parents(".taxonomic-coverage"),
				view = this;
			
			//Animate the row away and then remove it
			row.slideUp("fast", function(){
				row.remove();
				view.updateTaxonCoverage({ coverage: coverageEl });
			});
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
		
		previewTaxonRemove: function(e){
			var removeBtn = $(e.target);
			
			if(removeBtn.parent().is(".root-taxonomic-classification")){
				removeBtn.parent().toggleClass("remove-preview");
			}
			else{
				removeBtn.parents(".taxonomic-coverage-row").toggleClass("remove-preview");
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
         * Switch to the given section
         */
        switchSection: function(e){
        	if(!e) return;
        	
        	e.preventDefault();
        	
        	var clickedEl = $(e.target),
        		section = clickedEl.attr("data-section") || clickedEl.children("[data-section]").attr("data-section");
        	
        	if(this.visibleSection == "all")
        		this.scrollToSection(section);
        	else{
        		this.$(".section." + this.activeSection).hide()
        		this.$(".section." + section).show();
        		
        		this.highlightTOC(section);
        		
        		this.activeSection = section;
        		this.visibleSection = section;
        		
        		//if(this.$el.scrollTop() < $("#Navbar").height())
        		$("body").scrollTop(this.$(".section." + section).offset().top - $("#Navbar").height());
        	}
        		
        		
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
        	
        	var view = this;        	
        	setTimeout(function(){ 
        		$(document).scroll(view.highlightTOC.call(view));
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
        	
        	//Set the active section on this view
        	this.activeSection = section;
        },
        
        /*
         * Highlight the given menu item.
         * The first argument is either an event object or the section name
         */
        highlightTOC: function(section){
        	
        	this.resizeTOC();
        	
        	//Now change sections
        	if(typeof section == "string"){
            	//Remove the active class from all the menu items
            	$(".side-nav-item a.active").removeClass("active");
            	
            	$(".side-nav [data-section='" + section + "']").addClass("active");
            	this.activeSection = section;
            	this.visibleSection = section;
            	return;
        	}
        	else if(this.visibleSection == "all"){
            	//Remove the active class from all the menu items
            	$(".side-nav-item a.active").removeClass("active");
            	
        		//Get the section
        		var top = $(window).scrollTop() + $("#Navbar").outerHeight() + 70,
        			sections = $(".metadata-container .section");

        		//If we're somewhere in the middle, find the right section	
    			for(var i=0; i < sections.length; i++){
    				if( top > $(sections[i]).offset().top && top < $(sections[i+1]).offset().top ){
    					$($(".side-nav-item a")[i]).addClass("active");
    					this.activeSection = $(sections[i]).attr("data-section");
    					this.visibleSection = $(sections[i]).attr("data-section");
    					break;
    				}
    			}

        		
        	}        	        	
        },
        
    	/*
    	 * Resizes the vertical table of contents so it's always the same height as the editor body
    	 */
        resizeTOC: function(){
        	var tableBottom = document.getElementById("data-package-container").getBoundingClientRect().bottom,
        		navTop = tableBottom;
        	
        	if(tableBottom < $("#Navbar").outerHeight())
        		navTop = $("#Navbar").outerHeight();
        	
        	navTop += $("#editor-body .ui-resizable-handle").outerHeight();
        	
        	$(".metadata-toc").css("top", navTop);
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
				parentEl = $(e.target).parents(selector).first();
			} else {
				parentEl = $(e.target).parents().first();
			}

			if (parentEl.length == 0) return;


			// Handle remove on a EML model / sub-model
			if (submodel) {

				model = this.model.get(submodel);

				if (!model) return;

				// Get the current value of the attribute so we can remove from it
				var currentValue,
					submodelIndex;

				if (Array.isArray(this.model.get(submodel))) {
					// Stop now if there's nothing to remove in the first place
					if (this.model.get(submodel).length == 0) return;

					// For multi-valued submodels, find *which* submodel we are removing or
					// removingn from
					submodelIndex = $(container).index($(e.target).parents(container).first());
					if (submodelIndex === -1) return;

					currentValue = this.model.get(submodel)[submodelIndex].get(attribute);
				} else {
					currentValue = this.model.get(submodel).get(attribute);
				}

				//FInd the position of this field in the list of fields
				var position = $(e.target).parents(container)
								.first()
								.children(selector)
								.index($(e.target).parents(selector));
				
				// Remove from the EML Model
				if (position >= 0) {
					if (Array.isArray(this.model.get(submodel))) {
						currentValue.splice(position, 1); // Splice returns the removed members
						this.model.get(submodel)[submodelIndex].set(attribute, currentValue);
					} else {
						currentValue.splice(position, 1); // Splice returns the removed members
						this.model.get(submodel).set(attribute, currentValue);
					}
					
				}
				
			} else if (selector) {
				// Find the index this attribute is in the DOM
				var position = $(e.target).parents(container).first().children(selector).index($(e.target).parents(selector));
				
				//Remove this index of the array
				var currentValue = this.model.get(attribute);
				
				if(Array.isArray(currentValue))
					currentValue.splice(position, 1);

				//Set the array on the model so the 'set' function is executed
				this.model.set(attribute, currentValue);
				
			} else { // Handle remove on a basic text field
				// The DOM order matches the EML model attribute order so we can remove
				// by that
				var position = $(e.target).parents(container).first().children(selector).index(selector);
				var currentValue = this.model.get(attribute);
				
				// Remove from the EML Model
				if (position >= 0) {
					currentValue.splice(position, 1);
					this.model.set(attribute, currentValue);
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