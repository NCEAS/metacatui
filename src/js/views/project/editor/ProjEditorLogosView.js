define(['underscore',
        'jquery',
        'backbone',
        "views/ImageEditView"],
function(_, $, Backbone, ImageEditView){

  /**
  * @class ProjEditorLogosView
  */
  var ProjEditorLogosView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjEditorLogos",

    /**
    * The HTML tag name to use for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "proj-editor-logos",

    /**
    * The ProjectModel that is being edited
    * @type {Project}
    */
    model: undefined,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new ProjEditorLogosView
    * @constructs ProjEditorLogosView
    * @param {Object} options - A literal object with options to pass to the view
    * @property {Project} options.model - The Project whose logos are rendered in this view
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

      //TODO: Iterate over each logo in the ProjectModel and render an ImageView
      this.$el.html("Image Views will go here")
    }

  });

  return ProjEditorLogosView;

});
