define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectSectionModel',
        "views/project/editor/ProjEditorSectionView",
        "views/project/editor/ProjEditorLogosView",
        "views/AccessPolicyView",
        "text!templates/project/editor/projEditorSettings.html"],
function(_, $, Backbone, ProjectSection, ProjEditorSectionView, ProjEditorLogosView,
  AccessPolicyView,
  Template){

  /**
  * @class ProjEditorSettingsView
  */
  var ProjEditorSettingsView = ProjEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjEditorSettings",

    /**
    * The display name for this Section
    * @type {string}
    */
    sectionName: "Settings",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: ProjEditorSectionView.prototype.className + " proj-editor-settings",

    /**
    * The ProjectModel that is being edited
    * @type {Project}
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
    * Creates a new ProjEditorSettingsView
    * @constructs ProjEditorSettingsView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      //Call the superclass initialize() function
      ProjEditorSectionView.prototype.initialize(options);


    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template({
        label: this.model.get("label")
      }));

      //Render the AccessPolicyView
      //TODO: Get the AccessPolicy collection for this ProjectModel and send it to the view
      var accessPolicyView = new AccessPolicyView();
      accessPolicyView.render();
      this.$(".permissions-container").html(accessPolicyView.el);

      //Render the ProjEditorLogosView
      var logosView = new ProjEditorLogosView({ model: this.model });
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

      // Validate label. The newProjectTempName is a restricted value.
      this.model.validateLabel(value, [this.newProjectTempName]);

    }

  });

  return ProjEditorSettingsView;

});
