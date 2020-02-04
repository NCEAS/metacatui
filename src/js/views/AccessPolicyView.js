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
      "click .public"  : "makePublic",
      "click .private" : "makePrivate"
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

        var dataONEObject = this.collection.getDataONEObject();

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

    }

  });

  return AccessPolicyView;

});
