define(['underscore',
        'jquery',
        'backbone',
        "models/portals/PortalImage",
        "views/portals/editor/PortEditorImageView"],
function(_, $, Backbone, PortalImage, ImageEdit){

  /**
  * @class PortEditorLogosView
  * @classcategory Views/Portals/Editor
  */
  var PortEditorLogosView = Backbone.View.extend(
    /** @lends PortEditorLogosView.prototype */{

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
    * A reference to the PortalEditorView
    * @type {PortalEditorView}
    */
    editorView: undefined,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "keyup .edit-image.new .basic-text" : "handleNewInput",
      "click .remove" : "handleRemove"
    },

    /**
    * Creates a new PortEditorLogosView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {Portal} options.model - The Portal whose logos are rendered in this view
    * @property {PortalEditorView}  options.editorView - Gets set as PortalEditorLogosView.editorView
    */
    initialize: function(options){

      try{
        if( typeof options == "object" ){
          this.model = options.model || undefined;
          this.editorView = options.editorView;
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

        var view = this;

        // Check if this is a new, empty acknowledgmentsLogo
        var isNew = !portalImage.get("identifier") &&
                    !portalImage.get("associatedURL") &&
                    !portalImage.get("label");

        var imageEdit = new ImageEdit({
          parentModel: this.model,
          editorView: this.editorView,
          model: portalImage,
          imageUploadInstructions: "Drag & drop a partner logo here or click to upload",
          imageWidth: 150,
          imageHeight: 150,
          minWidth: 100,
          minHeight: 100,
          maxHeight: 300,
          maxWidth: 300,
          nameLabel: "Organization name",
          urlLabel: "Organization URL",
          imageTagName: "img",
          removeButton: true
        });
        $(this.el).append(imageEdit.el);
        imageEdit.render();

        // When user adds a file, this imageEdit is no longer new
        imageEdit.listenToOnce(imageEdit.uploader, "addedfile", function(){
          view.handleNewInput(this)
        });

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
     * handleNewInput - Called when a user enters any input into a new ImageEdit
     * view. It removes the "new" class, shows the "remove" button, and adds a new
     * ImageEdit view with a blank PortalImage model.
     *
     * @param  {object} eventOrView either the keyup event when user enters text
     * into an imageEdit input, OR the imageEdit view which contains the
     * imageUploader where a user just uploaded an image.
     */
    handleNewInput: function(eventOrView){

      try {
        // Get the relevant imageEdit view element
        var imageEditEl   = eventOrView.target ?
                            // when the arguement is an event
                            $(eventOrView.target).closest(".edit-image.new") :
                            // when the argument is a view
                            eventOrView.$el;

        // This function should only modify new image-edit views
        if(!imageEditEl || !imageEditEl.hasClass("new")){
          return
        }

        var currentLogos  = this.model.get("acknowledgmentsLogos"),
            newLogo       = new PortalImage({ nodeName: "acknowledgmentsLogo" });

        // Remove the 'new' class
        imageEditEl.removeClass("new");

        // Allow users to delete this logo
        imageEditEl.find(".remove.icon").show();

        // Add a new blank portalImage
        currentLogos.push(newLogo);
        this.model.set("acknowledgmentsLogos", currentLogos);

        // Show the new EditImage view
        this.renderAckLogoInput(newLogo);

        this.editorView.showControls();

      } catch (e) {
        console.log("Failed to handle user input in an acknowledgments logo imageEdit view. Error message: " + e);
      }

    },


    /**
     * showValidation - Show validation errors for each logoView
     */
    showValidation: function(){

      var logoViews = $(this.el).find(".edit-image");

      _.each(logoViews, function(logoView){
        $(logoView).data("view").showValidation();
      });

    },

    /**
    * This function is called when a logo is removed. The logo removal itself is done
    * by the PortEditorImageView. This function performs additional functionality that
    * should happen after the removal.
    */
    handleRemove: function(){
      this.editorView.showControls();
    }

  });

  return PortEditorLogosView;

});
