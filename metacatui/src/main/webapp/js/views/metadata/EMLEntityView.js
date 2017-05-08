/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject', 'models/metadata/eml211/EMLAttribute', 'models/metadata/eml211/EMLEntity',
        'views/DataPreviewView',
        'views/metadata/EMLAttributeView',
        'text!templates/metadata/eml-entity.html'], 
    function(_, $, Backbone, DataONEObject, EMLAttribute, EMLEntity, 
    		DataPreviewView, 
    		EMLAttributeView,
    		EMLEntityTemplate){
        
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
            	"change"            : "updateModel",
            	"click .nav-tabs a" : "showTab",
            	"keyup .eml-attribute.new" : "addNewAttribute"
            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.model = options.model || new EMLEntity();
            	this.DataONEObject = options.DataONEObject;
            },
            
            render: function(){
            	
            	this.renderEntityTemplate();
            	
            	this.renderPreview();
            	
            	this.renderAttributes();

            },
            
            renderEntityTemplate: function(){
            	var modelAttr = this.model.toJSON();
            	
            	if(!modelAttr.entityName)
            		modelAttr.title = "this data";
            	else
            		modelAttr.title = modelAttr.entityName;
            	
            	modelAttr.uniqueId = this.model.cid;
            	
            	this.$el.html(this.template( modelAttr ));
            	
            	//Initialize the modal window
            	this.$el.modal();
            },
            
            renderPreview: function(){
            	//Get the DataONEObject model
            	if(this.DataONEObject){
            		var dataPreview = new DataPreviewView({
            			model: this.DataONEObject
            		});
            		dataPreview.render();
            		this.$(".preview-container").html(dataPreview.el);
            		
            		if(dataPreview.$el.children().length){
            			this.$(".description").css("width", "calc(100% - 310px)");
            		}
            		else
            			dataPreview.$el.remove();
            	}
            },
            
            renderAttributes: function(){
            	//Render the attributes
            	var attributes      = this.model.get("attributeList"),
            		attributeListEl = this.$(".attribute-list");
            	
            	_.each(attributes, function(attr){
            		
            		var view = new EMLAttributeView({
            			model: attr
            		});
            		
            		view.render();
            		
            		attributeListEl.append(view.el);
            		
            		view.collapse();
            		
            	}, this);
            	
            	//Add a new blank attribute view at the end
            	var emlAttribute = new EMLAttribute({
        				parentModel: this.model.get("parentModel")
        			}),
            		view = new EMLAttributeView({
			            		model: emlAttribute,
			            		isNew: true
            				});
            	view.render();
            	attributeListEl.append(view.el);
            	
            	this.listenTo(emlAttribute, "change", this.addAttribute);
            },
            
            updateModel: function(e){
            	var changedAttr = $(e.target).attr("data-category");
            	
            	if(!changedAttr) return;
            	
            	this.model.set(changedAttr, $(e.target).val());
            	
            },
            
            addNewAttribute: function(e){
            	var newAttrModel = new EMLAttribute({
            			parentModel: this.model
            		}),
            		newAttrView  = new EMLAttributeView({ 
            			isNew: true,
            			model: newAttrModel
            		});
            	
            	newAttrView.render();
            	this.$(".attribute-list").append(newAttrView.el);
            	
            	this.listenTo(newAttrModel, "change", this.addAttribute);
            },
            
            addAttribute: function(emlAttribute){
            	if(!emlAttribute.isValid())
            		return;
            	
            	//Get the EML model
            	var emlModel = this.model.get("parentModel"),
            		entities = emlModel.get("entities");
            	
            	if(! _.contains(entities, emlAttribute) ){
            		entities.push(emlAttribute);
            		emlModel.trigger("change:entities");
            	}
            },
            
            showTab: function(e){
            	e.preventDefault();
       		  	$(e.target).tab('show');
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