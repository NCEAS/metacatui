define(['underscore',
        'jquery',
        'backbone',
        "models/ImageModel",
        "views/ImageUploaderView",
        "text!templates/imageEdit.html"],
function(_, $, Backbone, ImageModel, ImageUploaderView, Template){

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
    * The ImageModel that is being edited
    * @type {Image}
    */
    model: undefined,

    /**
    * The label to display for the image name
    * @type {string}
    */
    nameLabel: "Name",

    /**
    * The label to display for the image URL
    * @type {string}
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
    * @property {Image}  options.model - Gets set as ImageEditView.model
    * @property {string} options.nameLabel - Gets set as ImageEditView.nameLabel
    * @property {string} options.urlLabel - Gets set as ImageEditView.urlLabel
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
      this.$el.html(this.template({
        nameLabel: this.nameLabel,
        urlLabel:  this.urlLabel
      }));

      //TODO: Create an ImageUploaderView and insert into this view

    }

  });

  return ImageEditView;

});
