define(['underscore',
        'jquery',
        'backbone',
        "views/SignInView"],
function(_, $, Backbone, SignInView){

  /**
  * @class EditorView
  */
  var EditorView = Backbone.View.extend({

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
    }

  });

  return EditorView;
});
