define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectSectionModel',
        "views/project/editor/ProjEditorSectionView",
        "views/AccessPolicyView",
        "text!templates/project/editor/projEditorSettings.html"],
function(_, $, Backbone, ProjectSection, ProjEditorSectionView, AccessPolicyView,
  Template){

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

      //Call the superclass initialize() function
      ProjEditorSectionView.prototype.initialize();

    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

      //Render the AccessPolicyView
      //TODO: Get the AccessPolicy collection for this ProjectModel and send it to the view
      var accessPolicyView = new AccessPolicyView();
      accessPolicyView.render();
      this.$(".permissions-container").html(accessPolicyView.el);

    }

  });

  return ProjEditorSettingsView;

});
