define(['underscore',
        'jquery',
        'backbone',
        "models/portals/PortalSectionModel",
        "models/portals/PortalImage",
        "views/portals/editor/PortEditorSectionView",
        "views/portals/editor/PortEditorImageView",
        "views/portals/PortalSectionView",
        "text!templates/portals/editor/portEditorMdSection.html"],
function(_, $, Backbone, PortalSectionModel, PortalImage, PortEditorSectionView, ImageEdit, PortalSectionView, Template){

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
    * A jQuery selector for the element that the ImageUploader view should be inserted into
    * @type {string}
    */
    imageUploaderContainer: ".portal-display-image",

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
      // update the markdown preview each time the preview tab is clicked.
      "click #markdown-preview-link"   :     "previewMarkdown"
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

        // Attach the appropriate models to the textarea elements,
        // so that PortalEditorView.updateBasicText(e) can access them
        this.$(".markdown"    ).data({ model: this.model.get("content") });
        this.$(".title"       ).data({ model: this.model });
        this.$(".introduction").data({ model: this.model });

        // Add an ImageEdit view for the sectionImage
        // If the section has no image yet, add the default PortalImage model
        if( !this.model.get("image") ){
          this.model.set("image", new PortalImage({ nodeName: "image" }) );
        };

        // Add the edit image view (incl. uploader) for the section image
        this.sectionImageUploader = new ImageEdit({
          model: this.model.get("image"),
          editorView: this.editorView,
          imageUploadInstructions: ["Drag & drop a high quality image here or click to upload",
                                    "Suggested image size: 1200 x 1000 pixels"],
          nameLabel: false,
          urlLabel: false,
          imageTagName: "div",
          removeButton: false,
          imageWidth: false, // set to 100% in metacatui-common.css
          imageHeight: 300,
          minWidth: 800,
          minHeight: 300,
          maxHeight: 4000,
          maxWidth: 9000,
        });
        this.$(this.imageUploaderContainer).append(this.sectionImageUploader.el);
        this.sectionImageUploader.render();
        this.$(this.imageUploaderContainer).data("view", this.sectionImageUploader);

        // Set listeners to auto-resize the height of the intoduction and title
        // textareas on user-input and on window resize events. This way the
        // fields appear more closely to how they will look on the portal view.
        var view = this;
        $( window ).resize(function() {
          view.$("textarea.auto-resize").trigger("textareaResize");
        });
        this.$("textarea.auto-resize").off('input textareaResize');
        this.$("textarea.auto-resize").on('input textareaResize', function(e){
          view.resizeTextarea($(e.target));
        });
        // Make sure the textareas are the right size with their pre-filled
        // content the first time the section is viewed, because scrollHeight
        // is 0px when the element is not displayed.
        this.listenToOnce(this, "active", function(){
          view.resizeTextarea(view.$("textarea.auto-resize"));
        });

      }
      catch(e){
        console.log("The markdown view could not be rendered, error message: " + e);
      }

    },


    /**
     * resizeTextarea - Set the height of a textarea element based on its
     * scrollHeight.
     *
     * @param  {jQuery} textareas The textarea element or elements to be resized.
     */
    resizeTextarea: function(textareas){
      try {
        if(textareas){
          _.each(textareas, function(textarea){
            if(textarea.style){
              textarea.style.height = '0px'; // note: textfield MUST have a min-height set
              textarea.style.height = (textarea.scrollHeight) + 'px';
            }
          })
        }
      } catch (e) {
        console.log("failed to resize textarea element. Error message: " + r);
      }
    },

    /**
     * previewMarkdown - render the markdown preview.
     */
    previewMarkdown: function(){

      try{
        var markdownPreview = new PortalSectionView({
          model: this.model,
          template: _.template('<div class="portal-section-content"></div>')
        });
        //Render the section
        markdownPreview.render();
        //Add the section view to this portal view
        this.$("#markdown-preview-"+this.model.cid).html(markdownPreview.el);
      }
      catch(e){
        console.log("Failed to preview markdown content. Error message: " + e);
      }

    },

    /**
     * showValidation - Display validation errors if any are retuned by the PortalSection model
     */
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
