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

        //Iterate over each AccessRule in the AccessPolicy and render a AccessRuleView
        this.collection.each(function(accessRule){

          //Create an AccessRuleView
          var accessRuleView = new AccessRuleView();
          accessRuleView.model = accessRule;
          accessRuleView.accessPolicyView = this;

          //Add the AccessRuleView to this view
          this.$(".access-rules-container").append(accessRuleView.el);

          //Render the view
          accessRuleView.render();

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
