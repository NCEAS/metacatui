define(["underscore",
        "jquery",
        "backbone",
        "woofmark",
        "views/ImageUploaderView",
        "views/MarkdownView",
        "text!templates/markdownEditor.html"],
function(_, $, Backbone, Woofmark, ImageUploader, MarkdownView, Template){

  /**
  * @class MarkdownEditorView
  * @classdesc A view of an HTML textarea with markdown editor UI and preview tab
  * @extends Backbone.View
  * @constructor
  */
  var MarkdownEditorView = Backbone.View.extend(
    /** @lends MarkdownEditorView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    * @readonly
    */
    type: "MarkdownEditor",
    
    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "markdown-editor",
    
    /**
    * References to templates for this view. HTML files are converted to
    * Underscore.js templates
    * @type {Underscore.Template}
    */
    template: _.template(Template),
    
    /**
    * Markdown to insert into the textarea when the view is first rendered
    * @type {string}
    */
    markdown: "",
    
    /**
    * The placeholder text to display in the textarea when it's empty
    * @type {string}
    */
    markdownPlaceholder: "",
    
    /**
    * The placeholder text to display in the preview area when there's no
    * markdown
    * @type {string}
    */
    previewPlaceholder: "",
    
    /**
    * Indicates whether or not to render a table of contents for the markdown
    * preview. If set to true, a table of contents will be shown in the preview
    * if there two or more top-level headers are rendered from the markdown.
    * @type {boolean}
    */
    showTOC: false,
    
    /**
    * A jQuery selector for the HTML textarea element that will contain the
    * markdown text.
    * @type {string}
    */
    textarea: ".markdown-textarea",
    
    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      // update the markdown preview each time the preview tab is clicked.
      "click #markdown-preview-link"   :    "previewMarkdown",
      "focusout .markdown-textarea"    :    "updateMarkdown"
    },
    
    /**
    * Initialize is executed when a new markdownEditor is created.
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){
      
      if(typeof options !== "undefined"){
          this.markdown            =  options.markdown            || "";
          this.markdownPlaceholder =  options.markdownPlaceholder || "";
          this.previewPlaceholder  =  options.previewPlaceholder  || "";
          this.showTOC             =  options.showTOC             || false;
      }
      
    },
    
    /**    
     * render - Renders the markdownEditor - add UI for adding and editing
     * markdown to a textarea
     */     
    render: function(){
      
      try {
        
        // Insert the template into the view
        this.$el.html(this.template({
          markdown: this.markdown || "",
          markdownPlaceholder: this.markdownPlaceholder || "",
          previewPlaceholder: this.previewPlaceholder || "",
          cid: this.cid
        })).data("view", this);
        
        // The textarea element that the markdown editor buttons & functions will edit
        var textarea = this.$(this.textarea)[0];
        
        if(!textarea){
          console.log("error: the markdown editor view was not rendered because no textarea element was found.");
          return
        }
        
        // Save the view
        var view = this;
        
        // A string used to mark default woofmark buttons for removal.
        // Woofmark does not have an option to remove default commands/buttons,
        // so we will remove them after the woofmark editor is rendered.
        var removeButtons = "remove me";
        
        // Set woofmark options. See https://github.com/bevacqua/woofmark
        var woofmarkOptions =
          {
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
          image: removeButtons, // <---- Remove the default image uploader button...
          d1Image: "icon-picture" // <--- ... and use custom image function instead
        }
        
        // Add a title for custom image uploader button
        Woofmark.strings.titles.d1Image = 'Image <img> Ctrl+G';

        // Initialize the woofmark markdown editor
        this.markdownEditor = Woofmark(textarea, woofmarkOptions);
        
        // After the markdown editor is initialized...
        
        // ...Add the custom upload image button that uses the ImageUploader view.
        // Use cmd+G to overwrite Woofmark's built in image uploader function.
        this.markdownEditor.addCommandButton("d1Image", "cmd+g", function(){
          view.addMdImage.call(view)
        });

        // ... Modify the default command buttons
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
    				placement: "top",
    				delay: 600,
            trigger: "hover"
    			})
        });
    
      } catch (e) {
        console.log("Failed to render the markdown editor UI, error message: " + e );
      }
      
    },


    /**
     * addMdImage - The function that gets called when a user clicks the custom
     * add image button added to the markdown editor. It uses the UI created by
     * the ImageUploaderView to allow a user to select & upload an image to the
     * repository, and uses Woofmark's built-in add image functionality to
     * insert the correct markdown into the textarea. This function must be
     * called such that "this" is the markdownEditor view.
     */
    addMdImage: function() {
      
      var view = this;
      
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
      
    },
    
    /**    
     * updateMarkdown - Update the markdown attribute in this view using the
     * value of the markdown textarea
     */     
    updateMarkdown: function(){
      this.markdown = this.$(this.textarea).val();
    },
    
    /**
     * previewMarkdown - render the markdown preview.
     */
    previewMarkdown: function(){
  
      try{
        
        var markdownPreview = new MarkdownView({
            markdown: this.markdown || this.previewPlaceholder,
            showTOC: this.showTOC || false
        });
        
        // Render the preview
        markdownPreview.render();
        // Add the rendered markdown to the preview tab
        this.$("#markdown-preview-"+this.cid).html(markdownPreview.el);
      }
      
      catch(e){
        console.log("Failed to preview markdown content. Error message: " + e);
      }

    },


  });

  return MarkdownEditorView;
  
});
