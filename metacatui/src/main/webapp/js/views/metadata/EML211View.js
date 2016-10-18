define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EML211',
        'text!templates/eml.html',
        'text!templates/metadataOverview.html'], 
	function(_, $, Backbone, EML, Template, OverviewTemplate){
    
    var EMLView = Backbone.View.extend({
        
        el: '#metadata-container',
        
        /* Templates */
        
        events: {
            
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
    		
            return this;
        },
        
        /* Render the view */
        render: function() {        
			MetacatUI.appModel.set('headerType', 'default');

			//Render the basic structure of the page and table of contents
			this.$el.append(this.template());
			this.$container = this.$(".metadata-container");
	    	
	    	//Render the different sections of the metadata
	    	this.renderEditOverview();
	    	this.renderEditPeople();
	    	this.renderEditDates();
	    	this.renderEditLocations();
	    	this.renderEditTaxa();
	    	this.renderEditMethods();
	    	this.renderEditProject();
	    	this.renderEditSharing();
	    	
            return this;
        },
	    
        /*
         * Creates the Overview section of the page
         */
	    renderEditOverview: function(){
	    	//Append the empty layout
	    	var overviewEl = this.$container.find(".overview");
	    	$(overviewEl).append(this.overviewTemplate());
	    	
	    	//Abstract
	    	var abstractInput = this.createEditAbstract();
	    	$(overviewEl).find(".abstract").append(abstractInput);
	    	
	    	//Keywords
	    	var keywords = this.createEditKeywords();	    	
	    	$(overviewEl).find(".keywords").append(keywords);
	    	
	    	//Alternate Ids
	    	var altIds = this.createEditAltIds();
	    	$(overviewEl).find(".altids").append(altIds);
	    	
	    	//Usage
	    	var usage = this.createEditUsage();
	    	$(overviewEl).find(".usage").append(usage);
	    },
	    
	    renderEditPeople: function(){
	    	
	    },
	    
	    renderEditDates: function(){
	    	
	    },
	    
	    renderEditLocations: function(){
	    	
	    },
	    
	    renderEditTaxa: function(){
	    	
	    },
	    
	    renderEditMethods: function(){
	    	
	    },
	    
	    renderEditProject: function(){
	    	
	    },
	    
	    renderEditSharing: function(){
	    	
	    },
	    
	    createEditAbstract: function(){
	    	//Abstract
	    	var fullAbstract = this.model.get("abstract"),
	    		abstractText;
	    	if(typeof fullAbstract.para == "string")
	    		abstractText = fullAbstract.para;
	    	else if(Array.isArray(fullAbstract.para)){
	    		_.each(fullAbstract.para, function(para){
	    			if(typeof para == "string")
	    				abstractText += " " + para;
	    		});
	    	}
	    	else if(typeof fullAbstract == "string")
	    		abstractText = fullAbstract;
	    	
	    	var abstractInput = $(document.createElement("textarea")).html(abstractText);
	    	
	    	return abstractInput;
	    },
	    
	    createEditKeywords: function(){
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
	    
	    createEditAltIds: function(){
	    	return "";
	    },
	    
	    createEditUsage: function(){
	    	return "";
	    },
        
        /* Close the view and its sub views */
        close: function() {
            this.remove(); // remove for the DOM, stop listening           
            this.off();    // remove callbacks, prevent zombies
            
            this.model = null;
            
            // Close each subview
            _.each(this.subviews, function(i, subview) {
				subview.close();
                
            });
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
    });
    return EMLView;
});