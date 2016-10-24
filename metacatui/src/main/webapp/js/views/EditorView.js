/* global define */
define(['underscore', 'jquery', 'backbone', 'models/DataONEObject', 'models/metadata/eml211/EML211',
    'collections/DataPackage', 'views/DataPackageView', 'text!templates/editor.html'], 
    function(_, $, Backbone, DataONEObject, EML, DataPackage, DataPackageView, EditorTemplate){
    
        var EditorView = Backbone.View.extend({
        
        el: '#Content',
        
        /* The initial editor layout */
        template: _.template(EditorTemplate),
        
        /* Events that apply to the entire editor */
        events: {
            
        },
        
        defaults: {
            /* The identifier of the root package id being rendered */
            id: null,
            
            /* A list of the subviews of the editor */
            subviews: []
        },
        
        /* Initialize a new EditorView - called post constructor */
        initialize: function(options) {
            
            var editorView = this;
            console.log("EditorView: Creating a new data package.");
            MetacatUI.rootDataPackage = new DataPackage(null, options);
                
            // And associate a science metadata model with it if not present
            if ( typeof MetacatUI.rootDataPackage.scienceMetadataModel === "undefined" ||
                 typeof MetacatUI.rootDataPackage.scienceMetadataModel === null) {
                
                MetacatUI.rootDataPackage.scienceMetadataModel = new EML({type: "EML211"});
                
            }
            
            // Get the resource map from the server and populate the model with its members
            MetacatUI.rootDataPackage.fetch();
            this.dataPackageView = new DataPackageView({collection: MetacatUI.rootDataPackage});
            //this.subviews.push(this.dataPackageView);

            return this;
        },
        
        /* Render the view */
        render: function() {
			
            MetacatUI.appModel.set('headerType', 'default');
			$("body").addClass("Editor");
            this.$el.html(this.template());
            //$('#data-package-container').append(this.dataPackageView.render().$el);
            
            return this;
        },
        /* Close the view and its sub views */
        close: function() {
            this.remove(); // remove for the DOM, stop listening           
            this.off();    // remove callbacks, prevent zombies         
			
            $(".Editor").removeClass("Editor");
            
            // Close each subview
            _.each(this.subviews, function(i, subview) {
				subview.close();
                
            });
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
                
    });
    return EditorView;
});