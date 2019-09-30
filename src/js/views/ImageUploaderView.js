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
    * Text to instruct the user how to upload an image
    * @type {string}
    */
    uploadInstructions: "Drag & drop an image or click here to upload",

    /**
    * The maximum height of the image. Inputed images will be resized.
    * @type {number}
    */
    height: 100,

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
    */
    initialize: function(options){

      if( typeof options == "object" ){
        this.model = options.model || undefined;
        this.id = options.id || null;
        this.height = options.height || 200;
        this.width = options.width || 200;
        this.uploadInstructions = options.uploadInstructions || "Drag & drop an image or click here to upload"
      }

      // Ensure the object formats are cached for uploader's use
      if ( typeof MetacatUI.objectFormats === "undefined" ) {
          MetacatUI.objectFormats = new ObjectFormats();
          MetacatUI.objectFormats.fetch();
      }

      Dropzone.autoDiscover = false;

    },

    /**
    * Renders this view
    */
    render: function(){

      try{

        // Reference to the view
        var view = this,
            fullTemplate = view.template({
              height: this.height,
              width: this.width,
              uploadInstructions: this.uploadInstructions
            }),
            // The outer template
            dropzoneTemplate = $(fullTemplate).find(".dropzone")[0].outerHTML,
            // The inner template inserted when an image is added
            previewTemplate = $(fullTemplate).find(".dz-preview")[0].outerHTML;

        // Insert the template for this view
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
          previewTemplate: previewTemplate,//view.template({height:view.height}),
          init: function() {
            // Use our own functionality for uploading
            this.on("addedfile", function(file){
              view.uploadFile(file);
            });
          }
        });

        // Save the dropzone element for other functions to access later
        this.imageDropzone = $dropZone[0].dropzone;

        // Fetch the image if an ID was provided and show thumbnail
        if(this.id){
          // TODO: hide dropzone element until model syncs
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
        if(!this.id){
          return
        }

        this.model = new DataONEObject({
          id: this.id
        });

        //Get information about this object
        this.listenToOnce(this.model, "sync", function(model){

          // If ID isn't an image file, return
          if(!model.get("formatId").indexOf("image") == 0){
            return
          }

          var imageFile = {
            id: this.model.id,
            name: model.get("fileName"),
            size: model.get("size"),
            url: MetacatUI.appModel.get("objectServiceUrl") + this.id
          };

          // Add it to filelist so uploadFile() can remove excess images if needed
          this.imageDropzone.files[0] = imageFile;
          // Call the default addedfile event handler
          this.imageDropzone.emit("addedfile", imageFile);
          // Show the thumbnail of the file
          this.imageDropzone.emit("thumbnail", imageFile, imageFile.url);
          // Make sure that there is no progress bar, etc...
          this.imageDropzone.emit("complete", imageFile);

        });
        this.model.fetch();
      }
      catch(error){
        console.log("image could not be displayed, error message: " + error);
      }

    },

    /**
    * Uploads an image if the file doesn't already have an id attribute
    * @param {object} file - The image information provided by dropzone
    * @param {string} file.id - An id for an image (e.g. a uuid)
    * @param {string} file.name - The image name
    * @param {number} file.size - The size of the image
    * @param {string} file.type - The file type
    */
    uploadFile: function(file){

      try{

        // Make sure only one image (the most recently added) is shown in the upload zone
        if (this.imageDropzone.files[1]!=null){
          this.imageDropzone.removeFile(this.imageDropzone.files[0]);
        }

        // If the file already has an ID, then it was just downloaded from the server.
        if(file.id){
          return
        }

        this.model = dataONEObject = new DataONEObject({
            synced: true,
            type: "image",
            fileName: file.name,
            size: file.size,
            mediaType: file.type,
            uploadFile: file
        });

        // Asychronously calculate the checksum
        if ( dataONEObject.get("uploadFile") && ! dataONEObject.get("checksum") ) {
            dataONEObject.stopListening(dataONEObject, "checksumCalculated");
            dataONEObject.listenToOnce(dataONEObject, "checksumCalculated", dataONEObject.save);
            try {
                dataONEObject.calculateChecksum();
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
