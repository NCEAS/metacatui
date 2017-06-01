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
            	"change"            		 : "updateModel",
            	"click .nav-tabs a" 		 : "showTab",
            	"click .attribute-menu-item" : "showAttribute"
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
            		attributeListEl = this.$(".attribute-list"),
            		attributeMenuEl = this.$(".attribute-menu");
            	
            	_.each(attributes, function(attr){
            		
            		//Create an EMLAttributeView 
            		var view = new EMLAttributeView({
            			model: attr
            		});
            		
            		//Create a link in the attribute menu
            		attributeMenuEl.append( $(document.createElement("li"))
            									.addClass("attribute-menu-item side-nav-item pointer")
            									.attr("data-attribute-id", attr.cid)
            									.data({ 
            										model: attr,
            										attributeView: view
            										})
            									.append( $(document.createElement("a"))
            												.addClass("ellipsis")
            												.text(attr.get("attributeName")) ));
            		
            		this.listenTo(attr, "change:attributeName", function(attr){
            			this.$("[data-attribute-id='" + attr.cid + "'] a").text(attr.get("attributeName"));
            		});
            		
            		view.render();
            		
            		attributeListEl.append(view.el);
            		
            		view.$el.hide();
            		
            	}, this);
            	
            	//Add a new blank attribute view at the end
            	this.addNewAttribute();
            	
        		//Activate the first navigation item
        		var firstAttr = this.$(".side-nav-item").first();
        		firstAttr.addClass("active");
        		
        		//Show the first attribute view
        		firstAttr.data("attributeView").$el.show();
        		        		
            	this.listenTo(emlAttribute, "change", this.addAttribute);
            },
            
            updateModel: function(e){
            	var changedAttr = $(e.target).attr("data-category");
            	
            	if(!changedAttr) return;
            	
            	this.model.set(changedAttr, $(e.target).val());
            	
            },
            
            addNewAttribute: function(){
            	var newAttrModel = new EMLAttribute({
            			parentModel: this.model
            		}),
            		newAttrView  = new EMLAttributeView({ 
            			isNew: true,
            			model: newAttrModel
            		});
            	
            	newAttrView.render();
            	this.$(".attribute-list").append(newAttrView.el);
            	newAttrView.$el.hide();
            	
            	this.$(".attribute-menu").append( $(document.createElement("li"))
        				.addClass("attribute-menu-item side-nav-item new pointer")
						.attr("data-attribute-id", newAttrModel.cid)
						.data({ 
							model: newAttrModel,
							attributeView: newAttrView
							})
						.append( $(document.createElement("a"))
									.addClass("ellipsis")
									.append( $(document.createElement("i")).addClass("icon icon-on-left icon-plus"), "Add attribute") ));
        		
            	//When the attribute name is changed, update the navigation
        		this.listenTo(newAttrModel, "change:attributeName", function(attr){
        			this.$("[data-attribute-id='" + attr.cid + "'] a").text(attr.get("attributeName"));
        		});
        		
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
            
            setAttrMenuHeight: function(e){
            	var attrMenuHeight = this.$(".modal-body").height() - this.$(".nav-tabs").height();

            	this.$(".attribute-menu").css("height", attrMenuHeight + "px");
            },
            
            showAttribute: function(e){
            	var clickedEl = $(e.target),
            		menuItem = clickedEl.is(".attribute-menu-item") || clickedEl.parent();
            	
            	//If the user clicked on the add attribute link
            	if( menuItem.is(".new") ){

            		//Change the attribute menu item
            		menuItem.removeClass("new").find("a").text("New attribute");
            		this.$(".eml-attribute.new").removeClass("new");
            		
            		//Add a new attribute view and menu item
            		this.addNewAttribute();
            	}
            	
            	//Get the attribute view
            	var attrView = menuItem.data("attributeView");
            	            	
            	//Change the active attribute in the menu
            	this.$(".attribute-menu-item.active").removeClass("active");
            	menuItem.addClass("active");
            	
            	//Hide the old attribute view
            	this.$(".eml-attribute").hide();
            	//Show the new attribute view
            	attrView.$el.show();
            },
            
            showTab: function(e){
            	e.preventDefault();
            	
       		  	var link = $(e.target);
       		  	       		  	
       		  	//Set the menu height
       		  	if(link.attr("href").indexOf("attribute") > -1)
       		  		this.setAttrMenuHeight();
       		  	
       		  	link.tab('show');

            },
            
            show: function(){
            	
            	if( this.$(".nav-tabs .attributes-tab.active").length )
            		this.setAttrMenuHeight();
            	
            	this.$el.modal('show');         	
            },
            
            hide: function(){
            	this.$el.modal('hide');
            }
        });
        
        return EMLEntityView;
});