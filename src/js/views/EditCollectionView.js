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
    * A jQuery selector for the element that the Save and Cancel buttons should be inserted into
    * @type {string}
    */
    collectionControlsContainer: ".applied-filters-container",

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "click .save"   : "saveCollection",
      "click .cancel" : "resetCollection"
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

      // Make sure that we have a series ID before we render the Data Catalog
      // View With Filters. For new projects, we generate and reserve a series ID
      // and use it to add an isPartOf filter to the project model. This takes time,
      // and influences the search results shown in the data catalog.
      if(this.model.get("seriesId")){
        this.renderDataCatalog();
      } else {
        this.stopListening();
        this.listenTo(this.model, "change:seriesId", this.renderDataCatalog);
      }

      //this.renderCollectionControls();

    },

    /**
     * Render the DataCatalogViewWithFilters
     */
    renderDataCatalog: function(){

      var searchModel = this.model.get("searchModel");

      console.log(searchModel.get("filters"));

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

    },

    /**
    * Renders the edit collection controls - e.g. a Save and Cancel buttton
    */
    renderCollectionControls: function(){

      //Create a Save button
      var saveButton   = $(document.createElement("a"))
                        .addClass("save btn btn-primary")
                        .text("Save"),
      //Create a Cancel button
          cancelButton = $(document.createElement("a"))
                        .addClass("cancel btn")
                        .text("Cancel"),
      //Create a container for the buttons
          buttons      = $(document.createElement("div"))
                        .addClass("collection-controls")
                        .append(saveButton, cancelButton);

      //Add the buttons to the view
      this.$(this.collectionControlsContainer).append(buttons);

    },

    /**
    * Save this Collection model with the currently applied filters
    */
    saveCollection: function(){
    },

    /**
    * Resets the Collection model back to where it was
    */
    resetCollection: function(){

    }

  });

  return EditCollectionView;

});
