define(['underscore',
        'jquery',
        'backbone',
        'models/portals/PortalSectionModel',
        "text!templates/portals/editor/portEditorSection.html",
        "text!templates/portals/editor/portEditorSectionOption.html",
        "text!templates/portals/editor/portEditorSectionOptionImgs/freeform.svg",
        "text!templates/portals/editor/portEditorSectionOptionImgs/metrics.svg"],
function(_, $, Backbone, PortalSectionModel, Template, SectionOptionTemplate, FreeformSVG, MetricsSVG){

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
    sectionOptionTemplate: _.template(SectionOptionTemplate),

    /**
    * A jQuery selector for the element that the section option buttons should be inserted into
    * @type {string}
    */
    sectionsOptionsContainer: "#section-options-container",

    /**
     * @typedef {Object} sectionOption - Information about a section type that can be added to a portal
     * @property {string} title - The name of the section type to be displayed to the user
     * @property {string} description - A brief description of the section type, to be displayed to the user
     * @property {string|number} limiter - The limiter is used to determine whether the user is allowed to add more of this section type. If limiter is a number, then it's used as the maximum number of the given sections allowed (currently this only applies to 'freeform'/markdown sections). If limiter is a string, it should be the name of the 'hide' option in the project model (e.g. hideMetrics for the metrics view). In this case, it's assumed that only one of the given page type is allowed.
     * @property {string} svg - SVG that illustrates the section type. SVG elements should use classes to define fill colors that are not greyscale, so that they may be greyed-out to indicate that a section type is unavailable. SVG elements that use theme colors should use the classes 'theme-primary-fill', 'theme-secondary-fill', and 'theme-accent-fill'.
    */

    /**
    * Information about each of the section types available to a user. Note that the key (e.g. "freeform") is used to ID the UI selection element.
    * @type {sectionOption[]}
    */
    sectionsOptions: {
      freeform: {
        title: "Freeform",
        description: "Add content and images styled using markdown",
        limiter: 30,
        svg: FreeformSVG,
      },
      metrics: {
        title: "Metrics",
        description: "Show visual summaries of your data collection",
        limiter: "hideMetrics",
        svg: MetricsSVG
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

      try{

        // Insert the template into the view
        this.$el.html(this.template());

        // Add a section option element for each section type the user can select from.
        _.each(this.sectionsOptions, function(sectionData, sectionType){

          this.$(this.sectionsOptionsContainer).append(
            this.sectionOptionTemplate({
              id: "section-option-" + sectionType,
              title: sectionData.title,
              description: sectionData.description,
              img: sectionData.svg
            })

          )

          // Check whether the section option is available to user
          this.toggleDisableSectionOption(sectionType);

          // For metrics, data, and members tabs, add a listener to update the
          // section availability when the associated model option is changed.
          if(typeof sectionData.limiter === 'string' || sectionData.limiter instanceof String){
            this.stopListening(this.model, "change:"+sectionData.limiter);
            this.listenTo(this.model, "change:"+sectionData.limiter, function(){
              try{
                this.toggleDisableSectionOption(sectionType);
              }
              catch(e){
                console.log("can't toggle disabling of section types, error message: " + e);
              }
            });
          }
        }, this);
      }
      catch(e){
        console.log("Section view cannot be rendered, error message: " + e);
      }

    },


    /**
    * Checks whether a section type is available to a user to add, then calls functions that change content and styling to indicate the availability to the user.
    * @param {string} sectionType - The section name. This is the same string used as the key in sectionsOptions (e.g. "freeform").
    */
    toggleDisableSectionOption: function(sectionType){

      try{

        var limiter  = this.sectionsOptions[sectionType].limiter;

        // If limiter's a string, look up whether this section type is hidden
        if(typeof limiter === 'string' || limiter instanceof String){
          // If it's currently hidden
          if(this.model.get(limiter)){
            // then allow user to 'unhide' it.
            this.enableSectionOption(sectionType);
          // If it's already displayed
          } else {
            // then user can't add more of this type of section.
            this.disableSectionOption(sectionType);
          }
        // If limiter's a number, compare it to the count of sections in the model
        } else if (typeof limiter === 'number' || limiter instanceof Number){
          if(this.model.get("sections").length < limiter){
            this.enableSectionOption(sectionType);
          } else {
            this.disableSectionOption(sectionType);
          }
        // If limiter is neither a string nor a number
        } else {
          console.log("Error: In toggleDisableSectionOption(sectionType), the sectionType must be a string or a number.");
          return
        }

      } catch(e) {
        console.error(e);
      }


    },

    /**
    * Adds styling and content to a section option element to indicate that the user already added the maximum allowable number of this section type (i.e. it's disabled).
    * @param {string} sectionType - The section name. This is the same string used as the key in sectionsOptions (e.g. "freeform").
    */
    disableSectionOption: function(sectionType){

      try{

        if(!sectionType || !(typeof sectionType === 'string' || sectionType instanceof String)){
          console.log("Error: In disableSectionOption(sectionType), a string that indicates the sectionType is required");
          return
        }

        var sectionOption = this.$("#section-option-" + sectionType),
            description   = sectionOption.find(".description"),
            limiter       = this.sectionsOptions[sectionType].limiter,
            title         = this.sectionsOptions[sectionType].title.toLowerCase(),
            limit         = (typeof limiter === 'number' || limiter instanceof Number) ?
                              limiter : 1,
            singOrPlur    = (limit > 1) ? "s" : "";

        sectionOption.addClass("disabled");
        description.html("You may only add " + limit + " " + title + " page" + singOrPlur );

        // Make sure disabled option isn't clickable
        sectionOption.off("click");

      } catch(e){
        console.log(e);
      }

    },

    /**
    * Adds styling and content to a section option element to indicate that the user is able to add more of this section type (i.e. it's not disabled).
    * @param {string} sectionType - The section name. This is the same string used as the key in sectionsOptions (e.g. "freeform").
    */
    enableSectionOption: function(sectionType){

      try{

        if(!sectionType || !(typeof sectionType === 'string' || sectionType instanceof String)){
          console.log("Error: In enableSectionOption(sectionType), a string that indicates the sectionType is required");
          return
        }

        var sectionOption   = this.$("#section-option-" + sectionType),
            descriptionEl   = sectionOption.find(".description"),
            descriptionText = this.sectionsOptions[sectionType].description;

        sectionOption.removeClass("disabled");
        descriptionEl.html(descriptionText);

        // When user clicks section option, add new section
        var view = this;
        sectionOption.off("click");
        sectionOption.on("click", function(e){
          // Tell the parent portEditorSectionsView to add tabs and content
          // for the new section.
          view.trigger("addSection", sectionType);
          // Check if this sectionType option should be disabled now.
          view.toggleDisableSectionOption(sectionType);
        });

      } catch(e) {
        console.log(e);
      }

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
