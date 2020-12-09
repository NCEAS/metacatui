define(['underscore',
        'jquery',
        'backbone',
        "models/DataONEObject",
        'collections/ObjectFormats',
        "Dropzone",
        "text!templates/imageUploader.html",
        "corejs"],
function(_, $, Backbone, DataONEObject, ObjectFormats, Dropzone, Template, corejs){

  /**
  * @class ImageUploaderView
  * @classdesc A view that allows a person to upload an image to the repository
  * @classcategory Views
  */
  var ImageUploaderView = Backbone.View.extend(
    /** @lends ImageUploaderView.prototype */{

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
    * The DataONEObject or PortalImage that is being edited
    * @type {DataONEObject|PortalImage}
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
    * @type {string[]}
    */
    uploadInstructions: ["Drag & drop an image or click here to upload"],

    /**
    * The maximum display height of the image preview. This is only used for the
    * css height propery, and doesn't influence the size of the saved image. If
    * set to false, no css height property is set.
    * @type {number}
    */
    height: false,

    /**
    * The display width of the image preview. This is only used for the
    * css width propery, and doesn't influence the size of the saved image. If
    * set to false, no css width property is set.
    * @type {number}
    */
    width: false,

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
     * The HTML tag name to insert the uploaded image into. Options are "img",
     * in which case the image is inserted as an HTML <img>, or "div", in which
     * case the image is inserted as the background of a div.
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
      "mouseover .icon-remove.remove"  : "previewImageRemove",
      "mouseout  .icon-remove.remove"  : "previewImageRemove"
    },

    /**
    * Creates a new ImageUploaderView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {DataONEObject}  options.model - Gets set as ImageUploaderView.model
    * @property {string[]}  options.uploadInstructions - Gets set as ImageUploaderView.uploadInstructions
    * @property {string}  options.url - Gets set as ImageUploaderView.url
    * @property {string}  options.imageTagName - Gets set as ImageUploaderView.imageTagName
    * @property {number}  options.height - Gets set as ImageUploaderView.height
    * @property {number}  options.width - Gets set as ImageUploaderView.width
    * @property {number}  options.minWidth - Gets set as ImageUploaderView.minWidth
    * @property {number}  options.minHeight - Gets set as ImageUploaderView.minHeight
    * @property {number}  options.maxWidth - Gets set as ImageUploaderView.maxWidth
    * @property {number}  options.maxHeight - Gets set as ImageUploaderView.maxHeight
    */
    initialize: function(options){

      try {
        if( typeof options == "object" ){

          this.model              = options.model;
          this.uploadInstructions = options.uploadInstructions;
          this.url                = options.url;
          this.imageTagName       = options.imageTagName;
          this.height             = options.height;
          this.width              = options.width;
          this.minHeight          = options.minHeight;
          this.minWidth           = options.minWidth;
          this.maxHeight          = options.maxHeight;
          this.maxWidth           = options.maxWidth;

          if( !this.model ){
            this.model = new DataONEObject({ synced: true });
          }

          if (!this.url && this.model) {
            this.url = this.model.url();
          }

        }

        // Ensure the object formats are cached for uploader's use
        if ( typeof MetacatUI.objectFormats === "undefined" ) {
            MetacatUI.objectFormats = new ObjectFormats();
            MetacatUI.objectFormats.fetch();
        }

        // Bug fix: Overwrite a dropzone function that causes a bug in Edge 16 &
        // 17 browser. If we update our dropzone with a fallback, this function
        // should return the fallback element.
        Dropzone.prototype.getExistingFallback = function(){
          return false
        };

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
          uploadInstructions: this.uploadInstructions,
          imageTagName: this.imageTagName
        }),
        // The outer template
        dropzoneTemplate = $(fullTemplate).find(".dropzone")[0].outerHTML,
        // The inner template inserted when an image is added
        previewTemplate = $(fullTemplate)
                              .find(".dz-preview")[0]
                              .outerHTML;

        // Insert the main template for this view
        view.$el.html(dropzoneTemplate);

        // Add upload & drag and drop functionality to the dropzone div.
        // For config details, see: https://www.dropzonejs.com/#configuration
        var $dropZone = view.$(".dropzone").dropzone({

          url: view.model.get("imageURL") || view.model.url(),
          acceptedFiles: "image/*",
          addRemoveLinks: false,
          maxFiles: 1,
          parallelUploads: 1,
          uploadMultiple: false,
          resizeHeight: view.maxHeight,
          resizeWidth: view.maxWidth,
          thumbnailHeight: view.maxHeight < view.height ? view.maxHeight : null,
          thumbnailWidth: view.maxWidth < view.width ? view.maxWidth : null,
          dictInvalidFileType: "This file type is not allowed. Please select an image file",
          autoProcessQueue: true,
          previewTemplate: previewTemplate,
          withCredentials: true,
          paramName: "object",
          hiddenInputContainer: this.el,

          headers: {
              "Cache-Control": null,
              "X-Requested-With": null,
              "Authorization": MetacatUI.appUserModel.createAjaxSettings().headers.Authorization
          },

          // Override dropzone's function for showing images in the upload zone
          // so that we have the option to display them as a background images.
          // Check for minimum dimensions at this stage because dropzone has
          // calculated the file's height here.
          thumbnail: function(file, dataURL){
            try {
              // Don't bother size check for SVG images since they're vector
              var dimCheck = file.type === "image/svg+xml" ? true : view.checkMinDimensions(file.width, file.height);
              if(dimCheck != true){
                if(file.rejectDimensions){
                  // Send reason for rejection rejectDimensions function
                  file.rejectDimensions(dimCheck);
                }
              } else {
                if(file.acceptDimensions){
                  file.acceptDimensions();
                };
                view.showImage(file, dataURL);
              };
            } catch (e) {
              console.log("Error generating thumbnail image, error message: " + e);
            }

          },

          // Dropzone will check filetype = options.acceptedFiles. Add functions
          // for when the image is too small.
          accept: function accept(file, done) {
            try {
              file.rejectDimensions = function(message) {  done(message)  };
              file.acceptDimensions = function(){  done()  };
            } catch (e) {
              console.log("Error during dropzone's accept function. Error code: " + e);
            }
          },


          // After the file is accepted (correct filetype and min size requirements),
          // resize the image if it's too large in height or width, then
          // provide image data to a dataOne object model and calulate checksum.
          transformFile: function(file, done){
            try {
              // Only resize images if dimensions are too large.
              // Once the image is resized (or not), save the data to the model and get a checksum.
              var resizeWidth = (file.width > this.options.resizeWidth) ? this.options.resizeWidth : null;
              var resizeHeight = (file.height > this.options.resizeHeight) ? this.options.resizeHeight : null;
              if (resizeHeight || resizeWidth) {
                return this.resizeImage(file, resizeWidth, resizeHeight, this.options.resizeMethod, function(blob){
                  view.prepareD1Model(blob, file.name, file.type, done);
                });
              } else {
                return view.prepareD1Model(file, file.name, file.type, done);
              }
            } catch (e) {
              console.log("Error during dropzone's transformFile function. Error code: " + e);
            }
          },

          // Add some required formData right before the image is uploaded
          sending: function(file, xhr, formData) {
            try {
              //Create the system metadata XML & send as blob
              var sysMetaXML = view.model.serializeSysMeta();
              var xmlBlob = new Blob([sysMetaXML], {type : 'application/xml'});
              formData.append("sysmeta", xmlBlob, "sysmeta.xml");
              formData.append("pid", view.model.get("id"));
            } catch (e) {
              console.log("Error during dropzone's sending function. Error code: " + e);
            }
          },

          // If there are any errors during the entire process...
          error: function error(file, message, xhr) {
            try {
              view.trigger("error");
              // Give a readable error if it's a server error
              if(xhr){
                console.log(message);
                message = "There was an error uploading your file. Please try again later."
              }
              // Make sure image isn't showing (src for <img> and style for background images)
              $(file.previewElement).find(".image-container").attr({
                src: "",
                style: ""
              });
              // Show error using dropzone's default behaviour
              this.defaultOptions.error(file, message);
            } catch (e) {
              console.log("Problem handling error, message: " + e);
            }
          },

          init: function() {
            try {
              this.on("addedfile", function(file){
                // Make sure only the most recently added image is shown in the upload zone
                view.limitFileInput();
                // Required for parent views to use listenTo() on dropzone events
                view.trigger("addedfile");
              });
              // Hide the remove buttons and text when an image is removed
              this.on("removedfile", function(file){
                view.previewImageRemove();
                // Required for parent views to use listenTo() on dropzone events
                view.trigger("removedfile");
              });
              this.on("success", function(){
                view.trigger("successSaving", view.model);
              });
            } catch (e) {
              console.log("Issue initializing dropzone, error message: " + e);
            }
          }

        });

        // Save the dropzone element for other functions to access later
        view.imageDropzone = $dropZone[0].dropzone;

        // Fetch the image if a URL was provided and show thumbnail
        if(view.url){
          view.showSavedImage();
        }
      }
      catch(error){
        console.log("ImageUploaderView could not be rendered, error message: ", error);
      }
    },

    /**
     * prepareD1Model - Called once an image file is resized or once it's
     * determined the the image does not need to be resized. This function adds
     * data about the image added by the user to a new DataOne model, then
     * calculates the checksum. When the checksum is finished being calculated,
     * calls the callback function (i.e. dropzone's done()).
     *
     * @param  {Blob|File} object Either the Blob or File to be saved to the server
     * @param  {string} filename the name of the file
     * @param  {string} filetype the filetype
     * @param  {function} callback a function to call once the checksum is calculated.
     */
    prepareD1Model: function(object, filename, filetype, callback){

      try{

        var modelAttributes = {
          synced: true,
          type: "image",
          fileName: filename,
          mediaType: filetype,
          size: object.size,
          uploadFile: object
        }

        // Each file upload must be a new DataONE object
        this.model = new DataONEObject(modelAttributes);
        this.model.updateID();
        this.model.set("obsoletes", null);
        this.model.get("accessPolicy").makePublic();

        // Start checksum, and call the callback function when it's complete
        this.model.stopListening(this.model, "checksumCalculated");
        this.model.listenToOnce(this.model, "checksumCalculated", function(){
            callback(object);
        });
        this.model.calculateChecksum();

      } catch (exception) {
        console.log("there was a problem calculating the checksum, exception: " + exception);
      }

    },


    /**
     * limitFileInput - Ensures only the most recently added image is shown in
     * the upload zone, as we limit each zone to 1 image but dropzone is
     * designed to accept multiple files. Called whenever a file is added to a
     * dropzone element.
     */
    limitFileInput: function(){
      if (this.imageDropzone.files[1]!=null){
        this.imageDropzone.removeFile(this.imageDropzone.files[0]);
      }
    },


    /**
     * checkMinDimensions - called from dropzone's thumbnail function before the
     * image is displayed. Checks that the image meets at least the minimum
     * height and width requirements provided to view.minHeight and
     * view.minWidth.
     *
     * @param  {number} width  the image's height.
     * @param  {number} height the image's width.
     * @return {string|boolean}  returns true if the image is at least as wide as and as tall as the given height and width. Otherwise returns an error message to display to the user.
     */
    checkMinDimensions: function(width, height){

      try{
        if(width < this.minWidth && height < this.minHeight){
          return("This image is too small. Please choose an image that's at least " + this.minWidth +"px wide and " + this.minHeight + "px tall.");
        } else if (width < this.minWidth) {
          return("This image is too narrow. Please choose an image that's at least " + this.minWidth +"px wide.")
        } else if (height < this.minHeight){
          return("This image is too short. Please choose an image that's at least " + this.minHeight +"px tall.")
        } else {
          // minimum height and width are met. If too large, then image will be resized.
          return true
        }
      } catch(error){
        console.log("Error checking the min dimensions of added file. Error message:" + error);
        // Better to show an image that's too small in this case.
        return true
      }
    },

    /**
     * showImage - General function for displaying an image file in the upload zone, whether
     * just added or already uploaded. This is the function that we use to override
     * dropzone's thumbnail() function. It displays the image as the background of
     * a div if this view's imageTagName attribute is set to "div", or as an image
     * element if imageTagName is set to "img".
     * @param  {object} file    Information about the image file
     * @param  {string} dataURL A URL for the image to be displayed
     */
    showImage: function(file, dataURL){

      try{
        // Don't show files that are the wrong size or type
        if(!this.url && !file.accepted){
          return
        };

        var previewEl = $(file.previewElement).find(".image-container")[0];

        if(this.imageTagName == "img"){
          previewEl.src = dataURL;
        } else if (this.imageTagName == "div"){
          $(previewEl).css("background-image", "url(" + dataURL + ")");
        }

      } catch(error) {
        console.log(error);
        this.showError($(file.previewElement));
      }

    },

    /**
    * Display an image in the upload zone that's already saved. This gets called
    * when an image url is provided to this view.
    */
    showSavedImage: function(){

      try{

        //If there is no URL or the model hasn't been saved yet, then don't show the image
        if( !this.url || this.model.isNew() ){
          return;
        }

        // A mock image file to identify the image provided to this view
        var imageFile = {
          url: this.url
        };

        // Add it to filelist so excess images can be removed if needed
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
        // When the preview image fails to render, show some explanatory text
        this.showError($(this.imageDropzone.element));

      }

    },

    /**
     * showError - Indicates to the user that the image uploader may not work
     * due to browser issues.
     * @param {jQuery} dropzoneEl - The dropzone element to show the error for.
     */
    showError: function(dropzoneEl){
      dropzoneEl.addClass("error");
      dropzoneEl.find(".dz-error-message span").text("Error previewing image");
      dropzoneEl.tooltip({
        placement: "bottom",
        trigger: "hover",
        title: "Image previews cannot be shown. Your browser may be out-of-date."
      });
    },

    /**
     * previewImageRemove - When the user hovers over the remove button,
     * indicates to the user that the button will remove the image by 1) changing
     * the upload instruction text to a message about removing the image,
     * and 2) adding a warning class to the message div.
     */
    previewImageRemove: function(e){

      try {

        if(e){
          this.$el.toggleClass("remove-preview");
        } else {
          this.$el.removeClass("remove-preview");
        }


      } catch (error) {
        console.log(error);
      }
    }

  });

  return ImageUploaderView;

});
