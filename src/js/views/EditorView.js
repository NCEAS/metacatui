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
    * The text to use in the editor submit button
    * @type {string}
    */
    submitButtonText: "Save",

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

      //Stop listening first
      this.stopListening(this.model, "errorSaving", this.saveError);
      this.stopListening(this.model, "successSaving", this.saveSuccess);
      this.stopListening(this.model, "invalid", this.showValidation);

      //Set listeners
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

      //Remove all the validation messaging
      this.removeValidation();

      //Get all the inputs in the Editor
      var allInputs = this.$("input, textarea, select, button");

      //Mark the disabled inputs so we can re-disable them later
      allInputs.filter(":disabled")
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
          .prop("disabled", false);

      this.$(".disabled-saving, input.disabled")
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


    }

  });

  return EditorView;
});
