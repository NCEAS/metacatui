define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectModel',
        "collections/Filters",
        'views/EditorView',
        "views/project/editor/ProjEditorSectionsView",
        "text!templates/loading.html",
        "text!templates/project/editor/projectEditor.html"
      ],
function(_, $, Backbone, Project, Filters, EditorView, ProjEditorSectionsView, LoadingTemplate, Template){

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
    * The currently active editor section. e.g. Data, Metrics, Settings, etc.
    * @type {string}
    */
    activeSection: "",

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),
    loadingTemplate: _.template(LoadingTemplate),

    /**
    * A jQuery selector for the element that the ProjEditorSectionsView should be inserted into
    * @type {string}
    */
    projEditSectionsContainer: ".proj-editor-sections-container",

    /**
    * A temporary name to use for projects when they are first created but don't have a label yet.
    * This name should only be used in views, and never set on the model so it doesn't risk getting
    * serialied and saved.
    * @type {string}
    */
    newProjectTempName: "new",

    /**
    * The events this view will listen to and the associated function to call.
    * This view will inherit events from the parent class, EditorView.
    * @type {Object}
    */
    events: _.extend(EditorView.prototype.events, {
      "focusout .title-container input"        : "updateBasicText",
    }),

    /**
    * Creates a new ProjectEditorView
    * @constructs ProjectEditorView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){
      if(typeof options == "object"){
        // initializing the ProjectEditorView properties
        this.projectIdentifier = options.projectIdentifier ? options.projectIdentifier : undefined;
        this.activeSection = options.activeSection || "";
      }
    },

    /**
    * Renders the ProjectEditorView
    */
    render: function(){

      // Display a spinner to indicate loading until model is created.
      this.$el.html(this.loadingTemplate({
        msg: "Retrieving project details..."
      }));

      //Create the model
      this.createModel();

      if ( this.model.get("seriesId") || this.model.get("label") ){
        // When an existing model has been synced render the results
        this.stopListening();
        this.listenTo(this.model, "sync", this.renderProjectEditor);
        // If the project model already exists - fetch it.
        this.model.fetch();
      }
      else{
        // Render the default model if the project is new
        this.renderProjectEditor();

      }

      return this;
    },

    /**
    * Renders the project editor view once the project view is created
    */
    renderProjectEditor: function() {

      // Add the template to the view and give the body the "Editor" class
      var name = this.model.get("name");
      this.$el.html(this.template({
        name: name
      }));

      $("body").addClass("Editor");

      // Get the project identifier
      // or set it to a default value in the case that it's a new project
      var projectIdentifier = this.projectIdentifier;
      if(!projectIdentifier){
        projectIdentifier = this.newProjectTempName;
      }

      //Create a view for the editor sections
      var sectionsView = new ProjEditorSectionsView({
        model: this.model,
        activeSection: this.activeSection,
        newProjectTempName: this.newProjectTempName
      });

      //Add the view element to this view
      this.$(this.projEditSectionsContainer).html(sectionsView.el);

      //Render the sections view
      sectionsView.render();

    },

    /**
    * Create a ProjectModel object
    */
    createModel: function(){
      // Look up the project document seriesId by its registered name if given
      if ( this.projectIdentifier) {

        // Create a new project model with the identifier
        this.model = new Project({
          label: this.projectIdentifier
        });

      } else {

        // Create a new, default project model
        this.model = new Project();

        // Set some empty filters on the model so that the
        // `DataCatalogViewWithFilters` can start rendering
        this.model.get("searchModel")
                  .set("filters", new Filters({
                                          catalogSearch: true
                                        }));
        this.model.set("filters", new Filters());

        // Start new projects on the settings tab
        this.activeSection = "Settings";

        // Generate and reserve a series ID for the new project
        // Add an isPartOf filter model to the search model
        var view = this;
        var options = {
          url: MetacatUI.appModel.get("d1CNBaseUrl") +
               MetacatUI.appModel.get("d1CNService") +
               "/generate",
          type: "POST",
          data: {scheme: "UUID"},
          success: function(identifierXML){
            // Get the new seriesId (sid)
            var newSID = $(identifierXML).text();
            // Save the sid as the projectIdentifier
            view.projectIdentifier = newSID;
            // Set the sid in the project model.
            view.model.set("seriesId", newSID);
            // Make an isPartOf filter, a default filter for each project
            var isPartOfFilter = view.model.createIsPartOfFilter();
            // Add the isPartOf filter to the model
            view.model.get("searchModel").get("filters").add(isPartOfFilter);
            view.model.get("filters").add(isPartOfFilter);
          }
        }
        _.extend(options, MetacatUI.appUserModel.createAjaxSettings());
        $.ajax(options);

      }
    },

    /**
     * The authorizeUser function checks if the current user is authorized
     * to edit the given ProjectModel. If not, a message is displayed and
     * the view doesn't render anything else.
     *
     * If the user isn't logged in at all, don't check for authorization and
     * display a message and login button.
     */
    authorizeUser: function() {

      //Remove the loading message
      this.hideLoading();

      //Only proceed if the user is logged in
      if ( MetacatUI.appUserModel.get("checked") && MetacatUI.appUserModel.get("loggedIn") ){

          var view = this;

          // Listening to the checkAuthority funciton
          this.listenTo(this.model, "change:isAuthorized", function(){

            if ( view.model.get("isAuthorized") ) {
              // Display the project editor
              view.renderProjectEditor();

              // Listens to the focus event on the window to detect when a user
              // switches back to this browser tab from somewhere else
              // When a user checks back, we want to check for log-in status
              MetacatUI.appView.listenForActivity();

              // Determine the length of time until the user's current token expires
              // Asks to sign in in case of time out
              MetacatUI.appView.listenForTimeout()
            }
            else {
              // generate error message
              var msg = "This is a private project. You're not authorized to access this project.";

              //Show the not authorized error message
              MetacatUI.appView.showAlert(msg, "alert-error", ".proj-editor-sections-container")
            }
          });

          // checking for the writePermission
          this.model.checkAuthority("writePermission");
      }
      else if ( !MetacatUI.appUserModel.get("loggedIn") ){

        // generate error message
        var msg = 'This is a private project. If you believe you have permission ' +
                  'to access this project, then <a href="' + MetacatUI.root +
                  '/signin">sign in</a>.';

        //Show the not logged in error
        MetacatUI.appView.showAlert(msg, "alert-error", ".proj-editor-sections-container")
      }
    },

    /**
     * Hides the loading
     */
    hideLoading: function() {

      // Find the loading object and remove it.
      if (this.$el.find(".loading")) {
        this.$el.find(".loading").remove();
      }
    },

    /**
     * When a simple text input field loses focus, the corresponding model
     * attribute is updated with the value from the input field
     *
     *  @param {Event} [e] - The focusout event
     */
    updateBasicText: function(e){
      if(!e) return false;

      //Get the category, new value, and model
      var category = $(e.target).attr("data-category"),
      value = $(e.target).val(),
      model = $(e.target).data("model") || this.model;

      //We can't update anything without a category
      if(!category) return false;

      //Get the current value
      var currentValue = model.get(category);

      //Insert the new value into the array
      if( Array.isArray(currentValue) ){

        //Find the position this text input is in
        var position = $(e.target).parents("div.text-container").first().children("div").index($(e.target).parent());

        //Set the value in that position in the array
        currentValue[position] = value;

        //Set the changed array on this model
        model.set(category, currentValue);
        model.trigger("change:" + category);

      }
      //Update the model if the current value is a string
      else if(typeof currentValue == "string" || !currentValue){
        model.set(category, value);
        model.trigger("change:" + category);
      }
      //Add another blank text input
      if($(e.target).is(".new") && value != '' && category != "title"){
        $(e.target).removeClass("new");
        this.addBasicText(e);
      }

    },

  });

  return ProjectEditorView;

});
