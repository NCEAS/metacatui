define(['underscore',
        'jquery',
        'backbone',
        "views/ImageEditView"],
function(_, $, Backbone, ImageEditView){

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

      //TODO: Iterate over each logo in the PortalModel and render an ImageView
      this.$el.html("Image Views will go here")
    }

  });

  return PortEditorLogosView;

});
