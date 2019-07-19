define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectModel',
        'views/EditorView',
        "views/project/editor/ProjEditorSectionsView",
        "text!templates/loading.html",
        "text!templates/project/editor/projectEditor.html"
      ],
function(_, $, Backbone, Project, EditorView, ProjEditorSectionsView, LoadingTemplate, Template){

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
    loadingTemplate: _.template(LoadingTemplate),

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

      // initializing the ProjectEditorView properties
      this.projectIdentifier = options.projectIdentifier ? options.projectIdentifier : undefined;
    },

    /**
    * Renders the ProjectEditorView
    */
    render: function(){

      // Display a spinner to indicate loading until model is created.
      this.$el.html(this.loadingTemplate({
        msg: "Retrieving project details..."
      }));

      //Get the model
      this.createModel();

      // When the model has been synced, render the results
      this.stopListening();
      this.listenTo(this.model, "sync", this.renderProjectEditor);

      //Get the model
      this.model.fetch();

      return this;
    },

    /**
    * Renders the project editor view once the project view is created
    */
    renderProjectEditor: function() {

      // hide the loading
      if (this.$loading) {
        this.$loading.remove();
      }

      //Add the template to the view and give the body the "Editor" class
      this.$el.html(this.template());
      $("body").addClass("Editor");

      var sectionsView = new ProjEditorSectionsView();
      sectionsView.render();
      this.$(".proj-editor-sections-container").html(sectionsView.el);

    },

    /**
    * Create a ProjectModel object
    */
    createModel: function(){
      
      /**
      * The name of the project
      * @type {string}
      */
      var projectName;

      /**
      * The dictionary object of project names mapped to corresponding identifiers
      * @type {object}
      */
      var projectsMap = MetacatUI.appModel.get("projectsMap");
      
      // Look up the project document seriesId by its registered name if given
      if ( this.projectIdentifier ) {
        if ( projectsMap ) {
          
          // Do a forward lookup by key
          if ( typeof (projectsMap[this.projectIdentifier] ) !== "undefined" ) {
            this.projectName = this.projectIdentifier;
            this.projectIdentifier = projectsMap[this.projectIdentifier];
          } else { 
            // Try a reverse lookup of the project name by values
            this.projectName = _.invert(projectsMap)[this.projectIdentifier];

            if ( typeof this.projectName === "undefined" ) {
              //Try looking up the project name with case-insensitive matching
              this.projectName = _.findKey(projectsMap, function(value, key){
                return( key.toLowerCase() == this.projectIdentifier.toLowerCase() );
              });

              //If a matching project name was found, get the corresponding identifier
              if( this.projectName ){
                //Get the project ID from the map
                this.projectIdentifier = projectsMap[this.projectName];
              }
            }
          }
        }

        // Create a new project model with the identifier
        this.model = new Project({
          id: this.projectIdentifier
        });

      } else {
          // Create a new, default project model
          this.model = new Project();
      }
    }

  });

  return ProjectEditorView;

});
