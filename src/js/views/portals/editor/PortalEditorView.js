define(['underscore',
        'jquery',
        'backbone',
        'models/portals/PortalModel',
        "models/portals/PortalImage",
        "collections/Filters",
        'views/EditorView',
        "views/SignInView",
        "views/portals/editor/PortEditorSectionsView",
        "views/ImageEditView",
        "text!templates/loading.html",
        "text!templates/portals/editor/portalEditor.html",
        "text!templates/portals/editor/portalEditorSubmitMessage.html"
      ],
function(_, $, Backbone, Portal, PortalImage, Filters, EditorView, SignInView,
  PortEditorSectionsView, ImageEdit, LoadingTemplate, Template,
  portalEditorSubmitMessageTemplate){

  /**
  * @class PortalEditorView
  */
  var PortalEditorView = EditorView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortalEditor",

    /**
    * The short name OR pid for the portal
    * @type {string}
    */
    portalIdentifier: "",

    /**
    * The PortalModel that is being edited
    * @type {Portal}
    */
    model: undefined,

    /**
    * The currently active editor section. e.g. Data, Metrics, Settings, etc.
    * @type {string}
    */
    activeSectionLabel: "",

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),
    loadingTemplate: _.template(LoadingTemplate),
    // Over-ride the default editor submit message template (which is currently
    // used by the metadata editor) with the portal editor version
    editorSubmitMessageTemplate: _.template(portalEditorSubmitMessageTemplate),

    /**
    * The text to use in the editor submit button
    * @type {string}
    */
    submitButtonText: "Save",

    /**
    * A jQuery selector for the element that the PortEditorSectionsView should be inserted into
    * @type {string}
    */
    portEditSectionsContainer: ".port-editor-sections-container",

    /**
    * A jQuery selector for the element that the portal logo image uploader
    * should be inserted into
    * @type {string}
    */
    portEditLogoContainer: ".logo-editor-container",

    /**
    * A temporary name to use for portals when they are first created but don't have a label yet.
    * This name should only be used in views, and never set on the model so it doesn't risk getting
    * serialized and saved.
    * @type {string}
    */
    newPortalTempName: "new",

    /**
    * The events this view will listen to and the associated function to call.
    * This view will inherit events from the parent class, EditorView.
    * @type {Object}
    */
    events: _.extend(EditorView.prototype.events, {
      "focusout .basic-text"                  : "updateBasicText",
      "click .section-links-toggle-container" : "toggleSectionLinks"
    }),

    /**
    * Creates a new PortalEditorView
    * @constructs PortalEditorView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      if(typeof options == "object"){
        // initializing the PortalEditorView properties
        this.portalIdentifier = options.portalIdentifier ? options.portalIdentifier : undefined;
        this.activeSectionLabel = options.activeSectionLabel || "";
      }
    },

    /**
    * Renders the PortalEditorView
    */
    render: function(){

      $("body").addClass("Editor")
               .addClass("Portal");

      // Display a spinner to indicate loading until model is created.
      this.$el.html(this.loadingTemplate({
        msg: "Retrieving portal details..."
      }));

      //Create the model
      this.createModel();

      // An exisiting portal should have a portalIdentifier already set
      // from the router, that does not equal the newPortalTempName ("new"),
      // plus a seriesId or label set during createModel()
      if (
        (this.model.get("seriesId") || this.model.get("label"))
        &&
        (this.portalIdentifier && this.portalIdentifier != this.newPortalTempName)
      ){
          var view = this;

          this.listenToOnce(this.model, "change:isAuthorized", function(){

            if (this.model.get("isAuthorized")) {
              // When an existing model has been synced render the results
              view.stopListening(view.model, "sync", view.renderPortalEditor);
              view.listenToOnce(view.model, "sync", view.renderPortalEditor);

              // If the portal model already exists - fetch it.
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
              MetacatUI.appView.showAlert(msg, "alert-error", this.$el);
            }
          });

          // Check if the user is Authorized to edit the portal
          this.authorizeUser();
      }
      //If there is no portal identifier given, this is a new portal.
      else {

        // if the user is not signed in, display the sign in view
        if (!MetacatUI.appUserModel.get("loggedIn")) {
          this.showSignIn();
        }
        //If the user is signed in and is attempting to create a new portal,
        else {

          //Check the user's quota to create a new Portal
          this.listenToOnce(MetacatUI.appUserModel, "change:isAuthorizedCreatePortal", function(){

            if( MetacatUI.appUserModel.get("isAuthorizedCreatePortal") ){
              // Start new portals on the settings tab
              this.activeSectionLabel = "Settings";

              // Render the default model if the portal is new
              this.renderPortalEditor();
            }
            else{
              //If the user doesn't have quota left, display this message
              if( MetacatUI.appUserModel.get("portalQuota") == 0 ){
                var errorMessage = "You have already reached the maximum number of portals for your membership level.";
              }
              //Otherwise, display a more generic error message
              else{
                var errorMessage = "You have not been authorized to create new portals. " +
                                   "Please contact us with any questions.";
              }

              //Hide the loading icon
              this.hideLoading();

              //Show the error message
              MetacatUI.appView.showAlert(errorMessage, "alert-error", this.$el);
            }

            //Reset the isAuthorizedCreatePortal attribute
            MetacatUI.appUserModel.set("isAuthorizedCreatePortal", null);

          });

          //Check if this user is authorized to create a new portal
          MetacatUI.appUserModel.isAuthorizedCreatePortal();

        }


      }

      return this;
    },

    /**
    * Renders the portal editor view once the portal view is created
    */
    renderPortalEditor: function() {

      // Add the template to the view and give the body the "Editor" class
      this.$el.html(this.template({
        name: this.model.get("name"),
        submitButtonText: this.submitButtonText,
        primaryColor: this.model.get("primaryColor"),
        secondaryColor: this.model.get("secondaryColor"),
        accentColor: this.model.get("accentColor"),
        primaryColorTransparent: this.model.get("primaryColorTransparent"),
        secondaryColorTransparent: this.model.get("secondaryColorTransparent"),
        accentColorTransparent: this.model.get("accentColorTransparent")
      }));

      // Auto-resize the height of the portal title field on user-input and on
      // window resize events.
      $( window ).resize(function() {
        $("textarea.portal-title").trigger("windowResize");
      });
      this.$("textarea.portal-title").each(function () {
        this.style.height = '0px'; // note: textfield MUST have a min-height set
        this.style.height = (this.scrollHeight) + 'px';
      }).on('input windowResize', function () {
        this.style.height = '0px'; // note: textfield MUST have a min-height set
        this.style.height = (this.scrollHeight) + 'px';
      });

      // Get the portal identifier
      // or set it to a default value in the case that it's a new portal
      var portalIdentifier = this.portalIdentifier;
      if(!portalIdentifier){
        portalIdentifier = this.newPortalTempName;
      }

      //Create a view for the editor sections
      this.sectionsView = new PortEditorSectionsView({
        model: this.model,
        activeSectionLabel: this.activeSectionLabel,
        newPortalTempName: this.newPortalTempName
      });

      //Attach a reference to this view
      this.sectionsView.editorView = this;

      //Add the view element to this view
      this.$(this.portEditSectionsContainer).html(this.sectionsView.el);

      //Render the sections view
      this.sectionsView.render();

      //Show the required fields for this editor
      this.renderRequiredIcons(MetacatUI.appModel.get("portalEditorRequiredFields"));

      // Insert the logo editor
      this.renderLogoEditor();

      // On mobile, hide section tabs a moment after page loads so
      // users notice where they are
      var view= this;
      setTimeout(function () {
        view.toggleSectionLinks();
      }, 700);

      // On mobile where the section-links-toggle-container is set to fixed,
      // hide the portal navigation element when user scrolls down,
      // show again when the user scrolls up.
      MetacatUI.appView.prevScrollpos = window.pageYOffset;
      $(window).on("scroll", "", undefined, this.handleScroll);

    },

    /**
    * Create a PortalModel object
    */
    createModel: function(){

      // Look up the portal document seriesId by its registered name if given
      if ( this.portalIdentifier && this.portalIdentifier != this.newPortalTempName) {

        // Create a new portal model with the identifier
        this.model = new Portal({
          label: this.portalIdentifier
        });

        // Save the original label in case a user changes it. During URL
        // validation, the original label will always be shown as available.
        // TODO: if user navigates to portal using a SID or PID, we will need
        // to get the matching label and then save it to the model
        this.model.set("originalLabel", this.portalIdentifier);

      // Otherwise, create a new portal
      } else {

        // Create a new, default portal model
        this.model = new Portal({
          //Set the isNew attribute so the model will execute certain functions when a Portal is new
          isNew: true
        });

      }

      // set listeners on the new model
      this.setListeners();
    },

    /**
     * The authorizeUser function checks if the current user is authorized
     * to edit the given PortalModel. If not, a message is displayed and
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

         //If the portal isn't found, display a 404 message
         this.listenToOnce(this.model, "notFound", this.showNotFound);

         //Get the seriesId or latest pid
         this.model.getSeriesIdByName();
         return;
       }
       else{
         //Remove the listeners for the seriesId and latest pid
         this.stopListening(this.model, "change:seriesId",    this.authorizeUser);
         this.stopListening(this.model, "latestVersionFound", this.authorizeUser);
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
     * toggleSectionLinks - show or hide the section links. Used for the
     * mobile/small screen view of the portal.
     */
    toggleSectionLinks: function(e){
      try{
        // Don't close the menu if the user clicked the dropdown for the rename/delete menu.
        if(e && e.target){
          if(e.target.closest(".section-menu-link") || e.target.closest(".dropdown-menu")){
            return
          }
        }
        // Only toggle the section links on mobile. On mobile, the
        // ".show-sections-toggle" is visible.
        if(this.$(".show-sections-toggle").is(":visible")){
          this.$("#portal-section-tabs").slideToggle();
        }
      } catch(e){
        console.log("Failed to toggle section links, error message: " + e);
      }
    },

    /**
     * renderLogoEditor - Creates a new PortalImage model for the portal logo if
     *  one doesn't exist already, then inserts an ImageEdit view into the
     *  portEditLogoContainer.
     */
    renderLogoEditor: function() {

      try {
        // If the portal has no logo, add the default model for one
        if(!this.model.get("logo")){
          this.model.set("logo", new PortalImage({
              label: "logo",
              nodeName: "logo"
            })
          );
        };
        // Add the image view (incl. uploader) for the portal logo
        this.logoEdit = new ImageEdit({
          model: this.model.get("logo"),
          imageUploadInstructions: "Drag & drop a logo here or click to upload",
          imageWidth: 100,
          imageHeight: 100,
          minWidth: 64,
          minHeight: 64,
          maxHeight: 200,
          maxWidth: 200,
          nameLabel: false,
          urlLabel: false,
          imageTagName: "img",
          removeButton: false
        });
        this.$(this.portEditLogoContainer).append(this.logoEdit.el);
        this.logoEdit.render();
        this.logoEdit.editorView = this;

      } catch (e) {
        console.log("Logo editor view could not be rendered. Error message: " + e);
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

      //If the value is an empty string,
      if( typeof value == "string" && !value.length ){
        //Remove the value from the input
        $(e.target).val("");
      }
      //If the value is only spaces,
      else if( typeof value == "string" && !value.trim().length ){
        //Remove the value from the input
        $(e.target).val("");
        //Update the model as if this is an empty string
        value = "";
      }

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

      var identifier = this.model.get("label") || this.model.get("seriesId") || this.model.get("id");

      var message = this.editorSubmitMessageTemplate({
            messageText: "Your changes have been submitted.",
            viewURL: MetacatUI.root + "/"+ MetacatUI.appModel.get("portalTermPlural") +"/" + identifier,
            buttonText: "View your " + MetacatUI.appModel.get("portalTermSingular")
        });

      MetacatUI.appView.showAlert(message, "alert-success", this.$el, null, {remove: true});

      this.hideSaving();

      this.removeValidation();

      // Update the path in case the user selected a new portal label
      this.sectionsView.updatePath();

      // Reset the original label (note: this MUST occur AFTER updatePath())
      this.model.set("originalLabel", this.model.get("label"));

    },

    /**
    * When the Portal model has been flagged as invalid, show the validation error messages
    */
    showValidation: function(){

      //First clear all the error messaging
      this.removeValidation();

      var errors = this.model.validationError;

      _.each(errors, function(errorMsg, category){
        var categoryEls = this.$("[data-category='" + category + "']");

        //Get the elements that have views attached to them
        var elsWithViews = _.filter(categoryEls, function(el){
            return ( $(el).data("view") &&
                $(el).data("view").showValidation &&
                !$(el).data("view").isNew );
          });

        //If at least one element of this category has a view,
        if(elsWithViews.length){
          //Use the view's showValidation function, if it exists.
          _.each(elsWithViews, function(el){
            var view = $(el).data("view");

            if( view && view.showValidation ){
              view.showValidation();
            }
          });
        }
        else{
          //Show the validation message
          this.showValidationMessage(categoryEls, errorMsg);
        }

      }, this);

      if(errors){
        MetacatUI.appView.showAlert("Fix the errors flagged below before submitting.",
            "alert-error",
            this.$el,
            null,
            {
              remove: true
            });

        //Hide the saving styling
        this.hideSaving();
      }

    },

    /**
    * Shows a validation error message and adds error styling to the given elements
    * @param {jQuery Selection} elements - The elements to add error styling and messaging to
    * @param {string} errorMsg - The error message to display
    */
    showValidationMessage: function(elements, errorMsg){
      //Show the error message
      elements.filter(".notification").addClass("error").text(errorMsg);

      //Add the error class to inputs
      var inputs = elements.filter("textarea, input").addClass("error");

      //Show the validation message in the portal sections
      if( this.sectionsView ){
        this.sectionsView.showValidation(elements);
      }

    },

    /**
    * Removes all the validation error styling and messaging from this view
    */
    removeValidation: function(){
      EditorView.prototype.removeValidation.call(this);
      this.$(".section-link-container.error, input.error, textarea.error").removeClass("error");
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
     * If the given portal doesn't exist, display a Not Found message.
     */
    showNotFound: function(){

      this.hideLoading();

      var notFoundMessage = "The portal \"" + (this.model.get("label") || this.portalIdentifier) +
                            "\" doesn't exist.";

      MetacatUI.appView.showAlert(notFoundMessage, "alert-error", this.$el, undefined, { remove: true });
    },

    /**
    * This function is called whenever the window is scrolled.
    */
    handleScroll: function() {
      var menu = $(".section-links-toggle-container")[0],
          menuHeight = $(menu).height(),
          editorFooterHeight = 73,
          hiddenHeight = (menuHeight * -1) + 73;
      var currentScrollPos = window.pageYOffset;
      if(MetacatUI.appView.prevScrollpos > currentScrollPos) {
        menu.style.bottom = "73px";
      } else {
        menu.style.bottom = hiddenHeight +"px";
      }
      MetacatUI.appView.prevScrollpos = currentScrollPos;
    },

    /**
     * This function is called when the app navigates away from this view.
     * Any clean-up or housekeeping happens at this time.
     */
    onClose: function(){

      $("body")
        .removeClass("Editor")
        .removeClass("Portal");

      //Remove listeners
      this.stopListening();
      this.undelegateEvents();
      $(window).off("scroll", "", this.handleScroll);
    },

  });

  return PortalEditorView;

});
