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
      "focusout .url-container input" : "showLabelValidation",
      "keyup .url-container input" : "removeLabelValidation"
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
              var msg = "This is a private project. You need authorization to edit this project.";

              //Show the not authorized error message
              MetacatUI.appView.showAlert(msg, "alert-error", this.projEditSectionsContainer);
            }
          });

          // Check if the user is Authorized to edit the project
          this.authorizeUser();
      }
      else {

        // Start new projects on the settings tab
        this.activeSection = "Settings";

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

       //If the SID has not been found yet, get it from Solr
       if( !this.model.get("seriesId") && this.model.get("label") ){
         this.listenTo(this.model, "change:seriesId", this.authorizeUser);
         this.model.getSeriesIdByName();
         return;
       }

       //Remove the loading message
       this.hideLoading();

       //Only proceed if the user is logged in
       if ( MetacatUI.appUserModel.get("checked") && MetacatUI.appUserModel.get("loggedIn") ){

           // checking for the write Permission
           this.model.checkAuthority("write");
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
     * Removes help text and css formatting that indicates error or success after label/URL validation.
     *
     *  @param {Event} [e] - The keyup or focusout event
     */
    removeLabelValidation: function(e){

      var container = $(e.target).parents(".url-container").first(),
          messageEl = $(container).find('.notification');

      // Remove input formating if there was any
      messageEl.html("");
      container.removeClass("error");
      container.removeClass("success");

    },

    /**
     * Initiates validatation of the newly inputed label (a URL component).
     * Listens for a response from the model, then displays help text based on
     * whether the new label was valid or not.
     *
     *  @param {Event} [e] - The focusout event
     */
    showLabelValidation: function(e){

      var container = $(e.target).parents(".url-container").first(),
          input = $(e.target),
          messageEl = $(container).find('.notification'),
          value = input.val();

      this.listenToOnce(this.model, "urlUnchanged", function(){
        this.removeLabelValidation(e);
      }, this, e);

      this.listenToOnce(this.model, "urlAvailable", function(){
        messageEl.html("<i class='icon-check'></i> This URL is available");
        container.addClass("success");
      });

      this.listenToOnce(this.model, "urlBlank", function(){
        messageEl.html("A URL is required");
        container.addClass("error");
      });

      this.listenToOnce(this.model, "urlTaken", function(){
        messageEl.html("This URL is already taken, please try something else");
        container.addClass("error");
      });

      this.listenToOnce(this.model, "urlRestricted", function(){
        messageEl.html("This URL is not allowed, please try something else");
        container.addClass("error");
      });

      this.listenToOnce(this.model, "urlIncludesIllegalCharacters", function(){
        messageEl.html("URLs may only contain letters, numbers, underscores (_), and dashes (-).");
        container.addClass("error");
      });

      // Show 'checking URL' message
      messageEl.html(
        "<i class='icon-spinner icon-spin icon-large loading icon'></i> "+
        "Checking if URL is available"
      );

      // Validate label. The newProjectTempName is a restricted value.
      this.model.validateLabel(value, [this.newProjectTempName]);

    }

  });

  return ProjectEditorView;

});
