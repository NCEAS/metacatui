define(['underscore',
        'jquery',
        'backbone',
        "views/SignInView",
        "text!templates/editorSubmitMessage.html"],
function(_, $, Backbone, SignInView, EditorSubmitMessageTemplate){

  /**
  * @class EditorView
  * @classdesc A basic shell of a view, primarily meant to be extended for views that allow editing capabilities.
  * @classcategory Views
  * @name EditorView
  * @extends Backbone.View
  * @constructs
  */
  var EditorView = Backbone.View.extend(
    /** @lends EditorView.prototype */{


    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    editorSubmitMessageTemplate: _.template(EditorSubmitMessageTemplate),

    /**
    * The element this view is contained in. A jQuery selector or the element itself.
    * @type {string|DOMElement}
    */
    el: "#Content",

    /**
    * The text to use in the editor submit button
    * @type {string}
    */
    submitButtonText: "Save",

    /**
    * The text to use in the editor submit button
    * @type {string}
    */
    accessPolicyModalID: "editor-access-policy-modal",

    /**
    * The selector for the HTML element that will contain a button/link/control for
    * opening the AccessPolicyView modal window. If this element doesn't exist on the page,
    * then the AccessPolicyView will be inserted into the `accessPolicyViewContainer` directly, rather than a modal window.
    * @type {string}
    */
    accessPolicyControlContainer: ".access-policy-control-container",

    /**
    * The selector for the HTML element that will contain the AccessPolicyView.
    * If this element doesn't exist on the page, then the AccessPolicyView will not be inserted into the page.
    * If a `accessPolicyControlContainer` element is on the page, then this element will
    * contain the modal window element.
    * @type {string}
    */
    accessPolicyViewContainer: ".access-policy-view-container",
    /**
    * The events this view will listen to and the associated function to call
    * @type {Object}
    */
    events: {
      "click #save-editor" : "save",
      "click .access-policy-control" : "showAccessPolicyModal",
      "keypress input" : "showControls",
      "keypress textarea" : "showControls",
      "keypress [contenteditable]" : "showControls",
      "click .image-uploader" : "showControls",
      "change .access-policy-view" : "showControls",
      "click .access-policy-view .remove" : "showControls"
    },

    /**
    * Renders this view
    */
    render: function(){
      //Style the body as an Editor
      $("body").addClass("Editor rendering");

      this.delegateEvents();

      //If there is no active alternate repository, set one
      if( !MetacatUI.appModel.getActiveAltRepo() && MetacatUI.appModel.get("alternateRepositories").length ){
        MetacatUI.appModel.setActiveAltRepo();
      }
    },

    /**
     * Set listeners on the view's model.
     * This function centralizes all the listeners so that when/if the view's
     * model is replaced, the listeners can be reset.
     */
    setListeners: function() {

      //Stop listening first
      this.stopListening(this.model, "errorSaving", this.saveError);
      this.stopListening(this.model, "successSaving", this.saveSuccess);
      this.stopListening(this.model, "invalid", this.showValidation);

      //Set listeners
      this.listenTo(this.model, "errorSaving", this.saveError);
      this.listenTo(this.model, "successSaving", this.saveSuccess);
      this.listenTo(this.model, "invalid", this.showValidation);

      // //Set a beforeunload event only if there isn't one already
      // if( !this.beforeunloadCallback ){
      //   var view = this;
      //   //When the Window is about to be closed, show a confirmation message
      //   this.beforeunloadCallback = function(e){
      //     if( !view.canClose() ){
      //       //Browsers don't support custom confirmation messages anymore,
      //       // so preventDefault() needs to be called or the return value has to be set
      //       e.preventDefault();
      //       e.returnValue = "";
      //     }
      //     return;
      //   }
      //   window.addEventListener("beforeunload", this.beforeunloadCallback);
      // }
    },

    /**
    * Show Sign In buttons
    */
    showSignIn: function(){
      var container = $(document.createElement("div")).addClass("container center");
      this.$el.html(container);
      var signInButtons = new SignInView().render().el;
      $(container).append('<h1>Sign in to submit data</h1>', signInButtons);
    },

    /**
    * Saves the model
    */
    save: function(){
      this.showSaving();
      this.model.save();
    },

    /**
     * Cancel all edits in the editor by simply re-rendering the view
     */
    cancel: function(){
      this.render();
    },

    /**
    * Trigger a save error with a message that the save was cancelled
    */
    handleSaveCancel: function(){
      if(this.model.get("uploadStatus") == "e"){
        this.saveError("Your submission was cancelled due to an error.");
      }
    },

    /**
    * Adds top-level control elements to this editor.
    */
    renderEditorControls: function(){
      //If the AccessPolicy editor is enabled, add a button for opening it
      if( MetacatUI.appModel.get("allowAccessPolicyChanges")){
        this.renderAccessPolicyControl();
      }
    },

    /**
    * Adds a Share button for editing the access policy
    */
    renderAccessPolicyControl: function(){
      //If the AccessPolicy editor is enabled, add a button for opening it
      if( MetacatUI.appModel.get("allowAccessPolicyChanges") ){

        var isHiddenBehindControl = (this.$(this.accessPolicyControlContainer).length > 0);

        //Render the AccessPolicy control, if the container element is on the page
        if( isHiddenBehindControl ){
          //If it isn't, then add it to the page.
          //Create an anchor tag with an icon and the text "Share" and add it to the editor controls container
          this.$(this.accessPolicyControlContainer).prepend( $(document.createElement("a"))
                                                    .attr("href", "#")
                                                    .addClass("access-policy-control btn")
                                                    .append(
                                                      $(document.createElement("i")).addClass("icon-group icon icon-on-left"),
                                                      "Share") );
        }

        //If the authorization has already been checked
        if( this.model.get("isAuthorized_changePermission") === true ){
          //Render the AccessPolicyView
          this.renderAccessPolicy();
        }
        else{
          //When the user's changePermission authority has been checked, edit their
          //  access to the AccessPolicyView
          this.listenToOnce(this.model, "change:isAuthorized_changePermission", function(){
            //If there is an AccessPolicy control, disable it
            if( isHiddenBehindControl ){

              if( this.model.get("isAuthorized_changePermission") === false ){
                //Disable the button for the AccessPolicyView if the user is not authorized
                this.$(".access-policy-control").attr("disabled", "disabled")
                                                .attr("title", "You do not have access to change the " + MetacatUI.appModel.get("accessPolicyName"))
                                                .addClass("disabled");
              }
            }
            else{
              //Render the AccessPolicyView
              this.renderAccessPolicy();
            }
          });

          //Check the user's authority to change permissions on this object
          this.model.checkAuthority("changePermission");
        }

      }
    },

    /**
    * Shows the AccessPolicyView for the object being edited.
    *
    * @param {Event} e - The click event
    * @param {Backbone.Model | null} model - The model to show the view for. If
    *   null, defaults to the model set for the view.
    */
    showAccessPolicyModal: function(e, model){
      try{

        // If the AccessPolicy editor is disabled in this app, or the specific
        // .access-policy-control has theh class diasbled, then exit now
        if (!MetacatUI.appModel.get("allowAccessPolicyChanges") ||
          this.$(".access-policy-control").attr("disabled") == "disabled" ||
          (e.currentTarget && $(e.currentTarget).hasClass("disabled"))) {
          return;
        }


        this.renderAccessPolicy(model);

        this.on("accessPolicyViewRendered", function(){
          //Add modal classes to the access policy view
          this.$(".access-policy-view").addClass("access-policy-view-modal modal")
                                      .modal()
                                      .modal("show");
        });

      }
      catch(e){
        console.error("Error trying to show the AccessPolicyView: ", e);
      }
    },

    /**
    * Renders the AccessPolicyView
    * @param {Backbone.Model} model - Optional. The Model to render the
    *   AccessPolicy of. If not passed, method uses the Editor's model
    */
    renderAccessPolicy: function(model){
      // Use specified model or default to the editor's model
      model = model || this.model;

      try{

        //If the AccessPolicy editor is disabled in this app, then exit now
        if( !MetacatUI.appModel.get("allowAccessPolicyChanges")){
          return;
        }

        var thisView = this;
        require(['views/AccessPolicyView'], function(AccessPolicyView){

            // Create a new AccessPolicyView using the AccessPolicy collection
            var accessPolicyView = new AccessPolicyView({
              collection: model.get("accessPolicy")
            });

            // Turn on accessPolicy broadcasting for metadata models
            if (model.get("type") === "Metadata") {
              accessPolicyView.broadcast = true;
            }

            //Store a reference to the AccessPolicyView on this view
            thisView.accessPolicyView = accessPolicyView;

            //Add the view to the page
            thisView.$(thisView.accessPolicyViewContainer).html(accessPolicyView.el);

            //Render the AccessPolicyView
            accessPolicyView.render();

            thisView.trigger("accessPolicyViewRendered");

            thisView.listenTo(accessPolicyView.collection, "add remove", thisView.showControls);
        });
      }
      catch(e){
        console.error("Error trying to render the AccessPolicyView: ", e);
      }
    },

    /**
    * Show the editor footer controls (Save bar)
    */
    showControls: function(){
      this.$(".editor-controls").removeClass("hidden").slideDown();
    },

    /**
    * Hide the editor footer controls (Save bar)
    */
    hideControls: function(){
        this.hideSaving();

      this.$(".editor-controls").slideUp();
    },

    /**
    * Change the styling of this view to show that the object is in the process of saving
    */
    showSaving: function(){

      //Change the style of the save button
      this.$("#save-editor")
        .html('<i class="icon icon-spinner icon-spin"></i> Submitting ...')
        .addClass("btn-disabled");

      //Remove all the validation messaging
      this.removeValidation();

      //Get all the inputs in the Editor
      var allInputs = this.$("input, textarea, select, button");

      //Mark the disabled inputs so we can re-disable them later
      allInputs.filter(":disabled")
               .not(".label-container .label-input-text")
               .addClass("disabled-saving");

      //Remove the latest success or error alert
      this.$el.children(".alert-container").remove();

      //Disable all the inputs
      allInputs.prop("disabled", true);

    },

    /**
    *  Remove the styles set in showSaving()
    */
    hideSaving: function(){
      this.$("input, textarea, select, button")
          .not(".label-container .label-input-text")
          .prop("disabled", false);

      this.$(".disabled-saving, input.disabled")
          .not(".label-container .label-input-text")
          .prop("disabled", true)
          .removeClass("disabled-saving");

        //When the package is saved, revert the Save button back to normal
        this.$("#save-editor").html(this.submitButtonText).removeClass("btn-disabled");

    },

    /**
    * Style the view to show that it is loading
    * @param {string|DOMElement} container - The element to put the loading styling in. Either a jQuery selector or the element itself.
    * @param {string|DOMElement} message - The message to display next to the loading icon. Either a jQuery selector or the element itself.
    */
    showLoading: function(container, message){
      if(typeof container == "undefined" || !container)
        var container = this.$el;

      $(container).html(MetacatUI.appView.loadingTemplate({ msg: message }));
    },

    /**
    * Remove the styles set in showLoading()
    * @param {string|DOMElement} container - The element the loading message is conttained in. Either a jQuery selector or the element itself.
    */
    hideLoading: function(container){
      if(typeof container == "undefined" || !container)
        var container = this.$el;

      $(container).find(".loading").remove();
    },

    /**
     * Called when there is no object found with this ID
     */
    showNotFound: function(){
        //If we haven't checked the logged-in status of the user yet, wait a bit until we show a 404 msg, in case this content is their private content
        if(!MetacatUI.appUserModel.get("checked")){
          this.listenToOnce(MetacatUI.appUserModel, "change:checked", this.showNotFound);
          return;
        }
        //If the user is not logged in
        else if(!MetacatUI.appUserModel.get("loggedIn")){
          this.showSignIn();
          return;
        }

        if(!this.model.get("notFound")) return;

        var msg = "<h4>Nothing was found for one of the following reasons:</h4>" +
          "<ul class='indent'>" +
              "<li>The ID <span id='editor-view-not-found-pid'></span> does not exist.</li>" +
            '<li>This may be private content. (Are you <a href="<%= MetacatUI.root %>/signin">signed in?</a>)</li>' +
            "<li>The content was removed because it was invalid.</li>" +
          "</ul>";

        //Remove the loading messaging
        this.hideLoading();

        //Show the not found message
        MetacatUI.appView.showAlert(msg, "alert-error", this.$("#editor-body"), null, {remove: true});

        this.$("#editor-view-not-found-pid").text(this.pid);

    },

    /**
    * Check the validity of this view's model
    */
    checkValidity: function(){
      if(this.model.isValid())
        this.model.trigger("valid");
    },

    /**
     * Show validation errors, if there are any
     */
    showValidation: function(){
      this.saveError("Unable to save. Either required information is missing or isn't filled out correctly.");
    },

    /**
    * Removes all the validation error styling and messaging from this view
    */
    removeValidation: function(){
      this.$(".notification.error").removeClass("error").empty();
      this.$(".validation-error-icon").hide();
    },

    /**
     * When the object is saved successfully, tell the user
     * @param {object} savedObject - the object that was successfully saved
     */
    saveSuccess: function(savedObject){

      var message = this.editorSubmitMessageTemplate({
            messageText: "Your changes have been submitted.",
            viewURL: MetacatUI.appModel.get("baseUrl"),
            buttonText: "Return home"
        });

      MetacatUI.appView.showAlert(message, "alert-success", this.$el, null, {remove: true});

      this.hideSaving();

    },

    /**
     * When the object fails to save, tell the user
     * @param {string} errorMsg - The error message resulting from a failed attempt to save
     */
    saveError: function(errorMsg){

      var messageContainer = $(document.createElement("div")).append(document.createElement("p")),
          messageParagraph = messageContainer.find("p"),
          messageClasses = "alert-error";

      messageParagraph.append(errorMsg);

      //If the model has an error message set on it, show it in a collapseable technical details section
      if( this.model.get("errorMessage") ){
        var errorId = "error" + Math.round(Math.random()*100);
        messageParagraph.after($(document.createElement("p")).append($(document.createElement("a"))
                  .text("See technical details")
                  .attr("data-toggle", "collapse")
                  .attr("data-target", "#" + errorId)
                  .addClass("pointer")),
                $(document.createElement("div"))
                  .addClass("collapse")
                  .attr("id", errorId)
                  .append($(document.createElement("pre")).text(this.model.get("errorMessage"))));
      }

      MetacatUI.appView.showAlert(messageContainer, messageClasses, this.$el, null, {
        emailBody: errorMsg,
        remove: true
      });

      this.hideSaving();
    },

    /**
    * Shows the required icons for the sections and fields that must be completed in this editor.
    * @param {object} requiredFields - A literal object that specified which fields should be required.
    *  The keys on the object map to model attributes, and the value is true if required, false if optional.
    */
    renderRequiredIcons: function(requiredFields){

      //If no required fields are given, exit now
      if( typeof requiredFields == "undefined" ){
        return;
      }

      _.each( Object.keys(requiredFields), function(field){

        if(requiredFields[field]){
          var reqEl = this.$(".required-icon[data-category='" + field + "']");

          //Show the required icon for this category/field
          reqEl.show();

          //Show the required icon for the section
          var sectionName = reqEl.parents(".section[data-section]").attr("data-section");
          this.$(".required-icon[data-section='" + sectionName + "']").show();
        }

      }, this);
    },

    /**
    * Checks if there are unsaved changes in this Editor that should prevent closing of this view.
    * This function is also executed by the AppView, which controls the top-level navigation.
    * @returns {boolean} Returns true if this view should be closed. False if it should remain opened and active.
    */
    canClose: function(){

      //If the user isn't logged in, we can leave this view without confirmation
      if( !MetacatUI.appUserModel.get("loggedIn") )
        return true;

      //If there are no unsaved changes, we can leave this view without confirmation
      if( !this.hasUnsavedChanges() ){
        return true;
      }

      return false;

    },

    /**
    * This function is called whenever the user is about to leave this view.
    * @returns {string} The message that asks the user if they are sure they want to close this view
    */
    getConfirmCloseMessage: function(){

      //Return a confirmation message
      return "Leave this page? All of your unsaved changes will be lost.";

    },

    /**
    * Returns true if there are unsaved changes in this Editor
    * This function should be exended by each subclass of EditorView to check for unsaved changes for that model type
    * @returns {boolean}
    */
    hasUnsavedChanges: function(){
      return true;
    },

    /**
    *  Perform clean-up functions when this view is about to be removed from the page or navigated away from.
    */
    onClose: function(){

      //Remove the listener on the Window
      if( this.beforeunloadCallback ){
        window.removeEventListener("beforeunload", this.beforeunloadCallback);
        delete this.beforeunloadCallback;
      }

      //Reset the active alternate repository
      MetacatUI.appModel.set("activeAlternateRepositoryId", null);

      //Remove the class from the body element
      $("body").removeClass("Editor rendering");

      //Remove listeners
      this.stopListening();
      this.undelegateEvents();

    }

  });

  return EditorView;
});
