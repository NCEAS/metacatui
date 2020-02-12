define(['underscore',
        'jquery',
        'backbone',
        "models/AccessRule",
        "collections/AccessPolicy",
        "views/AccessRuleView",
        "text!templates/accessPolicy.html"],
function(_, $, Backbone, AccessRule, AccessPolicy, AccessRuleView, Template){

  /**
  * @class AccessPolicyView
  * @classdesc A view of an Access Policy of a DataONEObject
  * @extends Backbone.View
  * @constructor
  */
  var AccessPolicyView = Backbone.View.extend(
    /** @lends AccessPolicyView.prototype */
    {

    /**
    * The type of View this is
    * @type {string}
    */
    type: "AccessPolicy",

    /**
    * The type of object/resource that this AccessPolicy is for.
    * @example "dataset", "portal", "data file"
    * @type {string}
    */
    resourceType: "resource",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "access-policy-view",

    /**
    * The AccessPolicy collection that is displayed in this View
    * @type {AccessPolicy}
    */
    collection: undefined,

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    * @type {Underscore.Template}
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "click .public"   : "makePublic",
      "click .private"  : "makePrivate",
      "click .save"     : "save"
    },

    /**
    * Creates a new AccessPolicyView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders this view
    */
    render: function(){

      try{

        //If there is no AccessPolicy collection, then exit now
        if( !this.collection ){
          return;
        }

        var dataONEObject = this.collection.dataONEObject;

        if(dataONEObject && dataONEObject.type){
          switch( dataONEObject.type ){
            case "Portal":
              this.resourceType = MetacatUI.appModel.get("portalTermSingular");
              break;
            case "DataPackage":
              this.resourceType = "dataset";
              break;
            case ("EML" || "ScienceMetadata"):
              this.resourceType = "science metadata";
              break;
            case "DataONEObject":
              this.resourceType = "data file";
              break;
            case "Collection":
              this.resourceType = "collection";
              break;
            default:
              this.resourceType = "resource";
              break;
          }
        }
        else{
          this.resourceType = "resource";
        }

        //Insert the template into this view
        this.$el.html(this.template({
          resourceType: this.resourceType
        }));

        //Show the rightsHolder as an AccessRuleView
        this.showRightsholder();

        //Iterate over each AccessRule in the AccessPolicy and render a AccessRuleView
        this.collection.each(function(accessRule){

          //If this AccessRule is a duplicate of the rightsHolder, remove it from the policy and don't display it
          if( accessRule.get("subject") == dataONEObject.get("rightsHolder") ){
            this.collection.remove(accessRule);
            return;
          }

          //Create an AccessRuleView
          var accessRuleView = new AccessRuleView();
          accessRuleView.model = accessRule;
          accessRuleView.accessPolicyView = this;

          //Add the AccessRuleView to this view
          this.$(".access-rules-container").append(accessRuleView.el);

          //Render the view
          accessRuleView.render();

          //Listen to changes on the access rule, to check that there is at least one owner
          this.listenTo(accessRule, "change:read change:write change:changePermission", this.checkForOwners);

        }, this);

        //Get the subject info for each subject in the AccessPolicy, so we can display names
        this.collection.getSubjectInfo();

        //Show a blank row at the bottom of the table for adding a new Access Rule.
        this.addEmptyRow();

      }
      catch(e){
        MetacatUI.appView.showAlert("Something went wrong while trying to display the " +
                                      MetacatUI.appModel.get("accessPolicyName") +
                                      ". <p>Technical details: " + e.message + "</p>",
                                    "alert-error",
                                    this.$el,
                                    null);
        console.error(e);
      }

    },

    /**
    * Render a row with input elements for adding a new AccessRule
    */
    addEmptyRow: function(){

      try{

        //Create a new AccessRule model and add to the collection
        var accessRule = new AccessRule({
          read: true
        });

        //Create a new AccessRuleView
        var accessRuleView = new AccessRuleView();
        accessRuleView.model = accessRule;
        accessRuleView.isNew = true;

        this.listenTo(accessRule, "change", this.addAccessRule);

        //Add the new row to the table
        this.$(".access-rules-container").append(accessRuleView.el);

        //Render the AccessRuleView
        accessRuleView.render();
      }
      catch(e){
        console.error("Something went wrong while adding the empty access policy row ", e);
      }

    },

    /**
    * Adds the given AccessRule model to the AccessPolicy collection associated with this view
    * @param {AccessRule} accessRule - The AccessRule to add
    */
    addAccessRule: function(accessRule){

      //If this AccessPolicy already contains this AccessRule, then exit
      if( this.collection.contains(accessRule) ){
        return;
      }

      //If there is no subject set on this AccessRule, exit
      if( !accessRule.get("subject") ){
        return;
      }

      //Add the AccessRule to the AccessPolicy
      this.collection.push(accessRule);

      //Render a new empty row
      this.addEmptyRow();

    },

    /**
    * Adds an AccessRuleView that represents the rightsHolder of the object.
    *  The rightsHolder needs to be handled specially because it's not a regular access rule in the system metadata.
    */
    showRightsholder: function(){

      //If the app is configured to hide the rightsHolder, then exit now
      if( !MetacatUI.appModel.get("displayRightsHolderInAccessPolicy") ){
        return;
      }

      //Get the DataONEObject associated with this access policy
      var dataONEObject = this.collection.dataONEObject;

      //If there is no DataONEObject associated with this access policy, then exit
      if( !dataONEObject || !dataONEObject.get("rightsHolder") ){
        return;
      }

      //Create an AccessRule model that represents the rightsHolder
      var accessRuleModel = new AccessRule({
        subject: dataONEObject.get("rightsHolder"),
        read: true,
        write: true,
        changePermission: true,
        dataONEObject: dataONEObject
      });

      //Create an AccessRuleView
      var accessRuleView = new AccessRuleView();
      accessRuleView.accessPolicyView = this;
      accessRuleView.model = accessRuleModel;
      accessRuleView.allowChanges = MetacatUI.appModel.get("allowChangeRightsHolder");


      //Add the AccessRuleView to this view
      if( this.$(".access-rules-container .new").length ){
        this.$(".access-rules-container .new").before(accessRuleView.el);
      }
      else{
        this.$(".access-rules-container").append(accessRuleView.el);
      }

      //Render the view
      accessRuleView.render();

      //Get the name for this subject
      accessRuleModel.getSubjectInfo();

      //When the access type is changed, check that there is still at least one owner.
      this.listenTo(accessRuleModel, "change:read change:write change:changePermission", this.checkForOwners);

    },

    /**
    * Checks that there is at least one owner of this resource, and displays a warning message if not.
    */
    checkForOwners: function(accessRuleModel){

      try{
        if( !accessRuleModel ){
          return;
        }

        //If changing the rightsHolder is disabled, we don't need to check for owners,
        // since the rightsHolder will always be the owner.
        if( !MetacatUI.appModel.get("allowChangeRightsHolder") || !MetacatUI.appModel.get("displayRightsHolderInAccessPolicy") ){
          return;
        }

        //Get the rightsHolder for this resource
        var rightsHolder;
        if( this.collection.dataONEObject && this.collection.dataONEObject.get("rightsHolder") ){
          rightsHolder = this.collection.dataONEObject.get("rightsHolder");
        }

        //Check if any priveleges have been removed
        if( !accessRuleModel.get("read") || !accessRuleModel.get("write") || !accessRuleModel.get("changePermission") ){

          //If there is no owner of this resource
          if( !this.collection.hasOwner() ){

            //If there is no rightsHolder either, then make this person the rightsHolder
            // or ff this is the rightsHolder, keep them the rightsHolder
            if( !rightsHolder || rightsHolder == accessRuleModel.get("subject")){

              //Change this access rule back to an ownership level, since there needs to be at least one owner per object
              accessRuleModel.set({
                "read" : true,
                "write" : true,
                "changePermission" : true
              });

              //Show warning message
              var msgContainer = this.$(".modal-body").length? this.$(".modal-body") : this.$el;
              MetacatUI.appView.showAlert("At least one person or group needs to be an owner of this " + this.resourceType + ".",
                                          "alert-warning",
                                          msgContainer,
                                          2000,
                                          { remove: true });

              if( !rightsHolder ){
                this.collection.dataONEObject.set("rightsHolder", accessRuleModel.get("subject"));
                this.collection.remove(accessRuleModel);
              }
            }
            //If there is a rightsHolder, we don't need to do anything
            else{
              return;
            }
          }
          //If the AccessRule model that was just changed was the rightsHolder,
          // demote that subject as the rightsHolder, and replace with another subject
          else if( rightsHolder == accessRuleModel.get("subject") ){

            var otherOwner = this.collection.findWhere({ changePermission: true });

            //Make sure another owner model was found
            if( !otherOwner ){
              return;
            }

            //Set this other owner as the rightsHolder
            this.collection.dataONEObject.set("rightsHolder", otherOwner.get("subject"));
            //Remove them as an AccessRule in the AccessPolicy
            this.collection.remove(otherOwner);
            this.collection.add(accessRuleModel);
          }
        }

      }
      catch(e){
        console.error("Could not check that there are owners in this access policy: ", e);
      }

    },

    /**
    * Makes the AccessPolicy public
    */
    makePublic: function(){

      this.collection.makePublic();

      //TODO: Update this view to indicate it is public

    },

    /**
    * Makes the AccessPolicy private
    */
    makePrivate: function(){

      this.collection.makePrivate();

      //TODO: Update this view to indicate it is private

    },

    /**
    * Saves the AccessPolicy associated with this view
    */
    save: function(){


      //Get the DataONE Object that this Access Policy is for
      var dataONEObject = this.collection.dataONEObject;

      if( !dataONEObject ){
        return;
      }

      //Show the save progress as it is in progress, complete, in error, etc.
      this.listenTo(dataONEObject, "change:uploadStatus", this.showSaveProgress);

      //Update the SystemMetadata for this object
      dataONEObject.updateSysMeta();

    },

    showSaveProgress: function(dataONEObject){
      if( !dataONEObject ){
        return;
      }

      var status = dataONEObject.get("uploadStatus");

      if( status == "p" ){
        //Disable the Save button and change the text to say, "Saving..."
        this.$(".save.btn").text("Saving...").attr("disabled", "disabled");
      }
      else if( status == "c" ){
        //Create a checkmark icon
        var icon = $(document.createElement("i")).addClass("icon icon-ok icon-on-left"),
            saveBtn = this.$(".save.btn");

        //Disable the Save button and change the text to say, "Saving..."
        saveBtn.text("Saved").prepend(icon).removeAttr("disabled");

        setTimeout(function(){ saveBtn.empty().text("Save") }, 2000);

        //Remove the listener for this function
        this.stopListening(dataONEObject, "change:uploadStatus", this.showSaveProgress);

      }
    }

  });

  return AccessPolicyView;

});
