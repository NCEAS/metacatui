define(['underscore',
        'jquery',
        'backbone',
        "models/portals/PortalImage",
        "views/ImageUploaderView",
        "text!templates/imageEdit.html"],
function(_, $, Backbone, PortalImage, ImageUploaderView, Template){

  /**
  * @class PortEditorImageView
  */
  var PortEditorImageView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorImage",

    /**
    * The HTML tag name to use for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "edit-image",

    /**
    * A jQuery selector for the element that the ImageUploaderView should be
    * inserted into.
    * @type {string}
    */
    imageUploaderContainer: ".image-uploader-container",

    /**
     * The ImageUploaderView created and used by this ImageEdit view.
     * @type {ImageUploader}
     */
    uploader: undefined,

    /**
    * The PortalImage model that is being edited
    * @type {Image}
    */
    model: undefined,

    /**
    * The Portal model that contains the PortalImage
    * @type {Portal}
    */
    parentModel: undefined,

    /**
    * A reference to the PortalEditorView
    * @type {PortalEditorView}
    */
    editorView: undefined,

    /**
    * The maximum height of the image preview. If set to false,
    * no css width property is set.
    * @type {number}
    */
    imageHeight: 150,

    /**
    * The display width of the image preview. If set to false,
    * no css width property is set.
    * @type {number|boolean}
    */
    imageWidth: 150,

    /**
     * The minimum required height of the image file. If set, the uploader will
     * reject images that are shorter than this. If null, any image height is
     * accepted.
     * @type {number}
     */
    minHeight: null,

    /**
     * The minimum required height of the image file. If set, the uploader will
     * reject images that are shorter than this. If null, any image height is
     * accepted.
     * @type {number}
     */
    minWidth: null,

    /**
     * The maximum height for uploaded files. If a file is taller than this, it
     * will be resized without warning before being uploaded. If set to null,
     * the image won't be resized based on height (but might be depending on
     * maxWidth).
     * @type {number}
     */
    maxHeight: null,

    /**
     * The maximum width for uploaded files. If a file is wider than this, it
     * will be resized without warning before being uploaded. If set to null,
     * the image won't be resized based on width (but might be depending on
     * maxHeight).
     * @type {number}
     */
    maxWidth: null,


    /**
    * Text to instruct the user how to upload an image
    * @type {string[]}
    */
    imageUploadInstructions: ["Drag & drop an image or click here to upload"],

    /**
     * Label for the first text input where the user enters the ImageModel label.
     * If this is set to false, the label input will not be shown.
     * @type {string|boolean}
     */
    nameLabel: "Name",

    /**
     * Label for the second text input where the user enters the ImageModel
     * associated URL. If this is set to false, the URL input will not be shown.
     * @type {string|boolean}
     */
    urlLabel: "URL",

    /**
     * The HTML tag name to insert the uploaded image into. Options are "img",
     * in which case the image is inserted as an HTML <img>, or "div", in which
     * case the image is inserted as the background of a "div".
     * @type {string}
     */
    imageTagName: "div",

    /**
     * Whether or not a remove button should be shown.
     * @type {boolean}
     */
    removeButton: false,

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "mouseover .toggle-remove-preview"    : "showRemovePreview",
      "mouseout  .toggle-remove-preview"    : "hideRemovePreview",
      "click .remove-image-edit-view"       : "removeSelf",
      "focusout .basic-text"                : "redoValidation"
    },

    /**
    * Creates a new PortEditorImageView
    * @constructs PortEditorImageView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {Portal}  options.parentModel - Gets set as PortEditorImageView.parentModel
    * @property {PortalEditorView}  options.editorView - Gets set as PortEditorImageView.editorView
    * @property {PortalImage}  options.model - Gets set as PortEditorImageView.model
    * @property {string[]}  options.imageUploadInstructions - Gets set as ImageUploaderView.imageUploadInstructions
    * @property {string}  options.nameLabel - Gets set as PortEditorImageView.nameLabel
    * @property {string}  options.urlLabel - Gets set as PortEditorImageView.urlLabel
    * @property {string}  options.imageTagName - Gets set as ImageUploaderView.imageTagName
    * @property {string}  options.removeButton - Gets set as ImageUploaderView.removeButton
    * @property {number}  options.imageWidth - Gets set as ImageUploaderView.width
    * @property {number}  options.imageHeight - Gets set as ImageUploaderView.height
    * @property {number}  options.minWidth - Gets set as ImageUploaderView.minWidth
    * @property {number}  options.minHeight - Gets set as ImageUploaderView.minHeight
    * @property {number}  options.maxWidth - Gets set as ImageUploaderView.maxWidth
    * @property {number}  options.maxHeight - Gets set as ImageUploaderView.maxHeight
    */
    initialize: function(options){

      try {

        if( typeof options == "object" ){
          this.parentModel              = options.parentModel;
          this.editorView               = options.editorView;
          this.model                    = options.model;
          this.imageUploadInstructions  = options.imageUploadInstructions;
          this.imageWidth               = options.imageWidth;
          this.imageHeight              = options.imageHeight;
          this.nameLabel                = options.nameLabel;
          this.urlLabel                 = options.urlLabel;
          this.imageTagName             = options.imageTagName;
          this.removeButton             = options.removeButton;
          this.minHeight                = options.minHeight;
          this.minWidth                 = options.minWidth;
          this.maxHeight                = options.maxHeight;
          this.maxWidth                 = options.maxWidth;
        }

        if(!this.model){
          this.model = new PortalImage();
        }

      } catch (e) {
        console.log("PortEditorImageView failed to initialize. Error message: " + e);
      }

    },

    /**
    * Renders this view
    */
    render: function(){

      try {
        // Reference to this view
        var view = this;

        //Insert the template for this view
        this.$el.html(this.template({
          nameLabel:    this.nameLabel,
          urlLabel:     this.urlLabel,
          nameText:     this.model.get("label"),
          urlText:      this.model.get("associatedURL"),
          removeButton: this.removeButton
        }));

        // Create an ImageUploaderView and insert into this view. Allow it to be
        // accessed from parent views.
        this.uploader = new ImageUploaderView({
          url:                this.model.get("imageURL"),
          uploadInstructions: this.imageUploadInstructions,
          imageTagName:       this.imageTagName,
          height:             this.imageHeight,
          width:              this.imageWidth,
          minHeight:          this.minHeight,
          minWidth:           this.minWidth,
          maxHeight:          this.maxHeight,
          maxWidth:           this.maxWidth
        });
        this.$(this.imageUploaderContainer).append(this.uploader.el);
        this.uploader.render();

        // Reset image attributes when user removes image
        this.stopListening(this.uploader, "removedfile");
        this.listenTo(this.uploader, "removedfile", function(){
          var defaults = view.model.defaults();
          view.model.set("identifier", defaults.identifier);
          view.model.set("imageURL", defaults.imageURL);
          view.redoValidation();
        });

        // Try to validate again when image is added but not yet uploaded
        this.stopListening(this.uploader, "addedfile");
        this.listenTo(this.uploader, "addedfile", function(){
          view.redoValidation();
        });

        // Update the PortalImage model when the image is successfully uploaded
        this.stopListening(this.uploader, "successSaving");
        this.listenTo(this.uploader, "successSaving", function(dataONEObject){
          view.model.set("identifier", dataONEObject.get("id"));
          view.model.set("imageURL", dataONEObject.url());
          view.redoValidation();
        });

        this.listenTo(this.model, "change:associatedURL", this.showValidation);

        // Allows model to update when user types in text field
        this.$el.find(".basic-text").data({ model: this.model, view: this });

        //Initialize any tooltips
        this.$(".tooltip-this").tooltip();

        //Save a reference to this view
        this.$el.data("view", this);

      } catch (e) {
        console.log("ImageEdit view not rendered, error message: " + e);
      }

    },

    /**
     * removeSelf - Removes this ImageEdit view and the associated PortalImage
     * model from the parent Portal model.
     */
    removeSelf: function(){

      try {

        var view = this;

        // Remove the model
        this.parentModel.removePortalImage(this.model);
        // Remove the view
        this.$el.animate({width: "0px", overflow: "hidden"}, {
          duration: 250,
          complete: function(){
            view.onClose();
            view.remove();
          }
        });

      } catch (e) {
        console.log("Failed to remove an ImageEdit view. Error message: " + e);
      }

    },

    /**
     * redoValidation - Called when a user focuses out of input fields
     * with the .basic-text class (organization name and associated URL), or
     * when an image is successfully uploaded or removed. This function
     * validates the PortalImage model again and shows errors if there are any.
     */
    redoValidation: function(){
      try {
        view = this;
        // Add a small pause so that the model is updated first.
        setTimeout(function () {
          view.removeValidation();
          view.showValidation();
        }, 1);
      } catch (e) {
        console.log(e);
      }
    },

    /**
     * showValidation - show validation errors for this ImageEdit view
     */
    showValidation: function(){

      try {

        var errors = this.model.validate();

        if(errors){

          _.each(errors, function(errorMsg, category){
            var categoryEls = this.$("[data-category='" + category + "']");
            //Use the showValidationMessage function from the parent view
            if( this.editorView && this.editorView.showValidationMessage ){
              this.editorView.showValidationMessage(categoryEls, errorMsg);
            }

          }, this);

          // add class to dropzone element if error has to do with image
          if(errors.identifier){
            this.$el.find(".dropzone").addClass("error");
          }

        }

      } catch (e) {
        console.log("Failed to validate portalImage, error: " + e);
      }

    },

    /**
     * removeValidation - Remove displayed validation errors, if any
     */
    removeValidation: function(){
      this.$(".notification.error").removeClass("error").empty();
      this.$(".section-link-container.error, input.error, textarea.error").removeClass("error");
      this.$(".validation-error-icon").hide();
      this.$el.find(".dropzone").removeClass("error");
    },

    /**
    * Add the "remove-preview" class which will show a preview for removing this image, via CSS
    */
    showRemovePreview: function(){
      try{
        this.$el.addClass("remove-preview");
      }
      catch (error) {
        console.error("Failed to preview the removal of an image edit view. Error message: " + error);
      }
    },

    /**
    * Removes the "remove-preview" class which will hide the preview for removing this image, via CSS
    */
    hideRemovePreview: function(e){
      try{
        this.$el.removeClass("remove-preview");
      }
      catch (error) {
        console.error("Failed to preview the removal of an image edit view. Error message: " + error);
      }
   },

   /**
   * This function is called whenever this view is about to be removed from the page.
   */
   onClose: function(){
     //Destroy any tooltips in this view that are still open
     this.$(".tooltip-this").tooltip("destroy");
   }


  });

  return PortEditorImageView;

});
