define(['underscore',
        'jquery',
        'backbone',
        "models/Map",
        "models/CollectionModel",
        "models/Search",
        "views/DataCatalogViewWithFilters",
        "views/queryBuilder/QueryBuilderView",
        "text!templates/editCollection.html"],
function(_, $, Backbone, Map, CollectionModel, Search, DataCatalogViewWithFilters,
          QueryBuilder, Template){

  /**
  * @class EditCollectionView
  * @classdesc A view that allows the user to edit the search filters that define their dataset collection
  * @classcategory Views
  * @extends Backbone.View
  * @constructor
  */
  var EditCollectionView = Backbone.View.extend(
    /** @lends EditCollectionView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    */
    type: "EditCollection",

    /**
     * A reference to the parent editor view, if there is one
     * @type {PortalEditorView}
     */
    editorView: undefined,

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
    * A jQuery selector for the element that the QueryBuilder should be inserted into
    * @type {string}
    */
    queryBuilderViewContainer: ".query-builder-view-container",
    /**
    * A jQuery selector for the element that contains the filter help text
    * @type {string}
    */
    helpTextContainer: "#filter-help-text",

    /**
     * An array of hex color codes used to help distinguish between different rules
     * @type {string[]}
     */
     ruleColorPalette: ["#44AA99", "#137733", "#c9a538", "#CC6677", "#882355", "#AA4499","#332288"],

    /**
     * Query fields to exclude in the metadata field selector of each Query Rule. This
     * is a list of field names that exist in the query service index (i.e. Solr), but
     * which should be hidden in the Query Builder
     * @type {string[]}
     */
    queryBuilderExcludeFields: MetacatUI.appModel.get("collectionQueryExcludeFields"),

    /**
     * Query fields to exclude in the metadata field selector for any Query Rules that are
     * in nested Query Builders (i.e. in nested Filter Groups). This is a list of field
     * names that exist in the query service index (i.e. Solr), but which should be hidden
     * in nested Query Builders
     * @type {string[]}
     */
    queryBuilderNestedExcludeFields: _.union(
      MetacatUI.appModel.get("collectionQueryExcludeFields"),
      MetacatUI.appModel.get("queryIdentifierFields")
    ),

    /**
     * Query fields that do not exist in the query service index, but which we would
     * like to show as options in the Query Builder field input.
     * @type {SpecialField[]}
     * @since 2.15.0
     */
    queryBuilderSpecialFields: MetacatUI.appModel.get("collectionQuerySpecialFields"),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    /**
    * Is exexcuted when a new EditCollectionView is created
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

      var title = "Change the data in your collection"
      if(this.model.isNew()){
        title = "Add data to your collection"
      }

      var helpText = "",
          email = MetacatUI.appModel.get("emailContact");

      if (email) {
        helpText = 'Need help building your data collection? <a href="maito:' + email + '">Get in touch.</a>'
      }

      this.$el.html(this.template({
        title: title,
        description: "Your collection can include any of the datasets that are available on the network. " +
          "Build rules based on metadata to define which datasets should be included in your collection. " +
          "Data added to the network in the future that match these rules will also be added to your collection. " +
          "Click the save button when you're happy with the results.",
        helpText: helpText
      }));

      // Remove this when the Query Builder is no longer new:
      this.$el
        .find(".edit-collection-title")
        .append($('<span class="new-icon" style="margin-left:10px; font-size:1rem; line-height: 25px;"><i class="icon icon-star icon-on-right"></i> NEW </span>'));
        // .append($('<span class="badge badge-info d1_pill d1_pill--primary" style="margin-left:10px">NEW!</span>'));

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
     * renderQueryBuilder - Render the QueryBuilder and insert it into this view
     */
    renderQueryBuilder: function(){

      // If the isPartOf filter is hidden, then don't allow users to build
      // a Query Rule using the isPartOf field. If they do, that rule will
      // be hidden the next time they open the portal in the editor. Also,
      // the filter they create will overwrite the isPartOf filter created by
      // default.
      if(MetacatUI.appModel.get("hideIsPartOfFilter") === true ? true : false){
        this.queryBuilderExcludeFields.push("isPartOf")
      }

      var queryBuilder = new QueryBuilder({
        filterGroup: this.model.get("definition"),
        ruleColorPalette: this.ruleColorPalette,
        excludeFields: this.queryBuilderExcludeFields,
        nestedExcludeFields: this.queryBuilderNestedExcludeFields,
        specialFields: this.queryBuilderSpecialFields,
      });

      // Render the Query Builder and insert it into this view
      this.$(this.queryBuilderViewContainer).html(queryBuilder.el);
      queryBuilder.render();
    },

    /**
     * Render the DataCatalogViewWithFilters
     */
    renderDataCatalog: function(){

      this.renderQueryBuilder();

      var searchModel = this.model.get("searchModel");

      searchModel.set("useGeohash", false);

      // Create a DataCatalog view
      var dataCatalogView = new DataCatalogViewWithFilters({
        searchModel: searchModel,
        searchResults: this.model.get("searchResults"),
        mapModel: this.model.get("mapModel") || new Map(),
        isSubView: true,
        mode: "map",
        filters: false,
        solrError500Message: "There may be a problem with one of the rules you created." +
          " Try undoing the last change you made.",
        solrErrorTitle: "Something went wrong searching for datasets that match your query",
        // Override the function that creates filter groups on the left of the
        // data catalog view. With the Query Builder view, they are not needed.
        // Otherwise, the defaultFilterGroups will be added to the Query Builder
        createFilterGroups: function(){ return },
        addAnnotationFilter: function(){ return },
        editorView: this.editorView
      });

      //Render the view and insert it into the page
      this.$(this.dataCatalogViewContainer).html(dataCatalogView.el);
      dataCatalogView.render();

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
      var currentFilters = this.model.get("definitionFilters"),
          msg = "";

      // If there are no filters set at all, the entire repository catalog will be listed as
      // search results, so display a helpful message
      if ( currentFilters.length == 0 && this.model.get("searchResults").length ) {
        msg = "<h5>Your dataset collection hasn't been created yet.</h5>" +
              "<p>The datasets listed here are totally unfiltered. To specify which datasets belong to your collection, " +
              "add rules in the Query Builder above.</p>";
      }
      //If there is only an isPartOf filter, but no datasets have been marked as part of this collection
      else if( currentFilters.length == 1 &&
               currentFilters.models[0].get("fields")[0] == "isPartOf" &&
               !this.model.get("searchResults").length){

         msg = "<h5>Your dataset collection is empty.</h5> " +
               "<p>To add datasets to your collection, " +
               "add rules in query builder above.</p>";

        //TODO: When the ability to add datasets to collection via the "isPartOf" relationship is added to MetacatUI
        // then update this message with details on how to add datasets to the collection
      }

      //If a message string was created, display it
      if( msg ){
        //Show the message
        MetacatUI.appView.showAlert(msg, "alert-warning", this.$(this.helpTextContainer));
      }
      else{
        //Remove the message
        this.$(this.helpTextContainer).empty();
        //Remove validation messaging, too
        this.$(".notification.error[data-category='definition']").removeClass("error").empty();
      }

    }

  });

  return EditCollectionView;

});
