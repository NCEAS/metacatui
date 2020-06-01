define(['underscore',
        'jquery',
        'backbone',
        "woofmark",
        "models/portals/PortalSectionModel",
        "models/portals/PortalImage",
        "views/ImageUploaderView",
        "views/portals/editor/PortEditorSectionView",
        "views/portals/editor/PortEditorImageView",
        "views/portals/PortalSectionView",
        "text!templates/portals/editor/portEditorMdSection.html"],
function(_, $, Backbone, Woofmark, PortalSectionModel, PortalImage, ImageUploader, PortEditorSectionView, ImageEdit, PortalSectionView, Template){

  /**
  * @class PortEditorMdSectionView
  * @classdesc A section of the Portal Editor for adding/editing a Markdown page to a Portal
  * @extends PortEditorSectionView
  * @constructor
  */
  var PortEditorMdSectionView = PortEditorSectionView.extend(
    /** @lends PortEditorMdSectionView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    * @readonly
    */
    type: "PortEditorMdSection",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: PortEditorSectionView.prototype.className + " port-editor-md",

    /**
    * The HTML attributes to set on this view's element
    * @type {object}
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
    * A jQuery selector for the element into which the ImageUploader view should be inserted
    * @type {string}
    */
    imageUploaderContainer: ".portal-display-image",
    
    /**
    * A jQuery selector for the markdown textarea
    * @type {string}
    */
    markdownTextarea: ".markdown",

    /**
    * A reference to the PortalEditorView
    * @type {PortalEditorView}
    */
    editorView: undefined,

    /**
    * The type of section view this is
    * @type {string}
    * @readonly
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
    * Is executed when a new PortEditorMdSectionView is created
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
        var markdown = "";

        //Get the markdown from the SectionModel
        if( this.model.get("content") ){
          markdown = this.model.get("content").get("markdown");
          if( !markdown ){
            markdown = this.model.get("content").get("markdownExample");
          }
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
        
        var markdownTextarea = this.$(this.markdownTextarea);
        
        // Attach the appropriate models to the textarea elements,
        // so that PortalEditorView.updateBasicText(e) can access them
        markdownTextarea.data({ model: this.model.get("content") });
        this.$(".title"       ).data({ model: this.model });
        this.$(".introduction").data({ model: this.model });
        
        // Add editing UI to markdown text area.
        this.renderMarkdownEditor(markdownTextarea[0]);

        // Add an ImageEdit view for the sectionImage
        // If the section has no image yet, add the default PortalImage model
        if( !this.model.get("image") ){
          this.model.set("image", new PortalImage({ nodeName: "image" }) );
        };

        // Add the edit image view (incl. uploader) for the section image
        this.sectionImageUploader = new ImageEdit({
          
          model: this.model.get("image"),
          editorView: this.markdownEditorView,
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
          maxWidth: 9000
          
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
        console.log("The portal editor markdown section view could not be rendered, error message: " + e);
      }

    },
    
    
    /**    
     * renderMarkdownEditor - Add UI for adding and editing markdown    
     *      
     * @param  {HTMLElement} textarea The textarea element for which to add the markdown editor UI
     */     
    renderMarkdownEditor: function(textarea){
      
      try {
        if(!textarea){
          textarea = this.$(this.markdownTextarea)[0];
        }
        
        if(!textarea){
          return
        }
        
        // Save the view
        var view = this;
        
        // Set woofmark options. See https://github.com/bevacqua/woofmark
        var woofmarkOptions = {
              fencing: true,
              html: false,
              wysiwyg: false,
              defaultMode: "markdown",
              render: {
                // Hide buttons that switch between markdown, WYSIWYG, & HTML for now
                modes: function (button, id) {
                  button.style.display = "none";
                }
              }
            };
            
        // A string used to mark default woofmark buttons for removal.
        // Woofmark does not have an option to remove default commands/buttons,
        // so we will remove them after the editor is rendered.
        var removeButtons = "remove me";
            
        // Change some of the strings woofmark uses to generate elements...
        // See: https://github.com/bevacqua/woofmark/blob/master/src/strings.js
        
        // The instructions for uploading in image that displays in the prompt/dialog
        Woofmark.strings.prompts.image.description = 'Upload an image or enter an image URL';

        // Use font awesome characters for button text.
        // Add the names of font awesome icons here, and we'll replace any names
        // starting with "icon-" with the <i></i> elements after the markdown
        // editor is rendered. (Because HTML added here gets converted to text.)
        Woofmark.strings.buttons = {
          attachment: removeButtons, //"icon-paper-clip",
          bold: "icon-bold",
          code: "icon-code",
          heading: "Tt",
          hr: "↵",
          italic: "icon-italic",
          link: "icon-link",
          ol: "icon-list-ol",
          quote: "icon-quote-left",
          ul: "icon-list-ul",
          image: removeButtons, // <---- Hide the default image uploader button...
          d1Image: "icon-picture" // <--- ... and use custom image function instead
        }
        
        // Add a title for custom image uploader button
        Woofmark.strings.titles.d1Image = 'Image <img> Ctrl+G';

        // Initialize the woofmark markdown editor
        this.markdownEditor = Woofmark(textarea, woofmarkOptions);
        
        // Add the custom upload image button that uses the ImageUploader view.
        // Use cmd+G to overwrite Woofmark's built in image uploader function.
        this.markdownEditor.addCommandButton("d1Image", "cmd+g", function addImage() {
          
          // Show woofmark's default image upload dialog, inserted at the end of body
          view.markdownEditor.showImageDialog();
          
          // Select the image upload dialog elements so that we can customize it
          var imageDialog = $(".wk-prompt"),
              imageDialogInput = imageDialog.find(".wk-prompt-input"),
              imageDialogDescription = imageDialog.find(".wk-prompt-description"),
              imageDialogOkBtn = imageDialog.find(".wk-prompt-ok"),
              // Save the inner HTML of the button for when we replace it
              // temporarily during image upload
              imageDialogOkBtnTxt = imageDialogOkBtn.html();
          
          // Create an ImageUploaderView and insert into this view.
          mdImageUploader = new ImageUploader({
            uploadInstructions: "Drag & drop an image here or click to upload",
            imageTagName:       "img",
            height:             "175",
            width:              "300",
            // TODO: shrink very large images ?
            // maxHeight: 10000,
            // maxWidth: 10000;
          });
          
          // Show when image is uploading; temporarily disable the OK button
          view.stopListening(mdImageUploader, "addedfile");
          view.listenTo(mdImageUploader, "addedfile", function(){
            // Disable the button during upload;
            imageDialogOkBtn.prop('disabled', true);
            imageDialogOkBtn.css({"opacity":"0.5", "cursor":"not-allowed"});
            imageDialogOkBtn.html(
              "<i class='icon-spinner icon-spin icon-large loading icon'></i> "+
              "Uploading..."
            );
          });
          
          // Update the image input URL when the image is successfully uploaded
          view.stopListening(mdImageUploader, "successSaving");
          view.listenTo(mdImageUploader, "successSaving", function(dataONEObject){
            // Re-enable the button
            imageDialogOkBtn.prop('disabled', false);
            imageDialogOkBtn.html(imageDialogOkBtnTxt);
            imageDialogOkBtn.css({"opacity":"1", "cursor":"pointer"});
            // Get the uploaded image's url.
            var url = dataONEObject.url();
            // Create title out of file name without extension.
            var title = dataONEObject.get("fileName");
            if(title && title.lastIndexOf(".") > 0) {
              title = title.substring(0, title.lastIndexOf("."));
            }
            // Add the url + title to the input
            imageDialogInput.val(url + ' "' + title + '"' );
          });
          
          // Clear the input when the image is removed
          view.stopListening(mdImageUploader, "removedfile");
          view.listenTo(mdImageUploader, "removedfile", function(){
            imageDialogInput.val("");
          });
          
          // Render the image uploader and insert it just after the upload
          // instructions in the image upload dialog box.
          mdImageUploader.render();
          $(mdImageUploader.el).insertAfter(imageDialogDescription);
          
        });
        
        // After the markdown editor is created...

        // ...modify the default command buttons
        var buttons = $(this.markdownEditor.textarea).parent().find(".wk-command");
        
        buttons.each( function(){
          var $button = $(this),
              buttonText = $button.html();
          // Remove buttons that were marked for removal
          if(buttonText === removeButtons) {
            $button.remove();
          }
          // Replace button text with Font Awesome icons (<i class="icon-..."></i>)
          else if (buttonText && buttonText.startsWith("icon-")){
            var newButtonText = "<i class='" + buttonText + "'></i>";
            $button.html(newButtonText);
          }
          // Add a tooltip, use title which was already created by woofmark,
          // using values in Woofmark.strings
          // (see https://github.com/bevacqua/woofmark/blob/master/src/strings.js)
          $button.tooltip({
    				placement: "bottom",
    				delay: 600,
            trigger: "hover"
    			})
        });
    
      } catch (e) {
        console.log("Failed to render the markdown editor UI, error message: " + e );
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
