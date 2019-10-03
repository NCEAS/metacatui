define(['underscore',
        'jquery',
        'backbone',
        "models/portals/PortalSectionModel",
        "views/portals/editor/PortEditorSectionView",
        "text!templates/portals/editor/portEditorMdSection.html"],
function(_, $, Backbone, PortalSectionModel, PortEditorSectionView, Template){

  /**
  * @class PortEditorMdSectionView
  */
  var PortEditorMdSectionView = PortEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorMdSection",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: PortEditorSectionView.prototype.className + " port-editor-md",

    /**
    * The HTML attributes to set on this view's element
    */
    attributes: {
      "data-category": "sections"
    },

    /**
    * The PortalSectionModel that is being edited
    * @type {PortalSection}
    */
    model: undefined,

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),

    /**
    * A reference to the PortalEditorView
    * @type {PortalEditorView}
    */
    editorView: undefined,

    /**
    * The type of section view this is
    * @type {string}
    */
    sectionType: "freeform",

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new PortEditorMdSectionView
    * @constructs PortEditorMdSectionView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      //Call the superclass initialize() function
      //Passing the parameters to the super class constructor
      PortEditorSectionView.prototype.initialize(options);

    },

    /**
    * Renders this view
    */
    render: function(){

      try{

        // Get the markdown
        var markdown;

        //Get the markdown from the SectionModel
        if( this.model.get("content") ){
          markdown = this.model.get("content").get("markdown");
          if( !markdown ){
            markdown = this.model.get("content").get("markdownExample");
          }
        }

        if( !markdown ){
          markdown = "";
        }

        // Insert the template into the view
        this.$el.html(this.template({
          title: this.model.get("title"),
          titlePlaceholder: "Add a page title",
          introduction: this.model.get("introduction"),
          introPlaceholder: "Add a sub-title or an introductory blurb about the content on this page.",
          markdown: markdown,
          markdownPlaceholder: "# Content\n\nAdd content here. Styling with markdown is supported.",
          // unique ID to use for the bootstrap accordion component, which
          // breaks when targeting two + components with the same ID
          cid: this.model.cid
        })).data("view", this);

        // Auto-resize the height of the intoduction and title fields on user-input
        // from: DreamTeK, https://stackoverflow.com/a/25621277
        $("textarea.auto-resize").each(function () {
          this.setAttribute(
            "style", "height:" + (this.scrollHeight) + "px;overflow-y:hidden;"
          );
        }).on('input', function () {
          this.style.height = '0px'; // note: textfield MUST have a min-height set
          this.style.height = (this.scrollHeight) + 'px';
        });

        // Attach the appropriate models to the textarea elements,
        // so that PortalEditorView.updateBasicText(e) can access them
        this.$(".markdown"    ).data({ model: this.model.get("content") });
        this.$(".title"       ).data({ model: this.model });
        this.$(".introduction").data({ model: this.model });

      }
      catch(e){
        console.log("The markdown view could not be rendered, error message: " + e);
      }


    },

    showValidation: function(){
      try{
        var errors = this.model.validate();

        _.each(errors, function(errorMsg, category){
          var categoryEls = this.$("[data-category='" + category + "']");

          //Use the showValidationMessage function from the parent view
          if( this.editorView && this.editorView.showValidationMessage ){
            this.editorView.showValidationMessage(categoryEls, errorMsg);
          }

        }, this);
      }
      catch(e){
        console.error(e);
      }
    }

  });

  return PortEditorMdSectionView;

});
