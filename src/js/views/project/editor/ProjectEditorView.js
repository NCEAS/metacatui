define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectModel',
        'views/EditorView',
        "views/project/editor/ProjEditorSectionsView",
        "text!templates/project/editor/projectEditor.html"],
function(_, $, Backbone, Project, EditorView, ProjEditorSectionsView, Template){

  /**
  * @class ProjectEditorView
  */
  var ProjectEditorView = EditorView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjectEditor",

    /**
    * The short name OR pid for the project
    * @type {string}
    */
    projectIdentifier: "",

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
    * This view will inherit events from the parent class, EditorView.
    * @type {Object}
    */
    events: _.extend(EditorView.prototype.events, {
    }),

    /**
    * Creates a new ProjectEditorView
    * @constructs ProjectEditorView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders the ProjectEditorView
    */
    render: function(){

      //Add the template to the view and give the body the "Editor" class
      this.$el.html(this.template());
      $("body").addClass("Editor");

      var sectionsView = new ProjEditorSectionsView();
      sectionsView.render();
      this.$(".proj-editor-sections-container").html(sectionsView.el);

    },

    /**
    * Gets the ProjectModel from the repository or creates a new one
    */
    getModel: function(){

    }

  });

  return ProjectEditorView;

});
