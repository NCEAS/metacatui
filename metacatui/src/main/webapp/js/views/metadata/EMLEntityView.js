/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject', 'models/metadata/eml211/EMLOtherEntity',
        'text!templates/metadata/eml-entity.html'], 
    function(_, $, Backbone, DataONEObject, EMLOtherEntity, EMLEntityTemplate){
        
        /* 
            An EMLEntityView shows the basic attributes of a DataONEObject, as described by EML
        */
        var EMLEntityView = Backbone.View.extend({
           
            tagName: "div",
            
            className: "eml-entity modal hide fade",
            
            id: null,
            
            /* The HTML template for an entity */
            template: _.template(EMLEntityTemplate),
            
            /* Events this view listens to */
            events: {
            	"change" : "updateModel"
            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.model = options.model || new EMLOtherEntity();
            },
            
            render: function(){
            	var modelAttr = this.model.toJSON();
            	
            	if(!modelAttr.entityName)
            		modelAttr.title = "this data";
            	else
            		modelAttr.title = modelAttr.entityName;
            	
            	this.$el.html(this.template( modelAttr ));
            	
            	//Initialize the modal window
            	this.$el.modal();
            },
            
            updateModel: function(e){
            	var changedAttr = $(e.target).attr("data-category");
            	
            	if(!changedAttr) return;
            	
            	this.model.set(changedAttr, $(e.target).val());
            	
            },
            
            show: function(){
            	this.$el.modal('show');
            },
            
            hide: function(){
            	this.$el.modal('hide');
            }
        });
        
        return EMLEntityView;
});