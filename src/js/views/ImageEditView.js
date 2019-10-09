define(['underscore',
        'jquery',
        'backbone',
        "models/portals/PortalImage",
        "views/ImageUploaderView",
        "text!templates/imageEdit.html"],
function(_, $, Backbone, PortalImage, ImageUploaderView, Template){

  /**
  * @class ImageEditView
  */
  var ImageEditView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ImageEdit",

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
    * The maximum display height of the image preview.
    * @type {number}
    */
    imageHeight: 100,

    /**
    * The maximum display width of the image preview. If set to false,
    * no css width property is set.
    * @type {number|boolean}
    */
    imageWidth: 100,

    /**
    * Text to instruct the user how to upload an image
    * @type {string}
    */
    imageUploadInstructions: "Drag & drop an image or click here to upload",

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
      "mouseover .remove-image-edit-view" : "previewRemoveSelf",
      "mouseout .remove-image-edit-view"  : "previewRemoveSelf",
      "click .remove-image-edit-view"     : "removeSelf"
    },

    /**
    * Creates a new ImageEditView
    * @constructs ImageEditView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {Portal}  options.parentModel - Gets set as ImageEditView.parentModel
    * @property {PortalImage}  options.model - Gets set as ImageEditView.model
    * @property {string}  options.imageUploadInstructions - Gets set as ImageUploaderView.imageUploadInstructions
    * @property {number}  options.imageWidth - Gets set as ImageUploaderView.imageWidth
    * @property {number}  options.imageHeight - Gets set as ImageUploaderView.imageHeight
    * @property {string}  options.nameLabel - Gets set as ImageEditView.nameLabel
    * @property {string}  options.urlLabel - Gets set as ImageEditView.urlLabel
    * @property {string}  options.imageTagName - Gets set as ImageUploaderView.imageTagName
    * @property {string}  options.removeButton - Gets set as ImageUploaderView.removeButton
    */
    initialize: function(options){

      try {

        if( typeof options == "object" ){
          this.parentModel              = options.parentModel;
          this.model                    = options.model;
          this.imageUploadInstructions  = options.imageUploadInstructions;
          this.imageWidth               = options.imageWidth;
          this.imageHeight              = options.imageHeight;
          this.nameLabel                = options.nameLabel;
          this.urlLabel                 = options.urlLabel;
          this.imageTagName             = options.imageTagName;
          this.removeButton             = options.removeButton;
        }

        if(!this.model){
          this.model = new PortalImage();
        }

      } catch (e) {
        console.log("ImageEditView failed to initialize. Error message: " + e);
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
          height:             this.imageHeight,
          width:              this.imageWidth,
          url:                this.model.get("imageURL"),
          uploadInstructions: this.imageUploadInstructions,
          imageTagName:       this.imageTagName
        });
        this.$(this.imageUploaderContainer).append(this.uploader.el);
        this.uploader.render();

        // Remove validation error messages, if there are any, when image added
        this.stopListening(this.uploader, "addedfile");
        this.listenTo(this.uploader, "addedfile", function(){
          view.removeValidation();
        });

        // Reset image attributes when user removes image
        this.stopListening(this.uploader, "removedfile");
        this.listenTo(this.uploader, "removedfile", function(){
          var defaults = view.model.defaults();
          view.model.set("identifier", defaults.identifier);
          view.model.set("imageURL", defaults.imageURL);
        });

        // Update the PortalImage model when the image is successfully uploaded
        this.stopListening(this.uploader.model, "successSaving");
        this.listenTo(this.uploader.model, "successSaving", function(dataONEObject){
          view.model.set("identifier", dataONEObject.get("id"));
          view.model.set("imageURL", dataONEObject.url());
        });

        // Allows model to update when user types in text field
        this.$el.find(".basic-text").data({ model: this.model });

      } catch (e) {
        console.log("ImageEdit view not rendered, error message: " + e);
      }

    },


    /**
     * previewRemoveSelf - When the user hovers over the remove button, adds a
     * class to the relevant ImageEdit view element that indicates to the user
     * that the button will remove this view.
     *
     * @param  {type} e The hover event on the remove button
     */
    previewRemoveSelf: function(e){
      try {
        $(e.target).parents(".edit-image").toggleClass("remove-preview");
      } catch (error) {
        console.log("Failed to preview the removal of an image edit view. Error message: " + error);
      }
    },


    /**
     * removeSelf - Removes this ImageEdit view and the associated PortalImage
     * model from the parent Portal model.
     */
    removeSelf: function(){

      try {

        // Remove the model
        this.parentModel.removePortalImage(this.model);
        // Remove the view
        this.$el.animate({width: "0px", overflow: "hidden"}, {
          duration: 250,
          complete: function(){
            this.remove();
          }
        });

      } catch (e) {
        console.log("Failed to remove an ImageEdit view. Errorm message: " + e);
      }

    },


    /**
     * showValidation - Show validation errors
     */
    showValidation: function(){

      // ToDo: highlight individual errors:
      // var errors = this.model.validate();

      this.$(this.imageUploaderContainer).addClass("error");

      var dropzoneMessage = this.$(this.imageUploaderContainer).first(".dz-message");
      if(dropzoneMessage.find(".error").length === 0){
        dropzoneMessage.prepend("<h5 class='error'>A logo is required</h5>");
      }

    },


    /**
     * removeValidation - Removedisplayed validation errors, if any
     */
    removeValidation: function(){
      this.$(this.imageUploaderContainer).removeClass("error");
      var dropzoneMessage = this.$(this.imageUploaderContainer).first(".dz-message");
      dropzoneMessage.find(".error").remove();
    }


  });

  return ImageEditView;

});
