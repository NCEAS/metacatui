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
  var PortEditorSettingsView = PortEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorSettings",

    /**
    * The display name for this Section
    * @type {string}
    */
    sectionName: "Settings",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: PortEditorSectionView.prototype.className + " port-editor-settings",

    /**
    * The PortalModel that is being edited
    * @type {Portal}
    */
    model: undefined,

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
    * @constructs PortEditorSettingsView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      //Call the superclass initialize() function
      PortEditorSectionView.prototype.initialize(options);


    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      var portalTermSingular = MetacatUI.appModel.get("portalTermSingular");
      this.$el.html(this.template({
        label: this.model.get("label"),
        description: this.model.get("description"),
        descriptionHelpText: "Describe your " + portalTermSingular + " in one brief paragraph. This description will appear in search summaries.",
        descriptionPlaceholder: "Answer who, where, what, when, and why about your " + portalTermSingular +".",
        portalTermPlural: MetacatUI.appModel.get("portalTermPlural"),
        portalTermSingular: MetacatUI.appModel.get("portalTermSingular")
      }));

      //Render the AccessPolicyView
      //TODO: Get the AccessPolicy collection for this PortalModel and send it to the view
      var accessPolicyView = new AccessPolicyView();
      accessPolicyView.render();
      this.$(".permissions-container").html(accessPolicyView.el);

      //Render the PortEditorLogosView
      var logosView = new PortEditorLogosView({ model: this.model });
      logosView.render();
      this.$(".logos-container").html(logosView.el);

    },

    /**
     * Removes help text and css formatting that indicates error or success after label/URL validation.
     *
     *  @param {Event} e - The keyup or focusout event
     */
    removeLabelValidation: function(e){

      var container = this.$(".label-container"),
          messageEl = $(container).find('.notification');

      // Remove input formating if there was any
      messageEl.html("");
      container.removeClass("error");
      container.removeClass("success");
      container.find(".error").removeClass("error");
      container.find(".success").removeClass("success");

    },

    /**
     * Initiates validatation of the newly inputed label (a URL component).
     * Listens for a response from the model, then displays help text based on
     * whether the new label was valid or not.
     *
     *  @param {Event} e - The focusout event
     */
    showLabelValidation: function(e){

      var container = this.$(".label-container"),
          input = $(container).find('input'),
          messageEl = $(container).find('.notification'),
          value = input.val();

      //If the label is unchanged, remove the validation messaging and exit
      if( value == this.model.get("originalLabel") ){
        this.removeLabelValidation(e);
        return;
      }

      //If there is an error checking the validity, display a message
      this.listenToOnce(this.model, "errorValidatingLabel", function(){
        var email = MetacatUI.appModel.get('emailContact');
        messageEl.html("There was a problem checking the availablity of this URL. " +
                       "Please try again or <a href='mailto:" + email + "'> contact us at " +
                       email + "</a>.")
                 .removeClass("success")
                 .addClass("error");
        input.addClass("error");
      });

      //Validate the label string
      var error = this.model.validateLabel(value, [this.newPortalTempName]);

      //If there is an error, display it and exit
      if( error ){
        messageEl.html(error)
                 .removeClass("success")
                 .addClass("error");
        input.addClass("error");
        return;
      }

      this.listenToOnce(this.model, "labelAvailable", function(){
        messageEl.html("<i class='icon-check'></i> This URL is available")
                 .removeClass("error")
                 .addClass("success");
      });

      this.listenToOnce(this.model, "labelTaken", function(){
        messageEl.html("This URL is already taken, please try something else")
                 .removeClass("success")
                 .addClass("error");

        input.addClass("error");

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

      // Validate label. The newPortalTempName is a restricted value.
      this.model.checkLabelAvailability(value);

      // Show 'checking URL' message
      messageEl.html(
        "<i class='icon-spinner icon-spin icon-large loading icon'></i> "+
        "Checking if URL is available"
      );
    },

    /**
     * Makes the portal label editable whenever the `change url` button is clicked
     */
    changeLabel: function(){
      //Get the label at this point in time
      this.model.set("latestLabel", this.model.get("label"));

      //Hide the label display and Change button
      this.$(".display-label, .change-label").hide();
      //Show the input and controls
      this.$(".label-container").show();
    },

    /**
     * Cancels changing the portal label
     */
    cancelChangeLabel: function(){
      //Reset the label
      this.model.set("label", this.model.get("latestLabel"));
      this.$(".label-container input").val(this.model.get("label"));

      //Validate the label
      this.showLabelValidation();

      //Show the label display and Change button
      this.$(".display-label, .change-label").show();
      //Hide the input and controls
      this.$(".label-container").hide();
    },

    /**
     * Shows the portal label as saved
     */
    okChangeLabel: function(){
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
    }

  });

  return PortEditorSettingsView;

});
