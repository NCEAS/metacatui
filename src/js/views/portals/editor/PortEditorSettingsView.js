define(['underscore',
        'jquery',
        'backbone',
        'models/portals/PortalSectionModel',
        "views/portals/editor/PortEditorSectionView",
        "views/portals/editor/PortEditorLogosView",
        "views/AccessPolicyView",
        "text!templates/portals/editor/portEditorSettings.html"],
function(_, $, Backbone, PortalSection, PortEditorSectionView, PortEditorLogosView,
  AccessPolicyView,
  Template){

  /**
  * @class PortEditorSettingsView
  */
  var PortEditorSettingsView = PortEditorSectionView.extend(
    /** @lends PortEditorSettingsView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorSettings",

    /**
    * The display name for this Section
    * @type {string}
    */
    uniqueSectionLabel: "Settings",

    /**
    * The type of section view this is
    * @type {string}
    */
    sectionType: "settings",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: PortEditorSectionView.prototype.className + " port-editor-settings",

    /**
    * The id attribute of the view element
    * @param {string}
    */
    id: "Settings",

    /**
    * The PortalModel that is being edited
    * @type {Portal}
    */
    model: undefined,

    /**
    * A reference to the PortalEditorView
    * @type {PortalEditorView}
    */
    editorView: undefined,

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "focusout .label-container input" : "showLabelValidation",
      "click .change-label"             : "changeLabel",
      "click .cancel-change-label"      : "cancelChangeLabel",
      "click .ok-change-label"          : "okChangeLabel",
      "keyup .label-container input"    : "removeLabelValidation"
    },

    /**
    * Creates a new PortEditorSettingsView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      try {
        //Call the superclass initialize() function
        PortEditorSectionView.prototype.initialize(options);
      } catch (e) {
        console.log("Error initializing the portal editor settings view. Error message: " + e);
      }
    },

    /**
    * Renders this view
    */
    render: function(){

      try {
        //Insert the template into the view
        var portalTermSingular = MetacatUI.appModel.get("portalTermSingular");
        this.$el.html(this.template({
          label: this.model.get("label"),
          description: this.model.get("description"),
          portalTermPlural: MetacatUI.appModel.get("portalTermPlural"),
          portalTermSingular: MetacatUI.appModel.get("portalTermSingular")
        }));

        //Render the AccessPolicyView
        //TODO: Get the AccessPolicy collection for this PortalModel and send it to the view
        var accessPolicyView = new AccessPolicyView();
        accessPolicyView.render();
        this.$(".permissions-container").html(accessPolicyView.el);

        //Render the PortEditorLogosView
        var logosView = new PortEditorLogosView({
          model: this.model,
          editorView: this.editorView
        });
        logosView.render();
        this.$(".logos-container").html(logosView.el).data("view", logosView);

        //Save a reference to this view
        this.$el.data("view", this);

        // If it's a new model, it won't have a label (URL) yet. Display the label
        // input field so the user doesn't miss it.
        if (this.model.get("isNew")) {
          this.changeLabel();
        }
      } catch (e) {
        console.log("Error rendering the portal editor settings view. Error message: "+ e);
      }

    },

    /**
     * Removes help text and css formatting that indicates error or success after label/URL validation.
     *
     *  @param {Event} e - The keyup or focusout event
     */
    removeLabelValidation: function(e){

      try {
        var container = this.$(".label-container"),
            messageEl = $(container).find('.notification');

        // Remove input formating if there was any
        messageEl.html("");
        container.removeClass("error");
        container.removeClass("success");
        container.find(".error").removeClass("error");
        container.find(".success").removeClass("success");

        if(!this.model.get("isNew")){
          // Ensure that the OK button is showing, may be hidden if a previous
          // attempt to change the label resulted in an error
          this.$(".ok-change-label").show();
        }
      } catch (error) {
        console.log("Error removing label validation, error message: " + error);
      }

    },


    /**
     * showLabelValidationError - add css formatting and hide OK button when there are errors in label validation.
     *
     * @param {Event} e - The keyup or focusout event
     */
    showLabelValidationError: function(e){

      try {
        var container = this.$(".label-container"),
            input = container.find('input'),
            messageEl = container.find('.notification'),
            okButton = container.find('.ok-change-label');

        messageEl.addClass("error");
        input.addClass("error");
        okButton.hide();
      } catch (error) {
        console.log("Error showing label validation error, message: " + error);
      }

    },

    /**
     * Initiates validatation of the newly inputed label (a URL component).
     * Listens for a response from the model, then displays help text based on
     * whether the new label was valid or not.
     *
     *  @param {Event} e - The focusout event
     */
    showLabelValidation: function(e){

      try{
        var container = this.$(".label-container"),
            input = container.find('input'),
            messageEl = container.find('.notification'),
            value = input.val(),
            model = this.model;

        //If the label is unchanged, remove the validation messaging and exit
        if( value == this.model.get("originalLabel") ){
          this.removeLabelValidation(e);
          return;
        }

        //If there is an error checking the validity, display a message
        this.listenToOnce(this.model, "errorValidatingLabel", function(){
          this.removeLabelValidation(e);
          var email = MetacatUI.appModel.get('emailContact');
          messageEl.html("There was a problem checking the availablity of this URL. " +
                         "Please try again or <a href='mailto:" + email + "'> contact us at " +
                         email + "</a>.");
          this.showLabelValidationError(e);
        });

        // Validate the label string
        var error = this.model.validateLabel(value);

        // If there is an error, display it and exit
        if( error ){
          this.removeLabelValidation(e);
          this.showLabelValidationError(e);
          messageEl.html(error);
          return;
        }

        // If there are no validation errors, check label availability

        // Success
        this.listenToOnce(this.model, "labelAvailable", function(){
          this.removeLabelValidation(e);
          messageEl.html("<i class='icon-check'></i> This URL is available")
                   .addClass("success");
          // Make sure the OK button is enabled
          if(!this.model.isNew()){
            this.$(".ok-change-label").show();
          }
        });

        // Error: label taken
        this.listenToOnce(this.model, "labelTaken", function(){
          this.removeLabelValidation(e);
          this.showLabelValidationError(e);
          messageEl.html("This URL is already taken, please try something else");

          //Manually add the validation error message since this check is done outside of the validate() function
          if( typeof this.model.validationError == "object" && this.model.validationError !== null ){
            this.model.validationError.label = "This URL is already taken, please try something else";
          }
          else{
            this.model.validationError = {
              label: "This URL is already taken, please try something else"
            }
          }
        });

        // Check label availability
        this.model.checkLabelAvailability(value);

        // Show 'checking URL' message
        messageEl.html(
          "<i class='icon-spinner icon-spin icon-large loading icon'></i> "+
          "Checking if URL is available"
        );
      }
      catch(error){
        console.log("Error validating the label, error message: " + error);
      }
    },

    /**
     * Makes the portal label editable whenever the `change url` button is clicked
     */
    changeLabel: function(){
      try {
        //Get the label at this point in time
        this.model.set("latestLabel", this.model.get("label"));

        //Hide the label display and Change button
        this.$(".display-label, .change-label").hide();
        //Show the input and controls
        this.$(".label-container").show();

        // If the model is new, hide the Cancel and Ok buttons.
        if (this.model.get("isNew")) {
          this.$(".ok-change-label").hide();
          this.$(".cancel-change-label").hide();
        }
      } catch (e) {
        console.log("Error changing label, error message: " + e);
      }
    },

    /**
     * Cancels changing the portal label
     */
    cancelChangeLabel: function(){
      try {
        //Reset the label
        this.model.set("label", this.model.get("latestLabel"));
        this.$(".label-container input").val(this.model.get("label"));

        //Validate the label
        this.showLabelValidation();

        //Show the label display and Change button
        this.$(".display-label, .change-label").show();
        // Ensure that the OK button is showing, may be hidden if a previous
        // attempt to change the label resulted in an error
        this.$(".ok-change-label").show();
        //Hide the input and controls
        this.$(".label-container").hide();
      } catch (e) {
        console.log("Error cancelling the changes to label, error message: " + e);
      }
    },

    /**
     * Shows the portal label as saved
     */
    okChangeLabel: function(){
      try {
        //Show the label display and Change button
        this.$(".display-label, .change-label").show();
        //Hide the input and controls
        this.$(".label-container").hide();

        //If there is a validation error with the label, revert it back
        if( this.model.validationError && this.model.validationError.label ){
          this.model.set("label", this.model.get("latestLabel"));
          this.$(".label-container input").val(this.model.get("label"));
        }
        else{
          this.$(".display-label-value").text(this.model.get("label"));
        }

        //Validate the label
        this.showLabelValidation();
      } catch (e) {
        console.log("Error showing the portal label as saved, error message: " + e);
      }
    }

  });

  return PortEditorSettingsView;

});
