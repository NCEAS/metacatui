define(['underscore',
        'jquery',
        'backbone',
        "models/AccessRule",
        "collections/AccessPolicy",
        "views/AccessRuleView",
        "text!templates/accessPolicy.html",
        "text!templates/filters/toggleFilter.html"],
function(_, $, Backbone, AccessRule, AccessPolicy, AccessRuleView, Template, ToggleTemplate){

  /**
  * @class AccessPolicyView
  * @classdesc A view of an Access Policy of a DataONEObject
  * @classcategory Views
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
    toggleTemplate: _.template(ToggleTemplate),

    /**
     * Used to track the collection of models set on the view in order to handle
     * undoing all changes made when we either hit Cancel or click otherwise
     * hide the modal (such as clicking outside of it).
     */
    cachedModels: null,

    /**
     * Whether or not changes to the accessPolicy managed by this view will be
     * broadcasted to the accessPolicy of the editor's rootDataPackage's
     * packageModle.
     *
     * This implementation is very likely to change in the future as we iron out
     * how to handle bulk accessPolicy (and other) changes.
     */
    broadcast: false,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "change .public-toggle-container input" : "togglePrivacy",
      "click .save" : "save",
      "click .cancel": "reset",
      "click .access-rule .remove" : "handleRemove"
    },

    /**
    * Creates a new AccessPolicyView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options) {
      this.cachedModels = _.clone(this.collection.models);
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
              this.resourceType = "metadata record";
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
          resourceType: this.resourceType,
          fileName: dataONEObject.get("fileName")
        }));

        //If the user is not authorized to change the permissions of this object,
        // then skip rendering the rest of the AccessPolicy.
        if( dataONEObject.get("isAuthorized_changePermission") === false ){
          this.showUnauthorized();
          return;
        }

        //Show the rightsHolder as an AccessRuleView
        this.showRightsholder();

        var modelsToRemove = [];

        //Iterate over each AccessRule in the AccessPolicy and render a AccessRuleView
        this.collection.each(function(accessRule){

          //Don't display access rules for the public since these are controlled via the public/private toggle
          if( accessRule.get("subject") == "public" ){
            return;
          }

          //If this AccessRule is a duplicate of the rightsHolder, remove it from the policy and don't display it
          if( accessRule.get("subject") == dataONEObject.get("rightsHolder") ){
            modelsToRemove.push(accessRule);
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

        //Remove each AccessRule from the AccessPolicy that should be removed.
        // We don't remove these during the collection.each() function because it
        // messes up the .each() iteration.
        this.collection.remove(modelsToRemove);

        //Get the subject info for each subject in the AccessPolicy, so we can display names
        this.collection.getSubjectInfo();

        //Show a blank row at the bottom of the table for adding a new Access Rule.
        this.addEmptyRow();

        //Render various help text for this view
        this.renderHelpText();

        //Render the public/private toggle, if it's enabled in the app config
        if( MetacatUI.appModel.get("showPortalPublicToggle") !== false ){
          var enabledSubjects = MetacatUI.appModel.get("showPortalPublicToggleForSubjects");

          if( Array.isArray(enabledSubjects) && enabledSubjects.length ){

            var usersGroups = _.pluck(MetacatUI.appUserModel.get("isMemberOf"), "groupId");
            if( _.contains(enabledSubjects, MetacatUI.appUserModel.get("username")) ||
                _.intersection(enabledSubjects, usersGroups).length){
                this.renderPublicToggle();
            }

          }
          else{
            this.renderPublicToggle();
          }

        }

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
    * Renders a public/private toggle that toggles the public readability of the given resource.
    */
    renderPublicToggle: function(){

      var view = this;

      //Render the private/public toggle
      this.$(".public-toggle-container").html(
        this.toggleTemplate({
          label: "",
          id: this.collection.id,
          trueLabel: "Public",
          falseLabel: "Private"
        })
      ).tooltip({
        placement: "top",
        trigger: "hover",
        title: function(){
          if( view.collection.isPublic() ){
            return "Your " + view.resourceType + " is public. Anyone can see this content."
          }
          else{
            return "Your " + view.resourceType + " is private. Only people you approve can see this content."
          }
        },
        container: this.$(".public-toggle-container"),
        delay: {
          show: 800
        }
      });

      //If the dataset is public, check the checkbox
      this.$(".public-toggle-container input").prop("checked", this.collection.isPublic());
    },

    /**
    * Render a row with input elements for adding a new AccessRule
    */
    addEmptyRow: function(){

      try{

        //Create a new AccessRule model and add to the collection
        var accessRule = new AccessRule({
          read: true,
          dataONEObject: this.collection.dataONEObject
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

      //Get the name for this new person or group
      accessRule.getSubjectInfo();

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
    * @param {AccessRule} accessRuleModel
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
            // or if this is the rightsHolder, keep them the rightsHolder
            if( !rightsHolder || rightsHolder == accessRuleModel.get("subject")){

              //Change this access rule back to an ownership level, since there needs to be at least one owner per object
              accessRuleModel.set({
                "read" : true,
                "write" : true,
                "changePermission" : true
              });

              this.showOwnerWarning();

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

            //Replace the rightsHolder with a different subject with ownership permissions
            this.collection.replaceRightsHolder();

            //Add the old rightsHolder AccessRule to the AccessPolicy
            this.collection.add(accessRuleModel);

          }
        }

      }
      catch(e){
        console.error("Could not check that there are owners in this access policy: ", e);
      }

    },

    /**
    * Checks that there is at least one owner of this resource, and displays a warning message if not.
    * @param {Event} e
    */
    handleRemove: function(e){

      var accessRuleModel = $(e.target).parents(".access-rule").data("model");

      //Get the rightsHolder for this resource
      var rightsHolder;
      if( this.collection.dataONEObject && this.collection.dataONEObject.get("rightsHolder") ){
        rightsHolder = this.collection.dataONEObject.get("rightsHolder");
      }

      //If the rightsHolder was just removed,
      if( rightsHolder == accessRuleModel.get("subject") ){

        //If changing the rightsHolder is disabled, we don't need to check for owners,
        // since the rightsHolder will always be the owner.
        if( !MetacatUI.appModel.get("allowChangeRightsHolder") || !MetacatUI.appModel.get("displayRightsHolderInAccessPolicy") ){
          return;
        }

        //If there is another owner of this resource
        if( this.collection.hasOwner() ){

          //Replace the rightsHolder with a different subject with ownership permissions
          this.collection.replaceRightsHolder();

          var accessRuleView = $(e.target).parents(".access-rule").data("view");
          if( accessRuleView ){
            accessRuleView.remove();
          }

        }
        //If there are no other owners of this dataset, keep this person as the rightsHolder
        else{
          this.showOwnerWarning();
        }

      }
      else{
        //Remove the AccessRule from the AccessPolicy
        this.collection.remove(accessRuleModel);
      }

    },

    /**
    * Displays a warning message in this view that the object needs at least one owner.
    */
    showOwnerWarning: function(){
      //Show warning message
      var msgContainer = this.$(".modal-body").length? this.$(".modal-body") : this.$el;
      MetacatUI.appView.showAlert("At least one person or group needs to be an owner of this " + this.resourceType + ".",
                                  "alert-warning",
                                  msgContainer,
                                  2000,
                                  { remove: true });
    },

    /**
    * Renders help text for the form in this view
    */
    renderHelpText: function(){

      try{
        //Create HTML that shows the access policy help text
        var accessExplanationEl = $(document.createElement("div")),
            listEl              = $(document.createElement("ul")).addClass("unstyled");

        accessExplanationEl.append(listEl);

        //Get the AccessRule options names
        var accessRuleOptionNames = MetacatUI.appModel.get("accessRuleOptionNames");
        if( typeof accessRuleOptionNames !== "object" || !Object.keys(accessRuleOptionNames).length ){
          accessRuleOptionNames = {};
        }

        //Create HTML that shows an explanation of each enabled access rule option
        _.mapObject(MetacatUI.appModel.get("accessRuleOptions"), function(isEnabled, accessType){

          //If this access type is disabled, exit
          if( !isEnabled ){
            return;
          }

          var accessTypeExplanation = "",
              accessTypeName = accessRuleOptionNames[accessType];

          //Get explanation text for the given access type
          switch( accessType ){
            case "read":
              accessTypeExplanation = " - can view this content, even when it's private.";
              break;
            case "write":
              accessTypeExplanation = " - can view and edit this content, even when it's private.";
              break;
            case "changePermission":
              accessTypeExplanation = " - can view and edit this content, even when it's private. In addition, can add and remove other people from these " + MetacatUI.appModel.get("accessPolicyName") + ".";
              break;
          }

          //Add this to the list
          listEl.append($(document.createElement("li")).append(
                          $(document.createElement("h5")).text(accessTypeName),
                          $(document.createElement("span")).text(accessTypeExplanation)));

        });

        //Add a popover to the Access column header to give more help text about the access types
        this.$(".access-icon.popover-this").popover({
          title: "What does \"Access\" mean?",
          delay: {
            show: 800
          },
          placement: "top",
          trigger: "hover focus click",
          container: this.$el,
          html: true,
          content: accessExplanationEl
        });
      }
      catch(e){
        console.error("Could not render help text", e);
      }
    },

    /**
    * Toggles the public-read AccessRule for this resource
    */
    togglePrivacy: function(){

      //If this AccessPolicy is public already, make it private
      if( this.collection.isPublic() ){
        this.collection.makePrivate();
      }
      //Otherwise, make it public
      else{
        this.collection.makePublic();
      }

    },

    /**
    * Saves the AccessPolicy associated with this view
    */
    save: function(){

      //Remove any alerts that are currently displayed
      this.$(".alert-container").remove();

      //Get the DataONE Object that this Access Policy is for
      var dataONEObject = this.collection.dataONEObject;

      if( !dataONEObject ){
        return;
      }

      //Show the save progress as it is in progress, complete, in error, etc.
      this.listenTo(dataONEObject, "change:uploadStatus", this.showSaveProgress);

      if (this.broadcast) {
        MetacatUI.rootDataPackage.broadcastAccessPolicy(this.collection);
      }

      //Update the SystemMetadata for this object
      dataONEObject.updateSysMeta();

    },

    /**
    * Show visual cues in this view to show the user the status of the system metadata update.
    * @param {DataONEObject} dataONEObject - The object being updated
    */
    showSaveProgress: function(dataONEObject){
      if( !dataONEObject ){
        return;
      }

      var status = dataONEObject.get("uploadStatus");

      //When the status is "in progress"
      if( status == "p" ){
        //Disable the Save button and change the text to say, "Saving..."
        this.$(".save.btn").text("Saving...").attr("disabled", "disabled");
        this.$(".cancel.btn").attr("disabled", "disabled");

        return;
      }
      //When the status is "complete"
      else if( status == "c" ){
        //Create a checkmark icon
        var icon = $(document.createElement("i")).addClass("icon icon-ok icon-on-left"),
            cancelBtn = this.$(".cancel.btn");
            saveBtn = this.$(".save.btn");

        //Disable the Save button and change the text to say, "Saving..."
        cancelBtn.text("Saved").removeAttr("disabled");
        saveBtn.text("Saved").prepend(icon).removeAttr("disabled");

        setTimeout(function(){ saveBtn.empty().text("Save") }, 2000);

        this.cachedModels = _.clone(this.collection.models);

        // Hide the modal only on a successful save
        $(this.$el).modal("hide");
      }
      //When the status is "error"
      else if( status == "e" ){
        var msgContainer = this.$(".modal-body").length? this.$(".modal-body") : this.$el;

        MetacatUI.appView.showAlert(
          "Your changes could not be saved.",
          "alert-error",
          msgContainer,
          0,
          { remove: true });

        //Reset the save button
        this.$(".save.btn").text("Save").removeAttr("disabled");
      }

      //Remove the listener for this function
      this.stopListening(dataONEObject, "change:uploadStatus", this.showSaveProgress);
    },

    /**
    * Resets the state of the models stored in the view's collection to the
    * latest cached copy. Triggered either when the Cancel button is hit or
    * the modal containing this view is hidden.
    */
    reset: function() {
      if (!this.collection || !this.cachedModels) {
        return;
      }

      this.collection.set(this.cachedModels);
    },

    /**
    * Adds messaging to this view to tell the user they are unauthorized to change the AccessPolicy
    * of this object(s)
    */
    showUnauthorized: function(){

      //Get the container element for the message
      var msgContainer = this.$(".modal-body").length? this.$(".modal-body") : this.$el;

      //Empty the container element
      msgContainer.empty();

      //Show the info message
      MetacatUI.appView.showAlert("The person who owns this " + this.resourceType + " has not given you permission to change the " +
                                    MetacatUI.appModel.get("accessPolicyName") + ". Contact the owner to be added " +
                                    " as another owner of this " + this.resourceType + ".",
                                  "alert-info subtle",
                                  msgContainer,
                                  null,
                                  { remove: false });

      //Add an unauthorized class to this view for further styling options
      this.$el.addClass("unauthorized");

    }

  });

  return AccessPolicyView;

});
