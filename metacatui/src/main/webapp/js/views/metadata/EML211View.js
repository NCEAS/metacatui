define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EML211'], 
	function(_, $, Backbone, EML, Template){
    
    var EMLView = Backbone.View.extend({
        
        el: '#Content',
        
        /* Templates */
        
        events: {
            
        },
                
        /* A list of the subviews */
        subviews: [],
        
        initialize: function(options) {
            
        	//Set up all the options
        	if(typeof options == "undefined") var options = {};
        	
        	//The EML Model and ID
    		this.model = options.model || new EML();    		
    		if(!this.model.get("id") && options.id) this.model.set("id", options.id);
    		if(!this.model.get("id")) this.$el.html("<p>Error: no data set id is specified</p>");
    		
            return this;
        },
        
        /* Render the view */
        render: function() {        
			MetacatUI.appModel.set('headerType', 'default');

            return this;
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