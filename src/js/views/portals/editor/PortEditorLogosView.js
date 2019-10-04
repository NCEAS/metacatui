define(['underscore',
        'jquery',
        'backbone',
        "models/portals/PortalImage",
        "views/ImageEditView"],
function(_, $, Backbone, PortalImage, ImageEdit){

  /**
  * @class PortEditorLogosView
  */
  var PortEditorLogosView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorLogos",

    /**
    * The HTML tag name to use for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "port-editor-logos",

    /**
    * The PortalModel that is being edited
    * @type {Portal}
    */
    model: undefined,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new PortEditorLogosView
    * @constructs PortEditorLogosView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {Portal} options.model - The Portal whose logos are rendered in this view
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

      if(!this.model.get("acknowledgmentsLogos") || !this.model.get("acknowledgmentsLogos").length){
        this.model.set("acknowledgmentsLogos", Array(1).fill(new PortalImage({ nodeName: "acknowledgmentsLogo" })));
      }

      // Iterate over each logo in the PortalModel and render an ImageView
      _.each(this.model.get("acknowledgmentsLogos"), function(portalImage){

        var imageEdit = new ImageEdit({
          model: portalImage,
          imageUploadInstructions: "Drag & drop a logo here or click to upload",
          imageWidth: 100,
          imageHeight: 100,
          nameLabel: "Name",
          urlLabel: "URL",
          imageTagName: "img"
        });

        $(this.el).append(imageEdit.el);
        imageEdit.render();
        $(this.el).find(".basic-text").data({ model: portalImage });
      }, this);

      // TODO: add a new blank image edit each time an acknowledgmentsLogo is added

    },

    /**
     * removeAckLogo - removes an acknowledgmentsLogo
     *
     * @param  {type} ackLogo description
     */
    removeAckLogo: function(ackLogo){
      // TODO
    },

    /**
     * addNewAckLogo - adds another input for an acknowledgmentsLogo
     *
     * @param  {type} ackLogo description
     */
    addNewAckLogo: function(ackLogo){
      // TODO
    }

  });

  return PortEditorLogosView;

});
