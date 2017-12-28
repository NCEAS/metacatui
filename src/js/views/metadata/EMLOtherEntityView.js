/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject', 'models/metadata/eml211/EMLOtherEntity',
        'views/metadata/EMLEntityView',
        'text!templates/metadata/eml-other-entity.html'], 
    function(_, $, Backbone, DataONEObject, EMLOtherEntity,
    		EMLEntityView,
    		EMLOtherEntityTemplate){
        
        /* 
            An EMLOtherEntityView expands on the EMLEntityView to show attributes of the EML specific to the otherEntity
        */
        var EMLOtherEntityView = EMLEntityView.extend({
           
            tagName: "div",
            
            className: "",
            
            id: null,
            
            template: EMLOtherEntityTemplate(),
            
            /* Events this view listens to */
            events: {

            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.model = options.model || new EMLOtherEntity();
            	this.DataONEObject = options.DataONEObject;
            },
            
            render: function(){
            	
            	this.renderEntityTemplate();
            	
            	var overviewContainer = this.$(".overview-container");
            	overviewContainer.append( this.template( this.model.toJSON() ) );
            	
            	this.renderPreview();
            	
            	this.renderAttributes();
            	
            }
            
        });
        
        return EMLOtherEntityView;
});