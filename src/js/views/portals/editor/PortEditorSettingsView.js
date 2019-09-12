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
      this.$el.html(this.template({
        label: this.model.get("label"),
        description: this.model.get("description"),
        descriptionHelpText: "Describe your portal in one brief paragraph. This description will appear in search summaries.",
        descriptionPlaceholder: "Answer who, where, what, when, and why about your portal."
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

      this.listenToOnce(this.model, "labelUnchanged", function(){
        this.removeLabelValidation(e);
      }, this, e);

      this.listenToOnce(this.model, "labelAvailable", function(){
        messageEl.html("<i class='icon-check'></i> This URL is available");
        container.removeClass("error");
        container.addClass("success");
      });

      this.listenToOnce(this.model, "labelBlank", function(){
        messageEl.html("A URL is required");
        container.removeClass("success");
        container.addClass("error");
      });

      this.listenToOnce(this.model, "labelTaken", function(){
        messageEl.html("This URL is already taken, please try something else");
        container.removeClass("success");
        container.addClass("error");
      });

      this.listenToOnce(this.model, "labelRestricted", function(){
        messageEl.html("This URL is not allowed, please try something else");
        container.removeClass("success");
        container.addClass("error");
      });

      this.listenToOnce(this.model, "labelIncludesIllegalCharacters", function(){
        messageEl.html("URLs may only contain letters, numbers, underscores (_), and dashes (-).");
        container.removeClass("success");
        container.addClass("error");
      });

      this.listenToOnce(this.model, "errorValidatingLabel", function(){
        var email = MetacatUI.appModel.get('emailContact');
        messageEl.html("There was a problem checking the availablity of this URL. " +
          "Please try again or <a href='mailto:" + email + "'> contact us at " +
          email + "</a>."
        );
        container.removeClass("success");
        container.addClass("error");
      });

      // Show 'checking URL' message
      messageEl.html(
        "<i class='icon-spinner icon-spin icon-large loading icon'></i> "+
        "Checking if URL is available"
      );

      // Validate label. The newPortalTempName is a restricted value.
      this.model.validateLabel(value, [this.newPortalTempName]);

    }

  });

  return PortEditorSettingsView;

});
