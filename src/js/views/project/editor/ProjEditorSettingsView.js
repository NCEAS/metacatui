define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectSectionModel',
        "views/project/editor/ProjEditorSectionView",
        "text!templates/project/editor/projEditorSettings.html"],
function(_, $, Backbone, ProjectSection, ProjEditorSectionView, Template){

  /**
  * @class ProjEditorSettingsView
  */
  var ProjEditorSettingsView = ProjEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjEditorSettings",

    /**
    * The display name for this Section
    * @type {string}
    */
    sectionName: "Settings",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: ProjEditorSectionView.prototype.className + " proj-editor-settings",

    /**
    * The ProjectModel that is being edited
    * @type {Project}
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
    * Creates a new ProjEditorSettingsView
    * @constructs ProjEditorSettingsView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

    }

  });

  return ProjEditorSettingsView;

});
