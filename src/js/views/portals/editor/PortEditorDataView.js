define(['underscore',
        'jquery',
        'backbone',
        "views/portals/editor/PortEditorSectionView",
        "views/EditCollectionView",
        "text!templates/portals/editor/portEditorData.html"],
function(_, $, Backbone, PortEditorSectionView, EditCollectionView, Template){

  /**
  * @class PortEditorDataView
  */
  var PortEditorDataView = PortEditorSectionView.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "PortEditorData",

    /**
    * The display name for this Section
    * @type {string}
    */
    sectionName: "Data",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: PortEditorSectionView.prototype.className + " port-editor-data",

    /**
    * The PortalModel that is being edited
    * @type {Portal}
    */
    model: undefined,

    /**
    * A jQuery selector for the element that the EditCollectionView should be inserted into
    * @type {string}
    */
    editCollectionViewContainer: ".edit-collection-container",

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
    * @constructs PortEditorDataView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

      //Call the superclass initialize() function
      PortEditorSectionView.prototype.initialize();

    },

    /**
    * Renders this view
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

      // render EditCollectionView
      var editCollectionView = new EditCollectionView({
        model: this.model
      });
      this.$(this.editCollectionViewContainer).html(editCollectionView.el);
      editCollectionView.render();

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
