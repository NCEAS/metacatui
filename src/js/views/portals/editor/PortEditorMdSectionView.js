define(['underscore',
        'jquery',
        'backbone',
        "models/portals/PortalSectionModel",
        "views/portals/editor/PortEditorSectionView",
        "text!templates/portals/editor/portEditorMdSection.html"],
function(_, $, Backbone, PortalSectionModel, PortEditorSectionView, Template){

  /**
  * @class PortEditorMdSectionView
  */
  var PortEditorMdSectionView = PortEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorMdSection",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: PortEditorSectionView.prototype.className + " proj-editor-md",

    /**
    * The PortalSectionModel that is being edited
    * @type {PortalSection}
    */
    model: undefined,

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new PortEditorMdSectionView
    * @constructs PortEditorMdSectionView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      //Call the superclass initialize() function
      PortEditorSectionView.prototype.initialize();

    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

    }

  });

  return PortEditorMdSectionView;

});
