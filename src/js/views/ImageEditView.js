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
    * The PortalImage model that is being edited
    * @type {Image}
    */
    model: undefined,

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
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new ImageEditView
    * @constructs ImageEditView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {PortalImage}  options.model - Gets set as ImageEditView.model
    * @property {string}  options.imageUploadInstructions - Gets set as ImageUploaderView.imageUploadInstructions
    * @property {number}  options.imageWidth - Gets set as ImageUploaderView.imageWidth
    * @property {number}  options.imageHeight - Gets set as ImageUploaderView.imageHeight
    * @property {string} options.nameLabel - Gets set as ImageEditView.nameLabel
    * @property {string} options.urlLabel - Gets set as ImageEditView.urlLabel
    * @property {string}  options.imageTagName - Gets set as ImageUploaderView.imageTagName
    */
    initialize: function(options){

      try {

        if( typeof options == "object" ){
          this.model                    = options.model;
          this.imageUploadInstructions  = options.imageUploadInstructions;
          this.imageWidth               = options.imageWidth;
          this.imageHeight              = options.imageHeight;
          this.nameLabel                = options.nameLabel;
          this.urlLabel                 = options.urlLabel;
          this.imageTagName                  = options.imageTagName;
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
          nameLabel: this.nameLabel,
          urlLabel:  this.urlLabel,
          nameText: this.model.get("label"),
          urlText: this.model.get("associatedURL")
        }));

        // Create an ImageUploaderView and insert into this view
        var uploader = new ImageUploaderView({
          height: this.imageHeight,
          width: this.imageWidth,
          url: this.model.get("imageURL"),
          uploadInstructions: this.imageUploadInstructions,
          imageTagName : this.imageTagName
        });

        this.$(this.imageUploaderContainer).append(uploader.el);
        uploader.render();

        // Remove validation error messages, if there are any, when image added
        this.stopListening(uploader, "imageAdded");
        this.listenTo(uploader, "imageAdded", this.removeValidation);

        // Update the portal image model when the image is successfully uploaded
        this.stopListening(uploader, "imageUploaded");
        this.listenTo(uploader, "imageUploaded", function(imageURL, newID){
          view.model.set("identifier", newID);
          view.model.set("imageURL", imageURL);
          // Remove validation errors if there were any displayed.
          view.removeValidation();
        });

      } catch (e) {
        console.log("image edit view not rendered, error message: " + e);
      }

    },

    showValidation: function(){

      // ToDo: highlight individual errors:
      // var errors = this.model.validate();

      this.$(this.imageUploaderContainer).addClass("error");

      var dropzoneMessage = this.$(this.imageUploaderContainer).first(".dz-message");
      if(dropzoneMessage.find(".error").length === 0){
        dropzoneMessage.prepend("<h5 class='error'>A logo is required</h5>");
      }

    },

    removeValidation: function(){
      this.$(this.imageUploaderContainer).removeClass("error");
      var dropzoneMessage = this.$(this.imageUploaderContainer).first(".dz-message");
      dropzoneMessage.find(".error").remove();
    }


  });

  return ImageEditView;

});
