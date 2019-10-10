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

      try{
        if( typeof options == "object" ){
          this.model = options.model || undefined;
        }
      } catch(e){
        console.log("PortEditorLogosView failed to initialize. Error message: " + e);
      }

    },

    /**
    * Renders this view
    */
    render: function(){

      try{
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
      }
      catch(e){
        console.log("PortEditorLogosView failed to render, error message: " + e );
      }
    },


    /**
     * renderAckLogoInput - Adds a new ImageEdit view for a specified PortalImage model for an acknowledgments logo.
     *
     * @param  {PortalImage} portalImage The PortalImage model to create an ImageEdit view for.
     */
    renderAckLogoInput: function(portalImage){

      try {
        // Check if this is a new, empty acknowledgmentsLogo
        var isNew = !portalImage.get("identifier") &&
                    !portalImage.get("associatedURL") &&
                    !portalImage.get("label");

        var imageEdit = new ImageEdit({
          model: portalImage,
          imageUploadInstructions: "Drag & drop a partner logo here or click to upload",
          imageWidth: 150,
          imageHeight: 150,
          nameLabel: "Organization name",
          urlLabel: "Organization URL",
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
      } catch (e) {
        console.log("Could not render an ImageEdit view for an acknowledgmentsLogo. Error message: " + e);
      }

    },

    /**
     * removeAckLogo - removes the PortalImage model and ImageEdit view associated with an acknowledgmentsLogo
     *
     * @param  {event} e - the click event on the ImageEdit view's remove button
     */
    removeAckLogo: function(e){

      try {
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

            var view = $(this).data("view");
            if( view.onClose )
              view.onClose();

            this.remove();

          }
        });

      } catch (e) {
        console.log("Failed to remove an acknowledgments logo. Error message:" + e) ;
      }


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

      try {
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
      } catch (e) {
        console.log("Failed to handle user input in an acknowledgments logo imageEdit view. Error message: " + e);
      }

    }

  });

  return PortEditorLogosView;

});
