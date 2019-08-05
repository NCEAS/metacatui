define(['underscore',
        'jquery',
        'backbone',
        "views/DataCatalogViewWithFilters"],
function(_, $, Backbone, DataCatalogViewWithFilters){

  /**
  * @class EditCollectionView
  */
  var EditCollectionView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "EditCollection",

    /**
    * The HTML tag name to use for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "edit-collection",

    /**
    * The model that is being edited
    * @type {model}
    */
    model: undefined,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Creates a new EditCollectionView
    * @constructs EditCollectionView
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

      //TODO: make an edit collection template?
      this.$el.html("Edit dataset collection")
    }

  });

  return EditCollectionView;

});
