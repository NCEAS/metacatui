define(['underscore',
        'jquery',
        'backbone',
        "collections/AccessPolicy",
        "views/AccessRuleView",
        "text!templates/accessPolicy.html"],
function(_, $, Backbone, AccessPolicy, AccessRuleView, Template){

  var AccessPolicyView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "AccessPolicy",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "access-policy",

    /**
    * The AccessPolicy collection that is displayed in this View
    * @type {AccessPolicy}
    */
    collection: undefined,

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "click .public"  : "makePublic",
      "click .private" : "makePrivate",
      "click .remove"  : "removeRule"
    },

    /**
    * Creates a new AccessPolicyView
    * @constructs AccessPolicyView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into this view
      this.$el.html(this.template());

      //TODO: Iterate over each AccessRule in the AccessPolicy and render a AccessRuleView

    },

    /**
    * Render a row with input elements for adding a new AccessRule
    */
    addEmptyRow: function(){

      //TODO: Create a new AccessRule model and add to the collection

      //TODO: Create a new AccessRuleView and append to the table

    },

    /**
    * Removes an AccessRule from the AccessPolicy and removes the AccessRuleView
    * @param {Event} e - The click event on the remove button in the AccessRuleView
    */
    removeRule: function(e){

      //TODO: Get the view and model associated with the remove button that was clicked

      //TODO: Remove the AccessRule model from the AccessPolicy collection

      //TODO: Remove the AccessRuleView from this view

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
