define(['underscore',
        'jquery',
        'backbone',
        "views/ImageUploaderView",
        "text!templates/imageEdit.html"],
function(_, $, Backbone, ImageUploaderView, Template){

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
    className: "edit-logos",

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
    * The maximum height of the image. Inputed images will be resized to this height.
    * @type {number}
    */
    imageHeight: 100,

    /**
    * The maximum display width of the image preview.
    * @type {number}
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
    */
    initialize: function(options){

      try {

        if( typeof options == "object" ){
          this.model                    = options.model;
          this.imageUploadInstructions  = options.imageUploadInstructions,
          this.imageWidth               = options.imageWidth,
          this.imageHeight              = options.imageHeight,
          this.nameLabel                = options.nameLabel,
          this.urlLabel                 = options.urlLabel
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
          urlLabel:  this.urlLabel
        }));

        // Create an ImageUploaderView and insert into this view
        var uploader = new ImageUploaderView({
          height: this.imageHeight,
          width: this.imageWidth,
          url: this.model.get("imageURL"),
          uploadInstructions: this.imageUploadInstructions
        });

        this.$(this.imageUploaderContainer).append(uploader.el);
        uploader.render();

        // Update the portal image model when the user adds a new image
        this.stopListening(uploader, "imageUploaded");
          this.listenTo(uploader, "imageUploaded", function(imageURL, newID){
          view.model.set("identifier", newID);
          view.model.set("imageURL", imageURL);
        });
      } catch (e) {
        console.log("image edit view not rendered, error message: " + e);
      }

    }

  });

  return ImageEditView;

});
