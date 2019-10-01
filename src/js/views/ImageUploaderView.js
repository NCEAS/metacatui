define(['underscore',
        'jquery',
        'backbone',
        "models/DataONEObject",
        'collections/ObjectFormats',
        "Dropzone",
        "text!templates/imageUploader.html"],
function(_, $, Backbone, DataONEObject, ObjectFormats, Dropzone, Template){

  /**
  * @class ImageUploaderView
  */
  var ImageUploaderView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ImageUploader",

    /**
    * The HTML tag name to use for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "image-uploader",

    /**
    * The DataONEObject that is being edited
    * @type {DataONEObject}
    */
    model: undefined,

    /**
    * The URL for the image. If a DataONEObject model is provided to the view
    * instead, the url is automatically set to the output of DataONEObject.url()
    * @type {string}
    */
    url: undefined,

    /**
    * Text to instruct the user how to upload an image
    * @type {string}
    */
    uploadInstructions: "Drag & drop an image or click here to upload",

    /**
    * The maximum height of the image. Inputed images will be resized to fit.
    * @type {number}
    */
    height: 100,

    /**
    * The maximum display width of the image preview.
    * @type {number}
    */
    width: 100,

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
    * Creates a new ImageUploaderView
    * @constructs ImageUploaderView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {DataONEObject}  options.model - Gets set as ImageUploaderView.model
    * @property {number}  options.height - Gets set as ImageUploaderView.height
    * @property {number}  options.width - Gets set as ImageUploaderView.width
    * @property {string}  options.uploadInstructions - Gets set as ImageUploaderView.uploadInstructions
    * @property {string}  options.url - Gets set as ImageUploaderView.url
    */
    initialize: function(options){

      try {
        if( typeof options == "object" ){

          this.model              = options.model;
          this.height             = options.height;
          this.width              = options.width;
          this.uploadInstructions = options.uploadInstructions;
          this.url                = options.url;

          if (!this.url && this.model) {
            this.url = this.model.url();
          }

        }

        // Ensure the object formats are cached for uploader's use
        if ( typeof MetacatUI.objectFormats === "undefined" ) {
            MetacatUI.objectFormats = new ObjectFormats();
            MetacatUI.objectFormats.fetch();
        }

        // Identify which zones should be drag & drop manually
        Dropzone.autoDiscover = false;
      } catch (e) {
        console.log("ImageUploaderView failed to initialize. Error message: " + e);
      }


    },

    /**
    * Renders this view
    */
    render: function(){

      try{

        // Reference to the view
        var view = this,
        // The overall template which holds two sub-templates
        fullTemplate = view.template({
          height: this.height,
          width: this.width,
          uploadInstructions: this.uploadInstructions
        }),
        // The outer template
        dropzoneTemplate = $(fullTemplate).find(".dropzone")[0].outerHTML,
        // The inner template inserted when an image is added
        previewTemplate = $(fullTemplate).find(".dz-preview")[0].outerHTML;

        // Insert the main template for this view
        this.$el.html(dropzoneTemplate);

        // Add upload & drag and drop functionality to the dropzone div.
        // For config details, see: https://www.dropzonejs.com/#configuration
        var $dropZone = this.$(".dropzone").dropzone({
          url: "-", // a fake URL to allow dropzone to initialize properly
          acceptedFiles: "image/*",
          addRemoveLinks: false,
          maxFiles: 1,
          parallelUploads: 1,
          uploadMultiple: false,
          resizeHeight: this.height, // resize images before upload
          thumbnailHeight: this.height,
          autoProcessQueue: false, // Don't use dropzone's functionality to upload
          previewTemplate: previewTemplate,
          init: function() {
            // Use our own functionality for uploading
            this.on("addedfile", function(file){
              view.uploadFile(file);
            });
          }
        });

        // Save the dropzone element for other functions to access later
        this.imageDropzone = $dropZone[0].dropzone;

        // Fetch the image if a URL was provided and show thumbnail
        if(this.url){
          this.showThumbnail();
        }
      }
      catch(error){
        console.log("image uploader could not be rendered, error message: " + error);
      }

    },

    /**
    * Display a thumbnail from the server when an image ID is provided to this view
    */
    showThumbnail: function(){

      try{

        if(!this.url){
          return
        }

        // A mock image file to identify the image provided to this view
        var imageFile = {
          url: this.url
        };

        // Add it to filelist so uploadFile() can remove excess images if needed
        this.imageDropzone.files[0] = imageFile;
        // Call the default addedfile event handler
        this.imageDropzone.emit("addedfile", imageFile);
        // Show the thumbnail of the file
        this.imageDropzone.emit("thumbnail", imageFile, imageFile.url);
        // Make sure that there is no progress bar, etc...
        this.imageDropzone.emit("complete", imageFile);

      }
      catch(error){
        console.log("image could not be displayed, error message: " + error);
      }

    },

    /**
    * Uploads an image if the file doesn't already have an id attribute
    * @param {object} file - The image information provided by dropzone
    * @property {string} file.url - A url for an image. Nothing will be uploaded if this property is set.
    * @property {string} file.name - The image name
    * @property {number} file.size - The size of the image
    * @property {string} file.type - The file type
    */
    uploadFile: function(file){

      try{

        // Reference to this view
        var view = this;

        // Make sure only the most recently added image is shown in the upload zone
        if (this.imageDropzone.files[1]!=null){
          this.imageDropzone.removeFile(this.imageDropzone.files[0]);
        }

        // If the file already has a URL, then it doesn't need to be uploaded
        if(file.url){
          return
        }

        // Event for parent view
        this.trigger("imageAdded");

        if(!this.model){
          this.model = new DataONEObject();
        }

        // Pass the new image URL and ID to the parent view
        this.stopListening(this.model, "successSaving");
        this.listenTo(this.model, "successSaving", function(){
          view.trigger("imageUploaded", view.model.url(), view.model.get("id"));
        });

        this.model.set({
          synced: true,
          type: "image",
          fileName: file.name,
          size: file.size,
          mediaType: file.type,
          uploadFile: file
        });

        // Asychronously calculate the checksum
        if ( this.model.get("uploadFile") && ! this.model.get("checksum") ) {
            this.model.stopListening(this.model, "checksumCalculated");
            this.model.listenToOnce(this.model, "checksumCalculated", this.model.save);
            try {
                this.model.calculateChecksum();
            } catch (exception) {
                // TODO: Fail gracefully here for the user
            }
        }

      } catch (error){
        console.log("image file not saved! error message: " + error);
      }

    }

  });

  return ImageUploaderView;

});
