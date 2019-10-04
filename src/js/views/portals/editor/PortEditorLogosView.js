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
      "click .edit-image .remove"         : "removeAckLogo",
      "keyup .edit-image.new .basic-text" : "handleNewInput"
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

      var savedLogos = this.model.get("acknowledgmentsLogos"),
          newLogo = new PortalImage({ nodeName: "acknowledgmentsLogo" });

      // If there are no acknowledgmentsLogos yet, then set a new empty logo for
      // the user to enter information into
      if( !savedLogos || !savedLogos.length){
        this.model.set( "acknowledgmentsLogos", [newLogo]);
      // If there are already logos, add a new blank logo to the end of the list.
      // Note that empty logos won't get serialized
      } else {
        savedLogos.push(newLogo);
        this.model.set("acknowledgmentsLogos", savedLogos);
      }

      // Iterate over each logo in the PortalModel and render an ImageView
      _.each(this.model.get("acknowledgmentsLogos"), function(portalImage){

        this.renderAckLogoInput(portalImage);

      }, this);

      // TODO: add a new blank image edit each time an acknowledgmentsLogo is added

    },


    /**
     * renderAckLogoInput - description
     *
     * @param  {type} portalImage description
     * @return {type}             description
     */
    renderAckLogoInput: function(portalImage){

      // Check if this is a new, empty acknowledgmentsLogo
      var isNew = !portalImage.get("identifier") &&
                  !portalImage.get("associatedURL") &&
                  !portalImage.get("label");

      var imageEdit = new ImageEdit({
        model: portalImage,
        imageUploadInstructions: "Drag & drop a partner logo here or click to upload",
        imageWidth: 100,
        imageHeight: 100,
        nameLabel: "Name",
        urlLabel: "URL",
        imageTagName: "img",
        removeButton: true
      });
      $(this.el).append(imageEdit.el);
      imageEdit.render();

      // When user adds a file, this imageEdit is no longer new
      this.listenToOnce(imageEdit, "imageAdded", this.handleNewInput);

      // For updaing the field on user input
      $(imageEdit.el).find(".basic-text").data({ model: portalImage });
      // For removing the imageModel when user clicks 'remove'
      $(imageEdit.el).data({ model: portalImage });

      if(isNew){
        $(imageEdit.el).addClass("new");
        // Don't allow users to remove the new portalImage -
        // it's the only place to add an acknowledgmentsLogo.
        $(imageEdit.el).find(".remove.icon").hide();
      }

    },

    /**
     * removeAckLogo - removes an acknowledgmentsLogo
     *
     * @param  {type} ackLogo description
     */
    removeAckLogo: function(e){

      if(!e.target || !$(e.target).parent().data("model")){
        return
      }

      // Remove the model
      var portalImage = $(e.target).parent().data("model");
      this.model.removeAcknowledgementLogo(portalImage);

      // Remove the div
      $(e.target).parent().animate({width: "0px", overflow: "hidden"}, {
        duration: 250,
        complete: function(){
          this.remove();
        }
      });

    },

    /**
     * handleNewInput - Called when a user enters any input into a new ImageEdit
     * view. It removed the "new" class, shows the "remove" button, and adds a new
     * ImageEdit with a blank PortalImage model.
     *
     * @param  {object} eOrEl either the keyup event when user enters text into a
     * imageEdit input, OR the actual imageEdit element passed from imageEdit
     * view when the user adds an image.
     */
    handleNewInput: function(eOrEl){

      var imageEditEl   = eOrEl.target ?
                          $(eOrEl.target).closest(".edit-image.new") :
                          $(eOrEl),
          currentLogos  = this.model.get("acknowledgmentsLogos"),
          newLogo       = new PortalImage({ nodeName: "acknowledgmentsLogo" });

      // Remove the new class
      imageEditEl.closest(".edit-image.new").removeClass("new");
      imageEditEl.find(".remove.icon").show();

      // Add a new blank portalImage
      currentLogos.push(newLogo);
      this.model.set("acknowledgmentsLogos", currentLogos);

      // Show the new EditImage view
      this.renderAckLogoInput(newLogo);

    }

  });

  return PortEditorLogosView;

});
