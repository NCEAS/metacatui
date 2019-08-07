define(['underscore',
        'jquery',
        'backbone',
        "models/Map",
        "models/CollectionModel",
        "models/Search",
        "views/DataCatalogViewWithFilters",
        "text!templates/editCollection.html"],
function(_, $, Backbone, Map, CollectionModel, Search, DataCatalogViewWithFilters,
         Template){

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
    * The Collection model that is being edited
    * @type {CollectionModel}
    */
    model: undefined,

    /**
    * The template for this view. An HTML file is converted to an Underscore.js template
    */
    template: _.template(Template),

    /**
    * A jQuery selector for the element that the DataCatalogViewWithFilters should be inserted into
    * @type {string}
    */
    dataCatalogViewContainer: ".data-catalog-view-container",

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
    * @property {CollectionModel} options.model - The collection whose search results will be displayed and edited in this view
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

      this.$el.html(this.template());

      //Create a Search model using the collection definition
      var searchModel = new Search({
        filters: this.model.get("filters")
      });

      //Create a DataCatalog view
      var dataCatalogView = new DataCatalogViewWithFilters({
        searchModel: searchModel,
        searchResults: this.model.get("searchResults"),
        mapModel: this.model.get("mapModel") || new Map(),
        isSubView: true,
        mode: "map"
      });

      //Render the view and insert it into the page
      this.$(this.dataCatalogViewContainer).html(dataCatalogView.el);
      dataCatalogView.render();

    }

  });

  return EditCollectionView;

});
