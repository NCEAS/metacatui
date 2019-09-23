define(['underscore',
        'jquery',
        'backbone',
        "models/DataONEObject",
        "dropZone",
        "text!templates/imageUploader.html"],
function(_, $, Backbone, DataONEObject, dropZone, Template){

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
      }
    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template for this view
      this.$el.html(this.template());

      // Add drag + drop functionality to the iamge uploader div
      // WIP, see: https://www.dropzonejs.com/#configuration-options
      $(".dropzone").dropzone({
        url: MetacatUI.appModel.get("objectServiceUrl"), // + encodeURIComponent(this.model.get("id")),
        // paramName: "file", // The name that will be used to transfer the file
        acceptedFiles: "image/*",
        addRemoveLinks: true,
        parallelUploads: 1,
        thumbnailHeight: 200,
        thumbnailWidth: 200,
        headers: {
          //
        },
        dictDefaultMessage: "Drop an image or click here to upload image"
      });

    }

  });

  return ImageUploaderView;

});
