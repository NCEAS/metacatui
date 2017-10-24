/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject', 'models/metadata/eml211/EMLAttribute', 'models/metadata/eml211/EMLEntity',
        'views/DataPreviewView',
        'views/metadata/EMLAttributeView',
        'text!templates/metadata/eml-entity.html',
        'text!templates/metadata/eml-attribute-menu-item.html'], 
    function(_, $, Backbone, DataONEObject, EMLAttribute, EMLEntity, 
    		DataPreviewView, 
    		EMLAttributeView,
    		EMLEntityTemplate,
    		EMLAttributeMenuItemTemplate){
        
        /* 
            An EMLEntityView shows the basic attributes of a DataONEObject, as described by EML
        */
        var EMLEntityView = Backbone.View.extend({
           
            tagName: "div",
            
            className: "eml-entity modal hide fade",
            
            id: null,
            
            /* The HTML template for an entity */
            template: _.template(EMLEntityTemplate),
            attributeMenuItemTemplate: _.template(EMLAttributeMenuItemTemplate),
            
            /* Events this view listens to */
            events: {
            	"change input" : "updateModel",
            	"change textarea" : "updateModel",
            	"click .nav-tabs a" : "showTab",
            	"click .attribute-menu-item" : "showAttribute",
            	"mouseover .attribute-menu-item .remove" : "previewAttrRemove",
            	"mouseout .attribute-menu-item .remove"  : "previewAttrRemove",
            	"click .attribute-menu-item .remove" : "removeAttribute"
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
            	
 	       		  	
       		  	//Set the menu height
            	var view = this;
       		  	this.$el.on("shown", function(){
       		  		view.setAttrMenuHeight();
       		  	});
       		  		
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
            		var menuItem = $(this.attributeMenuItemTemplate({
	            			attrId: attr.cid,
	            			attributeName: attr.get("attributeName"),
	            			classes: ""
	            		})).data({ 
							model: attr,
							attributeView: view
							});
            		attributeMenuEl.append(menuItem);
            		menuItem.find(".tooltip-this").tooltip();
            		
            		this.listenTo(attr, "change:attributeName", function(attr){
            			menuItem.find(".name").text(attr.get("attributeName"));
            		});
            		
            		view.render();
            		
            		attributeListEl.append(view.el);
            		            		
            		view.$el.hide();
            		
            		this.listenTo(attr, "change",  this.addAttribute);
            		this.listenTo(attr, "invalid", this.showAttributeValidation);
            		this.listenTo(attr, "valid",   this.hideAttributeValidation);
            		
            	}, this);
            	
            	//Add a new blank attribute view at the end
            	this.addNewAttribute();
            	
            	//If there are no attributes in this EML model yet, 
            	//then make sure we show a new add attribute button when the user starts typing
            	if(attributes.length == 0){
            		var onlyAttrView = this.$(".attribute-menu-item").first().data("attributeView"),
            			view = this,
            			keyUpCallback = function(){
            				//This attribute is no longer new
            				view.$(".attribute-menu-item").first().removeClass("new");
            			
            				//Add a new attribute link and view
            				view.addNewAttribute();
            				
            				//Don't listen to keyup anymore
            				onlyAttrView.$el.off("keyup", keyUpCallback);
            			};
            		
            		onlyAttrView.$el.on("keyup", keyUpCallback);
            	}
            	
        		//Activate the first navigation item
        		var firstAttr = this.$(".side-nav-item").first();
        		firstAttr.addClass("active");
        		
        		//Show the first attribute view
        		firstAttr.data("attributeView").$el.show();
        		
        		firstAttr.data("attributeView").postRender();
        		        		
            },
            
            updateModel: function(e){
            	var changedAttr = $(e.target).attr("data-category");
            	
            	if(!changedAttr) return;
            	
            	this.model.set(changedAttr, $(e.target).val());
            	
            },
            
            addNewAttribute: function(){
            	var newAttrModel = new EMLAttribute({
            			parentModel: this.model,
                        xmlID: DataONEObject.generateId()
            		}),
            		newAttrView  = new EMLAttributeView({ 
            			isNew: true,
            			model: newAttrModel
            		});
            	
            	newAttrView.render();
            	this.$(".attribute-list").append(newAttrView.el);
            	newAttrView.$el.hide();
            	
            	//Change the last menu item if it still says "Add attribute"
            	if(this.$(".attribute-menu-item").length == 1){
            		var firstAttrMenuItem = this.$(".attribute-menu-item").first();
            		
            		if( firstAttrMenuItem.find(".name").text() == "Add attribute" ){
            			firstAttrMenuItem.find(".name").text("New attribute");
            			firstAttrMenuItem.find(".add").hide();
            		}
            	}
            	
            	//Create the new menu item
            	var menuItem = $(this.attributeMenuItemTemplate({
	            		attrId: newAttrModel.cid,
	            		attributeName: "Add attribute",
	            		classes: "new"
	            	})).data({ 
						model: newAttrModel,
						attributeView: newAttrView
					});   
            	menuItem.find(".add").show();
            	this.$(".attribute-menu").append(menuItem);
            	menuItem.find(".tooltip-this").tooltip();
        		
            	//When the attribute name is changed, update the navigation
        		this.listenTo(newAttrModel, "change:attributeName", function(attr){
        			menuItem.find(".name").text(attr.get("attributeName"));
        			menuItem.find(".add").hide();
        		});
        		
            	this.listenTo(newAttrModel, "change",  this.addAttribute);
            	this.listenTo(newAttrModel, "invalid", this.showAttributeValidation);
            	this.listenTo(newAttrModel, "valid",   this.hideAttributeValidation);
            },
                        
            addAttribute: function(emlAttribute){
            	//Add the attribute to the attribute list in the EMLEntity model
            	if( !_.contains(this.model.get("attributeList"), emlAttribute) )
            		this.model.addAttribute(emlAttribute);            		
            },
            
            removeAttribute: function(e){
            	var removeBtn = $(e.target);
            	
            	var menuItem  = removeBtn.parents(".attribute-menu-item"),
            		attrModel = menuItem.data("model");
            	
            	if(attrModel){
            		//Remove the attribute from the model
            		this.model.removeAttribute(attrModel);
            	
            		//If this menu item is active, then make the next attribute active instead
            		if(menuItem.is(".active")){
            			var nextMenuItem = menuItem.next();
            			
            			if(!nextMenuItem.length || nextMenuItem.is(".new")){
            				nextMenuItem = menuItem.prev();
            			}
            			
            			if(nextMenuItem.length){
	            			nextMenuItem.addClass("active");
	            			
	            			this.showAttribute(nextMenuItem.data("model"));
            			}
            		}
            			
            		//Remove the elements for this attribute from the page
            		menuItem.remove();
	            	this.$(".eml-attribute[data-attribute-id='" + attrModel.cid + "']").remove();
	            	$(".tooltip").remove();
	            	
	            	this.model.trickleUpChange();
            	}
            },
            
            setAttrMenuHeight: function(e){
            	var attrMenuHeight = this.$(".modal-body").height() - this.$(".nav-tabs").height();

            	this.$(".attribute-menu").css("height", attrMenuHeight + "px");
            },
            
            /*
             * Shows the attribute in the attribute editor
             * Param e - JS event or attribute model
             */
            showAttribute: function(e){
            	
            	if(e.target){
                   	var clickedEl = $(e.target),
                   		menuItem = clickedEl.is(".attribute-menu-item") || clickedEl.parents(".attribute-menu-item");  
                	
                	if(clickedEl.is(".remove"))
                		return;
            	}
            	else{
            		var menuItem = this.$(".attribute-menu-item[data-attribute-id='" + e.cid + "']");
            	}
            	
            	if(!menuItem)
            		return;
            	
            	//If the user clicked on the add attribute link
            	if( menuItem.is(".new") && this.$(".new.attribute-menu-item").length < 2 ){
            		
            		//Change the attribute menu item
            		menuItem.removeClass("new").find(".name").text("New attribute");
            		this.$(".eml-attribute.new").removeClass("new");
            		menuItem.find(".add").hide();
            		
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
            	
            	attrView.postRender();
            },
            
            /*
             * Show the attribute validation errors in the attribute navigation menu
             */
            showAttributeValidation: function(attr){
            	
            	var attrLink = this.$(".attribute-menu-item[data-attribute-id='" + attr.cid + "']").find("a");
            	
            	//If the validation is already displayed, then exit
            	if(attrLink.is(".error")) return;
            	
            	var errorIcon = $(document.createElement("i")).addClass("icon icon-exclamation-sign error icon-on-left");
            	
            	attrLink.addClass("error").prepend(errorIcon);
            },
            
            /*
             * Hide the attribute validation errors from the attribute navigation menu
             */
            hideAttributeValidation: function(attr){
            	this.$(".attribute-menu-item[data-attribute-id='" + attr.cid + "']")
            		.find("a").removeClass("error").find(".icon.error").remove();
            },
            
            /*
             * Show the user what will be removed when this remove button is clicked
             */
            previewAttrRemove: function(e){
            	var removeBtn = $(e.target);
            	
            	removeBtn.parents(".attribute-menu-item").toggleClass("remove-preview");            	
            },
            
            /*
             * Show the entity overview or attributes tab
             * depending on the click target
             */
            showTab: function(e){
            	e.preventDefault();
            	
            	//Get hte clicked link
       		  	var link = $(e.target);
       		  	
       		  	//Remove the active class from all links and add it to the new active link
       		  	this.$(".nav-tabs li").removeClass("active");
       		  	link.parent("li").addClass("active");
       		  	
       		  	//Hide all the panes and show the correct one
       		  	this.$(".tab-pane").hide();
       		  	this.$(link.attr("href")).show();

            },
            
            /*
             * Show the entity in a modal dialog
             */
            show: function(){
            	
            	this.$el.modal('show');    
            	
            },
            
            /*
             * Hide the entity modal dialog
             */
            hide: function(){
            	this.$el.modal('hide');
            }
        });
        
        return EMLEntityView;
});