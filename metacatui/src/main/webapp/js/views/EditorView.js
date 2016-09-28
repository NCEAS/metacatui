/* global define */
define(['underscore', 'jquery', 'backbone', 'text!templates/editor.html'], function(_, $, Backbone, EditorTemplate){
    
    var EditorView = Backbone.View.extend({
        
        el: '#Content',
        
        /* The initial editor layout */
        template: _.template(EditorTemplate),
        
        /* Events that apply to the entire editor */
        events: {
            
        },
        
        /* The identifier of the root package id being rendered */
        id: null,
        
        /* A list of the subviews of the editor */
        subviews: [],
        
        /* Constructor - initialize a new EditorView */
        initialize: function(options) {
            
            // If options.id isn't present, generate and render a new package id and metadata id
            if ( typeof options === "undefined" || options.id === null ) {
                console.log("EditorView: Creating a new data package.");
                
            } else {
                this.id = options.id;
                console.log("Loading existing package from id " + options.id);
                
            }            
            return this;
        },
        
        /* Render the view */
        render: function() {
			this.$el.append(this.template());
            
            return this;
        },
        /* Close the view and its sub views */
        close: function() {
            this.remove(); // remove for the DOM, stop listening           
            this.off();    // remove callbacks, prevent zombies         
            
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