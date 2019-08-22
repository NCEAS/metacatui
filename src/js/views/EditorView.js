define(['underscore',
        'jquery',
        'backbone',
        "views/SignInView",
        "text!templates/editorSubmitMessage.html"],
function(_, $, Backbone, SignInView, EditorSubmitMessageTemplate){

  /**
  * @class EditorView
  */
  var EditorView = Backbone.View.extend({


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
    * The events this view will listen to and the associated function to call
    * @type {Object}
    */
    events: {
      "click #save-editor" : "save"
    },

    render: function(){

    },

    /**
     * Set listeners on the view's model.
     * This function centralizes all the listeners so that when/if the view's
     * model is replaced, the listeners can be reset.
     */
    setListeners: function() {

      this.stopListening(this.model);
      this.listenTo(this.model, "errorSaving", this.saveError);
      this.listenTo(this.model, "successSaving", this.saveSuccess);
      this.listenTo(this.model, "invalid", this.showValidation);

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

      //Get all the inputs in the Editor
      var allInputs = this.$("input, textarea, select, button");

      //Mark the disabled inputs so we can re-disable them later
      allInputs.filter(":disabled")
               .addClass("disabled-saving");

      //Disable all the inputs
      allInputs.prop("disabled", true);

    },

    /**
    *  Remove the styles set in showSaving()
    */
    hideSaving: function(){
      this.$("input, textarea, select, button")
          .prop("disabled", false);

      this.$(".disabled-saving, input.disabled")
          .prop("disabled", true)
          .removeClass("disabled-saving");

        //When the package is saved, revert the Save button back to normal
        this.$("#save-editor").html("Submit dataset").removeClass("btn-disabled");

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
              "<li>The ID '" + this.pid  + "' does not exist.</li>" +
            '<li>This may be private content. (Are you <a href="<%= MetacatUI.root %>/signin">signed in?</a>)</li>' +
            "<li>The content was removed because it was invalid.</li>" +
          "</ul>";

        //Remove the loading messaging
        this.hideLoading();

        //Show the not found message
        MetacatUI.appView.showAlert(msg, "alert-error", this.$("#editor-body"), null, {remove: true});

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
      // TODO: display validation errors in the editor
      // For now, just show a save error message
      this.saveError();
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

      MetacatUI.appView.showAlert(messageContainer, messageClasses, this.$el, null, {
        emailBody: errorMsg,
        remove: true
      });

      this.hideSaving();
    }


  });

  return EditorView;
});
