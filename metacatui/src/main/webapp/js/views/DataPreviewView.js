/* global define */
define(['underscore', 'jquery', 'backbone', 'models/DataONEObject'], 
    function(_, $, Backbone, DataONEObject){
        
        /* 
            A DataPreviewView shows a thumbnail of a DataONEObject
        */
        var DataPreviewView = Backbone.View.extend({
           
            tagName: "div",
            
            className: "data-preview",
            
            id: null,
            
            /* Events this view listens to */
            events: {
            
            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.model = options.model || new DataONEObject();
            },
            
            render: function(){
            	var format = this.model.get("formatId");
            	
            	if( format && format.indexOf("image") > -1 ){
            		var previewHTML = $(document.createElement("img"))
            							.attr("src", MetacatUI.appModel.get("objectServiceUrl") + this.model.get("id"))
            							.addClass("thumbnail");
            		
            		this.$el.append(previewHTML);
            	}
            
            }
        });
        
        return DataPreviewView;
});