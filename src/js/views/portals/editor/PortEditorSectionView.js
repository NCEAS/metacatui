define(['underscore',
        'jquery',
        'backbone',
        'models/portals/PortalSectionModel',
        "text!templates/portals/editor/portEditorSection.html",
        "text!templates/portals/editor/portEditorPageOption.html"],
function(_, $, Backbone, PortalSectionModel, Template, PageOptionTemplate ){

  /**
  * @class PortEditorSectionView
  */
  var PortEditorSectionView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorSection",

    /**
    * The display name for this Section
    * @type {string}
    */
    sectionName: "",

    /**
    * The HTML tag name for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "port-editor-section",

    /**
    * The PortalSectionModel being displayed
    * @type {PortalSection}
    */
    model: undefined,

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),
    // The template for each of the page options
    pageOptionTemplate: _.template(PageOptionTemplate),

    /**
    * A jQuery selector for the element that the page option buttons should be inserted into
    * @type {string}
    */
    pageOptionsContainer: "#page-options-container",

    /**
    * Title and description for each of the page types a user can select from
    * @type {JSON}
    */
    pageOptions: {
      freeform: {
        title: "Freeform",
        description: "Add content and images styled using markdown"
      },
      metrics: {
        title: "Metrics",
        description: "Show visual summaries of your data collection"
      }
    },

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new PortEditorSectionView
    * @constructs PortEditorSectionView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {PortalSection} options.model - The PortalSection rendered in this view
    */
    initialize: function(options){

      // Get all the options and apply them to this view
      if( typeof options == "object" ) {
          var optionKeys = Object.keys(options);
          _.each(optionKeys, function(key, i) {
              this[key] = options[key];
          }, this);
      }

    },

    /**
    * Renders this view
    */
    render: function(){

      // Insert the template into the view
      this.$el.html(this.template());
      
      // Add a button for each page type the user can select from.
      _.each(this.pageOptions, function(pageData, pageType){
        this.$(this.pageOptionsContainer).append(
          this.pageOptionTemplate({
            id: "page-option-" + pageType,
            title: pageData.title,
            description: pageData.description
          })
        )
      }, this);

      // TODO: check if metrics is already in model, if so, disable
      // Change disabled button text to: "You can only add one --- type"

    },

    /**
    * Gets the name of this section and returns it
    * @param {Object} [options] - Optional options for the name that is returned
    * @property {Boolean} options.linkFriendly - If true, the name will be stripped of special characters
    * @return {string} The name for this section
    */
    getName: function(options){

      var name = "";

      //If a section name is set on the view, use that
      if( this.sectionName ){
        name = this.sectionName;
      }
      //If the model is a PortalSectionModel, use the label from the model
      else if( PortalSectionModel.prototype.isPrototypeOf(this.model) ){
        name = this.model.get("label");
      }
      else{
        name = "New section";
      }

      if( typeof options == "object" ){
        if( options.linkFriendly ){
          name = name.replace(/[^a-zA-Z0-9]/g, "-");
        }
      }

      return name;

    }

  });

  return PortEditorSectionView;

});
