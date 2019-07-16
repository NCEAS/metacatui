define(['underscore',
        'jquery',
        'backbone',
        "views/project/editor/ProjEditorSectionView",
        "text!templates/project/editor/projEditorData.html"],
function(_, $, Backbone, ProjEditorSectionView, Template){

  /**
  * @class ProjEditorDataView
  */
  var ProjEditorDataView = ProjEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjEditorData",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: ProjEditorSectionView.prototype.className + " proj-editor-data",

    /**
    * The ProjectModel that is being edited
    * @type {Project}
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
    * Creates a new ProjEditorDataView
    * @constructs ProjEditorDataView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      //Call the superclass initialize() function
      ProjEditorSectionView.prototype.initialize();
      
    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

    }

  });

  return ProjEditorDataView;

});
