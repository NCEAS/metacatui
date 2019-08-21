define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectModel',
        "collections/Filters",
        'views/EditorView',
        "views/SignInView",
        "views/project/editor/ProjEditorSectionsView",
        "text!templates/loading.html",
        "text!templates/project/editor/projectEditor.html"
      ],
function(_, $, Backbone, Project, Filters, EditorView, SignInView, ProjEditorSectionsView, LoadingTemplate, Template){

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
    * serialized and saved.
    * @type {string}
    */
    newProjectTempName: "new",

    /**
    * The events this view will listen to and the associated function to call.
    * This view will inherit events from the parent class, EditorView.
    * @type {Object}
    */
    events: _.extend(EditorView.prototype.events, {
      "focusout .basic-text"          : "updateBasicText",
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

      // An exisiting project should have a projectIdentifier already set
      // from the router, that does not equal the newProjectTempName ("new"),
      // plus a seriesId or label set during createModel()
      if (
        (this.model.get("seriesId") || this.model.get("label"))
        &&
        (this.projectIdentifier && this.projectIdentifier != this.newProjectTempName)
      ){
          var view = this;

          this.listenTo(this.model, "change:isAuthorized", function(){

            if (this.model.get("isAuthorized")) {
              // When an existing model has been synced render the results
              view.stopListening();

              view.listenTo(view.model, "sync", view.renderProjectEditor);

              // If the project model already exists - fetch it.
              view.model.fetch();

              // Listens to the focus event on the window to detect when a user
              // switches back to this browser tab from somewhere else
              // When a user checks back, we want to check for log-in status
              MetacatUI.appView.listenForActivity();

              // Determine the length of time until the user's current token expires
              // Asks to sign in in case of time out
              MetacatUI.appView.listenForTimeout();
            }
            else {
              // generate error message
              var msg = "The portal owner has not granted you access to edit this portal. Please contact the owner to be given edit access.";

              //Show the not authorized error message
              MetacatUI.appView.showAlert(msg, "alert-error", this.projEditSectionsContainer);
            }
          });

          // Check if the user is Authorized to edit the project
          this.authorizeUser();
      }
      else {
          
        // if the user is not signed in, display the sign in view
        if (!MetacatUI.appUserModel.get("loggedIn")) {
          this.showSignIn();
        }
        else {

          // Start new projects on the settings tab
          this.activeSection = "Settings";

          // Render the default model if the project is new
          this.renderProjectEditor();
        }


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

      $("body").addClass("Editor")
               .addClass("Portal");

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
      if ( this.projectIdentifier && this.projectIdentifier != this.newProjectTempName) {

        // Create a new project model with the identifier
        this.model = new Project({
          label: this.projectIdentifier
        });

        // Save the original label in case a user changes it. During URL
        // validation, the original label will always be shown as available.
        // TODO: if user navigates to project using a SID or PID, we will need
        // to get the matching label and then save it to the model
        this.model.set("originalLabel", this.projectIdentifier);

      // Otherwise, create a new project
      } else {

        // Create a new, default project model
        this.model = new Project({
          //Set the isNew attribute so the model will execute certain functions when a Project is new
          isNew: true
        });

      }

      // set listeners on the new model
      this.setListeners();
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

       //If the seriesId hasn't been found yet, but we have the label
       if( !this.model.get("seriesId") && !this.model.get("latestVersion") && this.model.get("label") ){
         //When the seriesId or latest pid is found, come back to this function
         this.listenToOnce(this.model, "change:seriesId",    this.authorizeUser);
         this.listenToOnce(this.model, "latestVersionFound", this.authorizeUser);
         
         //If the project isn't found, display a 404 message
         this.listenToOnce(this.model, "notFound", this.showNotFound);

         //Get the seriesId or latest pid
         this.model.getSeriesIdByName();
         return;
       }
       else{
         //Remove the listeners for the seriesId and latest pid
         this.stopListening(this.model, "change:seriesId",    this.authorizeUser);
         this.stopListening(this.model, "latestVersionFound", this.authorizeUser);
         
         // Remove the not found listener
         this.stopListening(this.model, "notFound", this.showNotFound);
       }

       //Remove the loading message
       this.hideLoading();

       //Only proceed if the user is logged in
       if ( MetacatUI.appUserModel.get("checked") && MetacatUI.appUserModel.get("loggedIn") ){

           // checking for the write Permission
           this.model.checkAuthority("write");
       }
       else if ( !MetacatUI.appUserModel.get("loggedIn") ){

        // show the sign in view
        this.showSignIn();
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
        var position = $(e.target)
                          .parents("div.text-container")
                          .first()
                          .children("div")
                          .index( $(e.target).parent() );

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
      //TODO: Add another blank text input (write addBasicText function)
      // if($(e.target).is(".new") && value != '' && category != "title"){
      //   $(e.target).removeClass("new");
      //   this.addBasicText(e);
      // }

    },

    /**
     * When the object is saved successfully, tell the user.
     * @param {object} savedObject - the object that was successfully saved
     */
    saveSuccess: function(savedObject){

      var identifier = savedObject.id || this.model.get("seriesId");

      var message = this.editorSubmitMessageTemplate({
            messageText: "Your changes have been submitted.",
            viewURL: MetacatUI.root + "/portals/" + identifier,
            buttonText: "View your portal"
        });

      MetacatUI.appView.showAlert(message, "alert-success", this.$el, null, {remove: true});

      this.setListeners();
      this.hideSaving();

    },


    /**
     * This function is called when the app navigates away from this view.
     * Any clean-up or housekeeping happens at this time.
     */
    onClose: function(){

      $("body")
        .removeClass("Editor")
        .removeClass("Portal");

    },

    /**
    * Show Sign In buttons
    */
    showSignIn: function(){
      var container = $(document.createElement("div")).addClass("container center");
      this.$el.html(container);
      var signInButtons = new SignInView().render().el;

      // Message to create a portal if the portal is new
      if (this.model.get("isNew")) {
        $(container).append('<h1>Sign in to create a portal</h1>', signInButtons);
      }
      else {
        $(container).append('<h1>Sign in to edit a portal</h1>', signInButtons);
      }
      
    },

    /**
     * If the given project doesn't exist, display a Not Found message.
     */
    showNotFound: function(){

      this.hideLoading();

      var notFoundMessage = "The project \"" + (this.model.get("label") || this.projectIdentifier) +
                            "\" doesn't exist.";
          
      MetacatUI.appView.showAlert(notFoundMessage, "alert-error", this.$el);
    }

  });

  return ProjectEditorView;

});
