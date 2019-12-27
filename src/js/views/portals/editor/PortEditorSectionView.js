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
  * @classdesc A view of a single section of the PortalEditorView.
  * This default section view displays a choice of which PortalSection to add to the Portal.
  * @extends Backbone.View
  * @constructor
  */
  var PortEditorSectionView = Backbone.View.extend(
    /** @lends PortEditorSectionView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorSection",

    /**
    * The unique label for this Section. It most likely matches the label on the model, but
    * may include a number after if more than one section has the same name.
    * @type {string}
    */
    uniqueSectionLabel: "",

    /**
    * The HTML tag name for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "port-editor-section tab-pane",

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
     * @typedef {Object} PorttEditorSectionView#sectionOption - Information about a section type that can be added to a portal
     * @property {string} title - The name of the section type to be displayed to the user
     * @property {string} description - A brief description of the section type, to be displayed to the user
     * @property {string|number} limiter - The limiter is used to determine whether the user is allowed to add more of this section type. If limiter is a number, then it's used as the maximum number of the given sections allowed (currently this only applies to 'freeform'/markdown sections). If limiter is a string, it should be the name of the 'hide' option in the project model (e.g. hideMetrics for the metrics view). In this case, it's assumed that only one of the given page type is allowed.
     * @property {string} svg - SVG that illustrates the section type. SVG elements should use classes to define fill colors that are not greyscale, so that they may be greyed-out to indicate that a section type is unavailable. SVG elements that use theme colors should use the classes 'theme-primary-fill', 'theme-secondary-fill', and 'theme-accent-fill'.
    */

    /**
    * Information about each of the section types available to a user. Note that the key (e.g. "freeform") is used to ID the UI selection element.
    * @type {PorttEditorSectionView#sectionOption[]}
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
      "click .section-option" : "addNewSection"
    },

    /**
    * Creates a new PortEditorSectionView
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
              img: sectionData.svg,
              sectionType: sectionType
            })

          )

          // Check whether the section option is available to user
          this.toggleDisableSectionOption(sectionType);

          // For metrics, data, and members sections, add a listener to update the
          // section availability when the associated model option is changed.
          if(typeof sectionData.limiter === 'string' || sectionData.limiter instanceof String){
            this.stopListening(this.model, "change:"+sectionData.limiter);
            this.listenTo(this.model, "change:"+sectionData.limiter, function(){
              try{
                this.toggleDisableSectionOption(sectionType);
              }
              catch(e){
                console.log("Cannot toggle disabling of section types, error message: " + e);
              }
            });
          }
        }, this);

        //Save a reference to this view
        this.$el.data("view", this);
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
          console.error("Error: In disableSectionOption(sectionType), a string that indicates the sectionType is required");
          return
        }

        var sectionOption = this.$("#section-option-" + sectionType),
            description   = sectionOption.find(".description"),
            limiter       = this.sectionsOptions[sectionType].limiter,
            title         = this.sectionsOptions[sectionType].title.toLowerCase(),
            limit         = (typeof limiter === 'number' || limiter instanceof Number) ?
                              limiter : 1,
            singOrPlur    = (limit > 1) ? "s" : "",
            descriptionMsg = "You've already added " + limit + " " + title + " page" + singOrPlur;

        //Add the disabled class
        sectionOption.addClass("disabled");

        //Add the new description
        description.html(descriptionMsg);

        //Create a tooltip
        sectionOption.tooltip({
          placement: "top",
          delay: {
            show: 800,
            hide: 0
          },
          title: descriptionMsg,
          trigger: "hover",
          container: sectionOption
        });

        // Make sure disabled option isn't clickable
        sectionOption.off("click");

      } catch(e){
        console.error(e);
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

        //Remove the disabled class
        sectionOption.removeClass("disabled");

        //Update the description
        descriptionEl.html(descriptionText);

        //Remove the tooltip
        sectionOption.tooltip("destroy");

      } catch(e) {
        console.error(e);
      }

    },

    /**
    * Gets the section type to add, and triggers an event so the rest of the app will add a new section
    * @param {Event} e - The element that was clicked that represents the section option
    */
    addNewSection: function(e){

      if( !e || $(e.target).is(".disabled") || $(e.target).parents(".section-option").first().is(".disabled") ){
        return;
      }

      //Get the section type
      var sectionType = $(e.target).data("section-type");

      if( !sectionType ){
        sectionType = $(e.target).parents("[data-section-type]").first().data("section-type");
        if( !sectionType ){
          return;
        }
      }

      this.trigger("addNewSection", sectionType);

      this.toggleDisableSectionOption(sectionType);

    }

  });

  return PortEditorSectionView;

});
