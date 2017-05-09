/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject',
        'models/metadata/eml211/EMLAttribute',
        'text!templates/metadata/eml-attribute.html'], 
    function(_, $, Backbone, DataONEObject, EMLAttribute, EMLAttributeTemplate){
        
        /* 
            An EMLAttributeView displays the info about one attribute in a data object
        */
        var EMLAttributeView = Backbone.View.extend({
           
            tagName: "div",
            
            className: "eml-attribute accordion-group",
            
            id: null,
            
            /* The HTML template for an attribute */
            template: _.template(EMLAttributeTemplate),
            
            /* Events this view listens to */
            events: {
            	"change"                  : "updateModel",
            	"click .accordion-toggle" : "toggleAttribute"
            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.isNew = (options.isNew === true) ? true : this.model? false : true;
            	this.model = options.model || new EMLAttribute();
            },
            
            render: function(){
            	
            	//Send unique ids to the template for the accordion
            	var templateInfo = {
            			attrId:  this.model.cid,
            			title:   this.model.get("attributeName")? 
            					this.model.get("attributeName") : "Add New Attribute"
            	}
            	
            	_.extend(templateInfo, this.model.toJSON());
            	
            	//Render the template
            	var viewHTML = this.template(templateInfo);
            	
            	if(this.isNew)
            		this.$el.addClass("new");
            	
            	//Insert the template HTML
            	this.$el.html(viewHTML);
            	
            	this.listenTo(this.model, "change:attributeName", this.updateHeader);
            },
            
            updateHeader: function(){
            	this.$(".heading").text(this.model.get("attributeName"));
            },
            
            updateModel: function(e){
            	if(!e) return;
            	
            	var newValue = $(e.target).val(),
            		category  = $(e.target).attr("data-category"),
            		currentValue = this.model.get(category);
            	
            	if(Array.isArray(currentValue)){
            		var inputType = e.target.tagName.toLowercase(),
            			index = this.$(inputType + "[data-category='" + category + "']").index(e.target);
            		
            		currentValue.split(index, 0, newValue);
            		this.model.trigger("change:" + category);
            	}
            	else{
            		this.model.set(category, newValue);
            	}
            },
            
            toggleAttribute: function(e){
            	if(e)
            		e.preventDefault();
            	
            	this.$(".accordion-body").slideToggle();
            },
            
            collapse: function(){
            	this.$(".accordion-body").hide();
            }
        });
        
        return EMLAttributeView;
});