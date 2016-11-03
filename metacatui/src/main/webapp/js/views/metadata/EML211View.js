define(['underscore', 'jquery', 'backbone',
        'views/metadata/ScienceMetadataView',
        'models/metadata/eml211/EML211',
        'text!templates/eml.html',
        'text!templates/metadataOverview.html'], 
	function(_, $, Backbone, ScienceMetadataView, EML, Template, OverviewTemplate){
    
    var EMLView = ScienceMetadataView.extend({
    	
    	type: "EML211",
        
        el: '#metadata-container',
        
        /* Templates */
        
        events: {
        	"change textarea.text" : "updateText"
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
			this.$el.append(this.template());
			this.$container = this.$(".metadata-container");
			
			//Fetch the metadata model
			this.listenTo(this.model, "sync", function(){
				console.log("EML model: ", this.model);
		    	//Render the different sections of the metadata
		    	this.renderOverview();
		    	this.renderPeople();
		    	this.renderDates();
		    	this.renderLocations();
		    	this.renderTaxa();
		    	this.renderMethods();
		    	this.renderProject();
		    	this.renderSharing();
			});
			this.model.fetch();
	    	
            return this;
        },
	    
        /*
         * Renders the Overview section of the page
         */
	    renderOverview: function(){
	    	//Get the overall view mode
	    	var edit = this.edit;
	    	
	    	//Append the empty layout
	    	var overviewEl = this.$container.find(".overview");
	    	$(overviewEl).append(this.overviewTemplate());
	    	
	    	//Abstract
	    	var abstractEl = this.createAbstract(edit);
	    	$(overviewEl).find(".abstract").append(abstractEl);
	    	
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
	    
	    /*
         * Creates the abstract elements
         */
	    createAbstract: function(edit){
	    	var abstractText = this.formatParagraphs(this.model.get("abstract"), edit);
	    	
	    	if(edit)
	    		var abstractEl = $(document.createElement("textarea"))
	    						 .addClass("xlarge text")
	    						 .attr("data-category", "abstract")
	    						 .html(abstractText);
	    	else
	    		var abstractEl = $(document.createElement("div")).append(abstractText);
	    	
	    	return abstractEl;
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