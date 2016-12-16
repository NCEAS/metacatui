/* global define */
define(['underscore', 'jquery', 'backbone', 'text!templates/dataItem.html'], 
    function(_, $, Backbone, DataItemTemplate){
        
        /* 
            A DataITemView represents a single data item in a data package as a single row of 
            a nested table.  An item may represent a metadata object (as a folder), or a data
            object described by the metadata (as a file).  Every metadata DataItemView has a
            resource map associated with it that describes the relationships between  the 
            aggregated metadata and data objects.
        */
        var DataItemView = Backbone.View.extend({
           
            tagName: "tr",
            
            id: null,
            
            /* The HTML template for a data item */
            template: _.template(DataItemTemplate),
            
            /* Events this view listens to */
            events: {
                "focusout .name" : "updateName"
            },
            
            /* Initialize the object - post constructor */
            initialize: function(options) {
                this.id = this.model.id;
                //this.id = this.generateId();
                this.listenTo(this.model, 'change', this.render); // render changes to the item
                
                
            },
            
            /* Render the template into the DOM */
            render: function() {
                this.el.id = this.model.id;
                this.$el.html( this.template(this.model.toJSON()) );

                
                return this;
            },
            
            /* Close the view and remove it from the DOM */
            onClose: function(){
                console.log('DataItemView: onClose()');
                this.remove(); // remove for the DOM, stop listening           
                this.off();    // remove callbacks, prevent zombies         
                                
            },
            
            /* 
              Generate a unique id for each data item in the table
              TODO: This could be replaced with the DataONE identifier
            */
            generateId: function() {
                var idStr = ''; // the id to return
                var length = 30; // the length of the generated string
                var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');
                
                for (var i = 0; i < length; i++) {
                    idStr += chars[Math.floor(Math.random() * chars.length)];
                }
                
                return idStr;
            },
            
            updateName: function(e){
            	if(this.model.get("type") == "Metadata")
            		this.model.set("title", $(e.target).text().trim());
            	else
            		this.model.set("fileName", $(e.target).text().trim());
            }
            
        });
        
        return DataItemView;
    });