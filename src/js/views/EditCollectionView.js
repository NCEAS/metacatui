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
    * A jQuery selector for the element that contains the filter help text
    * @type {string}
    */
    helpTextContainer: "#filter-help-text",

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

      // Make sure that we have a series ID before we render the Data Catalog
      // View With Filters. For new portals, we generate and reserve a series ID
      // and use it to add an isPartOf filter to the portal model. This takes time,
      // and influences the search results shown in the data catalog.
      if( this.model.get("seriesId") || this.model.get("latestVersion") ){
        //Render the DataCatalog
        this.renderDataCatalog();
      } else {
        //When the seriesId or latest pid version is found, render the DataCatalog
        this.listenToOnce(this.model, "change:seriesId",    this.renderDataCatalog);
        this.listenToOnce(this.model, "latestVersionFound", this.renderDataCatalog);
      }

      //this.renderCollectionControls();

    },

    /**
     * Render the DataCatalogViewWithFilters
     */
    renderDataCatalog: function(){

      var searchModel = this.model.get("searchModel");

      //Create a DataCatalog view
      var dataCatalogView = new DataCatalogViewWithFilters({
        searchModel: searchModel,
        searchResults: this.model.get("searchResults"),
        mapModel: this.model.get("mapModel") || new Map(),
        isSubView: true,
        mode: "map",
        filters: false
      });

      //Render the view and insert it into the page
      this.$(this.dataCatalogViewContainer).html(dataCatalogView.el);
      dataCatalogView.render();

      //Add a filter input for the isPartOf filter
      if( dataCatalogView.filterGroupsView &&
          dataCatalogView.filterGroupsView.filterGroups &&
          dataCatalogView.filterGroupsView.filterGroups.length ){

        //Get the isPartOf filter in the search model
        var isPartOfFilter = searchModel.get("filters").find(function(f){
          return (f.get("fields").length == 1 && f.get("fields").includes("isPartOf"));
        });

        //If an isPartOf filter already exists, add it to the filter groups
        if( isPartOfFilter ){
          dataCatalogView.filterGroupsView.filterGroups[0].get('filters').unshift(isPartOfFilter);
        }
        //Otherwise, create a new isPartOf filter
        else{
          //Create an isPartOf filter
          isPartOfFilter = this.model.createIsPartOfFilter();
          //Set the value as a trueValue, so it can bbe used as a Toggle
          isPartOfFilter.set("trueValue", isPartOfFilter.get("values")[0]);
          //Reset the values
          isPartOfFilter.set("values", []);
          //Add the isPartOf filter to the filter collections
          dataCatalogView.filterGroupsView.filters.unshift(isPartOfFilter);
          dataCatalogView.filterGroupsView.filterGroups[0].get('filters').unshift(isPartOfFilter);
        }
      }

      this.listenTo(this.model.get("searchResults"), "reset", this.toggleHelpText);

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
     * Either hides or shows the help message that lets the user know
     * they can add filters when the collection is empty.
     */
    toggleHelpText: function() {

      //Get the list of filters currently applied to the collection definition
      var currentFilters = this.model.getAllDefinitionFilters(),
          msg = "";

      // If there are no filters set at all, the entire repository catalog will be listed as
      // search results, so display a helpful message
      if ( currentFilters.length == 0 && this.model.get("searchResults").length ) {
        msg = "<h5>Your dataset collection hasn't been created yet.</h5>" +
              "<p>The datasets listed here are totally unfiltered. To specify which datasets belong to your collection, search for data using the filters on the left.</p>";
      }
      //If there is only an isPartOf filter, but no datasets have been marked as part of this collection
      else if( currentFilters.length == 1 &&
               currentFilters[0].get("fields")[0] == "isPartOf" &&
               !this.model.get("searchResults").length){

         msg = "<h5>Your dataset collection is empty.</h5>" +
               "<p>To add datasets to your collection, search for data using the filters on the left.</p>";

        //TODO: When the ability to add datasets to collection via the "isPartOf" relationship is added to MetacatUI
        // then update this message with details on how to add datasets to the collection
      }

      //If a message string was created, display it
      if( msg ){
        //Show the message
        MetacatUI.appView.showAlert(msg, "alert-info", this.$(this.helpTextContainer));
      }
      else{
        //Remove the message
        this.$(this.helpTextContainer).children("alert").remove();
      }

    }

  });

  return EditCollectionView;

});
