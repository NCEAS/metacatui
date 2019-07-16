define(['underscore',
        'jquery',
        'backbone',
        "models/AccessRule"],
function(_, $, Backbone, AccessRule){

  var AccessRuleView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "AccessRule",

    /**
    * The HTML tag name for this view's element
    * @type {string}
    */
    tagName: "tr",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "access-rule",

    /**
    * The AccessRule model that is displayed in this view
    * @type {AccessRule}
    */
    model: undefined,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new AccessRuleView
    * @constructs AccessRuleView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders a single Access Rule
    */
    render: function(){

    }

  });

  return AccessRuleView;

});
