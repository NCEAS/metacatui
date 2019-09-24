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
      "click .change-portal-url"        : "changePortalUrl",
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
        portalTermPlural: MetacatUI.appModel.get("portalTermPlural")
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

      var container = $(e.target).parents(".label-container").first(),
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

      var container = $(e.target).parents(".label-container").first(),
          input = $(e.target),
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
          email + "</a>."
        );
        container.removeClass("success");
        container.addClass("error");
      });

      //Validate the label string
      var error = this.model.validateLabel(value, [this.newPortalTempName]);

      //If there is an error, display it and exit
      if( error ){
        messageEl.html(error);
        container.removeClass("success");
        container.addClass("error");
        return;
      }

      this.listenToOnce(this.model, "labelAvailable", function(){
        messageEl.html("<i class='icon-check'></i> This URL is available");
        container.removeClass("error");
        container.addClass("success");
      });

      this.listenToOnce(this.model, "labelTaken", function(){
        messageEl.html("This URL is already taken, please try something else");
        container.removeClass("success");
        container.addClass("error");
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
     * Makes the portal url editable whenever the `change url` button is clicked
     *
     *
     *  @param {Event} e - The click event
     */
    changePortalUrl: function(e) {
      var changeButton = e.target;
      var displayedLabel = $(".display-label-url");
      var labelContainer = $(".label-container");

      if ($(changeButton).text() === "Cancel") {
        $(displayedLabel).show();
        $(labelContainer).hide();
        $(changeButton).html("Change URL");
        $(changeButton).removeClass("btn-primary");
        $(changeButton).addClass("btn-danger");
      }
      else {
        $(displayedLabel).hide();
        $(labelContainer).show();
        $(changeButton).html("Cancel");
        $(changeButton).removeClass("btn-danger");
        $(changeButton).addClass("btn-primary");
      }

    }

  });

  return PortEditorSettingsView;

});
