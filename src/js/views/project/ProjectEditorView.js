define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectModel',
        'views/EditorView'],
function(_, $, Backbone, Project, EditorView){

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
    * The events this view will listen to and the associated function to call.
    * This view will inherit events from the parent class, EditorView.
    * @type {Object}
    */
    events: _.extend(EditorView.prototype.events, {
      "click #save-editor" : "test"
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

      this.$el.html("project editor view");
      console.log(this.events);

    },

    /**
    * Gets the ProjectModel from the repository or creates a new one
    */
    getModel: function(){

    }

  });

  return ProjectEditorView;

});
