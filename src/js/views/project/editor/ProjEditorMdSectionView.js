define(['underscore',
        'jquery',
        'backbone',
        "models/project/ProjectSectionModel",
        "views/project/editor/ProjEditorSectionView",
        "text!templates/project/editor/projEditorMdSection.html"],
function(_, $, Backbone, ProjectSectionModel, ProjEditorSectionView, Template){

  /**
  * @class ProjEditorMdSectionView
  */
  var ProjEditorMdSectionView = ProjEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjEditorMdSection",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: ProjEditorSectionView.prototype.className + " proj-editor-md",

    /**
    * The ProjectSectionModel that is being edited
    * @type {ProjectSection}
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
    * Creates a new ProjEditorMdSectionView
    * @constructs ProjEditorMdSectionView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      //Call the superclass initialize() function
      ProjEditorSectionView.prototype.initialize();
      
    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

    }

  });

  return ProjEditorMdSectionView;

});
