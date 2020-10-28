/* global define */
define(['underscore', 'jquery', 'backbone', 'localforage',
        'models/DataONEObject', 'models/metadata/eml211/EMLAttribute', 'models/metadata/eml211/EMLEntity',
        'views/DataPreviewView',
        'views/metadata/EMLAttributeView',
        'text!templates/metadata/eml-entity.html',
        'text!templates/metadata/eml-attribute-menu-item.html'],
    function(_, $, Backbone, LocalForage, DataONEObject, EMLAttribute, EMLEntity,
        DataPreviewView,
        EMLAttributeView,
        EMLEntityTemplate,
        EMLAttributeMenuItemTemplate){

        /**
        * @class EMLEntityView
        * @classdesc An EMLEntityView shows the basic attributes of a DataONEObject, as described by EML
        * @classcategory Views/Metadata
        * @extends Backbone.View
        */
        var EMLEntityView = Backbone.View.extend(
          /** @lends EMLEntityView.prototype */{

            tagName: "div",

            className: "eml-entity modal hide fade",

            id: null,

            /* The HTML template for an entity */
            template: _.template(EMLEntityTemplate),
            attributeMenuItemTemplate: _.template(EMLAttributeMenuItemTemplate),

            /* Events this view listens to */
            events: {
              "change" : "saveDraft",
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

              this.listenTo(this.model, "invalid", this.showValidation);
              this.listenTo(this.model, "valid", this.showValidation);

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
                 view.adjustHeight();
                 view.setMenuWidth();

                 window.addEventListener('resize', function(event){
                   view.adjustHeight();
                   view.setMenuWidth();
                 });
               });

              this.$el.on("hidden", function(){
                view.showValidation();
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
                    view.$(".attribute-menu-item.new").first().removeClass("new");
                    view.$(".attribute-list .eml-attribute.new").first().removeClass("new");

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

              var emlModel = this.model.getParentEML(),
                  newValue = emlModel? emlModel.cleanXMLText($(e.target).val()) : $(e.target).val();

              this.model.set(changedAttr, newValue);

              this.model.trickleUpChange();

            },

            addNewAttribute: function(){

              //Check if there is already a new attribute view
              if( this.$(".attribute-list .eml-attribute.new").length ){
                return;
              }

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

            adjustHeight: function(e){
              var contentAreaHeight = this.$(".modal-body").height() - this.$(".nav-tabs").height();

              this.$(".attribute-menu, .attribute-list").css("height", contentAreaHeight + "px");
            },

            setMenuWidth: function(){

              this.$(".entity-container .nav").width( this.$el.width() );

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

              //Validate the previously edited attribute
              //Get the current active attribute
              var activeAttrTab = this.$(".attribute-menu-item.active");

              //If there is a currently-active attribute tab,
              if( activeAttrTab.length ){
                //Get the attribute list from this view's model
                var emlAttributes = this.model.get("attributeList");

                //If there is an EMLAttribute list,
                if( emlAttributes && emlAttributes.length ){

                  //Get the active EMLAttribute
                  var activeEMLAttribute = _.findWhere(emlAttributes, { cid: activeAttrTab.attr("data-attribute-id") });

                  //If there is an active EMLAttribute model, validate it
                  if( activeEMLAttribute ){
                    activeEMLAttribute.isValid();
                  }

                }

              }

              //If the user clicked on the add attribute link
              if( menuItem.is(".new") && this.$(".new.attribute-menu-item").length < 2 ){

                //Change the attribute menu item
                menuItem.removeClass("new").find(".name").text("New attribute");
                this.$(".eml-attribute.new").removeClass("new");
                menuItem.find(".add").hide();

                //Add a new attribute view and menu item
                this.addNewAttribute();

                //Scroll the attribute menu to the bottom so that the "Add New" button is always visible
                var attrMenuHeight = this.$(".attribute-menu").scrollTop() + this.$(".attribute-menu").height();
                this.$(".attribute-menu").scrollTop( attrMenuHeight );
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

              //Scroll to the top of the attribute view
              this.$(".attribute-list").scrollTop(0);

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
            * function showValidation
            *
            * Will display validation styling and messaging. Should be called after
            * this view's model has been validated and there are error messages to display
            */
            showValidation: function(){

              //Reset the error messages and styling
              //Only change elements inside the overview-container which contains only the
              // EMLEntity metadata. The Attributes will be changed by the EMLAttributeView.
              this.$(".overview-container .notification").text("");
              this.$(".overview-tab .icon.error, .attributes-tab .icon.error").remove();
              this.$(".overview-container, .overview-tab a, .attributes-tab a, .overview-container .error").removeClass("error");

              var overviewTabErrorIcon  = false,
                  attributeTabErrorIcon = false;

              _.each( this.model.validationError, function(errorMsg, category){

                if( category == "attributeList" ){

                  //Create an error icon for the Attributes tab
                  if( !attributeTabErrorIcon ){
                    var errorIcon = $(document.createElement("i"))
                                      .addClass("icon icon-on-left icon-exclamation-sign error")
                                      .attr("title", "There is missing information in this tab");

                    //Add the icon to the Overview tab
                    this.$(".attributes-tab a").prepend(errorIcon).addClass("error");
                  }

                  return;
                }

                //Get all the elements for this category and add the error class
                this.$(".overview-container [data-category='" + category + "']").addClass("error");
                //Get the notification element for this category and add the error message
                this.$(".overview-container .notification[data-category='" + category + "']").text(errorMsg);

                //Create an error icon for the Overview tab
                if( !overviewTabErrorIcon ){
                  var errorIcon = $(document.createElement("i"))
                                    .addClass("icon icon-on-left icon-exclamation-sign error")
                                    .attr("title", "There is missing information in this tab");

                  //Add the icon to the Overview tab
                  this.$(".overview-tab a").prepend(errorIcon).addClass("error");

                  overviewTabErrorIcon = true;
                }

              }, this);

            },

            /*
             * Show the entity overview or attributes tab
             * depending on the click target
             */
            showTab: function(e){
              e.preventDefault();

              //Get the clicked link
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
            },

            /**
             * Save a draft of the parent EML model
             */
            saveDraft: function() {
              var view = this;

              try {
                var model = this.model.getParentEML();
                var title = model.get("title") || "No title";

                LocalForage.setItem(model.get("id"),
                {
                  id: model.get("id"),
                  datetime: (new Date()).toISOString(),
                  title: Array.isArray(title) ? title[0] : title,
                  draft: model.serialize()
                }).then(function() {
                  view.clearOldDrafts();
                });
              } catch (ex) {
                console.log("Error saving draft:", ex);
              }
            },

            /**
             * Clear older drafts by iterating over the sorted list of drafts
             * stored by LocalForage and removing any beyond a hardcoded limit.
             */
             clearOldDrafts: function() {
               var drafts = [];

              try {
                LocalForage.iterate(function(value, key, iterationNumber) {
                // Extract each draft
                drafts.push({
                    key: key,
                    value: value
                  });
                }).then(function(){
                  // Sort by datetime
                  drafts = _.sortBy(drafts, function(draft) {
                    return draft.value.datetime.toString();
                  }).reverse();
                }).then(function() {
                  _.each(drafts, function(draft, i) {
                    var age = (new Date()) - new Date(draft.value.datetime);
                    var isOld = (age / 2678400000) > 1; // ~31days
                    // Delete this draft is not in the most recent 100 or
                    // if older than 31 days
                    var shouldDelete = i > 100 || isOld;
                      if (!shouldDelete) {
                        return;
                      }

                      LocalForage.removeItem(draft.key).then(function() {
                        // Item should be removed
                      });
                    })
                  });
              }
              catch (ex) {
                console.log("Failed to clear old drafts: ", ex);
              }
            }
          });

        return EMLEntityView;
});
