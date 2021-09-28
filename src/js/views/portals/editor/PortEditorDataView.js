define(['underscore',
        'jquery',
        'backbone',
        "models/filters/FilterGroup",
        "views/portals/editor/PortEditorSectionView",
        "views/EditCollectionView",
        "views/filters/FilterGroupsView",
        "text!templates/portals/editor/portEditorData.html",
      ],
function( _, $, Backbone, FilterGroup, PortEditorSectionView, EditCollectionView,
  FilterGroupsView, Template ){

  /**
  * @class PortEditorDataView
  * @classcategory Views/Portals/Editor
  */
  var PortEditorDataView = PortEditorSectionView.extend(
    /** @lends PortEditorDataView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorData",

    /**
    * The display name for this Section
    * @type {string}
    */
    uniqueSectionLabel: "Data",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: PortEditorSectionView.prototype.className + " port-editor-data",

    /**
     * A reference to the parent editor view
     * @type {PortalEditorView}
     */
    editorView: undefined,

    /**
    * The id attribute of the view element
    * @param {string}
    */
    id: "Data",

    /**
    * The PortalModel that is being edited
    * @type {Portal}
    */
    model: undefined,

    /**
    * The type of section view this is
    * @type {string}
    */
    sectionType: "data",

    /**
    * A jQuery selector for the element that the EditCollectionView should be inserted into
    * @type {string}
    */
    editCollectionViewContainer: ".edit-collection-container",

    /**
    * A jQuery selector for the element that the FilterGroupsView editor should be
    * inserted into
    * @type {string}
    * @since 2.17.0
    */
    editFilterGroupsViewContainer: ".edit-filter-groups-container",

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events:{
      // Open dataset links in new tab so user can keep editing their portal
      "click a.route-to-metadata": "openInNewTab"
    },

    /**
    * Creates a new PortEditorDataView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){
      //Call the superclass initialize() function
      PortEditorSectionView.prototype.initialize.call(this, options);
    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

      // render EditCollectionView
      var editCollectionView = new EditCollectionView({
        model: this.model,
      });
      this.$(this.editCollectionViewContainer).html(editCollectionView.el);
      editCollectionView.render();

      // render the view the edit the custom portal search filters
      // TODO: only render the filterGroupsView if there is a data collection already?

      // Make sure there is at least one empty filter group view to render
      if (!this.model.get("filterGroups") || this.model.get("filterGroups").length == 0){
        this.model.set("filterGroups", [new FilterGroup({
          label: "Search",
          isUIFilterType: true
        })])
      }
      
      var filterGroupsView = new FilterGroupsView({
        filterGroups: this.model.get("filterGroups"),
        edit: true,
        editorView: this.editorView
      });
      this.$(this.editFilterGroupsViewContainer).html(filterGroupsView.el);
      filterGroupsView.render();

      //Save a reference to this view
      this.$el.data("view", this);

    },

    /**
    * Opens a link in a new tab even when the target=_blank attribute isn't set.
    * Link is assumed to be relative; the base url is prepended to make it absolute.
    * @param {Event} e - The click event on an HTML achor element
    */
    openInNewTab: function(e){
      try{
        e.preventDefault();
        e.stopPropagation();
        var url = MetacatUI.appModel.get('baseUrl') + $(e.currentTarget).attr('href');
        window.open(url, '_blank');
      }
      catch(error){
        "Failed to open data link in new window, error message: " + error
      }
    }

  });

  return PortEditorDataView;

});
